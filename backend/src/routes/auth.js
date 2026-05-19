const express = require('express');
const router = express.Router();
const { generateToken, authMiddleware } = require('../middleware/auth');

// Default admin credentials (should be changed in production)
const DEFAULT_USERS = [
  {
    id: '1',
    username: 'antonysamy',
    password: 'tasmac1745', // In production, use bcrypt
    name: 'ANTONYSAMY.A',
    role: 'admin'
  }
];

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = DEFAULT_USERS.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
