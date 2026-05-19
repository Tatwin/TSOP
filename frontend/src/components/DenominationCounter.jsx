import React from 'react';

const NOTES = [500, 200, 100, 50, 20, 10];
function formatINR(num) { return new Intl.NumberFormat('en-IN').format(num); }

export default function DenominationCounter({ denomination, setDenomination, totalCash, totalSales, posAmount, setPosAmount }) {
  const cashPlusPOS = totalCash + (posAmount || 0);
  const cashMatch = Math.abs(cashPlusPOS - totalSales) < 1;
  const remittance = totalSales - (posAmount || 0);

  const updateNote = (note, count) => {
    setDenomination(prev => ({ ...prev, notes: { ...prev.notes, [note]: Number(count) || 0 } }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>💵 Cash Denomination</h3>
        <div className={cashMatch && totalSales > 0 ? 'badge badge-success' : totalSales > 0 ? 'badge badge-danger' : 'badge badge-primary'}>
          {totalSales > 0 ? (cashMatch ? '✓ Matched' : '✗ Mismatch') : 'Enter data'}
        </div>
      </div>
      <div className="card-body">
        {/* POS Amount */}
        <div className="mb-20" style={{ padding: 16, background: '#f1faff', borderRadius: 8, border: '1px solid #bce0fd' }}>
          <div className="flex-between">
            <div>
              <label className="form-label" style={{ marginBottom: 4 }}>POS / Card / GPay Amount</label>
              <p className="text-xs text-muted">Amount received via card swipe or digital payment</p>
            </div>
            <input
              type="number" min="0" value={posAmount || ''}
              onChange={e => setPosAmount(Number(e.target.value) || 0)}
              placeholder="₹ 0"
              style={{ width: 150, textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }}
            />
          </div>
        </div>

        {/* Denomination Grid */}
        <div className="grid-3 gap-12 mb-20">
          {NOTES.map(note => (
            <div key={note} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
              <span style={{ fontWeight: 700, minWidth: 40, color: 'var(--text-dark)' }}>₹{note}</span>
              <span className="text-muted">×</span>
              <input
                type="number" min="0" value={denomination.notes[note] || ''}
                onChange={e => updateNote(note, e.target.value)}
                placeholder="0"
                style={{ width: 60, padding: '8px', textAlign: 'center', fontWeight: 600 }}
              />
              <span className="text-muted">=</span>
              <span className="font-bold text-primary" style={{ minWidth: 60, fontSize: '0.85rem' }}>
                ₹{formatINR((denomination.notes[note] || 0) * note)}
              </span>
            </div>
          ))}
          {/* Coins */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
            <span style={{ fontWeight: 700, minWidth: 40 }}>Coins</span>
            <span className="text-muted"> </span>
            <input
              type="number" min="0" value={denomination.coins || ''}
              onChange={e => setDenomination(prev => ({ ...prev, coins: Number(e.target.value) || 0 }))}
              placeholder="₹"
              style={{ width: 80, padding: '8px', textAlign: 'center', fontWeight: 600 }}
            />
            <span className="text-muted">=</span>
            <span className="font-bold text-primary">₹{formatINR(denomination.coins || 0)}</span>
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ padding: 16, background: '#e8fff3', borderRadius: 8, textAlign: 'center' }}>
            <div className="text-xs text-muted mb-4">Total Cash</div>
            <div className="font-bold" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>₹{formatINR(totalCash)}</div>
          </div>
          <div style={{ padding: 16, background: cashMatch ? '#e8fff3' : '#fff5f8', borderRadius: 8, textAlign: 'center', border: `2px solid ${cashMatch ? 'var(--success)' : 'var(--danger)'}` }}>
            <div className="text-xs text-muted mb-4">Cash + POS</div>
            <div className="font-bold" style={{ fontSize: '1.2rem', color: cashMatch ? 'var(--success)' : 'var(--danger)' }}>₹{formatINR(cashPlusPOS)}</div>
            <div className="text-xs" style={{ color: cashMatch ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>
              {cashMatch ? '= Sales ✓' : `vs Sales ₹${formatINR(totalSales)}`}
            </div>
          </div>
          <div style={{ padding: 16, background: '#fff8dd', borderRadius: 8, textAlign: 'center' }}>
            <div className="text-xs text-muted mb-4">Remittance (Bank)</div>
            <div className="font-bold" style={{ fontSize: '1.2rem', color: '#b38600' }}>₹{formatINR(remittance)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
