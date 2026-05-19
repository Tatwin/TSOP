import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

/**
 * Notification Bell Component - shows alerts count and dropdown
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications on mount and every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch {
      // Silent fail - notifications are non-critical
    }
  };

  const criticalCount = notifications.filter(n => n.severity === 'critical').length;
  const totalCount = notifications.length;

  const severityColors = {
    critical: { bg: '#FEE2E2', border: '#D92426', text: '#D92426', dot: '#D92426' },
    warning: { bg: '#FEF3C7', border: '#D97706', text: '#92400E', dot: '#D97706' },
    info: { bg: '#EFF6FF', border: '#2563EB', text: '#1D4ED8', dot: '#2563EB' }
  };

  const typeIcons = {
    low_stock: '📦',
    denomination_mismatch: '💰',
    missing_entry: '📝',
    no_backup: '💾',
    stale_backup: '💾',
    sales_spike: '📈'
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          background: showDropdown ? 'var(--primary-light)' : 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '1.1rem',
          transition: 'all 0.2s'
        }}
      >
        🔔
        {totalCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: criticalCount > 0 ? '#D92426' : '#D97706',
            color: 'white', fontSize: '0.65rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white'
          }}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 360,
          maxHeight: '70vh',
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {totalCount} alert{totalCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Notifications List */}
          <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✓</div>
                <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>All clear!</p>
                <p style={{ fontSize: '0.75rem', marginTop: 4 }}>No active alerts</p>
              </div>
            ) : (
              notifications.map((n, idx) => {
                const c = severityColors[n.severity] || severityColors.info;
                return (
                  <div
                    key={n.id || idx}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', marginTop: 2 }}>
                      {typeIcons[n.type] || '🔔'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: c.dot, flexShrink: 0
                        }} />
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-dark)' }}>
                          {n.title}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                        {n.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <button
              onClick={fetchNotifications}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
