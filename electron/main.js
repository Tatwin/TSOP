/**
 * TASMAC POS - Electron Main Process
 * 
 * Architecture:
 *   Electron App
 *   ├── React Frontend (renderer)
 *   ├── Express Backend (embedded HTTP server for API compatibility)
 *   ├── SQLite Database (local persistence via better-sqlite3)
 *   ├── Auto Backup (scheduled every 6 hours)
 *   └── Firebase Sync (optional, for web dashboard)
 *            │
 *            ▼
 *         Web Dashboard (Vercel/Firebase Hosting)
 */
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let database;
let autoBackup;
let firebase;
let syncService;

// ===== APP INITIALIZATION =====

app.whenReady().then(async () => {
  console.log('=== TASMAC POS v2.0 Desktop ===');
  console.log(`Platform: ${process.platform}`);
  console.log(`App Path: ${app.getPath('userData')}`);
  
  // 1. Initialize SQLite database
  database = require('./src/database');
  database.initialize();
  
  // 2. Initialize Firebase (optional - works without it)
  firebase = require('./src/firebase/config');
  const firebaseReady = firebase.initialize();
  
  // 3. Start sync service (if Firebase available)
  syncService = require('./src/firebase/syncService');
  if (firebaseReady) {
    syncService.start(database, firebase);
  }
  
  // 4. Start auto-backup service
  autoBackup = require('./src/backup/autoBackup');
  autoBackup.start(database);
  
  // 5. Start embedded Express backend (for API compatibility with React frontend)
  startBackend();
  
  // 6. Create window (after backend starts)
  setTimeout(() => {
    createWindow();
  }, 1500);
  
  // 7. Register all IPC handlers
  registerIpcHandlers();
});

// ===== WINDOW MANAGEMENT =====

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'TASMAC POS - Shop No. 1745',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  // Clean menu for production
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== EMBEDDED BACKEND =====

function startBackend() {
  const backendPath = path.join(__dirname, '..', 'backend', 'src', 'index.js');
  backendProcess = spawn('node', [backendPath], {
    env: { ...process.env, PORT: '5000', NODE_ENV: process.env.NODE_ENV || 'production' },
    cwd: path.join(__dirname, '..', 'backend')
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data.toString().trim()}`);
  });
  
  backendProcess.on('exit', (code) => {
    console.log(`[Backend] Process exited with code ${code}`);
  });
}

// ===== IPC HANDLERS =====

function registerIpcHandlers() {
  // --- App Info ---
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);
  
  // --- Auth ---
  ipcMain.handle('auth:login', (_, pin) => {
    const user = database.getUserByPin(pin);
    if (!user) return { error: 'Invalid PIN' };
    database.addAuditLog({ action: 'LOGIN', module: 'auth', user: user.username, description: `Login: ${user.name}` });
    return { user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  });
  
  ipcMain.handle('auth:getUsers', () => database.getUsers());
  ipcMain.handle('auth:createUser', (_, user) => database.addUser(user));
  ipcMain.handle('auth:updateUser', (_, id, data) => database.updateUser(id, data));
  ipcMain.handle('auth:deleteUser', (_, id) => database.deleteUser(id));
  
  // --- Daily Entries ---
  ipcMain.handle('daily:get', (_, date) => {
    const entries = database.getDailyEntries(date);
    const meta = database.getDailyMetadata(date);
    const invoices = database.getInvoices(date);
    return { entries, metadata: meta, invoices };
  });
  
  ipcMain.handle('daily:save', (_, date, entries, metadata) => {
    database.saveDailyEntries(date, entries, metadata);
    database.addAuditLog({ action: 'UPDATE', module: 'dailyEntry', user: metadata?.updatedBy || 'admin', description: `Daily entries saved for ${date}`, metadata: { date, count: entries.length } });
    // Push summary to Firebase
    if (syncService) syncService.pushDailySummary(date, entries, metadata);
    return { success: true };
  });
  
  ipcMain.handle('daily:getMeta', (_, date) => database.getDailyMetadata(date));
  
  ipcMain.handle('daily:openingStock', (_, date) => {
    // Look backwards for previous day's closing stock
    const entries = database.getDailyEntries(date);
    if (entries.length > 0) {
      const stock = {};
      entries.forEach(e => { stock[e.product_id] = e.clst; });
      return stock;
    }
    // Look back up to 31 days
    const currentDate = new Date(date);
    for (let i = 1; i <= 31; i++) {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - i);
      const prevStr = prev.toISOString().split('T')[0];
      const prevEntries = database.getDailyEntries(prevStr);
      if (prevEntries.length > 0) {
        const stock = {};
        prevEntries.forEach(e => { stock[e.product_id] = e.clst; });
        return stock;
      }
    }
    return {};
  });
  
  ipcMain.handle('daily:saveOpeningStock', (_, date, stock) => {
    // Opening stock is stored as part of daily entries
    database.addAuditLog({ action: 'UPDATE', module: 'dailyEntry', user: 'admin', description: `Opening stock saved for ${date}`, metadata: { date } });
    return { success: true };
  });
  
  // --- Denominations ---
  ipcMain.handle('denomination:get', (_, date) => database.getDenomination(date));
  ipcMain.handle('denomination:save', (_, date, data) => {
    database.saveDenomination(date, data);
    database.addAuditLog({ action: 'UPDATE', module: 'denomination', user: 'admin', description: `Denomination saved for ${date}: ₹${data.totalCash}`, metadata: { date } });
    return { success: true };
  });
  
  // --- Products ---
  ipcMain.handle('products:getAll', () => database.getProducts());
  ipcMain.handle('products:add', (_, product) => {
    const id = database.addProduct(product);
    database.addAuditLog({ action: 'CREATE', module: 'products', user: 'admin', description: `Product added: ${product.particular}`, newValue: product });
    return { id };
  });
  ipcMain.handle('products:updateRate', (_, id, rate) => {
    database.updateProductRate(id, rate);
    return { success: true };
  });
  ipcMain.handle('products:updateStatus', (_, id, status) => {
    database.updateProductStatus(id, status);
    return { success: true };
  });
  
  // --- Categories ---
  ipcMain.handle('categories:getAll', () => database.getCategories());
  ipcMain.handle('categories:upsert', (_, key, label, bpc) => {
    database.upsertCategory(key, label, bpc);
    return { success: true };
  });
  
  // --- Staff ---
  ipcMain.handle('staff:getAll', () => database.getStaff());
  ipcMain.handle('staff:add', (_, name, type) => {
    database.addStaff(name, type);
    database.addAuditLog({ action: 'CREATE', module: 'staff', user: 'admin', description: `Staff added: ${name} (${type})` });
    return { success: true };
  });
  ipcMain.handle('staff:update', (_, id, name) => { database.updateStaff(id, name); return { success: true }; });
  ipcMain.handle('staff:delete', (_, id) => { database.deleteStaff(id); return { success: true }; });
  
  // --- Invoices ---
  ipcMain.handle('invoices:get', (_, date) => database.getInvoices(date));
  ipcMain.handle('invoices:save', (_, date, invoices) => {
    database.saveInvoices(date, invoices);
    database.addAuditLog({ action: 'UPDATE', module: 'dailyEntry', user: 'admin', description: `Invoices saved for ${date} (${invoices.length} invoices)`, metadata: { date } });
    return { success: true };
  });
  
  // --- Audit Logs ---
  ipcMain.handle('audit:getLogs', (_, filters) => database.getAuditLogs(filters || {}));
  
  // --- Analytics ---
  ipcMain.handle('analytics:dailyRange', (_, start, end) => database.getDailyRange(start, end));
  ipcMain.handle('analytics:topProducts', (_, start, end, limit) => database.getTopProducts(start, end, limit || 10));
  ipcMain.handle('analytics:topDays', (_, limit, year, month) => database.getTopDays(limit || 5, year, month));
  ipcMain.handle('analytics:categoryBreakdown', (_, start, end) => database.getCategoryBreakdown(start, end));
  
  // --- Backup ---
  ipcMain.handle('backup:create', (_, label) => {
    const result = database.createBackup(label || 'manual');
    if (mainWindow) mainWindow.webContents.send('backup:complete', result);
    return result;
  });
  ipcMain.handle('backup:list', () => database.listBackups());
  ipcMain.handle('backup:restore', (_, filename) => {
    database.restoreBackup(filename);
    return { success: true };
  });
  ipcMain.handle('backup:status', () => autoBackup.getStatus());
  
  // --- Firebase Sync ---
  ipcMain.handle('sync:status', () => syncService.getStatus());
  ipcMain.handle('sync:force', () => syncService.forceSync());
  ipcMain.handle('sync:setEnabled', (_, enabled) => {
    syncService.setEnabled(enabled);
    return { success: true };
  });
  
  // --- Settings ---
  ipcMain.handle('settings:get', (_, key) => database.getSetting(key));
  ipcMain.handle('settings:set', (_, key, value) => { database.setSetting(key, value); return { success: true }; });
  ipcMain.handle('settings:getAll', () => database.getAllSettings());
  
  // --- Window ---
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
}

// ===== APP LIFECYCLE =====

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  cleanup();
});

function cleanup() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (autoBackup) autoBackup.stop();
  if (syncService) syncService.stop();
  if (database) database.close();
}
