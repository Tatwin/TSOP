const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES } = require('../data/products');
const fileStore = require('../services/fileStore');
const auditService = require('../services/auditService');

// GET /api/daily-entry/range/:startDate/:endDate - Get entries for range (NO AUTH)
// MUST be before /:date to avoid route conflicts
router.get('/range/:startDate/:endDate', (req, res) => {
  const { startDate, endDate } = req.params;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = {};

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const data = fileStore.getNested('dailyEntries', dateStr);
    if (data) {
      results[dateStr] = data;
    }
    current.setDate(current.getDate() + 1);
  }

  res.json({ startDate, endDate, data: results });
});

// GET /api/daily-entry/:date - Get entries for a specific date (NO AUTH - view is free)
router.get('/:date', (req, res) => {
  const { date } = req.params;
  const data = fileStore.getNested('dailyEntries', date);

  res.json({
    date,
    entries: data?.entries || [],
    metadata: data?.metadata || {},
    invoices: data?.invoices || [],
    posAmount: data?.posAmount || 0,
    deviceValues: data?.deviceValues || {},
    staff: data?.staff || { salesmen: [], supervisors: [] },
    purchases: data?.purchases || {},
    stockReturns: data?.stockReturns || {}
  });
});

// GET /api/daily-entry/:date/opening-stock - Get opening stock (NO AUTH)
router.get('/:date/opening-stock', (req, res) => {
  const { date } = req.params;
  const currentDate = new Date(date);
  
  // First check if this date has manually saved opening stock
  const dayData = fileStore.getNested('dailyEntries', date);
  if (dayData?.openingStock) {
    return res.json({ date, openingStock: dayData.openingStock, purchases: dayData?.purchases || {} });
  }

  // Get holidays to skip them when looking back
  const holidays = fileStore.get('holidays') || {};

  // Look backwards for the most recent working day with data (skip holidays)
  let openingStock = {};
  for (let i = 1; i <= 60; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - i);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    // Skip holidays - they won't have valid closing stock
    if (holidays[prevDateStr]) continue;
    
    const prevData = fileStore.getNested('dailyEntries', prevDateStr);
    if (prevData?.entries?.length > 0) {
      prevData.entries.forEach(entry => {
        const category = CATEGORIES[entry.category];
        const caseSize = category ? category.bottlesPerCase : 48;
        const closingStock = (entry.cases || 0) * caseSize + (entry.bottles || 0);
        openingStock[entry.productId] = closingStock;
      });
      break;
    }
  }
  
  res.json({ date, openingStock, purchases: dayData?.purchases || {} });
});

// POST /api/daily-entry/:date - Save entries (AUTH REQUIRED)
router.post('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { entries, metadata, invoices, posAmount, deviceValues, staff } = req.body;

  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Entries array required' });
  }

  const existing = fileStore.getNested('dailyEntries', date) || {};
  const previousEntries = existing.entries || [];

  const updated = {
    ...existing,
    entries,
    metadata: metadata || {},
    invoices: invoices || existing.invoices || [],
    posAmount: posAmount || 0,
    deviceValues: deviceValues || {},
    staff: staff || existing.staff || {},
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.username || 'admin'
  };

  fileStore.setNested('dailyEntries', date, updated);

  // Audit log
  auditService.log({
    action: 'UPDATE',
    module: 'dailyEntry',
    user: req.user?.username || 'admin',
    description: `Daily entries saved for ${date} (${entries.length} products)`,
    previousValue: { entriesCount: previousEntries.length, posAmount: existing.posAmount },
    newValue: { entriesCount: entries.length, posAmount },
    metadata: { date }
  });

  res.json({ success: true, date, message: 'Daily entries saved successfully' });
});

// POST /api/daily-entry/:date/opening-stock - Save opening stock (AUTH REQUIRED)
router.post('/:date/opening-stock', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { openingStock } = req.body;

  if (!openingStock || typeof openingStock !== 'object') {
    return res.status(400).json({ error: 'openingStock object required' });
  }

  const existing = fileStore.getNested('dailyEntries', date) || { entries: [], metadata: {} };
  existing.openingStock = openingStock;
  existing.updatedAt = new Date().toISOString();

  if (existing.entries?.length > 0) {
    existing.entries = existing.entries.map(entry => ({
      ...entry,
      openingStock: openingStock[entry.productId] || entry.openingStock || 0
    }));
  }

  fileStore.setNested('dailyEntries', date, existing);

  auditService.log({
    action: 'UPDATE',
    module: 'dailyEntry',
    user: req.user?.username || 'admin',
    description: `Opening stock saved for ${date} (${Object.keys(openingStock).length} products)`,
    metadata: { date, productsCount: Object.keys(openingStock).length }
  });

  res.json({ success: true, date, message: 'Opening stock saved successfully' });
});

// POST /api/daily-entry/:date/purchases - Save invoices and apply purchases (AUTH REQUIRED)
router.post('/:date/purchases', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { invoices, purchases } = req.body;

  const existing = fileStore.getNested('dailyEntries', date) || { entries: [], metadata: {} };

  // Always save invoices
  existing.invoices = invoices || [];

  // Always save purchases map
  if (purchases) {
    existing.purchases = purchases;
  }

  // Apply purchases to entries if entries exist
  if (purchases && existing.entries?.length > 0) {
    existing.entries = existing.entries.map(entry => ({
      ...entry,
      purchase: (purchases[entry.productId] || 0) + (entry.purchase || 0)
    }));
  }

  existing.updatedAt = new Date().toISOString();
  fileStore.setNested('dailyEntries', date, existing);

  auditService.log({
    action: 'CREATE',
    module: 'dailyEntry',
    user: req.user?.username || 'admin',
    description: `Purchases saved for ${date} (${(invoices || []).length} invoices)`,
    metadata: { date, invoiceCount: (invoices || []).length }
  });

  res.json({ success: true, date, message: 'Purchases saved successfully', invoiceCount: (invoices || []).length });
});

// POST /api/daily-entry/:date/stock-return - Save stock return to depot (AUTH REQUIRED)
router.post('/:date/stock-return', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { stockReturns } = req.body;

  if (!stockReturns || typeof stockReturns !== 'object') {
    return res.status(400).json({ error: 'stockReturns object required' });
  }

  const existing = fileStore.getNested('dailyEntries', date) || { entries: [], metadata: {} };
  existing.stockReturns = stockReturns;

  // Apply stock returns to entries if entries exist
  if (existing.entries?.length > 0) {
    existing.entries = existing.entries.map(entry => ({
      ...entry,
      stockReturn: stockReturns[entry.productId] || entry.stockReturn || 0
    }));
  }

  existing.updatedAt = new Date().toISOString();
  fileStore.setNested('dailyEntries', date, existing);

  auditService.log({
    action: 'UPDATE',
    module: 'dailyEntry',
    user: req.user?.username || 'admin',
    description: `Stock returns saved for ${date}`,
    metadata: { date, productsReturned: Object.keys(stockReturns).length }
  });

  res.json({ success: true, date, message: 'Stock returns saved successfully' });
});

// PUT /api/daily-entry/:date/metadata - Update metadata (AUTH REQUIRED)
router.put('/:date/metadata', authMiddleware, (req, res) => {
  const { date } = req.params;
  const body = req.body;

  const existing = fileStore.getNested('dailyEntries', date) || { entries: [], metadata: {} };
  existing.metadata = { ...existing.metadata, ...body };
  fileStore.setNested('dailyEntries', date, existing);

  res.json({ success: true, metadata: existing.metadata });
});

module.exports = router;
