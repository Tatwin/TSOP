/**
 * Auto Backup Service for TASMAC POS
 * Runs scheduled SQLite backups every N hours
 * Keeps last 7 days of backups, auto-cleans old ones
 */
const fs = require('fs');
const path = require('path');

let backupInterval = null;
let database = null;

const MAX_BACKUPS = 28; // 7 days * 4 backups/day (every 6 hours)

/**
 * Start the auto-backup scheduler
 */
function start(db) {
  database = db;
  
  const intervalHours = Number(database.getSetting('autoBackupIntervalHours')) || 6;
  const enabled = database.getSetting('autoBackupEnabled') !== 'false';
  
  if (!enabled) {
    console.log('[AutoBackup] Auto backup is disabled');
    return;
  }
  
  console.log(`[AutoBackup] Starting auto-backup every ${intervalHours} hours`);
  
  // Run first backup after 5 minutes (give app time to start)
  setTimeout(() => {
    runBackup();
  }, 5 * 60 * 1000);
  
  // Schedule recurring backups
  backupInterval = setInterval(() => {
    runBackup();
  }, intervalHours * 60 * 60 * 1000);
}

/**
 * Stop the auto-backup scheduler
 */
function stop() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log('[AutoBackup] Stopped');
  }
}

/**
 * Run a single backup
 */
function runBackup() {
  try {
    console.log('[AutoBackup] Creating scheduled backup...');
    const result = database.createBackup('auto');
    console.log(`[AutoBackup] Backup created: ${result.filename} (${formatSize(result.size)})`);
    
    // Clean old backups
    cleanOldBackups();
    
    return result;
  } catch (err) {
    console.error('[AutoBackup] Backup failed:', err.message);
    return null;
  }
}

/**
 * Clean old backups keeping only the most recent MAX_BACKUPS
 */
function cleanOldBackups() {
  try {
    const backupDir = database.getBackupDir();
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.includes('_auto') && f.endsWith('.db'))
      .map(f => ({ filename: f, mtime: fs.statSync(path.join(backupDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    
    // Remove backups beyond the max count
    if (backups.length > MAX_BACKUPS) {
      const toRemove = backups.slice(MAX_BACKUPS);
      toRemove.forEach(b => {
        const filePath = path.join(backupDir, b.filename);
        fs.unlinkSync(filePath);
        console.log(`[AutoBackup] Cleaned old backup: ${b.filename}`);
      });
    }
  } catch (err) {
    console.error('[AutoBackup] Cleanup error:', err.message);
  }
}

/**
 * Get backup status info
 */
function getStatus() {
  if (!database) return { running: false };
  
  const backups = database.listBackups();
  const autoBackups = backups.filter(b => b.filename.includes('_auto'));
  const lastBackup = autoBackups[0] || null;
  
  return {
    running: backupInterval !== null,
    enabled: database.getSetting('autoBackupEnabled') !== 'false',
    intervalHours: Number(database.getSetting('autoBackupIntervalHours')) || 6,
    totalBackups: backups.length,
    autoBackups: autoBackups.length,
    lastBackup: lastBackup ? lastBackup.createdAt : null,
    maxBackups: MAX_BACKUPS
  };
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = { start, stop, runBackup, getStatus, cleanOldBackups };
