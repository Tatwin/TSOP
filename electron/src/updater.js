/**
 * Auto-Updater Service for TASMAC POS
 * 
 * Uses electron-updater to check for and apply updates from GitHub Releases.
 * Updates are downloaded in the background and installed on next app restart.
 * 
 * Flow:
 * 1. On startup, checks for updates (after 30 seconds)
 * 2. If update available, downloads in background
 * 3. Notifies user via IPC to renderer
 * 4. User can choose to install now (restart) or on next launch
 */
const { ipcMain } = require('electron');

let autoUpdater = null;
let mainWindow = null;
let updateAvailable = false;
let updateDownloaded = false;
let updateInfo = null;

/**
 * Initialize the auto-updater
 * @param {BrowserWindow} win - The main window for sending notifications
 */
function initialize(win) {
  mainWindow = win;
  
  try {
    const { autoUpdater: updater } = require('electron-updater');
    autoUpdater = updater;
  } catch (err) {
    console.log('[Updater] electron-updater not available (dev mode):', err.message);
    return;
  }
  
  // Configuration
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  
  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    sendToRenderer('updater:status', { status: 'checking' });
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Update available: v${info.version}`);
    updateAvailable = true;
    updateInfo = info;
    sendToRenderer('updater:status', { 
      status: 'available', 
      version: info.version,
      releaseNotes: info.releaseNotes 
    });
  });
  
  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] No updates available. Current is latest.');
    sendToRenderer('updater:status', { status: 'up-to-date', version: info.version });
  });
  
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      speed: progress.bytesPerSecond
    });
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Updater] Update downloaded: v${info.version}`);
    updateDownloaded = true;
    sendToRenderer('updater:status', { 
      status: 'downloaded', 
      version: info.version,
      message: 'Update ready. Restart to apply.' 
    });
  });
  
  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
    sendToRenderer('updater:status', { status: 'error', message: err.message });
  });
  
  // Register IPC handlers
  ipcMain.handle('updater:check', () => checkForUpdates());
  ipcMain.handle('updater:install', () => installUpdate());
  ipcMain.handle('updater:status', () => getStatus());
  
  // Check for updates after 30 seconds
  setTimeout(() => checkForUpdates(), 30 * 1000);
  
  // Then check every 4 hours
  setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000);
  
  console.log('[Updater] Initialized');
}

/**
 * Check for updates
 */
function checkForUpdates() {
  if (!autoUpdater) return { error: 'Updater not available' };
  
  try {
    autoUpdater.checkForUpdates();
    return { checking: true };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Install downloaded update (restarts the app)
 */
function installUpdate() {
  if (!autoUpdater || !updateDownloaded) {
    return { error: 'No update downloaded' };
  }
  
  console.log('[Updater] Installing update and restarting...');
  autoUpdater.quitAndInstall(false, true);
  return { installing: true };
}

/**
 * Get current update status
 */
function getStatus() {
  return {
    available: updateAvailable,
    downloaded: updateDownloaded,
    info: updateInfo ? { version: updateInfo.version, releaseDate: updateInfo.releaseDate } : null
  };
}

/**
 * Send message to renderer process
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

module.exports = { initialize, checkForUpdates, installUpdate, getStatus };
