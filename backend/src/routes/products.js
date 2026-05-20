const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');
const fileStore = require('../services/fileStore');
const auditService = require('../services/auditService');

// Helper: get products (from store or defaults)
function getProducts() {
  const stored = fileStore.get('products');
  if (stored && stored.length > 0) return stored;
  return DEFAULT_PRODUCTS.map(p => ({ ...p, status: 'active' }));
}

// Helper: get categories (from store or defaults)
function getCategories() {
  const stored = fileStore.get('categories');
  if (stored && Object.keys(stored).length > 0) return stored;
  return { ...CATEGORIES };
}

// Helper: get staff
function getStaff() {
  const stored = fileStore.get('staff');
  if (stored) return stored;
  return {
    salesmen: ['SHANMUGASUNDARAM.P', 'ARUMUGAM.A', 'RAMESHKUMAR.A', 'SHANMUGASUNDARAM.M'],
    supervisors: ['ANTONYSAMY.A', 'SARAVAN']
  };
}

// GET /api/products - Get all products
router.get('/', (req, res) => {
  res.json({ products: getProducts(), categories: getCategories() });
});

// GET /api/products/categories - Get all categories
router.get('/categories', (req, res) => {
  res.json({ categories: getCategories() });
});

// POST /api/products/categories - Add a new category
router.post('/categories', authMiddleware, (req, res) => {
  const { key, label, bottlesPerCase } = req.body;

  if (!key || !label) {
    return res.status(400).json({ error: 'Category key and label are required' });
  }

  const categories = getCategories();
  const normalizedKey = key.toUpperCase().replace(/\s+/g, '_');
  if (categories[normalizedKey]) {
    return res.status(409).json({ error: 'Category already exists' });
  }

  categories[normalizedKey] = {
    label,
    bottlesPerCase: Number(bottlesPerCase) || 48
  };

  fileStore.set('categories', categories);

  auditService.log({
    action: 'CREATE',
    module: 'products',
    user: req.user?.username || 'admin',
    description: `Category created: ${label} (${normalizedKey})`,
    newValue: { key: normalizedKey, label, bottlesPerCase: Number(bottlesPerCase) || 48 }
  });

  res.json({ success: true, category: { key: normalizedKey, ...categories[normalizedKey] } });
});

// PUT /api/products/categories/:key - Edit a category
router.put('/categories/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const { label, bottlesPerCase } = req.body;
  const categories = getCategories();

  if (!categories[key]) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const previous = { ...categories[key] };
  if (label) categories[key].label = label;
  if (bottlesPerCase !== undefined) categories[key].bottlesPerCase = Number(bottlesPerCase) || 48;

  fileStore.set('categories', categories);

  auditService.log({
    action: 'UPDATE',
    module: 'products',
    user: req.user?.username || 'admin',
    description: `Category updated: ${key}`,
    previousValue: previous,
    newValue: categories[key]
  });

  res.json({ success: true, category: { key, ...categories[key] } });
});

// DELETE /api/products/categories/:key - Delete a category
router.delete('/categories/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const categories = getCategories();

  if (!categories[key]) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const removed = categories[key];
  delete categories[key];
  fileStore.set('categories', categories);

  auditService.log({
    action: 'DELETE',
    module: 'products',
    user: req.user?.username || 'admin',
    description: `Category deleted: ${removed.label} (${key})`,
    previousValue: { key, ...removed }
  });

  res.json({ success: true, deletedKey: key });
});

// GET /api/products/staff - Get staff list
router.get('/staff', (req, res) => {
  res.json({ staff: getStaff() });
});

// POST /api/products/staff - Add a salesman or supervisor
router.post('/staff', authMiddleware, (req, res) => {
  const { type, name } = req.body;

  if (!type || !name) {
    return res.status(400).json({ error: 'Type and name are required' });
  }

  if (type !== 'salesmen' && type !== 'supervisors') {
    return res.status(400).json({ error: 'Type must be salesmen or supervisors' });
  }

  const staff = getStaff();
  staff[type].push(name.toUpperCase());
  fileStore.set('staff', staff);

  auditService.log({
    action: 'CREATE',
    module: 'staff',
    user: req.user?.username || 'admin',
    description: `Staff added: ${name.toUpperCase()} (${type})`,
    newValue: { name: name.toUpperCase(), type }
  });

  res.json({ success: true, staff });
});

// PUT /api/products/staff/:index - Edit a staff member
router.put('/staff/:index', authMiddleware, (req, res) => {
  const { index } = req.params;
  const { type, newName } = req.body;

  if (!type || !newName) {
    return res.status(400).json({ error: 'Type and newName are required' });
  }

  if (type !== 'salesmen' && type !== 'supervisors') {
    return res.status(400).json({ error: 'Type must be salesmen or supervisors' });
  }

  const staff = getStaff();
  const idx = Number(index);
  if (idx < 0 || idx >= staff[type].length) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  const previousName = staff[type][idx];
  staff[type][idx] = newName.toUpperCase();
  fileStore.set('staff', staff);

  auditService.log({
    action: 'UPDATE',
    module: 'staff',
    user: req.user?.username || 'admin',
    description: `Staff renamed: ${previousName} → ${newName.toUpperCase()}`,
    previousValue: { name: previousName },
    newValue: { name: newName.toUpperCase() }
  });

  res.json({ success: true, staff });
});

// DELETE /api/products/staff/:index - Delete a staff member
router.delete('/staff/:index', authMiddleware, (req, res) => {
  const { index } = req.params;
  const { type } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Type is required' });
  }

  if (type !== 'salesmen' && type !== 'supervisors') {
    return res.status(400).json({ error: 'Type must be salesmen or supervisors' });
  }

  const staff = getStaff();
  const idx = Number(index);
  if (idx < 0 || idx >= staff[type].length) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  const removed = staff[type][idx];
  staff[type].splice(idx, 1);
  fileStore.set('staff', staff);

  auditService.log({
    action: 'DELETE',
    module: 'staff',
    user: req.user?.username || 'admin',
    description: `Staff deleted: ${removed} (${type})`,
    previousValue: { name: removed, type }
  });

  res.json({ success: true, staff });
});

// PUT /api/products/:id/rate - Update product rate
router.put('/:id/rate', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { rate } = req.body;

  const products = getProducts();
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const previousRate = product.rate;
  product.rate = Number(rate);
  fileStore.set('products', products);

  auditService.log({
    action: 'UPDATE',
    module: 'products',
    user: req.user?.username || 'admin',
    description: `Product rate changed: ${product.particular} ₹${previousRate} → ₹${rate}`,
    previousValue: { rate: previousRate },
    newValue: { rate: Number(rate) },
    metadata: { productId: id, productName: product.particular }
  });

  res.json({ product });
});

// PUT /api/products/:id/status - Toggle product status
router.put('/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const products = getProducts();
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const previousStatus = product.status;
  product.status = status === 'hidden' ? 'hidden' : 'active';
  fileStore.set('products', products);

  auditService.log({
    action: 'UPDATE',
    module: 'products',
    user: req.user?.username || 'admin',
    description: `Product ${product.particular} status: ${previousStatus} → ${product.status}`,
    previousValue: { status: previousStatus },
    newValue: { status: product.status },
    metadata: { productId: id }
  });

  res.json({ product });
});

// POST /api/products - Add new product
router.post('/', authMiddleware, (req, res) => {
  const { codeNo, particular, category, rate } = req.body;

  if (!particular || !category) {
    return res.status(400).json({ error: 'Product name and category required' });
  }

  const products = getProducts();
  const maxId = Math.max(...products.map(p => Number(p.id)));
  const maxSno = Math.max(...products.map(p => p.sno));
  
  const newProduct = {
    id: String(maxId + 1),
    sno: maxSno + 1,
    codeNo: codeNo || '',
    particular: particular.toUpperCase(),
    category,
    rate: Number(rate) || 0,
    status: 'active'
  };

  products.push(newProduct);
  fileStore.set('products', products);

  auditService.log({
    action: 'CREATE',
    module: 'products',
    user: req.user?.username || 'admin',
    description: `New product added: ${newProduct.particular} (${category})`,
    newValue: newProduct
  });

  res.json({ product: newProduct });
});

module.exports = router;
