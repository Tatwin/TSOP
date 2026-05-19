const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES } = require('../data/products');
const fileStore = require('../config/fileStore');

// Helper: get effective today using LOCAL timezone (yesterday if 12AM-4AM)
function getEffectiveToday() {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 0 && hour < 4) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/dashboard/today - Today's summary (NO AUTH)
router.get('/today', (req, res) => {
  const today = getEffectiveToday();
  const data = fileStore.getDailyEntry(today);
  const denomData = fileStore.getDenomination(today);

  let totalSales = 0, totalPurchase = 0, totalClValue = 0;
  if (data?.entries?.length > 0) {
    data.entries.forEach(e => {
      totalSales += e.salesAmt || 0;
      totalPurchase += e.purchaseValue || 0;
      totalClValue += e.clValue || 0;
    });
  }

  res.json({
    date: today,
    totalSales,
    totalPurchase,
    totalClosingStockValue: totalClValue,
    totalCashCollected: denomData?.totalCash || 0,
    entriesCount: data?.entries?.length || 0
  });
});

// GET /api/dashboard/monthly/:year/:month - Monthly summary (NO AUTH)
router.get('/monthly/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  let monthTotalSales = 0, monthTotalPurchase = 0, daysWithData = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = fileStore.getDailyEntry(dateStr);

    if (data?.entries?.length > 0) {
      let daySales = 0, dayPurchase = 0, dayClValue = 0;
      data.entries.forEach(e => {
        daySales += e.salesAmt || 0;
        dayPurchase += e.purchaseValue || 0;
        dayClValue += e.clValue || 0;
      });

      days.push({ date: dateStr, totalSales: daySales, totalPurchase: dayPurchase, totalClValue: dayClValue });
      monthTotalSales += daySales;
      monthTotalPurchase += dayPurchase;
      daysWithData++;
    }
  }

  res.json({
    year: parseInt(year),
    month: parseInt(month),
    days,
    totals: { totalSales: monthTotalSales, totalPurchase: monthTotalPurchase, totalDays: daysWithData }
  });
});

// GET /api/dashboard/product-history/:productId - Product sales history (NO AUTH)
router.get('/product-history/:productId', (req, res) => {
  const { productId } = req.params;
  const { startDate, endDate } = req.query;
  const allEntries = fileStore.getAllDailyEntries();
  const history = [];

  Object.entries(allEntries).forEach(([date, dayData]) => {
    if (startDate && date < startDate) return;
    if (endDate && date > endDate) return;

    const entry = dayData.entries?.find(e => e.productId === productId);
    if (entry) {
      history.push({
        date,
        sales: entry.sales || 0,
        salesAmt: entry.salesAmt || 0,
        openingStock: entry.openingStock || 0,
        closingStock: entry.clst || 0,
        purchase: entry.purchase || 0
      });
    }
  });

  history.sort((a, b) => a.date.localeCompare(b.date));
  res.json({ productId, startDate, endDate, history });
});

// GET /api/dashboard/low-stock - Low stock alerts (NO AUTH)
router.get('/low-stock', (req, res) => {
  const today = getEffectiveToday();
  const data = fileStore.getDailyEntry(today);
  const alerts = [];

  if (data?.entries?.length > 0) {
    data.entries.forEach(entry => {
      const category = CATEGORIES[entry.category];
      const caseSize = category ? category.bottlesPerCase : 48;
      const closingStock = (entry.cases || 0) * caseSize + (entry.bottles || 0);

      if (closingStock <= 5 && closingStock >= 0) {
        alerts.push({
          productId: entry.productId,
          particular: entry.particular,
          category: entry.category,
          closingStock,
          type: closingStock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
        });
      }
    });
  }

  res.json({ alerts });
});

module.exports = router;
