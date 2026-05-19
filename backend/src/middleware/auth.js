const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tasmac-pos-dev-secret-key';

/**
 * Role hierarchy and permissions
 * admin: full access to everything
 * operator: can enter data, save entries, export - but cannot manage users/backup/restore
 * viewer: read-only access, no mutations allowed
 */
const ROLES = {
  admin: {
    label: 'Administrator',
    permissions: [
      'dailyEntry:read', 'dailyEntry:write',
      'denomination:read', 'denomination:write',
      'products:read', 'products:write',
      'staff:read', 'staff:write',
      'export:execute',
      'dashboard:read',
      'analytics:read',
      'audit:read',
      'backup:create', 'backup:restore',
      'users:manage',
      'settings:manage'
    ]
  },
  operator: {
    label: 'Operator / Staff',
    permissions: [
      'dailyEntry:read', 'dailyEntry:write',
      'denomination:read', 'denomination:write',
      'products:read',
      'staff:read',
      'export:execute',
      'dashboard:read',
      'analytics:read',
      'audit:read'
    ]
  },
  viewer: {
    label: 'Viewer (Read Only)',
    permissions: [
      'dailyEntry:read',
      'denomination:read',
      'products:read',
      'staff:read',
      'dashboard:read',
      'analytics:read'
    ]
  }
};

/**
 * Simple JWT auth middleware - used for edit/save operations
 * Allows request through if valid token present
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. PIN required for this action.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token. Please re-enter PIN.' });
  }
}

/**
 * Permission-based middleware
 * Usage: requirePermission('products:write')
 */
function requirePermission(permission) {
  return (req, res, next) => {
    // First verify the token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      
      // Check permission
      const role = decoded.role || 'viewer';
      const roleConfig = ROLES[role];
      
      if (!roleConfig) {
        return res.status(403).json({ error: 'Invalid role assigned.' });
      }
      
      if (!roleConfig.permissions.includes(permission)) {
        return res.status(403).json({ 
          error: `Access denied. Role '${roleConfig.label}' does not have permission: ${permission}`,
          requiredPermission: permission,
          userRole: role
        });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
}

/**
 * Role-based middleware (simpler - just checks role level)
 * Usage: requireRole('admin')
 */
function requireRole(minRole) {
  const roleHierarchy = ['viewer', 'operator', 'admin'];
  
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      
      const userRoleLevel = roleHierarchy.indexOf(decoded.role || 'viewer');
      const requiredLevel = roleHierarchy.indexOf(minRole);
      
      if (userRoleLevel < requiredLevel) {
        return res.status(403).json({ 
          error: `Access denied. Requires '${minRole}' role or higher.`,
          userRole: decoded.role || 'viewer'
        });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role || 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Check if a user has a specific permission (utility, not middleware)
 */
function hasPermission(role, permission) {
  const roleConfig = ROLES[role];
  if (!roleConfig) return false;
  return roleConfig.permissions.includes(permission);
}

module.exports = { 
  authMiddleware, 
  requirePermission, 
  requireRole, 
  generateToken, 
  hasPermission,
  ROLES, 
  JWT_SECRET 
};
