import React, { useState, useMemo } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num || 0);
}

export default function Dashboard() {
  const [view, setView] = useState('today'); // 'today', 'monthly', 'product'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todayData, setTodayData] = useState(null);

  const loadToday = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [entryRes, denomRes] = await Promise.all([
        api.get(`/daily-entry/${today}`),
        api.get(`/denomination/${today}`)
      ]);
      
      let totalSales = 0, totalPurchase = 0, totalClValue = 0;
      if (entryRes.data.entries?.length > 0) {
        entryRes.data.entries.forEach(e => {
          totalSales += e.salesAmt || 0;
          totalPurchase += e.purchaseValue || 0;
          totalClValue += e.clValue || 0;
        });
      }

      setTodayData({
        date: today,
        totalSales,
        totalPurchase,
        totalClValue,
        totalCash: denomRes.data.denomination?.totalCash || 0,
        entriesCount: entryRes.data.entries?.length || 0
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month}-${String(endDay).padStart(2, '0')}`;
      
      const res = await api.get(`/daily-entry/range/${startDate}/${endDate}`);
      setMonthlyData(res.data);
    } catch (err) {
      console.error('Monthly load error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: '16px' }}>Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setView('today'); loadToday(); }}
            className={view === 'today' ? 'btn-primary' : 'btn-secondary'}
          >
            Today's Summary
          </button>
          <button
            onClick={() => setView('monthly')}
            className={view === 'monthly' ? 'btn-primary' : 'btn-secondary'}
          >
            Monthly View
          </button>
          <button
            onClick={() => setView('product')}
            className={view === 'product' ? 'btn-primary' : 'btn-secondary'}
          >
            Product History
          </button>
        </div>
      </div>

      {/* Today's Summary */}
      {view === 'today' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Today's Summary</h3>
          {!todayData ? (
            <div>
              <button onClick={loadToday} className="btn-primary">
                {loading ? 'Loading...' : 'Load Today\'s Data'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#757575' }}>Total Sales</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2e7d32' }}>
                  ₹{formatINR(todayData.totalSales)}
                </div>
              </div>
              <div style={{ padding: '20px', background: '#fff3e0', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#757575' }}>Total Purchase</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ff6f00' }}>
                  ₹{formatINR(todayData.totalPurchase)}
                </div>
              </div>
              <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#757575' }}>Closing Stock Value</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1a237e' }}>
                  ₹{formatINR(todayData.totalClValue)}
                </div>
              </div>
              <div style={{ padding: '20px', background: '#fce4ec', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#757575' }}>Cash Collected</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#c62828' }}>
                  ₹{formatINR(todayData.totalCash)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly View */}
      {view === 'monthly' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Monthly Summary</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ maxWidth: '200px' }}
            />
            <button onClick={loadMonthly} className="btn-primary">
              {loading ? 'Loading...' : 'Load Month'}
            </button>
          </div>

          {monthlyData && (
            <div>
              {Object.keys(monthlyData.data || {}).length === 0 ? (
                <p style={{ color: '#757575' }}>No data available for this month.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Total Sales</th>
                        <th>Total Purchase</th>
                        <th>Closing Stock Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthlyData.data).sort().map(([date, dayData]) => {
                        let sales = 0, purchase = 0, clValue = 0;
                        (dayData.entries || []).forEach(e => {
                          sales += e.salesAmt || 0;
                          purchase += e.purchaseValue || 0;
                          clValue += e.clValue || 0;
                        });
                        return (
                          <tr key={date}>
                            <td>{date}</td>
                            <td>₹{formatINR(sales)}</td>
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
          )}
        </div>
      )}

      {/* Product History */}
      {view === 'product' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Product Catalog</h3>
          <p style={{ color: '#757575', marginBottom: '16px' }}>
            All 54 products pre-loaded. Use Daily Entry to track daily sales.
          </p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Code</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Case Size</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PRODUCTS.map(p => (
                  <tr key={p.id}>
                    <td>{p.sno}</td>
                    <td>{p.codeNo}</td>
                    <td style={{ fontWeight: '600' }}>{p.particular}</td>
                    <td>{CATEGORIES[p.category]?.label}</td>
                    <td>{CATEGORIES[p.category]?.bottlesPerCase}</td>
                    <td>₹{p.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
