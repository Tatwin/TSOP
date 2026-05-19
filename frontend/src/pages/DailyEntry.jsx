import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import CaseAbstract from '../components/CaseAbstract';
import DenominationCounter from '../components/DenominationCounter';

function formatDate(d) { return d.toISOString().split('T')[0]; }
function formatINR(num) { return new Intl.NumberFormat('en-IN').format(num); }

export default function DailyEntry() {
  const { authenticated } = useAuth();
  const navigate = useNavigate();

  // Core state
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [entries, setEntries] = useState(() => initEntries());
  const [denomination, setDenomination] = useState({ notes: { 500:0,200:0,100:0,50:0,20:0,10:0 }, coins: 0 });
  const [posAmount, setPosAmount] = useState(0);
  const [deviceValues, setDeviceValues] = useState({ salesBottles:0, closingBottles:0, salesValue:0, closingValue:0 });

  // UI state
  const [mode, setMode] = useState('sequential'); // 'sequential' | 'table' | 'summary' | 'openingStock'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [savingOS, setSavingOS] = useState(false);

  // Refs for auto-focus
  const caseInputRef = useRef(null);
  const bottleInputRef = useRef(null);

  function initEntries() {
    return DEFAULT_PRODUCTS.map(p => ({
      productId: p.id, sno: p.sno, codeNo: p.codeNo,
      particular: p.particular, category: p.category,
      cases: 0, bottles: 0, openingStock: 0,
      purchase: 0, stockReturn: 0, rate: p.rate
    }));
  }

  // Active products: has opening stock OR purchase > 0
  const activeEntries = useMemo(() => {
    return entries.filter(e => (e.openingStock || 0) > 0 || (e.purchase || 0) > 0);
  }, [entries]);

  // Current entry in sequential mode
  const currentEntry = activeEntries[currentIndex] || null;

  // Calculate values for any entry
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

  // Totals
  const totals = useMemo(() => {
    let totalSales = 0, totalPurchaseValue = 0, totalClValue = 0;
    let totalSalesBottles = 0, totalClosingBottles = 0;
    entries.forEach(e => {
      const calc = calcEntry(e);
      totalSales += calc.salesAmt;
      totalPurchaseValue += calc.purchaseValue;
      totalClValue += calc.clValue;
      if (calc.sales > 0) totalSalesBottles += calc.sales;
      totalClosingBottles += calc.clst;
    });
    return { totalSales, totalPurchaseValue, totalClValue, totalSalesBottles, totalClosingBottles };
  }, [entries, calcEntry]);

  const totalCash = useMemo(() => {
    let t = denomination.coins || 0;
    [500,200,100,50,20,10].forEach(n => { t += (denomination.notes[n] || 0) * n; });
    return t;
  }, [denomination]);

  const cashPlusPOS = totalCash + posAmount;
  const cashMatch = Math.abs(cashPlusPOS - totals.totalSales) < 1;
  const remittance = totals.totalSales - posAmount;

  // Device comparison
  const manualValues = { salesBottles: totals.totalSalesBottles, closingBottles: totals.totalClosingBottles, salesValue: totals.totalSales, closingValue: totals.totalClValue };
  const deviceDiff = {
    salesBottles: (deviceValues.salesBottles||0) - manualValues.salesBottles,
    closingBottles: (deviceValues.closingBottles||0) - manualValues.closingBottles,
    salesValue: (deviceValues.salesValue||0) - manualValues.salesValue,
    closingValue: (deviceValues.closingValue||0) - manualValues.closingValue
  };
  const allDeviceMatched = Object.values(deviceDiff).every(d => Math.abs(d) < 1);

  // Load data
  const loadData = async () => {
    try {
      const [entryRes, osRes, denomRes] = await Promise.all([
        api.get(`/daily-entry/${selectedDate}`),
        api.get(`/daily-entry/${selectedDate}/opening-stock`),
        api.get(`/denomination/${selectedDate}`)
      ]);
      const os = osRes.data.openingStock || {};
      const savedEntries = entryRes.data.entries;

      if (savedEntries?.length > 0) {
        setEntries(savedEntries.map(e => ({ ...e, openingStock: os[e.productId] || e.openingStock || 0 })));
      } else {
        setEntries(DEFAULT_PRODUCTS.map(p => ({
          productId: p.id, sno: p.sno, codeNo: p.codeNo,
          particular: p.particular, category: p.category,
          cases: 0, bottles: 0, openingStock: os[p.id] || 0,
          purchase: 0, stockReturn: 0, rate: p.rate
        })));
      }
      if (entryRes.data.posAmount != null) setPosAmount(entryRes.data.posAmount);
      if (entryRes.data.deviceValues) setDeviceValues(entryRes.data.deviceValues);
      if (denomRes.data.denomination) {
        const d = denomRes.data.denomination;
        setDenomination({
          notes: { 500: d.notes?.[500]?.count||0, 200: d.notes?.[200]?.count||0, 100: d.notes?.[100]?.count||0, 50: d.notes?.[50]?.count||0, 20: d.notes?.[20]?.count||0, 10: d.notes?.[10]?.count||0 },
          coins: d.coins || 0
        });
      }
      setDataLoaded(true);
      setCurrentIndex(0);
      setSaveMsg('Data loaded');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setSaveMsg('Failed to load');
      setDataLoaded(true);
    }
  };

  // Save
  const handleSave = async () => {
    if (!authenticated) { navigate('/login'); return; }
    setSaving(true);
    try {
      const enriched = entries.map(e => ({ ...e, ...calcEntry(e) }));
      await api.post(`/daily-entry/${selectedDate}`, { entries: enriched, posAmount, deviceValues });
      await api.post(`/denomination/${selectedDate}`, {
        notes: Object.fromEntries(Object.entries(denomination.notes).map(([k,v]) => [k, {count:v}])),
        coins: denomination.coins
      });
      setSaveMsg('Saved successfully!');
    } catch { setSaveMsg('Save failed'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000); }
  };

  // Export
  const handleExport = async () => {
    try {
      const enriched = entries.map(e => ({ ...e, ...calcEntry(e) }));
      const res = await api.post('/export/daily', {
        date: selectedDate, entries: enriched,
        metadata: { invoiceAmount: totals.totalSales }, posAmount, deviceValues,
        denomination: { notes: Object.fromEntries(Object.entries(denomination.notes).map(([k,v])=>[k,{count:v}])), coins: denomination.coins, totalCash }
      }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      const d = new Date(selectedDate);
      a.download = `TASMAC_1745_${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()]}-${String(d.getDate()).padStart(2,'0')}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { alert('Export failed'); }
  };

  // Save Opening Stock
  const handleSaveOpeningStock = async () => {
    if (!authenticated) { navigate('/login'); return; }
    setSavingOS(true);
    try {
      const openingStockData = {};
      entries.forEach(e => {
        if (e.openingStock > 0) {
          openingStockData[e.productId] = e.openingStock;
        }
      });
      await api.post(`/daily-entry/${selectedDate}/opening-stock`, { openingStock: openingStockData });
      setSaveMsg('Opening stock saved successfully');
    } catch { setSaveMsg('Failed to save opening stock'); }
    finally { setSavingOS(false); setTimeout(() => setSaveMsg(''), 3000); }
  };

  // Update opening stock for a product
  const updateOpeningStock = (productId, value) => {
    setEntries(prev => prev.map(e =>
      e.productId === productId ? { ...e, openingStock: Number(value) || 0 } : e
    ));
  };

  // Sequential mode: update current entry
  const updateCurrentEntry = (field, value) => {
    if (!currentEntry) return;
    setEntries(prev => prev.map(e =>
      e.productId === currentEntry.productId ? { ...e, [field]: Number(value) || 0 } : e
    ));
  };

  // Handle Enter key in sequential mode
  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      if (field === 'cases') {
        bottleInputRef.current?.focus();
      } else if (field === 'bottles') {
        // Move to next product
        if (currentIndex < activeEntries.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setTimeout(() => caseInputRef.current?.focus(), 50);
        }
      }
    }
  };

  // Focus case input when index changes
  useEffect(() => {
    if (mode === 'sequential') {
      setTimeout(() => caseInputRef.current?.focus(), 100);
    }
  }, [currentIndex, mode]);

  // Current entry calculations
  const currentCalc = currentEntry ? calcEntry(currentEntry) : null;

  return (
    <div>
      {/* Top Controls */}
      <div className="card">
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div className="flex-between flex-wrap gap-12">
            <div className="flex gap-12" style={{ alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Date</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                  style={{ width: 160, padding: '8px 12px' }} />
              </div>
              <button className="btn-primary" onClick={loadData} style={{ marginTop: 18 }}>
                Load Data
              </button>
            </div>

            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              {/* Mode switcher */}
              <div className="flex gap-4" style={{ background: '#f5f8fa', borderRadius: 8, padding: 3 }}>
                {[{id:'sequential',label:'Entry'},{id:'openingStock',label:'Opening Stock'},{id:'summary',label:'Summary'},{id:'table',label:'Table'}].map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    style={{
                      padding: '6px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, border: 'none',
                      background: mode === m.id ? 'var(--primary)' : 'transparent',
                      color: mode === m.id ? 'white' : 'var(--text-gray)', cursor: 'pointer'
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <button className="btn-success" onClick={handleSave} disabled={saving}>
                {saving ? '...' : authenticated ? 'Save' : 'Login to Save'}
              </button>
              <button className="btn-warning" onClick={handleExport}>Export</button>
            </div>
          </div>

          {saveMsg && (
            <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8,
              background: saveMsg.includes('fail') || saveMsg.includes('Failed') ? '#fff5f8' : '#e8fff3',
              color: saveMsg.includes('fail') || saveMsg.includes('Failed') ? 'var(--danger)' : 'var(--success)',
              fontWeight: 600, fontSize: '0.85rem' }}>
              {saveMsg}
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-4 mb-20">
        <div className="stat-card primary">
          <div className="stat-label">Grand Total Sales</div>
          <div className="stat-value">₹{formatINR(totals.totalSales)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Cash + POS</div>
          <div className="stat-value">₹{formatINR(cashPlusPOS)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Remittance (Bank)</div>
          <div className="stat-value">₹{formatINR(remittance)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Products Entered</div>
          <div className="stat-value">{activeEntries.filter(e => e.cases > 0 || e.bottles > 0).length} / {activeEntries.length}</div>
        </div>
      </div>

      {/* ===== SEQUENTIAL MODE ===== */}
      {mode === 'sequential' && (
        <div>
          {activeEntries.length === 0 ? (
            <div className="card">
              <div className="card-body text-center" style={{ padding: 60 }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 16, color: 'var(--text-muted)' }}>No Data</div>
                <h3 style={{ marginBottom: 8 }}>No Active Products</h3>
                <p className="text-muted">Click "Load Data" to fetch opening stock, or go to "Purchase Invoice" to add purchases first.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ padding: '12px 24px' }}>
                  <div className="flex-between mb-8">
                    <span className="text-sm text-muted">
                      Product {currentIndex + 1} of {activeEntries.length}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {Math.round((currentIndex / activeEntries.length) * 100)}%
                    </span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${(currentIndex / activeEntries.length) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Entry Card */}
              {currentEntry && (
                <div className="entry-card">
                  <div className="flex-between mb-8">
                    <span className="badge badge-primary">{CATEGORIES[currentEntry.category]?.label}</span>
                    <span className="text-xs text-muted">Code: {currentEntry.codeNo || '—'}</span>
                  </div>

                  <div className="product-name">{currentEntry.particular}</div>
                  <div className="product-meta">
                    <span>OP.ST: <strong>{currentEntry.openingStock}</strong></span>
                    <span>Rate: <strong>₹{currentEntry.rate}</strong></span>
                    <span>Purchase: <strong>{currentEntry.purchase}</strong></span>
                  </div>

                  {/* Input Fields */}
                  <div className="entry-grid">
                    <div className="entry-input-group">
                      <label className="form-label">Closing CASE</label>
                      <input
                        ref={caseInputRef}
                        type="number"
                        min="0"
                        className="input-lg"
                        value={currentEntry.cases || ''}
                        onChange={e => updateCurrentEntry('cases', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, 'cases')}
                        placeholder="0"
                        style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
                      />
                    </div>
                    <div className="entry-input-group">
                      <label className="form-label">Closing BOTTLE (loose)</label>
                      <input
                        ref={bottleInputRef}
                        type="number"
                        min="0"
                        className="input-lg"
                        value={currentEntry.bottles || ''}
                        onChange={e => updateCurrentEntry('bottles', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, 'bottles')}
                        placeholder="0"
                        style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  {/* Live Calculations */}
                  <div className="live-calc">
                    <div className="live-calc-item">
                      <div className="label">CL.ST</div>
                      <div className="value">{currentCalc.clst}</div>
                    </div>
                    <div className="live-calc-item">
                      <div className="label">Total</div>
                      <div className="value">{currentCalc.total}</div>
                    </div>
                    <div className="live-calc-item">
                      <div className="label">Sales</div>
                      <div className={`value ${currentCalc.sales < 0 ? 'negative' : currentCalc.sales > 0 ? 'positive' : ''}`}>
                        {currentCalc.sales}
                      </div>
                    </div>
                    <div className="live-calc-item">
                      <div className="label">Sales Amt</div>
                      <div className={`value ${currentCalc.salesAmt < 0 ? 'negative' : currentCalc.salesAmt > 0 ? 'positive' : ''}`}>
                        ₹{formatINR(currentCalc.salesAmt)}
                      </div>
                    </div>
                    <div className="live-calc-item">
                      <div className="label">CL Value</div>
                      <div className="value">₹{formatINR(currentCalc.clValue)}</div>
                    </div>
                  </div>

                  {/* Negative sales warning */}
                  {currentCalc.sales < 0 && (
                    <div style={{ marginTop: 16, padding: '10px 16px', background: '#fff5f8', borderRadius: 8, border: '1px solid var(--danger)' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>
                        Warning: Negative sales! Check closing stock values.
                      </span>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex-between" style={{ marginTop: 24 }}>
                    <button className="btn-secondary"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}>
                      ← Previous
                    </button>
                    <span className="text-muted text-sm">Press Enter to move next</span>
                    <button className="btn-primary"
                      disabled={currentIndex >= activeEntries.length - 1}
                      onClick={() => setCurrentIndex(Math.min(activeEntries.length - 1, currentIndex + 1))}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== TABLE MODE ===== */}
      {mode === 'table' && (
        <div className="card">
          <div className="card-header">
            <h3>All Products ({activeEntries.length} active)</h3>
          </div>
          <div className="table-wrapper" style={{ maxHeight: '65vh', overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Code</th>
                  <th>Product</th>
                  <th>OP.ST</th>
                  <th style={{ background: '#e1f0ff' }}>CASE</th>
                  <th style={{ background: '#e1f0ff' }}>BOTTLE</th>
                  <th>CL.ST</th>
                  <th>SALES</th>
                  <th>SALES AMT</th>
                </tr>
              </thead>
              <tbody>
                {activeEntries.map(entry => {
                  const calc = calcEntry(entry);
                  return (
                    <tr key={entry.productId} style={calc.sales < 0 ? { background: '#fff5f8' } : {}}>
                      <td>{entry.sno}</td>
                      <td className="text-muted">{entry.codeNo}</td>
                      <td className="font-bold">{entry.particular}</td>
                      <td>{entry.openingStock}</td>
                      <td>
                        <input type="number" min="0" value={entry.cases||''}
                          onChange={e => setEntries(prev => prev.map(en => en.productId === entry.productId ? {...en, cases: Number(e.target.value)||0} : en))}
                          style={{ width: 60, padding: '6px 8px', textAlign: 'center', border: '2px solid var(--primary)' }} />
                      </td>
                      <td>
                        <input type="number" min="0" value={entry.bottles||''}
                          onChange={e => setEntries(prev => prev.map(en => en.productId === entry.productId ? {...en, bottles: Number(e.target.value)||0} : en))}
                          style={{ width: 60, padding: '6px 8px', textAlign: 'center', border: '2px solid var(--primary)' }} />
                      </td>
                      <td className="font-bold">{calc.clst}</td>
                      <td style={{ color: calc.sales < 0 ? 'var(--danger)' : calc.sales > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {calc.sales}
                      </td>
                      <td className="font-bold" style={{ color: calc.salesAmt > 0 ? 'var(--primary)' : calc.salesAmt < 0 ? 'var(--danger)' : '' }}>
                        {calc.salesAmt !== 0 ? `₹${formatINR(calc.salesAmt)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== OPENING STOCK MODE ===== */}
      {mode === 'openingStock' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>Enter Opening Stock</h3>
              <button className="btn-success" onClick={handleSaveOpeningStock} disabled={savingOS}>
                {savingOS ? 'Saving...' : 'Save Opening Stock'}
              </button>
            </div>
            <div className="card-body">
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                Enter opening stock (total bottles) for each product. This is typically previous day's closing stock.
              </p>
            </div>
          </div>

          {CATEGORY_ORDER.map(cat => {
            const catProducts = entries.filter(e => e.category === cat);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat} className="card" style={{ marginBottom: 12 }}>
                <div className="card-header" style={{ background: '#f5f8fa' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{CATEGORIES[cat]?.label}</h4>
                  <span className="badge badge-primary">{catProducts.length} items</span>
                </div>
                <div className="card-body" style={{ padding: '8px 16px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Code</th>
                        <th>Rate</th>
                        <th style={{ width: 120 }}>Opening Stock (bottles)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catProducts.map(entry => (
                        <tr key={entry.productId}>
                          <td className="font-bold">{entry.particular}</td>
                          <td className="text-muted">{entry.codeNo || '—'}</td>
                          <td>{entry.rate > 0 ? `₹${entry.rate}` : '—'}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={entry.openingStock || ''}
                              onChange={e => updateOpeningStock(entry.productId, e.target.value)}
                              placeholder="0"
                              style={{ width: 100, padding: '6px 8px', textAlign: 'center', border: '2px solid var(--primary)', borderRadius: 6 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== SUMMARY MODE ===== */}
      {mode === 'summary' && (
        <div>
          {/* Case Abstract */}
          <CaseAbstract entries={entries} calcEntry={calcEntry} />

          {/* Denomination */}
          <DenominationCounter
            denomination={denomination} setDenomination={setDenomination}
            totalCash={totalCash} totalSales={totals.totalSales}
            posAmount={posAmount} setPosAmount={setPosAmount}
          />

          {/* Device vs Manual */}
          <div className="card">
            <div className="card-header">
              <h3>Device vs Manual Comparison</h3>
              {(deviceValues.salesBottles > 0 || deviceValues.salesValue > 0) && (
                <span className={allDeviceMatched ? 'badge badge-success' : 'badge badge-danger'}>
                  {allDeviceMatched ? 'All Matched' : 'Mismatch'}
                </span>
              )}
            </div>
            <div className="card-body">
              <div className="grid-4 mb-16">
                <div>
                  <label className="form-label">Sales Bottles</label>
                  <input type="number" value={deviceValues.salesBottles||''} onChange={e => setDeviceValues(p=>({...p, salesBottles: Number(e.target.value)||0}))} placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Closing Bottles</label>
                  <input type="number" value={deviceValues.closingBottles||''} onChange={e => setDeviceValues(p=>({...p, closingBottles: Number(e.target.value)||0}))} placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Sales Value (₹)</label>
                  <input type="number" value={deviceValues.salesValue||''} onChange={e => setDeviceValues(p=>({...p, salesValue: Number(e.target.value)||0}))} placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Closing Value (₹)</label>
                  <input type="number" value={deviceValues.closingValue||''} onChange={e => setDeviceValues(p=>({...p, closingValue: Number(e.target.value)||0}))} placeholder="0" />
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Source</th><th>Sales Bottles</th><th>Closing Bottles</th><th>Sales Value</th><th>Closing Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold">Device</td>
                    <td>{deviceValues.salesBottles||0}</td><td>{deviceValues.closingBottles||0}</td>
                    <td>₹{formatINR(deviceValues.salesValue||0)}</td><td>₹{formatINR(deviceValues.closingValue||0)}</td>
                  </tr>
                  <tr style={{ background: '#f9fafb' }}>
                    <td className="font-bold">Manual</td>
                    <td>{manualValues.salesBottles}</td><td>{manualValues.closingBottles}</td>
                    <td>₹{formatINR(manualValues.salesValue)}</td><td>₹{formatINR(manualValues.closingValue)}</td>
                  </tr>
                  <tr style={{ background: allDeviceMatched ? '#e8fff3' : '#fff5f8', fontWeight: 700 }}>
                    <td style={{ color: allDeviceMatched ? 'var(--success)' : 'var(--danger)' }}>Difference</td>
                    <td style={{ color: deviceDiff.salesBottles === 0 ? 'var(--success)' : 'var(--danger)' }}>{deviceDiff.salesBottles}</td>
                    <td style={{ color: deviceDiff.closingBottles === 0 ? 'var(--success)' : 'var(--danger)' }}>{deviceDiff.closingBottles}</td>
                    <td style={{ color: Math.abs(deviceDiff.salesValue) < 1 ? 'var(--success)' : 'var(--danger)' }}>{deviceDiff.salesValue}</td>
                    <td style={{ color: Math.abs(deviceDiff.closingValue) < 1 ? 'var(--success)' : 'var(--danger)' }}>{deviceDiff.closingValue}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Status */}
          <div className={cashMatch && totals.totalSales > 0 ? 'status-match' : totals.totalSales > 0 ? 'status-mismatch' : 'card'} style={{ marginBottom: 20 }}>
            {totals.totalSales > 0 ? (
              cashMatch ? 'Cash + POS matches Grand Total Sales' : `Mismatch: Cash+POS ${formatINR(cashPlusPOS)} vs Sales ${formatINR(totals.totalSales)}`
            ) : (
              <div className="card-body text-center text-muted">Enter data to see validation</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
