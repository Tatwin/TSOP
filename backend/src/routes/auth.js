const express = require('express');
const router = express.Router();
const { generateToken, authMiddleware, requireRole, ROLES } = require('../middleware/auth');
const fileStore = require('../services/fileStore');
const auditService = require('../services/auditService');

// POST /api/auth/login - PIN-based login
router.post('/login', (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  // Check against stored users
  const users = fileStore.get('users') || [];
  const user = users.find(u => u.pin === pin);

  if (!user) {
    auditService.log({
      action: 'LOGIN',
      module: 'auth',
      user: 'anonymous',
      description: `Failed login attempt`,
      metadata: { success: false }
    });
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const token = generateToken(user);
  
  auditService.log({
    action: 'LOGIN',
    module: 'auth',
    user: user.username,
    description: `Successful login: ${user.name} (${user.role})`,
    metadata: { success: true, role: user.role }
  });

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

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/roles - Get available roles and permissions
router.get('/roles', (req, res) => {
  res.json({ roles: ROLES });
});

// GET /api/auth/users - List all users (admin only)
router.get('/users', requireRole('admin'), (req, res) => {
  const users = fileStore.get('users') || [];
  // Never send PINs in response
  const safeUsers = users.map(({ pin, ...u }) => u);
  res.json({ users: safeUsers });
});

// POST /api/auth/users - Create a new user (admin only)
router.post('/users', requireRole('admin'), (req, res) => {
  const { username, name, role, pin } = req.body;

  if (!username || !name || !pin) {
    return res.status(400).json({ error: 'username, name, and pin are required' });
  }

  if (!ROLES[role]) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.keys(ROLES).join(', ')}` });
  }

  if (pin.length < 4 || pin.length > 8) {
    return res.status(400).json({ error: 'PIN must be 4-8 digits' });
  }

  const users = fileStore.get('users') || [];
  
  // Check for duplicate username or PIN
  if (users.find(u => u.username === username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  if (users.find(u => u.pin === pin)) {
    return res.status(409).json({ error: 'PIN already in use by another user' });
  }

  const maxId = users.length > 0 ? Math.max(...users.map(u => Number(u.id))) : 0;
  const newUser = {
    id: String(maxId + 1),
    username,
    name: name.toUpperCase(),
    role,
    pin,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  fileStore.set('users', users);

  auditService.log({
    action: 'CREATE',
    module: 'auth',
    user: req.user?.username || 'admin',
    description: `User created: ${newUser.name} (${role})`,
    newValue: { username, name: newUser.name, role }
  });

  const { pin: _, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// PUT /api/auth/users/:id - Update a user (admin only)
router.put('/users/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, role, pin } = req.body;

  const users = fileStore.get('users') || [];
  const userIdx = users.findIndex(u => u.id === id);
  
  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const previous = { name: users[userIdx].name, role: users[userIdx].role };

  if (name) users[userIdx].name = name.toUpperCase();
  if (role && ROLES[role]) users[userIdx].role = role;
  if (pin) {
    if (pin.length < 4 || pin.length > 8) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }
    // Check PIN not already used
    const existing = users.find(u => u.pin === pin && u.id !== id);
    if (existing) {
      return res.status(409).json({ error: 'PIN already in use by another user' });
    }
    users[userIdx].pin = pin;
  }

  users[userIdx].updatedAt = new Date().toISOString();
  fileStore.set('users', users);

  auditService.log({
    action: 'UPDATE',
    module: 'auth',
    user: req.user?.username || 'admin',
    description: `User updated: ${users[userIdx].name}`,
    previousValue: previous,
    newValue: { name: users[userIdx].name, role: users[userIdx].role }
  });

  const { pin: _, ...safeUser } = users[userIdx];
  res.json({ success: true, user: safeUser });
});

// DELETE /api/auth/users/:id - Delete a user (admin only, cannot delete self)
router.delete('/users/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const users = fileStore.get('users') || [];
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Must keep at least one admin
  const admins = users.filter(u => u.role === 'admin');
  if (user.role === 'admin' && admins.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last admin user' });
  }

  const filtered = users.filter(u => u.id !== id);
  fileStore.set('users', filtered);

  auditService.log({
    action: 'DELETE',
    module: 'auth',
    user: req.user?.username || 'admin',
    description: `User deleted: ${user.name} (${user.role})`,
    previousValue: { username: user.username, name: user.name, role: user.role }
  });

  res.json({ success: true, message: `User ${user.name} deleted` });
});

module.exports = router;
