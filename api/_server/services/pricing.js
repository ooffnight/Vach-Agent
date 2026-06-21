/* =====================================================
   services/pricing.js — Расчёт предварительной стоимости ремонта
   R-08: реализация формулы (5) из §3.1 диплома:
         P = S × k × C
   где
     P — стоимость, руб.
     S — площадь, кв. м
     k — коэффициент типа ремонта: 1.0 / 1.8 / 2.5
     C — базовая стоимость работ за кв. м (5000 руб./кв.м)
   ===================================================== */

'use strict';

/**
 * Базовая стоимость работ за кв. м.
 * Источник: Приложение В диплома, файл routes/orders.js, константа BASE_RATE_PER_SQM = 5000.
 * @type {number}
 */
const BASE_RATE_PER_SQM = 5000;

/**
 * Коэффициенты типов ремонта.
 * Источник: §3.1 диплома, формула (5).
 * @type {Object.<string, number>}
 */
const RATE_COEFFICIENTS = Object.freeze({
  cosmetic: 1.0,  // косметический
  capital:  1.8,  // капитальный
  designer: 2.5,  // дизайнерский
});

/**
 * Допустимые типы ремонта (для валидации).
 * @type {string[]}
 */
const VALID_TYPES = Object.keys(RATE_COEFFICIENTS);

/**
 * Рассчитать предварительную стоимость по формуле (5).
 *
 * @param {string} type — тип ремонта: cosmetic|capital|designer
 * @param {number} area — площадь помещения, кв. м (>0)
 * @returns {number}    — округлённая стоимость, руб.
 * @throws {Error}      — если тип не из RATE_COEFFICIENTS или area<=0
 *
 * @example
 *   calculatePrice('capital', 50)  // 50 × 1.8 × 5000 = 450 000
 */
function calculatePrice(type, area) {
  const k = RATE_COEFFICIENTS[type];
  if (k === undefined) {
    throw new Error(`Неизвестный тип ремонта: ${type}. Допустимы: ${VALID_TYPES.join(', ')}`);
  }
  const s = Number(area);
  if (!Number.isFinite(s) || s <= 0) {
    throw new Error(`Некорректная площадь: ${area}. Площадь должна быть положительным числом.`);
  }
  return Math.round(s * k * BASE_RATE_PER_SQM);
}

module.exports = {
  BASE_RATE_PER_SQM,
  RATE_COEFFICIENTS,
  VALID_TYPES,
  calculatePrice,
};
