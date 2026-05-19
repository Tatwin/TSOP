const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const fileStore = require('../services/fileStore');
const auditService = require('../services/auditService');

// GET /api/backup/list - List all backups
router.get('/list', requireRole('admin'), (req, res) => {
  const backups = fileStore.listBackups();
  res.json({ backups });
});

// POST /api/backup/create - Create a new backup
router.post('/create', requireRole('admin'), (req, res) => {
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
router.post('/restore', requireRole('admin'), (req, res) => {
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
    
    res.json({ success: true, message: `System restored from ${filename}` });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed', details: err.message });
  }
});

// GET /api/backup/download/:filename - Download a backup file
router.get('/download/:filename', requireRole('admin'), (req, res) => {
  const { filename } = req.params;
  const fs = require('fs');
  const path = require('path');
  const backupPath = path.join(fileStore.BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(backupPath);
});

// POST /api/backup/upload - Upload and restore from a backup file
router.post('/upload', requireRole('admin'), (req, res) => {
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

module.exports = router;
