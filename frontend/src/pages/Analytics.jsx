import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';

function formatINR(num) { return new Intl.NumberFormat('en-IN').format(Math.round(num || 0)); }

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('daily');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [topDaysFilter, setTopDaysFilter] = useState({ year: '', month: '' });
  const [topDaysData, setTopDaysData] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/analytics?days=${days}`);
      setAnalytics(res.data);
    } catch (err) {
      console.error('Analytics load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTopDays = async () => {
    try {
      const params = new URLSearchParams();
      if (topDaysFilter.year) params.set('year', topDaysFilter.year);
      if (topDaysFilter.month) params.set('month', topDaysFilter.month);
      const res = await api.get(`/dashboard/top-days?${params.toString()}`);
      setTopDaysData(res.data);
    } catch (err) {
      console.error('Top days load failed:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'topdays') loadTopDays();
  }, [activeTab]);

  const maxDailySales = analytics?.dailySales ? Math.max(...analytics.dailySales.map(d => d.totalSales), 1) : 1;

  const tabs = [
    { id: 'daily', label: 'Daily Sales' },
    { id: 'category', label: 'Category' },
    { id: 'top', label: 'Top Products' },
    { id: 'topdays', label: 'Top 5 Days' },
    { id: 'notsold', label: 'Not Sold' },
    { id: 'profitable', label: 'By Rate' }
  ];

  // Listen for dailyEntrySaved to refresh
  useEffect(() => {
    const handler = () => loadAnalytics();
    window.addEventListener('dailyEntrySaved', handler);
    return () => window.removeEventListener('dailyEntrySaved', handler);
  }, [days]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-dark)', marginBottom: 4 }}>Analytics</h2>
            <p className="text-xs text-muted">
              {analytics?.period?.daysWithData || 0} days with data in last {days} days
              {analytics?.totalRevenue ? ` | Total: ₹${formatINR(analytics.totalRevenue)}` : ''}
            </p>
          </div>
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 100, padding: '6px 10px', fontSize: '0.8rem' }}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            <button className="btn-primary btn-sm" onClick={loadAnalytics} disabled={loading}>
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: 20,
                border: activeTab === tab.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === tab.id ? 'var(--primary)' : 'white',
                color: activeTab === tab.id ? 'white' : 'var(--text-dark)',
                fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* === Daily Sales Bar Chart === */}
      {activeTab === 'daily' && analytics?.dailySales && (
        <div className="card">
          <div className="card-header">
            <h3>Daily Sales (Last {days} Days)</h3>
          </div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 200, minWidth: 600, padding: '0 8px' }}>
                {analytics.dailySales.map((day, idx) => {
                  const height = maxDailySales > 0 ? (day.totalSales / maxDailySales) * 180 : 0;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div
                        style={{
                          width: '100%', maxWidth: 20, height: `${height}px`,
                          background: day.totalSales > 0 ? 'linear-gradient(180deg, #0E6633, #4ADE80)' : '#E0E8E0',
                          borderRadius: '3px 3px 0 0', cursor: 'pointer', transition: 'opacity 0.2s'
                        }}
                        title={`${day.date} (${day.dayName}): ₹${formatINR(day.totalSales)}`}
                      />
                      {idx % Math.ceil(days / 15) === 0 && (
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                          {day.date.slice(5)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Summary stats */}
            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ padding: 12, background: 'var(--primary-light)', borderRadius: 8, flex: '1 1 150px', textAlign: 'center' }}>
                <div className="text-xs text-muted">Average Daily</div>
                <div className="font-bold" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>₹{formatINR(analytics.avgDaily)}</div>
              </div>
              <div style={{ padding: 12, background: '#E8F5E9', borderRadius: 8, flex: '1 1 150px', textAlign: 'center' }}>
                <div className="text-xs text-muted">Highest Day</div>
                <div className="font-bold" style={{ fontSize: '1.1rem', color: 'var(--success)' }}>₹{formatINR(maxDailySales)}</div>
              </div>
              <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, flex: '1 1 150px', textAlign: 'center' }}>
                <div className="text-xs text-muted">{days}-Day Total</div>
                <div className="font-bold" style={{ fontSize: '1.1rem', color: '#92400E' }}>₹{formatINR(analytics.totalRevenue)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Category Breakdown === */}
      {activeTab === 'category' && analytics?.categoryBreakdown && (
        <div className="card">
          <div className="card-header">
            <h3>Category Performance</h3>
          </div>
          <div className="card-body">
            {analytics.categoryBreakdown.length === 0 ? (
              <p className="text-muted text-center" style={{ padding: 40 }}>No category data available for this period</p>
            ) : (
              <div>
                {analytics.categoryBreakdown.map(cat => {
                  const barWidth = analytics.totalRevenue > 0 ? (cat.totalSales / analytics.totalRevenue) * 100 : 0;
                  return (
                    <div key={cat.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{cat.label}</span>
                        <span className="text-muted">{cat.percentage}% — ₹{formatINR(cat.totalSales)} ({cat.totalBottles} btl)</span>
                      </div>
                      <div style={{ height: 22, background: '#F4F6F4', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${barWidth}%`,
                          background: 'linear-gradient(90deg, #0E6633, #4ADE80)',
                          borderRadius: 4, transition: 'width 0.5s',
                          display: 'flex', alignItems: 'center', paddingLeft: 8
                        }}>
                          {barWidth > 10 && <span style={{ fontSize: '0.65rem', color: 'white', fontWeight: 700 }}>{cat.percentage}%</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Top Products === */}
      {activeTab === 'top' && analytics?.topProducts && (
        <div className="card">
          <div className="card-header">
            <h3>Top 10 Products by Revenue</h3>
          </div>
          <div className="card-body">
            {analytics.topProducts.length === 0 ? (
              <p className="text-muted text-center" style={{ padding: 40 }}>No sales data available for this period</p>
            ) : (
              <table>
                <thead>
                  <tr><th>#</th><th>Product</th><th>Category</th><th>Bottles</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {analytics.topProducts.map((item, idx) => (
                    <tr key={item.productId}>
                      <td style={{ fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{item.particular}</td>
                      <td className="text-xs text-muted">{CATEGORIES[item.category]?.label}</td>
                      <td style={{ textAlign: 'center' }}>{item.totalBottles}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{formatINR(item.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* === Top 5 Days === */}
      {activeTab === 'topdays' && (
        <div className="card">
          <div className="card-header">
            <h3>🏆 Top 5 Highest Sales Days</h3>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="number" placeholder="Year" value={topDaysFilter.year} onChange={e => setTopDaysFilter(p => ({ ...p, year: e.target.value }))} style={{ width: 80, padding: '6px 10px', fontSize: '0.8rem' }} />
              <input type="number" placeholder="Month" min="1" max="12" value={topDaysFilter.month} onChange={e => setTopDaysFilter(p => ({ ...p, month: e.target.value }))} style={{ width: 70, padding: '6px 10px', fontSize: '0.8rem' }} />
              <button className="btn-primary btn-sm" onClick={loadTopDays}>Filter</button>
            </div>
          </div>
          <div className="card-body">
            {!topDaysData?.topDays?.length ? (
              <p className="text-muted text-center" style={{ padding: 40 }}>No data available. Save daily entries to see top days.</p>
            ) : (
              topDaysData.topDays.map((day, idx) => (
                <div key={day.date} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0',
                  borderBottom: idx < topDaysData.topDays.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: idx === 0 ? 'linear-gradient(135deg, #FFD700, #FFA000)' : idx === 1 ? 'linear-gradient(135deg, #C0C0C0, #9E9E9E)' : idx === 2 ? 'linear-gradient(135deg, #CD7F32, #8B4513)' : '#F4F6F4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1rem', color: idx < 3 ? 'white' : 'var(--text-dark)',
                    border: idx >= 3 ? '2px solid var(--border)' : 'none', flexShrink: 0
                  }}>
                    #{day.rank}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{day.dayName}</div>
                    <div className="text-sm text-muted">{day.date} • {day.totalBottles} bottles • {day.entriesCount} products</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>₹{formatINR(day.totalSales)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* === Not Sold Items === */}
      {activeTab === 'notsold' && analytics?.notSold && (
        <div className="card">
          <div className="card-header">
            <h3>Items Not Sold ({days} Days)</h3>
            <span className="badge badge-warning">{analytics.notSold.length} items</span>
          </div>
          <div className="card-body">
            {analytics.notSold.length === 0 ? (
              <p className="text-muted text-center" style={{ padding: 40 }}>All products had sales in this period!</p>
            ) : (
              <div className="table-wrapper" style={{ maxHeight: 400, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Code</th><th>Product</th><th>Category</th></tr>
                  </thead>
                  <tbody>
                    {analytics.notSold.map(item => (
                      <tr key={item.productId}>
                        <td className="text-muted">{item.codeNo || '--'}</td>
                        <td style={{ fontWeight: 600 }}>{item.particular}</td>
                        <td className="text-xs text-muted">{CATEGORIES[item.category]?.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Most Profitable (By Rate) === */}
      {activeTab === 'profitable' && (
        <div className="card">
          <div className="card-header">
            <h3>Highest-Priced Products</h3>
          </div>
          <div className="card-body">
            <table>
              <thead>
                <tr><th>#</th><th>Product</th><th>Category</th><th>Rate (₹)</th><th>Revenue Potential</th></tr>
              </thead>
              <tbody>
                {DEFAULT_PRODUCTS
                  .filter(p => p.rate > 0)
                  .sort((a, b) => b.rate - a.rate)
                  .slice(0, 15)
                  .map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{item.particular}</td>
                      <td className="text-xs text-muted">{CATEGORIES[item.category]?.label}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{formatINR(item.rate)}</td>
                      <td>
                        <div style={{ height: 16, background: '#F4F6F4', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min((item.rate / 3000) * 100, 100)}%`, background: 'linear-gradient(90deg, #0E6633, #4ADE80)', borderRadius: 4 }} />
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
