/**
 * SQLite Database Manager for TASMAC POS Electron App
 * Uses better-sqlite3 for synchronous, fast local storage
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { CREATE_TABLES, DEFAULT_DATA, SCHEMA_VERSION } = require('./schema');

let db = null;

/**
 * Get the database file path (in user's app data directory)
 */
function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'tasmac-pos.db');
}

/**
 * Initialize the database
 */
function initialize() {
  const Database = require('better-sqlite3');
  const dbPath = getDbPath();
  
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  console.log('[DB] Opening database at:', dbPath);
  db = new Database(dbPath);
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  
  // Create tables
  db.exec(CREATE_TABLES);
  
  // Insert default data if tables are empty
  seedDefaults();
  
  console.log('[DB] Database initialized successfully');
  return db;
}

/**
 * Seed default data if tables are empty
 */
function seedDefaults() {
  // Check if users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const insertUser = db.prepare('INSERT INTO users (username, name, role, pin) VALUES (?, ?, ?, ?)');
    DEFAULT_DATA.users.forEach(u => insertUser.run(u.username, u.name, u.role, u.pin));
    console.log('[DB] Default users seeded');
  }
  
  // Check if staff table is empty
  const staffCount = db.prepare('SELECT COUNT(*) as count FROM staff').get();
  if (staffCount.count === 0) {
    const insertStaff = db.prepare('INSERT INTO staff (name, type) VALUES (?, ?)');
    DEFAULT_DATA.staff.forEach(s => insertStaff.run(s.name, s.type));
    console.log('[DB] Default staff seeded');
  }
  
  // Check if settings table is empty
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    DEFAULT_DATA.settings.forEach(s => insertSetting.run(s.key, s.value));
    console.log('[DB] Default settings seeded');
  }
}

/**
 * Get the database instance
 */
function getDb() {
  if (!db) throw new Error('Database not initialized. Call initialize() first.');
  return db;
}

/**
 * Close the database
 */
function close() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed');
  }
}

// ========================
// DAILY ENTRIES
// ========================

function getDailyEntries(date) {
  return db.prepare('SELECT * FROM daily_entries WHERE date = ? ORDER BY sno').all(date);
}

function saveDailyEntries(date, entries, metadata) {
  const deleteStmt = db.prepare('DELETE FROM daily_entries WHERE date = ?');
  const insertStmt = db.prepare(`
    INSERT INTO daily_entries (date, product_id, sno, code_no, particular, category, cases, bottles, opening_stock, purchase, stock_return, rate, clst, total, sales, sales_amt, cl_value, op_value, purchase_value, stock_return_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertMeta = db.prepare(`
    INSERT OR REPLACE INTO daily_metadata (date, pos_amount, device_sales_bottles, device_closing_bottles, device_sales_value, device_closing_value, staff_salesmen, staff_supervisors, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `);
  
  const transaction = db.transaction(() => {
    deleteStmt.run(date);
    entries.forEach(e => {
      insertStmt.run(date, e.productId, e.sno, e.codeNo, e.particular, e.category, e.cases || 0, e.bottles || 0, e.openingStock || 0, e.purchase || 0, e.stockReturn || 0, e.rate || 0, e.clst || 0, e.total || 0, e.sales || 0, e.salesAmt || 0, e.clValue || 0, e.opValue || 0, e.purchaseValue || 0, e.stockReturnValue || 0);
    });
    if (metadata) {
      upsertMeta.run(date, metadata.posAmount || 0, metadata.deviceSalesBottles || 0, metadata.deviceClosingBottles || 0, metadata.deviceSalesValue || 0, metadata.deviceClosingValue || 0, JSON.stringify(metadata.staffSalesmen || []), JSON.stringify(metadata.staffSupervisors || []), metadata.updatedBy || 'admin');
    }
  });
  
  transaction();
  addToSyncQueue('daily_entries', date, 'UPSERT', { date, entries, metadata });
}

function getDailyMetadata(date) {
  return db.prepare('SELECT * FROM daily_metadata WHERE date = ?').get(date);
}

// ========================
// DENOMINATIONS
// ========================

function getDenomination(date) {
  return db.prepare('SELECT * FROM denominations WHERE date = ?').get(date);
}

function saveDenomination(date, denom) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO denominations (date, note_500, note_200, note_100, note_50, note_20, note_10, coins, total_cash, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(date, denom.note500 || 0, denom.note200 || 0, denom.note100 || 0, denom.note50 || 0, denom.note20 || 0, denom.note10 || 0, denom.coins || 0, denom.totalCash || 0);
  addToSyncQueue('denominations', date, 'UPSERT', { date, ...denom });
}

// ========================
// PRODUCTS
// ========================

function getProducts() {
  return db.prepare('SELECT * FROM products ORDER BY sno').all();
}

function addProduct(product) {
  const stmt = db.prepare('INSERT INTO products (sno, code_no, particular, category, rate, status) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(product.sno, product.codeNo || '', product.particular, product.category, product.rate || 0, product.status || 'active');
  addToSyncQueue('products', String(result.lastInsertRowid), 'INSERT', product);
  return result.lastInsertRowid;
}

function updateProductRate(id, rate) {
  db.prepare('UPDATE products SET rate = ?, updated_at = datetime("now") WHERE id = ?').run(rate, id);
  addToSyncQueue('products', String(id), 'UPDATE', { id, rate });
}

function updateProductStatus(id, status) {
  db.prepare('UPDATE products SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
  addToSyncQueue('products', String(id), 'UPDATE', { id, status });
}

// ========================
// CATEGORIES
// ========================

function getCategories() {
  return db.prepare('SELECT * FROM categories').all();
}

function upsertCategory(key, label, bottlesPerCase) {
  db.prepare('INSERT OR REPLACE INTO categories (key, label, bottles_per_case) VALUES (?, ?, ?)').run(key, label, bottlesPerCase);
}

// ========================
// STAFF
// ========================

function getStaff() {
  const rows = db.prepare('SELECT * FROM staff ORDER BY type, id').all();
  const result = { salesmen: [], supervisors: [] };
  rows.forEach(r => {
    if (r.type === 'salesmen') result.salesmen.push(r.name);
    else if (r.type === 'supervisors') result.supervisors.push(r.name);
  });
  return result;
}

function addStaff(name, type) {
  db.prepare('INSERT INTO staff (name, type) VALUES (?, ?)').run(name, type);
  addToSyncQueue('staff', name, 'INSERT', { name, type });
}

function updateStaff(id, name) {
  db.prepare('UPDATE staff SET name = ? WHERE id = ?').run(name, id);
}

function deleteStaff(id) {
  db.prepare('DELETE FROM staff WHERE id = ?').run(id);
}

// ========================
// USERS
// ========================

function getUsers() {
  return db.prepare('SELECT id, username, name, role, created_at, updated_at FROM users').all();
}

function getUserByPin(pin) {
  return db.prepare('SELECT * FROM users WHERE pin = ?').get(pin);
}

function addUser(user) {
  const stmt = db.prepare('INSERT INTO users (username, name, role, pin) VALUES (?, ?, ?, ?)');
  return stmt.run(user.username, user.name, user.role, user.pin);
}

function updateUser(id, data) {
  const fields = [];
  const values = [];
  if (data.name) { fields.push('name = ?'); values.push(data.name); }
  if (data.role) { fields.push('role = ?'); values.push(data.role); }
  if (data.pin) { fields.push('pin = ?'); values.push(data.pin); }
  fields.push('updated_at = datetime("now")');
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ========================
// INVOICES
// ========================

function getInvoices(date) {
  return db.prepare('SELECT * FROM invoices WHERE date = ? ORDER BY id').all(date);
}

function saveInvoices(date, invoices) {
  const deleteStmt = db.prepare('DELETE FROM invoices WHERE date = ?');
  const insertStmt = db.prepare('INSERT INTO invoices (date, invoice_no, invoice_date, invoice_amount, items) VALUES (?, ?, ?, ?, ?)');
  
  const transaction = db.transaction(() => {
    deleteStmt.run(date);
    invoices.forEach(inv => {
      insertStmt.run(date, inv.invoiceNo, inv.invoiceDate, inv.invoiceAmount || 0, JSON.stringify(inv.items || []));
    });
  });
  transaction();
  addToSyncQueue('invoices', date, 'UPSERT', { date, invoices });
}

// ========================
// AUDIT LOGS
// ========================

function addAuditLog(log) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (action, module, user, description, previous_value, new_value, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(log.action, log.module, log.user || 'system', log.description, JSON.stringify(log.previousValue), JSON.stringify(log.newValue), JSON.stringify(log.metadata || {}));
}

function getAuditLogs({ module, user, action, startDate, endDate, limit = 50, offset = 0 } = {}) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  
  if (module) { sql += ' AND module = ?'; params.push(module); }
  if (user) { sql += ' AND user = ?'; params.push(user); }
  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (startDate) { sql += ' AND timestamp >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND timestamp <= ?'; params.push(endDate + 'T23:59:59'); }
  
  // Get total count
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = db.prepare(countSql).get(...params).count;
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const logs = db.prepare(sql).all(...params);
  return { logs, total, offset, limit };
}

// ========================
// SETTINGS
// ========================

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))').run(key, value);
}

function getAllSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  return result;
}

// ========================
// SYNC QUEUE
// ========================

function addToSyncQueue(tableName, recordId, operation, data) {
  const syncEnabled = getSetting('firebaseSyncEnabled');
  if (syncEnabled !== 'true') return;
  
  db.prepare(`
    INSERT INTO sync_queue (table_name, record_id, operation, data)
    VALUES (?, ?, ?, ?)
  `).run(tableName, recordId, operation, JSON.stringify(data));
}

function getPendingSyncItems(limit = 100) {
  return db.prepare('SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT ?').all(limit);
}

function markSynced(ids) {
  const stmt = db.prepare('UPDATE sync_queue SET synced = 1, synced_at = datetime("now") WHERE id = ?');
  const transaction = db.transaction(() => {
    ids.forEach(id => stmt.run(id));
  });
  transaction();
}

function cleanSyncQueue(olderThanDays = 7) {
  db.prepare(`DELETE FROM sync_queue WHERE synced = 1 AND synced_at < datetime('now', '-${olderThanDays} days')`).run();
}

// ========================
// BACKUP
// ========================

function getBackupDir() {
  const userDataPath = app.getPath('userData');
  const backupDir = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function createBackup(label) {
  const backupDir = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}${label ? '_' + label : ''}.db`;
  const backupPath = path.join(backupDir, filename);
  
  // Use SQLite's built-in backup
  db.backup(backupPath);
  
  const stat = fs.statSync(backupPath);
  
  // Record in backups table
  db.prepare('INSERT INTO backups (filename, size, label) VALUES (?, ?, ?)').run(filename, stat.size, label || 'manual');
  
  addAuditLog({ action: 'BACKUP', module: 'backup', user: 'system', description: `Backup created: ${filename}`, metadata: { filename, size: stat.size } });
  
  return { filename, size: stat.size, createdAt: new Date().toISOString() };
}

function listBackups() {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return [];
  
  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function restoreBackup(filename) {
  const backupDir = getBackupDir();
  const backupPath = path.join(backupDir, filename);
  
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
  
  // Create safety backup first
  createBackup('pre-restore');
  
  // Close current DB, copy backup over, reopen
  const dbPath = getDbPath();
  close();
  fs.copyFileSync(backupPath, dbPath);
  initialize();
  
  return true;
}

// ========================
// ANALYTICS HELPERS
// ========================

function getDailyRange(startDate, endDate) {
  return db.prepare(`
    SELECT date, 
      SUM(sales_amt) as total_sales,
      SUM(purchase_value) as total_purchase,
      SUM(cl_value) as total_cl_value,
      SUM(CASE WHEN sales > 0 THEN sales ELSE 0 END) as total_bottles_sold,
      SUM(clst) as total_closing_bottles,
      COUNT(*) as entries_count
    FROM daily_entries
    WHERE date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `).all(startDate, endDate);
}

function getTopProducts(startDate, endDate, limit = 10) {
  return db.prepare(`
    SELECT product_id, particular, category, rate,
      SUM(CASE WHEN sales > 0 THEN sales ELSE 0 END) as total_bottles,
      SUM(sales_amt) as total_sales
    FROM daily_entries
    WHERE date BETWEEN ? AND ? AND sales_amt > 0
    GROUP BY product_id
    ORDER BY total_sales DESC
    LIMIT ?
  `).all(startDate, endDate, limit);
}

function getTopDays(limit = 5, year, month) {
  let sql = `
    SELECT date,
      SUM(sales_amt) as total_sales,
      SUM(CASE WHEN sales > 0 THEN sales ELSE 0 END) as total_bottles,
      COUNT(*) as entries_count
    FROM daily_entries
    WHERE sales_amt > 0
  `;
  const params = [];
  if (year) { sql += ` AND date LIKE ?`; params.push(`${year}%`); }
  if (month) { sql += ` AND substr(date, 6, 2) = ?`; params.push(String(month).padStart(2, '0')); }
  sql += ` GROUP BY date ORDER BY total_sales DESC LIMIT ?`;
  params.push(limit);
  
  return db.prepare(sql).all(...params);
}

function getCategoryBreakdown(startDate, endDate) {
  return db.prepare(`
    SELECT category,
      SUM(sales_amt) as total_sales,
      SUM(CASE WHEN sales > 0 THEN sales ELSE 0 END) as total_bottles
    FROM daily_entries
    WHERE date BETWEEN ? AND ? AND sales_amt > 0
    GROUP BY category
    ORDER BY total_sales DESC
  `).all(startDate, endDate);
}

module.exports = {
  initialize,
  getDb,
  close,
  getDbPath,
  // Daily Entries
  getDailyEntries,
  saveDailyEntries,
  getDailyMetadata,
  // Denominations
  getDenomination,
  saveDenomination,
  // Products
  getProducts,
  addProduct,
  updateProductRate,
  updateProductStatus,
  // Categories
  getCategories,
  upsertCategory,
  // Staff
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  // Users
  getUsers,
  getUserByPin,
  addUser,
  updateUser,
  deleteUser,
  // Invoices
  getInvoices,
  saveInvoices,
  // Audit
  addAuditLog,
  getAuditLogs,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  // Sync
  addToSyncQueue,
  getPendingSyncItems,
  markSynced,
  cleanSyncQueue,
  // Backup
  createBackup,
  listBackups,
  restoreBackup,
  getBackupDir,
  // Analytics
  getDailyRange,
  getTopProducts,
  getTopDays,
  getCategoryBreakdown
};
