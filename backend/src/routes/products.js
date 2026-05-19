const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');

// In-memory products store (in production, use Firestore)
let products = DEFAULT_PRODUCTS.map(p => ({ ...p, status: 'active' }));
let categories = { ...CATEGORIES };

// In-memory staff storage
let staff = {
  salesmen: ['SHANMUGASUNDARAM.P', 'ARUMUGAM.A', 'RAMESHKUMAR.A', 'SHANMUGASUNDARAM.M'],
  supervisors: ['ANTONYSAMY.A', 'SARAVAN']
};

// GET /api/products - Get all products
router.get('/', (req, res) => {
  res.json({ products, categories });
});

// GET /api/products/categories - Get all categories
router.get('/categories', (req, res) => {
  res.json({ categories });
});

// POST /api/products/categories - Add a new category
router.post('/categories', authMiddleware, (req, res) => {
  const { key, label, bottlesPerCase } = req.body;

  if (!key || !label) {
    return res.status(400).json({ error: 'Category key and label are required' });
  }

  const normalizedKey = key.toUpperCase().replace(/\s+/g, '_');
  if (categories[normalizedKey]) {
    return res.status(409).json({ error: 'Category already exists' });
  }

  categories[normalizedKey] = {
    label,
    bottlesPerCase: Number(bottlesPerCase) || 48
  };

  res.json({ success: true, category: { key: normalizedKey, ...categories[normalizedKey] } });
});

// PUT /api/products/categories/:key - Edit a category
router.put('/categories/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const { label, bottlesPerCase } = req.body;

  if (!categories[key]) {
    return res.status(404).json({ error: 'Category not found' });
  }

  if (label) categories[key].label = label;
  if (bottlesPerCase !== undefined) categories[key].bottlesPerCase = Number(bottlesPerCase) || 48;

  res.json({ success: true, category: { key, ...categories[key] } });
});

// GET /api/products/staff - Get staff list
router.get('/staff', (req, res) => {
  res.json({ staff });
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

  staff[type].push(name.toUpperCase());
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

  const idx = Number(index);
  if (idx < 0 || idx >= staff[type].length) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  staff[type][idx] = newName.toUpperCase();
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

  const idx = Number(index);
  if (idx < 0 || idx >= staff[type].length) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  staff[type].splice(idx, 1);
  res.json({ success: true, staff });
});

// PUT /api/products/:id/rate - Update product rate
router.put('/:id/rate', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { rate } = req.body;

  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  product.rate = Number(rate);
  res.json({ product });
});

// PUT /api/products/:id/status - Toggle product status
router.put('/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  product.status = status === 'hidden' ? 'hidden' : 'active';
  res.json({ product });
});

// POST /api/products - Add new product
router.post('/', authMiddleware, (req, res) => {
  const { codeNo, particular, category, rate } = req.body;

  if (!particular || !category) {
    return res.status(400).json({ error: 'Product name and category required' });
  }

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
  res.json({ product: newProduct });
});

module.exports = router;
