import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DEFAULT_PRODUCTS } from '../data/products';

/**
 * Global Search Modal - Ctrl+K / Cmd+K to open
 * Searches across products, pages, actions
 */
export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show quick actions when no query
      return [
        { type: 'page', label: 'Daily Sales Entry', description: 'Enter closing stock for today', path: '/', icon: '📊' },
        { type: 'page', label: 'Purchase Invoice', description: 'Add purchase invoices', path: '/invoice', icon: '🧾' },
        { type: 'page', label: 'Dashboard', description: 'Today & monthly summary', path: '/dashboard', icon: '📈' },
        { type: 'page', label: 'Analytics', description: 'Sales insights & charts', path: '/analytics', icon: '📉' },
        { type: 'page', label: 'Manage Products', description: 'Add, edit, hide items', path: '/manage-products', icon: '⚙️' },
        { type: 'page', label: 'Activity Logs', description: 'View audit trail', path: '/activity-logs', icon: '📋' },
        { type: 'page', label: 'Backup & Restore', description: 'Manage data backups', path: '/backup', icon: '💾' },
      ];
    }

    const term = query.toLowerCase();
    const items = [];

    // Search pages
    const pages = [
      { label: 'Daily Sales Entry', path: '/', icon: '📊', keywords: 'daily entry sales closing stock cases bottles' },
      { label: 'Purchase Invoice', path: '/invoice', icon: '🧾', keywords: 'invoice purchase buy add products' },
      { label: 'Dashboard', path: '/dashboard', icon: '📈', keywords: 'dashboard today summary monthly stock overview' },
      { label: 'Analytics', path: '/analytics', icon: '📉', keywords: 'analytics charts trends top products category' },
      { label: 'Manage Products', path: '/manage-products', icon: '⚙️', keywords: 'manage products staff categories settings' },
      { label: 'Activity Logs', path: '/activity-logs', icon: '📋', keywords: 'audit logs activity history changes' },
      { label: 'Backup & Restore', path: '/backup', icon: '💾', keywords: 'backup restore download data safety' },
    ];

    pages.forEach(p => {
      if (p.label.toLowerCase().includes(term) || p.keywords.includes(term)) {
        items.push({ type: 'page', ...p, description: p.keywords.split(' ').slice(0, 4).join(', ') });
      }
    });

    // Search products (limit to 8)
    const matchedProducts = DEFAULT_PRODUCTS.filter(p =>
      p.particular.toLowerCase().includes(term) ||
      p.codeNo.toLowerCase().includes(term)
    ).slice(0, 8);

    matchedProducts.forEach(p => {
      items.push({
        type: 'product',
        label: p.particular,
        description: `Code: ${p.codeNo || '--'} | ${CATEGORIES[p.category]?.label || p.category} | ₹${p.rate}`,
        icon: '🍾',
        productId: p.id
      });
    });

    // Search categories
    Object.entries(CATEGORIES).forEach(([key, cat]) => {
      if (cat.label.toLowerCase().includes(term) || key.toLowerCase().includes(term)) {
        const count = DEFAULT_PRODUCTS.filter(p => p.category === key).length;
        items.push({
          type: 'category',
          label: cat.label,
          description: `${count} products | ${cat.bottlesPerCase} per case`,
          icon: '📦',
          categoryKey: key
        });
      }
    });

    return items.slice(0, 12);
  }, [query]);

  const handleSelect = (item) => {
    if (item.path) {
      navigate(item.path);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, borderRadius: 16, overflow: 'hidden' }}>
        {/* Search Input */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search products, pages, actions..."
            style={{
              border: 'none', outline: 'none', fontSize: '1rem', fontWeight: 500,
              width: '100%', padding: '8px 0', background: 'transparent'
            }}
          />
          <kbd style={{
            padding: '3px 8px', borderRadius: 4, background: '#F4F6F4',
            border: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'inherit'
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '8px' }}>
          {results.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</div>
              <p style={{ fontWeight: 600 }}>No results found</p>
              <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Try searching for a product name, code, or page</p>
            </div>
          ) : (
            <>
              {!query && <div style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Quick Actions</div>}
              {results.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelect(item)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: idx === selectedIndex ? 'var(--primary-light)' : 'transparent',
                    border: idx === selectedIndex ? '1px solid var(--primary)' : '1px solid transparent',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span style={{ fontSize: '1.1rem', width: 28, textAlign: 'center' }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{item.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                    background: item.type === 'page' ? '#E8F5E9' : item.type === 'product' ? '#FEF3C7' : '#E3F2FD',
                    color: item.type === 'page' ? 'var(--primary)' : item.type === 'product' ? '#92400E' : '#1565C0',
                    fontWeight: 600, textTransform: 'uppercase'
                  }}>
                    {item.type}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, justifyContent: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <kbd style={{ padding: '1px 4px', borderRadius: 3, background: '#F4F6F4', border: '1px solid var(--border)', fontSize: '0.65rem' }}>↑↓</kbd> Navigate
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <kbd style={{ padding: '1px 4px', borderRadius: 3, background: '#F4F6F4', border: '1px solid var(--border)', fontSize: '0.65rem' }}>Enter</kbd> Select
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <kbd style={{ padding: '1px 4px', borderRadius: 3, background: '#F4F6F4', border: '1px solid var(--border)', fontSize: '0.65rem' }}>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
