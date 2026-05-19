import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

/**
 * Toast Notification System
 * Usage: const { showToast } = useToast();
 * showToast('Message', 'success'); // success | error | warning | info
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    // Auto-remove
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const colors = {
    success: { bg: '#E8F5E9', border: '#0E6633', text: '#0E6633', iconBg: '#0E6633' },
    error: { bg: '#FEE2E2', border: '#D92426', text: '#D92426', iconBg: '#D92426' },
    warning: { bg: '#FEF3C7', border: '#D97706', text: '#92400E', iconBg: '#D97706' },
    info: { bg: '#EFF6FF', border: '#2563EB', text: '#1D4ED8', iconBg: '#2563EB' }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 380,
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        const c = colors[toast.type] || colors.info;
        return (
          <div
            key={toast.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'slideIn 0.3s ease',
              pointerEvents: 'auto'
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: c.iconBg, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800, flexShrink: 0
            }}>
              {icons[toast.type]}
            </span>
            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: c.text }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: c.text, fontSize: '1rem', padding: 4, opacity: 0.6
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default ToastProvider;
