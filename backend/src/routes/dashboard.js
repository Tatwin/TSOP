const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CATEGORIES, DEFAULT_PRODUCTS } = require('../data/products');
const fileStore = require('../services/fileStore');

// Helper: calculate totals for a day's entries
function calcDayTotals(dayData) {
  if (!dayData?.entries?.length) return { totalSales: 0, totalPurchase: 0, totalClValue: 0, totalOpValue: 0, totalBottlesSold: 0, totalClosingBottles: 0 };
  
  let totalSales = 0, totalPurchase = 0, totalClValue = 0, totalOpValue = 0, totalBottlesSold = 0, totalClosingBottles = 0;
  
  dayData.entries.forEach(e => {
    const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
    const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
    const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
    const sales = total - clst;
    const rate = e.rate || 0;
    
    totalSales += sales > 0 ? sales * rate : 0;
    totalPurchase += (e.purchase || 0) * rate;
    totalClValue += clst * rate;
    totalOpValue += (e.openingStock || 0) * rate;
    if (sales > 0) totalBottlesSold += sales;
    totalClosingBottles += clst;
  });
  
  return { totalSales, totalPurchase, totalClValue, totalOpValue, totalBottlesSold, totalClosingBottles };
}

// GET /api/dashboard/today - Today's summary
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const dayData = fileStore.getNested('dailyEntries', today);
  const denomData = fileStore.getNested('denominations', today);
  const totals = calcDayTotals(dayData);
  
  res.json({
    date: today,
    ...totals,
    totalCash: denomData?.totalCash || 0,
    posAmount: dayData?.posAmount || 0,
    entriesCount: dayData?.entries?.length || 0,
    lastUpdated: dayData?.updatedAt || null
  });
});

// GET /api/dashboard/summary/:date - Summary for a specific date
router.get('/summary/:date', (req, res) => {
  const { date } = req.params;
  const dayData = fileStore.getNested('dailyEntries', date);
  const denomData = fileStore.getNested('denominations', date);
  const totals = calcDayTotals(dayData);
  
  res.json({
    date,
    ...totals,
    totalCash: denomData?.totalCash || 0,
    posAmount: dayData?.posAmount || 0,
    entriesCount: dayData?.entries?.length || 0,
    lastUpdated: dayData?.updatedAt || null
  });
});

// GET /api/dashboard/monthly/:year/:month - Monthly summary
router.get('/monthly/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const endDay = new Date(Number(year), Number(month), 0).getDate();
  
  const days = [];
  let totalSales = 0, totalPurchase = 0, totalDays = 0;
  
  for (let d = 1; d <= endDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = fileStore.getNested('dailyEntries', dateStr);
    
    if (dayData?.entries?.length > 0) {
      const totals = calcDayTotals(dayData);
      days.push({ date: dateStr, ...totals });
      totalSales += totals.totalSales;
      totalPurchase += totals.totalPurchase;
      totalDays++;
    }
  }
  
  res.json({
    year: parseInt(year),
    month: parseInt(month),
    days,
    totals: { totalSales, totalPurchase, totalDays, avgDaily: totalDays > 0 ? Math.round(totalSales / totalDays) : 0 }
  });
});

// GET /api/dashboard/analytics - Advanced analytics (last N days)
router.get('/analytics', (req, res) => {
  const { days: daysParam } = req.query;
  const numDays = Number(daysParam) || 30;
  const today = new Date();
  
  const dailySales = [];
  const categoryTotals = {};
  const productTotals = {};
  let totalRevenue = 0;
  let daysWithData = 0;
  
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = fileStore.getNested('dailyEntries', dateStr);
    
    if (dayData?.entries?.length > 0) {
      const totals = calcDayTotals(dayData);
      dailySales.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        totalSales: totals.totalSales,
        totalBottlesSold: totals.totalBottlesSold,
        totalPurchase: totals.totalPurchase
      });
      totalRevenue += totals.totalSales;
      daysWithData++;
      
      // Category and product aggregation
      dayData.entries.forEach(e => {
        const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
        const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
        const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
        const sales = total - clst;
        const rate = e.rate || 0;
        const salesAmt = sales > 0 ? sales * rate : 0;
        
        // Category totals
        if (!categoryTotals[e.category]) {
          categoryTotals[e.category] = { label: CATEGORIES[e.category]?.label || e.category, totalSales: 0, totalBottles: 0 };
        }
        categoryTotals[e.category].totalSales += salesAmt;
        if (sales > 0) categoryTotals[e.category].totalBottles += sales;
        
        // Product totals
        if (salesAmt > 0) {
          if (!productTotals[e.productId]) {
            productTotals[e.productId] = { productId: e.productId, particular: e.particular, category: e.category, totalSales: 0, totalBottles: 0, rate };
          }
          productTotals[e.productId].totalSales += salesAmt;
          productTotals[e.productId].totalBottles += sales;
        }
      });
    } else {
      dailySales.push({ date: dateStr, dayName: d.toLocaleDateString('en-US', { weekday: 'short' }), totalSales: 0, totalBottlesSold: 0, totalPurchase: 0 });
    }
  }
  
  // Top 10 products
  const topProducts = Object.values(productTotals)
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 10);
  
  // Category breakdown sorted
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([key, val]) => ({ key, ...val, percentage: totalRevenue > 0 ? ((val.totalSales / totalRevenue) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.totalSales - a.totalSales);
  
  // Top 5 sales days
  const topDays = dailySales
    .filter(d => d.totalSales > 0)
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 5)
    .map((d, idx) => ({
      rank: idx + 1,
      date: d.date,
      dayName: new Date(d.date).toLocaleDateString('en-US', { weekday: 'long' }),
      totalSales: d.totalSales,
      totalBottles: d.totalBottlesSold
    }));
  
  // Products not sold in period
  const soldProductIds = new Set(Object.keys(productTotals));
  const notSold = DEFAULT_PRODUCTS
    .filter(p => !soldProductIds.has(p.id))
    .slice(0, 30)
    .map(p => ({ productId: p.id, particular: p.particular, category: p.category, codeNo: p.codeNo }));
  
  res.json({
    period: { days: numDays, daysWithData, startDate: dailySales[0]?.date, endDate: dailySales[dailySales.length - 1]?.date },
    totalRevenue,
    avgDaily: daysWithData > 0 ? Math.round(totalRevenue / daysWithData) : 0,
    dailySales,
    topProducts,
    topDays,
    categoryBreakdown,
    notSold
  });
});

// GET /api/dashboard/top-days - Top 5 highest sales days by month/year
router.get('/top-days', (req, res) => {
  const { year, month } = req.query;
  const allEntries = fileStore.get('dailyEntries') || {};
  
  let filteredDates = Object.keys(allEntries);
  
  if (year) {
    filteredDates = filteredDates.filter(d => d.startsWith(year));
  }
  if (month) {
    const monthStr = String(month).padStart(2, '0');
    filteredDates = filteredDates.filter(d => d.substring(5, 7) === monthStr);
  }
  
  const daySales = filteredDates
    .map(date => {
      const dayData = allEntries[date];
      if (!dayData?.entries?.length) return null;
      const totals = calcDayTotals(dayData);
      return {
        date,
        dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
        totalSales: totals.totalSales,
        totalBottles: totals.totalBottlesSold,
        entriesCount: dayData.entries.length
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 5)
    .map((d, idx) => ({ rank: idx + 1, ...d }));
  
  res.json({ topDays: daySales, year: year || 'all', month: month || 'all' });
});

// GET /api/dashboard/low-stock - Low stock/no movement alerts
router.get('/low-stock', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const dayData = fileStore.getNested('dailyEntries', today);
  
  const alerts = [];
  if (dayData?.entries) {
    dayData.entries.forEach(e => {
      const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
      const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
      // Alert if closing stock is less than half a case
      if (clst > 0 && clst < caseSize / 2) {
        alerts.push({
          productId: e.productId,
          particular: e.particular,
          category: e.category,
          closingStock: clst,
          caseSize,
          severity: clst === 0 ? 'critical' : 'warning'
        });
      }
    });
  }
  
  res.json({ alerts, date: today });
});

// GET /api/dashboard/comparison - Today vs yesterday, this week vs last week
router.get('/comparison', (req, res) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const todayData = fileStore.getNested('dailyEntries', todayStr);
  const yesterdayData = fileStore.getNested('dailyEntries', yesterdayStr);
  
  const todayTotals = calcDayTotals(todayData);
  const yesterdayTotals = calcDayTotals(yesterdayData);
  
  // This week (Mon-today) vs last week (Mon-Sun)
  const dayOfWeek = today.getDay() || 7; // Convert Sunday=0 to 7
  let thisWeekSales = 0, lastWeekSales = 0;
  let thisWeekDays = 0, lastWeekDays = 0;
  
  for (let i = 0; i < 7; i++) {
    // This week
    if (i < dayOfWeek) {
      const d = new Date(today);
      d.setDate(d.getDate() - (dayOfWeek - 1 - i));
      const dateStr = d.toISOString().split('T')[0];
      const data = fileStore.getNested('dailyEntries', dateStr);
      if (data?.entries?.length) {
        thisWeekSales += calcDayTotals(data).totalSales;
        thisWeekDays++;
      }
    }
    // Last week
    const ld = new Date(today);
    ld.setDate(ld.getDate() - dayOfWeek - 6 + i);
    const ldStr = ld.toISOString().split('T')[0];
    const lData = fileStore.getNested('dailyEntries', ldStr);
    if (lData?.entries?.length) {
      lastWeekSales += calcDayTotals(lData).totalSales;
      lastWeekDays++;
    }
  }
  
  // This month vs last month (same number of days)
  const dayOfMonth = today.getDate();
  let thisMonthSales = 0, lastMonthSales = 0;
  let thisMonthDays = 0, lastMonthDays = 0;
  
  for (let i = 1; i <= dayOfMonth; i++) {
    const thisDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const thisData = fileStore.getNested('dailyEntries', thisDate);
    if (thisData?.entries?.length) {
      thisMonthSales += calcDayTotals(thisData).totalSales;
      thisMonthDays++;
    }
    
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, i);
    const lastDate = lastMonth.toISOString().split('T')[0];
    const lastData = fileStore.getNested('dailyEntries', lastDate);
    if (lastData?.entries?.length) {
      lastMonthSales += calcDayTotals(lastData).totalSales;
      lastMonthDays++;
    }
  }
  
  const calcGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number(((current - previous) / previous * 100).toFixed(1));
  };
  
  res.json({
    today: { date: todayStr, ...todayTotals },
    yesterday: { date: yesterdayStr, ...yesterdayTotals },
    dailyGrowth: calcGrowth(todayTotals.totalSales, yesterdayTotals.totalSales),
    thisWeek: { sales: thisWeekSales, days: thisWeekDays },
    lastWeek: { sales: lastWeekSales, days: lastWeekDays },
    weeklyGrowth: calcGrowth(thisWeekSales, lastWeekSales),
    thisMonth: { sales: thisMonthSales, days: thisMonthDays },
    lastMonth: { sales: lastMonthSales, days: lastMonthDays },
    monthlyGrowth: calcGrowth(thisMonthSales, lastMonthSales)
  });
});

// GET /api/dashboard/inventory-intelligence - Reorder suggestions, anomaly detection
router.get('/inventory-intelligence', (req, res) => {
  const today = new Date();
  const allEntries = fileStore.get('dailyEntries') || {};
  
  // Get last 14 days of data for pattern analysis
  const recentDays = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (allEntries[dateStr]?.entries?.length) {
      recentDays.push({ date: dateStr, entries: allEntries[dateStr].entries });
    }
  }
  
  // Product-level analysis
  const productAnalysis = {};
  
  recentDays.forEach(day => {
    day.entries.forEach(e => {
      if (!productAnalysis[e.productId]) {
        productAnalysis[e.productId] = {
          productId: e.productId,
          particular: e.particular,
          category: e.category,
          rate: e.rate || 0,
          dailySales: [],
          lastClosingStock: 0,
          totalPurchase: 0
        };
      }
      const pa = productAnalysis[e.productId];
      const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
      const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
      const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
      const sales = total - clst;
      pa.dailySales.push(sales > 0 ? sales : 0);
      pa.lastClosingStock = clst;
      pa.totalPurchase += (e.purchase || 0);
    });
  });
  
  // Calculate metrics per product
  const reorderSuggestions = [];
  const fastMoving = [];
  const deadStock = [];
  const anomalies = [];
  
  Object.values(productAnalysis).forEach(pa => {
    const avgDailySales = pa.dailySales.length > 0 
      ? pa.dailySales.reduce((s, v) => s + v, 0) / pa.dailySales.length 
      : 0;
    const daysOfStock = avgDailySales > 0 ? Math.round(pa.lastClosingStock / avgDailySales) : 999;
    
    // Reorder suggestion: less than 3 days of stock and has recent sales
    if (avgDailySales > 0 && daysOfStock < 3) {
      reorderSuggestions.push({
        ...pa,
        avgDailySales: Math.round(avgDailySales * 10) / 10,
        daysOfStock,
        suggestedReorder: Math.ceil(avgDailySales * 7), // 1 week supply
        urgency: daysOfStock === 0 ? 'critical' : daysOfStock === 1 ? 'high' : 'medium'
      });
    }
    
    // Fast moving: sells more than 5/day average
    if (avgDailySales >= 5) {
      fastMoving.push({ productId: pa.productId, particular: pa.particular, category: pa.category, avgDailySales: Math.round(avgDailySales * 10) / 10, rate: pa.rate });
    }
    
    // Dead stock: has stock but no sales in 14 days
    if (pa.lastClosingStock > 0 && pa.dailySales.every(s => s === 0)) {
      deadStock.push({ productId: pa.productId, particular: pa.particular, category: pa.category, closingStock: pa.lastClosingStock, stockValue: pa.lastClosingStock * pa.rate });
    }
    
    // Anomaly: sudden spike (last day > 3x average)
    if (pa.dailySales.length >= 3) {
      const lastSale = pa.dailySales[pa.dailySales.length - 1];
      const prevAvg = pa.dailySales.slice(0, -1).reduce((s, v) => s + v, 0) / (pa.dailySales.length - 1);
      if (prevAvg > 0 && lastSale > prevAvg * 3) {
        anomalies.push({ productId: pa.productId, particular: pa.particular, category: pa.category, lastDaySales: lastSale, avgSales: Math.round(prevAvg * 10) / 10, spikeRatio: Math.round(lastSale / prevAvg * 10) / 10 });
      }
    }
  });
  
  // Sort reorder suggestions by urgency
  reorderSuggestions.sort((a, b) => a.daysOfStock - b.daysOfStock);
  fastMoving.sort((a, b) => b.avgDailySales - a.avgDailySales);
  deadStock.sort((a, b) => b.stockValue - a.stockValue);
  
  res.json({
    analysisWindow: `${recentDays.length} days`,
    reorderSuggestions: reorderSuggestions.slice(0, 20),
    fastMoving: fastMoving.slice(0, 15),
    deadStock: deadStock.slice(0, 20),
    anomalies: anomalies.slice(0, 10),
    summary: {
      totalProductsAnalyzed: Object.keys(productAnalysis).length,
      needsReorder: reorderSuggestions.length,
      fastMovingCount: fastMoving.length,
      deadStockCount: deadStock.length,
      anomalyCount: anomalies.length
    }
  });
});

// GET /api/dashboard/product-history/:productId - Product sales history
router.get('/product-history/:productId', (req, res) => {
  const { productId } = req.params;
  const { days: daysParam } = req.query;
  const numDays = Number(daysParam) || 30;
  const today = new Date();
  
  const history = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = fileStore.getNested('dailyEntries', dateStr);
    
    if (dayData?.entries) {
      const entry = dayData.entries.find(e => e.productId === productId);
      if (entry) {
        const caseSize = CATEGORIES[entry.category]?.bottlesPerCase || 48;
        const clst = (entry.cases || 0) * caseSize + (entry.bottles || 0);
        const total = (entry.openingStock || 0) + (entry.purchase || 0) - (entry.stockReturn || 0);
        const sales = total - clst;
        history.push({
          date: dateStr,
          openingStock: entry.openingStock || 0,
          purchase: entry.purchase || 0,
          closingStock: clst,
          sales: sales > 0 ? sales : 0,
          salesValue: sales > 0 ? sales * (entry.rate || 0) : 0
        });
      }
    }
  }
  
  res.json({ productId, history, days: numDays });
});

module.exports = router;
