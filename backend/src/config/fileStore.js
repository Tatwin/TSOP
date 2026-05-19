/**
 * File-based persistence for TASMAC POS data.
 * Reads from data/store.json on startup, writes on every mutation.
 * Survives server restarts and browser refreshes.
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'store.json');
const DATA_DIR = path.dirname(STORE_PATH);

// Default empty store
const DEFAULT_STORE = {
  dailyEntries: {},   // key: "YYYY-MM-DD" => { entries, metadata, invoices, posAmount, deviceValues, staff, openingStock, purchases, ... }
  denominations: {}   // key: "YYYY-MM-DD" => { notes, coins, totalCash, updatedAt }
};

let store = null;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load store from disk. Called once at startup.
 */
function loadStore() {
  if (store !== null) return store;
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      store = { ...DEFAULT_STORE, ...JSON.parse(raw) };
      const entryDays = Object.keys(store.dailyEntries).length;
      const denomDays = Object.keys(store.denominations).length;
      console.log(`[FileStore] Loaded: ${entryDays} daily entries, ${denomDays} denomination records`);
    } else {
      store = { ...DEFAULT_STORE };
      console.log('[FileStore] No store.json found — starting fresh');
    }
  } catch (err) {
    console.error('[FileStore] Error loading store.json:', err.message);
    store = { ...DEFAULT_STORE };
  }
  return store;
}

/**
 * Persist store to disk (synchronous write for data safety)
 */
function persist() {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[FileStore] Error writing store.json:', err.message);
  }
}

// --- Daily Entry operations ---

function getDailyEntry(date) {
  loadStore();
  return store.dailyEntries[date] || null;
}

function setDailyEntry(date, data) {
  loadStore();
  store.dailyEntries[date] = data;
  persist();
}

function updateDailyEntry(date, partial) {
  loadStore();
  store.dailyEntries[date] = { ...(store.dailyEntries[date] || {}), ...partial };
  persist();
}

function getAllDailyEntries() {
  loadStore();
  return store.dailyEntries;
}

// --- Denomination operations ---

function getDenomination(date) {
  loadStore();
  return store.denominations[date] || null;
}

function setDenomination(date, data) {
  loadStore();
  store.denominations[date] = data;
  persist();
}

// Initialize on first require
loadStore();

module.exports = {
  getDailyEntry,
  setDailyEntry,
  updateDailyEntry,
  getAllDailyEntries,
  getDenomination,
  setDenomination,
  loadStore,
  persist
};
