/* =====================================================
   middleware/requireRole.js — Проверка роли пользователя
   R-19: BR-02 из этапа 1 — разграничение Admin / Manager
   по §2.1 диплома: только Admin может управлять users.
   ===================================================== */

'use strict';

/**
 * Возвращает middleware, требующий, чтобы req.user.role был в allowedRoles.
 * Используется ПОСЛЕ authMiddleware (req.user уже заполнен).
 *
 * @param {...string} allowedRoles — список разрешённых ролей
 * @returns {Function}
 *
 * @example
 *   router.post('/register', auth, requireRole('admin'), handler);
 */
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Не определена роль пользователя' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Доступ запрещён: недостаточно прав',
        requiredRoles: allowedRoles,
        yourRole: req.user.role,
      });
    }
    next();
  };
}

module.exports = requireRole;
