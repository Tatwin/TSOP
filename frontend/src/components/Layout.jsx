import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, authenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1a237e, #534bae)',
        color: 'white',
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '700' }}>TASMAC POS</h1>
            <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>Shop No. 1745 - Alandurai</p>
          </div>
          
          <nav style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: location.pathname === '/' ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: 'white',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Daily Entry
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: location.pathname === '/dashboard' ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: 'white',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Dashboard
            </button>
            {authenticated ? (
              <>
                <span style={{ fontSize: '0.8rem', opacity: 0.8, marginLeft: '8px' }}>
                  {user?.name || 'Admin'}
                </span>
                <button
                  onClick={logout}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🔑 Enter PIN
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="container" style={{ paddingTop: '16px', paddingBottom: '80px' }}>
        {children}
      </main>
    </div>
  );
}
