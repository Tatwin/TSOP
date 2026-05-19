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
  const [expandedCategory, setExpandedCategory] = useState(null);

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CATEGORY_ORDER.map(cat => {
              const catProducts = DEFAULT_PRODUCTS.filter(p => p.category === cat);
              const isExpanded = expandedCategory === cat;
              return (
                <div key={cat} style={{ border: '1px solid var(--border, #e0e0e0)', borderRadius: 8, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    style={{
                      padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isExpanded ? '#f1faff' : '#f9fafb',
                      borderBottom: isExpanded ? '1px solid var(--border, #e0e0e0)' : 'none',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#181c32' }}>{CATEGORIES[cat].label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a5b7', marginTop: 2 }}>
                        {catProducts.length} items | {CATEGORIES[cat].bottlesPerCase} per case
                      </div>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary, #3699ff)' }}>
                      {isExpanded ? '−' : '+'}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '12px 18px', background: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                            <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#5e6278' }}>Code</th>
                            <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#5e6278' }}>Name</th>
                            <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#5e6278' }}>Rate</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#5e6278' }}>Case Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catProducts.map((p, idx) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f1f2', background: idx % 2 === 0 ? 'transparent' : '#fafbfc' }}>
                              <td style={{ padding: '7px 6px', color: '#a1a5b7' }}>{p.codeNo || '—'}</td>
                              <td style={{ padding: '7px 6px', fontWeight: 600 }}>{p.particular}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'right', color: '#181c32' }}>{p.rate > 0 ? `₹${p.rate}` : '—'}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'center', color: '#a1a5b7' }}>{CATEGORIES[cat].bottlesPerCase}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
