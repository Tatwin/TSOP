import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';

const menuItems = [
  { path: '/', icon: '📊', label: 'Daily Sales', description: 'Enter daily stock data' },
  { path: '/invoice', icon: '🧾', label: 'Purchase Invoice', description: 'Add purchase invoices' },
  { path: '/dashboard', icon: '📈', label: 'Dashboard', description: 'Today & monthly summary' },
  { path: '/analytics', icon: '📉', label: 'Analytics', description: 'Sales insights & charts' },
  { path: '/activity-logs', icon: '📋', label: 'Activity Logs', description: 'Audit trail & history' },
  { path: '/backup', icon: '💾', label: 'Backup', description: 'Backup & restore data' },
  { path: '/manage-products', icon: '⚙️', label: 'Manage', description: 'Products, staff, users' },
];

export default function Layout({ children }) {
  const { authenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleGlobalKeys(e) {
      // Ctrl+K or Cmd+K -> open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Ctrl+S -> save (prevent default browser save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Dispatch custom event that pages can listen to
        window.dispatchEvent(new CustomEvent('globalSave'));
      }
      // Escape -> close search
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    }
    
    document.addEventListener('keydown', handleGlobalKeys);
    return () => document.removeEventListener('keydown', handleGlobalKeys);
  }, [searchOpen]);

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
              background: 'linear-gradient(135deg, #0E6633, #4ADE80)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '0.85rem'
            }}>
              {(user?.name || 'A')[0]}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{user?.name || 'GUEST'}</div>
              <div style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem' }}>
                {authenticated ? `🟢 ${user?.role || 'admin'}` : '🔴 View Only'}
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

            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              {/* Search Button */}
              <button
                onClick={() => setSearchOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', borderRadius: 8,
                  background: '#F4F6F4', border: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem'
                }}
              >
                <span>🔍</span>
                <span style={{ fontWeight: 500 }}>Search</span>
                <kbd style={{
                  padding: '1px 5px', borderRadius: 3, background: 'white',
                  border: '1px solid var(--border)', fontSize: '0.65rem', marginLeft: 4
                }}>⌘K</kbd>
              </button>

              {/* Notifications */}
              <NotificationBell />

              {/* Auth Status */}
              {!authenticated && (
                <button className="btn-light-primary btn-sm" onClick={() => navigate('/login')}>
                  Enter PIN
                </button>
              )}
              {authenticated && (
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  {user?.role === 'admin' ? '👑 Admin' : user?.role === 'operator' ? '🔧 Operator' : '👁 Viewer'}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

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
