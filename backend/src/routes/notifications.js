const express = require('express');
const router = express.Router();
const { CATEGORIES } = require('../data/products');
const fileStore = require('../services/fileStore');

/**
 * Notification system - generates alerts based on current state
 * Types: low_stock, denomination_mismatch, missing_entry, sales_spike, no_backup
 * Severity: critical, warning, info
 */

// GET /api/notifications - Get all active notifications
router.get('/', (req, res) => {
  const notifications = generateNotifications();
  res.json({ notifications, count: notifications.length });
});

// GET /api/notifications/count - Just the count (for badge)
router.get('/count', (req, res) => {
  const notifications = generateNotifications();
  const critical = notifications.filter(n => n.severity === 'critical').length;
  const warning = notifications.filter(n => n.severity === 'warning').length;
  res.json({ total: notifications.length, critical, warning });
});

function generateNotifications() {
  const notifications = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // 1. Check for low stock alerts
  const todayData = fileStore.getNested('dailyEntries', todayStr);
  if (todayData?.entries) {
    todayData.entries.forEach(e => {
      const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
      const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
      const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
      
      if (clst > 0 && clst <= 5) {
        notifications.push({
          id: `low_stock_${e.productId}`,
          type: 'low_stock',
          severity: clst <= 2 ? 'critical' : 'warning',
          title: 'Low Stock Alert',
          message: `${e.particular} has only ${clst} bottles remaining`,
          metadata: { productId: e.productId, closingStock: clst, category: e.category },
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  // 2. Denomination mismatch check
  const denomData = fileStore.getNested('denominations', todayStr);
  if (todayData?.entries?.length > 0 && denomData) {
    let totalSales = 0;
    todayData.entries.forEach(e => {
      const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
      const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
      const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
      const sales = total - clst;
      totalSales += sales > 0 ? sales * (e.rate || 0) : 0;
    });
    
    const cashPlusPOS = (denomData.totalCash || 0) + (todayData.posAmount || 0);
    const diff = Math.abs(cashPlusPOS - totalSales);
    
    if (diff > 100 && totalSales > 0) {
      notifications.push({
        id: `denom_mismatch_${todayStr}`,
        type: 'denomination_mismatch',
        severity: diff > 1000 ? 'critical' : 'warning',
        title: 'Cash Mismatch',
        message: `Cash+POS (₹${Math.round(cashPlusPOS)}) doesn't match sales (₹${Math.round(totalSales)}). Difference: ₹${Math.round(diff)}`,
        metadata: { date: todayStr, cashPlusPOS, totalSales, difference: diff },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // 3. Missing today's entry
  if (!todayData?.entries?.length && today.getHours() >= 18) {
    notifications.push({
      id: `missing_entry_${todayStr}`,
      type: 'missing_entry',
      severity: 'warning',
      title: 'No Entry Today',
      message: `No daily entry has been saved for today (${todayStr}). It's past 6 PM.`,
      metadata: { date: todayStr },
      timestamp: new Date().toISOString()
    });
  }
  
  // 4. Check for recent backup (warn if no backup in 7 days)
  const backups = fileStore.listBackups();
  if (backups.length === 0) {
    notifications.push({
      id: 'no_backup',
      type: 'no_backup',
      severity: 'info',
      title: 'No Backups',
      message: 'No backups have been created yet. Create a backup to protect your data.',
      metadata: {},
      timestamp: new Date().toISOString()
    });
  } else {
    const lastBackup = new Date(backups[0].createdAt);
    const daysSinceBackup = Math.floor((today - lastBackup) / (1000 * 60 * 60 * 24));
    if (daysSinceBackup > 7) {
      notifications.push({
        id: 'stale_backup',
        type: 'stale_backup',
        severity: 'warning',
        title: 'Backup Outdated',
        message: `Last backup was ${daysSinceBackup} days ago. Consider creating a fresh backup.`,
        metadata: { lastBackup: backups[0].createdAt, daysSinceBackup },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // 5. Sales spike detection (today vs 7-day average)
  if (todayData?.entries?.length > 0) {
    let todaySales = 0;
    todayData.entries.forEach(e => {
      const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
      const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
      const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
      const sales = total - clst;
      todaySales += sales > 0 ? sales * (e.rate || 0) : 0;
    });
    
    // Calculate 7-day average (excluding today)
    let weekTotal = 0, weekDays = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const data = fileStore.getNested('dailyEntries', dateStr);
      if (data?.entries?.length > 0) {
        let daySales = 0;
        data.entries.forEach(e => {
          const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
          const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
          const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
          const sales = total - clst;
          daySales += sales > 0 ? sales * (e.rate || 0) : 0;
        });
        weekTotal += daySales;
        weekDays++;
      }
    }
    
    const weekAvg = weekDays > 0 ? weekTotal / weekDays : 0;
    if (weekAvg > 0 && todaySales > weekAvg * 1.5) {
      notifications.push({
        id: `sales_spike_${todayStr}`,
        type: 'sales_spike',
        severity: 'info',
        title: 'Unusual Sales Spike',
        message: `Today's sales ₹${Math.round(todaySales)} are ${Math.round((todaySales / weekAvg - 1) * 100)}% above the 7-day average (₹${Math.round(weekAvg)})`,
        metadata: { todaySales, weekAvg, spikePercent: Math.round((todaySales / weekAvg - 1) * 100) },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return notifications;
}

module.exports = router;
