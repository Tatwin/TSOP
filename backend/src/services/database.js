/**
 * SQLite Database Service for TASMAC POS
 * Uses better-sqlite3 (native Node.js bindings - NO sqlite3 CLI needed)
 * WAL mode for performance, transactions for batch operations
 */
const path = require('path');
const fs = require('fs');

// Database file location
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'tasmac.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Initialize database
const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

// Enable WAL mode and performance settings
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -64000');

// ============================================================
// Schema Initialization
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  pin TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('salesmen', 'supervisors')),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sno INTEGER,
  code_no TEXT,
  particular TEXT NOT NULL,
  category TEXT NOT NULL,
  rate REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  bottles_per_case INTEGER DEFAULT 48,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_entries (
  date TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS denominations (
  date TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  user TEXT NOT NULL DEFAULT 'system',
  description TEXT,
  previous_value TEXT,
  new_value TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pending_sync (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
  data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  device_id TEXT,
  sync_version INTEGER DEFAULT 0,
  synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  label TEXT,
  size INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  device_id TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_denominations_date ON denominations(date);
CREATE INDEX IF NOT EXISTS idx_pending_sync_synced ON pending_sync(synced);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_staff_type ON staff(type);
`);

// Seed default data
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, username, name, role, pin) VALUES (?, ?, ?, ?, ?)');
  insertUser.run('1', 'admin', 'ADMIN', 'admin', '1974');
  insertUser.run('2', 'operator', 'SUPERVISOR', 'operator', '1745');
}

const staffCount = db.prepare('SELECT COUNT(*) as cnt FROM staff').get();
if (staffCount.cnt === 0) {
  const insertStaff = db.prepare('INSERT INTO staff (type, name, sort_order) VALUES (?, ?, ?)');
  insertStaff.run('salesmen', 'SHANMUGASUNDARAM.P', 1);
  insertStaff.run('salesmen', 'ARUMUGAM.A', 2);
  insertStaff.run('salesmen', 'RAMESHKUMAR.A', 3);
  insertStaff.run('salesmen', 'SHANMUGASUNDARAM.M', 4);
  insertStaff.run('supervisors', 'ANTONYSAMY.A', 1);
  insertStaff.run('supervisors', 'SARAVAN', 2);
}

const settingsCount = db.prepare('SELECT COUNT(*) as cnt FROM settings').get();
if (settingsCount.cnt === 0) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('shopNo', '1745');
  insertSetting.run('shopName', 'TASMAC Shop No. 1745');
  insertSetting.run('address', 'SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101');
}

console.log('[Database] SQLite initialized at', DB_PATH);

// ============================================================
// CRUD Operations
// ============================================================

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')').run(key, value);
}

function setAllSettings(settings) {
  const del = db.prepare('DELETE FROM settings');
  const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    del.run();
    for (const [key, value] of Object.entries(settings)) {
      ins.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  });
  tx();
}

function getUsers() {
  return db.prepare('SELECT id, username, name, role, pin, created_at, updated_at FROM users').all().map(r => ({
    id: r.id, username: r.username, name: r.name, role: r.role, pin: r.pin,
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

function setUsers(users) {
  const del = db.prepare('DELETE FROM users');
  const ins = db.prepare('INSERT INTO users (id, username, name, role, pin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    del.run();
    for (const u of users) {
      ins.run(u.id, u.username, u.name, u.role, u.pin || null, u.createdAt || new Date().toISOString(), u.updatedAt || new Date().toISOString());
    }
  });
  tx();
}

function getStaff() {
  const rows = db.prepare('SELECT type, name FROM staff ORDER BY sort_order ASC, id ASC').all();
  const staff = { salesmen: [], supervisors: [] };
  rows.forEach(r => { if (staff[r.type]) staff[r.type].push(r.name); });
  return staff;
}

function setStaff(staffObj) {
  const del = db.prepare('DELETE FROM staff');
  const ins = db.prepare('INSERT INTO staff (type, name, sort_order) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    del.run();
    (staffObj.salesmen || []).forEach((name, idx) => ins.run('salesmen', name, idx + 1));
    (staffObj.supervisors || []).forEach((name, idx) => ins.run('supervisors', name, idx + 1));
  });
  tx();
}

function getProducts() {
  const rows = db.prepare('SELECT id, sno, code_no, particular, category, rate, status FROM products ORDER BY sno ASC').all();
  if (rows.length === 0) return null;
  return rows.map(r => ({ id: r.id, sno: r.sno, codeNo: r.code_no || '', particular: r.particular, category: r.category, rate: r.rate || 0, status: r.status || 'active' }));
}

function setProducts(products) {
  const del = db.prepare('DELETE FROM products');
  const ins = db.prepare('INSERT INTO products (id, sno, code_no, particular, category, rate, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))');
  const tx = db.transaction(() => {
    del.run();
    for (const p of products) ins.run(p.id, p.sno || 0, p.codeNo || '', p.particular, p.category, p.rate || 0, p.status || 'active');
  });
  tx();
}

function getCategories() {
  const rows = db.prepare('SELECT key, label, bottles_per_case FROM categories').all();
  if (rows.length === 0) return null;
  const cats = {};
  rows.forEach(r => { cats[r.key] = { label: r.label, bottlesPerCase: r.bottles_per_case }; });
  return cats;
}

function setCategories(categories) {
  const del = db.prepare('DELETE FROM categories');
  const ins = db.prepare('INSERT INTO categories (key, label, bottles_per_case, updated_at) VALUES (?, ?, ?, datetime(\'now\'))');
  const tx = db.transaction(() => {
    del.run();
    for (const [key, val] of Object.entries(categories)) ins.run(key, val.label, val.bottlesPerCase || 48);
  });
  tx();
}

// Daily Entries (stored as JSON per date)
function getAllDailyEntries() {
  const rows = db.prepare('SELECT date, data FROM daily_entries').all();
  const entries = {};
  rows.forEach(r => { try { entries[r.date] = JSON.parse(r.data); } catch { entries[r.date] = {}; } });
  return entries;
}

function getDailyEntry(date) {
  const row = db.prepare('SELECT data FROM daily_entries WHERE date = ?').get(date);
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

function setDailyEntry(date, data) {
  db.prepare('INSERT INTO daily_entries (date, data, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(date) DO UPDATE SET data = excluded.data, updated_at = datetime(\'now\')').run(date, JSON.stringify(data));
}

function deleteDailyEntry(date) {
  db.prepare('DELETE FROM daily_entries WHERE date = ?').run(date);
  return true;
}

function setAllDailyEntries(entries) {
  const del = db.prepare('DELETE FROM daily_entries');
  const ins = db.prepare('INSERT INTO daily_entries (date, data) VALUES (?, ?)');
  const tx = db.transaction(() => {
    del.run();
    for (const [date, data] of Object.entries(entries)) ins.run(date, JSON.stringify(data));
  });
  tx();
}

// Denominations
function getAllDenominations() {
  const rows = db.prepare('SELECT date, data FROM denominations').all();
  const denoms = {};
  rows.forEach(r => { try { denoms[r.date] = JSON.parse(r.data); } catch { denoms[r.date] = {}; } });
  return denoms;
}

function getDenomination(date) {
  const row = db.prepare('SELECT data FROM denominations WHERE date = ?').get(date);
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

function setDenomination(date, data) {
  db.prepare('INSERT INTO denominations (date, data, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(date) DO UPDATE SET data = excluded.data, updated_at = datetime(\'now\')').run(date, JSON.stringify(data));
}

function deleteDenomination(date) {
  db.prepare('DELETE FROM denominations WHERE date = ?').run(date);
  return true;
}

function setAllDenominations(denoms) {
  const del = db.prepare('DELETE FROM denominations');
  const ins = db.prepare('INSERT INTO denominations (date, data) VALUES (?, ?)');
  const tx = db.transaction(() => {
    del.run();
    for (const [date, data] of Object.entries(denoms)) ins.run(date, JSON.stringify(data));
  });
  tx();
}

// Audit Logs
function getAuditLogs() {
  return db.prepare('SELECT id, timestamp, action, module, user, description, previous_value, new_value, metadata FROM audit_logs ORDER BY timestamp DESC').all().map(r => ({
    id: r.id, timestamp: r.timestamp, action: r.action, module: r.module, user: r.user, description: r.description,
    previousValue: r.previous_value ? JSON.parse(r.previous_value) : null,
    newValue: r.new_value ? JSON.parse(r.new_value) : null,
    metadata: r.metadata ? JSON.parse(r.metadata) : {}
  }));
}

function appendAuditLog(entry) {
  db.prepare('INSERT INTO audit_logs (id, timestamp, action, module, user, description, previous_value, new_value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    entry.id, entry.timestamp, entry.action, entry.module, entry.user || 'system', entry.description || '',
    entry.previousValue ? JSON.stringify(entry.previousValue) : null,
    entry.newValue ? JSON.stringify(entry.newValue) : null,
    entry.metadata ? JSON.stringify(entry.metadata) : null
  );
  // Cap at 10000
  const count = db.prepare('SELECT COUNT(*) as cnt FROM audit_logs').get();
  if (count.cnt > 10000) {
    db.prepare(`DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY timestamp ASC LIMIT ?)`).run(count.cnt - 10000);
  }
}

function setAuditLogs(logs) {
  const del = db.prepare('DELETE FROM audit_logs');
  const ins = db.prepare('INSERT INTO audit_logs (id, timestamp, action, module, user, description, previous_value, new_value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    del.run();
    for (const e of logs) ins.run(e.id, e.timestamp, e.action, e.module, e.user || 'system', e.description || '', e.previousValue ? JSON.stringify(e.previousValue) : null, e.newValue ? JSON.stringify(e.newValue) : null, e.metadata ? JSON.stringify(e.metadata) : null);
  });
  tx();
}

// ============================================================
// Sync Queue
// ============================================================

function addToSyncQueue(tableName, recordId, operation, data) {
  db.prepare('INSERT INTO pending_sync (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)').run(tableName, recordId, operation, JSON.stringify(data));
}

function getPendingSyncItems(limit = 50) {
  return db.prepare('SELECT id, table_name, record_id, operation, data, created_at, device_id FROM pending_sync WHERE synced = 0 ORDER BY created_at ASC LIMIT ?').all(limit);
}

function markSynced(ids) {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE pending_sync SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
}

function cleanSyncQueue(olderThanDays = 7) {
  db.prepare(`DELETE FROM pending_sync WHERE synced = 1 AND created_at < datetime('now', '-' || ? || ' days')`).run(olderThanDays);
}

function getSyncStats() {
  const pending = db.prepare('SELECT COUNT(*) as cnt FROM pending_sync WHERE synced = 0').get();
  const synced = db.prepare('SELECT COUNT(*) as cnt FROM pending_sync WHERE synced = 1').get();
  return { pendingCount: pending.cnt, syncedCount: synced.cnt };
}

// ============================================================
// Backup Operations
// ============================================================

function createBackup(label) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}${label ? '_' + label : ''}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);

  // Use better-sqlite3 backup API (safe, consistent)
  db.backup(backupPath);

  const stat = fs.statSync(backupPath);
  db.prepare('INSERT OR IGNORE INTO backups (filename, label, size) VALUES (?, ?, ?)').run(filename, label || 'manual', stat.size);

  return { filename, path: backupPath, timestamp: new Date().toISOString(), size: stat.size };
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db') || f.endsWith('.json'))
    .map(f => { const stat = fs.statSync(path.join(BACKUP_DIR, f)); return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() }; })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function restoreBackup(filename) {
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');

  createBackup('pre-restore');

  if (filename.endsWith('.json')) {
    const raw = fs.readFileSync(backupPath, 'utf8');
    restoreFromObject(JSON.parse(raw));
  } else if (filename.endsWith('.db')) {
    // Close current, copy backup over, reopen would require restart
    // For now, import from backup DB
    const backupDb = new Database(backupPath, { readonly: true });
    const data = {};
    
    // Export all tables from backup
    data.dailyEntries = {};
    backupDb.prepare('SELECT date, data FROM daily_entries').all().forEach(r => { try { data.dailyEntries[r.date] = JSON.parse(r.data); } catch {} });
    data.denominations = {};
    backupDb.prepare('SELECT date, data FROM denominations').all().forEach(r => { try { data.denominations[r.date] = JSON.parse(r.data); } catch {} });
    data.users = backupDb.prepare('SELECT id, username, name, role, pin, created_at, updated_at FROM users').all().map(r => ({ id: r.id, username: r.username, name: r.name, role: r.role, pin: r.pin, createdAt: r.created_at, updatedAt: r.updated_at }));
    data.staff = { salesmen: [], supervisors: [] };
    backupDb.prepare('SELECT type, name FROM staff ORDER BY sort_order ASC').all().forEach(r => { if (data.staff[r.type]) data.staff[r.type].push(r.name); });
    
    backupDb.close();
    restoreFromObject(data);
  }
  return true;
}

function restoreFromObject(data) {
  const tx = db.transaction(() => {
    if (data.users) { db.prepare('DELETE FROM users').run(); for (const u of data.users) db.prepare('INSERT INTO users (id, username, name, role, pin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(u.id, u.username, u.name, u.role, u.pin || null, u.createdAt || new Date().toISOString(), u.updatedAt || new Date().toISOString()); }
    if (data.staff) { db.prepare('DELETE FROM staff').run(); (data.staff.salesmen || []).forEach((name, idx) => db.prepare('INSERT INTO staff (type, name, sort_order) VALUES (?, ?, ?)').run('salesmen', name, idx + 1)); (data.staff.supervisors || []).forEach((name, idx) => db.prepare('INSERT INTO staff (type, name, sort_order) VALUES (?, ?, ?)').run('supervisors', name, idx + 1)); }
    if (data.products && Array.isArray(data.products)) { db.prepare('DELETE FROM products').run(); for (const p of data.products) db.prepare('INSERT INTO products (id, sno, code_no, particular, category, rate, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.id, p.sno || 0, p.codeNo || '', p.particular, p.category, p.rate || 0, p.status || 'active'); }
    if (data.categories && typeof data.categories === 'object' && !Array.isArray(data.categories)) { db.prepare('DELETE FROM categories').run(); for (const [key, val] of Object.entries(data.categories)) db.prepare('INSERT INTO categories (key, label, bottles_per_case) VALUES (?, ?, ?)').run(key, val.label, val.bottlesPerCase || 48); }
    if (data.dailyEntries && typeof data.dailyEntries === 'object') { db.prepare('DELETE FROM daily_entries').run(); for (const [date, entry] of Object.entries(data.dailyEntries)) db.prepare('INSERT INTO daily_entries (date, data) VALUES (?, ?)').run(date, JSON.stringify(entry)); }
    if (data.denominations && typeof data.denominations === 'object') { db.prepare('DELETE FROM denominations').run(); for (const [date, denom] of Object.entries(data.denominations)) db.prepare('INSERT INTO denominations (date, data) VALUES (?, ?)').run(date, JSON.stringify(denom)); }
    if (data.auditLogs && Array.isArray(data.auditLogs)) { db.prepare('DELETE FROM audit_logs').run(); for (const e of data.auditLogs) db.prepare('INSERT INTO audit_logs (id, timestamp, action, module, user, description, previous_value, new_value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(e.id, e.timestamp, e.action, e.module, e.user || 'system', e.description || '', e.previousValue ? JSON.stringify(e.previousValue) : null, e.newValue ? JSON.stringify(e.newValue) : null, e.metadata ? JSON.stringify(e.metadata) : null); }
    if (data.settings && typeof data.settings === 'object') { db.prepare('DELETE FROM settings').run(); for (const [key, value] of Object.entries(data.settings)) db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, typeof value === 'object' ? JSON.stringify(value) : String(value)); }
  });
  tx();
}

function exportAsObject() {
  return { dailyEntries: getAllDailyEntries(), denominations: getAllDenominations(), products: getProducts(), categories: getCategories(), staff: getStaff(), users: getUsers(), auditLogs: getAuditLogs(), settings: getSettings() };
}

function migrateFromJson(storePath) {
  if (!fs.existsSync(storePath)) return false;
  try {
    const entryCount = db.prepare('SELECT COUNT(*) as cnt FROM daily_entries').get();
    if (entryCount.cnt > 0) return false;
    const raw = fs.readFileSync(storePath, 'utf8');
    const data = JSON.parse(raw);
    console.log('[Database] Migrating from store.json...');
    restoreFromObject(data);
    console.log('[Database] Migration complete.');
    return true;
  } catch (err) {
    console.error('[Database] Migration error:', err.message);
    return false;
  }
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  getSettings, setSetting, setAllSettings,
  getUsers, setUsers,
  getStaff, setStaff,
  getProducts, setProducts,
  getCategories, setCategories,
  getAllDailyEntries, getDailyEntry, setDailyEntry, deleteDailyEntry, setAllDailyEntries,
  getAllDenominations, getDenomination, setDenomination, deleteDenomination, setAllDenominations,
  getAuditLogs, appendAuditLog, setAuditLogs,
  createBackup, listBackups, restoreBackup, restoreFromObject, exportAsObject,
  migrateFromJson,
  addToSyncQueue, getPendingSyncItems, markSynced, cleanSyncQueue, getSyncStats,
  DB_PATH, DB_DIR, BACKUP_DIR
};
