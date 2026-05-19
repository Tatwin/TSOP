import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DEFAULT_PRODUCTS } from '../data/products';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function formatINR(num) { return new Intl.NumberFormat('en-IN').format(num); }
function formatDate(d) { return d.toISOString().split('T')[0]; }

export default function InvoicePage() {
  const { authenticated } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [invoices, setInvoices] = useState([]);
  const [showAddInvoice, setShowAddInvoice] = useState(false);

  // New invoice form
  const [newInvoice, setNewInvoice] = useState({ invoiceNo: '', invoiceDate: formatDate(new Date()), invoiceAmount: 0 });

  // Purchase dialog state
  const [activeInvoiceIdx, setActiveInvoiceIdx] = useState(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [notFound, setNotFound] = useState(false);


  // New product form (when code not found)
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ codeNo: '', particular: '', category: '180ML_BRANDY', rate: 0 });

  const [saveMsg, setSaveMsg] = useState('');
  const codeInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('');

  // Get current invoice's purchased items total
  const currentInvoice = activeInvoiceIdx !== null ? invoices[activeInvoiceIdx] : null;
  const currentPurchaseTotal = useMemo(() => {
    if (!currentInvoice) return 0;
    return (currentInvoice.items || []).reduce((sum, item) => sum + (item.qty * item.rate), 0);
  }, [currentInvoice]);

  const remainingAmount = currentInvoice ? (currentInvoice.invoiceAmount - currentPurchaseTotal) : 0;

  // Validation warnings (Task 7)
  const invoiceWarnings = useMemo(() => {
    const warnings = [];
    invoices.forEach((inv, idx) => {
      const itemsTotal = (inv.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
      if (!inv.invoiceNo) {
        warnings.push({ idx, msg: `Invoice #${idx + 1}: Invoice number is required` });
      }
      if (Number(inv.invoiceAmount) === 0) {
        warnings.push({ idx, msg: `Invoice #${idx + 1}: Invoice amount cannot be zero` });
      }
      if ((inv.items || []).length > 0 && Math.abs(itemsTotal - inv.invoiceAmount) >= 1) {
        warnings.push({ idx, msg: `Invoice #${idx + 1}: Purchase value \u20B9${formatINR(itemsTotal)} does not match invoice amount \u20B9${formatINR(inv.invoiceAmount)}` });
      }
    });
    return warnings;
  }, [invoices]);

  const hasUnmatchedInvoices = useMemo(() => {
    return invoices.some(inv => {
      const itemsTotal = (inv.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
      return Math.abs(itemsTotal - inv.invoiceAmount) >= 1;
    });
  }, [invoices]);

  // Add new invoice
  const handleAddInvoice = () => {
    if (!newInvoice.invoiceNo || !newInvoice.invoiceAmount) return;
    setInvoices([...invoices, { ...newInvoice, invoiceAmount: Number(newInvoice.invoiceAmount), items: [] }]);
    setNewInvoice({ invoiceNo: '', invoiceDate: formatDate(new Date()), invoiceAmount: 0 });
    setShowAddInvoice(false);
  };


  // Open purchase dialog for an invoice
  const openPurchaseDialog = (idx) => {
    setActiveInvoiceIdx(idx);
    setShowPurchaseDialog(true);
    setCodeInput('');
    setFoundProduct(null);
    setPurchaseQty('');
    setNotFound(false);
    setShowNewProduct(false);
    setTimeout(() => codeInputRef.current?.focus(), 100);
  };

  // Lookup product by code
  const handleCodeSearch = (e) => {
    if (e.key !== 'Enter') return;
    const code = codeInput.trim();
    if (!code) return;
    const product = DEFAULT_PRODUCTS.find(p => p.codeNo === code);
    if (product) {
      setFoundProduct(product);
      setNotFound(false);
      setShowNewProduct(false);
      setPurchaseQty('');
      setTimeout(() => qtyInputRef.current?.focus(), 50);
    } else {
      setFoundProduct(null);
      setNotFound(true);
    }
  };

  // Add purchase item to invoice
  const addPurchaseItem = () => {
    if (!foundProduct || !purchaseQty || Number(purchaseQty) <= 0) return;
    const qty = Number(purchaseQty);
    const rate = foundProduct.rate || 0;
    setInvoices(prev => prev.map((inv, idx) => {
      if (idx !== activeInvoiceIdx) return inv;
      const existingIdx = (inv.items || []).findIndex(i => i.productId === foundProduct.id);
      let items;
      if (existingIdx >= 0) {
        items = inv.items.map((item, i) => i === existingIdx ? { ...item, qty: item.qty + qty } : item);
      } else {
        items = [...(inv.items || []), { productId: foundProduct.id, codeNo: foundProduct.codeNo, particular: foundProduct.particular, category: foundProduct.category, qty, rate }];
      }
      return { ...inv, items };
    }));
    setCodeInput('');
    setFoundProduct(null);
    setPurchaseQty('');
    setTimeout(() => codeInputRef.current?.focus(), 50);
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === 'Enter') addPurchaseItem();
  };

  // Add new product (when not found)
  const handleAddNewProduct = () => {
    if (!newProduct.particular.trim()) return;
    const tempProduct = {
      id: `new_${Date.now()}`,
      codeNo: newProduct.codeNo || codeInput,
      particular: newProduct.particular.toUpperCase(),
      category: newProduct.category,
      rate: Number(newProduct.rate) || 0
    };
    setFoundProduct(tempProduct);
    setShowNewProduct(false);
    setNotFound(false);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };


  // Save all invoices
  const handleSaveInvoices = async () => {
    if (!authenticated) { navigate('/login'); return; }

    // If there are unmatched invoices, ask for confirmation
    if (hasUnmatchedInvoices) {
      if (!window.confirm('Some invoices have mismatched totals. Save anyway?')) return;
    }

    try {
      const purchaseMap = {};
      invoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          purchaseMap[item.productId] = (purchaseMap[item.productId] || 0) + item.qty;
        });
      });
      await api.post(`/daily-entry/${selectedDate}/purchases`, {
        invoices: invoices.map(({ items, ...rest }) => ({ ...rest, items: items || [] })),
        purchases: purchaseMap
      });
      setSaveMsg('Invoices saved & purchases applied to daily entry!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Failed to save: ' + (err.message || 'Error'));
    }
  };

  // Remove item from invoice
  const removeItem = (invoiceIdx, itemIdx) => {
    setInvoices(prev => prev.map((inv, idx) => {
      if (idx !== invoiceIdx) return inv;
      return { ...inv, items: inv.items.filter((_, i) => i !== itemIdx) };
    }));
  };

  const startEditItem = (invoiceIdx, itemIdx) => {
    const item = invoices[invoiceIdx].items[itemIdx];
    setEditingItem({ invoiceIdx, itemIdx });
    setEditQty(String(item.qty));
  };

  const saveEditItem = () => {
    if (!editingItem) return;
    const { invoiceIdx, itemIdx } = editingItem;
    const newQty = Number(editQty) || 0;
    if (newQty <= 0) return;
    setInvoices(prev => prev.map((inv, idx) => {
      if (idx !== invoiceIdx) return inv;
      return { ...inv, items: inv.items.map((item, i) => i === itemIdx ? { ...item, qty: newQty } : item) };
    }));
    setEditingItem(null);
    setEditQty('');
  };

  const cancelEditItem = () => {
    setEditingItem(null);
    setEditQty('');
  };


  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div className="flex-between flex-wrap gap-12">
            <div className="flex gap-12" style={{ alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Date</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: 160, padding: '8px 12px' }} />
              </div>
            </div>
            <div className="flex gap-8">
              <button className="btn-primary" onClick={() => setShowAddInvoice(true)}>+ Add Invoice</button>
              <button
                className={`btn-success ${hasUnmatchedInvoices ? 'btn-disabled-style' : ''}`}
                onClick={handleSaveInvoices}
                disabled={invoices.length === 0}
              >
                {authenticated ? 'Save & Apply' : 'Login to Save'}
              </button>
            </div>
          </div>
          {saveMsg && (
            <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, background: saveMsg.includes('Failed') ? '#FEE2E2' : '#E8F5E9', color: saveMsg.includes('Failed') ? 'var(--danger)' : 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
              {saveMsg}
            </div>
          )}
        </div>
      </div>

      {/* Validation Warnings (Task 7) */}
      {invoiceWarnings.length > 0 && (
        <div className="card" style={{ border: '1px solid var(--danger)', marginBottom: 20 }}>
          <div className="card-body" style={{ padding: '12px 20px' }}>
            {invoiceWarnings.map((w, i) => (
              <div key={i} style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0' }}>
                [!] {w.msg}
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Add Invoice Form */}
      {showAddInvoice && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <h3>New Invoice</h3>
            <button className="btn-secondary btn-sm" onClick={() => setShowAddInvoice(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <div className="grid-3 gap-16">
              <div>
                <label className="form-label">Invoice No</label>
                <input type="text" value={newInvoice.invoiceNo} onChange={e => setNewInvoice({...newInvoice, invoiceNo: e.target.value})} placeholder="e.g. INV-001" />
              </div>
              <div>
                <label className="form-label">Invoice Date</label>
                <input type="date" value={newInvoice.invoiceDate} onChange={e => setNewInvoice({...newInvoice, invoiceDate: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Invoice Amount</label>
                <input type="number" min="0" value={newInvoice.invoiceAmount || ''} onChange={e => setNewInvoice({...newInvoice, invoiceAmount: e.target.value})} placeholder="Total amount" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={handleAddInvoice}>Create Invoice & Add Products</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {invoices.length === 0 && !showAddInvoice && (
        <div className="card">
          <div className="card-body text-center" style={{ padding: 60 }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 16, color: 'var(--text-muted)' }}>[INV]</div>
            <h3 style={{ marginBottom: 8 }}>No Invoices Yet</h3>
            <p className="text-muted mb-16">Click "Add Invoice" to start adding purchase invoices for today.</p>
            <button className="btn-primary btn-lg" onClick={() => setShowAddInvoice(true)}>+ Add First Invoice</button>
          </div>
        </div>
      )}


      {/* Invoices List */}
      {invoices.map((invoice, idx) => {
        const itemsTotal = (invoice.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
        const matched = Math.abs(itemsTotal - invoice.invoiceAmount) < 1;
        const totalBottles = (invoice.items || []).reduce((s, i) => s + i.qty, 0);

        return (
          <div key={idx} className="card" style={{ border: matched ? '2px solid var(--success)' : '1px solid var(--border)' }}>
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>Invoice #{invoice.invoiceNo || `(${idx + 1})`}</h3>
                <p className="text-xs text-muted">{invoice.invoiceDate} | Amount: {'\u20B9'}{formatINR(invoice.invoiceAmount)}</p>
              </div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                {matched ? (
                  <span className="badge badge-success">[OK] Matched</span>
                ) : (
                  <span className="badge badge-warning">{'\u20B9'}{formatINR(invoice.invoiceAmount - itemsTotal)} remaining</span>
                )}
                <button className="btn-primary btn-sm" onClick={() => openPurchaseDialog(idx)}>+ Add Products</button>
              </div>
            </div>

            {(invoice.items || []).length > 0 && (
              <div className="card-body" style={{ padding: '12px 24px' }}>
                <table>
                  <thead>
                    <tr><th>Code</th><th>Product</th><th>Qty (Bottles)</th><th>Rate</th><th>Value</th><th></th></tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, itemIdx) => {
                      const isEditing = editingItem && editingItem.invoiceIdx === idx && editingItem.itemIdx === itemIdx;
                      return (
                        <tr key={itemIdx}>
                          <td className="text-muted">{item.codeNo}</td>
                          <td className="font-bold">{item.particular}</td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="number" min="1" value={editQty} onChange={e => setEditQty(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEditItem(); if (e.key === 'Escape') cancelEditItem(); }}
                                  style={{ width: 60, padding: '4px 6px', textAlign: 'center', border: '2px solid var(--primary)', borderRadius: 4 }} autoFocus />
                                <button onClick={saveEditItem} style={{ padding: '3px 6px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>OK</button>
                                <button onClick={cancelEditItem} style={{ padding: '3px 6px', background: '#eee', color: '#333', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>X</button>
                              </div>
                            ) : item.qty}
                          </td>
                          <td>{'\u20B9'}{item.rate}</td>
                          <td className="font-bold text-primary">{'\u20B9'}{formatINR((isEditing ? Number(editQty) || item.qty : item.qty) * item.rate)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {!isEditing && (
                                <button className="btn-sm" style={{ background: '#E8F5E9', color: 'var(--primary)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                  onClick={() => startEditItem(idx, itemIdx)}>Edit</button>
                              )}
                              <button className="btn-sm" style={{ background: '#FEE2E2', color: 'var(--danger)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => removeItem(idx, itemIdx)}>X</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F4F6F4' }}>
                      <td></td>
                      <td className="font-bold">Total</td>
                      <td className="font-bold">{totalBottles} bottles</td>
                      <td></td>
                      <td className="font-bold text-primary">{'\u20B9'}{formatINR(itemsTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}


      {/* === PURCHASE DIALOG (MODAL) === */}
      {showPurchaseDialog && currentInvoice && (
        <div className="modal-overlay" onClick={() => setShowPurchaseDialog(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1rem' }}>Add Products to Invoice #{currentInvoice.invoiceNo}</h3>
                <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Invoice: {'\u20B9'}{formatINR(currentInvoice.invoiceAmount)} | Added: {'\u20B9'}{formatINR(currentPurchaseTotal)} |
                  <strong style={{ color: remainingAmount <= 0 ? 'var(--success)' : 'var(--warning)' }}> Remaining: {'\u20B9'}{formatINR(Math.max(0, remainingAmount))}</strong>
                </p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setShowPurchaseDialog(false)}>Close</button>
            </div>

            <div className="modal-body">
              {/* Progress indicator */}
              <div className="progress-bar-container" style={{ marginBottom: 20 }}>
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, (currentPurchaseTotal / (currentInvoice.invoiceAmount || 1)) * 100)}%`, background: remainingAmount <= 0 ? 'var(--success)' : undefined }} />
              </div>

              {remainingAmount <= 0 && (
                <div className="status-match mb-16">[OK] Invoice amount matched!</div>
              )}

              {/* Code Input */}
              <div className="mb-16">
                <label className="form-label">Enter Product Code</label>
                <input ref={codeInputRef} type="text" value={codeInput}
                  onChange={e => { setCodeInput(e.target.value); setNotFound(false); setFoundProduct(null); }}
                  onKeyDown={handleCodeSearch}
                  placeholder="Type code and press Enter..."
                  className="input-lg"
                  style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: 2, fontWeight: 700 }}
                  autoFocus />
              </div>

              {/* Product Found */}
              {foundProduct && (
                <div style={{ padding: 16, background: '#E8F5E9', borderRadius: 8, border: '1px solid var(--success)', marginBottom: 16 }}>
                  <div className="flex-between mb-8">
                    <span className="font-bold" style={{ fontSize: '1rem' }}>{foundProduct.particular}</span>
                    <span className="badge badge-primary">{CATEGORIES[foundProduct.category]?.label}</span>
                  </div>
                  <div className="text-sm text-muted mb-12">Rate: {'\u20B9'}{foundProduct.rate || 0} per bottle</div>
                  <div className="flex gap-12" style={{ alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Quantity (Bottles)</label>
                      <input ref={qtyInputRef} type="number" min="1" value={purchaseQty}
                        onChange={e => setPurchaseQty(e.target.value)} onKeyDown={handleQtyKeyDown}
                        placeholder="No. of bottles"
                        style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }} />
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <div className="text-xs text-muted">Value</div>
                      <div className="font-bold text-primary" style={{ fontSize: '1.1rem' }}>
                        {'\u20B9'}{formatINR((Number(purchaseQty) || 0) * (foundProduct.rate || 0))}
                      </div>
                    </div>
                    <button className="btn-success" onClick={addPurchaseItem} disabled={!purchaseQty || Number(purchaseQty) <= 0}>Add</button>
                  </div>
                </div>
              )}


              {/* Not Found */}
              {notFound && !showNewProduct && (
                <div style={{ padding: 16, background: '#FEE2E2', borderRadius: 8, border: '1px solid var(--danger)', marginBottom: 16 }}>
                  <p className="font-bold text-danger mb-8">Product code "{codeInput}" not found!</p>
                  <button className="btn-primary btn-sm" onClick={() => { setShowNewProduct(true); setNewProduct({ codeNo: codeInput, particular: '', category: '180ML_BRANDY', rate: 0 }); }}>
                    + Add as New Product
                  </button>
                </div>
              )}

              {/* New Product Form */}
              {showNewProduct && (
                <div style={{ padding: 16, background: '#F4F6F4', borderRadius: 8, border: '1px dashed var(--border)', marginBottom: 16 }}>
                  <h4 className="mb-12" style={{ fontSize: '0.9rem' }}>Add New Product</h4>
                  <div className="grid-2 gap-12 mb-12">
                    <div>
                      <label className="form-label">Code</label>
                      <input type="text" value={newProduct.codeNo} onChange={e => setNewProduct({...newProduct, codeNo: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">Name</label>
                      <input type="text" value={newProduct.particular} onChange={e => setNewProduct({...newProduct, particular: e.target.value})} placeholder="Product name" autoFocus />
                    </div>
                    <div>
                      <label className="form-label">Category</label>
                      <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                        {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Rate</label>
                      <input type="number" min="0" value={newProduct.rate || ''} onChange={e => setNewProduct({...newProduct, rate: e.target.value})} placeholder="Per bottle" />
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn-success btn-sm" onClick={handleAddNewProduct}>Add Product</button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowNewProduct(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Items added */}
              {(currentInvoice.items || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="text-sm text-muted mb-8">Products Added ({currentInvoice.items.length})</h4>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {currentInvoice.items.map((item, i) => (
                      <div key={i} className="flex-between" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <div>
                          <span className="font-bold">{item.particular}</span>
                          <span className="text-muted" style={{ marginLeft: 8 }}>x{item.qty}</span>
                        </div>
                        <span className="font-bold text-primary">{'\u20B9'}{formatINR(item.qty * item.rate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <div style={{ flex: 1 }}>
                <span className="text-sm text-muted">Total: <strong className="text-primary">{'\u20B9'}{formatINR(currentPurchaseTotal)}</strong> / {'\u20B9'}{formatINR(currentInvoice.invoiceAmount)}</span>
              </div>
              <button className="btn-secondary" onClick={() => setShowPurchaseDialog(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
