const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const auditService = require('../services/auditService');

// GET /api/audit/logs - Get audit logs with filtering
router.get('/logs', (req, res) => {
  const { module, user, action, startDate, endDate, limit, offset } = req.query;
  
  const result = auditService.getLogs({
    module,
    user,
    action,
    startDate,
    endDate,
    limit: Number(limit) || 50,
    offset: Number(offset) || 0
  });
  
  res.json(result);
});

// GET /api/audit/logs/modules - Get available modules for filtering
router.get('/logs/modules', (req, res) => {
  res.json({
    modules: ['dailyEntry', 'denomination', 'products', 'staff', 'auth', 'export', 'backup'],
    actions: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'BACKUP', 'RESTORE']
  });
});

// GET /api/audit/stock-history/:productId - Get stock movement history
router.get('/stock-history/:productId', (req, res) => {
  const { productId } = req.params;
  const { limit } = req.query;
  
  const history = auditService.getStockHistory(productId, Number(limit) || 30);
  res.json({ productId, history });
});

module.exports = router;
