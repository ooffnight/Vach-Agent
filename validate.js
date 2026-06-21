/* =====================================================
   middleware/validate.js — Валидация тела запроса (DTO)
   R-22: проверка входных данных на всех POST/PATCH-маршрутах.
   Реализована без внешних зависимостей (joi/zod) — чтобы
   не добавлять новые пакеты сверх Таблицы 1 диплома.
   ===================================================== */

'use strict';

// ── Регулярные выражения ─────────────────────────────
const RU_PHONE_REGEX  = /^[+]?[\d\s\-()]{10,20}$/;
const EMAIL_REGEX     = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ── Базовые правила ──────────────────────────────────
const rules = {
  required:    (v) => v !== undefined && v !== null && String(v).trim() !== '',
  string:      (v) => typeof v === 'string',
  number:      (v) => typeof v === 'number' || !isNaN(Number(v)),
  positiveNum: (v) => Number(v) > 0,
  email:       (v) => v == null || v === '' || EMAIL_REGEX.test(String(v)),
  phone:       (v) => RU_PHONE_REGEX.test(String(v).replace(/\s+/g, ' ')),
  minLength:   (n) => (v) => String(v).length >= n,
  enum:        (list) => (v) => list.includes(v),
};

/**
 * Применяет схему валидации к req.body и при ошибке возвращает 400.
 * Схема: { fieldName: [rule1, rule2, ...], ... }
 *
 * @example
 *   validate({
 *     name:  [rules.required, rules.minLength(2)],
 *     phone: [rules.required, rules.phone],
 *     area:  [rules.required, rules.positiveNum],
 *   })
 */
function validate(schema) {
  return function (req, res, next) {
    const errors = [];
    for (const field of Object.keys(schema)) {
      const value = req.body ? req.body[field] : undefined;
      const fieldRules = schema[field];
      for (const rule of fieldRules) {
        if (!rule(value)) {
          errors.push({ field, value, rule: rule.name || 'invalid' });
          break;  // показываем первую ошибку по полю
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Ошибка валидации входных данных',
        details: errors,
      });
    }
    next();
  };
}

module.exports = { validate, rules };
