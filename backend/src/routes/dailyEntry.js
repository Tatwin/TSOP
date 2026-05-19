const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES } = require('../data/products');

// In-memory storage for daily entries
const dailyData = {};

// GET /api/daily-entry/:date - Get entries for a specific date (NO AUTH - view is free)
router.get('/:date', (req, res) => {
  const { date } = req.params;
  const data = dailyData[date];
  
  res.json({
    date,
    entries: data?.entries || [],
    metadata: data?.metadata || {},
    invoices: data?.invoices || [],
    posAmount: data?.posAmount || 0,
    deviceValues: data?.deviceValues || {},
    staff: data?.staff || { salesmen: [], supervisors: [] }
  });
});

// GET /api/daily-entry/:date/opening-stock - Get opening stock (NO AUTH)
router.get('/:date/opening-stock', (req, res) => {
  const { date } = req.params;
  const currentDate = new Date(date);
  
  // First check if this date has manually saved opening stock
  if (dailyData[date]?.openingStock) {
    return res.json({ date, openingStock: dailyData[date].openingStock });
  }

  // Look backwards for the most recent day with data
  let openingStock = {};
  for (let i = 1; i <= 31; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - i);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    if (dailyData[prevDateStr]?.entries?.length > 0) {
      dailyData[prevDateStr].entries.forEach(entry => {
        const category = CATEGORIES[entry.category];
        const caseSize = category ? category.bottlesPerCase : 48;
        const closingStock = (entry.cases || 0) * caseSize + (entry.bottles || 0);
        openingStock[entry.productId] = closingStock;
      });
      break;
    }
  }
  
  res.json({ date, openingStock });
});

// GET /api/daily-entry/range/:startDate/:endDate - Get entries for range (NO AUTH)
router.get('/range/:startDate/:endDate', (req, res) => {
  const { startDate, endDate } = req.params;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = {};

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (dailyData[dateStr]) {
      results[dateStr] = dailyData[dateStr];
    }
    current.setDate(current.getDate() + 1);
  }

  res.json({ startDate, endDate, data: results });
});

// POST /api/daily-entry/:date - Save entries (AUTH REQUIRED)
router.post('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { entries, metadata, invoices, posAmount, deviceValues, staff } = req.body;

  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Entries array required' });
  }

  dailyData[date] = {
    ...dailyData[date],
    entries,
    metadata: metadata || {},
    invoices: invoices || dailyData[date]?.invoices || [],
    posAmount: posAmount || 0,
    deviceValues: deviceValues || {},
    staff: staff || dailyData[date]?.staff || {},
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.username || 'admin'
  };

  res.json({ success: true, date, message: 'Daily entries saved successfully' });
});

// POST /api/daily-entry/:date/opening-stock - Save opening stock (AUTH REQUIRED)
router.post('/:date/opening-stock', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { openingStock } = req.body;

  if (!openingStock || typeof openingStock !== 'object') {
    return res.status(400).json({ error: 'openingStock object required' });
  }

  if (!dailyData[date]) {
    dailyData[date] = { entries: [], metadata: {} };
  }

  dailyData[date].openingStock = openingStock;
  dailyData[date].updatedAt = new Date().toISOString();

  if (dailyData[date].entries?.length > 0) {
    dailyData[date].entries = dailyData[date].entries.map(entry => ({
      ...entry,
      openingStock: openingStock[entry.productId] || entry.openingStock || 0
    }));
  }

  res.json({ success: true, date, message: 'Opening stock saved successfully' });
});

// POST /api/daily-entry/:date/purchases - Save invoices and apply purchases (AUTH REQUIRED)
router.post('/:date/purchases', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { invoices, purchases } = req.body;

  if (!dailyData[date]) {
    dailyData[date] = { entries: [], metadata: {} };
  }

  dailyData[date].invoices = invoices || [];

  if (purchases && dailyData[date].entries?.length > 0) {
    dailyData[date].entries = dailyData[date].entries.map(entry => ({
      ...entry,
      purchase: purchases[entry.productId] || entry.purchase || 0
    }));
  }

  dailyData[date].updatedAt = new Date().toISOString();
  res.json({ success: true, date, message: 'Purchases saved successfully' });
});

// PUT /api/daily-entry/:date/metadata - Update metadata (AUTH REQUIRED)
router.put('/:date/metadata', authMiddleware, (req, res) => {
  const { date } = req.params;
  const body = req.body;

  if (!dailyData[date]) {
    dailyData[date] = { entries: [], metadata: {} };
  }

  dailyData[date].metadata = { ...dailyData[date].metadata, ...body };
  res.json({ success: true, metadata: dailyData[date].metadata });
});

module.exports = router;
