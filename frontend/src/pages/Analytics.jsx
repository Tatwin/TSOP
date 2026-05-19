import React, { useState, useMemo } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

// Generate sample data for demonstration (since no real API data available)
function generateSampleData() {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const baseAmount = 80000 + Math.floor(Math.random() * 60000);
    days.push({
      date: dateStr,
      displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
      totalSales: baseAmount,
      imfsSales: Math.floor(baseAmount * 0.72),
      beerSales: Math.floor(baseAmount * 0.28),
      totalBottles: Math.floor(baseAmount / 250),
    });
  }
  return days;
}

function generateCategoryBreakdown() {
  const breakdown = {};
  const colors = [
    '#1a237e', '#283593', '#303f9f', '#3949ab', '#3f51b5',
    '#5c6bc0', '#7986cb', '#9fa8da', '#c5cae9', '#e8eaf6',
    '#ff6f00', '#ff8f00', '#ffa000', '#ffb300', '#ffc107'
  ];
  let totalSales = 0;
  CATEGORY_ORDER.forEach((cat, idx) => {
    const count = DEFAULT_PRODUCTS.filter(p => p.category === cat).length;
    const avgRate = DEFAULT_PRODUCTS.filter(p => p.category === cat)
      .reduce((sum, p) => sum + (p.rate || 0), 0) / (count || 1);
    const sales = Math.floor(count * avgRate * (Math.random() * 5 + 2));
    breakdown[cat] = { label: CATEGORIES[cat].label, sales, color: colors[idx % colors.length], count };
    totalSales += sales;
  });
  // Add percentages
  Object.keys(breakdown).forEach(k => {
    breakdown[k].percentage = totalSales > 0 ? ((breakdown[k].sales / totalSales) * 100).toFixed(1) : 0;
  });
  return { breakdown, totalSales };
}

function getTopSoldItems() {
  const items = DEFAULT_PRODUCTS
    .filter(p => p.rate > 0)
    .map(p => ({
      ...p,
      estimatedSales: Math.floor(Math.random() * 20 + 1),
      salesValue: Math.floor(Math.random() * 20 + 1) * p.rate
    }))
    .sort((a, b) => b.salesValue - a.salesValue)
    .slice(0, 10);
  return items;
}

function getNotSoldItems() {
  return DEFAULT_PRODUCTS
    .filter(p => p.rate === 0 || Math.random() > 0.85)
    .slice(0, 20)
    .map(p => ({ ...p, lastSoldDays: Math.floor(Math.random() * 120 + 90) }));
}

function getMonthlySummary() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const data = [];
  for (let i = 5; i >= 0; i--) {
    const m = (now.getMonth() - i + 12) % 12;
    data.push({
      month: months[m],
      sales: Math.floor(Math.random() * 1000000 + 2000000),
      days: Math.floor(Math.random() * 5 + 26)
    });
  }
  return data;
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('daily');

  const dailyData = useMemo(() => generateSampleData(), []);
  const { breakdown, totalSales } = useMemo(() => generateCategoryBreakdown(), []);
  const topItems = useMemo(() => getTopSoldItems(), []);
  const notSoldItems = useMemo(() => getNotSoldItems(), []);
  const monthlySummary = useMemo(() => getMonthlySummary(), []);

  const maxDailySales = Math.max(...dailyData.map(d => d.totalSales));

  const tabs = [
    { id: 'daily', label: 'Daily Sales' },
    { id: 'category', label: 'Category' },
    { id: 'top', label: 'Top Items' },
    { id: 'notsold', label: 'Not Sold' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'profitable', label: 'Profitable' }
  ];

  return (
    <div>
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', color: '#1a237e', marginBottom: '4px' }}>Analytics Dashboard</h2>
        <p style={{ fontSize: '0.85rem', color: '#757575' }}>Sales insights and performance metrics</p>
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
                border: activeTab === tab.id ? '2px solid #1a237e' : '1px solid #e0e0e0',
                background: activeTab === tab.id ? '#1a237e' : 'white',
                color: activeTab === tab.id ? 'white' : '#333',
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
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '200px', minWidth: '600px', padding: '0 8px' }}>
              {dailyData.map((day, idx) => {
                const height = maxDailySales > 0 ? (day.totalSales / maxDailySales) * 180 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '20px',
                        height: `${height}px`,
                        background: `linear-gradient(180deg, #1a237e, #534bae)`,
                        borderRadius: '3px 3px 0 0',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                      title={`${day.date}: ₹${formatINR(day.totalSales)}`}
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
            <div style={{ padding: '12px', background: '#e3f2fd', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#757575' }}>Average Daily</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1a237e' }}>
                ₹{formatINR(Math.floor(dailyData.reduce((s, d) => s + d.totalSales, 0) / 30))}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#e8f5e9', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#757575' }}>Highest Day</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#2e7d32' }}>
                ₹{formatINR(maxDailySales)}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#fff3e0', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#757575' }}>30 Day Total</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#e65100' }}>
                ₹{formatINR(dailyData.reduce((s, d) => s + d.totalSales, 0))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {activeTab === 'category' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Category Breakdown (Estimated)</h3>
          {/* CSS Pie chart representation using stacked bars */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ flex: '1 1 300px' }}>
              {/* Horizontal bar chart for categories */}
              {CATEGORY_ORDER.map(cat => {
                const data = breakdown[cat];
                if (!data || data.sales === 0) return null;
                const barWidth = totalSales > 0 ? (data.sales / totalSales) * 100 : 0;
                return (
                  <div key={cat} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600' }}>{data.label}</span>
                      <span style={{ color: '#757575' }}>{data.percentage}% (₹{formatINR(data.sales)})</span>
                    </div>
                    <div style={{ height: '20px', background: '#f5f5f5', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        background: data.color,
                        borderRadius: '4px',
                        transition: 'width 0.5s'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: '0 1 200px' }}>
              {/* Circular representation using CSS */}
              <div style={{
                width: '180px', height: '180px', borderRadius: '50%',
                background: `conic-gradient(${CATEGORY_ORDER.map((cat, i) => {
                  const pct = Number(breakdown[cat]?.percentage || 0);
                  const start = CATEGORY_ORDER.slice(0, i).reduce((s, c) => s + Number(breakdown[c]?.percentage || 0), 0);
                  return `${breakdown[cat]?.color || '#ccc'} ${start}% ${start + pct}%`;
                }).join(', ')})`,
                margin: '0 auto'
              }} />
              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.9rem', fontWeight: '700', color: '#1a237e' }}>
                Total: ₹{formatINR(totalSales)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Sold Items */}
      {activeTab === 'top' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Top 10 Most Sold Items (by Value)</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Rate</th>
                  <th>Est. Bottles Sold</th>
                  <th>Sales Value</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '700' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '600' }}>{item.particular}</td>
                    <td style={{ fontSize: '0.8rem' }}>{CATEGORIES[item.category]?.label}</td>
                    <td>₹{item.rate}</td>
                    <td style={{ textAlign: 'center' }}>{item.estimatedSales}</td>
                    <td style={{ fontWeight: '700', color: '#1a237e' }}>₹{formatINR(item.salesValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Not Sold Items */}
      {activeTab === 'notsold' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Items Not Sold for 90+ Days</h3>
          <p style={{ fontSize: '0.85rem', color: '#757575', marginBottom: '12px' }}>
            These items may need attention - consider removing or repricing
          </p>
          <div className="table-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Rate</th>
                  <th>Days Since Last Sale</th>
                </tr>
              </thead>
              <tbody>
                {notSoldItems.map((item) => (
                  <tr key={item.id} style={{ background: item.lastSoldDays > 120 ? '#ffebee' : 'transparent' }}>
                    <td>{item.codeNo || '-'}</td>
                    <td style={{ fontWeight: '600' }}>{item.particular}</td>
                    <td style={{ fontSize: '0.8rem' }}>{CATEGORIES[item.category]?.label}</td>
                    <td>₹{item.rate || 0}</td>
                    <td style={{
                      fontWeight: '700',
                      color: item.lastSoldDays > 120 ? '#c62828' : '#e65100'
                    }}>
                      {item.lastSoldDays} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {activeTab === 'monthly' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Monthly Sales Summary</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px', padding: '0 20px' }}>
            {monthlySummary.map((m, idx) => {
              const maxSales = Math.max(...monthlySummary.map(s => s.sales));
              const height = maxSales > 0 ? (m.sales / maxSales) * 170 : 0;
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#1a237e', marginBottom: '4px' }}>
                    ₹{(m.sales / 100000).toFixed(1)}L
                  </div>
                  <div
                    style={{
                      width: '40px',
                      height: `${height}px`,
                      background: `linear-gradient(180deg, #ff6f00, #ff8f00)`,
                      borderRadius: '6px 6px 0 0'
                    }}
                    title={`${m.month}: ₹${formatINR(m.sales)} (${m.days} days)`}
                  />
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', marginTop: '8px' }}>{m.month}</div>
                  <div style={{ fontSize: '0.65rem', color: '#757575' }}>{m.days} days</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#e3f2fd' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Month</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Sales</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Days</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Avg/Day</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '8px', fontWeight: '600' }}>{m.month}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#1a237e' }}>₹{formatINR(m.sales)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{m.days}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>₹{formatINR(Math.floor(m.sales / m.days))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Most Profitable */}
      {activeTab === 'profitable' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Most Profitable Items (by Rate)</h3>
          <p style={{ fontSize: '0.85rem', color: '#757575', marginBottom: '12px' }}>
            Highest-priced items that contribute most to revenue per bottle sold
          </p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Rate (₹)</th>
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
                      <td style={{ fontWeight: '700', color: '#1a237e' }}>₹{formatINR(item.rate)}</td>
                      <td>
                        <div style={{ height: '16px', background: '#f5f5f5', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min((item.rate / 3000) * 100, 100)}%`,
                            background: 'linear-gradient(90deg, #2e7d32, #66bb6a)',
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

          {/* Most Purchased - grouped by category */}
          <h3 style={{ marginTop: '24px', marginBottom: '16px', fontSize: '1rem' }}>Most Purchased Categories</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {CATEGORY_ORDER.map(cat => {
              const count = DEFAULT_PRODUCTS.filter(p => p.category === cat).length;
              const avgRate = Math.floor(
                DEFAULT_PRODUCTS.filter(p => p.category === cat).reduce((s, p) => s + (p.rate || 0), 0) / (count || 1)
              );
              return (
                <div key={cat} style={{
                  padding: '12px', background: '#f5f5f5', borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1a237e', marginBottom: '4px' }}>
                    {CATEGORIES[cat].label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#757575' }}>
                    {count} products | Avg ₹{avgRate}
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
