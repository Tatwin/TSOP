require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { securityHeaders, rateLimiter, validateInput, requestLogger, errorHandler } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const dailyEntryRoutes = require('./routes/dailyEntry');
const denominationRoutes = require('./routes/denomination');
const exportRoutes = require('./routes/export');
const dashboardRoutes = require('./routes/dashboard');
const auditRoutes = require('./routes/audit');
const backupRoutes = require('./routes/backup');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// ===== Security Middleware (applied FIRST) =====
app.use(securityHeaders);
app.use(requestLogger);

// CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting and input validation
app.use(rateLimiter);
app.use(validateInput);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/daily-entry', dailyEntryRoutes);
app.use('/api/denomination', denominationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/notifications', notificationRoutes);

// Reliability service - startup check
const reliability = require('./services/reliability');
const startupResult = reliability.startupCheck();
if (startupResult.status !== 'healthy') {
  console.warn(`[Startup] Database status: ${startupResult.status}`, startupResult.details);
}

// Health check (enhanced with reliability data)
app.get('/api/health', (req, res) => {
  const health = reliability.quickHealthCheck();
  const resources = reliability.getResourceStatus();
  res.json({
    status: health.healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: health.checks,
    resources: {
      memoryMB: resources.memory.rss,
      dbSize: resources.database.sizeFormatted,
      uptime: resources.uptime
    }
  });
});

// Reliability endpoints
app.get('/api/health/detailed', (req, res) => {
  const integrity = reliability.checkDatabaseIntegrity();
  const health = reliability.quickHealthCheck();
  const resources = reliability.getResourceStatus();
  const crashes = reliability.getCrashLogs(5);
  const healthHistory = reliability.getHealthHistory(10);
  
  res.json({
    integrity,
    health,
    resources,
    recentCrashes: crashes,
    healthHistory,
    startupResult
  });
});

app.post('/api/health/repair', (req, res) => {
  const result = reliability.attemptRepair();
  res.json(result);
});

app.post('/api/health/restore-latest', (req, res) => {
  const result = reliability.restoreLatestBackup();
  res.json(result);
});

// Root route - show API status
app.get('/', (req, res) => {
  res.json({
    name: 'TASMAC POS API',
    shop: 'Shop No. 1745 - Alandurai, Coimbatore (North)',
    status: 'running',
    version: '2.0.0',
    features: ['file-persistence', 'audit-logs', 'backup-restore', 'analytics'],
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      products: '/api/products',
      dailyEntry: '/api/daily-entry/:date',
      denomination: '/api/denomination/:date',
      export: '/api/export/daily',
      dashboard: '/api/dashboard/today',
      analytics: '/api/dashboard/analytics',
      topDays: '/api/dashboard/top-days',
      audit: '/api/audit/logs',
      backup: '/api/backup/list'
    }
  });
});

// Global error handler (from security middleware - never exposes stack in production)
app.use(errorHandler);

/**
 * Start the server.
 * When required as a module (e.g., inside Electron), call startServer() manually.
 * When run directly (node index.js), starts automatically.
 */
function startServer(port) {
  const p = port || PORT;
  return new Promise((resolve, reject) => {
    const server = app.listen(p, () => {
      console.log(`TASMAC POS Backend v2.0 running on port ${p}`);
      console.log(`Features: SQLite, Audit Logs, Backup/Restore, Analytics, Notifications`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// Auto-start when run directly (not imported)
if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = app;
module.exports.startServer = startServer;
