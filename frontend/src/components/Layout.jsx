import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { path: '/', icon: '📝', label: 'Daily Entry', description: 'Enter daily stock data' },
  { path: '/invoice', icon: '🧾', label: 'Purchase Invoice', description: 'Add purchase invoices' },
  { path: '/dashboard', icon: '📊', label: 'Dashboard', description: 'Today & monthly summary' },
  { path: '/analytics', icon: '📈', label: 'Analytics', description: 'Sales insights & charts' },
  { path: '/manage-products', icon: '📋', label: 'Manage Products', description: 'Add, edit, hide items' },
];

export default function Layout({ children }) {
  const { authenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div>
            <h1>TASMAC POS</h1>
            <small>Shop No. 1745 — Alandurai</small>
          </div>
        </div>

        <nav className="sidebar-menu">
          <div className="sidebar-menu-title">Main Menu</div>
          {menuItems.map(item => (
            <div
              key={item.path}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
            >
              <span className="icon">{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 1 }}>{item.description}</div>
              </div>
            </div>
          ))}

          <div className="sidebar-menu-title" style={{ marginTop: 24 }}>Account</div>
          {authenticated ? (
            <div className="sidebar-item" onClick={logout}>
              <span className="icon">🔓</span>
              <div>
                <div style={{ fontWeight: 600 }}>Logout</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 1 }}>Lock editing access</div>
              </div>
            </div>
          ) : (
            <div className="sidebar-item" onClick={() => { navigate('/login'); setSidebarOpen(false); }}>
              <span className="icon">🔑</span>
              <div>
                <div style={{ fontWeight: 600 }}>Enter PIN</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 1 }}>Unlock edit & save</div>
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3699ff, #7239ea)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '0.85rem'
            }}>
              A
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>ANTONYSAMY.A</div>
              <div style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem' }}>
                {authenticated ? '🟢 Unlocked' : '🔴 View Only'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main">
        {/* Header */}
        <header className="app-header">
          <div className="flex-between" style={{ width: '100%' }}>
            <div className="flex gap-12" style={{ alignItems: 'center' }}>
              {/* Mobile hamburger */}
              <button
                className="btn-icon btn-secondary"
                style={{ display: 'none' }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                id="mobile-menu-btn"
              >
                ☰
              </button>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                  {menuItems.find(m => m.path === location.pathname)?.label || 'TASMAC POS'}
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex gap-12" style={{ alignItems: 'center' }}>
              {!authenticated && (
                <button className="btn-light-primary btn-sm" onClick={() => navigate('/login')}>
                  🔑 Enter PIN to Edit
                </button>
              )}
              {authenticated && (
                <span className="badge badge-success">✓ Edit Mode</span>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Mobile menu button (shown via CSS @media) */}
      <style>{`
        @media (max-width: 992px) {
          #mobile-menu-btn { display: flex !important; }
          .app-sidebar.open { transform: translateX(0) !important; }
        }
      `}</style>
    </div>
  );
}
