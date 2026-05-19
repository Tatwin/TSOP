import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num || 0);
}

// Helper: get effective today using LOCAL time (yesterday if midnight-4AM)
function getEffectiveToday() {
  const now = new Date();
  if (now.getHours() >= 0 && now.getHours() < 4) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState({});
  const [topItems, setTopItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load last 30 days of data on mount AND when returning to page
  useEffect(() => {
    loadAnalyticsData();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAnalyticsData();
      }
    };
    const handleSaved = () => loadAnalyticsData();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('dailyEntrySaved', handleSaved);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('dailyEntrySaved', handleSaved);
    };
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const today = getEffectiveToday();
      const endDate = today;
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      const startDate = start.toISOString().split('T')[0];

      // Fetch 30 days of data
      const res = await api.get(`/daily-entry/range/${startDate}/${endDate}`);
      const rangeData = res.data.data || {};

      // Build daily sales array
      const days = [];
      const catSales = {};
      const productSalesMap = {};
      const current = new Date(startDate);
      const endD = new Date(endDate);

      while (current <= endD) {
        const dateStr = current.toISOString().split('T')[0];
        const dayData = rangeData[dateStr];
        let totalSales = 0, imfsSales = 0, beerSales = 0, totalBottles = 0;

        if (dayData?.entries?.length > 0) {
          dayData.entries.forEach(e => {
            const salesAmt = e.salesAmt || 0;
            const sales = e.sales || 0;
            totalSales += salesAmt;
            totalBottles += sales > 0 ? sales : 0;

            // Category breakdown accumulation
            if (e.category) {
              catSales[e.category] = (catSales[e.category] || 0) + salesAmt;
            }

            // Per-product accumulation
            if (e.productId && salesAmt > 0) {
              if (!productSalesMap[e.productId]) {
                productSalesMap[e.productId] = { bottles: 0, value: 0, particular: e.particular, category: e.category, rate: e.rate };
              }
              productSalesMap[e.productId].bottles += (sales > 0 ? sales : 0);
              productSalesMap[e.productId].value += salesAmt;
            }

            // IMFS vs Beer split
            if (e.category && e.category.startsWith('BEER')) {
              beerSales += salesAmt;
            } else {
              imfsSales += salesAmt;
            }
          });
        }

        const d = new Date(dateStr);
        days.push({
          date: dateStr,
          displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
          totalSales,
          imfsSales,
          beerSales,
          totalBottles
        });

        current.setDate(current.getDate() + 1);
      }

      setDailyData(days);

      // Category breakdown
      const totalAllSales = Object.values(catSales).reduce((s, v) => s + v, 0);
      const breakdown = {};
      const colors = [
        '#0E6633', '#1B8A4A', '#2EAD62', '#3FC97A', '#50E593',
        '#D92426', '#E84C4E', '#F07072', '#F59496', '#FAB8BA',
        '#1E291E', '#3D523D', '#5C7B5C', '#7BA47B', '#9ACD9A'
      ];
      CATEGORY_ORDER.forEach((cat, idx) => {
        const sales = catSales[cat] || 0;
        breakdown[cat] = {
          label: CATEGORIES[cat].label,
          sales,
          color: colors[idx % colors.length],
          count: DEFAULT_PRODUCTS.filter(p => p.category === cat).length,
          percentage: totalAllSales > 0 ? ((sales / totalAllSales) * 100).toFixed(1) : '0.0'
        };
      });
      setCategoryBreakdown(breakdown);

      // Top sold items
      const topSorted = Object.entries(productSalesMap)
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      setTopItems(topSorted);

      // Low stock / not sold - products with 0 sales in 30 days
      const soldProductIds = new Set(Object.keys(productSalesMap));
      const notSold = DEFAULT_PRODUCTS
        .filter(p => !soldProductIds.has(p.id))
        .map(p => ({ ...p, daysSinceLastSale: 30 }));
      setLowStockItems(notSold);

      // Monthly summary (last 6 months)
      const monthData = [];
      const now = new Date(today);
      for (let i = 5; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yr = mDate.getFullYear();
        const mo = mDate.getMonth() + 1;
        const moStart = `${yr}-${String(mo).padStart(2, '0')}-01`;
        const daysInMonth = new Date(yr, mo, 0).getDate();
        const moEnd = `${yr}-${String(mo).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // For the current 30-day range, calculate from that data
        let moSales = 0, moDays = 0;
        Object.entries(rangeData).forEach(([date, dd]) => {
          if (date >= moStart && date <= moEnd && dd?.entries?.length > 0) {
            dd.entries.forEach(e => { moSales += e.salesAmt || 0; });
            moDays++;
          }
        });

        monthData.push({ month: months[mo - 1], year: yr, sales: moSales, days: moDays });
      }
      setMonthlySummary(monthData);
      setDataLoaded(true);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxDailySales = Math.max(...dailyData.map(d => d.totalSales), 1);
  const totalAllCatSales = Object.values(categoryBreakdown).reduce((s, v) => s + (v.sales || 0), 0);

  const tabs = [
    { id: 'daily', label: 'Daily Sales' },
    { id: 'category', label: 'Category' },
    { id: 'top', label: 'Top Items' },
    { id: 'notsold', label: 'Not Sold' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'profitable', label: 'Profitable' }
  ];

  if (loading && !dataLoaded) {
    return (
      <div className="card">
        <div className="card-body text-center" style={{ padding: 60 }}>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '4px' }}>Analytics Dashboard</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {dataLoaded && dailyData.filter(d => d.totalSales > 0).length > 0
                ? `Based on ${dailyData.filter(d => d.totalSales > 0).length} days of real sales data`
                : 'No sales data found. Save daily entries to see analytics.'}
            </p>
          </div>
          <button className="btn-primary btn-sm" onClick={loadAnalyticsData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                border: activeTab === tab.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === tab.id ? 'var(--primary)' : 'white',
                color: activeTab === tab.id ? 'white' : 'var(--text-dark)',
                fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Sales Bar Chart */}
      {activeTab === 'daily' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Total Sales Per Day (Last 30 Days)</h3>
          {dailyData.filter(d => d.totalSales > 0).length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 40 }}>No daily sales data available yet. Save entries in Daily Entry to see chart.</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '200px', minWidth: '600px', padding: '0 8px' }}>
                  {dailyData.map((day, idx) => {
                    const height = maxDailySales > 0 ? (day.totalSales / maxDailySales) * 180 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div
                          style={{
                            width: '100%', maxWidth: '20px', height: `${height}px`,
                            background: day.totalSales > 0 ? 'linear-gradient(180deg, #0E6633, #1B8A4A)' : '#e0e0e0',
                            borderRadius: '3px 3px 0 0', cursor: 'pointer'
                          }}
                          title={`${day.date}: \u20B9${formatINR(day.totalSales)}`}
                        />
                        <div style={{ fontSize: '0.6rem', color: '#757575', marginTop: '4px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                          {day.displayDate}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ padding: '12px', background: '#E8F5E9', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average Daily</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>
                    {'\u20B9'}{formatINR(Math.floor(dailyData.reduce((s, d) => s + d.totalSales, 0) / Math.max(dailyData.filter(d => d.totalSales > 0).length, 1)))}
                  </div>
                </div>
                <div style={{ padding: '12px', background: '#E8F5E9', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Highest Day</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)' }}>
                    {'\u20B9'}{formatINR(maxDailySales)}
                  </div>
                </div>
                <div style={{ padding: '12px', background: '#FFF3E0', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>30-Day Total</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#e65100' }}>
                    {'\u20B9'}{formatINR(dailyData.reduce((s, d) => s + d.totalSales, 0))}
                  </div>
                </div>
                <div style={{ padding: '12px', background: '#E3F2FD', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Days</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1565C0' }}>
                    {dailyData.filter(d => d.totalSales > 0).length} / 30
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      {activeTab === 'category' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Category Breakdown</h3>
          {totalAllCatSales === 0 ? (
            <p className="text-muted text-center" style={{ padding: 40 }}>No category data. Save daily entries first.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ flex: '1 1 300px' }}>
                {CATEGORY_ORDER.map(cat => {
                  const data = categoryBreakdown[cat];
                  if (!data || data.sales === 0) return null;
                  const barWidth = totalAllCatSales > 0 ? (data.sales / totalAllCatSales) * 100 : 0;
                  return (
                    <div key={cat} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '600' }}>{data.label}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{data.percentage}% ({'\u20B9'}{formatINR(data.sales)})</span>
                      </div>
                      <div style={{ height: '20px', background: '#F4F6F4', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, background: data.color, borderRadius: '4px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ flex: '0 1 200px', textAlign: 'center' }}>
                <div style={{
                  width: '180px', height: '180px', borderRadius: '50%', margin: '0 auto',
                  background: `conic-gradient(${CATEGORY_ORDER.map((cat, i) => {
                    const pct = Number(categoryBreakdown[cat]?.percentage || 0);
                    const startPct = CATEGORY_ORDER.slice(0, i).reduce((s, c) => s + Number(categoryBreakdown[c]?.percentage || 0), 0);
                    return `${categoryBreakdown[cat]?.color || '#ccc'} ${startPct}% ${startPct + pct}%`;
                  }).join(', ')})`
                }} />
                <div style={{ marginTop: '12px', fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>
                  Total: {'\u20B9'}{formatINR(totalAllCatSales)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Sold Items */}
      {activeTab === 'top' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Top 10 Best Sellers (by Value - Last 30 Days)</h3>
          {topItems.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 40 }}>No sales data available yet.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Rate</th>
                    <th>Bottles Sold</th>
                    <th>Sales Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, idx) => (
                    <tr key={item.productId}>
                      <td style={{ fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ fontWeight: '600' }}>{item.particular}</td>
                      <td style={{ fontSize: '0.8rem' }}>{CATEGORIES[item.category]?.label}</td>
                      <td>{'\u20B9'}{item.rate}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.bottles}</td>
                      <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{'\u20B9'}{formatINR(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Not Sold Items */}
      {activeTab === 'notsold' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Items Not Sold (Last 30 Days)</h3>
          {lowStockItems.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 40 }}>All products have been sold in the last 30 days!</p>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {lowStockItems.length} products had no sales in the last 30 days
              </p>
              <div className="table-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item.id} style={{ background: '#FEE2E2' }}>
                        <td>{item.codeNo || '-'}</td>
                        <td style={{ fontWeight: '600' }}>{item.particular}</td>
                        <td style={{ fontSize: '0.8rem' }}>{CATEGORIES[item.category]?.label}</td>
                        <td>{'\u20B9'}{item.rate || 0}</td>
                        <td style={{ fontWeight: '700', color: 'var(--danger)' }}>No sales (30d)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Monthly Summary */}
      {activeTab === 'monthly' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Monthly Sales Summary</h3>
          {monthlySummary.every(m => m.sales === 0) ? (
            <p className="text-muted text-center" style={{ padding: 40 }}>No monthly data available. Save daily entries to see trends.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px', padding: '0 20px' }}>
                {monthlySummary.map((m, idx) => {
                  const maxSales = Math.max(...monthlySummary.map(s => s.sales), 1);
                  const height = maxSales > 0 ? (m.sales / maxSales) * 170 : 0;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>
                        {m.sales > 0 ? `\u20B9${(m.sales / 100000).toFixed(1)}L` : '-'}
                      </div>
                      <div
                        style={{
                          width: '40px', height: `${Math.max(height, 4)}px`,
                          background: m.sales > 0 ? 'linear-gradient(180deg, #0E6633, #2EAD62)' : '#e0e0e0',
                          borderRadius: '6px 6px 0 0'
                        }}
                        title={`${m.month} ${m.year}: \u20B9${formatINR(m.sales)} (${m.days} days)`}
                      />
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', marginTop: '8px' }}>{m.month}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.days}d</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#E8F5E9' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Month</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total Sales</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Days</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Avg/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.filter(m => m.sales > 0).map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: '600' }}>{m.month} {m.year}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>{'\u20B9'}{formatINR(m.sales)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{m.days}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{m.days > 0 ? `\u20B9${formatINR(Math.floor(m.sales / m.days))}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Most Profitable */}
      {activeTab === 'profitable' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Most Profitable Items (by Rate)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Highest-priced items that contribute most to revenue per bottle sold
          </p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Rate</th>
                  <th>Revenue Potential</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PRODUCTS
                  .filter(p => p.rate > 0)
                  .sort((a, b) => b.rate - a.rate)
                  .slice(0, 15)
                  .map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ fontWeight: '600' }}>{item.particular}</td>
                      <td style={{ fontSize: '0.8rem' }}>{CATEGORIES[item.category]?.label}</td>
                      <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{'\u20B9'}{formatINR(item.rate)}</td>
                      <td>
                        <div style={{ height: '16px', background: '#F4F6F4', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min((item.rate / 3000) * 100, 100)}%`,
                            background: 'linear-gradient(90deg, #0E6633, #2EAD62)',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: '24px', marginBottom: '16px', fontSize: '1rem' }}>Category Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {CATEGORY_ORDER.map(cat => {
              const count = DEFAULT_PRODUCTS.filter(p => p.category === cat).length;
              const avgRate = Math.floor(
                DEFAULT_PRODUCTS.filter(p => p.category === cat).reduce((s, p) => s + (p.rate || 0), 0) / (count || 1)
              );
              const catData = categoryBreakdown[cat];
              return (
                <div key={cat} style={{
                  padding: '12px', background: '#F4F6F4', borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    {CATEGORIES[cat].label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {count} products | Avg {'\u20B9'}{avgRate}
                    {catData && catData.sales > 0 ? ` | Sales: \u20B9${formatINR(catData.sales)}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
