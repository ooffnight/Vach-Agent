/* =====================================================
   /api/analytics — Данные для BI-дашборда
   R-01: JWT на все 4 маршрута (по Таблице 5 диплома).
   R-03: убрана подмена данных hardcoded-моками.
   R-20: убран маршрут /revenue-trend (нет в Таблице 5 диплома).
   ===================================================== */

'use strict';

const router = require('express').Router();
const db     = require('../db');

const authMiddleware = require('../middleware/auth');

// ── GET /api/analytics/kpi — KPI-метрики ────────────
router.get('/kpi', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE status IN ('new','confirmed','in_progress'))::int   AS active_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'completed'
              AND created_at >= DATE_TRUNC('month', NOW()))::int                                AS completed_month,
        (SELECT COALESCE(AVG(rating), 0)::numeric(3,2) FROM reviews)                            AS avg_rating,
        (SELECT COALESCE(SUM(price), 0) / 1000000.0
           FROM orders
          WHERE status = 'completed' AND created_at >= DATE_TRUNC('month', NOW()))::numeric(10,2) AS revenue_mln
    `);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/orders-by-month ──────────────
router.get('/orders-by-month', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        EXTRACT(YEAR  FROM created_at)::int AS year,
        EXTRACT(MONTH FROM created_at)::int AS month,
        COUNT(*)::int                       AS orders
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '2 years'
      GROUP BY year, month
      ORDER BY year, month
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/types-distribution ───────────
router.get('/types-distribution', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT type, COUNT(*)::int AS count
        FROM orders
       WHERE created_at >= NOW() - INTERVAL '6 months'
       GROUP BY type
       ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/active-projects ──────────────
router.get('/active-projects', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        p.id,
        p.order_id,
        COALESCE(p.address, o.address) AS address,
        o.type                          AS repair_type,
        p.progress,
        p.started_at,
        p.finished_at
      FROM projects p
      JOIN orders   o ON o.id = p.order_id
      WHERE p.finished_at IS NULL
         OR p.finished_at >= NOW() - INTERVAL '30 days'
      ORDER BY p.started_at DESC NULLS LAST
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
