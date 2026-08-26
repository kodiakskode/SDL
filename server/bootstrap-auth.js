'use strict';
/**
 * Single-tenant login for the Outreach tab — NOT part of the RawLeads
 * extraction. RawLeads is a multi-user SaaS with its own signup/login
 * routes; SDL Creations has no accounts at all (everything else in the
 * dashboard runs client-side only). Rather than pull in a whole auth
 * system, this exchanges one shared secret (OUTREACH_ACCESS_KEY) for the
 * JWT that server/auth.js already expects on every other route, always for
 * the same admin user row.
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET  = process.env.JWT_SECRET || 'rl_secret_change_in_prod';
const ACCESS_KEY  = process.env.OUTREACH_ACCESS_KEY || '';
const ADMIN_USER_ID = 1;

module.exports = function mountBootstrapAuth(app, opts) {
  const P = opts.apiBase || '/rawleads/api';

  app.post(P + '/auth/login', (req, res) => {
    if (!ACCESS_KEY) return res.status(503).json({ error: 'OUTREACH_ACCESS_KEY is not configured on the server' });
    const key = (req.body || {}).key;
    if (key !== ACCESS_KEY) return res.status(401).json({ error: 'Wrong access key' });
    const token = jwt.sign({ id: ADMIN_USER_ID }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
  });
};
