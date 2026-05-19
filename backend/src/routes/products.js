const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');

// In-memory products store (in production, use Firestore)
let products = [...DEFAULT_PRODUCTS];

// GET /api/products - Get all products
router.get('/', authMiddleware, (req, res) => {
  res.json({ products, categories: CATEGORIES });
});

// GET /api/products/categories - Get all categories
router.get('/categories', authMiddleware, (req, res) => {
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

module.exports = router;
