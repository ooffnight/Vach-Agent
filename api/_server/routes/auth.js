/* =====================================================
   /api/auth — Авторизация сотрудников (JWT)
   R-02: JWT_SECRET читается из config (валидация на старте).
   R-05: используется JWT_EXPIRES_IN.
   R-19: только Admin может регистрировать новых сотрудников.
   R-22: валидация входных данных через middleware.
   ===================================================== */

'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const config = require('../config');

const authMiddleware = require('../middleware/auth');
const requireRole    = require('../middleware/requireRole');
const { validate, rules } = require('../middleware/validate');

// ── Схемы валидации ─────────────────────────────────
const registerSchema = {
  login:    [rules.required, rules.string, rules.minLength(3)],
  password: [rules.required, rules.string, rules.minLength(6)],
};

const loginSchema = {
  login:    [rules.required, rules.string],
  password: [rules.required, rules.string],
};

// ── POST /api/auth/register ─────────────────────────
// R-19: только Admin может регистрировать новых сотрудников
router.post('/register',
  authMiddleware,
  requireRole('admin'),
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { login, password, name, role } = req.body;

      const finalRole = role === 'admin' ? 'admin' : 'manager';  // только 2 роли
      const hash = await bcrypt.hash(password, 10);

      const result = await db.query(
        `INSERT INTO users (login, password_hash, name, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, login, name, role, created_at`,
        [String(login).toLowerCase(), hash, name || null, finalRole]
      );

      res.status(201).json({ user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/login ────────────────────────────
router.post('/login',
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { login, password } = req.body;

      const result = await db.query(
        `SELECT id, login, password_hash, name, role
           FROM users
          WHERE login = $1`,
        [String(login).toLowerCase()]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      }

      const user = result.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      }

      const token = jwt.sign(
        { id: user.id, login: user.login, role: user.role },
        config.JWT.secret,
        { expiresIn: config.JWT.expiresIn }
      );

      res.json({
        user:  { id: user.id, login: user.login, name: user.name, role: user.role },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/me — Проверка JWT-токена ──────────
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // Подтверждаем токен и возвращаем актуальный профиль из БД
    const result = await db.query(
      `SELECT id, login, name, role, created_at
         FROM users
        WHERE id = $1`,
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
