import React, { useState, useEffect } from 'react';
import firebaseWeb from '../services/firebaseWeb';

/**
 * Web Dashboard - READ ONLY
 * 
 * This page connects to Firebase Firestore to show synced data from the desktop app.
 * It does NOT allow any modifications - all data entry must happen on the desktop app.
 * 
 * Purpose: Remote monitoring, analytics viewing, report access
 */

function formatINR(num) { return new Intl.NumberFormat('en-IN').format(Math.round(num || 0)); }

export default function WebDashboard() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todaySummary, setTodaySummary] = useState(null);
  const [recentSummaries, setRecentSummaries] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    initDashboard();
  }, []);

  async function initDashboard() {
    setLoading(true);
    try {
      const ready = await firebaseWeb.initializeFirebase();
      setFirebaseReady(ready);
      
      if (ready) {
        await loadData();
      } else {
        setError('Firebase not configured. This dashboard requires Firebase setup to display synced data from the desktop app.');
      }
    } catch (err) {
      setError('Failed to connect: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      const [today, recent] = await Promise.all([
        firebaseWeb.getTodaySummary(),
        firebaseWeb.getRecentSummaries(30)
      ]);
      
      setTodaySummary(today);
      setRecentSummaries(recent);
      if (today?.syncedAt) setLastSync(today.syncedAt);
    } catch (err) {
      setError('Data load failed: ' + err.message);
    }
  }

  const maxSales = Math.max(...recentSummaries.map(d => d.totalSales || 0), 1);
  const totalRevenue = recentSummaries.reduce((s, d) => s + (d.totalSales || 0), 0);
  const avgDaily = recentSummaries.length > 0 ? totalRevenue / recentSummaries.filter(d => d.totalSales > 0).length : 0;

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📊</div>
        <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Connecting to Cloud...</p>
        <p className="text-xs text-muted" style={{ marginTop: 4 }}>Loading synced data from Firebase</p>
      </div>
    );
  }

  // Error/not configured state
  if (error || !firebaseReady) {
    return (
      <div className="card">
        <div className="card-body" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>☁️</div>
          <h2 style={{ marginBottom: 8, color: 'var(--text-dark)' }}>Web Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto 24px' }}>
            {error || 'This dashboard shows data synced from the TASMAC POS desktop application.'}
          </p>
          
          <div style={{ padding: 20, background: '#FEF3C7', borderRadius: 12, maxWidth: 500, margin: '0 auto', textAlign: 'left' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#92400E', marginBottom: 8 }}>Setup Required</h4>
            <ol style={{ fontSize: '0.82rem', color: '#78350F', lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Create a Firebase project at console.firebase.google.com</li>
              <li>Enable Firestore Database</li>
              <li>Add your Firebase web config to environment variables</li>
              <li>Enable sync on the desktop app (Settings &rarr; Firebase Sync)</li>
              <li>Data will appear here automatically after sync</li>
            </ol>
          </div>
          
          <p style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Meanwhile, you can use the desktop app directly for all operations.
            <br />See <strong>FIREBASE_SYNC_GUIDE.md</strong> for detailed setup instructions.
          </p>
        </div>
      </div>
    );
  }

  // Dashboard content (Firebase connected)
  return (
    <div>
      {/* Header with sync status */}
      <div className="card" style={{ border: '2px solid var(--primary)' }}>
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--text-dark)', marginBottom: 4 }}>
                ☁️ Web Dashboard <span className="badge badge-success" style={{ marginLeft: 8, fontSize: '0.65rem' }}>READ ONLY</span>
              </h2>
              <p className="text-xs text-muted">
                Showing data synced from desktop app
                {lastSync && ` | Last sync: ${new Date(lastSync).toLocaleString('en-IN')}`}
              </p>
            </div>
            <button className="btn-primary btn-sm" onClick={loadData}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Read-only notice */}
      <div style={{ padding: '10px 16px', background: '#FEF3C7', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚠️</span>
        <span style={{ fontSize: '0.8rem', color: '#92400E', fontWeight: 500 }}>
          This is a read-only view. To enter data, use the TASMAC POS desktop application.
        </span>
      </div>

      {/* Today's KPIs */}
      <div className="grid-4 mb-20">
        <div className="stat-card primary">
          <div className="stat-label">Today's Sales</div>
          <div className="stat-value">₹{formatINR(todaySummary?.totalSales)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Today's Purchase</div>
          <div className="stat-value">₹{formatINR(todaySummary?.totalPurchase)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Closing Stock Value</div>
          <div className="stat-value">₹{formatINR(todaySummary?.totalClValue)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Bottles Sold</div>
          <div className="stat-value">{todaySummary?.totalBottles || 0}</div>
        </div>
      </div>

      {/* 30-Day Sales Chart */}
      {recentSummaries.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Sales Trend (Last 30 Days)</h3>
            <span className="text-xs text-muted">{recentSummaries.filter(d => d.totalSales > 0).length} days with data</span>
          </div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 180, minWidth: 500, padding: '0 4px' }}>
                {recentSummaries.map((day, idx) => {
                  const height = maxSales > 0 ? ((day.totalSales || 0) / maxSales) * 160 : 0;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div
                        style={{
                          width: '100%', maxWidth: 16, height: `${height}px`,
                          background: (day.totalSales || 0) > 0 ? 'linear-gradient(180deg, #0E6633, #4ADE80)' : '#E0E8E0',
                          borderRadius: '3px 3px 0 0', cursor: 'pointer'
                        }}
                        title={`${day.date}: ₹${formatINR(day.totalSales)}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Summary stats */}
            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ padding: 12, background: 'var(--primary-light)', borderRadius: 8, flex: '1 1 140px', textAlign: 'center' }}>
                <div className="text-xs text-muted">30-Day Total</div>
                <div className="font-bold" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>₹{formatINR(totalRevenue)}</div>
              </div>
              <div style={{ padding: 12, background: '#E8F5E9', borderRadius: 8, flex: '1 1 140px', textAlign: 'center' }}>
                <div className="text-xs text-muted">Average Daily</div>
                <div className="font-bold" style={{ fontSize: '1.1rem', color: 'var(--success)' }}>₹{formatINR(avgDaily)}</div>
              </div>
              <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, flex: '1 1 140px', textAlign: 'center' }}>
                <div className="text-xs text-muted">Highest Day</div>
                <div className="font-bold" style={{ fontSize: '1.1rem', color: '#92400E' }}>₹{formatINR(maxSales)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily History Table */}
      {recentSummaries.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Daily Sales History</h3>
          </div>
          <div className="card-body" style={{ padding: '0 16px 16px' }}>
            <div className="table-wrapper" style={{ maxHeight: '50vh', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Sales</th>
                    <th style={{ textAlign: 'right' }}>Purchase</th>
                    <th style={{ textAlign: 'right' }}>Bottles</th>
                    <th style={{ textAlign: 'right' }}>Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[...recentSummaries].reverse().filter(d => d.totalSales > 0).map(day => (
                    <tr key={day.date}>
                      <td className="font-bold">{day.date}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>₹{formatINR(day.totalSales)}</td>
                      <td style={{ textAlign: 'right' }}>₹{formatINR(day.totalPurchase)}</td>
                      <td style={{ textAlign: 'right' }}>{day.totalBottles || 0}</td>
                      <td style={{ textAlign: 'right' }}>₹{formatINR(day.totalClValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No data state */}
      {recentSummaries.length === 0 && !todaySummary && (
        <div className="card">
          <div className="card-body text-center" style={{ padding: 60 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.4 }}>📊</div>
            <h3 style={{ marginBottom: 8 }}>No Synced Data Yet</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              Data will appear here once the desktop app syncs to Firebase. 
              Make sure Firebase sync is enabled in the desktop app settings.
            </p>
          </div>
        </div>
      )}

      {/* Footer info */}
      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        TASMAC POS - Shop No. 1745, Alandurai, Coimbatore (North)
        <br />Web Dashboard v2.0 | Data synced from desktop application
      </div>
    </div>
  );
}
