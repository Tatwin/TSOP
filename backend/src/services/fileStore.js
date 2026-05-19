/**
 * File-based persistence service for TASMAC POS
 * Reads/writes JSON to data/store.json
 * All data survives server restarts
 */
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../../data/store.json');
const BACKUP_DIR = path.join(__dirname, '../../data/backups');

// Default store structure
const DEFAULT_STORE = {
  dailyEntries: {},    // key: "YYYY-MM-DD"
  denominations: {},   // key: "YYYY-MM-DD"
  products: null,      // null = use defaults from products.js
  categories: null,    // null = use defaults
  staff: {
    salesmen: ['SHANMUGASUNDARAM.P', 'ARUMUGAM.A', 'RAMESHKUMAR.A', 'SHANMUGASUNDARAM.M'],
    supervisors: ['ANTONYSAMY.A', 'SARAVAN']
  },
  users: [
    { id: '1', username: 'admin', name: 'ANTONYSAMY.A', role: 'admin', pin: '1974' },
    { id: '2', username: 'operator', name: 'RAMESHKUMAR.A', role: 'operator', pin: '1745' }
  ],
  auditLogs: [],       // Array of audit entries
  settings: {
    shopNo: '1745',
    shopName: 'TASMAC Shop No. 1745',
    address: 'SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101'
  }
};

let storeCache = null;

/**
 * Read store from disk (with caching)
 */
function readStore() {
  if (storeCache) return storeCache;
  
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      storeCache = JSON.parse(raw);
      // Ensure all keys exist (migration support)
      storeCache = { ...DEFAULT_STORE, ...storeCache };
      return storeCache;
    }
  } catch (err) {
    console.error('[FileStore] Error reading store:', err.message);
  }
  
  // Initialize with defaults
  storeCache = { ...DEFAULT_STORE };
  writeStore(storeCache);
  return storeCache;
}

/**
 * Write store to disk (atomic write with temp file)
 */
function writeStore(data) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const tempPath = STORE_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, STORE_PATH);
    storeCache = data;
  } catch (err) {
    console.error('[FileStore] Error writing store:', err.message);
    throw err;
  }
}

/**
 * Get a section of the store
 */
function get(key) {
  const store = readStore();
  return store[key];
}

/**
 * Set a section of the store
 */
function set(key, value) {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  return value;
}

/**
 * Update a nested key (e.g., dailyEntries['2024-01-15'])
 */
function setNested(section, key, value) {
  const store = readStore();
  if (!store[section]) store[section] = {};
  store[section][key] = value;
  writeStore(store);
  return value;
}

/**
 * Get a nested key
 */
function getNested(section, key) {
  const store = readStore();
  return store[section]?.[key] || null;
}

/**
 * Delete a nested key
 */
function deleteNested(section, key) {
  const store = readStore();
  if (store[section] && store[section][key]) {
    delete store[section][key];
    writeStore(store);
    return true;
  }
  return false;
}

/**
 * Append to an array in the store (e.g., auditLogs)
 */
function append(key, item) {
  const store = readStore();
  if (!Array.isArray(store[key])) store[key] = [];
  store[key].push(item);
  // Keep audit logs capped at 10000 entries
  if (key === 'auditLogs' && store[key].length > 10000) {
    store[key] = store[key].slice(-10000);
  }
  writeStore(store);
  return item;
}

/**
 * Create a backup
 */
function createBackup(label) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const store = readStore();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}${label ? '_' + label : ''}.json`;
  const backupPath = path.join(BACKUP_DIR, filename);
  
  fs.writeFileSync(backupPath, JSON.stringify(store, null, 2), 'utf8');
  
  return { filename, path: backupPath, timestamp: new Date().toISOString(), size: JSON.stringify(store).length };
}

/**
 * List available backups
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
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

/**
 * Restore from a backup file
 */
function restoreBackup(filename) {
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found');
  }
  
  // Create a pre-restore backup first
  createBackup('pre-restore');
  
  const raw = fs.readFileSync(backupPath, 'utf8');
  const data = JSON.parse(raw);
  writeStore({ ...DEFAULT_STORE, ...data });
  return true;
}

/**
 * Invalidate cache (for testing)
 */
function invalidateCache() {
  storeCache = null;
}

module.exports = {
  readStore,
  writeStore,
  get,
  set,
  getNested,
  setNested,
  deleteNested,
  append,
  createBackup,
  listBackups,
  restoreBackup,
  invalidateCache,
  DEFAULT_STORE,
  STORE_PATH,
  BACKUP_DIR
};
