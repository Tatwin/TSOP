require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`TASMAC POS Backend v2.0 running on port ${PORT}`);
  console.log(`Features: File Persistence, Audit Logs, Backup/Restore, Analytics`);
});

module.exports = app;
