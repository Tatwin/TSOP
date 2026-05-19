const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// In-memory denomination storage
const denominations = {};

const DENOMINATION_NOTES = [500, 200, 100, 50, 20, 10];

// GET /api/denomination/:date - Get denomination for a date (NO AUTH - view is free)
router.get('/:date', (req, res) => {
  const { date } = req.params;
  const data = denominations[date];

  res.json({
    date,
    denomination: data || {
      notes: DENOMINATION_NOTES.reduce((acc, note) => {
        acc[note] = { count: 0, value: 0 };
        return acc;
      }, {}),
      coins: 0,
      totalCash: 0
    }
  });
});

// POST /api/denomination/:date - Save denomination for a date
router.post('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const { notes, coins } = req.body;

  // Calculate total
  let totalCash = coins || 0;
  DENOMINATION_NOTES.forEach(note => {
    const count = notes?.[note]?.count || 0;
    totalCash += count * note;
  });

  denominations[date] = {
    notes: DENOMINATION_NOTES.reduce((acc, note) => {
      const count = notes?.[note]?.count || 0;
      acc[note] = { count, value: count * note };
      return acc;
    }, {}),
    coins: coins || 0,
    totalCash,
    updatedAt: new Date().toISOString()
  };

  res.json({ success: true, denomination: denominations[date] });
});

module.exports = router;
