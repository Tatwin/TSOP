import React, { useState, useMemo } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';

function formatINR(num) { return new Intl.NumberFormat('en-IN').format(num || 0); }

export default function Dashboard() {
  const [todayData, setTodayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState(null);

  const loadToday = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [entryRes, denomRes] = await Promise.all([
        api.get(`/daily-entry/${today}`),
        api.get(`/denomination/${today}`)
      ]);
      let totalSales = 0, totalPurchase = 0, totalClValue = 0;
      (entryRes.data.entries || []).forEach(e => {
        totalSales += e.salesAmt || 0;
        totalPurchase += e.purchaseValue || 0;
        totalClValue += e.clValue || 0;
      });
      setTodayData({
        date: today, totalSales, totalPurchase, totalClValue,
        totalCash: denomRes.data.denomination?.totalCash || 0,
        entriesCount: entryRes.data.entries?.length || 0
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadMonthly = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const endDay = new Date(year, month, 0).getDate();
      const res = await api.get(`/daily-entry/range/${year}-${month}-01/${year}-${month}-${String(endDay).padStart(2,'0')}`);
      setMonthlyData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      {/* Today Summary */}
      <div className="card">
        <div className="card-header">
          <h3>Today's Summary</h3>
          <button className="btn-primary btn-sm" onClick={loadToday} disabled={loading}>
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>
        <div className="card-body">
          {!todayData ? (
            <div className="text-center" style={{ padding: 40 }}>
              <p className="text-muted mb-16">Click refresh to load today's data</p>
              <button className="btn-primary" onClick={loadToday}>Load Today's Data</button>
            </div>
          ) : (
            <div className="grid-4">
              <div className="stat-card primary">
                <div className="stat-label">Total Sales</div>
                <div className="stat-value">₹{formatINR(todayData.totalSales)}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">Total Purchase</div>
                <div className="stat-value">₹{formatINR(todayData.totalPurchase)}</div>
              </div>
              <div className="stat-card success">
                <div className="stat-label">Closing Stock Value</div>
                <div className="stat-value">₹{formatINR(todayData.totalClValue)}</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-label">Cash Collected</div>
                <div className="stat-value">₹{formatINR(todayData.totalCash)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly View */}
      <div className="card">
        <div className="card-header">
          <h3>Monthly View</h3>
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: 180, padding: '8px 12px' }} />
            <button className="btn-primary btn-sm" onClick={loadMonthly} disabled={loading}>Load</button>
          </div>
        </div>
        <div className="card-body">
          {!monthlyData ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>Select a month and click Load</p>
          ) : Object.keys(monthlyData.data || {}).length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>No data for this month</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Total Sales</th><th>Purchase</th><th>Closing Value</th></tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData.data).sort().map(([date, dayData]) => {
                    let sales = 0, purchase = 0, clValue = 0;
                    (dayData.entries || []).forEach(e => { sales += e.salesAmt || 0; purchase += e.purchaseValue || 0; clValue += e.clValue || 0; });
                    return (
                      <tr key={date}>
                        <td className="font-bold">{date}</td>
                        <td className="text-primary font-bold">₹{formatINR(sales)}</td>
                        <td>₹{formatINR(purchase)}</td>
                        <td>₹{formatINR(clValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Product Catalog Quick View */}
      <div className="card">
        <div className="card-header">
          <h3>Product Catalog</h3>
          <span className="badge badge-primary">{DEFAULT_PRODUCTS.length} products</span>
        </div>
        <div className="card-body">
          <div className="grid-auto">
            {CATEGORY_ORDER.map(cat => {
              const count = DEFAULT_PRODUCTS.filter(p => p.category === cat).length;
              return (
                <div key={cat} style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="text-xs text-muted mb-4">{CATEGORIES[cat].label}</div>
                  <div className="font-bold">{count} items</div>
                  <div className="text-xs text-muted">{CATEGORIES[cat].bottlesPerCase} per case</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
