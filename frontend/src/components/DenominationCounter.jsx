import React from 'react';

const NOTES = [500, 200, 100, 50, 20, 10];

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

export default function DenominationCounter({ denomination, setDenomination, totalCash, totalSales, posAmount, setPosAmount }) {
  // NEW validation: Cash + POS = Grand Total Sales
  const cashPlusPOS = totalCash + (posAmount || 0);
  const cashMatch = Math.abs(cashPlusPOS - totalSales) < 1;

  // Remittance = Grand Total Sales - POS Amount
  const remittance = totalSales - (posAmount || 0);

  const updateNote = (note, count) => {
    setDenomination(prev => ({
      ...prev,
      notes: { ...prev.notes, [note]: Number(count) || 0 }
    }));
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>
        💵 Denomination Counter (Cash Reconciliation)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {NOTES.map(note => (
          <div key={note} style={{ 
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px', background: '#f5f5f5', borderRadius: '8px'
          }}>
            <span style={{ fontWeight: '700', minWidth: '50px', fontSize: '1rem' }}>₹{note}</span>
            <span style={{ color: '#757575' }}>×</span>
            <input
              type="number"
              min="0"
              value={denomination.notes[note] || ''}
              onChange={(e) => updateNote(note, e.target.value)}
              placeholder="0"
              style={{ width: '70px', padding: '10px', textAlign: 'center', fontSize: '1.1rem' }}
            />
            <span style={{ color: '#757575' }}>=</span>
            <span style={{ fontWeight: '600', color: '#1a237e', minWidth: '80px' }}>
              ₹{formatINR((denomination.notes[note] || 0) * note)}
            </span>
          </div>
        ))}

        {/* Coins */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px', background: '#f5f5f5', borderRadius: '8px'
        }}>
          <span style={{ fontWeight: '700', minWidth: '50px', fontSize: '1rem' }}>Coins</span>
          <span style={{ color: '#757575' }}> </span>
          <input
            type="number"
            min="0"
            value={denomination.coins || ''}
            onChange={(e) => setDenomination(prev => ({ ...prev, coins: Number(e.target.value) || 0 }))}
            placeholder="₹ value"
            style={{ width: '100px', padding: '10px', textAlign: 'center', fontSize: '1.1rem' }}
          />
          <span style={{ color: '#757575' }}>=</span>
          <span style={{ fontWeight: '600', color: '#1a237e' }}>
            ₹{formatINR(denomination.coins || 0)}
          </span>
        </div>
      </div>

      {/* POS (Card/GPay) Field */}
      <div style={{
        marginTop: '16px',
        padding: '16px',
        background: '#e3f2fd',
        borderRadius: '12px',
        border: '2px solid #1565c0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontWeight: '700', fontSize: '1rem', color: '#1565c0', display: 'block', marginBottom: '4px' }}>
              💳 POS (Card/GPay)
            </label>
            <p style={{ fontSize: '0.75rem', color: '#757575', margin: 0 }}>
              Money already deposited via card/digital payments
            </p>
          </div>
          <input
            type="number"
            min="0"
            value={posAmount || ''}
            onChange={(e) => setPosAmount(Number(e.target.value) || 0)}
            placeholder="₹ 0"
            style={{ 
              width: '160px', 
              padding: '12px', 
              textAlign: 'center', 
              fontSize: '1.3rem', 
              fontWeight: '700',
              border: '2px solid #1565c0',
              borderRadius: '8px'
            }}
          />
          <span style={{ fontWeight: '700', fontSize: '1.2rem', color: '#1565c0' }}>
            ₹{formatINR(posAmount || 0)}
          </span>
        </div>
      </div>

      {/* Remittance Display */}
      <div style={{
        marginTop: '16px',
        padding: '16px',
        background: '#fff3e0',
        borderRadius: '12px',
        border: '2px solid #e65100',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: '#e65100', fontWeight: '600' }}>
            🏦 REMITTANCE (Cash to Bank)
          </div>
          <div style={{ fontSize: '0.75rem', color: '#757575', marginTop: '2px' }}>
            Grand Total Sales - POS Amount
          </div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#e65100' }}>
          ₹{formatINR(remittance)}
        </div>
      </div>

      {/* Total - NEW: Cash + POS = Grand Total Sales */}
      <div style={{ 
        marginTop: '16px', 
        padding: '16px', 
        borderRadius: '12px',
        background: cashMatch ? '#e8f5e9' : '#ffebee',
        border: `2px solid ${cashMatch ? '#2e7d32' : '#c62828'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: '#757575' }}>Cash + POS</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: cashMatch ? '#2e7d32' : '#c62828' }}>
            ₹{formatINR(cashPlusPOS)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#757575' }}>
            (Cash: ₹{formatINR(totalCash)} + POS: ₹{formatINR(posAmount || 0)})
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>{cashMatch ? '✅' : '❌'}</div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: cashMatch ? '#2e7d32' : '#c62828' }}>
            {cashMatch ? 'MATCHED' : 'MISMATCH'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: '#757575' }}>Grand Total Sales</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a237e' }}>
            ₹{formatINR(totalSales)}
          </div>
        </div>
      </div>

      {!cashMatch && cashPlusPOS > 0 && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#fff3e0', borderRadius: '8px', fontSize: '0.9rem' }}>
          <strong>Difference:</strong> ₹{formatINR(Math.abs(cashPlusPOS - totalSales))} 
          ({cashPlusPOS > totalSales ? 'Cash+POS is MORE than sales' : 'Cash+POS is LESS than sales'})
        </div>
      )}
    </div>
  );
}
