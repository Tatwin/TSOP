const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');

// In-memory products store (in production, use Firestore)
let products = DEFAULT_PRODUCTS.map(p => ({ ...p, status: 'active' }));

// GET /api/products - Get all products
router.get('/', (req, res) => {
  res.json({ products, categories: CATEGORIES });
});

// GET /api/products/categories - Get all categories
router.get('/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
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
