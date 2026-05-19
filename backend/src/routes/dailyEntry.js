const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES } = require('../data/products');

// In-memory storage for daily entries
// Key: date string (YYYY-MM-DD), Value: { entries: [...], metadata: {...} }
const dailyData = {};

// GET /api/daily-entry/:date - Get entries for a specific date
router.get('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const data = dailyData[date];
  
  res.json({
    date,
    entries: data?.entries || [],
    metadata: data?.metadata || {},
    invoices: data?.invoices || [],
    posAmount: data?.posAmount || 0,
    deviceValues: data?.deviceValues || {}
  });
});

// POST /api/daily-entry/:date/opening-stock - Save opening stock data
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

  // Also update entries if they exist
  if (dailyData[date].entries?.length > 0) {
    dailyData[date].entries = dailyData[date].entries.map(entry => ({
      ...entry,
      openingStock: openingStock[entry.productId] || entry.openingStock || 0
    }));
  }

  res.json({
    success: true,
    date,
    message: 'Opening stock saved successfully'
  });
});

// GET /api/daily-entry/:date/opening-stock - Get opening stock (previous day's closing stock)
router.get('/:date/opening-stock', authMiddleware, (req, res) => {
  const { date } = req.params;
  const currentDate = new Date(date);
  
  // Look backwards for the most recent day with data
  let openingStock = {};
  for (let i = 1; i <= 31; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - i);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    if (dailyData[prevDateStr]?.entries?.length > 0) {
      // Found previous day's data - extract closing stock
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

// POST /api/daily-entry/:date - Save entries for a specific date
router.post('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { entries, metadata, invoices, posAmount, deviceValues } = req.body;

  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Entries array required' });
  }

  dailyData[date] = {
    entries,
    metadata: metadata || {},
    invoices: invoices || [],
    posAmount: posAmount || 0,
    deviceValues: deviceValues || {},
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.username
  };

  res.json({
    success: true,
    date,
    message: 'Daily entries saved successfully'
  });
});

// PUT /api/daily-entry/:date/metadata - Update metadata only
router.put('/:date/metadata', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { invoiceNo, invoiceDate, invoiceAmount } = req.body;

  if (!dailyData[date]) {
    dailyData[date] = { entries: [], metadata: {} };
  }

  dailyData[date].metadata = {
    ...dailyData[date].metadata,
    invoiceNo,
    invoiceDate,
    invoiceAmount
  };

  res.json({ success: true, metadata: dailyData[date].metadata });
});

// POST /api/daily-entry/:date/purchases - Save invoices and apply purchases
router.post('/:date/purchases', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { invoices, purchases } = req.body;

  if (!dailyData[date]) {
    dailyData[date] = { entries: [], metadata: {} };
  }

  dailyData[date].invoices = invoices || [];

  // Apply purchase quantities to entries
  if (purchases && dailyData[date].entries?.length > 0) {
    dailyData[date].entries = dailyData[date].entries.map(entry => ({
      ...entry,
      purchase: purchases[entry.productId] || entry.purchase || 0
    }));
  }

  dailyData[date].updatedAt = new Date().toISOString();

  res.json({
    success: true,
    date,
    message: 'Purchases saved successfully'
  });
});

// GET /api/daily-entry/range/:startDate/:endDate - Get entries for a date range
router.get('/range/:startDate/:endDate', authMiddleware, (req, res) => {
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

module.exports = router;
