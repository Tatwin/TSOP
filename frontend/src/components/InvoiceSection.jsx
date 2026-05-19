import React from 'react';

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Multiple Invoices Section - supports up to 3 invoices per day
 * Each invoice has: Invoice No, Invoice Amount, Invoice Date
 */
export default function InvoiceSection({ invoices, setInvoices, selectedDate, totalSales }) {
  const addInvoice = () => {
    if (invoices.length >= 3) return;
    setInvoices([...invoices, { invoiceNo: '', invoiceDate: selectedDate, invoiceAmount: 0 }]);
  };

  const removeInvoice = (index) => {
    if (invoices.length <= 1) return;
    setInvoices(invoices.filter((_, i) => i !== index));
  };

  const updateInvoice = (index, field, value) => {
    setInvoices(invoices.map((inv, i) =>
      i === index ? { ...inv, [field]: field === 'invoiceAmount' ? (Number(value) || 0) : value } : inv
    ));
  };

  const invoiceTotal = invoices.reduce((sum, inv) => sum + (inv.invoiceAmount || 0), 0);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem' }}>Invoice Details</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#757575' }}>
            Total: <strong style={{ color: '#1a237e' }}>₹{formatINR(invoiceTotal)}</strong>
          </span>
          {invoices.length < 3 && (
            <button
              onClick={addInvoice}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#1a237e',
                color: 'white',
                fontSize: '0.8rem',
                cursor: 'pointer',
                border: 'none'
              }}
            >
              + Add Invoice
            </button>
          )}
        </div>
      </div>

      {invoices.map((invoice, idx) => (
        <div key={idx} style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end',
          padding: '12px', background: idx % 2 === 0 ? '#f5f5f5' : '#fafafa',
          borderRadius: '8px', marginBottom: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1a237e', width: '30px' }}>
            #{idx + 1}
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Invoice No</label>
            <input
              type="text"
              value={invoice.invoiceNo || ''}
              onChange={(e) => updateInvoice(idx, 'invoiceNo', e.target.value)}
              placeholder="Invoice number"
              style={{ padding: '10px', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Invoice Date</label>
            <input
              type="date"
              value={invoice.invoiceDate || selectedDate}
              onChange={(e) => updateInvoice(idx, 'invoiceDate', e.target.value)}
              style={{ padding: '10px', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Invoice Amount (₹)</label>
            <input
              type="number"
              min="0"
              value={invoice.invoiceAmount || ''}
              onChange={(e) => updateInvoice(idx, 'invoiceAmount', e.target.value)}
              placeholder="0"
              style={{ padding: '10px', fontSize: '0.9rem' }}
            />
          </div>
          {invoices.length > 1 && (
            <button
              onClick={() => removeInvoice(idx)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#c62828',
                color: 'white',
                fontSize: '0.8rem',
                cursor: 'pointer',
                border: 'none',
                marginBottom: '2px'
              }}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      {/* Invoice total vs sales comparison */}
      {invoiceTotal > 0 && (
        <div style={{
          marginTop: '8px', padding: '8px 12px', borderRadius: '6px',
          background: Math.abs(invoiceTotal - totalSales) < 1 ? '#e8f5e9' : '#fff3e0',
          fontSize: '0.85rem', fontWeight: '600',
          color: Math.abs(invoiceTotal - totalSales) < 1 ? '#2e7d32' : '#e65100'
        }}>
          {Math.abs(invoiceTotal - totalSales) < 1
            ? `Invoice total matches sales: ₹${formatINR(invoiceTotal)}`
            : `Invoice total ₹${formatINR(invoiceTotal)} != Sales ₹${formatINR(totalSales)} (Diff: ₹${formatINR(Math.abs(invoiceTotal - totalSales))})`
          }
        </div>
      )}
    </div>
  );
}
