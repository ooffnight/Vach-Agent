/* =====================================================
   ВАШ АГЕНТ — Node.js / Express Server
   R-02 + R-23: валидация env на старте (через config.js).
   R-06: ограниченный CORS, helmet с CSP по умолчанию.
   R-26: централизованный обработчик ошибок.
   ===================================================== */

'use strict';

// ── ВАЖНО: config.js валидирует env и упадёт, если что-то не так ──
const config = require('./config');

const express  = require('express');
const path     = require('path');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');

const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── R-06: helmet с дефолтным CSP, но разрешаем CDN для Chart.js и Three.js ──
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src':  ["'self'"],
      'script-src':   ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
      'style-src':    ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      'font-src':     ["'self'", 'https://fonts.gstatic.com'],
      'img-src':      ["'self'", 'data:', 'https:'],
      'connect-src':  ["'self'"],
      'frame-src':    ["'none'"],
      'script-src-attr': ["'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── R-06: CORS — по whitelist. В dev режиме разрешаем всё (для удобства) ──
if (config.NODE_ENV === 'production') {
  app.use(cors({
    origin: config.CORS.origins.length > 0 ? config.CORS.origins : false,
    credentials: true,
  }));
} else {
  app.use(cors());  // dev: открытый CORS
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Статические файлы ──────────────────────────────
app.use(express.static(path.join(__dirname, '../..')));

// ── API Routes ─────────────────────────────────────
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/leads',      require('./routes/leads'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/visualizer', require('./routes/visualizer'));

// ── Health Check ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'ВАШ АГЕНТ API',
    version: '2.0.0',
    env:     config.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

// ── HTML Routes ────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../..', 'index.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../..', 'admin.html'));
});

// ── 404 ────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint не найден' });
  }
  res.status(404).sendFile(path.join(__dirname, '../..', 'index.html'));
});

// ── R-26: централизованный error handler — должен быть последним ─
app.use(errorHandler);

// ── Start Server ───────────────────────────────────
if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  ВАШ АГЕНТ Server (refactored)           ║');
    console.log(`║  http://localhost:${String(config.PORT).padEnd(23)}║`);
    console.log(`║  ENV: ${config.NODE_ENV.padEnd(35)}║`);
    console.log('╚══════════════════════════════════════════╝\n');
  });
}

module.exports = app;
