/* =====================================================
   /api/orders — Заявки на ремонт
   R-01: JWT на GET, GET/:id, PATCH/:id/status (по Таблице 5 диплома).
   R-03: убрана маскировка ошибок БД mock-ответами.
   R-07: добавлен POST /api/orders/calculate (по Прил. В диплома).
   R-08: расчёт по формуле (5) P=S×k×C через сервис pricing.
   R-22: валидация DTO через middleware.
   ===================================================== */

'use strict';

const router  = require('express').Router();
const db      = require('../db');
const pricing = require('../services/pricing');

const authMiddleware       = require('../middleware/auth');
const { validate, rules }  = require('../middleware/validate');

// ── Схемы валидации ─────────────────────────────────
const calculateSchema = {
  type: [rules.required, rules.string, rules.enum(pricing.VALID_TYPES)],
  area: [rules.required, rules.number, rules.positiveNum],
};

const createOrderSchema = {
  name:  [rules.required, rules.string, rules.minLength(2)],
  phone: [rules.required, rules.phone],
  type:  [rules.required, rules.enum(pricing.VALID_TYPES)],
  area:  [rules.required, rules.number, rules.positiveNum],
  email: [rules.email],
  address: [(v) => v == null || typeof v === 'string'],
};

const ALLOWED_STATUSES = ['new','confirmed','in_progress','completed','cancelled'];

const statusUpdateSchema = {
  status: [rules.required, rules.enum(ALLOWED_STATUSES)],
};

// ── POST /api/orders/calculate ──────────────────────
// R-07 + R-08: серверный расчёт по формуле (5) диплома.
// Открытый маршрут (по Прил. В: используется на публичном калькуляторе).
router.post('/calculate',
  validate(calculateSchema),
  (req, res, next) => {
    try {
      const { type, area } = req.body;
      const price = pricing.calculatePrice(type, Number(area));
      res.json({
        type,
        area:  Number(area),
        price,
        formula: 'P = S × k × C',
        breakdown: {
          S: Number(area),
          k: pricing.RATE_COEFFICIENTS[type],
          C: pricing.BASE_RATE_PER_SQM,
        },
      });
    } catch (err) {
      // Ошибки расчёта — это валидационные ошибки бизнес-уровня
      return res.status(400).json({ error: err.message });
    }
  }
);

// ── POST /api/orders — Создание заявки ──────────────
// Открытый маршрут (по Таблице 5: без авторизации) — клиент посылает заявку.
router.post('/',
  validate(createOrderSchema),
  async (req, res, next) => {
    try {
      const { name, phone, email, type, area, address } = req.body;

      // R-08: цену рассчитываем на сервере, не доверяем клиенту
      const price = pricing.calculatePrice(type, Number(area));

      const result = await db.query(
        `INSERT INTO orders (name, phone, email, type, area, price, status, address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, NOW())
         RETURNING id, name, phone, email, type, area, price, status, address, created_at`,
        [name, phone, email || null, type, Number(area), price, address || null]
      );

      res.status(201).json({
        success: true,
        order:   result.rows[0],
        message: 'Заявка успешно создана! Менеджер свяжется с вами в течение 30 минут.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/orders — Список заявок (JWT) ───────────
router.get('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { status, limit } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

      let sql, params;
      if (status && ALLOWED_STATUSES.includes(status)) {
        sql = `SELECT id, name, phone, email, type, area, price, status, address, created_at
                 FROM orders
                WHERE status = $1
                ORDER BY created_at DESC
                LIMIT $2`;
        params = [status, safeLimit];
      } else {
        sql = `SELECT id, name, phone, email, type, area, price, status, address, created_at
                 FROM orders
                ORDER BY created_at DESC
                LIMIT $1`;
        params = [safeLimit];
      }

      const result = await db.query(sql, params);
      res.json({ count: result.rowCount, orders: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/orders/:id — Детали заявки (JWT) ───────
router.get('/:id',
  authMiddleware,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный id заявки' });
      }
      const result = await db.query(
        `SELECT id, name, phone, email, type, area, price, status, address, created_at, updated_at
           FROM orders
          WHERE id = $1`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/orders/:id/status — Обновить статус (JWT) ──
router.patch('/:id/status',
  authMiddleware,
  validate(statusUpdateSchema),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный id заявки' });
      }
      const result = await db.query(
        `UPDATE orders
            SET status = $1, updated_at = NOW()
          WHERE id = $2
        RETURNING id, name, phone, email, type, area, price, status, address, created_at, updated_at`,
        [req.body.status, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
