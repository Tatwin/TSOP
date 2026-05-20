const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const fileStore = require('../services/fileStore');
const auditService = require('../services/auditService');

// Helper: get holidays object { "YYYY-MM-DD": { reason, markedBy, markedAt } }
function getHolidays() {
  const stored = fileStore.get('holidays');
  if (stored && typeof stored === 'object') return stored;
  return {};
}

// GET /api/holidays - Get all holidays
router.get('/', (req, res) => {
  res.json({ holidays: getHolidays() });
});

// GET /api/holidays/check/:date - Check if a specific date is a holiday
// MUST be before /:year/:month to avoid route conflict
router.get('/check/:date', (req, res) => {
  const { date } = req.params;
  const holidays = getHolidays();
  const isHoliday = !!holidays[date];
  res.json({ date, isHoliday, holiday: holidays[date] || null });
});

// GET /api/holidays/:year/:month - Get holidays for a specific month
router.get('/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const holidays = getHolidays();
  const prefix = `${year}-${month.padStart(2, '0')}`;
  const monthHolidays = {};
  Object.entries(holidays).forEach(([date, info]) => {
    if (date.startsWith(prefix)) {
      monthHolidays[date] = info;
    }
  });
  res.json({ holidays: monthHolidays });
});

// POST /api/holidays - Mark a date as holiday
router.post('/', authMiddleware, (req, res) => {
  const { date, reason } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const holidays = getHolidays();
  if (holidays[date]) {
    return res.status(409).json({ error: 'This date is already marked as a holiday' });
  }

  holidays[date] = {
    reason: reason || 'Government Holiday',
    markedBy: req.user?.username || 'admin',
    markedAt: new Date().toISOString()
  };

  fileStore.set('holidays', holidays);

  auditService.log({
    action: 'CREATE',
    module: 'holidays',
    user: req.user?.username || 'admin',
    description: `Holiday marked: ${date} - ${holidays[date].reason}`,
    newValue: { date, ...holidays[date] }
  });

  res.json({ success: true, date, holiday: holidays[date] });
});

// DELETE /api/holidays/:date - Remove holiday marking
router.delete('/:date', authMiddleware, (req, res) => {
  const { date } = req.params;
  const holidays = getHolidays();

  if (!holidays[date]) {
    return res.status(404).json({ error: 'Holiday not found for this date' });
  }

  const removed = holidays[date];
  delete holidays[date];
  fileStore.set('holidays', holidays);

  auditService.log({
    action: 'DELETE',
    module: 'holidays',
    user: req.user?.username || 'admin',
    description: `Holiday removed: ${date} - ${removed.reason}`,
    previousValue: { date, ...removed }
  });

  res.json({ success: true, date, removed });
});

module.exports = router;
