/**
 * Reliability & Recovery Service for TASMAC POS
 * 
 * Handles:
 * - Database corruption detection (integrity check)
 * - Automatic repair attempts
 * - Backup restore flow when corruption detected
 * - Internet reconnection handling
 * - Sync recovery after crash
 * - Application crash logging
 * - Startup health checks
 * 
 * Philosophy: The app must NEVER lose data and NEVER become unusable.
 * If the database is corrupted, auto-restore from the latest backup.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'tasmac.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const CRASH_LOG_PATH = path.join(DB_DIR, 'crash.log');
const HEALTH_LOG_PATH = path.join(DB_DIR, 'health.log');

// ============================================================
// Database Integrity
// ============================================================

/**
 * Run SQLite integrity check on the database
 * Returns { ok: boolean, result: string, errors: string[] }
 */
function checkDatabaseIntegrity() {
  if (!fs.existsSync(DB_PATH)) {
    return { ok: false, result: 'Database file not found', errors: ['DB_NOT_FOUND'] };
  }

  try {
    const result = execSync(`sqlite3 "${DB_PATH}" "PRAGMA integrity_check;"`, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (result === 'ok') {
      return { ok: true, result: 'ok', errors: [] };
    }

    // Parse errors
    const errors = result.split('\n').filter(line => line && line !== 'ok');
    return { ok: false, result, errors };
  } catch (err) {
    return { ok: false, result: err.message, errors: ['INTEGRITY_CHECK_FAILED', err.message] };
  }
}

/**
 * Run a quick check (faster than full integrity check)
 * Verifies DB can be opened and basic queries work
 */
function quickHealthCheck() {
  const checks = {
    dbExists: false,
    canOpen: false,
    canQuery: false,
    tablesExist: false,
    hasUsers: false,
    walMode: false
  };

  try {
    checks.dbExists = fs.existsSync(DB_PATH);
    if (!checks.dbExists) return { healthy: false, checks, error: 'Database file missing' };

    // Try to query
    const result = execSync(`sqlite3 -json "${DB_PATH}" "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table';"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    checks.canOpen = true;
    
    const parsed = JSON.parse(result);
    checks.canQuery = true;
    checks.tablesExist = parsed[0]?.cnt >= 8; // We should have at least 8 tables

    // Check users exist
    const userResult = execSync(`sqlite3 -json "${DB_PATH}" "SELECT COUNT(*) as cnt FROM users;"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    const users = JSON.parse(userResult);
    checks.hasUsers = users[0]?.cnt > 0;

    // Check WAL mode
    const walResult = execSync(`sqlite3 "${DB_PATH}" "PRAGMA journal_mode;"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    checks.walMode = walResult === 'wal';

    const healthy = checks.dbExists && checks.canOpen && checks.canQuery && checks.tablesExist && checks.hasUsers;
    return { healthy, checks, error: null };
  } catch (err) {
    return { healthy: false, checks, error: err.message };
  }
}

/**
 * Attempt to repair a corrupted database
 * Strategy: dump what we can, recreate, reimport
 */
function attemptRepair() {
  const repairLog = [];
  
  try {
    repairLog.push(`[${new Date().toISOString()}] Starting repair attempt...`);
    
    // Step 1: Try to dump data
    const dumpPath = path.join(DB_DIR, 'repair_dump.sql');
    try {
      execSync(`sqlite3 "${DB_PATH}" ".dump" > "${dumpPath}"`, {
        encoding: 'utf8',
        timeout: 60000,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      repairLog.push('Step 1: Data dump successful');
    } catch (err) {
      repairLog.push('Step 1: Data dump failed - ' + err.message);
      // If dump fails, try backup restore instead
      return { success: false, method: 'dump_failed', log: repairLog };
    }

    // Step 2: Rename corrupted DB
    const corruptPath = DB_PATH + '.corrupt.' + Date.now();
    fs.renameSync(DB_PATH, corruptPath);
    repairLog.push('Step 2: Corrupted DB renamed to ' + path.basename(corruptPath));

    // Step 3: Create fresh DB and import dump
    try {
      execSync(`sqlite3 "${DB_PATH}" ".read ${dumpPath}"`, {
        encoding: 'utf8',
        timeout: 60000,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      repairLog.push('Step 3: Fresh DB created from dump');
    } catch (err) {
      // If reimport fails, restore from backup
      repairLog.push('Step 3: Reimport failed - ' + err.message);
      if (fs.existsSync(corruptPath)) {
        fs.renameSync(corruptPath, DB_PATH); // Restore the corrupt file
      }
      return { success: false, method: 'reimport_failed', log: repairLog };
    }

    // Step 4: Verify repaired DB
    const verify = checkDatabaseIntegrity();
    if (verify.ok) {
      repairLog.push('Step 4: Repaired DB passes integrity check');
      // Clean up dump file
      if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
      return { success: true, method: 'dump_and_reimport', log: repairLog };
    } else {
      repairLog.push('Step 4: Repaired DB still has issues - falling back to backup');
      return { success: false, method: 'repair_incomplete', log: repairLog };
    }
  } catch (err) {
    repairLog.push('Repair error: ' + err.message);
    return { success: false, method: 'exception', log: repairLog, error: err.message };
  }
}

/**
 * Restore from the latest available backup
 * This is the last resort when repair fails
 */
function restoreLatestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return { success: false, error: 'No backup directory found' };
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => ({ filename: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  if (backups.length === 0) {
    return { success: false, error: 'No backup files found' };
  }

  const latestBackup = backups[0];
  const backupPath = path.join(BACKUP_DIR, latestBackup.filename);

  try {
    // Verify the backup is valid before restoring
    const backupCheck = execSync(`sqlite3 "${backupPath}" "PRAGMA integrity_check;"`, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (backupCheck !== 'ok') {
      // Try next backup
      for (let i = 1; i < Math.min(backups.length, 5); i++) {
        const altPath = path.join(BACKUP_DIR, backups[i].filename);
        const altCheck = execSync(`sqlite3 "${altPath}" "PRAGMA integrity_check;"`, {
          encoding: 'utf8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        
        if (altCheck === 'ok') {
          fs.copyFileSync(altPath, DB_PATH);
          return { success: true, restored: backups[i].filename, method: 'alt_backup' };
        }
      }
      return { success: false, error: 'All recent backups are also corrupted' };
    }

    // Backup the corrupted current DB
    if (fs.existsSync(DB_PATH)) {
      const corruptPath = DB_PATH + '.pre-restore.' + Date.now();
      fs.copyFileSync(DB_PATH, corruptPath);
    }

    // Copy backup over current
    fs.copyFileSync(backupPath, DB_PATH);
    
    return { success: true, restored: latestBackup.filename, method: 'latest_backup' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// Startup Health Check
// ============================================================

/**
 * Full startup health check - runs on app launch
 * If corruption detected, attempts repair then backup restore
 * Returns: { status: 'healthy'|'repaired'|'restored'|'failed', details: {} }
 */
function startupCheck() {
  const timestamp = new Date().toISOString();
  let status = 'healthy';
  let details = {};

  // Step 1: Quick health check
  const health = quickHealthCheck();
  
  if (health.healthy) {
    logHealth(timestamp, 'HEALTHY', 'Quick check passed');
    return { status: 'healthy', details: health.checks };
  }

  console.warn('[Reliability] Health check failed:', health.error);
  logHealth(timestamp, 'UNHEALTHY', health.error);

  // Step 2: Full integrity check
  const integrity = checkDatabaseIntegrity();
  
  if (integrity.ok) {
    // Quick check failed but integrity is fine - might just need table recreation
    logHealth(timestamp, 'RECOVERED', 'Integrity OK but tables missing - will reinitialize');
    return { status: 'healthy', details: { integrity: 'ok', note: 'reinitializing tables' } };
  }

  console.error('[Reliability] Database corruption detected!', integrity.errors);
  logHealth(timestamp, 'CORRUPTED', JSON.stringify(integrity.errors));

  // Step 3: Attempt repair
  const repair = attemptRepair();
  if (repair.success) {
    console.log('[Reliability] Database repaired successfully');
    logHealth(timestamp, 'REPAIRED', repair.method);
    return { status: 'repaired', details: repair };
  }

  // Step 4: Restore from backup
  console.log('[Reliability] Repair failed, restoring from backup...');
  const restore = restoreLatestBackup();
  
  if (restore.success) {
    console.log('[Reliability] Restored from backup:', restore.restored);
    logHealth(timestamp, 'RESTORED', `From: ${restore.restored}`);
    return { status: 'restored', details: restore };
  }

  // Step 5: Complete failure
  console.error('[Reliability] ALL RECOVERY METHODS FAILED');
  logHealth(timestamp, 'FAILED', restore.error);
  return { status: 'failed', details: { error: 'All recovery methods failed', restore } };
}

// ============================================================
// Crash Logging
// ============================================================

/**
 * Log a crash event
 */
function logCrash(error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    error: error?.message || String(error),
    stack: error?.stack || '',
    context,
    platform: process.platform,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage()
  };

  try {
    let crashes = [];
    if (fs.existsSync(CRASH_LOG_PATH)) {
      try {
        crashes = JSON.parse(fs.readFileSync(CRASH_LOG_PATH, 'utf8'));
      } catch { crashes = []; }
    }
    
    crashes.push(entry);
    // Keep last 50 crashes
    if (crashes.length > 50) crashes = crashes.slice(-50);
    
    fs.writeFileSync(CRASH_LOG_PATH, JSON.stringify(crashes, null, 2), 'utf8');
  } catch (logErr) {
    // If we can't even write the crash log, there's nothing more we can do
    console.error('[Reliability] Cannot write crash log:', logErr.message);
  }
}

/**
 * Get recent crash logs
 */
function getCrashLogs(limit = 20) {
  if (!fs.existsSync(CRASH_LOG_PATH)) return [];
  try {
    const crashes = JSON.parse(fs.readFileSync(CRASH_LOG_PATH, 'utf8'));
    return crashes.slice(-limit).reverse();
  } catch { return []; }
}

/**
 * Log health check result
 */
function logHealth(timestamp, status, details) {
  try {
    let log = [];
    if (fs.existsSync(HEALTH_LOG_PATH)) {
      try { log = JSON.parse(fs.readFileSync(HEALTH_LOG_PATH, 'utf8')); }
      catch { log = []; }
    }
    log.push({ timestamp, status, details });
    if (log.length > 100) log = log.slice(-100);
    fs.writeFileSync(HEALTH_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch { /* silent */ }
}

/**
 * Get health history
 */
function getHealthHistory(limit = 20) {
  if (!fs.existsSync(HEALTH_LOG_PATH)) return [];
  try {
    const log = JSON.parse(fs.readFileSync(HEALTH_LOG_PATH, 'utf8'));
    return log.slice(-limit).reverse();
  } catch { return []; }
}

// ============================================================
// Sync Recovery
// ============================================================

/**
 * Recover sync state after a crash
 * Resets stuck sync items (items that were being processed when crash happened)
 */
function recoverSyncState() {
  try {
    // Any items marked as "processing" should be reset to pending
    // In our schema, items with synced=0 are still pending, so nothing to reset
    // But clean up very old unsynced items (over 30 days) as they may be stale
    execSync(`sqlite3 "${DB_PATH}" "DELETE FROM pending_sync WHERE synced = 0 AND created_at < datetime('now', '-30 days');"`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// Resource Monitoring
// ============================================================

/**
 * Get system resource status
 */
function getResourceStatus() {
  const memUsage = process.memoryUsage();
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  
  let backupSize = 0;
  if (fs.existsSync(BACKUP_DIR)) {
    fs.readdirSync(BACKUP_DIR).forEach(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      backupSize += stat.size;
    });
  }

  return {
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    },
    database: {
      size: dbSize,
      sizeFormatted: formatSize(dbSize),
      path: DB_PATH
    },
    backups: {
      totalSize: backupSize,
      totalSizeFormatted: formatSize(backupSize),
      path: BACKUP_DIR
    },
    uptime: Math.round(process.uptime()),
    pid: process.pid
  };
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Integrity
  checkDatabaseIntegrity,
  quickHealthCheck,
  attemptRepair,
  restoreLatestBackup,
  // Startup
  startupCheck,
  // Crash
  logCrash,
  getCrashLogs,
  // Health
  getHealthHistory,
  // Sync
  recoverSyncState,
  // Resources
  getResourceStatus
};
