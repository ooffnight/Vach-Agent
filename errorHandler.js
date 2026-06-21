/* =====================================================
   middleware/errorHandler.js — Централизованная обработка ошибок
   R-26: единый формат ответа об ошибке.
   ===================================================== */

'use strict';

const config = require('../config');

/**
 * Express error-handling middleware.
 * Должен быть подключён ПОСЛЕДНИМ через app.use().
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Невалидный JSON в теле запроса (body-parser выбрасывает SyntaxError с status=400)
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    return res.status(400).json({ error: 'Невалидный JSON в теле запроса' });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }
  // PostgreSQL FK violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Нарушение ссылочной целостности' });
  }
  // PostgreSQL connection refused / not available
  if (err.code === 'ECONNREFUSED' || err.code === '08006' || err.code === '08001') {
    return res.status(503).json({ error: 'База данных временно недоступна' });
  }

  console.error('[ERROR]', err.stack || err.message);
  const payload = { error: 'Внутренняя ошибка сервера' };
  if (config.NODE_ENV !== 'production') {
    payload.message = err.message;
  }
  res.status(500).json(payload);
}

module.exports = errorHandler;
