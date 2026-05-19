import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import DenominationCounter from '../components/DenominationCounter';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

export default function DailyEntry() {
  const { authenticated } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [entries, setEntries] = useState(() => initEntries());
  const [metadata, setMetadata] = useState({ invoiceNo: '', invoiceDate: '', invoiceAmount: 0 });
  const [denomination, setDenomination] = useState(initDenomination());
  const [posAmount, setPosAmount] = useState(0);
  const [openingStock, setOpeningStock] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showDenomination, setShowDenomination] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);


  // Device vs Manual comparison state
  const [deviceValues, setDeviceValues] = useState({
    salesBottles: 0,
    closingBottles: 0,
    salesValue: 0,
    closingValue: 0
  });

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
        setEntries(DEFAULT_PRODUCTS.map(p => ({
          productId: p.id, sno: p.sno, codeNo: p.codeNo,
          particular: p.particular, category: p.category,
          cases: 0, bottles: 0, openingStock: os[p.id] || 0,
          purchase: 0, stockReturn: 0, rate: p.rate
        })));
      }

      if (entryRes.data.metadata) setMetadata(entryRes.data.metadata);
      if (entryRes.data.posAmount != null) setPosAmount(entryRes.data.posAmount);
      if (entryRes.data.deviceValues) setDeviceValues(entryRes.data.deviceValues);

      if (denomRes.data.denomination) {
        const d = denomRes.data.denomination;
        setDenomination({
          notes: {
            500: d.notes?.[500]?.count || 0, 200: d.notes?.[200]?.count || 0,
            100: d.notes?.[100]?.count || 0, 50: d.notes?.[50]?.count || 0,
            20: d.notes?.[20]?.count || 0, 10: d.notes?.[10]?.count || 0
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
      clst, total, sales,
      salesAmt: sales * rate,
      clValue: clst * rate,
      opValue: (entry.openingStock || 0) * rate,
      purchaseValue: (entry.purchase || 0) * rate,
      stockReturnValue: (entry.stockReturn || 0) * rate
    };
  }, []);

  // Grand totals per category and overall
  const categoryTotals = useMemo(() => {
    const totals = {};
    let grandTotal = 0;
    CATEGORY_ORDER.forEach(catKey => {
      const catEntries = entries.filter(e => e.category === catKey);
      const catSalesAmt = catEntries.reduce((sum, e) => sum + calcEntry(e).salesAmt, 0);
      totals[catKey] = catSalesAmt;
      grandTotal += catSalesAmt;
    });
    totals.GRAND_TOTAL = grandTotal;
    return totals;
  }, [entries, calcEntry]);

  // Overall totals
  const totals = useMemo(() => {
    let totalSales = 0, totalPurchaseValue = 0, totalClValue = 0;
    let totalSalesBottles = 0, totalClosingBottles = 0;
    entries.forEach(e => {
      const calc = calcEntry(e);
      totalSales += calc.salesAmt;
      totalPurchaseValue += calc.purchaseValue;
      totalClValue += calc.clValue;
      totalSalesBottles += calc.sales > 0 ? calc.sales : 0;
      totalClosingBottles += calc.clst;
    });
    return { totalSales, totalPurchaseValue, totalClValue, totalSalesBottles, totalClosingBottles };
  }, [entries, calcEntry]);


  // Denomination total
  const totalCash = useMemo(() => {
    let total = denomination.coins || 0;
    [500, 200, 100, 50, 20, 10].forEach(note => {
      total += (denomination.notes[note] || 0) * note;
    });
    return total;
  }, [denomination]);

  // NEW validation: Cash + POS = Grand Total Sales
  const cashPlusPOS = totalCash + posAmount;
  const cashMatch = Math.abs(cashPlusPOS - totals.totalSales) < 1;

  // Device vs Manual comparison
  const manualValues = useMemo(() => ({
    salesBottles: totals.totalSalesBottles,
    closingBottles: totals.totalClosingBottles,
    salesValue: totals.totalSales,
    closingValue: totals.totalClValue
  }), [totals]);

  const deviceDifferences = useMemo(() => ({
    salesBottles: (deviceValues.salesBottles || 0) - manualValues.salesBottles,
    closingBottles: (deviceValues.closingBottles || 0) - manualValues.closingBottles,
    salesValue: (deviceValues.salesValue || 0) - manualValues.salesValue,
    closingValue: (deviceValues.closingValue || 0) - manualValues.closingValue
  }), [deviceValues, manualValues]);

  const allDeviceMatched = Object.values(deviceDifferences).every(d => Math.abs(d) < 1);

  // Check for negative sales entries
  const negativeSalesEntries = useMemo(() => {
    return entries.filter(e => calcEntry(e).sales < 0).map(e => e.productId);
  }, [entries, calcEntry]);

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


  // Save data - requires PIN auth
  const handleSave = async () => {
    if (!authenticated) {
      setSaveMsg('PIN required to save. Please login first.');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const enrichedEntries = entries.map(e => {
        const calc = calcEntry(e);
        return { ...e, ...calc };
      });

      await api.post(`/daily-entry/${selectedDate}`, {
        entries: enrichedEntries,
        metadata: { ...metadata, invoiceAmount: totals.totalSales },
        posAmount,
        deviceValues
      });

      const denomPayload = {
        notes: Object.fromEntries(
          Object.entries(denomination.notes).map(([k, v]) => [k, { count: v }])
        ),
        coins: denomination.coins
      };
      await api.post(`/denomination/${selectedDate}`, denomPayload);

      setSaveMsg('Saved successfully!');
    } catch (err) {
      if (err.response?.status === 401) {
        setSaveMsg('PIN expired. Please login again.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setSaveMsg('Save failed: ' + (err.response?.data?.error || err.message));
      }
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
        posAmount,
        deviceValues,
        denomination: {
          notes: Object.fromEntries(
            Object.entries(denomination.notes).map(([k, v]) => [k, { count: v }])
          ),
          coins: denomination.coins,
          totalCash
        }
      }, { responseType: 'blob' });

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
          {saving ? 'Saving...' : authenticated ? 'Save' : '🔒 Save (PIN needed)'}
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
        {!authenticated && (
          <button onClick={() => navigate('/login')} className="btn-primary" style={{ height: '48px', background: '#ff6f00' }}>
            🔑 Enter PIN
          </button>
        )}
      </div>


      {saveMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', marginBottom: '12px',
          background: saveMsg.includes('fail') || saveMsg.includes('Failed') || saveMsg.includes('required') || saveMsg.includes('expired') ? '#ffebee' : '#e8f5e9',
          color: saveMsg.includes('fail') || saveMsg.includes('Failed') || saveMsg.includes('required') || saveMsg.includes('expired') ? '#c62828' : '#2e7d32',
          fontWeight: '600'
        }}>
          {saveMsg}
        </div>
      )}

      {/* Summary Bar */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Grand Total Sales</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1a237e' }}>
            ₹{formatINR(totals.totalSales)}
          </div>
        </div>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>POS (Card/GPay)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1565c0' }}>
            ₹{formatINR(posAmount)}
          </div>
        </div>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Cash Collected</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: cashMatch ? '#2e7d32' : '#c62828' }}>
            ₹{formatINR(totalCash)}
          </div>
        </div>
        <div style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#757575' }}>Remittance (Bank)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#e65100' }}>
            ₹{formatINR(totals.totalSales - posAmount)}
          </div>
        </div>
      </div>


      {/* Validation Indicator: Cash + POS = Grand Total */}
      {(totalCash > 0 || posAmount > 0) && (
        <div className={cashMatch ? 'card status-match' : 'card status-mismatch'} 
             style={{ textAlign: 'center', padding: '12px', fontSize: '1rem', fontWeight: '700' }}>
          {cashMatch ? (
            <span>✅ CASH + POS MATCHES GRAND TOTAL SALES — All Good!</span>
          ) : (
            <span>⚠️ MISMATCH: Cash+POS ₹{formatINR(cashPlusPOS)} vs Sales ₹{formatINR(totals.totalSales)} (Diff: ₹{formatINR(Math.abs(cashPlusPOS - totals.totalSales))})</span>
          )}
        </div>
      )}

      {/* Negative Sales Warning */}
      {negativeSalesEntries.length > 0 && (
        <div className="card" style={{ background: '#ffebee', border: '2px solid #c62828', padding: '12px' }}>
          <div style={{ fontWeight: '700', color: '#c62828', marginBottom: '8px', fontSize: '1rem' }}>
            ⚠️ NEGATIVE SALES WARNING ({negativeSalesEntries.length} items)
          </div>
          <div style={{ fontSize: '0.85rem', color: '#c62828' }}>
            {entries.filter(e => negativeSalesEntries.includes(e.productId)).map(e => (
              <span key={e.productId} style={{ display: 'inline-block', margin: '2px 6px 2px 0', padding: '2px 8px', background: '#ffcdd2', borderRadius: '4px' }}>
                {e.particular} ({calcEntry(e).sales})
              </span>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#757575', marginTop: '6px' }}>
            SALES = OP.ST + PURCHASE - STOCK_RETURN - CL.ST. Check data for these items.
          </div>
        </div>
      )}

      {/* Denomination Counter */}
      {showDenomination && (
        <DenominationCounter
          denomination={denomination}
          setDenomination={setDenomination}
          totalCash={totalCash}
          totalSales={totals.totalSales}
          posAmount={posAmount}
          setPosAmount={setPosAmount}
        />
      )}


      {/* Device vs Manual Comparison */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>
          📱 Device vs Manual Comparison
        </h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#757575' }}>
            Enter DEVICE values:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Sales Bottles</label>
              <input type="number" min="0" value={deviceValues.salesBottles || ''}
                onChange={(e) => setDeviceValues(p => ({ ...p, salesBottles: Number(e.target.value) || 0 }))}
                placeholder="0" style={{ padding: '10px', textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Closing Bottles</label>
              <input type="number" min="0" value={deviceValues.closingBottles || ''}
                onChange={(e) => setDeviceValues(p => ({ ...p, closingBottles: Number(e.target.value) || 0 }))}
                placeholder="0" style={{ padding: '10px', textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Sales Value (₹)</label>
              <input type="number" min="0" value={deviceValues.salesValue || ''}
                onChange={(e) => setDeviceValues(p => ({ ...p, salesValue: Number(e.target.value) || 0 }))}
                placeholder="0" style={{ padding: '10px', textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Closing Value (₹)</label>
              <input type="number" min="0" value={deviceValues.closingValue || ''}
                onChange={(e) => setDeviceValues(p => ({ ...p, closingValue: Number(e.target.value) || 0 }))}
                placeholder="0" style={{ padding: '10px', textAlign: 'center' }} />
            </div>
          </div>
        </div>


        {/* Comparison Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#e3f2fd' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Source</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Sales Bottles</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Closing Bottles</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Sales Value</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Closing Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px', fontWeight: '600' }}>📱 DEVICE</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{deviceValues.salesBottles || 0}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{deviceValues.closingBottles || 0}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>₹{formatINR(deviceValues.salesValue || 0)}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>₹{formatINR(deviceValues.closingValue || 0)}</td>
              </tr>
              <tr style={{ background: '#f5f5f5' }}>
                <td style={{ padding: '8px', fontWeight: '600' }}>📝 MANUAL</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{manualValues.salesBottles}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{manualValues.closingBottles}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>₹{formatINR(manualValues.salesValue)}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>₹{formatINR(manualValues.closingValue)}</td>
              </tr>
              <tr style={{ background: allDeviceMatched ? '#e8f5e9' : '#ffebee', fontWeight: '700' }}>
                <td style={{ padding: '8px', color: allDeviceMatched ? '#2e7d32' : '#c62828' }}>DIFFERENCE</td>
                <td style={{ padding: '8px', textAlign: 'center', color: Math.abs(deviceDifferences.salesBottles) < 1 ? '#2e7d32' : '#c62828' }}>{deviceDifferences.salesBottles}</td>
                <td style={{ padding: '8px', textAlign: 'center', color: Math.abs(deviceDifferences.closingBottles) < 1 ? '#2e7d32' : '#c62828' }}>{deviceDifferences.closingBottles}</td>
                <td style={{ padding: '8px', textAlign: 'center', color: Math.abs(deviceDifferences.salesValue) < 1 ? '#2e7d32' : '#c62828' }}>₹{formatINR(Math.abs(deviceDifferences.salesValue))}</td>
                <td style={{ padding: '8px', textAlign: 'center', color: Math.abs(deviceDifferences.closingValue) < 1 ? '#2e7d32' : '#c62828' }}>₹{formatINR(Math.abs(deviceDifferences.closingValue))}</td>
              </tr>
            </tbody>
          </table>
        </div>


        {/* Match/Mismatch indicator */}
        {(deviceValues.salesBottles > 0 || deviceValues.closingBottles > 0 || deviceValues.salesValue > 0 || deviceValues.closingValue > 0) && (
          <div style={{
            marginTop: '12px', padding: '10px', borderRadius: '8px', textAlign: 'center', fontWeight: '700',
            background: allDeviceMatched ? '#e8f5e9' : '#ffebee',
            color: allDeviceMatched ? '#2e7d32' : '#c62828',
            border: `2px solid ${allDeviceMatched ? '#2e7d32' : '#c62828'}`
          }}>
            {allDeviceMatched ? '✅ All Matched — Device and Manual values are identical' : '⚠️ WARNING: Device and Manual values DO NOT match! Please check entries.'}
          </div>
        )}
      </div>

      {/* Invoice Metadata */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Invoice Details</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Invoice No</label>
            <input type="text" value={metadata.invoiceNo || ''}
              onChange={(e) => setMetadata(m => ({ ...m, invoiceNo: e.target.value }))}
              placeholder="Invoice number" />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Invoice Date</label>
            <input type="date" value={metadata.invoiceDate || selectedDate}
              onChange={(e) => setMetadata(m => ({ ...m, invoiceDate: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Invoice Amount (Auto)</label>
            <input type="text" value={`₹${formatINR(totals.totalSales)}`} readOnly style={{ background: '#f5f5f5' }} />
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
              padding: '6px 14px', borderRadius: '20px',
              border: selectedCategory === 'ALL' ? '2px solid #1a237e' : '1px solid #e0e0e0',
              background: selectedCategory === 'ALL' ? '#1a237e' : 'white',
              color: selectedCategory === 'ALL' ? 'white' : '#333',
              fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            All ({entries.length})
          </button>
          {CATEGORY_ORDER.map(catKey => {
            const count = entries.filter(e => e.category === catKey).length;
            const isActive = selectedCategory === catKey;
            return (
              <button key={catKey} onClick={() => setSelectedCategory(catKey)}
                style={{
                  padding: '6px 14px', borderRadius: '20px',
                  border: isActive ? '2px solid #1a237e' : '1px solid #e0e0e0',
                  background: isActive ? '#1a237e' : 'white',
                  color: isActive ? 'white' : '#333',
                  fontSize: '0.8rem', cursor: 'pointer'
                }}>
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
                const isNegativeSales = calc.sales < 0;
                return (
                  <tr key={entry.productId} style={isNegativeSales ? { background: '#ffebee' } : {}}>
                    <td>{entry.sno}</td>
                    <td>{entry.codeNo}</td>
                    <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                      {entry.particular}
                      {isNegativeSales && <span style={{ color: '#c62828', fontSize: '0.7rem', marginLeft: '4px' }}>⚠️</span>}
                    </td>
                    <td>
                      <input type="number" min="0" value={entry.cases || ''}
                        onChange={(e) => updateEntry(entry.productId, 'cases', e.target.value)}
                        style={{ width: '60px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0" />
                    </td>
                    <td>
                      <input type="number" min="0" value={entry.bottles || ''}
                        onChange={(e) => updateEntry(entry.productId, 'bottles', e.target.value)}
                        style={{ width: '60px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0" />
                    </td>
                    <td style={{ background: '#e3f2fd', fontWeight: '600' }}>{entry.openingStock}</td>

                    <td>
                      <input type="number" min="0" value={entry.purchase || ''}
                        onChange={(e) => updateEntry(entry.productId, 'purchase', e.target.value)}
                        style={{ width: '60px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0" />
                    </td>
                    <td>
                      <input type="number" min="0" value={entry.stockReturn || ''}
                        onChange={(e) => updateEntry(entry.productId, 'stockReturn', e.target.value)}
                        style={{ width: '50px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }}
                        placeholder="0" />
                    </td>
                    <td style={{ background: '#f5f5f5' }}>{calc.total}</td>
                    <td style={{ background: '#e8f5e9', fontWeight: '600' }}>{calc.clst}</td>
                    <td style={{ 
                      fontWeight: '700',
                      color: isNegativeSales ? '#c62828' : calc.sales > 0 ? '#2e7d32' : '#757575',
                      background: isNegativeSales ? '#ffcdd2' : 'transparent'
                    }}>
                      {calc.sales}
                      {isNegativeSales && ' ⚠️'}
                    </td>
                    <td>
                      <input type="number" min="0" value={entry.rate || ''}
                        onChange={(e) => updateEntry(entry.productId, 'rate', e.target.value)}
                        style={{ width: '70px', padding: '8px', textAlign: 'center', border: '2px solid #ff6f00' }} />
                    </td>
                    <td style={{ 
                      fontWeight: '700',
                      color: calc.salesAmt > 0 ? '#1a237e' : calc.salesAmt < 0 ? '#c62828' : '#757575'
                    }}>
                      {calc.salesAmt !== 0 ? `₹${formatINR(calc.salesAmt)}` : 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


        {/* Category Subtotal */}
        {selectedCategory !== 'ALL' && (
          <div style={{
            marginTop: '12px', padding: '12px', background: '#e8eaf6',
            borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontWeight: '600', color: '#1a237e' }}>
              {CATEGORIES[selectedCategory]?.label} Subtotal:
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1a237e' }}>
              ₹{formatINR(categoryTotals[selectedCategory] || 0)}
            </span>
          </div>
        )}
      </div>

      {/* Grand Total per Category (shown when viewing ALL) */}
      {selectedCategory === 'ALL' && (
        <div className="card">
          <h3 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>
            📊 Grand Total by Category
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {CATEGORY_ORDER.map(catKey => (
              <div key={catKey} style={{
                padding: '10px', background: '#f5f5f5', borderRadius: '8px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{CATEGORIES[catKey].label}</span>
                <span style={{ fontWeight: '700', color: '#1a237e', fontSize: '0.9rem' }}>
                  ₹{formatINR(categoryTotals[catKey] || 0)}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '12px', padding: '14px', background: '#1a237e', borderRadius: '8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'white' }}>
              GRAND TOTAL (All Categories)
            </span>
            <span style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffeb3b' }}>
              ₹{formatINR(categoryTotals.GRAND_TOTAL || 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
