import React, { useState, useMemo, useCallback } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import api from '../utils/api';
import DenominationCounter from '../components/DenominationCounter';

// Helper to format date as YYYY-MM-DD
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

// Helper to format numbers as Indian currency
function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

export default function DailyEntry() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [entries, setEntries] = useState(() => initEntries());
  const [metadata, setMetadata] = useState({ invoiceNo: '', invoiceDate: '', invoiceAmount: 0 });
  const [denomination, setDenomination] = useState(initDenomination());
  const [openingStock, setOpeningStock] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showDenomination, setShowDenomination] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  function initEntries() {
    return DEFAULT_PRODUCTS.map(p => ({
      productId: p.id,
      sno: p.sno,
      codeNo: p.codeNo,
      particular: p.particular,
      category: p.category,
      cases: 0,
      bottles: 0,
      openingStock: 0,
      purchase: 0,
      stockReturn: 0,
      rate: p.rate
    }));
  }

  function initDenomination() {
    return {
      notes: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 },
      coins: 0
    };
  }

  // Load data for selected date
  const loadData = async () => {
    try {
      const [entryRes, osRes, denomRes] = await Promise.all([
        api.get(`/daily-entry/${selectedDate}`),
        api.get(`/daily-entry/${selectedDate}/opening-stock`),
        api.get(`/denomination/${selectedDate}`)
      ]);

      const savedEntries = entryRes.data.entries;
      const os = osRes.data.openingStock || {};
      setOpeningStock(os);

      if (savedEntries && savedEntries.length > 0) {
        setEntries(savedEntries.map(e => ({ ...e, openingStock: os[e.productId] || e.openingStock || 0 })));
      } else {
        // No saved data - initialize with opening stock
        setEntries(DEFAULT_PRODUCTS.map(p => ({
          productId: p.id,
          sno: p.sno,
          codeNo: p.codeNo,
          particular: p.particular,
          category: p.category,
          cases: 0,
          bottles: 0,
          openingStock: os[p.id] || 0,
          purchase: 0,
          stockReturn: 0,
          rate: p.rate
        })));
      }

      if (entryRes.data.metadata) {
        setMetadata(entryRes.data.metadata);
      }

      if (denomRes.data.denomination) {
        const d = denomRes.data.denomination;
        setDenomination({
          notes: {
            500: d.notes?.[500]?.count || 0,
            200: d.notes?.[200]?.count || 0,
            100: d.notes?.[100]?.count || 0,
            50: d.notes?.[50]?.count || 0,
            20: d.notes?.[20]?.count || 0,
            10: d.notes?.[10]?.count || 0
          },
          coins: d.coins || 0
        });
      }

      setDataLoaded(true);
      setSaveMsg('Data loaded successfully');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      console.error('Load error:', err);
      setSaveMsg('Failed to load data. Using defaults.');
      setDataLoaded(true);
    }
  };

  // Calculate values for an entry
  const calcEntry = useCallback((entry) => {
    const caseSize = CATEGORIES[entry.category]?.bottlesPerCase || 48;
    const clst = (entry.cases || 0) * caseSize + (entry.bottles || 0);
    const total = (entry.openingStock || 0) + (entry.purchase || 0) - (entry.stockReturn || 0);
    const sales = total - clst;
    const rate = entry.rate || 0;
    return {
      clst,
      total,
      sales,
      salesAmt: sales * rate,
      clValue: clst * rate,
      opValue: (entry.openingStock || 0) * rate,
      purchaseValue: (entry.purchase || 0) * rate,
      stockReturnValue: (entry.stockReturn || 0) * rate
    };
  }, []);

  // Totals
  const totals = useMemo(() => {
    let totalSales = 0, totalPurchaseValue = 0, totalClValue = 0;
    entries.forEach(e => {
      const calc = calcEntry(e);
      totalSales += calc.salesAmt;
      totalPurchaseValue += calc.purchaseValue;
      totalClValue += calc.clValue;
    });
    return { totalSales, totalPurchaseValue, totalClValue };
  }, [entries, calcEntry]);

  // Denomination total
  const totalCash = useMemo(() => {
    let total = denomination.coins || 0;
    [500, 200, 100, 50, 20, 10].forEach(note => {
      total += (denomination.notes[note] || 0) * note;
    });
    return total;
  }, [denomination]);

  // Validation: cash matches sales
  const cashMatch = Math.abs(totalCash - totals.totalSales) < 1;

  // Update entry field
  const updateEntry = (productId, field, value) => {
    setEntries(prev => prev.map(e =>
      e.productId === productId ? { ...e, [field]: Number(value) || 0 } : e
    ));
  };

  // Filter entries by category
  const filteredEntries = useMemo(() => {
    if (selectedCategory === 'ALL') return entries;
    return entries.filter(e => e.category === selectedCategory);
  }, [entries, selectedCategory]);

  // Save data
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Add calculated values to entries before saving
      const enrichedEntries = entries.map(e => {
        const calc = calcEntry(e);
        return { ...e, ...calc };
      });

      await api.post(`/daily-entry/${selectedDate}`, {
        entries: enrichedEntries,
        metadata: { ...metadata, invoiceAmount: totals.totalSales }
      });

      // Save denomination
      const denomPayload = {
        notes: Object.fromEntries(
          Object.entries(denomination.notes).map(([k, v]) => [k, { count: v }])
        ),
        coins: denomination.coins
      };
      await api.post(`/denomination/${selectedDate}`, denomPayload);

      setSaveMsg('Saved successfully!');
    } catch (err) {
      setSaveMsg('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const enrichedEntries = entries.map(e => {
        const calc = calcEntry(e);
        return { ...e, ...calc };
      });

      const response = await api.post('/export/daily', {
        date: selectedDate,
        entries: enrichedEntries,
        metadata: { ...metadata, invoiceAmount: totals.totalSales },
        denomination: {
          notes: Object.fromEntries(
            Object.entries(denomination.notes).map(([k, v]) => [k, { count: v }])
          ),
          coins: denomination.coins,
          totalCash
        }
      }, { responseType: 'blob' });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      const dateObj = new Date(selectedDate);
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const sheetName = `${months[dateObj.getMonth()]}-${String(dateObj.getDate()).padStart(2,'0')}`;
      a.download = `TASMAC_1745_${sheetName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Date Selection & Controls */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
        </div>
        <button onClick={loadData} className="btn-primary" style={{ height: '48px' }}>
          Load Data
        </button>
        <button onClick={handleSave} className="btn-success" disabled={saving} style={{ height: '48px' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={handleExport} className="btn-warning" disabled={exporting} style={{ height: '48px' }}>
          {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
        <button
          onClick={() => setShowDenomination(!showDenomination)}
          className="btn-secondary"
          style={{ height: '48px' }}
        >
          {showDenomination ? 'Hide Cash' : 'Cash Counter'}
        </button>
      </div>

      {saveMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          marginBottom: '12px',
          background: saveMsg.includes('fail') || saveMsg.includes('Failed') ? '#ffebee' : '#e8f5e9',
          color: saveMsg.includes('fail') || saveMsg.includes('Failed') ? '#c62828' : '#2e7d32',
          fontWeight: '600'
        }}>
          {saveMsg}
        </div>
      )}

      {/* Summary Bar */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Total Sales</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1a237e' }}>
            ₹{formatINR(totals.totalSales)}
          </div>
        </div>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Purchase Value</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ff6f00' }}>
            ₹{formatINR(totals.totalPurchaseValue)}
          </div>
        </div>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Closing Stock Value</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#2e7d32' }}>
            ₹{formatINR(totals.totalClValue)}
          </div>
        </div>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Cash Collected</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: cashMatch ? '#2e7d32' : '#c62828' }}>
            ₹{formatINR(totalCash)}
          </div>
        </div>
      </div>

      {/* Validation Indicator */}
      {totalCash > 0 && (
        <div className={cashMatch ? 'card status-match' : 'card status-mismatch'} 
             style={{ textAlign: 'center', padding: '12px', fontSize: '1rem', fontWeight: '700' }}>
          {cashMatch ? (
            <span>✅ CASH MATCHES SALES — All Good!</span>
          ) : (
            <span>⚠️ MISMATCH: Cash ₹{formatINR(totalCash)} vs Sales ₹{formatINR(totals.totalSales)} (Diff: ₹{formatINR(Math.abs(totalCash - totals.totalSales))})</span>
          )}
        </div>
      )}

      {/* Denomination Counter */}
      {showDenomination && (
        <DenominationCounter
          denomination={denomination}
          setDenomination={setDenomination}
          totalCash={totalCash}
          totalSales={totals.totalSales}
        />
      )}

      {/* Invoice Metadata */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Invoice Details</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Invoice No</label>
            <input
              type="text"
              value={metadata.invoiceNo || ''}
              onChange={(e) => setMetadata(m => ({ ...m, invoiceNo: e.target.value }))}
              placeholder="Invoice number"
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Invoice Date</label>
            <input
              type="date"
              value={metadata.invoiceDate || selectedDate}
              onChange={(e) => setMetadata(m => ({ ...m, invoiceDate: e.target.value }))}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Invoice Amount (Auto)</label>
            <input
              type="text"
              value={`₹${formatINR(totals.totalSales)}`}
              readOnly
              style={{ background: '#f5f5f5' }}
            />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Category:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: selectedCategory === 'ALL' ? '2px solid #1a237e' : '1px solid #e0e0e0',
              background: selectedCategory === 'ALL' ? '#1a237e' : 'white',
              color: selectedCategory === 'ALL' ? 'white' : '#333',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            All ({entries.length})
          </button>
          {CATEGORY_ORDER.map(catKey => {
            const count = entries.filter(e => e.category === catKey).length;
            const isActive = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isActive ? '2px solid #1a237e' : '1px solid #e0e0e0',
                  background: isActive ? '#1a237e' : 'white',
                  color: isActive ? 'white' : '#333',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {CATEGORIES[catKey].label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Entry Table */}
      <div className="card" style={{ padding: '8px' }}>
        <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Code</th>
                <th>Product</th>
                <th style={{ background: '#ff6f00' }}>CASE</th>
                <th style={{ background: '#ff6f00' }}>BOTTLE</th>
                <th>OP.ST</th>
                <th style={{ background: '#ff6f00' }}>PURCHASE</th>
                <th style={{ background: '#ff6f00' }}>ST.RETURN</th>
                <th>TOTAL</th>
                <th>CL.ST</th>
                <th>SALES</th>
                <th style={{ background: '#ff6f00' }}>RATE</th>
                <th>SALES AMT</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const calc = calcEntry(entry);
                return (
                  <tr key={entry.productId}>
                    <td>{entry.sno}</td>
                    <td>{entry.codeNo}</td>
                    <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{entry.particular}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={entry.cases || ''}
                        onChange={(e) => updateEntry(entry.productId, 'cases', e.target.value)}
                        style={{ width: '60px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={entry.bottles || ''}
                        onChange={(e) => updateEntry(entry.productId, 'bottles', e.target.value)}
                        style={{ width: '60px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ background: '#e3f2fd', fontWeight: '600' }}>
                      {entry.openingStock}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={entry.purchase || ''}
                        onChange={(e) => updateEntry(entry.productId, 'purchase', e.target.value)}
                        style={{ width: '60px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={entry.stockReturn || ''}
                        onChange={(e) => updateEntry(entry.productId, 'stockReturn', e.target.value)}
                        style={{ width: '50px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ background: '#f5f5f5' }}>{calc.total}</td>
                    <td style={{ background: '#e8f5e9', fontWeight: '600' }}>{calc.clst}</td>
                    <td style={{ 
                      fontWeight: '700',
                      color: calc.sales < 0 ? '#c62828' : calc.sales > 0 ? '#2e7d32' : '#757575'
                    }}>
                      {calc.sales}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={entry.rate || ''}
                        onChange={(e) => updateEntry(entry.productId, 'rate', e.target.value)}
                        style={{ width: '70px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                      />
                    </td>
                    <td style={{ 
                      fontWeight: '700',
                      color: calc.salesAmt > 0 ? '#1a237e' : calc.salesAmt < 0 ? '#c62828' : '#757575'
                    }}>
                      {calc.salesAmt > 0 ? `₹${formatINR(calc.salesAmt)}` : calc.salesAmt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
