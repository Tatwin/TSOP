/**
 * SQLite Database Schema for TASMAC POS
 * All tables with proper indexes for performance
 */

const SCHEMA_VERSION = 1;

const CREATE_TABLES = `
-- Settings table (key-value store for app config)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users table (RBAC)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  pin TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sno INTEGER NOT NULL,
  code_no TEXT DEFAULT '',
  particular TEXT NOT NULL,
  category TEXT NOT NULL,
  rate REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  bottles_per_case INTEGER DEFAULT 48
);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Daily entries table (one row per product per date)
CREATE TABLE IF NOT EXISTS daily_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  sno INTEGER,
  code_no TEXT,
  particular TEXT,
  category TEXT,
  cases INTEGER DEFAULT 0,
  bottles INTEGER DEFAULT 0,
  opening_stock INTEGER DEFAULT 0,
  purchase INTEGER DEFAULT 0,
  stock_return INTEGER DEFAULT 0,
  rate REAL DEFAULT 0,
  clst INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  sales_amt REAL DEFAULT 0,
  cl_value REAL DEFAULT 0,
  op_value REAL DEFAULT 0,
  purchase_value REAL DEFAULT 0,
  stock_return_value REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Daily metadata table (one row per date)
CREATE TABLE IF NOT EXISTS daily_metadata (
  date TEXT PRIMARY KEY,
  pos_amount REAL DEFAULT 0,
  device_sales_bottles INTEGER DEFAULT 0,
  device_closing_bottles INTEGER DEFAULT 0,
  device_sales_value REAL DEFAULT 0,
  device_closing_value REAL DEFAULT 0,
  staff_salesmen TEXT DEFAULT '[]',
  staff_supervisors TEXT DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT DEFAULT 'admin'
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  invoice_no TEXT,
  invoice_date TEXT,
  invoice_amount REAL DEFAULT 0,
  items TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Denominations table (one row per date)
CREATE TABLE IF NOT EXISTS denominations (
  date TEXT PRIMARY KEY,
  note_500 INTEGER DEFAULT 0,
  note_200 INTEGER DEFAULT 0,
  note_100 INTEGER DEFAULT 0,
  note_50 INTEGER DEFAULT 0,
  note_20 INTEGER DEFAULT 0,
  note_10 INTEGER DEFAULT 0,
  coins REAL DEFAULT 0,
  total_cash REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  user TEXT DEFAULT 'system',
  description TEXT,
  previous_value TEXT,
  new_value TEXT,
  metadata TEXT DEFAULT '{}'
);

-- Backups metadata table
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sync tracking table (for Firebase sync)
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_product ON daily_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date_product ON daily_entries(date, product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user);
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_staff_type ON staff(type);
`;

const DEFAULT_DATA = {
  settings: [
    { key: 'shopNo', value: '1745' },
    { key: 'shopName', value: 'TASMAC Shop No. 1745' },
    { key: 'address', value: 'SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101' },
    { key: 'schemaVersion', value: String(SCHEMA_VERSION) },
    { key: 'firebaseSyncEnabled', value: 'false' },
    { key: 'autoBackupEnabled', value: 'true' },
    { key: 'autoBackupIntervalHours', value: '6' }
  ],
  users: [
    { username: 'admin', name: 'ADMIN', role: 'admin', pin: '1974' },
    { username: 'operator', name: 'SUPERVISOR', role: 'operator', pin: '1745' }
  ],
  staff: [
    { name: 'SHANMUGASUNDARAM.P', type: 'salesmen' },
    { name: 'ARUMUGAM.A', type: 'salesmen' },
    { name: 'RAMESHKUMAR.A', type: 'salesmen' },
    { name: 'SHANMUGASUNDARAM.M', type: 'salesmen' },
    { name: 'ANTONYSAMY.A', type: 'supervisors' },
    { name: 'SARAVAN', type: 'supervisors' }
  ]
};

module.exports = { CREATE_TABLES, DEFAULT_DATA, SCHEMA_VERSION };
