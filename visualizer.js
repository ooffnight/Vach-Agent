/* =====================================================
   /api/visualizer — Конфигурации 3D-сцен
   R-03: убрана маскировка ошибок mock-ответами.
   R-11: поле name — обязательное (по Таблице 4 диплома).
   R-22: валидация DTO.
   ===================================================== */

'use strict';

const router = require('express').Router();
const db     = require('../db');
const crypto = require('crypto');

const { validate, rules } = require('../middleware/validate');

// ── Допустимые значения ─────────────────────────────
const STYLES       = ['modern', 'scandi', 'loft', 'classic'];
const WALL_COLORS  = ['mist', 'cream', 'teal', 'warm', 'white'];
const FLOORS       = ['parquet', 'tile', 'laminate'];

// ── Схема валидации ─────────────────────────────────
// По диплому: scene_json + name. По API контракту в Прил. В диплома:
// { style, wallColor, floor, furniture, area } → собираем в scene_json
const saveSchema = {
  name:      [rules.required, rules.string, rules.minLength(1)],
  style:     [rules.required, rules.enum(STYLES)],
  wallColor: [rules.required, rules.enum(WALL_COLORS)],
  floor:     [rules.required, rules.enum(FLOORS)],
};

// ── POST /api/visualizer/save — Сохранить конфигурацию ──
router.post('/save', validate(saveSchema), async (req, res, next) => {
  try {
    const { name, style, wallColor, floor, furniture, area, clientEmail } = req.body;

    const sceneJson = {
      style,
      wallColor,
      floor,
      furniture: furniture || {},
      area: Number(area) > 0 ? Number(area) : 28,  // дефолт 28 м² по §3.1 диплома
    };

    const shareToken = crypto.randomBytes(16).toString('hex');

    const result = await db.query(
      `INSERT INTO visualizer_configs (name, scene_json, client_email, share_token, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, created_at, share_token`,
      [name, JSON.stringify(sceneJson), clientEmail || null, shareToken]
    );

    res.status(201).json({
      success: true,
      configId: result.rows[0].id,
      shareUrl: `/visualizer/${result.rows[0].share_token}`,
      message: 'Конфигурация сохранена.',
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/visualizer/:id — Получить конфигурацию ─
router.get('/:id', async (req, res, next) => {
  try {
    // Принимаем либо числовой id, либо share_token (hex)
    const idParam = req.params.id;
    const isNumeric = /^\d+$/.test(idParam);
    const numericId = isNumeric ? parseInt(idParam, 10) : null;

    const sql = isNumeric
      ? `SELECT id, name, scene_json, created_at FROM visualizer_configs WHERE id = $1`
      : `SELECT id, name, scene_json, created_at FROM visualizer_configs WHERE share_token = $1`;

    const result = await db.query(sql, [isNumeric ? numericId : idParam]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/visualizer/presets/all — Пресеты стилей ─
router.get('/presets/all', (req, res) => {
  res.json([
    { id: 'modern',  name: 'Современный',    description: 'Чистые линии, нейтральные тона',          basePrice: 320000 },
    { id: 'scandi',  name: 'Скандинавский',  description: 'Светлые поверхности, дерево, минимализм', basePrice: 280000 },
    { id: 'loft',    name: 'Лофт',           description: 'Кирпич, металл, бетон',                   basePrice: 380000 },
    { id: 'classic', name: 'Классика',       description: 'Карнизы, тёплое дерево, симметрия',       basePrice: 420000 },
  ]);
});

module.exports = router;
