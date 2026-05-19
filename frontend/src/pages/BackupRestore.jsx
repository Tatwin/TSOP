import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function BackupRestore() {
  const { authenticated, user } = useAuth();
  const navigate = useNavigate();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [backupLabel, setBackupLabel] = useState('');

  useEffect(() => {
    if (authenticated && user?.role === 'admin') {
      loadBackups();
    }
  }, [authenticated, user]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/backup/list');
      setBackups(res.data.backups || []);
    } catch (err) {
      showMsg('Failed to load backups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await api.post('/backup/create', { label: backupLabel || 'manual' });
      showMsg(`Backup created: ${res.data.backup?.filename}`, 'success');
      setBackupLabel('');
      loadBackups();
    } catch (err) {
      showMsg('Failed to create backup: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (filename) => {
    if (!window.confirm(`Restore from "${filename}"?\n\nThis will overwrite all current data. A safety backup will be created first.`)) return;
    
    setRestoring(filename);
    try {
      await api.post('/backup/restore', { filename });
      showMsg(`System restored from ${filename}`, 'success');
      loadBackups();
    } catch (err) {
      showMsg('Restore failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setRestoring(null);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const res = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMsg('Download failed', 'error');
    }
  };

  const handleUploadRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Upload and restore from this backup file?\n\nThis will overwrite all current data.')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/backup/upload', { data });
      showMsg('System restored from uploaded file', 'success');
      loadBackups();
    } catch (err) {
      showMsg('Upload restore failed: ' + (err.response?.data?.error || err.message), 'error');
    }
    e.target.value = '';
  };

  const showMsg = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  // Access check
  if (!authenticated) {
    return (
      <div className="card">
        <div className="card-body text-center" style={{ padding: 60 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
          <h3>Authentication Required</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>Please login to access backup & restore.</p>
          <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>Enter PIN</button>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="card">
        <div className="card-body text-center" style={{ padding: 60 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⛔</div>
          <h3>Access Denied</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>Only administrators can access backup & restore.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Status Message */}
      {message && (
        <div style={{
          padding: '12px 20px', borderRadius: 8, marginBottom: 16,
          background: messageType === 'success' ? '#E8F5E9' : '#FEE2E2',
          color: messageType === 'success' ? '#0E6633' : '#D92426',
          fontWeight: 600, fontSize: '0.85rem',
          border: `1px solid ${messageType === 'success' ? '#0E6633' : '#D92426'}`
        }}>
          {message}
        </div>
      )}

      {/* Create Backup */}
      <div className="card">
        <div className="card-header">
          <h3>💾 Create Backup</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-muted mb-16">
            Create a full backup of all system data including daily entries, denominations, products, staff, users, and audit logs.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label className="form-label">Label (optional)</label>
              <input
                type="text" value={backupLabel} onChange={e => setBackupLabel(e.target.value)}
                placeholder="e.g., before-update, end-of-month"
                style={{ padding: '10px 14px' }}
              />
            </div>
            <button className="btn-success" onClick={createBackup} disabled={creating}>
              {creating ? 'Creating...' : '💾 Create Backup Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Upload Restore */}
      <div className="card">
        <div className="card-header">
          <h3>📤 Upload & Restore</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-muted mb-16">
            Upload a previously downloaded backup JSON file to restore the system to that state.
          </p>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 8,
            background: '#FEF3C7', border: '1px solid #D97706',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#92400E'
          }}>
            📁 Choose Backup File...
            <input type="file" accept=".json" onChange={handleUploadRestore} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Backup History */}
      <div className="card">
        <div className="card-header">
          <h3>📦 Backup History</h3>
          <button className="btn-secondary btn-sm" onClick={loadBackups} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
        <div className="card-body" style={{ padding: '0 16px 16px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading backups...</div>
          ) : backups.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.4 }}>💾</div>
              <p style={{ fontWeight: 600, color: 'var(--text-dark)' }}>No backups yet</p>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>Create your first backup to protect your data</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Created</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup, idx) => (
                  <tr key={idx}>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        {backup.filename}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{formatTime(backup.createdAt)}</td>
                    <td className="text-sm">{formatSize(backup.size)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-sm"
                          onClick={() => downloadBackup(backup.filename)}
                          style={{ background: '#E8F5E9', color: '#0E6633', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          ↓ Download
                        </button>
                        <button
                          className="btn-sm"
                          onClick={() => restoreBackup(backup.filename)}
                          disabled={restoring === backup.filename}
                          style={{ background: '#FEF3C7', color: '#92400E', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          {restoring === backup.filename ? '...' : '↺ Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="card">
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: 8, color: 'var(--text-dark)' }}>ℹ️ About Backups</h4>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8, paddingLeft: 20 }}>
            <li>Backups include <strong>all data</strong>: daily entries, denominations, products, staff, users, and audit logs</li>
            <li>A safety backup is automatically created before any restore operation</li>
            <li>Backups are stored as JSON files in the server's <code>data/backups/</code> folder</li>
            <li>Download backups regularly and store them in a safe location</li>
            <li>Only administrators can create, download, or restore backups</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
