const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES } = require('../data/products');

// Shared reference to dailyEntry data (in production, use database)
// This is a simplified approach - in production these would query Firestore
const getDailyData = () => {
  try {
    // Access the in-memory store from the daily entry route
    return require('./dailyEntry').__dailyData || {};
  } catch {
    return {};
  }
};

// GET /api/dashboard/today - Today's summary
router.get('/today', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  res.json({
    date: today,
    totalSales: 0,
    totalPurchase: 0,
    totalClosingStockValue: 0,
    totalCashCollected: 0,
    message: 'Dashboard data - connect to database for live values'
  });
});

// GET /api/dashboard/monthly/:year/:month - Monthly summary
router.get('/monthly/:year/:month', authMiddleware, (req, res) => {
  const { year, month } = req.params;
  
  res.json({
    year: parseInt(year),
    month: parseInt(month),
    days: [],
    totals: {
      totalSales: 0,
      totalPurchase: 0,
      totalDays: 0
    }
  });
});

// GET /api/dashboard/product-history/:productId - Product sales history
router.get('/product-history/:productId', authMiddleware, (req, res) => {
  const { productId } = req.params;
  const { startDate, endDate } = req.query;

  res.json({
    productId,
    startDate,
    endDate,
    history: [],
    message: 'Product history - connect to database for live values'
  });
});

// GET /api/dashboard/low-stock - Low stock/no movement alerts
router.get('/low-stock', authMiddleware, (req, res) => {
  res.json({
    alerts: [],
    message: 'Low stock alerts - connect to database for live values'
  });
});

module.exports = router;
