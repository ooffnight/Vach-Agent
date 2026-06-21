/* =====================================================
   ВАШ АГЕНТ — Конфигурация и валидация окружения
   R-23: проверка env на старте процесса.
   R-02: JWT_SECRET — обязателен, без hardcoded fallback.
   ===================================================== */

'use strict';

const dotenv = require('dotenv');
dotenv.config();

/**
 * Список обязательных переменных окружения. Процесс падает на старте,
 * если хотя бы одна отсутствует — это сознательно: безопаснее
 * не запуститься, чем запуститься с дефолтным JWT-секретом.
 */
const REQUIRED_ENV = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error('\n[CONFIG] FATAL: отсутствуют переменные окружения:');
    missing.forEach((name) => console.error('  - ' + name));
    console.error('\n[CONFIG] Скопируйте .env.example в .env и заполните значения.\n');
    process.exit(1);
  }

  // Доп. валидации
  if (process.env.JWT_SECRET.length < 32) {
    console.error('[CONFIG] FATAL: JWT_SECRET должен быть не короче 32 символов.');
    process.exit(1);
  }
  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error('[CONFIG] FATAL: DB_PORT должен быть целым числом 1..65535.');
    process.exit(1);
  }
}

validateEnv();

module.exports = {
  PORT:           Number(process.env.PORT) || 3000,
  NODE_ENV:       process.env.NODE_ENV || 'development',
  DB: {
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  JWT: {
    secret:    process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',  // R-05: переименовано
  },
  CORS: {
    origins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  },
};
