/**
 * SQLite Database Service for TASMAC POS
 * Uses system sqlite3 CLI via child_process.execSync for synchronous API
 * WAL mode for performance, transactions for batch operations
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Database file location
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'tasmac.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}


// ============================================================
// Core SQLite execution helpers
// ============================================================

/**
 * Escape a string for SQLite (double single quotes)
 */
function escSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

/**
 * Execute a SQL statement (no return value)
 */
function exec(sql) {
  try {
    execSync(`sqlite3 "${DB_PATH}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    console.error('[Database] exec error:', err.stderr || err.message);
    throw err;
  }
}

/**
 * Execute SQL and return results as JSON array
 */
function query(sql) {
  try {
    const cmd = `sqlite3 -json "${DB_PATH}" "${sql.replace(/"/g, '\\"')}"`;
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024
    });
    if (!result || result.trim() === '') return [];
    return JSON.parse(result);
  } catch (err) {
    // If no rows, sqlite3 -json returns empty
    if (err.stdout && err.stdout.trim() === '') return [];
    console.error('[Database] query error:', err.stderr || err.message);
    return [];
  }
}


/**
 * Execute multi-statement SQL from a file (for schema init)
 */
function execFile(sql) {
  const tmpFile = path.join(DB_DIR, '_tmp_schema.sql');
  try {
    fs.writeFileSync(tmpFile, sql, 'utf8');
    execSync(`sqlite3 "${DB_PATH}" ".read ${tmpFile}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    console.error('[Database] execFile error:', err.stderr || err.message);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

/**
 * Execute a single query returning one row
 */
function queryOne(sql) {
  const rows = query(sql);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute multiple SQL statements as a transaction
 */
function transaction(statements) {
  const allSql = ['BEGIN TRANSACTION;', ...statements, 'COMMIT;'].join('\n');
  execFile(allSql);
}


// ============================================================
// Schema Initialization
// ============================================================

function initializeSchema() {
  const schema = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -64000;

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
`;
  execFile(schema);
}


function initializeSchema2() {
  const schema = `
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

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  invoice_number TEXT,
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
`;
  execFile(schema);
}


function initializeIndexes() {
  const indexes = `
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_denominations_date ON denominations(date);
CREATE INDEX IF NOT EXISTS idx_pending_sync_synced ON pending_sync(synced);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_staff_type ON staff(type);
`;
  execFile(indexes);
}

/**
 * Seed default data if tables are empty
 */
function seedDefaults() {
  const usersCount = queryOne("SELECT COUNT(*) as cnt FROM users");
  if (!usersCount || usersCount.cnt === 0) {
    const stmts = [
      `INSERT OR IGNORE INTO users (id, username, name, role, pin) VALUES ('1', 'admin', 'ADMIN', 'admin', '1974');`,
      `INSERT OR IGNORE INTO users (id, username, name, role, pin) VALUES ('2', 'operator', 'SUPERVISOR', 'operator', '1745');`
    ];
    transaction(stmts);
  }

  const staffCount = queryOne("SELECT COUNT(*) as cnt FROM staff");
  if (!staffCount || staffCount.cnt === 0) {
    const stmts = [
      `INSERT INTO staff (type, name, sort_order) VALUES ('salesmen', 'SHANMUGASUNDARAM.P', 1);`,
      `INSERT INTO staff (type, name, sort_order) VALUES ('salesmen', 'ARUMUGAM.A', 2);`,
      `INSERT INTO staff (type, name, sort_order) VALUES ('salesmen', 'RAMESHKUMAR.A', 3);`,
      `INSERT INTO staff (type, name, sort_order) VALUES ('salesmen', 'SHANMUGASUNDARAM.M', 4);`,
      `INSERT INTO staff (type, name, sort_order) VALUES ('supervisors', 'ANTONYSAMY.A', 1);`,
      `INSERT INTO staff (type, name, sort_order) VALUES ('supervisors', 'SARAVAN', 2);`
    ];
    transaction(stmts);
  }

  const settingsCount = queryOne("SELECT COUNT(*) as cnt FROM settings");
  if (!settingsCount || settingsCount.cnt === 0) {
    const stmts = [
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('shopNo', '1745');`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('shopName', 'TASMAC Shop No. 1745');`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('address', 'SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101');`
    ];
    transaction(stmts);
  }
}


// ============================================================
// CRUD Operations
// ============================================================

/** Get all settings as an object */
function getSettings() {
  const rows = query("SELECT key, value FROM settings");
  const settings = {};
  rows.forEach(row => { settings[row.key] = row.value; });
  return settings;
}

/** Set a setting value */
function setSetting(key, value) {
  exec(`INSERT INTO settings (key, value, updated_at) VALUES (${escSql(key)}, ${escSql(value)}, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
}

/** Set all settings at once */
function setAllSettings(settings) {
  const stmts = ['DELETE FROM settings;'];
  for (const [key, value] of Object.entries(settings)) {
    const val = typeof value === 'object' ? JSON.stringify(value) : String(value);
    stmts.push(`INSERT INTO settings (key, value) VALUES (${escSql(key)}, ${escSql(val)});`);
  }
  transaction(stmts);
}

/** Get all users as array */
function getUsers() {
  const rows = query("SELECT id, username, name, role, pin, created_at, updated_at FROM users");
  return rows.map(row => {
    const user = { id: row.id, username: row.username, name: row.name, role: row.role, pin: row.pin };
    if (row.created_at) user.createdAt = row.created_at;
    if (row.updated_at) user.updatedAt = row.updated_at;
    return user;
  });
}

/** Set all users (replaces entire users table) */
function setUsers(users) {
  const stmts = ['DELETE FROM users;'];
  for (const user of users) {
    stmts.push(`INSERT INTO users (id, username, name, role, pin, created_at, updated_at) VALUES (${escSql(user.id)}, ${escSql(user.username)}, ${escSql(user.name)}, ${escSql(user.role)}, ${escSql(user.pin || null)}, ${escSql(user.createdAt || new Date().toISOString())}, ${escSql(user.updatedAt || new Date().toISOString())});`);
  }
  transaction(stmts);
}


/** Get staff as object { salesmen: [...], supervisors: [...] } */
function getStaff() {
  const rows = query("SELECT type, name FROM staff ORDER BY sort_order ASC, id ASC");
  const staff = { salesmen: [], supervisors: [] };
  rows.forEach(row => {
    if (staff[row.type]) {
      staff[row.type].push(row.name);
    }
  });
  return staff;
}

/** Set staff (replaces entire staff table) */
function setStaff(staffObj) {
  const stmts = ['DELETE FROM staff;'];
  if (staffObj.salesmen) {
    staffObj.salesmen.forEach((name, idx) => {
      stmts.push(`INSERT INTO staff (type, name, sort_order) VALUES ('salesmen', ${escSql(name)}, ${idx + 1});`);
    });
  }
  if (staffObj.supervisors) {
    staffObj.supervisors.forEach((name, idx) => {
      stmts.push(`INSERT INTO staff (type, name, sort_order) VALUES ('supervisors', ${escSql(name)}, ${idx + 1});`);
    });
  }
  transaction(stmts);
}

/** Get all products as array */
function getProducts() {
  const rows = query("SELECT id, sno, code_no, particular, category, rate, status FROM products ORDER BY sno ASC");
  if (rows.length === 0) return null;
  return rows.map(row => ({
    id: row.id,
    sno: row.sno,
    codeNo: row.code_no || '',
    particular: row.particular,
    category: row.category,
    rate: row.rate || 0,
    status: row.status || 'active'
  }));
}

/** Set products (replaces entire products table) */
function setProducts(products) {
  const stmts = ['DELETE FROM products;'];
  for (const p of products) {
    stmts.push(`INSERT INTO products (id, sno, code_no, particular, category, rate, status, updated_at) VALUES (${escSql(p.id)}, ${p.sno || 0}, ${escSql(p.codeNo || '')}, ${escSql(p.particular)}, ${escSql(p.category)}, ${p.rate || 0}, ${escSql(p.status || 'active')}, datetime('now'));`);
  }
  transaction(stmts);
}


/** Get categories as object { KEY: { label, bottlesPerCase } } */
function getCategories() {
  const rows = query("SELECT key, label, bottles_per_case FROM categories");
  if (rows.length === 0) return null;
  const categories = {};
  rows.forEach(row => {
    categories[row.key] = { label: row.label, bottlesPerCase: row.bottles_per_case };
  });
  return categories;
}

/** Set categories (replaces entire categories table) */
function setCategories(categories) {
  const stmts = ['DELETE FROM categories;'];
  for (const [key, val] of Object.entries(categories)) {
    stmts.push(`INSERT INTO categories (key, label, bottles_per_case, updated_at) VALUES (${escSql(key)}, ${escSql(val.label)}, ${val.bottlesPerCase || 48}, datetime('now'));`);
  }
  transaction(stmts);
}

/** Get all daily entries as object { "YYYY-MM-DD": {...} } */
function getAllDailyEntries() {
  const rows = query("SELECT date, data FROM daily_entries");
  const entries = {};
  rows.forEach(row => {
    try { entries[row.date] = JSON.parse(row.data); }
    catch (e) { entries[row.date] = {}; }
  });
  return entries;
}

/** Get a single daily entry by date */
function getDailyEntry(date) {
  const row = queryOne(`SELECT data FROM daily_entries WHERE date = ${escSql(date)}`);
  if (!row) return null;
  try { return JSON.parse(row.data); }
  catch (e) { return null; }
}

/** Set a single daily entry for a date */
function setDailyEntry(date, data) {
  const jsonStr = JSON.stringify(data);
  exec(`INSERT INTO daily_entries (date, data, updated_at) VALUES (${escSql(date)}, ${escSql(jsonStr)}, datetime('now')) ON CONFLICT(date) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`);
}

/** Delete a daily entry by date */
function deleteDailyEntry(date) {
  exec(`DELETE FROM daily_entries WHERE date = ${escSql(date)}`);
  return true;
}

/** Set all daily entries at once */
function setAllDailyEntries(entries) {
  const stmts = ['DELETE FROM daily_entries;'];
  for (const [date, data] of Object.entries(entries)) {
    stmts.push(`INSERT INTO daily_entries (date, data) VALUES (${escSql(date)}, ${escSql(JSON.stringify(data))});`);
  }
  transaction(stmts);
}


/** Get all denominations as object */
function getAllDenominations() {
  const rows = query("SELECT date, data FROM denominations");
  const denoms = {};
  rows.forEach(row => {
    try { denoms[row.date] = JSON.parse(row.data); }
    catch (e) { denoms[row.date] = {}; }
  });
  return denoms;
}

/** Get a single denomination by date */
function getDenomination(date) {
  const row = queryOne(`SELECT data FROM denominations WHERE date = ${escSql(date)}`);
  if (!row) return null;
  try { return JSON.parse(row.data); }
  catch (e) { return null; }
}

/** Set a single denomination for a date */
function setDenomination(date, data) {
  const jsonStr = JSON.stringify(data);
  exec(`INSERT INTO denominations (date, data, updated_at) VALUES (${escSql(date)}, ${escSql(jsonStr)}, datetime('now')) ON CONFLICT(date) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`);
}

/** Delete a denomination by date */
function deleteDenomination(date) {
  exec(`DELETE FROM denominations WHERE date = ${escSql(date)}`);
  return true;
}

/** Set all denominations at once */
function setAllDenominations(denoms) {
  const stmts = ['DELETE FROM denominations;'];
  for (const [date, data] of Object.entries(denoms)) {
    stmts.push(`INSERT INTO denominations (date, data) VALUES (${escSql(date)}, ${escSql(JSON.stringify(data))});`);
  }
  transaction(stmts);
}

/** Get all audit logs as array */
function getAuditLogs() {
  const rows = query("SELECT id, timestamp, action, module, user, description, previous_value, new_value, metadata FROM audit_logs ORDER BY timestamp DESC");
  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    action: row.action,
    module: row.module,
    user: row.user,
    description: row.description,
    previousValue: row.previous_value ? JSON.parse(row.previous_value) : null,
    newValue: row.new_value ? JSON.parse(row.new_value) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));
}


/** Append a single audit log entry */
function appendAuditLog(entry) {
  exec(`INSERT INTO audit_logs (id, timestamp, action, module, user, description, previous_value, new_value, metadata) VALUES (${escSql(entry.id)}, ${escSql(entry.timestamp)}, ${escSql(entry.action)}, ${escSql(entry.module)}, ${escSql(entry.user || 'system')}, ${escSql(entry.description || '')}, ${escSql(entry.previousValue ? JSON.stringify(entry.previousValue) : null)}, ${escSql(entry.newValue ? JSON.stringify(entry.newValue) : null)}, ${escSql(entry.metadata ? JSON.stringify(entry.metadata) : null)})`);

  // Keep audit logs capped at 10000
  const count = queryOne("SELECT COUNT(*) as cnt FROM audit_logs");
  if (count && count.cnt > 10000) {
    exec(`DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY timestamp ASC LIMIT ${count.cnt - 10000})`);
  }
}

/** Set all audit logs (replaces entire audit_logs table) */
function setAuditLogs(logs) {
  const stmts = ['DELETE FROM audit_logs;'];
  for (const entry of logs) {
    stmts.push(`INSERT INTO audit_logs (id, timestamp, action, module, user, description, previous_value, new_value, metadata) VALUES (${escSql(entry.id)}, ${escSql(entry.timestamp)}, ${escSql(entry.action)}, ${escSql(entry.module)}, ${escSql(entry.user || 'system')}, ${escSql(entry.description || '')}, ${escSql(entry.previousValue ? JSON.stringify(entry.previousValue) : null)}, ${escSql(entry.newValue ? JSON.stringify(entry.newValue) : null)}, ${escSql(entry.metadata ? JSON.stringify(entry.metadata) : null)});`);
  }
  transaction(stmts);
}


// ============================================================
// Backup Operations
// ============================================================

/** Create a database backup using VACUUM INTO */
function createBackup(label) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}${label ? '_' + label : ''}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);

  // Use VACUUM INTO for safe consistent backup
  try {
    execSync(`sqlite3 "${DB_PATH}" "VACUUM INTO '${backupPath.replace(/'/g, "''")}';"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    // Fallback: copy the file
    fs.copyFileSync(DB_PATH, backupPath);
  }

  const stat = fs.statSync(backupPath);

  // Record in backups table
  exec(`INSERT OR IGNORE INTO backups (filename, label, size) VALUES (${escSql(filename)}, ${escSql(label || 'manual')}, ${stat.size})`);

  return {
    filename,
    path: backupPath,
    timestamp: new Date().toISOString(),
    size: stat.size
  };
}

/** List available backups */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db') || f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        size: stat.size,
        createdAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return files;
}

/** Restore from a backup file */
function restoreBackup(filename) {
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found');
  }

  // Create a pre-restore backup first
  createBackup('pre-restore');

  if (filename.endsWith('.json')) {
    // Restore from legacy JSON backup
    const raw = fs.readFileSync(backupPath, 'utf8');
    const data = JSON.parse(raw);
    restoreFromObject(data);
  } else if (filename.endsWith('.db')) {
    // Replace current DB with backup
    fs.copyFileSync(backupPath, DB_PATH);
  }

  return true;
}


/** Restore data from a JS object (legacy JSON format support) */
function restoreFromObject(data) {
  const stmts = [];

  // Restore users
  if (data.users) {
    stmts.push('DELETE FROM users;');
    for (const user of data.users) {
      stmts.push(`INSERT INTO users (id, username, name, role, pin, created_at, updated_at) VALUES (${escSql(user.id)}, ${escSql(user.username)}, ${escSql(user.name)}, ${escSql(user.role)}, ${escSql(user.pin || null)}, ${escSql(user.createdAt || new Date().toISOString())}, ${escSql(user.updatedAt || new Date().toISOString())});`);
    }
  }

  // Restore staff
  if (data.staff) {
    stmts.push('DELETE FROM staff;');
    if (data.staff.salesmen) {
      data.staff.salesmen.forEach((name, idx) => {
        stmts.push(`INSERT INTO staff (type, name, sort_order) VALUES ('salesmen', ${escSql(name)}, ${idx + 1});`);
      });
    }
    if (data.staff.supervisors) {
      data.staff.supervisors.forEach((name, idx) => {
        stmts.push(`INSERT INTO staff (type, name, sort_order) VALUES ('supervisors', ${escSql(name)}, ${idx + 1});`);
      });
    }
  }

  // Restore products
  if (data.products && Array.isArray(data.products)) {
    stmts.push('DELETE FROM products;');
    for (const p of data.products) {
      stmts.push(`INSERT INTO products (id, sno, code_no, particular, category, rate, status) VALUES (${escSql(p.id)}, ${p.sno || 0}, ${escSql(p.codeNo || '')}, ${escSql(p.particular)}, ${escSql(p.category)}, ${p.rate || 0}, ${escSql(p.status || 'active')});`);
    }
  }

  // Restore categories
  if (data.categories && typeof data.categories === 'object' && !Array.isArray(data.categories)) {
    stmts.push('DELETE FROM categories;');
    for (const [key, val] of Object.entries(data.categories)) {
      stmts.push(`INSERT INTO categories (key, label, bottles_per_case) VALUES (${escSql(key)}, ${escSql(val.label)}, ${val.bottlesPerCase || 48});`);
    }
  }

  // Restore daily entries
  if (data.dailyEntries && typeof data.dailyEntries === 'object') {
    stmts.push('DELETE FROM daily_entries;');
    for (const [date, entry] of Object.entries(data.dailyEntries)) {
      stmts.push(`INSERT INTO daily_entries (date, data) VALUES (${escSql(date)}, ${escSql(JSON.stringify(entry))});`);
    }
  }

  // Restore denominations
  if (data.denominations && typeof data.denominations === 'object') {
    stmts.push('DELETE FROM denominations;');
    for (const [date, denom] of Object.entries(data.denominations)) {
      stmts.push(`INSERT INTO denominations (date, data) VALUES (${escSql(date)}, ${escSql(JSON.stringify(denom))});`);
    }
  }

  // Restore audit logs
  if (data.auditLogs && Array.isArray(data.auditLogs)) {
    stmts.push('DELETE FROM audit_logs;');
    for (const entry of data.auditLogs) {
      stmts.push(`INSERT INTO audit_logs (id, timestamp, action, module, user, description, previous_value, new_value, metadata) VALUES (${escSql(entry.id)}, ${escSql(entry.timestamp)}, ${escSql(entry.action)}, ${escSql(entry.module)}, ${escSql(entry.user || 'system')}, ${escSql(entry.description || '')}, ${escSql(entry.previousValue ? JSON.stringify(entry.previousValue) : null)}, ${escSql(entry.newValue ? JSON.stringify(entry.newValue) : null)}, ${escSql(entry.metadata ? JSON.stringify(entry.metadata) : null)});`);
    }
  }

  // Restore settings
  if (data.settings && typeof data.settings === 'object') {
    stmts.push('DELETE FROM settings;');
    for (const [key, value] of Object.entries(data.settings)) {
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value);
      stmts.push(`INSERT INTO settings (key, value) VALUES (${escSql(key)}, ${escSql(val)});`);
    }
  }

  if (stmts.length > 0) {
    transaction(stmts);
  }
}


/** Export entire database state as a JSON-compatible object */
function exportAsObject() {
  return {
    dailyEntries: getAllDailyEntries(),
    denominations: getAllDenominations(),
    products: getProducts(),
    categories: getCategories(),
    staff: getStaff(),
    users: getUsers(),
    auditLogs: getAuditLogs(),
    settings: getSettings()
  };
}

/** Migrate existing store.json data into SQLite (run once) */
function migrateFromJson(storePath) {
  if (!fs.existsSync(storePath)) return false;

  try {
    // Only migrate if DB has no daily entries and no users beyond defaults
    const entryCount = queryOne("SELECT COUNT(*) as cnt FROM daily_entries");
    if (entryCount && entryCount.cnt > 0) return false;

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
// Initialize on module load
// ============================================================
initializeSchema();
initializeSchema2();
initializeIndexes();
seedDefaults();

console.log('[Database] SQLite initialized at', DB_PATH);


// ============================================================
// Module Exports
// ============================================================
// ============================================================
// Sync Queue Operations
// ============================================================

/**
 * Add an item to the pending sync queue
 * Called automatically when data is modified and sync is enabled
 */
function addToSyncQueue(tableName, recordId, operation, data) {
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  const deviceId = getDeviceId();
  exec(`INSERT INTO pending_sync (table_name, record_id, operation, data, device_id, sync_version) VALUES (${escSql(tableName)}, ${escSql(recordId)}, ${escSql(operation)}, ${escSql(JSON.stringify(data))}, ${escSql(deviceId)}, 1)`);
}

/**
 * Get pending (unsynced) items from the queue
 * @param {number} limit - Max items to return
 */
function getPendingSyncItems(limit = 50) {
  const rows = query(`SELECT id, table_name, record_id, operation, data, created_at, device_id FROM pending_sync WHERE synced = 0 ORDER BY created_at ASC LIMIT ${Number(limit)}`);
  return rows.map(row => ({
    id: row.id,
    table_name: row.table_name,
    record_id: row.record_id,
    operation: row.operation,
    data: row.data,
    created_at: row.created_at,
    device_id: row.device_id
  }));
}

/**
 * Mark items as synced
 * @param {number[]} ids - Array of pending_sync row IDs to mark
 */
function markSynced(ids) {
  if (!ids || ids.length === 0) return;
  const idList = ids.map(id => Number(id)).join(',');
  exec(`UPDATE pending_sync SET synced = 1 WHERE id IN (${idList})`);
}

/**
 * Clean old synced items (keep queue manageable)
 * @param {number} olderThanDays - Remove synced items older than N days
 */
function cleanSyncQueue(olderThanDays = 7) {
  exec(`DELETE FROM pending_sync WHERE synced = 1 AND created_at < datetime('now', '-${Number(olderThanDays)} days')`);
}

/**
 * Get sync queue statistics
 */
function getSyncStats() {
  const pending = queryOne("SELECT COUNT(*) as cnt FROM pending_sync WHERE synced = 0");
  const synced = queryOne("SELECT COUNT(*) as cnt FROM pending_sync WHERE synced = 1");
  const oldest = queryOne("SELECT created_at FROM pending_sync WHERE synced = 0 ORDER BY created_at ASC LIMIT 1");
  return {
    pendingCount: pending ? pending.cnt : 0,
    syncedCount: synced ? synced.cnt : 0,
    oldestPending: oldest ? oldest.created_at : null
  };
}

/**
 * Get a unique device ID (generated on first run, stored in settings)
 */
function getDeviceId() {
  const settings = getSettings();
  if (settings.deviceId) return settings.deviceId;
  const id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
  setSetting('deviceId', id);
  return id;
}

module.exports = {
  // Settings
  getSettings,
  setSetting,
  setAllSettings,
  // Users
  getUsers,
  setUsers,
  // Staff
  getStaff,
  setStaff,
  // Products
  getProducts,
  setProducts,
  // Categories
  getCategories,
  setCategories,
  // Daily Entries
  getAllDailyEntries,
  getDailyEntry,
  setDailyEntry,
  deleteDailyEntry,
  setAllDailyEntries,
  // Denominations
  getAllDenominations,
  getDenomination,
  setDenomination,
  deleteDenomination,
  setAllDenominations,
  // Audit Logs
  getAuditLogs,
  appendAuditLog,
  setAuditLogs,
  // Backup
  createBackup,
  listBackups,
  restoreBackup,
  restoreFromObject,
  exportAsObject,
  // Migration
  migrateFromJson,
  // Sync Queue
  addToSyncQueue,
  getPendingSyncItems,
  markSynced,
  cleanSyncQueue,
  getSyncStats,
  // Constants
  DB_PATH,
  DB_DIR,
  BACKUP_DIR
};
