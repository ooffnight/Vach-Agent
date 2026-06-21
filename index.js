'use strict';

const express = require('express');
const app = express();

try {
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');

  // Vercel NFT requires EXPLICIT string literals to trace dependencies!
  let config; try { config = require('../server/config'); } catch (e) { config = require('./server/config'); }
  let errorHandler; try { errorHandler = require('../server/middleware/errorHandler'); } catch (e) { errorHandler = require('./server/middleware/errorHandler'); }

  let ordersRoute; try { ordersRoute = require('../server/routes/orders'); } catch (e) { ordersRoute = require('./server/routes/orders'); }
  let leadsRoute; try { leadsRoute = require('../server/routes/leads'); } catch (e) { leadsRoute = require('./server/routes/leads'); }
  let analyticsRoute; try { analyticsRoute = require('../server/routes/analytics'); } catch (e) { analyticsRoute = require('./server/routes/analytics'); }
  let authRoute; try { authRoute = require('../server/routes/auth'); } catch (e) { authRoute = require('./server/routes/auth'); }
  let visualizerRoute; try { visualizerRoute = require('../server/routes/visualizer'); } catch (e) { visualizerRoute = require('./server/routes/visualizer'); }


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
