'use strict';

const express = require('express');
const app = express();

try {
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');

  const config = require('../server/config');
  const errorHandler = require('../server/middleware/errorHandler');

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
  app.use('/api/orders', require('../server/routes/orders'));
  app.use('/api/leads', require('../server/routes/leads'));
  app.use('/api/analytics', require('../server/routes/analytics'));
  app.use('/api/auth', require('../server/routes/auth'));
  app.use('/api/visualizer', require('../server/routes/visualizer'));

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
  // Если config.js или что-то еще упало, отдаем ошибку прямо в браузер
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
