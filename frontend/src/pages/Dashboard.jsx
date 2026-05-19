import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';
import { getEffectiveDate } from '../utils/dateHelper';

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


  // Stock view state
  const [stockDate, setStockDate] = useState(() => getEffectiveDate());
  const [stockData, setStockData] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  // Auto-load today's data on mount AND when page becomes visible (returning from DailyEntry)
  useEffect(() => {
    loadToday();
    loadMonthly();
    // Re-fetch when user returns to this tab/page
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadToday();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const loadToday = async () => {
    setLoading(true);
    try {
      const today = getEffectiveDate();
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


  // Load stock for a specific date
  const loadStock = async () => {
    setStockLoading(true);
    try {
      const res = await api.get(`/daily-entry/${stockDate}`);
      const entries = res.data.entries || [];
      // Build stock data from closing stock in saved entries
      const stockItems = entries.filter(e => {
        const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
        const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
        return clst > 0;
      }).map(e => {
        const caseSize = CATEGORIES[e.category]?.bottlesPerCase || 48;
        const clst = (e.cases || 0) * caseSize + (e.bottles || 0);
        const rate = e.rate || 0;
        return {
          productId: e.productId,
          particular: e.particular,
          category: e.category,
          closingStock: clst,
          stockValue: clst * rate,
          rate
        };
      });
      setStockData(stockItems);
    } catch (err) {
      console.error(err);
      setStockData([]);
    }
    finally { setStockLoading(false); }
  };

  const filteredStock = useMemo(() => {
    if (!stockData) return [];
    if (!stockSearch) return stockData;
    const term = stockSearch.toLowerCase();
    return stockData.filter(s => s.particular.toLowerCase().includes(term) || (CATEGORIES[s.category]?.label || '').toLowerCase().includes(term));
  }, [stockData, stockSearch]);

  return (
    <div>
      {/* Today Summary */}
      <div className="card">
        <div className="card-header">
          <h3>Today's Summary</h3>
          <button className="btn-primary btn-sm" onClick={loadToday} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="card-body">
          {!todayData && loading ? (
            <div className="text-center" style={{ padding: 40 }}>
              <p className="text-muted">Loading today's data...</p>
            </div>
          ) : !todayData ? (
            <div className="text-center" style={{ padding: 40 }}>
              <p className="text-muted mb-16">No data saved for today yet</p>
              <button className="btn-primary" onClick={loadToday}>Retry</button>
            </div>
          ) : (
            <div className="grid-4">
              <div className="stat-card primary">
                <div className="stat-label">Total Sales</div>
                <div className="stat-value">{'\u20B9'}{formatINR(todayData.totalSales)}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">Total Purchase</div>
                <div className="stat-value">{'\u20B9'}{formatINR(todayData.totalPurchase)}</div>
              </div>
              <div className="stat-card success">
                <div className="stat-label">Closing Stock Value</div>
                <div className="stat-value">{'\u20B9'}{formatINR(todayData.totalClValue)}</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-label">Cash Collected</div>
                <div className="stat-value">{'\u20B9'}{formatINR(todayData.totalCash)}</div>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Current Stock Section (Task 5) */}
      <div className="card">
        <div className="card-header">
          <h3>Current Stock</h3>
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} style={{ width: 160, padding: '8px 12px' }} />
            <button className="btn-primary btn-sm" onClick={loadStock} disabled={stockLoading}>
              {stockLoading ? 'Loading...' : 'Load Stock'}
            </button>
          </div>
        </div>
        <div className="card-body">
          {!stockData ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>Select a date and click "Load Stock" to view closing stock for that day.</p>
          ) : stockData.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>No stock data found for this date. Make sure daily entry has been saved.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text" value={stockSearch} onChange={e => setStockSearch(e.target.value)}
                  placeholder="Search by product name or category..."
                  style={{ maxWidth: 350, padding: '8px 12px' }}
                />
              </div>
              <div className="table-wrapper" style={{ maxHeight: '50vh', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Current Stock (bottles)</th>
                      <th style={{ textAlign: 'right' }}>Stock Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map(item => (
                      <tr key={item.productId}>
                        <td className="font-bold">{item.particular}</td>
                        <td className="text-muted">{CATEGORIES[item.category]?.label || item.category}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.closingStock}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{'\u20B9'}{formatINR(item.stockValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F4F6F4' }}>
                      <td className="font-bold">Total</td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{filteredStock.reduce((s, i) => s + i.closingStock, 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{'\u20B9'}{formatINR(filteredStock.reduce((s, i) => s + i.stockValue, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
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
          {!monthlyData && loading ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>Loading monthly data...</p>
          ) : !monthlyData ? (
            <p className="text-muted text-center" style={{ padding: 20 }}>No data for this month</p>
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
                        <td className="text-primary font-bold">{'\u20B9'}{formatINR(sales)}</td>
                        <td>{'\u20B9'}{formatINR(purchase)}</td>
                        <td>{'\u20B9'}{formatINR(clValue)}</td>
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
                <div key={cat} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    style={{
                      padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isExpanded ? '#E8F5E9' : '#F4F6F4',
                      borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{CATEGORIES[cat].label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {catProducts.length} items | {CATEGORIES[cat].bottlesPerCase} per case
                      </div>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {isExpanded ? '[-]' : '[+]'}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '12px 18px', background: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ padding: '8px 6px', textAlign: 'left' }}>Code</th>
                            <th style={{ padding: '8px 6px', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Rate</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center' }}>Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catProducts.map((p, idx) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#F4F6F4' }}>
                              <td style={{ padding: '7px 6px', color: 'var(--text-muted)' }}>{p.codeNo || '--'}</td>
                              <td style={{ padding: '7px 6px', fontWeight: 600 }}>{p.particular}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{p.rate > 0 ? `\u20B9${p.rate}` : '--'}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>&mdash;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>Load a date in Daily Entry to see live stock</p>
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
