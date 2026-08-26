'use strict';
/**
 * JWT auth middleware — verbatim from RawLeads server.js lines 274-279.
 * Replace this with your own dashboard's auth if it already has one; the only
 * contract the outreach routes rely on is that `req.user.id` is set.
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'rl_secret_change_in_prod';

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

module.exports = auth;
