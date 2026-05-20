import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS } from '../data/products';
import api from '../utils/api';

const PIN_REQUIRED = '1745';

export default function ManageProducts() {
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
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'categories' | 'staff'
  const [categories, setCategories] = useState(() => ({ ...CATEGORIES }));
  const [newCategory, setNewCategory] = useState({ key: '', label: '', bottlesPerCase: 48 });
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCatLabel, setEditCatLabel] = useState('');
  const [editCatBPC, setEditCatBPC] = useState('');


  // Staff state
  const [staffList, setStaffList] = useState({ salesmen: [], supervisors: [] });
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffType, setNewStaffType] = useState('salesmen');
  const [editingStaff, setEditingStaff] = useState(null); // { type, index }
  const [editStaffName, setEditStaffName] = useState('');

  const [loadingData, setLoadingData] = useState(false);

  // Load products and categories from API
  useEffect(() => {
    if (authenticated) {
      setLoadingData(true);
      api.get('/products').then(res => {
        if (res.data.products) setProducts(res.data.products);
        if (res.data.categories) setCategories(res.data.categories);
      }).catch(() => {}).finally(() => setLoadingData(false));
    }
  }, [authenticated]);

  // Load staff
  useEffect(() => {
    if (authenticated) {
      api.get('/products/staff').then(res => {
        if (res.data.staff) setStaffList(res.data.staff);
      }).catch(() => {});
    }
  }, [authenticated]);

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

  const saveRate = async (productId) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, rate: Number(newRateValue) || 0 } : p
    ));
    try {
      await api.put(`/products/${productId}/rate`, { rate: Number(newRateValue) || 0 });
    } catch {}
    setEditingRate(null);
    setNewRateValue('');
    showMsg('Rate updated');
  };

  const toggleStatus = async (productId) => {
    const product = products.find(p => p.id === productId);
    const newStatus = product.status === 'active' ? 'hidden' : 'active';
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, status: newStatus } : p
    ));
    try {
      await api.put(`/products/${productId}/status`, { status: newStatus });
    } catch {}
    showMsg('Status updated');
  };

  const deleteProduct = async (productId, productName) => {
    if (!window.confirm(`Delete "${productName}"? This cannot be undone.`)) return;
    setProducts(prev => prev.filter(p => p.id !== productId));
    try {
      await api.put(`/products/${productId}/status`, { status: 'deleted' });
    } catch {}
    showMsg('Product deleted');
  };


  const addProduct = async () => {
    if (!newProduct.particular.trim()) {
      showMsg('Product name is required');
      return;
    }
    try {
      const res = await api.post('/products', {
        codeNo: newProduct.codeNo,
        particular: newProduct.particular,
        category: newProduct.category,
        rate: Number(newProduct.rate) || 0
      });
      if (res.data.product) {
        setProducts(prev => [...prev, res.data.product]);
      }
      setNewProduct({ codeNo: '', particular: '', category: '180ML_BRANDY', rate: 0 });
      setShowAddForm(false);
      showMsg('Product added successfully');
    } catch {
      showMsg('Failed to add product');
    }
  };

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddCategory = async () => {
    if (!newCategory.key.trim() || !newCategory.label.trim()) {
      showMsg('Category key and label are required');
      return;
    }
    const key = newCategory.key.toUpperCase().replace(/\s+/g, '_');
    if (categories[key]) {
      showMsg('Category key already exists');
      return;
    }
    try {
      const res = await api.post('/products/categories', {
        key: newCategory.key,
        label: newCategory.label,
        bottlesPerCase: Number(newCategory.bottlesPerCase) || 48
      });
      if (res.data.category) {
        setCategories(prev => ({
          ...prev,
          [res.data.category.key]: { label: res.data.category.label, bottlesPerCase: res.data.category.bottlesPerCase }
        }));
      }
      setNewCategory({ key: '', label: '', bottlesPerCase: 48 });
      setShowAddCategory(false);
      showMsg('Category added successfully');
    } catch (err) {
      if (err.response?.status === 409) {
        showMsg('Category key already exists');
      } else {
        showMsg('Failed to add category');
      }
    }
  };

  // Edit category
  const startEditCategory = (key) => {
    setEditingCategory(key);
    setEditCatLabel(categories[key].label);
    setEditCatBPC(String(categories[key].bottlesPerCase));
  };

  const saveEditCategory = async (key) => {
    const updatedLabel = editCatLabel;
    const updatedBPC = Number(editCatBPC) || 48;
    setCategories(prev => ({
      ...prev,
      [key]: { ...prev[key], label: updatedLabel, bottlesPerCase: updatedBPC }
    }));
    setEditingCategory(null);
    try {
      await api.put(`/products/categories/${key}`, { label: updatedLabel, bottlesPerCase: updatedBPC });
      showMsg('Category updated');
    } catch {
      showMsg('Failed to save category to server');
    }
  };

  // Delete category
  const handleDeleteCategory = async (key, label) => {
    const productCount = products.filter(p => p.category === key).length;
    const confirmMsg = productCount > 0
      ? `Delete category "${label}"? ${productCount} product(s) are in this category. They will become uncategorized.`
      : `Delete category "${label}"?`;
    if (!window.confirm(confirmMsg)) return;
    setCategories(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    try {
      await api.delete(`/products/categories/${key}`);
    } catch {}
    showMsg('Category deleted');
  };


  // Staff management
  const handleAddStaff = async () => {
    if (!newStaffName.trim()) { showMsg('Name is required'); return; }
    try {
      const res = await api.post('/products/staff', { type: newStaffType, name: newStaffName.trim() });
      if (res.data.staff) setStaffList(res.data.staff);
      setNewStaffName('');
      showMsg('Staff added');
    } catch { showMsg('Failed to add staff'); }
  };

  const handleEditStaff = async () => {
    if (!editingStaff || !editStaffName.trim()) return;
    try {
      const res = await api.put(`/products/staff/${editingStaff.index}`, { type: editingStaff.type, newName: editStaffName.trim() });
      if (res.data.staff) setStaffList(res.data.staff);
      setEditingStaff(null);
      setEditStaffName('');
      showMsg('Staff updated');
    } catch { showMsg('Failed to edit staff'); }
  };

  const handleDeleteStaff = async (type, index) => {
    if (!window.confirm('Delete this staff member?')) return;
    try {
      const res = await api.delete(`/products/staff/${index}`, { data: { type } });
      if (res.data.staff) setStaffList(res.data.staff);
      showMsg('Staff deleted');
    } catch { showMsg('Failed to delete staff'); }
  };

  // PIN entry screen
  if (!authenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div className="card-body">
            <h2 style={{ marginBottom: '16px', color: 'var(--text-dark)' }}>Manage Products</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Enter PIN to access product management</p>
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
              {pinError && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{pinError}</p>}
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div>
      {loadingData && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>Loading...</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching products & categories</p>
        </div>
      )}
      {!loadingData && <>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 24px' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-dark)' }}>Manage Products</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: 4, background: '#F4F6F4', borderRadius: 8, padding: 3 }}>
            {['products', 'categories', 'staff'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '6px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, border: 'none',
                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-gray)', cursor: 'pointer',
                textTransform: 'capitalize'
              }}>{tab}</button>
            ))}
          </div>
          {activeTab === 'products' && (
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn-success" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
              {showAddForm ? 'Cancel' : '+ Add Product'}
            </button>
          )}
          {activeTab === 'categories' && (
            <button onClick={() => setShowAddCategory(!showAddCategory)} className="btn-success" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
              {showAddCategory ? 'Cancel' : '+ Add Category'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', marginBottom: '12px',
          background: '#E8F5E9', color: '#0E6633', fontWeight: '600'
        }}>
          {message}
        </div>
      )}


      {/* === STAFF TAB === */}
      {activeTab === 'staff' && (
        <div>
          {/* Add Staff */}
          <div className="card">
            <div className="card-header">
              <h3>Add Staff Member</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 150px' }}>
                  <label className="form-label">Type</label>
                  <select value={newStaffType} onChange={e => setNewStaffType(e.target.value)} style={{ padding: 10 }}>
                    <option value="salesmen">Salesman</option>
                    <option value="supervisors">Supervisor</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Name</label>
                  <input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                    placeholder="Enter name" style={{ padding: 10 }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddStaff(); }} />
                </div>
                <button className="btn-success" onClick={handleAddStaff}>Add</button>
              </div>
            </div>
          </div>

          {/* Salesmen List */}
          <div className="card">
            <div className="card-header">
              <h3>Salesmen</h3>
              <span className="badge badge-primary">{staffList.salesmen.length}</span>
            </div>
            <div className="card-body" style={{ padding: '8px 16px' }}>
              {staffList.salesmen.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: 20 }}>No salesmen added</p>
              ) : (
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Actions</th></tr></thead>
                  <tbody>
                    {staffList.salesmen.map((name, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          {editingStaff && editingStaff.type === 'salesmen' && editingStaff.index === idx ? (
                            <input type="text" value={editStaffName} onChange={e => setEditStaffName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleEditStaff(); if (e.key === 'Escape') setEditingStaff(null); }}
                              style={{ width: 200, padding: '6px 8px' }} autoFocus />
                          ) : (
                            <span className="font-bold">{name}</span>
                          )}
                        </td>
                        <td>
                          {editingStaff && editingStaff.type === 'salesmen' && editingStaff.index === idx ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-sm btn-success" onClick={handleEditStaff}>Save</button>
                              <button className="btn-sm btn-secondary" onClick={() => setEditingStaff(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-sm" style={{ background: '#E8F5E9', color: 'var(--primary)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => { setEditingStaff({ type: 'salesmen', index: idx }); setEditStaffName(name); }}>Edit</button>
                              <button className="btn-sm" style={{ background: '#FEE2E2', color: 'var(--danger)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => handleDeleteStaff('salesmen', idx)}>Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>


          {/* Supervisors List */}
          <div className="card">
            <div className="card-header">
              <h3>Supervisors</h3>
              <span className="badge badge-primary">{staffList.supervisors.length}</span>
            </div>
            <div className="card-body" style={{ padding: '8px 16px' }}>
              {staffList.supervisors.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: 20 }}>No supervisors added</p>
              ) : (
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Actions</th></tr></thead>
                  <tbody>
                    {staffList.supervisors.map((name, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          {editingStaff && editingStaff.type === 'supervisors' && editingStaff.index === idx ? (
                            <input type="text" value={editStaffName} onChange={e => setEditStaffName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleEditStaff(); if (e.key === 'Escape') setEditingStaff(null); }}
                              style={{ width: 200, padding: '6px 8px' }} autoFocus />
                          ) : (
                            <span className="font-bold">{name}</span>
                          )}
                        </td>
                        <td>
                          {editingStaff && editingStaff.type === 'supervisors' && editingStaff.index === idx ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-sm btn-success" onClick={handleEditStaff}>Save</button>
                              <button className="btn-sm btn-secondary" onClick={() => setEditingStaff(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-sm" style={{ background: '#E8F5E9', color: 'var(--primary)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => { setEditingStaff({ type: 'supervisors', index: idx }); setEditStaffName(name); }}>Edit</button>
                              <button className="btn-sm" style={{ background: '#FEE2E2', color: 'var(--danger)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => handleDeleteStaff('supervisors', idx)}>Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}


      {/* === CATEGORIES TAB === */}
      {activeTab === 'categories' && (
        <div>
          {showAddCategory && (
            <div className="card" style={{ border: '2px solid var(--primary)' }}>
              <div className="card-body">
                <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Add New Category</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <label className="form-label">Key (e.g. 180ML_NEW)</label>
                    <input type="text" value={newCategory.key} onChange={(e) => setNewCategory({ ...newCategory, key: e.target.value })} placeholder="CATEGORY_KEY" style={{ padding: '10px' }} />
                  </div>
                  <div style={{ flex: '2 1 200px' }}>
                    <label className="form-label">Label</label>
                    <input type="text" value={newCategory.label} onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })} placeholder="Display label" style={{ padding: '10px' }} />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Bottles Per Case</label>
                    <input type="number" min="1" value={newCategory.bottlesPerCase || ''} onChange={(e) => setNewCategory({ ...newCategory, bottlesPerCase: e.target.value })} placeholder="48" style={{ padding: '10px' }} />
                  </div>
                  <button onClick={handleAddCategory} className="btn-success" style={{ padding: '10px 20px' }}>Add</button>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: '8px' }}>
            <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Label</th>
                    <th>Bottles Per Case</th>
                    <th>Products</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(categories).map(([key, cat]) => (
                    <tr key={key}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{key}</td>
                      <td>
                        {editingCategory === key ? (
                          <input type="text" value={editCatLabel} onChange={e => setEditCatLabel(e.target.value)}
                            style={{ width: 180, padding: '6px 8px' }} autoFocus />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{cat.label}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {editingCategory === key ? (
                          <input type="number" min="1" value={editCatBPC} onChange={e => setEditCatBPC(e.target.value)}
                            style={{ width: 80, padding: '6px 8px', textAlign: 'center' }} />
                        ) : (
                          cat.bottlesPerCase
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{products.filter(p => p.category === key).length}</td>
                      <td>
                        {editingCategory === key ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn-sm btn-success" onClick={() => saveEditCategory(key)}>Save</button>
                            <button className="btn-sm btn-secondary" onClick={() => setEditingCategory(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn-sm" style={{ background: '#E8F5E9', color: 'var(--primary)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                              onClick={() => startEditCategory(key)}>Edit</button>
                            <button className="btn-sm" style={{ background: '#FEE2E2', color: 'var(--danger)', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                              onClick={() => handleDeleteCategory(key, cat.label)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* === PRODUCTS TAB === */}
      {activeTab === 'products' && (<>
        {/* Add Product Form */}
        {showAddForm && (
          <div className="card" style={{ border: '2px solid var(--primary)' }}>
            <div className="card-body">
              <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Add New Product</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="form-label">Code No</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={newProduct.codeNo} onChange={(e) => setNewProduct({ ...newProduct, codeNo: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Code" style={{ padding: '10px' }} />
                </div>
                <div style={{ flex: '2 1 200px' }}>
                  <label className="form-label">Product Name</label>
                  <input type="text" value={newProduct.particular} onChange={(e) => setNewProduct({ ...newProduct, particular: e.target.value })} placeholder="Product name" style={{ padding: '10px' }} />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="form-label">Category</label>
                  <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} style={{ padding: '10px' }}>
                    {Object.entries(categories).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label className="form-label">Rate</label>
                  <input type="number" min="0" value={newProduct.rate || ''} onChange={(e) => setNewProduct({ ...newProduct, rate: e.target.value })} placeholder="0" style={{ padding: '10px' }} />
                </div>
                <button onClick={addProduct} className="btn-success" style={{ padding: '10px 20px' }}>Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 200px' }}>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or code..." style={{ padding: '10px' }} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: '10px' }}>
                <option value="ALL">All Categories</option>
                {Object.entries(categories).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '10px' }}>
                <option value="ALL">All Status</option>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} style={{
                    opacity: product.status === 'hidden' ? 0.5 : 1,
                    background: product.status === 'hidden' ? '#F4F6F4' : 'transparent'
                  }}>
                    <td>{product.sno}</td>
                    <td>{product.codeNo}</td>
                    <td style={{ fontWeight: '600' }}>{product.particular}</td>
                    <td style={{ fontSize: '0.8rem' }}>{categories[product.category]?.label || product.category}</td>
                    <td>
                      {editingRate === product.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input type="number" min="0" value={newRateValue} onChange={(e) => setNewRateValue(e.target.value)}
                            style={{ width: '80px', padding: '6px', textAlign: 'center' }} autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') saveRate(product.id); if (e.key === 'Escape') setEditingRate(null); }} />
                          <button onClick={() => saveRate(product.id)}
                            style={{ padding: '4px 8px', background: 'var(--primary)', color: 'white', borderRadius: '4px', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}>OK</button>
                        </div>
                      ) : (
                        <span onClick={() => handleRateEdit(product.id)}
                          style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: '#E8F5E9' }} title="Click to edit">
                          {'\u20B9'}{product.rate || 0}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                        background: product.status === 'active' ? '#E8F5E9' : '#FEE2E2',
                        color: product.status === 'active' ? '#0E6633' : '#D92426'
                      }}>
                        {product.status === 'active' ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => toggleStatus(product.id)}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem',
                          background: product.status === 'active' ? '#FEE2E2' : '#E8F5E9',
                          color: product.status === 'active' ? '#D92426' : '#0E6633',
                          border: 'none', cursor: 'pointer'
                        }}>
                        {product.status === 'active' ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => deleteProduct(product.id, product.particular)}
                        style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', background: '#FEE2E2', color: '#D92426', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
      </>}
    </div>
  );
}
