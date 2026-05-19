require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const dailyEntryRoutes = require('./routes/dailyEntry');
const denominationRoutes = require('./routes/denomination');
const exportRoutes = require('./routes/export');
const dashboardRoutes = require('./routes/dashboard');

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
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      products: '/api/products',
      dailyEntry: '/api/daily-entry/:date',
      denomination: '/api/denomination/:date',
      export: '/api/export/daily',
      dashboard: '/api/dashboard/today'
    }
  });
});

app.listen(PORT, () => {
  console.log(`TASMAC POS Backend running on port ${PORT}`);
});

module.exports = app;
