/**
 * Security Middleware for TASMAC POS
 * 
 * Features:
 * - Request validation (body size, content type, malicious input)
 * - Rate limiting (per IP, per route)
 * - Security headers (XSS, CSRF, clickjacking protection)
 * - Input sanitization
 * - Request logging for audit
 * - Error handling (never expose stack traces in production)
 */

// ============================================================
// Rate Limiter (in-memory, per IP)
// ============================================================

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 min

// Default limits per route pattern
const RATE_LIMITS = {
  'POST /api/auth/login': { max: 10, windowMs: 60000 },     // 10 login attempts/min
  'POST /api/backup/restore': { max: 3, windowMs: 300000 }, // 3 restores per 5 min
  'POST /api/export': { max: 20, windowMs: 60000 },         // 20 exports/min
  'DEFAULT_WRITE': { max: 60, windowMs: 60000 },            // 60 writes/min
  'DEFAULT_READ': { max: 200, windowMs: 60000 }             // 200 reads/min
};

/**
 * Rate limiting middleware
 */
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const routeKey = `${req.method} ${req.path}`;
  
  // Determine limit for this route
  let limit = RATE_LIMITS[routeKey];
  if (!limit) {
    limit = ['POST', 'PUT', 'DELETE'].includes(req.method) 
      ? RATE_LIMITS.DEFAULT_WRITE 
      : RATE_LIMITS.DEFAULT_READ;
  }
  
  const key = `${ip}:${routeKey}`;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return next();
  }
  
  const entry = rateLimitStore.get(key);
  
  // Reset window if expired
  if (now - entry.windowStart > limit.windowMs) {
    entry.count = 1;
    entry.windowStart = now;
    return next();
  }
  
  entry.count++;
  
  if (entry.count > limit.max) {
    res.setHeader('Retry-After', Math.ceil((entry.windowStart + limit.windowMs - now) / 1000));
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Max ${limit.max} requests per ${limit.windowMs / 1000}s.`,
      retryAfter: Math.ceil((entry.windowStart + limit.windowMs - now) / 1000)
    });
  }
  
  next();
}

// Periodic cleanup of expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 600000) { // Remove entries older than 10 min
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

// ============================================================
// Security Headers
// ============================================================

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  // Prevent XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Strict transport (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Remove Express fingerprint
  res.removeHeader('X-Powered-By');
  
  next();
}

// ============================================================
// Input Validation
// ============================================================

/**
 * Validate and sanitize request body
 * Prevents common injection attacks
 */
function validateInput(req, res, next) {
  // Skip validation for GET requests
  if (req.method === 'GET') return next();
  
  // Check content type for POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      // Allow if body is empty
      if (req.body && Object.keys(req.body).length > 0) {
        return res.status(415).json({ error: 'Unsupported content type. Use application/json.' });
      }
    }
  }
  
  // Sanitize string values in body (prevent NoSQL injection patterns)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Validate path parameters (no path traversal)
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string' && (value.includes('..') || value.includes('/') || value.includes('\\'))) {
        return res.status(400).json({ error: `Invalid parameter: ${key}` });
      }
    }
  }
  
  next();
}

/**
 * Recursively sanitize an object's string values
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Reject keys starting with $ (MongoDB/NoSQL injection)
      if (key.startsWith('$')) continue;
      // Reject __proto__ pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Sanitize a single string value
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str;
  
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Limit string length (prevent memory attacks)
  if (str.length > 100000) {
    str = str.substring(0, 100000);
  }
  
  return str;
}

// ============================================================
// Error Handler
// ============================================================

/**
 * Global error handler - never expose stack traces in production
 */
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Log error
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  if (isDev) console.error(err.stack);
  
  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  if (err.type === 'entity.too.large') statusCode = 413;
  if (err.type === 'entity.parse.failed') statusCode = 400;
  
  // Build response
  const response = {
    error: getErrorMessage(statusCode),
    message: isDev ? err.message : getGenericMessage(statusCode)
  };
  
  if (isDev) {
    response.stack = err.stack;
    response.details = err.details;
  }
  
  res.status(statusCode).json(response);
}

function getErrorMessage(status) {
  const messages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    429: 'Too Many Requests',
    500: 'Internal Server Error'
  };
  return messages[status] || 'Error';
}

function getGenericMessage(status) {
  if (status === 400) return 'The request was invalid.';
  if (status === 401) return 'Authentication required.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 413) return 'Request body too large.';
  if (status === 429) return 'Too many requests. Please slow down.';
  return 'An unexpected error occurred. Please try again.';
}

// ============================================================
// Request Logger
// ============================================================

/**
 * Simple request logger (non-blocking)
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'WARN' : 'INFO';
    
    // Only log mutations and errors in production
    if (process.env.NODE_ENV !== 'development') {
      if (req.method === 'GET' && res.statusCode < 400) return;
    }
    
    console.log(`[${logLevel}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms${req.user ? ' user=' + req.user.username : ''}`);
  });
  
  next();
}

// ============================================================
// PIN Brute Force Protection
// ============================================================

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an IP is locked out from login
 */
function checkLoginLockout(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const entry = loginAttempts.get(ip);
  
  if (entry && entry.locked && Date.now() < entry.lockedUntil) {
    const remainingSec = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: 'Account locked',
      message: `Too many failed login attempts. Try again in ${remainingSec} seconds.`,
      retryAfter: remainingSec
    });
  }
  
  next();
}

/**
 * Record a failed login attempt
 */
function recordFailedLogin(ip) {
  const entry = loginAttempts.get(ip) || { attempts: 0, locked: false };
  entry.attempts++;
  entry.lastAttempt = Date.now();
  
  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.locked = true;
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  
  loginAttempts.set(ip, entry);
}

/**
 * Reset login attempts on successful login
 */
function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Cleanup lockouts periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.locked && now > entry.lockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}, 60000);

// ============================================================
// Exports
// ============================================================

module.exports = {
  rateLimiter,
  securityHeaders,
  validateInput,
  errorHandler,
  requestLogger,
  checkLoginLockout,
  recordFailedLogin,
  resetLoginAttempts
};
