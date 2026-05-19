const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authMiddleware, requireRole } = require('../middleware/auth');
const fileStore = require('../services/fileStore');
const auditService = require('../services/auditService');

// GET /api/backup/status - Get backup system status
router.get('/status', authMiddleware, (req, res) => {
  const backups = fileStore.listBackups();
  const autoBackups = backups.filter(b => 
    b.filename.includes('_auto') || b.filename.includes('_scheduled') || 
    b.filename.includes('_event') || b.filename.includes('_startup')
  );
  const manualBackups = backups.filter(b => b.filename.includes('_manual') || b.filename.includes('_menu'));
  const crashBackups = backups.filter(b => b.filename.includes('_crash'));
  const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);
  
  res.json({
    enabled: true,
    intervalMinutes: 30,
    maxBackups: 20,
    backupDir: fileStore.BACKUP_DIR,
    stats: {
      totalBackups: backups.length,
      autoBackups: autoBackups.length,
      manualBackups: manualBackups.length,
      crashBackups: crashBackups.length,
      totalSize,
      totalSizeFormatted: formatSize(totalSize)
    },
    latestBackup: backups[0] || null,
    latestAutoBackup: autoBackups[0] || null
  });
});

// GET /api/backup/list - List all backups
router.get('/list', authMiddleware, (req, res) => {
  const backups = fileStore.listBackups();
  res.json({ backups });
});

// POST /api/backup/create - Create a new backup
router.post('/create', authMiddleware, (req, res) => {
  const { label } = req.body;
  
  try {
    const backup = fileStore.createBackup(label || 'manual');
    
    auditService.log({
      action: 'BACKUP',
      module: 'backup',
      user: req.user?.username || 'admin',
      description: `Backup created: ${backup.filename}`,
      metadata: { filename: backup.filename, size: backup.size }
    });
    
    res.json({ success: true, backup });
  } catch (err) {
    res.status(500).json({ error: 'Backup creation failed', details: err.message });
  }
});

// POST /api/backup/restore - Restore from a backup
router.post('/restore', authMiddleware, (req, res) => {
  const { filename } = req.body;
  
  if (!filename) {
    return res.status(400).json({ error: 'Backup filename required' });
  }
  
  try {
    fileStore.restoreBackup(filename);
    
    auditService.log({
      action: 'RESTORE',
      module: 'backup',
      user: req.user?.username || 'admin',
      description: `System restored from backup: ${filename}`,
      metadata: { filename }
    });
    
    res.json({ success: true, message: `System restored from ${filename}. Please restart the application.` });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed', details: err.message });
  }
});

// GET /api/backup/download/:filename - Download a backup file
router.get('/download/:filename', authMiddleware, (req, res) => {
  const { filename } = req.params;
  const backupPath = path.join(fileStore.BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  const contentType = filename.endsWith('.db') 
    ? 'application/x-sqlite3' 
    : 'application/json';
  
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Type', contentType);
  res.sendFile(backupPath);
});

// DELETE /api/backup/:filename - Delete a specific backup
router.delete('/:filename', authMiddleware, (req, res) => {
  const { filename } = req.params;
  const backupPath = path.join(fileStore.BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  // Don't allow deleting crash-recovery backups
  if (filename.includes('crash-recovery')) {
    return res.status(403).json({ error: 'Cannot delete crash-recovery backups' });
  }
  
  try {
    fs.unlinkSync(backupPath);
    
    auditService.log({
      action: 'DELETE',
      module: 'backup',
      user: req.user?.username || 'admin',
      description: `Backup deleted: ${filename}`,
      metadata: { filename }
    });
    
    res.json({ success: true, message: `Backup ${filename} deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

// POST /api/backup/upload - Upload and restore from a backup file (JSON format)
router.post('/upload', authMiddleware, (req, res) => {
  const { data } = req.body;
  
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Valid backup data object required' });
  }
  
  try {
    // Create a safety backup first
    fileStore.createBackup('pre-upload-restore');
    
    // Validate the uploaded data has expected structure
    const requiredKeys = ['dailyEntries', 'denominations'];
    const hasRequired = requiredKeys.some(k => data[k] !== undefined);
    if (!hasRequired) {
      return res.status(400).json({ error: 'Invalid backup format - missing required data sections' });
    }
    
    // Merge with defaults and write
    const restored = { ...fileStore.DEFAULT_STORE, ...data };
    fileStore.writeStore(restored);
    fileStore.invalidateCache();
    
    auditService.log({
      action: 'RESTORE',
      module: 'backup',
      user: req.user?.username || 'admin',
      description: 'System restored from uploaded backup file',
      metadata: { keys: Object.keys(data) }
    });
    
    res.json({ success: true, message: 'System restored from uploaded backup' });
  } catch (err) {
    res.status(500).json({ error: 'Upload restore failed', details: err.message });
  }
});

// POST /api/backup/cleanup - Manually trigger backup cleanup
router.post('/cleanup', authMiddleware, (req, res) => {
  try {
    const { maxKeep } = req.body;
    const limit = Number(maxKeep) || 20;
    
    const backups = fileStore.listBackups();
    const autoBackups = backups.filter(b => 
      b.filename.includes('_auto') || b.filename.includes('_scheduled') || 
      b.filename.includes('_event') || b.filename.includes('_startup')
    );
    
    let cleaned = 0;
    if (autoBackups.length > limit) {
      const toDelete = autoBackups.slice(limit);
      toDelete.forEach(b => {
        const filePath = path.join(fileStore.BACKUP_DIR, b.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      });
    }
    
    res.json({ success: true, cleaned, remaining: autoBackups.length - cleaned });
  } catch (err) {
    res.status(500).json({ error: 'Cleanup failed', details: err.message });
  }
});

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = router;
