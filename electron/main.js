/**
 * TASMAC POS v2.0 - Electron Main Process
 * 
 * Architecture:
 *   Electron App (single process)
 *   ├── React Frontend (renderer, loaded from built files or dev server)
 *   ├── Express Backend (embedded IN-PROCESS, no child process)
 *   ├── SQLite Database (via database.js service)
 *   ├── Auto Backup (VACUUM INTO, 30-min interval, 20 max retention)
 *   └── Firebase Sync (optional, queue-based, 5-min interval)
 *            │
 *            ▼
 *         Web Dashboard (reads from Firestore, read-only)
 *
 * IMPORTANT: The Express server runs inside the same Node.js process as Electron.
 * This means:
 *   - No need to spawn a child process
 *   - No port conflicts
 *   - Shared memory/state if needed
 *   - Clean shutdown guaranteed
 *   - User never needs to run anything manually
 */
const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== GLOBAL STATE =====
let mainWindow = null;
let tray = null;
let expressServer = null;
let autoBackupTimer = null;
let syncTimer = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 5000;

// App data paths
const USER_DATA = app.getPath('userData');
const DOCUMENTS = app.getPath('documents');
const BACKUP_DIR = path.join(DOCUMENTS, 'TSOP_Backups');

// ===== SINGLE INSTANCE LOCK =====
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  // Someone tried to run a second instance - focus our window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ===== APP INITIALIZATION =====
app.whenReady().then(async () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   TASMAC POS v2.0 - Desktop App     ║');
  console.log('║   Shop No. 1745 - Alandurai          ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Platform: ${process.platform} | Arch: ${process.arch}`);
  console.log(`User Data: ${USER_DATA}`);
  console.log(`Backups: ${BACKUP_DIR}`);
  console.log(`Mode: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  console.log('');

  try {
    // 1. Start the embedded Express backend (in-process)
    await startEmbeddedBackend();
    
    // 2. Create the main window
    createMainWindow();
    
    // 3. Register IPC handlers
    registerIpcHandlers();
    
    // 4. Start auto-backup service
    startAutoBackup();
    
    // 5. Start Firebase sync (if configured)
    startFirebaseSync();
    
    console.log('[App] All services started successfully');
  } catch (err) {
    console.error('[App] FATAL: Startup failed:', err.message);
    dialog.showErrorBox('Startup Error', 
      `TASMAC POS failed to start:\n\n${err.message}\n\nPlease try restarting the application.`
    );
    app.quit();
  }
});

// ===== EMBEDDED EXPRESS BACKEND =====
async function startEmbeddedBackend() {
  console.log('[Backend] Starting embedded Express server...');
  
  // Set the working directory for the backend (so relative paths in routes work)
  const backendDir = path.join(__dirname, '..', 'backend');
  process.chdir(backendDir);
  
  // Require the Express app (this loads all routes, services, etc.)
  const backendApp = require(path.join(backendDir, 'src', 'index.js'));
  
  // Start listening
  expressServer = await backendApp.startServer(BACKEND_PORT);
  console.log(`[Backend] Express server running on port ${BACKEND_PORT} (embedded)`);
}

// ===== MAIN WINDOW =====
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: 'TASMAC POS - Shop No. 1745',
    icon: getIconPath(),
    show: false, // Show after ready-to-show
    backgroundColor: '#F4F6F4',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      // Security: disable dangerous features
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false
    }
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load content
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load built frontend
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      // Fallback: connect to embedded Express which can serve the API
      mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    }
  }

  // Application menu
  setupMenu();

  // Window events
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation away from app
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const appOrigins = ['http://localhost:5173', 'http://localhost:5000', 'file://'];
    if (!appOrigins.some(origin => url.startsWith(origin))) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ===== AUTO BACKUP SERVICE =====
function startAutoBackup() {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const BACKUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
  const MAX_BACKUPS = 20;

  const runBackup = () => {
    try {
      const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
      const result = fileStore.createBackup('auto');
      console.log(`[AutoBackup] Created: ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
      
      // Cleanup old backups (keep only MAX_BACKUPS)
      const backups = fileStore.listBackups();
      const autoBackups = backups.filter(b => b.filename.includes('_auto'));
      if (autoBackups.length > MAX_BACKUPS) {
        const toDelete = autoBackups.slice(MAX_BACKUPS);
        toDelete.forEach(b => {
          const filePath = path.join(fileStore.BACKUP_DIR, b.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[AutoBackup] Cleaned: ${b.filename}`);
          }
        });
      }

      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:complete', result);
      }
    } catch (err) {
      console.error('[AutoBackup] Failed:', err.message);
    }
  };

  // First backup after 2 minutes
  setTimeout(runBackup, 2 * 60 * 1000);
  
  // Then every 30 minutes
  autoBackupTimer = setInterval(runBackup, BACKUP_INTERVAL);
  console.log(`[AutoBackup] Scheduled every ${BACKUP_INTERVAL / 60000} minutes (max ${MAX_BACKUPS} kept)`);
}

// ===== FIREBASE SYNC =====
function startFirebaseSync() {
  try {
    const firebaseConfig = path.join(__dirname, 'src', 'firebase', 'config.js');
    if (!fs.existsSync(firebaseConfig)) {
      console.log('[Sync] Firebase config not found - sync disabled');
      return;
    }

    const firebase = require(firebaseConfig);
    const available = firebase.initialize();
    
    if (!available) {
      console.log('[Sync] Firebase not configured - sync disabled (app works offline)');
      return;
    }

    const syncService = require(path.join(__dirname, 'src', 'firebase', 'syncService.js'));
    const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
    
    // Process sync queue every 5 minutes
    const SYNC_INTERVAL = 5 * 60 * 1000;
    syncTimer = setInterval(() => {
      syncService.processQueue && syncService.processQueue();
    }, SYNC_INTERVAL);
    
    console.log('[Sync] Firebase sync active (every 5 minutes)');
  } catch (err) {
    console.log('[Sync] Firebase initialization skipped:', err.message);
  }
}

// ===== IPC HANDLERS =====
function registerIpcHandlers() {
  // --- App Info ---
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);
  ipcMain.handle('app:paths', () => ({
    userData: USER_DATA,
    documents: DOCUMENTS,
    backups: BACKUP_DIR,
    database: path.join(__dirname, '..', 'backend', 'data', 'tasmac.db')
  }));

  // --- Window Controls ---
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.hide());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

  // --- Backup (direct from main process for faster access) ---
  ipcMain.handle('backup:create', (_, label) => {
    try {
      const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
      return fileStore.createBackup(label || 'manual');
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('backup:list', () => {
    try {
      const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
      return fileStore.listBackups();
    } catch (err) {
      return [];
    }
  });

  ipcMain.handle('backup:restore', async (_, filename) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Restore'],
      defaultId: 0,
      title: 'Confirm Restore',
      message: `Restore from backup "${filename}"?`,
      detail: 'This will overwrite all current data. A safety backup will be created first.'
    });
    
    if (result.response === 1) {
      try {
        const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
        fileStore.restoreBackup(filename);
        // Restart the app to reload all data
        app.relaunch();
        app.exit(0);
        return { success: true };
      } catch (err) {
        return { error: err.message };
      }
    }
    return { cancelled: true };
  });

  ipcMain.handle('backup:openFolder', () => {
    const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
    shell.openPath(fileStore.BACKUP_DIR);
  });

  ipcMain.handle('backup:status', () => ({
    enabled: true,
    intervalMinutes: 30,
    maxBackups: 20,
    backupDir: BACKUP_DIR,
    nextBackup: autoBackupTimer ? 'Scheduled' : 'Disabled'
  }));

  // --- Sync Status ---
  ipcMain.handle('sync:status', () => {
    try {
      const syncService = require(path.join(__dirname, 'src', 'firebase', 'syncService.js'));
      return syncService.getStatus ? syncService.getStatus() : { running: false, firebaseAvailable: false };
    } catch {
      return { running: false, firebaseAvailable: false, enabled: false };
    }
  });

  ipcMain.handle('sync:force', async () => {
    try {
      const syncService = require(path.join(__dirname, 'src', 'firebase', 'syncService.js'));
      if (syncService.forceSync) return await syncService.forceSync();
      return { error: 'Sync not available' };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('sync:setEnabled', (_, enabled) => {
    try {
      const syncService = require(path.join(__dirname, 'src', 'firebase', 'syncService.js'));
      if (syncService.setEnabled) syncService.setEnabled(enabled);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // --- Settings ---
  ipcMain.handle('settings:getAll', () => {
    try {
      const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
      return fileStore.get('settings') || {};
    } catch { return {}; }
  });

  ipcMain.handle('settings:get', (_, key) => {
    try {
      const settings = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore')).get('settings') || {};
      return settings[key] || null;
    } catch { return null; }
  });

  ipcMain.handle('settings:set', (_, key, value) => {
    try {
      const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
      const settings = fileStore.get('settings') || {};
      settings[key] = value;
      fileStore.set('settings', settings);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // --- Export ---
  ipcMain.handle('export:excel', async (_, data) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: data.filename || 'TASMAC_1745_export.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (filePath) {
      // Trigger download via the Express API
      return { filePath, proceed: true };
    }
    return { cancelled: true };
  });

  // --- Dialog helpers ---
  ipcMain.handle('dialog:confirm', async (_, options) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: options.type || 'question',
      buttons: options.buttons || ['Cancel', 'OK'],
      defaultId: options.defaultId || 0,
      title: options.title || 'Confirm',
      message: options.message || '',
      detail: options.detail || ''
    });
    return result.response;
  });
}

// ===== APPLICATION MENU =====
function setupMenu() {
  const template = [
    {
      label: 'TASMAC POS',
      submenu: [
        { label: 'About', role: 'about' },
        { type: 'separator' },
        {
          label: 'Create Backup',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
            const result = fileStore.createBackup('menu');
            if (mainWindow) mainWindow.webContents.send('notification', { type: 'success', message: `Backup created: ${result.filename}` });
          }
        },
        {
          label: 'Open Backup Folder',
          click: () => {
            const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
            shell.openPath(fileStore.BACKUP_DIR);
          }
        },
        { type: 'separator' },
        {
          label: 'Restart',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => { app.relaunch(); app.exit(0); }
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { isQuitting = true; app.quit(); }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  if (isDev) {
    template[2].submenu.push({ type: 'separator' }, { role: 'toggleDevTools' });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ===== ICON HELPER =====
function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, iconName);
  if (fs.existsSync(iconPath)) return iconPath;
  return undefined;
}

// ===== APP LIFECYCLE =====
app.on('window-all-closed', () => {
  // On macOS, keep app running in background
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon clicked
  if (mainWindow === null) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  cleanup();
});

function cleanup() {
  console.log('[App] Shutting down...');
  
  // Stop auto-backup timer
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
  
  // Stop sync timer
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  
  // Close Express server
  if (expressServer) {
    expressServer.close(() => {
      console.log('[Backend] Express server closed');
    });
    expressServer = null;
  }
  
  console.log('[App] Cleanup complete');
}

// ===== CRASH RECOVERY =====
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err);
  // Create emergency backup before crashing
  try {
    const fileStore = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'fileStore'));
    fileStore.createBackup('crash-recovery');
    console.log('[CRASH] Emergency backup created');
  } catch (backupErr) {
    console.error('[CRASH] Failed to create emergency backup:', backupErr.message);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
});
