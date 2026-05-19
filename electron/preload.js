/**
 * Electron Preload Script
 * Exposes safe IPC methods to the renderer process (React app)
 * The renderer cannot access Node.js APIs directly - only these exposed methods
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== APP INFO =====
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  isElectron: true,
  
  // ===== AUTH =====
  login: (pin) => ipcRenderer.invoke('auth:login', pin),
  getUsers: () => ipcRenderer.invoke('auth:getUsers'),
  createUser: (user) => ipcRenderer.invoke('auth:createUser', user),
  updateUser: (id, data) => ipcRenderer.invoke('auth:updateUser', id, data),
  deleteUser: (id) => ipcRenderer.invoke('auth:deleteUser', id),
  
  // ===== DAILY ENTRIES =====
  getDailyEntries: (date) => ipcRenderer.invoke('daily:get', date),
  saveDailyEntries: (date, entries, metadata) => ipcRenderer.invoke('daily:save', date, entries, metadata),
  getDailyMetadata: (date) => ipcRenderer.invoke('daily:getMeta', date),
  getOpeningStock: (date) => ipcRenderer.invoke('daily:openingStock', date),
  saveOpeningStock: (date, stock) => ipcRenderer.invoke('daily:saveOpeningStock', date, stock),
  
  // ===== DENOMINATIONS =====
  getDenomination: (date) => ipcRenderer.invoke('denomination:get', date),
  saveDenomination: (date, data) => ipcRenderer.invoke('denomination:save', date, data),
  
  // ===== PRODUCTS =====
  getProducts: () => ipcRenderer.invoke('products:getAll'),
  addProduct: (product) => ipcRenderer.invoke('products:add', product),
  updateProductRate: (id, rate) => ipcRenderer.invoke('products:updateRate', id, rate),
  updateProductStatus: (id, status) => ipcRenderer.invoke('products:updateStatus', id, status),
  
  // ===== CATEGORIES =====
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  upsertCategory: (key, label, bpc) => ipcRenderer.invoke('categories:upsert', key, label, bpc),
  
  // ===== STAFF =====
  getStaff: () => ipcRenderer.invoke('staff:getAll'),
  addStaff: (name, type) => ipcRenderer.invoke('staff:add', name, type),
  updateStaff: (id, name) => ipcRenderer.invoke('staff:update', id, name),
  deleteStaff: (id) => ipcRenderer.invoke('staff:delete', id),
  
  // ===== INVOICES =====
  getInvoices: (date) => ipcRenderer.invoke('invoices:get', date),
  saveInvoices: (date, invoices) => ipcRenderer.invoke('invoices:save', date, invoices),
  
  // ===== AUDIT LOGS =====
  getAuditLogs: (filters) => ipcRenderer.invoke('audit:getLogs', filters),
  
  // ===== ANALYTICS =====
  getDailyRange: (start, end) => ipcRenderer.invoke('analytics:dailyRange', start, end),
  getTopProducts: (start, end, limit) => ipcRenderer.invoke('analytics:topProducts', start, end, limit),
  getTopDays: (limit, year, month) => ipcRenderer.invoke('analytics:topDays', limit, year, month),
  getCategoryBreakdown: (start, end) => ipcRenderer.invoke('analytics:categoryBreakdown', start, end),
  
  // ===== BACKUP =====
  createBackup: (label) => ipcRenderer.invoke('backup:create', label),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (filename) => ipcRenderer.invoke('backup:restore', filename),
  getBackupStatus: () => ipcRenderer.invoke('backup:status'),
  
  // ===== FIREBASE SYNC =====
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  forceSync: () => ipcRenderer.invoke('sync:force'),
  setSyncEnabled: (enabled) => ipcRenderer.invoke('sync:setEnabled', enabled),
  
  // ===== SETTINGS =====
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  
  // ===== EXPORT =====
  exportExcel: (data) => ipcRenderer.invoke('export:excel', data),
  
  // ===== WINDOW =====
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  
  // ===== EVENTS (from main to renderer) =====
  onSyncUpdate: (callback) => ipcRenderer.on('sync:update', (_, data) => callback(data)),
  onBackupComplete: (callback) => ipcRenderer.on('backup:complete', (_, data) => callback(data)),
  onNotification: (callback) => ipcRenderer.on('notification', (_, data) => callback(data))
});
