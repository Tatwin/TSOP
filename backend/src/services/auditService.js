/**
 * Audit Logging Service for TASMAC POS
 * Tracks all mutations with who/what/when/previous/new values
 */
const fileStore = require('./fileStore');

/**
 * Log an audit event
 * @param {Object} params
 * @param {string} params.action - CREATE | UPDATE | DELETE | LOGIN | EXPORT | BACKUP | RESTORE
 * @param {string} params.module - dailyEntry | denomination | products | staff | auth | export | backup
 * @param {string} params.user - username performing action
 * @param {string} params.description - human-readable description
 * @param {Object} [params.previousValue] - value before change
 * @param {Object} [params.newValue] - value after change
 * @param {Object} [params.metadata] - extra context (date, productId, etc.)
 */
function log({ action, module, user, description, previousValue, newValue, metadata }) {
  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    module,
    user: user || 'system',
    description,
    previousValue: previousValue || null,
    newValue: newValue || null,
    metadata: metadata || {}
  };
  
  fileStore.append('auditLogs', entry);
  return entry;
}

/**
 * Get audit logs with optional filtering
 */
function getLogs({ module, user, action, startDate, endDate, limit, offset } = {}) {
  let logs = fileStore.get('auditLogs') || [];
  
  // Apply filters
  if (module) {
    logs = logs.filter(l => l.module === module);
  }
  if (user) {
    logs = logs.filter(l => l.user === user);
  }
  if (action) {
    logs = logs.filter(l => l.action === action);
  }
  if (startDate) {
    logs = logs.filter(l => l.timestamp >= startDate);
  }
  if (endDate) {
    logs = logs.filter(l => l.timestamp <= endDate + 'T23:59:59.999Z');
  }
  
  // Sort newest first
  logs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const total = logs.length;
  
  // Pagination
  const off = Number(offset) || 0;
  const lim = Number(limit) || 50;
  logs = logs.slice(off, off + lim);
  
  return { logs, total, offset: off, limit: lim };
}

/**
 * Get stock movement history for a specific product
 */
function getStockHistory(productId, limit = 30) {
  let logs = fileStore.get('auditLogs') || [];
  return logs
    .filter(l => l.metadata?.productId === productId || (l.module === 'dailyEntry' && l.metadata?.date))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Generate a short unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/**
 * Express middleware that auto-logs POST/PUT/DELETE requests
 */
function auditMiddleware(moduleName) {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Only log successful mutations
      if (res.statusCode < 400 && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const user = req.user?.username || 'anonymous';
        const action = req.method === 'POST' ? 'CREATE' : req.method === 'PUT' ? 'UPDATE' : 'DELETE';
        
        log({
          action,
          module: moduleName,
          user,
          description: `${action} ${moduleName} - ${req.method} ${req.originalUrl}`,
          metadata: {
            path: req.originalUrl,
            method: req.method,
            params: req.params,
            date: req.params?.date || req.body?.date
          }
        });
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

module.exports = {
  log,
  getLogs,
  getStockHistory,
  auditMiddleware
};
