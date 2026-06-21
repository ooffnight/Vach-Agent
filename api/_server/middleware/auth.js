
'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');


function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется токен авторизации' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, config.JWT.secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Невалидный или истёкший токен' });
  }
}

module.exports = authMiddleware;
