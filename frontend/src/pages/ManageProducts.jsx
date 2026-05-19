import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DEFAULT_PRODUCTS, CATEGORY_ORDER } from '../data/products';

function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

const PIN_REQUIRED = '1745';

export default function ManageProducts() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [products, setProducts] = useState(() =>
    DEFAULT_PRODUCTS.map(p => ({ ...p, status: 'active' }))
  );
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRate, setEditingRate] = useState(null);
  const [newRateValue, setNewRateValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    codeNo: '', particular: '', category: '180ML_BRANDY', rate: 0
  });
  const [message, setMessage] = useState('');

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === PIN_REQUIRED) {
      setAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Invalid PIN. Access denied.');
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products;
    if (filterCategory !== 'ALL') {
      result = result.filter(p => p.category === filterCategory);
    }
    if (filterStatus !== 'ALL') {
      result = result.filter(p => p.status === filterStatus);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.particular.toLowerCase().includes(term) ||
        p.codeNo.toLowerCase().includes(term)
      );
    }
    return result;
  }, [products, filterCategory, filterStatus, searchTerm]);

  const handleRateEdit = (productId) => {
    const product = products.find(p => p.id === productId);
    setEditingRate(productId);
    setNewRateValue(String(product.rate || 0));
  };

  const saveRate = (productId) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, rate: Number(newRateValue) || 0 } : p
    ));
    setEditingRate(null);
    setNewRateValue('');
    showMsg('Rate updated successfully');
  };

  const toggleStatus = (productId) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, status: p.status === 'active' ? 'hidden' : 'active' } : p
    ));
    showMsg('Product status toggled');
  };

  const addProduct = () => {
    if (!newProduct.particular.trim()) {
      showMsg('Product name is required');
      return;
    }
    const maxId = Math.max(...products.map(p => Number(p.id)));
    const newId = String(maxId + 1);
    const newSno = Math.max(...products.map(p => p.sno)) + 1;
    setProducts([...products, {
      id: newId,
      sno: newSno,
      codeNo: newProduct.codeNo,
      particular: newProduct.particular.toUpperCase(),
      category: newProduct.category,
      rate: Number(newProduct.rate) || 0,
      status: 'active'
    }]);
    setNewProduct({ codeNo: '', particular: '', category: '180ML_BRANDY', rate: 0 });
    setShowAddForm(false);
    showMsg('Product added successfully');
  };

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // PIN entry screen
  if (!authenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '16px', color: '#1a237e' }}>🔒 Manage Products</h2>
          <p style={{ color: '#757575', marginBottom: '20px' }}>Enter PIN to access product management</p>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', marginBottom: '12px' }}
              maxLength={4}
              autoFocus
            />
            {pinError && <p style={{ color: '#c62828', fontSize: '0.9rem', marginBottom: '12px' }}>{pinError}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#1a237e' }}>📋 Manage Products</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-success"
            style={{ padding: '10px 20px', fontSize: '0.9rem' }}
          >
            {showAddForm ? 'Cancel' : '+ Add Product'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', marginBottom: '12px',
          background: '#e8f5e9', color: '#2e7d32', fontWeight: '600'
        }}>
          {message}
        </div>
      )}

      {/* Add Product Form */}
      {showAddForm && (
        <div className="card" style={{ border: '2px solid #2e7d32' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Add New Product</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Code No</label>
              <input
                type="text"
                value={newProduct.codeNo}
                onChange={(e) => setNewProduct({ ...newProduct, codeNo: e.target.value })}
                placeholder="Code"
                style={{ padding: '10px' }}
              />
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Product Name</label>
              <input
                type="text"
                value={newProduct.particular}
                onChange={(e) => setNewProduct({ ...newProduct, particular: e.target.value })}
                placeholder="Product name"
                style={{ padding: '10px' }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Category</label>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                style={{ padding: '10px' }}
              >
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{CATEGORIES[cat].label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Rate (₹)</label>
              <input
                type="number"
                min="0"
                value={newProduct.rate || ''}
                onChange={(e) => setNewProduct({ ...newProduct, rate: e.target.value })}
                placeholder="0"
                style={{ padding: '10px' }}
              />
            </div>
            <button onClick={addProduct} className="btn-success" style={{ padding: '10px 20px' }}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 200px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or code..."
              style={{ padding: '10px' }}
            />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: '10px' }}
            >
              <option value="ALL">All Categories</option>
              {CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{CATEGORIES[cat].label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '10px' }}
            >
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#757575' }}>
            Showing {filteredProducts.length} of {products.length}
          </span>
        </div>
      </div>

      {/* Products Table */}
      <div className="card" style={{ padding: '8px' }}>
        <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Rate (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} style={{
                  opacity: product.status === 'hidden' ? 0.5 : 1,
                  background: product.status === 'hidden' ? '#fafafa' : 'transparent'
                }}>
                  <td>{product.sno}</td>
                  <td>{product.codeNo}</td>
                  <td style={{ fontWeight: '600' }}>{product.particular}</td>
                  <td style={{ fontSize: '0.8rem' }}>{CATEGORIES[product.category]?.label || product.category}</td>
                  <td>
                    {editingRate === product.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          value={newRateValue}
                          onChange={(e) => setNewRateValue(e.target.value)}
                          style={{ width: '80px', padding: '6px', textAlign: 'center' }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRate(product.id);
                            if (e.key === 'Escape') setEditingRate(null);
                          }}
                        />
                        <button
                          onClick={() => saveRate(product.id)}
                          style={{ padding: '4px 8px', background: '#2e7d32', color: 'white', borderRadius: '4px', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => handleRateEdit(product.id)}
                        style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: '#e3f2fd' }}
                        title="Click to edit"
                      >
                        ₹{product.rate || 0}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                      background: product.status === 'active' ? '#e8f5e9' : '#ffebee',
                      color: product.status === 'active' ? '#2e7d32' : '#c62828'
                    }}>
                      {product.status === 'active' ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleStatus(product.id)}
                      style={{
                        padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem',
                        background: product.status === 'active' ? '#ffebee' : '#e8f5e9',
                        color: product.status === 'active' ? '#c62828' : '#2e7d32',
                        border: 'none', cursor: 'pointer'
                      }}
                    >
                      {product.status === 'active' ? 'Hide' : 'Show'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
