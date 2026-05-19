import React, { useState, useEffect } from 'react';
import api from '../utils/api';

function formatTime(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const ACTION_COLORS = {
  CREATE: { bg: '#E8F5E9', color: '#0E6633', icon: '+' },
  UPDATE: { bg: '#EFF6FF', color: '#1D4ED8', icon: '✎' },
  DELETE: { bg: '#FEE2E2', color: '#D92426', icon: '✕' },
  LOGIN: { bg: '#F3E8FF', color: '#7C3AED', icon: '→' },
  EXPORT: { bg: '#FEF3C7', color: '#92400E', icon: '↓' },
  BACKUP: { bg: '#E8F5E9', color: '#0E6633', icon: '💾' },
  RESTORE: { bg: '#FEF3C7', color: '#92400E', icon: '↺' }
};

const MODULE_LABELS = {
  dailyEntry: 'Daily Entry',
  denomination: 'Denomination',
  products: 'Products',
  staff: 'Staff',
  auth: 'Authentication',
  export: 'Export',
  backup: 'Backup'
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({ module: '', action: '', user: '', startDate: '', endDate: '' });
  const [expandedLog, setExpandedLog] = useState(null);
  const limit = 25;

  useEffect(() => {
    loadLogs();
  }, [offset, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit);
      params.set('offset', offset);
      if (filters.module) params.set('module', filters.module);
      if (filters.action) params.set('action', filters.action);
      if (filters.user) params.set('user', filters.user);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const res = await api.get(`/audit/logs?${params.toString()}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({ module: '', action: '', user: '', startDate: '', endDate: '' });
    setOffset(0);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <h3>Activity Logs</h3>
          <span className="badge badge-primary">{total} entries</span>
        </div>
        <div className="card-body" style={{ padding: '12px 24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label className="form-label">Module</label>
              <select value={filters.module} onChange={e => { setFilters(p => ({ ...p, module: e.target.value })); setOffset(0); }} style={{ padding: '8px 10px', fontSize: '0.82rem' }}>
                <option value="">All Modules</option>
                {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="form-label">Action</label>
              <select value={filters.action} onChange={e => { setFilters(p => ({ ...p, action: e.target.value })); setOffset(0); }} style={{ padding: '8px 10px', fontSize: '0.82rem' }}>
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
                <option value="BACKUP">Backup</option>
                <option value="RESTORE">Restore</option>
              </select>
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="form-label">User</label>
              <input type="text" placeholder="Username" value={filters.user} onChange={e => { setFilters(p => ({ ...p, user: e.target.value })); setOffset(0); }} style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="form-label">From</label>
              <input type="date" value={filters.startDate} onChange={e => { setFilters(p => ({ ...p, startDate: e.target.value })); setOffset(0); }} style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="form-label">To</label>
              <input type="date" value={filters.endDate} onChange={e => { setFilters(p => ({ ...p, endDate: e.target.value })); setOffset(0); }} style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
            </div>
            <button className="btn-secondary btn-sm" onClick={resetFilters}>Clear</button>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="card">
        <div className="card-body" style={{ padding: '0 16px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.4 }}>📋</div>
              <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>No activity logs found</p>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>Logs will appear here as actions are performed in the system</p>
            </div>
          ) : (
            <div>
              {logs.map((log, idx) => {
                const ac = ACTION_COLORS[log.action] || ACTION_COLORS.UPDATE;
                const isExpanded = expandedLog === log.id;
                return (
                  <div key={log.id || idx} style={{
                    padding: '14px 0',
                    borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer'
                  }} onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Action Icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: ac.bg, color: ac.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.85rem', flexShrink: 0
                      }}>
                        {ac.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                            {log.description}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                          <span className="text-xs text-muted">{formatTime(log.timestamp)}</span>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: ac.bg, color: ac.color, fontWeight: 600 }}>
                            {log.action}
                          </span>
                          <span className="text-xs text-muted">
                            {MODULE_LABELS[log.module] || log.module}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            by {log.user}
                          </span>
                        </div>
                      </div>

                      {/* Expand indicator */}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div style={{ marginTop: 12, marginLeft: 44, padding: 12, background: '#F4F6F4', borderRadius: 8, fontSize: '0.78rem' }}>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-gray)' }}>Metadata:</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-dark)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.previousValue && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: '#D92426' }}>Previous:</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-dark)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {JSON.stringify(log.previousValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: '#0E6633' }}>New:</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-dark)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {JSON.stringify(log.newValue, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-xs text-muted">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-8">
              <button className="btn-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                ← Prev
              </button>
              <span className="text-sm" style={{ padding: '6px 12px', fontWeight: 600 }}>
                Page {currentPage} / {totalPages}
              </span>
              <button className="btn-secondary btn-sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
