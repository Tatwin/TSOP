import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { getEffectiveDate, formatDate } from '../utils/dateHelper';
import CaseAbstract from '../components/CaseAbstract';
import DenominationCounter from '../components/DenominationCounter';

function formatINR(num) { return new Intl.NumberFormat('en-IN').format(num); }

export default function DailyEntry() {
  const { authenticated } = useAuth();
  const navigate = useNavigate();

  // Core state - uses effective date (yesterday if midnight-4AM)
  const [selectedDate, setSelectedDate] = useState(getEffectiveDate());
  const [entries, setEntries] = useState(() => initEntries());
  const [denomination, setDenomination] = useState({ notes: { 500:0,200:0,100:0,50:0,20:0,10:0 }, coins: 0 });
  const [posAmount, setPosAmount] = useState(0);
  const [deviceValues, setDeviceValues] = useState({ salesBottles:0, closingBottles:0, salesValue:0, closingValue:0 });

  // Staff selection state
  const [staffList, setStaffList] = useState({ salesmen: [], supervisors: [] });
  const [selectedSalesmen, setSelectedSalesmen] = useState([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState([]);


  // Stock return state
  const [srCodeInput, setSrCodeInput] = useState('');
  const [srReturnList, setSrReturnList] = useState([]);

  // UI state
  const [mode, setMode] = useState('sequential'); // 'sequential' | 'table' | 'summary' | 'openingStock' | 'stockReturn'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [savingOS, setSavingOS] = useState(false);
  const [entryComplete, setEntryComplete] = useState(false);

  // Opening stock card-based entry state
  const [osCodeInput, setOsCodeInput] = useState('');
  const [osFoundProduct, setOsFoundProduct] = useState(null);
  const [osQtyInput, setOsQtyInput] = useState('');
  const [osNotFound, setOsNotFound] = useState(false);
  const [osEnteredList, setOsEnteredList] = useState([]);

  // Refs for auto-focus
  const caseInputRef = useRef(null);
  const bottleInputRef = useRef(null);
  const osQtyRef = useRef(null);

  function initEntries() {
    return DEFAULT_PRODUCTS.map(p => ({
      productId: p.id, sno: p.sno, codeNo: p.codeNo,
      particular: p.particular, category: p.category,
      cases: 0, bottles: 0, openingStock: 0,
      purchase: 0, stockReturn: 0, rate: p.rate
    }));
  }

  // Load staff on mount
  useEffect(() => {
    api.get('/products/staff').then(res => {
      if (res.data.staff) {
        setStaffList(res.data.staff);
        setSelectedSalesmen(res.data.staff.salesmen || []);
        setSelectedSupervisors(res.data.staff.supervisors || []);
      }
    }).catch(() => {});
  }, []);


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
      const purchases = osRes.data.purchases || {};
      const savedEntries = entryRes.data.entries;

      if (savedEntries?.length > 0) {
        setEntries(savedEntries.map(e => ({ ...e, openingStock: os[e.productId] || e.openingStock || 0 })));
      } else {
        setEntries(DEFAULT_PRODUCTS.map(p => ({
          productId: p.id, sno: p.sno, codeNo: p.codeNo,
          particular: p.particular, category: p.category,
          cases: 0, bottles: 0, openingStock: os[p.id] || 0,
          purchase: purchases[p.id] || 0, stockReturn: 0, rate: p.rate
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
      setEntryComplete(false);
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
      // Notify other pages that data was saved
      window.dispatchEvent(new CustomEvent('dailyEntrySaved', { detail: { date: selectedDate } }));
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
        staffSelection: { salesmen: selectedSalesmen, supervisors: selectedSupervisors },
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

  // Handle Enter key in sequential mode — TASK 1 FIX
  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      if (field === 'cases') {
        bottleInputRef.current?.focus();
      } else if (field === 'bottles') {
        if (currentIndex < activeEntries.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setTimeout(() => caseInputRef.current?.focus(), 50);
        } else {
          // LAST ITEM: mark entry complete, auto-advance to POS/comparison
          setEntryComplete(true);
        }
      }
    }
  };

  // Focus case input when index changes
  useEffect(() => {
    if (mode === 'sequential' && !entryComplete) {
      setTimeout(() => caseInputRef.current?.focus(), 100);
    }
  }, [currentIndex, mode, entryComplete]);

  // Current entry calculations
  const currentCalc = currentEntry ? calcEntry(currentEntry) : null;

  // Toggle staff selection
  const toggleSalesman = (name) => {
    setSelectedSalesmen(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };
  const toggleSupervisor = (name) => {
    setSelectedSupervisors(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Opening stock code search handler
  const handleOsCodeSearch = (e) => {
    if (e.key !== 'Enter') return;
    const input = osCodeInput.trim();
    if (!input) return;
    // First try to find by code
    let product = DEFAULT_PRODUCTS.find(p => p.codeNo === input);
    // If not found by code, try searching by name
    if (!product) {
      const term = input.toLowerCase();
      product = DEFAULT_PRODUCTS.find(p => p.particular.toLowerCase().includes(term));
    }
    if (product) {
      setOsFoundProduct(product);
      setOsNotFound(false);
      setOsQtyInput('');
      setTimeout(() => osQtyRef.current?.focus(), 50);
    } else {
      setOsFoundProduct(null);
      setOsNotFound(true);
    }
  };

  // Confirm opening stock entry
  const confirmOsEntry = () => {
    if (!osFoundProduct || !osQtyInput || Number(osQtyInput) <= 0) return;
    const qty = Number(osQtyInput);
    // Update the entry's opening stock
    updateOpeningStock(osFoundProduct.id, qty);
    // Add to the running list (update if already exists)
    setOsEnteredList(prev => {
      const existing = prev.findIndex(item => item.productId === osFoundProduct.id);
      const newItem = { productId: osFoundProduct.id, codeNo: osFoundProduct.codeNo, particular: osFoundProduct.particular, rate: osFoundProduct.rate, stock: qty };
      if (existing >= 0) {
        return prev.map((item, i) => i === existing ? newItem : item);
      }
      return [newItem, ...prev];
    });
    // Reset for next entry
    setOsCodeInput('');
    setOsFoundProduct(null);
    setOsQtyInput('');
    setOsNotFound(false);
  };

  // Handle Enter on qty input for opening stock
  const handleOsQtyKeyDown = (e) => {
    if (e.key === 'Enter') confirmOsEntry();
  };


  return (
    <div>
      {/* === 1. Top Controls: Date + Load + Mode === */}
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
              <div className="flex gap-4" style={{ background: '#F4F6F4', borderRadius: 8, padding: 3 }}>
                {[{id:'sequential',label:'Daily Sales'},{id:'openingStock',label:'Opening Stock'},{id:'stockReturn',label:'Stock Return'},{id:'summary',label:'Summary'},{id:'table',label:'Table'}].map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setEntryComplete(false); }}
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
            </div>
          </div>

          {saveMsg && (
            <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8,
              background: saveMsg.includes('fail') || saveMsg.includes('Failed') ? '#FEE2E2' : '#E8F5E9',
              color: saveMsg.includes('fail') || saveMsg.includes('Failed') ? 'var(--danger)' : 'var(--success)',
              fontWeight: 600, fontSize: '0.85rem' }}>
              {saveMsg}
            </div>
          )}
        </div>
      </div>


      {/* === Staff Selection (always visible) === */}
      <div className="card">
        <div className="card-header">
          <h3>Staff on Duty</h3>
        </div>
        <div className="card-body" style={{ padding: '12px 24px' }}>
          <div className="grid-2 gap-16">
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>Salesmen</label>
              <select
                onChange={e => { if (e.target.value && !selectedSalesmen.includes(e.target.value)) { setSelectedSalesmen(prev => [...prev, e.target.value]); } e.target.value = ''; }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                defaultValue=""
              >
                <option value="" disabled>Select salesman...</option>
                {staffList.salesmen.filter(n => !selectedSalesmen.includes(n)).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {selectedSalesmen.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {selectedSalesmen.map(name => (
                    <span key={name} onClick={() => setSelectedSalesmen(prev => prev.filter(n => n !== name))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                        borderRadius: 12, fontSize: '0.78rem', cursor: 'pointer',
                        background: '#0E6633', color: '#fff', fontWeight: 600
                      }}>
                      {name} <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>Supervisors</label>
              <select
                onChange={e => { if (e.target.value && !selectedSupervisors.includes(e.target.value)) { setSelectedSupervisors(prev => [...prev, e.target.value]); } e.target.value = ''; }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                defaultValue=""
              >
                <option value="" disabled>Select supervisor...</option>
                {staffList.supervisors.filter(n => !selectedSupervisors.includes(n)).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {selectedSupervisors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {selectedSupervisors.map(name => (
                    <span key={name} onClick={() => setSelectedSupervisors(prev => prev.filter(n => n !== name))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                        borderRadius: 12, fontSize: '0.78rem', cursor: 'pointer',
                        background: '#0E6633', color: '#fff', fontWeight: 600
                      }}>
                      {name} <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* === 2. Stats Bar === */}
      <div className="grid-4 mb-20">
        <div className="stat-card primary">
          <div className="stat-label">Grand Total Sales</div>
          <div className="stat-value">{'\u20B9'}{formatINR(totals.totalSales)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Cash + POS</div>
          <div className="stat-value">{'\u20B9'}{formatINR(cashPlusPOS)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Remittance (Bank)</div>
          <div className="stat-value">{'\u20B9'}{formatINR(remittance)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Products Entered</div>
          <div className="stat-value">{activeEntries.filter(e => e.cases > 0 || e.bottles > 0).length} / {activeEntries.length}</div>
        </div>
      </div>


      {/* === 3. Daily Sales Entry (Sequential / Table / Opening Stock) === */}
      {mode === 'sequential' && (
        <div>
          {activeEntries.length === 0 ? (
            <div className="card">
              <div className="card-body text-center" style={{ padding: 60 }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 16, color: 'var(--text-muted)' }}>[!]</div>
                <h3 style={{ marginBottom: 8 }}>No Active Products</h3>
                <p className="text-muted">Click "Load Data" to fetch opening stock, or go to "Purchase Invoice" to add purchases first.</p>
              </div>
            </div>
          ) : !entryComplete ? (
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
                    <span className="text-xs text-muted">Code: {currentEntry.codeNo || '--'}</span>
                  </div>

                  <div className="product-name">{currentEntry.particular}</div>
                  <div className="product-meta">
                    <span>OP.ST: <strong>{currentEntry.openingStock}</strong></span>
                    <span>Rate: <strong>{'\u20B9'}{currentEntry.rate}</strong></span>
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
                        {'\u20B9'}{formatINR(currentCalc.salesAmt)}
                      </div>
                    </div>
                    <div className="live-calc-item">
                      <div className="label">CL Value</div>
                      <div className="value">{'\u20B9'}{formatINR(currentCalc.clValue)}</div>
                    </div>
                  </div>


                  {/* Negative sales warning */}
                  {currentCalc.sales < 0 && (
                    <div style={{ marginTop: 16, padding: '10px 16px', background: '#FEE2E2', borderRadius: 8, border: '1px solid var(--danger)' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>
                        [!] Warning: Negative sales! Check closing stock values.
                      </span>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex-between" style={{ marginTop: 24 }}>
                    <button className="btn-secondary"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}>
                      Prev
                    </button>
                    <span className="text-muted text-sm">Press Enter to advance</span>
                    <button className="btn-primary"
                      onClick={() => {
                        if (currentIndex >= activeEntries.length - 1) {
                          setEntryComplete(true);
                        } else {
                          setCurrentIndex(Math.min(activeEntries.length - 1, currentIndex + 1));
                        }
                      }}>
                      {currentIndex >= activeEntries.length - 1 ? 'Finish' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Entry Complete Message */
            <div className="card">
              <div className="card-body text-center" style={{ padding: 40 }}>
                <div style={{ fontSize: '1.2rem', color: 'var(--success)', fontWeight: 700, marginBottom: 8 }}>
                  [OK] All {activeEntries.length} products entered!
                </div>
                <p className="text-muted text-sm mb-16">Proceed to enter POS amount and verify device comparison below.</p>
                <button className="btn-secondary" onClick={() => { setEntryComplete(false); setCurrentIndex(0); }}>
                  Go Back to Entries
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* === TABLE MODE === */}
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
                  <th style={{ background: '#E8F5E9' }}>CASE</th>
                  <th style={{ background: '#E8F5E9' }}>BOTTLE</th>
                  <th>CL.ST</th>
                  <th>SALES</th>
                  <th>SALES AMT</th>
                </tr>
              </thead>
              <tbody>
                {activeEntries.map(entry => {
                  const calc = calcEntry(entry);
                  return (
                    <tr key={entry.productId} style={calc.sales < 0 ? { background: '#FEE2E2' } : {}}>
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
                        {calc.salesAmt !== 0 ? `\u20B9${formatINR(calc.salesAmt)}` : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* === OPENING STOCK MODE === */}
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
              {/* Search bar */}
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  value={osCodeInput}
                  onChange={e => setOsCodeInput(e.target.value)}
                  placeholder="Search by code or product name to filter..."
                  style={{ maxWidth: 400, padding: '10px 14px' }}
                />
              </div>

              {/* Table with all products */}
              <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Rate</th>
                      <th style={{ background: '#E8F5E9' }}>Opening Stock (bottles)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .filter(e => {
                        if (!osCodeInput.trim()) return true;
                        const term = osCodeInput.toLowerCase();
                        return e.codeNo.toLowerCase().includes(term) || e.particular.toLowerCase().includes(term);
                      })
                      .map(entry => (
                      <tr key={entry.productId} style={entry.openingStock > 0 ? { background: '#E8F5E9' } : {}}>
                        <td className="text-muted">{entry.codeNo || '--'}</td>
                        <td className="font-bold">{entry.particular}</td>
                        <td className="text-xs text-muted">{CATEGORIES[entry.category]?.label}</td>
                        <td>{'\u20B9'}{entry.rate}</td>
                        <td>
                          <input
                            type="number" min="0"
                            value={entry.openingStock || ''}
                            onChange={e => updateOpeningStock(entry.productId, e.target.value)}
                            placeholder="0"
                            style={{ width: 90, padding: '6px 8px', textAlign: 'center', border: '2px solid var(--primary)', fontWeight: 700 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Products with stock entered: {entries.filter(e => e.openingStock > 0).length} / {entries.length}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* === SUMMARY MODE === */}
      {mode === 'summary' && (
        <CaseAbstract entries={entries} calcEntry={calcEntry} />
      )}

      {/* === STOCK RETURN MODE === */}
      {mode === 'stockReturn' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>Stock Return to Depot</h3>
            </div>
            <div className="card-body">
              <p className="text-xs text-muted" style={{ marginBottom: 16 }}>
                Enter product code or name, then the number of bottles returned to depot.
              </p>

              {/* Search and enter */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Product Code / Name</label>
                  <input
                    type="text"
                    value={srCodeInput}
                    onChange={e => setSrCodeInput(e.target.value)}
                    placeholder="Type code or product name..."
                    style={{ padding: '10px 14px', width: '100%' }}
                  />
                </div>
              </div>

              {/* Filtered product list with return input */}
              <div className="table-wrapper" style={{ maxHeight: '55vh', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Current Return</th>
                      <th style={{ background: '#FEE2E2' }}>Bottles to Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .filter(e => {
                        if (!srCodeInput.trim()) return e.stockReturn > 0 || (e.openingStock > 0 || e.purchase > 0);
                        const term = srCodeInput.toLowerCase();
                        return e.codeNo.toLowerCase().includes(term) || e.particular.toLowerCase().includes(term);
                      })
                      .map(entry => (
                      <tr key={entry.productId} style={entry.stockReturn > 0 ? { background: '#FEE2E2' } : {}}>
                        <td className="text-muted">{entry.codeNo || '--'}</td>
                        <td className="font-bold">{entry.particular}</td>
                        <td className="text-xs text-muted">{CATEGORIES[entry.category]?.label}</td>
                        <td style={{ fontWeight: 700, color: entry.stockReturn > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {entry.stockReturn || 0}
                        </td>
                        <td>
                          <input
                            type="number" min="0"
                            value={entry.stockReturn || ''}
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setEntries(prev => prev.map(en =>
                                en.productId === entry.productId ? { ...en, stockReturn: val } : en
                              ));
                            }}
                            placeholder="0"
                            style={{ width: 80, padding: '6px 8px', textAlign: 'center', border: '2px solid var(--danger)', fontWeight: 700 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary of returns */}
              {entries.filter(e => e.stockReturn > 0).length > 0 && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEE2E2', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--danger)', marginBottom: 8 }}>
                    Return Summary: {entries.filter(e => e.stockReturn > 0).length} products
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {entries.filter(e => e.stockReturn > 0).map(e => (
                      <span key={e.productId} style={{
                        padding: '4px 10px', background: 'white', borderRadius: 6,
                        fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--danger)'
                      }}>
                        {e.particular}: {e.stockReturn} btl
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total bottles returned: {entries.reduce((s, e) => s + (e.stockReturn || 0), 0)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === 4. POS Amount === */}
      {(mode === 'sequential' && entryComplete) && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <h3>POS / Digital Payment Amount</h3>
          </div>
          <div className="card-body">
            <div className="flex-between flex-wrap gap-12">
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>POS / Card / GPay Amount</label>
                <p className="text-xs text-muted">Amount received via card swipe or digital payment</p>
              </div>
              <input
                type="number" min="0" value={posAmount || ''}
                onChange={e => setPosAmount(Number(e.target.value) || 0)}
                placeholder="0"
                style={{ width: 180, textAlign: 'center', fontSize: '1.3rem', fontWeight: 700 }}
              />
            </div>
          </div>
        </div>
      )}


      {/* === 5. Device vs Manual Comparison === */}
      {(mode === 'sequential' && entryComplete) && (
        <div className="card">
          <div className="card-header">
            <h3>Device vs Manual Comparison</h3>
            {(deviceValues.salesBottles > 0 || deviceValues.salesValue > 0) && (
              <span className={allDeviceMatched ? 'badge badge-success' : 'badge badge-danger'}>
                {allDeviceMatched ? '[OK] All Matched' : '[X] Mismatch'}
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
                <label className="form-label">Sales Value</label>
                <input type="number" value={deviceValues.salesValue||''} onChange={e => setDeviceValues(p=>({...p, salesValue: Number(e.target.value)||0}))} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Closing Value</label>
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
                  <td>{'\u20B9'}{formatINR(deviceValues.salesValue||0)}</td><td>{'\u20B9'}{formatINR(deviceValues.closingValue||0)}</td>
                </tr>
                <tr style={{ background: '#F4F6F4' }}>
                  <td className="font-bold">Manual</td>
                  <td>{manualValues.salesBottles}</td><td>{manualValues.closingBottles}</td>
                  <td>{'\u20B9'}{formatINR(manualValues.salesValue)}</td><td>{'\u20B9'}{formatINR(manualValues.closingValue)}</td>
                </tr>
                <tr style={{ background: allDeviceMatched ? '#E8F5E9' : '#FEE2E2', fontWeight: 700 }}>
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
      )}


      {/* === 6. Denomination Counter === */}
      {(mode === 'sequential' && entryComplete) && (
        <DenominationCounter
          denomination={denomination} setDenomination={setDenomination}
          totalCash={totalCash} totalSales={totals.totalSales}
          posAmount={posAmount} setPosAmount={setPosAmount}
        />
      )}

      {/* === 7. Validation Status === */}
      {(mode === 'sequential' && entryComplete) && (
        <div className={cashMatch && totals.totalSales > 0 ? 'status-match' : totals.totalSales > 0 ? 'status-mismatch' : 'card'} style={{ marginBottom: 20 }}>
          {totals.totalSales > 0 ? (
            cashMatch
              ? '[OK] Cash + POS matches Grand Total Sales'
              : `[X] Mismatch: Cash+POS \u20B9${formatINR(cashPlusPOS)} vs Sales \u20B9${formatINR(totals.totalSales)}`
          ) : (
            <div className="card-body text-center text-muted">Enter data to see validation</div>
          )}
        </div>
      )}

      {/* === 8. Download Excel Sheet === */}
      {(mode === 'sequential' && entryComplete) && (
        <div className="card">
          <div className="card-body" style={{ padding: '16px 24px' }}>
            <div className="flex-between">
              <div>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>Download Excel Sheet</h3>
                <p className="text-xs text-muted">
                  {cashMatch && allDeviceMatched && totals.totalSales > 0
                    ? 'All validations passed. Ready to download.'
                    : !cashMatch && !allDeviceMatched && totals.totalSales > 0
                      ? 'Cash mismatch AND device mismatch. Fix before downloading.'
                      : !cashMatch && totals.totalSales > 0
                        ? 'Cash + POS does not match sales. Fix denomination or POS amount.'
                        : !allDeviceMatched && totals.totalSales > 0
                          ? 'Device vs Manual mismatch. Verify device readings.'
                          : 'Enter sales data first.'}
                </p>
              </div>
              <button
                className="btn-warning"
                onClick={() => {
                  if (totals.totalSales === 0) return;
                  if (!cashMatch && !allDeviceMatched) {
                    alert('Cannot download: Both Cash+POS and Device vs Manual have mismatches. Please fix before exporting.');
                    return;
                  }
                  if (!cashMatch) {
                    if (!window.confirm('Warning: Cash + POS does not match Total Sales.\n\nCash+POS: \u20B9' + formatINR(cashPlusPOS) + '\nTotal Sales: \u20B9' + formatINR(totals.totalSales) + '\n\nDownload anyway?')) return;
                  }
                  if (!allDeviceMatched) {
                    if (!window.confirm('Warning: Device readings do not match manual calculations.\n\nPlease verify device values.\n\nDownload anyway?')) return;
                  }
                  handleExport();
                }}
                disabled={totals.totalSales === 0}
                style={{ opacity: totals.totalSales === 0 ? 0.5 : 1 }}
              >
                Download Excel Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
