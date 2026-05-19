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

  // Get current invoice's purchased items total
  const currentInvoice = activeInvoiceIdx !== null ? invoices[activeInvoiceIdx] : null;
  const currentPurchaseTotal = useMemo(() => {
    if (!currentInvoice) return 0;
    return (currentInvoice.items || []).reduce((sum, item) => sum + (item.qty * item.rate), 0);
  }, [currentInvoice]);

  const remainingAmount = currentInvoice ? (currentInvoice.invoiceAmount - currentPurchaseTotal) : 0;

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

    // Reset for next item
    setCodeInput('');
    setFoundProduct(null);
    setPurchaseQty('');
    setTimeout(() => codeInputRef.current?.focus(), 50);
  };

  // Handle qty Enter
  const handleQtyKeyDown = (e) => {
    if (e.key === 'Enter') addPurchaseItem();
  };

  // Add new product (when not found)
  const handleAddNewProduct = () => {
    if (!newProduct.particular.trim()) return;
    // In real app, this would call API. For now, just use it as the found product.
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

  // Save all invoices → apply purchases to daily entry
  const handleSaveInvoices = async () => {
    if (!authenticated) { navigate('/login'); return; }
    try {
      // Aggregate all purchase quantities by product
      const purchaseMap = {};
      invoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          purchaseMap[item.productId] = (purchaseMap[item.productId] || 0) + item.qty;
        });
      });

      // Save invoices and update daily entry purchases
      await api.post(`/daily-entry/${selectedDate}/purchases`, {
        invoices: invoices.map(({ items, ...rest }) => ({ ...rest, items: items || [] })),
        purchases: purchaseMap
      });

      setSaveMsg('✓ Invoices saved & purchases applied to daily entry!');
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
              <button className="btn-success" onClick={handleSaveInvoices} disabled={invoices.length === 0}>
                {authenticated ? '💾 Save & Apply' : '🔒 Login to Save'}
              </button>
            </div>
          </div>
          {saveMsg && (
            <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, background: saveMsg.includes('Failed') ? '#fff5f8' : '#e8fff3', color: saveMsg.includes('Failed') ? 'var(--danger)' : 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
              {saveMsg}
            </div>
          )}
        </div>
      </div>

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
                <label className="form-label">Invoice Amount (₹)</label>
                <input type="number" min="0" value={newInvoice.invoiceAmount || ''} onChange={e => setNewInvoice({...newInvoice, invoiceAmount: e.target.value})} placeholder="Total amount" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={handleAddInvoice}>Create Invoice & Add Products →</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List */}
      {invoices.length === 0 && !showAddInvoice && (
        <div className="card">
          <div className="card-body text-center" style={{ padding: 60 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🧾</div>
            <h3 style={{ marginBottom: 8 }}>No Invoices Yet</h3>
            <p className="text-muted mb-16">Click "Add Invoice" to start adding purchase invoices for today.</p>
            <button className="btn-primary btn-lg" onClick={() => setShowAddInvoice(true)}>+ Add First Invoice</button>
          </div>
        </div>
      )}

      {invoices.map((invoice, idx) => {
        const itemsTotal = (invoice.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
        const matched = Math.abs(itemsTotal - invoice.invoiceAmount) < 1;
        const totalBottles = (invoice.items || []).reduce((s, i) => s + i.qty, 0);

        return (
          <div key={idx} className="card" style={{ border: matched ? '2px solid var(--success)' : '1px solid var(--border)' }}>
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>Invoice #{invoice.invoiceNo}</h3>
                <p className="text-xs text-muted">{invoice.invoiceDate} • Amount: ₹{formatINR(invoice.invoiceAmount)}</p>
              </div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                {matched ? (
                  <span className="badge badge-success">✓ Matched</span>
                ) : (
                  <span className="badge badge-warning">₹{formatINR(invoice.invoiceAmount - itemsTotal)} remaining</span>
                )}
                <button className="btn-primary btn-sm" onClick={() => openPurchaseDialog(idx)}>
                  + Add Products
                </button>
              </div>
            </div>

            {(invoice.items || []).length > 0 && (
              <div className="card-body" style={{ padding: '12px 24px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th><th>Product</th><th>Qty (Bottles)</th><th>Rate</th><th>Value</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, itemIdx) => (
                      <tr key={itemIdx}>
                        <td className="text-muted">{item.codeNo}</td>
                        <td className="font-bold">{item.particular}</td>
                        <td>{item.qty}</td>
                        <td>₹{item.rate}</td>
                        <td className="font-bold text-primary">₹{formatINR(item.qty * item.rate)}</td>
                        <td>
                          <button className="btn-sm" style={{ background: '#fff5f8', color: 'var(--danger)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                            onClick={() => removeItem(idx, itemIdx)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f9fafb' }}>
                      <td></td>
                      <td className="font-bold">Total</td>
                      <td className="font-bold">{totalBottles} bottles</td>
                      <td></td>
                      <td className="font-bold text-primary">₹{formatINR(itemsTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* ===== PURCHASE DIALOG (MODAL) ===== */}
      {showPurchaseDialog && currentInvoice && (
        <div className="modal-overlay" onClick={() => setShowPurchaseDialog(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1rem' }}>Add Products to Invoice #{currentInvoice.invoiceNo}</h3>
                <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Invoice: ₹{formatINR(currentInvoice.invoiceAmount)} | Added: ₹{formatINR(currentPurchaseTotal)} |
                  <strong style={{ color: remainingAmount <= 0 ? 'var(--success)' : 'var(--warning)' }}> Remaining: ₹{formatINR(Math.max(0, remainingAmount))}</strong>
                </p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setShowPurchaseDialog(false)}>✕ Close</button>
            </div>

            <div className="modal-body">
              {/* Progress indicator */}
              <div className="progress-bar-container" style={{ marginBottom: 20 }}>
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, (currentPurchaseTotal / (currentInvoice.invoiceAmount || 1)) * 100)}%`, background: remainingAmount <= 0 ? 'var(--success)' : 'linear-gradient(90deg, var(--primary), var(--info))' }} />
              </div>

              {remainingAmount <= 0 && (
                <div className="status-match mb-16">✅ Invoice amount matched!</div>
              )}

              {/* Code Input */}
              <div className="mb-16">
                <label className="form-label">Enter Product Code</label>
                <input
                  ref={codeInputRef}
                  type="text"
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value); setNotFound(false); setFoundProduct(null); }}
                  onKeyDown={handleCodeSearch}
                  placeholder="Type code and press Enter..."
                  className="input-lg"
                  style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: 2, fontWeight: 700 }}
                  autoFocus
                />
              </div>

              {/* Product Found */}
              {foundProduct && (
                <div style={{ padding: 16, background: '#e8fff3', borderRadius: 8, border: '1px solid var(--success)', marginBottom: 16 }}>
                  <div className="flex-between mb-8">
                    <span className="font-bold" style={{ fontSize: '1rem' }}>{foundProduct.particular}</span>
                    <span className="badge badge-primary">{CATEGORIES[foundProduct.category]?.label}</span>
                  </div>
                  <div className="text-sm text-muted mb-12">Rate: ₹{foundProduct.rate || 0} per bottle</div>

                  <div className="flex gap-12" style={{ alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Quantity (Bottles)</label>
                      <input
                        ref={qtyInputRef}
                        type="number"
                        min="1"
                        value={purchaseQty}
                        onChange={e => setPurchaseQty(e.target.value)}
                        onKeyDown={handleQtyKeyDown}
                        placeholder="No. of bottles"
                        style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
                      />
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <div className="text-xs text-muted">Value</div>
                      <div className="font-bold text-primary" style={{ fontSize: '1.1rem' }}>
                        ₹{formatINR((Number(purchaseQty) || 0) * (foundProduct.rate || 0))}
                      </div>
                    </div>
                    <button className="btn-success" onClick={addPurchaseItem} disabled={!purchaseQty || Number(purchaseQty) <= 0}>
                      Add ↵
                    </button>
                  </div>
                </div>
              )}

              {/* Not Found */}
              {notFound && !showNewProduct && (
                <div style={{ padding: 16, background: '#fff5f8', borderRadius: 8, border: '1px solid var(--danger)', marginBottom: 16 }}>
                  <p className="font-bold text-danger mb-8">⚠️ Product code "{codeInput}" not found!</p>
                  <button className="btn-primary btn-sm" onClick={() => { setShowNewProduct(true); setNewProduct({ codeNo: codeInput, particular: '', category: '180ML_BRANDY', rate: 0 }); }}>
                    + Add as New Product
                  </button>
                </div>
              )}

              {/* New Product Form */}
              {showNewProduct && (
                <div style={{ padding: 16, background: '#f5f8fa', borderRadius: 8, border: '1px dashed var(--border-dashed)', marginBottom: 16 }}>
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
                      <label className="form-label">Rate (₹)</label>
                      <input type="number" min="0" value={newProduct.rate || ''} onChange={e => setNewProduct({...newProduct, rate: e.target.value})} placeholder="Per bottle" />
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn-success btn-sm" onClick={handleAddNewProduct}>✓ Add Product</button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowNewProduct(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Items added to this invoice in this session */}
              {(currentInvoice.items || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="text-sm text-muted mb-8">Products Added ({currentInvoice.items.length})</h4>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {currentInvoice.items.map((item, i) => (
                      <div key={i} className="flex-between" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <div>
                          <span className="font-bold">{item.particular}</span>
                          <span className="text-muted" style={{ marginLeft: 8 }}>×{item.qty}</span>
                        </div>
                        <span className="font-bold text-primary">₹{formatINR(item.qty * item.rate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <div style={{ flex: 1 }}>
                <span className="text-sm text-muted">Total: <strong className="text-primary">₹{formatINR(currentPurchaseTotal)}</strong> / ₹{formatINR(currentInvoice.invoiceAmount)}</span>
              </div>
              <button className="btn-secondary" onClick={() => setShowPurchaseDialog(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
