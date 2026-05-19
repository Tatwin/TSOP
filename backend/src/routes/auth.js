const express = require('express');
const router = express.Router();
const { generateToken, authMiddleware } = require('../middleware/auth');

// PIN-based authentication (PIN: 1745)
const VALID_PIN = '1745';

const DEFAULT_USER = {
  id: '1',
  username: 'admin',
  name: 'ANTONYSAMY.A',
  role: 'admin'
};

// POST /api/auth/login - PIN-based login
router.post('/login', (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  if (pin !== VALID_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const token = generateToken(DEFAULT_USER);
  
  res.json({
    token,
    user: {
      id: DEFAULT_USER.id,
      username: DEFAULT_USER.username,
      name: DEFAULT_USER.name,
      role: DEFAULT_USER.role
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
