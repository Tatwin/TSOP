const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES } = require('../data/products');
const fileStore = require('../config/fileStore');

// IMPORTANT: Static/specific routes MUST come before parameterized /:date routes

// GET /api/daily-entry/range/:startDate/:endDate - Get entries for date range (NO AUTH)
router.get('/range/:startDate/:endDate', (req, res) => {
  const { startDate, endDate } = req.params;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = {};

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const data = fileStore.getDailyEntry(dateStr);
    if (data) {
      results[dateStr] = data;
    }
    current.setDate(current.getDate() + 1);
  }

  res.json({ startDate, endDate, data: results });
});

// GET /api/daily-entry/:date/opening-stock - Get opening stock (NO AUTH)
router.get('/:date/opening-stock', (req, res) => {
  const { date } = req.params;
  const currentDate = new Date(date);
  const data = fileStore.getDailyEntry(date);

  // First check if this date has manually saved opening stock
  if (data?.openingStock) {
    return res.json({ date, openingStock: data.openingStock, purchases: data?.purchases || {} });
  }

  // Look backwards for the most recent day with data
  let openingStock = {};
  for (let i = 1; i <= 31; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - i);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    const prevData = fileStore.getDailyEntry(prevDateStr);
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

  res.json({ date, openingStock, purchases: data?.purchases || {} });
});

// GET /api/daily-entry/:date - Get entries for a specific date (NO AUTH - view is free)
router.get('/:date', (req, res) => {
  const { date } = req.params;
  const data = fileStore.getDailyEntry(date);

  res.json({
    date,
    entries: data?.entries || [],
    metadata: data?.metadata || {},
    invoices: data?.invoices || [],
    posAmount: data?.posAmount || 0,
    deviceValues: data?.deviceValues || {},
    staff: data?.staff || { salesmen: [], supervisors: [] },
    purchases: data?.purchases || {}
  });
});

// POST /api/daily-entry/:date - Save entries (AUTH REQUIRED)
router.post('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { entries, metadata, invoices, posAmount, deviceValues, staff } = req.body;

  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Entries array required' });
  }

  const existing = fileStore.getDailyEntry(date) || {};

  fileStore.setDailyEntry(date, {
    ...existing,
    entries,
    metadata: metadata || {},
    invoices: invoices || existing.invoices || [],
    posAmount: posAmount || 0,
    deviceValues: deviceValues || {},
    staff: staff || existing.staff || {},
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.username || 'admin'
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

  const existing = fileStore.getDailyEntry(date) || { entries: [], metadata: {} };
  existing.openingStock = openingStock;
  existing.updatedAt = new Date().toISOString();

  if (existing.entries?.length > 0) {
    existing.entries = existing.entries.map(entry => ({
      ...entry,
      openingStock: openingStock[entry.productId] || entry.openingStock || 0
    }));
  }

  fileStore.setDailyEntry(date, existing);
  res.json({ success: true, date, message: 'Opening stock saved successfully' });
});

// POST /api/daily-entry/:date/purchases - Save invoices and apply purchases (AUTH REQUIRED)
router.post('/:date/purchases', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { invoices, purchases } = req.body;

  const existing = fileStore.getDailyEntry(date) || { entries: [], metadata: {} };

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
  fileStore.setDailyEntry(date, existing);
  res.json({ success: true, date, message: 'Purchases saved successfully', invoiceCount: (invoices || []).length });
});

// PUT /api/daily-entry/:date/metadata - Update metadata (AUTH REQUIRED)
router.put('/:date/metadata', authMiddleware, (req, res) => {
  const { date } = req.params;
  const body = req.body;

  const existing = fileStore.getDailyEntry(date) || { entries: [], metadata: {} };
  existing.metadata = { ...existing.metadata, ...body };
  fileStore.setDailyEntry(date, existing);
  res.json({ success: true, metadata: existing.metadata });
});

module.exports = router;
