'use strict';

const express = require('express');
const app = express();

function getModule(localPath, vercelPath) {
  try {
    return require(localPath);
  } catch (e) {
    return require(vercelPath);
  }
}

try {
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');

  // Vercel NFT path resolution hack
  const config = getModule('../server/config', './server/config');
  const errorHandler = getModule('../server/middleware/errorHandler', './server/middleware/errorHandler');

  const ordersRoute = getModule('../server/routes/orders', './server/routes/orders');
  const leadsRoute = getModule('../server/routes/leads', './server/routes/leads');
  const analyticsRoute = getModule('../server/routes/analytics', './server/routes/analytics');
  const authRoute = getModule('../server/routes/auth', './server/routes/auth');
  const visualizerRoute = getModule('../server/routes/visualizer', './server/routes/visualizer');

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  if (config.NODE_ENV === 'production') {
    app.use(cors({
      origin: config.CORS.origins.length > 0 ? config.CORS.origins : false,
      credentials: true,
    }));
  } else {
    app.use(cors());
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // API Routes
  app.use('/api/orders', ordersRoute);
  app.use('/api/leads', leadsRoute);
  app.use('/api/analytics', analyticsRoute);
  app.use('/api/auth', authRoute);
  app.use('/api/visualizer', visualizerRoute);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ВАШ АГЕНТ API',
      version: '2.0.0',
      env: config.NODE_ENV,
      time: new Date().toISOString(),
    });
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint не найден' });
    }
    next();
  });

  app.use(errorHandler);

} catch (error) {
  console.error("Vercel Startup Error:", error);
  app.use((req, res) => {
    res.status(500).json({
      error: 'CRITICAL SERVER BOOT ERROR',
      message: error.message,
      stack: error.stack
    });
  });
}

module.exports = app;
