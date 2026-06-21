'use strict';

const express = require('express');
const app = express();

try {
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');
  // VERCEL NFT HACK:
  // Vercel's Static Analyzer will see these requires and bundle the files into /var/task/server/
  // But they will never execute at runtime, preventing the path resolution crash!
  if (false) {
    require('../server/config');
    require('../server/middleware/errorHandler');
    require('../server/routes/orders');
    require('../server/routes/leads');
    require('../server/routes/analytics');
    require('../server/routes/auth');
    require('../server/routes/visualizer');
  }

  // At runtime, Vercel places this file at /var/task/index.js.
  // So the relative path to the bundled files is ./server/...
  const config = require('./server/config');
  const errorHandler = require('./server/middleware/errorHandler');

  const ordersRoute = require('./server/routes/orders');
  const leadsRoute = require('./server/routes/leads');
  const analyticsRoute = require('./server/routes/analytics');
  const authRoute = require('./server/routes/auth');
  const visualizerRoute = require('./server/routes/visualizer');


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
