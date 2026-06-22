/* =====================================================
   ВАШ АГЕНТ — Подключение к PostgreSQL (pg pool)
   R-04: единое имя БД из config (vash_agent).
   R-03: убрана маскировка ошибок мок-данными.
   ===================================================== */

'use strict';

const { Pool } = require('pg');
const config   = require('./config');

const pool = new Pool({
  host:     config.DB.host,
  port:     config.DB.port,
  database: config.DB.database,
  user:     config.DB.user,
  password: config.DB.password,
  ssl:      config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max:                     20,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  if (config.NODE_ENV !== 'test') {
    console.log('[DB] PostgreSQL connection established');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

/**
 * Helper: execute parameterized query.
 * @param {string} text SQL with $1, $2 placeholders
 * @param {Array}  params
 * @returns {Promise<{ rows, rowCount }>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.NODE_ENV !== 'production' && config.NODE_ENV !== 'test') {
      console.log('[DB] query', { text: text.slice(0, 80), duration: duration + 'ms', rows: result.rowCount });
    }
    return result;
  } catch (err) {
    console.error('[DB] query error:', err.message);
    throw err;
  }
}

/**
 * Helper: get raw client (for transactions).
 */
async function getClient() {
  const client = await pool.connect();
  const release = client.release.bind(client);
  const timeout = setTimeout(() => {
    console.warn('[DB] Client checked out for >5s, releasing');
    release();
  }, 5000);
  client.release = () => {
    clearTimeout(timeout);
    release();
  };
  return client;
}

module.exports = { query, getClient, pool };
