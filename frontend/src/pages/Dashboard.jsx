import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';
import { Skeleton, EmptyState } from '../components/ErrorBoundary';

function formatINR(num) { return new Intl.NumberFormat('en-IN').format(Math.round(num || 0)); }

function GrowthBadge({ value }) {
  if (value === 0 || value === null || value === undefined) return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>;
  const isPositive = value > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
      background: isPositive ? '#E8F5E9' : '#FEE2E2',
      color: isPositive ? '#0E6633' : '#D92426'
    }}>
      {isPositive ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

export default function Dashboard() {
  const [comparison, setComparison] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [topDays, setTopDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockDate, setStockDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stockSearch, setStockSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Load all dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [compRes, analyticsRes, intellRes, topDaysRes] = await Promise.all([
        api.get('/dashboard/comparison').catch(() => ({ data: null })),
        api.get('/dashboard/analytics?days=30').catch(() => ({ data: null })),
        api.get('/dashboard/inventory-intelligence').catch(() => ({ data: null })),
        api.get('/dashboard/top-days').catch(() => ({ data: null }))
      ]);
      setComparison(compRes.data);
      setAnalytics(analyticsRes.data);
      setIntelligence(intellRes.data);
      setTopDays(topDaysRes.data);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const endDay = new Date(year, month, 0).getDate();
      const res = await api.get(`/daily-entry/range/${year}-${month}-01/${year}-${month}-${String(endDay).padStart(2, '0')}`);
      setMonthlyData(res.data);
    } catch (err) { console.error(err); }
  };

  const loadStock = async () => {
    setStockLoading(true);
    try {
      const res = await api.get(`/daily-entry/${stockDate}`);
      const entries = res.data.entries || [];
      const stockItems = entries.filter(e => {
        const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
        const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
        return clst > 0;
      }).map(e => {
        const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
        const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
        return { productId: e.productId, particular: e.particular, category: e.category, closingStock: clst, stockValue: clst * (e.rate || 0), rate: e.rate || 0 };
      });
      setStockData(stockItems);
    } catch { setStockData([]); }
    finally { setStockLoading(false); }
  };

  const filteredStock = useMemo(() => {
    if (!stockData) return [];
    if (!stockSearch) return stockData;
    const term = stockSearch.toLowerCase();
    return stockData.filter(s => s.particular.toLowerCase().includes(term) || (CATEGORIES[s.category]?.label || '').toLowerCase().includes(term));
  }, [stockData, stockSearch]);

  const todaySales = comparison?.today?.totalSales || 0;
  const yesterdaySales = comparison?.yesterday?.totalSales || 0;
  const maxDailySales = analytics?.dailySales ? Math.max(...analytics.dailySales.map(d => d.totalSales)) : 0;

  return (
    <div>
      {/* === KPI Cards with Growth === */}
      <div className="grid-4 mb-20">
        <div className="stat-card primary">
          <div className="stat-label">Today's Sales</div>
          <div className="stat-value">₹{formatINR(todaySales)}</div>
          <GrowthBadge value={comparison?.dailyGrowth} />
        </div>
        <div className="stat-card warning">
          <div className="stat-label">This Week</div>
          <div className="stat-value">₹{formatINR(comparison?.thisWeek?.sales)}</div>
          <GrowthBadge value={comparison?.weeklyGrowth} />
        </div>
        <div className="stat-card success">
          <div className="stat-label">This Month</div>
          <div className="stat-value">₹{formatINR(comparison?.thisMonth?.sales)}</div>
          <GrowthBadge value={comparison?.monthlyGrowth} />
        </div>
        <div className="stat-card danger">
          <div className="stat-label">30-Day Revenue</div>
          <div className="stat-value">₹{formatINR(analytics?.totalRevenue)}</div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Avg: ₹{formatINR(analytics?.avgDaily)}/day
          </span>
        </div>
      </div>

      {/* === Today vs Yesterday Comparison === */}
      {comparison && (
        <div className="card">
          <div className="card-header">
            <h3>Today vs Yesterday</h3>
            <button className="btn-sm btn-secondary" onClick={loadDashboardData}>Refresh</button>
          </div>
          <div className="card-body">
            <div className="grid-3 gap-16">
              <div style={{ padding: 16, background: '#F4F6F4', borderRadius: 8, textAlign: 'center' }}>
                <div className="text-xs text-muted mb-4">Yesterday</div>
                <div className="font-bold" style={{ fontSize: '1.3rem', color: 'var(--text-dark)' }}>₹{formatINR(yesterdaySales)}</div>
                <div className="text-xs text-muted">{comparison.yesterday?.totalBottlesSold || 0} bottles</div>
              </div>
              <div style={{ padding: 16, background: 'var(--primary-light)', borderRadius: 8, textAlign: 'center', border: '2px solid var(--primary)' }}>
                <div className="text-xs text-muted mb-4">Today</div>
                <div className="font-bold" style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>₹{formatINR(todaySales)}</div>
                <div className="text-xs text-muted">{comparison.today?.totalBottlesSold || 0} bottles</div>
              </div>
              <div style={{ padding: 16, background: comparison?.dailyGrowth >= 0 ? '#E8F5E9' : '#FEE2E2', borderRadius: 8, textAlign: 'center' }}>
                <div className="text-xs text-muted mb-4">Change</div>
                <div className="font-bold" style={{ fontSize: '1.3rem', color: comparison?.dailyGrowth >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {comparison?.dailyGrowth >= 0 ? '+' : ''}{comparison?.dailyGrowth || 0}%
                </div>
                <div className="text-xs text-muted">₹{formatINR(Math.abs(todaySales - yesterdaySales))} {todaySales >= yesterdaySales ? 'more' : 'less'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === 30-Day Sales Chart === */}
      {analytics?.dailySales && (
        <div className="card">
          <div className="card-header">
            <h3>Sales Trend (30 Days)</h3>
            <span className="text-xs text-muted">{analytics.period?.daysWithData || 0} days with data</span>
          </div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 180, minWidth: 600, padding: '0 4px' }}>
                {analytics.dailySales.map((day, idx) => {
                  const height = maxDailySales > 0 ? (day.totalSales / maxDailySales) * 160 : 0;
                  const isToday = idx === analytics.dailySales.length - 1;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div
                        style={{
                          width: '100%', maxWidth: 18, height: `${height}px`,
                          background: isToday ? 'var(--primary)' : day.totalSales > 0 ? 'linear-gradient(180deg, #0E6633, #4ADE80)' : '#E0E8E0',
                          borderRadius: '3px 3px 0 0', cursor: 'pointer', transition: 'opacity 0.2s',
                          opacity: day.totalSales > 0 ? 1 : 0.3
                        }}
                        title={`${day.date}: ₹${formatINR(day.totalSales)}`}
                      />
                      {idx % 5 === 0 && (
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                          {day.date.slice(5)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Top 5 Sales Days === */}
      {topDays?.topDays?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>🏆 Top 5 Highest Sales Days</h3>
          </div>
          <div className="card-body" style={{ padding: '12px 24px' }}>
            {topDays.topDays.map((day, idx) => (
              <div key={day.date} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0',
                borderBottom: idx < topDays.topDays.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#F4F6F4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.85rem',
                  color: idx < 3 ? 'white' : 'var(--text-dark)',
                  border: idx >= 3 ? '2px solid var(--border)' : 'none'
                }}>
                  #{day.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{day.dayName}, {day.date}</div>
                  <div className="text-xs text-muted">{day.totalBottles || 0} bottles sold</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>₹{formatINR(day.totalSales)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Inventory Intelligence === */}
      {intelligence && (
        <div className="grid-2 mb-20">
          {/* Reorder Suggestions */}
          <div className="card">
            <div className="card-header">
              <h3>⚠️ Reorder Needed</h3>
              <span className="badge badge-danger">{intelligence.summary?.needsReorder || 0}</span>
            </div>
            <div className="card-body" style={{ padding: '8px 16px', maxHeight: 280, overflow: 'auto' }}>
              {(intelligence.reorderSuggestions || []).length === 0 ? (
                <p className="text-muted text-center" style={{ padding: 20 }}>No reorders needed</p>
              ) : (
                intelligence.reorderSuggestions.slice(0, 8).map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.particular}</div>
                      <div className="text-xs text-muted">{item.daysOfStock} days stock left | Avg {item.avgDailySales}/day</div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700,
                      background: item.urgency === 'critical' ? '#FEE2E2' : item.urgency === 'high' ? '#FEF3C7' : '#E8F5E9',
                      color: item.urgency === 'critical' ? '#D92426' : item.urgency === 'high' ? '#92400E' : '#0E6633'
                    }}>
                      {item.urgency}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Fast Moving */}
          <div className="card">
            <div className="card-header">
              <h3>🚀 Fast Moving</h3>
              <span className="badge badge-success">{intelligence.summary?.fastMovingCount || 0}</span>
            </div>
            <div className="card-body" style={{ padding: '8px 16px', maxHeight: 280, overflow: 'auto' }}>
              {(intelligence.fastMoving || []).length === 0 ? (
                <p className="text-muted text-center" style={{ padding: 20 }}>No fast movers detected</p>
              ) : (
                intelligence.fastMoving.slice(0, 8).map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.particular}</div>
                      <div className="text-xs text-muted">{CATEGORIES[item.category]?.label}</div>
                    </div>
                    <span className="font-bold text-primary" style={{ fontSize: '0.85rem' }}>{item.avgDailySales}/day</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* === Top Products Table === */}
      {analytics?.topProducts?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Top 10 Products (30 Days)</h3>
          </div>
          <div className="card-body" style={{ padding: '0 16px 16px' }}>
            <table>
              <thead>
                <tr><th>#</th><th>Product</th><th>Category</th><th>Bottles Sold</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {analytics.topProducts.map((p, idx) => (
                  <tr key={p.productId}>
                    <td style={{ fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.particular}</td>
                    <td className="text-xs text-muted">{CATEGORIES[p.category]?.label}</td>
                    <td style={{ textAlign: 'center' }}>{p.totalBottles}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{formatINR(p.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Current Stock Section === */}
      <div className="card">
        <div className="card-header">
          <h3>Current Stock</h3>
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} style={{ width: 160, padding: '8px 12px' }} />
            <button className="btn-primary btn-sm" onClick={loadStock} disabled={stockLoading}>
              {stockLoading ? '...' : 'Load'}
            </button>
          </div>
        </div>
        <div className="card-body">
          {!stockData ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>Select a date and click "Load" to view closing stock.</p>
          ) : stockData.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>No stock data for this date.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <input type="text" value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Search by product or category..." style={{ maxWidth: 350, padding: '8px 12px' }} />
              </div>
              <div className="table-wrapper" style={{ maxHeight: '45vh', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Stock (btl)</th><th style={{ textAlign: 'right' }}>Value</th></tr>
                  </thead>
                  <tbody>
                    {filteredStock.map(item => (
                      <tr key={item.productId}>
                        <td className="font-bold">{item.particular}</td>
                        <td className="text-muted">{CATEGORIES[item.category]?.label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.closingStock}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>₹{formatINR(item.stockValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F4F6F4' }}>
                      <td className="font-bold">Total</td><td></td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{filteredStock.reduce((s, i) => s + i.closingStock, 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>₹{formatINR(filteredStock.reduce((s, i) => s + i.stockValue, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* === Monthly View === */}
      <div className="card">
        <div className="card-header">
          <h3>Monthly View</h3>
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: 180, padding: '8px 12px' }} />
            <button className="btn-primary btn-sm" onClick={loadMonthly}>Load</button>
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

      {/* === Product Catalog === */}
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
                <div key={cat} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    style={{
                      padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isExpanded ? '#E8F5E9' : '#F4F6F4', transition: 'background 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{CATEGORIES[cat].label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{catProducts.length} items | {CATEGORIES[cat].bottlesPerCase} per case</div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{isExpanded ? '−' : '+'}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '12px 18px', background: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ padding: '8px 6px', textAlign: 'left' }}>Code</th>
                            <th style={{ padding: '8px 6px', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catProducts.map((p, idx) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#F4F6F4' }}>
                              <td style={{ padding: '7px 6px', color: 'var(--text-muted)' }}>{p.codeNo || '--'}</td>
                              <td style={{ padding: '7px 6px', fontWeight: 600 }}>{p.particular}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{p.rate > 0 ? `₹${p.rate}` : '--'}</td>
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

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, padding: '10px 16px', background: 'var(--primary)', color: 'white', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          Loading dashboard...
        </div>
      )}
    </div>
  );
}
