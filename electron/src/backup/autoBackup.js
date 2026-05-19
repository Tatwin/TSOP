/**
 * Production Auto Backup Service for TASMAC POS
 * 
 * Features:
 * - VACUUM INTO for safe, consistent SQLite backups (no corruption)
 * - 30-minute scheduled interval
 * - Backup after completed invoice/sale (event-driven)
 * - Retention system: keep latest 20 backups only
 * - Automatic cleanup of old backups
 * - Emergency backup on crash
 * - Stores in Documents/TSOP_Backups for easy user access
 * 
 * Backup file naming: backup_YYYY-MM-DDTHH-MM-SS_{label}.db
 */
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  intervalMs: 30 * 60 * 1000,         // 30 minutes
  maxBackups: 20,                       // Keep latest 20 only
  firstBackupDelayMs: 2 * 60 * 1000,  // First backup after 2 minutes
  maxBackupSizeMB: 500,                // Skip if backup would exceed 500MB
  eventBackupCooldownMs: 5 * 60 * 1000 // Minimum 5 min between event-triggered backups
};

let backupInterval = null;
let fileStore = null;
let lastEventBackupTime = 0;
let stats = {
  totalBackupsCreated: 0,
  totalBackupsCleaned: 0,
  lastBackupTime: null,
  lastBackupFilename: null,
  lastBackupSize: 0,
  errors: 0
};

/**
 * Start the auto-backup scheduler
 * @param {Object} store - The fileStore service instance
 */
function start(store) {
  fileStore = store;
  
  console.log(`[AutoBackup] Starting (interval: ${CONFIG.intervalMs / 60000}min, max: ${CONFIG.maxBackups})`);
  
  // Run first backup after short delay (let app finish loading)
  setTimeout(() => {
    runBackup('startup');
  }, CONFIG.firstBackupDelayMs);
  
  // Schedule recurring backups
  backupInterval = setInterval(() => {
    runBackup('scheduled');
  }, CONFIG.intervalMs);
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
 * @param {string} label - Label for the backup (auto, scheduled, event, manual, crash-recovery, startup)
 * @returns {Object|null} Backup result or null on failure
 */
function runBackup(label = 'auto') {
  if (!fileStore) {
    console.error('[AutoBackup] Cannot backup - fileStore not initialized');
    return null;
  }
  
  try {
    // Create backup using VACUUM INTO (safe for active database)
    const result = fileStore.createBackup(label);
    
    // Update stats
    stats.totalBackupsCreated++;
    stats.lastBackupTime = new Date().toISOString();
    stats.lastBackupFilename = result.filename;
    stats.lastBackupSize = result.size;
    
    console.log(`[AutoBackup] Created: ${result.filename} (${formatSize(result.size)})`);
    
    // Cleanup old backups
    cleanOldBackups();
    
    return result;
  } catch (err) {
    stats.errors++;
    console.error('[AutoBackup] Backup failed:', err.message);
    return null;
  }
}

/**
 * Trigger backup after a completed invoice/sale
 * Has a cooldown to prevent too-frequent backups
 */
function triggerEventBackup(eventType) {
  const now = Date.now();
  if (now - lastEventBackupTime < CONFIG.eventBackupCooldownMs) {
    // Skip - too soon since last event backup
    return null;
  }
  
  lastEventBackupTime = now;
  console.log(`[AutoBackup] Event-triggered backup (${eventType})`);
  return runBackup(`event-${eventType}`);
}

/**
 * Create emergency backup (called on crash or unexpected shutdown)
 * This bypasses all cooldowns and limits
 */
function emergencyBackup() {
  if (!fileStore) return null;
  
  try {
    const result = fileStore.createBackup('crash-recovery');
    console.log(`[AutoBackup] Emergency backup created: ${result.filename}`);
    return result;
  } catch (err) {
    console.error('[AutoBackup] Emergency backup failed:', err.message);
    return null;
  }
}

/**
 * Clean old backups keeping only the most recent MAX_BACKUPS
 * Only cleans auto/scheduled/event backups (manual + crash-recovery are kept separately)
 */
function cleanOldBackups() {
  if (!fileStore) return;
  
  try {
    const allBackups = fileStore.listBackups();
    
    // Separate auto backups from manual/crash backups
    const autoBackups = allBackups.filter(b => 
      b.filename.includes('_auto') || 
      b.filename.includes('_scheduled') || 
      b.filename.includes('_event') ||
      b.filename.includes('_startup')
    );
    
    // Keep only the most recent MAX_BACKUPS auto backups
    if (autoBackups.length > CONFIG.maxBackups) {
      const toDelete = autoBackups.slice(CONFIG.maxBackups);
      toDelete.forEach(b => {
        const filePath = path.join(fileStore.BACKUP_DIR, b.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          stats.totalBackupsCleaned++;
          console.log(`[AutoBackup] Cleaned: ${b.filename}`);
        }
      });
    }
    
    // Also clean manual/pre-restore backups beyond 10
    const manualBackups = allBackups.filter(b => 
      b.filename.includes('_manual') || 
      b.filename.includes('_pre-restore') ||
      b.filename.includes('_menu')
    );
    if (manualBackups.length > 10) {
      const toDelete = manualBackups.slice(10);
      toDelete.forEach(b => {
        const filePath = path.join(fileStore.BACKUP_DIR, b.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          stats.totalBackupsCleaned++;
        }
      });
    }
  } catch (err) {
    console.error('[AutoBackup] Cleanup error:', err.message);
  }
}

/**
 * Get comprehensive backup status
 */
function getStatus() {
  const allBackups = fileStore ? fileStore.listBackups() : [];
  const autoBackups = allBackups.filter(b => 
    b.filename.includes('_auto') || b.filename.includes('_scheduled') || 
    b.filename.includes('_event') || b.filename.includes('_startup')
  );
  const manualBackups = allBackups.filter(b => 
    b.filename.includes('_manual') || b.filename.includes('_menu')
  );
  const crashBackups = allBackups.filter(b => b.filename.includes('_crash'));
  
  const totalSize = allBackups.reduce((sum, b) => sum + (b.size || 0), 0);
  
  return {
    running: backupInterval !== null,
    intervalMinutes: CONFIG.intervalMs / 60000,
    maxBackups: CONFIG.maxBackups,
    backupDir: fileStore ? fileStore.BACKUP_DIR : null,
    stats: {
      ...stats,
      totalBackups: allBackups.length,
      autoBackups: autoBackups.length,
      manualBackups: manualBackups.length,
      crashBackups: crashBackups.length,
      totalSize,
      totalSizeFormatted: formatSize(totalSize)
    },
    latestBackup: allBackups[0] || null,
    latestAutoBackup: autoBackups[0] || null
  };
}

/**
 * Update configuration
 */
function updateConfig(newConfig) {
  if (newConfig.intervalMs) CONFIG.intervalMs = newConfig.intervalMs;
  if (newConfig.maxBackups) CONFIG.maxBackups = newConfig.maxBackups;
  
  // Restart with new interval if running
  if (backupInterval && newConfig.intervalMs) {
    stop();
    backupInterval = setInterval(() => runBackup('scheduled'), CONFIG.intervalMs);
    console.log(`[AutoBackup] Interval updated to ${CONFIG.intervalMs / 60000} minutes`);
  }
}

/**
 * Format bytes into human-readable size
 */
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = {
  start,
  stop,
  runBackup,
  triggerEventBackup,
  emergencyBackup,
  cleanOldBackups,
  getStatus,
  updateConfig,
  CONFIG
};
