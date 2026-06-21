/* =====================================================
   /api/leads — Лиды из онлайн-консультанта
   R-01: JWT на GET (по Таблице 5 диплома).
   R-03: убрана маскировка ошибок БД mock-ответами.
   R-22: валидация DTO.
   ===================================================== */

'use strict';

const router = require('express').Router();
const db     = require('../db');

const authMiddleware      = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');

// ── Схема валидации ─────────────────────────────────
// По диплому минимум — поле contact (объединённое). Реализация принимает
// либо contact, либо phone/email отдельно. Хотя бы одно из них обязательно
// (CHECK в БД, дополнительно валидируем здесь).
function atLeastOneContact(_, body) {
  return !!(body.contact || body.phone || body.email);
}

const leadCreateSchema = {
  // contact, phone, email, name — все необязательные, но БД CHECK
  // не даст создать запись без хотя бы одного.
  message: [],  // опционально
  source:  [],  // опционально
};

// ── POST /api/leads — Сохранить лид (открытый) ──────
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, message, source } = req.body;
    const contact = req.body.contact ||
      [name, phone, email].filter(Boolean).join(' / ') || null;

    if (!contact && !phone && !email) {
      return res.status(400).json({
        error: 'Нужно указать хотя бы контакт (телефон или email)',
      });
    }

    const result = await db.query(
      `INSERT INTO leads (contact, name, phone, email, message, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, contact, source, created_at`,
      [
        contact,
        name || null,
        phone || null,
        email || null,
        message || null,
        source || 'chat',
      ]
    );

    res.status(201).json({
      success: true,
      lead: result.rows[0],
      message: 'Контакт сохранён, скоро свяжемся!',
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/leads — Список лидов (JWT) ─────────────
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const safeLimit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 100, 1),
      500
    );
    const result = await db.query(
      `SELECT id, contact, name, phone, email, message, source, status, created_at
         FROM leads
        ORDER BY created_at DESC
        LIMIT $1`,
      [safeLimit]
    );
    res.json({ count: result.rowCount, leads: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
