/**
 * File Store Service - SQLite-backed (Drop-in replacement)
 * 
 * This module maintains the EXACT SAME API as the original JSON-based fileStore.
 * All routes continue working without modification.
 * Underneath, it delegates to database.js which uses better-sqlite3.
 */
const path = require('path');
const database = require('./database');

// Legacy constants (maintained for backward compatibility)
const STORE_PATH = path.join(__dirname, '../../data/store.json');
const BACKUP_DIR = database.BACKUP_DIR;

// Default store structure (kept for reference and restore operations)
const DEFAULT_STORE = {
  dailyEntries: {},
  denominations: {},
  products: null,
  categories: null,
  staff: {
    salesmen: ['SHANMUGASUNDARAM.P', 'ARUMUGAM.A', 'RAMESHKUMAR.A', 'SHANMUGASUNDARAM.M'],
    supervisors: ['ANTONYSAMY.A', 'SARAVAN']
  },
  users: [
    { id: '1', username: 'admin', name: 'ADMIN', role: 'admin', pin: '1974' },
    { id: '2', username: 'operator', name: 'SUPERVISOR', role: 'operator', pin: '1745' }
  ],
  auditLogs: [],
  settings: {
    shopNo: '1745',
    shopName: 'TASMAC Shop No. 1745',
    address: 'SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101'
  }
};

// Auto-migrate from store.json on first load
database.migrateFromJson(STORE_PATH);

/**
 * Read the entire store as a single object (legacy compatibility)
 * Returns same shape as the old store.json
 */
function readStore() {
  return database.exportAsObject();
}

/**
 * Write the entire store at once (legacy compatibility)
 * Used by backup upload/restore
 */
function writeStore(data) {
  database.restoreFromObject({ ...DEFAULT_STORE, ...data });
}

/**
 * Get a section of the store by key
 * Supports: products, staff, users, categories, dailyEntries, denominations, auditLogs, settings
 */
function get(key) {
  switch (key) {
    case 'products':
      return database.getProducts();
    case 'staff':
      return database.getStaff();
    case 'users':
      return database.getUsers();
    case 'categories':
      return database.getCategories();
    case 'dailyEntries':
      return database.getAllDailyEntries();
    case 'denominations':
      return database.getAllDenominations();
    case 'auditLogs':
      return database.getAuditLogs();
    case 'settings':
      return database.getSettings();
    case 'holidays': {
      const settings = database.getSettings();
      if (settings.holidays) {
        try { return JSON.parse(settings.holidays); } catch { return {}; }
      }
      return {};
    }
    default:
      // For any unknown key, return null
      return null;
  }
}

/**
 * Set a section of the store by key
 */
function set(key, value) {
  switch (key) {
    case 'products':
      database.setProducts(value || []);
      break;
    case 'staff':
      database.setStaff(value || { salesmen: [], supervisors: [] });
      break;
    case 'users':
      database.setUsers(value || []);
      break;
    case 'categories':
      database.setCategories(value || {});
      break;
    case 'dailyEntries':
      database.setAllDailyEntries(value || {});
      break;
    case 'denominations':
      database.setAllDenominations(value || {});
      break;
    case 'auditLogs':
      database.setAuditLogs(value || []);
      break;
    case 'settings':
      database.setAllSettings(value || {});
      break;
    case 'holidays':
      database.setSetting('holidays', JSON.stringify(value || {}));
      break;
    default:
      // Unknown key - ignore silently
      break;
  }
  return value;
}

/**
 * Get a nested value (e.g., dailyEntries['2024-01-15'] or denominations['2024-01-15'])
 */
function getNested(section, key) {
  switch (section) {
    case 'dailyEntries':
      return database.getDailyEntry(key);
    case 'denominations':
      return database.getDenomination(key);
    default:
      // For other sections, fall back to getting the whole section
      const data = get(section);
      return data?.[key] || null;
  }
}

/**
 * Set a nested value
 */
function setNested(section, key, value) {
  switch (section) {
    case 'dailyEntries':
      database.setDailyEntry(key, value);
      // Queue for Firebase sync
      queueForSync('dailyEntries', key, 'UPSERT', value);
      break;
    case 'denominations':
      database.setDenomination(key, value);
      queueForSync('denominations', key, 'UPSERT', value);
      break;
    default:
      // For other sections, get the whole object, update key, and set back
      const data = get(section) || {};
      data[key] = value;
      set(section, data);
      break;
  }
  return value;
}

/**
 * Delete a nested key
 */
function deleteNested(section, key) {
  switch (section) {
    case 'dailyEntries':
      return database.deleteDailyEntry(key);
    case 'denominations':
      return database.deleteDenomination(key);
    default:
      // For other sections, get the whole object, delete key, set back
      const data = get(section);
      if (data && data[key]) {
        delete data[key];
        set(section, data);
        return true;
      }
      return false;
  }
}

/**
 * Append to an array in the store (e.g., auditLogs)
 */
function append(key, item) {
  switch (key) {
    case 'auditLogs':
      database.appendAuditLog(item);
      break;
    default:
      // For other array keys, get, push, set
      const arr = get(key) || [];
      if (Array.isArray(arr)) {
        arr.push(item);
        set(key, arr);
      }
      break;
  }
  return item;
}

/**
 * Create a backup
 */
function createBackup(label) {
  return database.createBackup(label);
}

/**
 * List available backups
 */
function listBackups() {
  return database.listBackups();
}

/**
 * Restore from a backup file
 */
function restoreBackup(filename) {
  return database.restoreBackup(filename);
}

/**
 * Invalidate cache (no-op for SQLite, kept for API compatibility)
 * SQLite doesn't need cache invalidation since queries always hit the DB
 */
function invalidateCache() {
  // No-op - SQLite handles its own caching via WAL mode
}

/**
 * Queue a change for Firebase sync (non-blocking)
 * Only queues if sync is conceptually enabled (the actual push is handled by syncService in Electron)
 */
function queueForSync(tableName, recordId, operation, data) {
  try {
    // Map UPSERT to UPDATE for the CHECK constraint
    const op = operation === 'UPSERT' ? 'UPDATE' : operation;
    database.addToSyncQueue(tableName, recordId, op, data);
  } catch (err) {
    // Never let sync queue failures affect the main operation
    // This is intentionally silent - sync is secondary to local data
  }
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
  queueForSync,
  DEFAULT_STORE,
  STORE_PATH,
  BACKUP_DIR
};
