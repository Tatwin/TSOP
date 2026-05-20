/**
 * Reliability & Recovery Service for TASMAC POS
 * Uses better-sqlite3 (not CLI) for health checks
 */
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'tasmac.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const CRASH_LOG_PATH = path.join(DB_DIR, 'crash.log');
const HEALTH_LOG_PATH = path.join(DB_DIR, 'health.log');

function quickHealthCheck() {
  const checks = { dbExists: false, canOpen: false, canQuery: false, tablesExist: false, hasUsers: false, walMode: false };
  
  try {
    checks.dbExists = fs.existsSync(DB_PATH);
    if (!checks.dbExists) return { healthy: false, checks, error: 'Database file missing' };
    
    const Database = require('better-sqlite3');
    const testDb = new Database(DB_PATH, { readonly: true });
    checks.canOpen = true;
    
    const tables = testDb.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'").get();
    checks.canQuery = true;
    checks.tablesExist = tables.cnt >= 8;
    
    const users = testDb.prepare('SELECT COUNT(*) as cnt FROM users').get();
    checks.hasUsers = users.cnt > 0;
    
    const wal = testDb.pragma('journal_mode', { simple: true });
    checks.walMode = wal === 'wal';
    
    testDb.close();
    return { healthy: checks.dbExists && checks.canOpen && checks.canQuery && checks.tablesExist && checks.hasUsers, checks, error: null };
  } catch (err) {
    return { healthy: false, checks, error: err.message };
  }
}

function checkDatabaseIntegrity() {
  if (!fs.existsSync(DB_PATH)) return { ok: false, result: 'Database file not found', errors: ['DB_NOT_FOUND'] };
  
  try {
    const Database = require('better-sqlite3');
    const testDb = new Database(DB_PATH, { readonly: true });
    const result = testDb.pragma('integrity_check');
    testDb.close();
    
    if (result.length === 1 && result[0].integrity_check === 'ok') {
      return { ok: true, result: 'ok', errors: [] };
    }
    return { ok: false, result: JSON.stringify(result), errors: result.map(r => r.integrity_check) };
  } catch (err) {
    return { ok: false, result: err.message, errors: ['INTEGRITY_CHECK_FAILED'] };
  }
}

function startupCheck() {
  const timestamp = new Date().toISOString();
  const health = quickHealthCheck();
  
  if (health.healthy) {
    logHealth(timestamp, 'HEALTHY', 'Quick check passed');
    return { status: 'healthy', details: health.checks };
  }
  
  // If DB doesn't exist, that's fine - it will be created by database.js
  if (!health.checks.dbExists) {
    return { status: 'healthy', details: { note: 'Fresh database will be created' } };
  }
  
  console.warn('[Reliability] Health check failed:', health.error);
  logHealth(timestamp, 'UNHEALTHY', health.error);
  
  // Try to restore from backup
  const restore = restoreLatestBackup();
  if (restore.success) {
    logHealth(timestamp, 'RESTORED', `From: ${restore.restored}`);
    return { status: 'restored', details: restore };
  }
  
  return { status: 'failed', details: { error: health.error } };
}

function restoreLatestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return { success: false, error: 'No backup directory' };
  
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => ({ filename: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  
  if (backups.length === 0) return { success: false, error: 'No backup files found' };
  
  try {
    const backupPath = path.join(BACKUP_DIR, backups[0].filename);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, DB_PATH + '.corrupt.' + Date.now());
    }
    fs.copyFileSync(backupPath, DB_PATH);
    return { success: true, restored: backups[0].filename };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function attemptRepair() {
  return { success: false, method: 'not_implemented', log: ['Use restoreLatestBackup instead'] };
}

function logCrash(error, context = {}) {
  try {
    let crashes = [];
    if (fs.existsSync(CRASH_LOG_PATH)) { try { crashes = JSON.parse(fs.readFileSync(CRASH_LOG_PATH, 'utf8')); } catch {} }
    crashes.push({ timestamp: new Date().toISOString(), error: error?.message || String(error), stack: error?.stack || '', context });
    if (crashes.length > 50) crashes = crashes.slice(-50);
    fs.writeFileSync(CRASH_LOG_PATH, JSON.stringify(crashes, null, 2), 'utf8');
  } catch {}
}

function getCrashLogs(limit = 20) {
  if (!fs.existsSync(CRASH_LOG_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(CRASH_LOG_PATH, 'utf8')).slice(-limit).reverse(); } catch { return []; }
}

function logHealth(timestamp, status, details) {
  try {
    let log = [];
    if (fs.existsSync(HEALTH_LOG_PATH)) { try { log = JSON.parse(fs.readFileSync(HEALTH_LOG_PATH, 'utf8')); } catch {} }
    log.push({ timestamp, status, details });
    if (log.length > 100) log = log.slice(-100);
    fs.writeFileSync(HEALTH_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch {}
}

function getHealthHistory(limit = 20) {
  if (!fs.existsSync(HEALTH_LOG_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(HEALTH_LOG_PATH, 'utf8')).slice(-limit).reverse(); } catch { return []; }
}

function getResourceStatus() {
  const mem = process.memoryUsage();
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  return {
    memory: { rss: Math.round(mem.rss / 1024 / 1024), heapUsed: Math.round(mem.heapUsed / 1024 / 1024) },
    database: { size: dbSize, sizeFormatted: dbSize < 1024*1024 ? (dbSize/1024).toFixed(1)+' KB' : (dbSize/1024/1024).toFixed(1)+' MB', path: DB_PATH },
    backups: { totalSizeFormatted: '0 B', path: BACKUP_DIR },
    uptime: Math.round(process.uptime()), pid: process.pid
  };
}

function recoverSyncState() { return { success: true }; }

module.exports = { checkDatabaseIntegrity, quickHealthCheck, attemptRepair, restoreLatestBackup, startupCheck, logCrash, getCrashLogs, getHealthHistory, getResourceStatus, recoverSyncState };
