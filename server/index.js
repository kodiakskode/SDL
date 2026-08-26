'use strict';
/**
 * Outreach backend for the SDL Creations dashboard.
 *
 * The dashboard itself (index.html, leads.html, pool.html, outreach.html) is
 * a static site published on GitHub Pages — it has no server. This is the
 * one page that needs one: sending email needs somewhere to hold SMTP
 * credentials, templates and send history. Run this anywhere that can reach
 * the internet (a small VPS is enough) and point outreach.html's API_BASE at
 * it; CORS is open to the dashboard's own origin only (see
 * OUTREACH_ALLOWED_ORIGIN below).
 *
 * server/outreach.js, schema.js, auth.js and helpers.js are carried over
 * verbatim from kodiakskode/rawleads. server/leads.js and seed-leads.js are
 * new — see the comment at the top of each for why.
 *
 * There's no login anywhere on this dashboard, and the owner chose to run
 * Outreach the same way — no access key, no gate. server/no-auth.js treats
 * every request as the same single admin user instead of server/auth.js's
 * JWT check. That means anyone who finds this API's URL can send mail
 * through the configured SMTP account and read the send history; keep
 * OUTREACH_ALLOWED_ORIGIN narrow and don't publish this URL anywhere public
 * if that trade-off ever stops being acceptable. Swap the `auth` require
 * below back to './auth' (and reintroduce a login step in outreach.html) to
 * restore the JWT gate.
 */
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const Database = require('better-sqlite3');

const applySchema  = require('./schema');
const auth         = require('./no-auth');
const mountOutreach = require('./outreach');
const mountLeads    = require('./leads');
const seedLeads     = require('./seed-leads');

const PORT     = process.env.PORT || 3021;
const API_BASE = process.env.OUTREACH_API_BASE || '/rawleads/api';
const DB_PATH  = process.env.DB_PATH || path.join(__dirname, '..', 'outreach.db');

if (!process.env.OUTREACH_SECRET)  console.warn('[SECURITY] OUTREACH_SECRET not set — SMTP passwords using insecure default key.');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
applySchema(db);

const seeded = seedLeads(db);
console.log(`[leads] ${seeded.inserted} new lead(s) imported from data/leads.json (${seeded.total ?? 0} in the source file)`);

const app = express();

// Allow the GitHub Pages origin (and localhost while developing) to call this
// API cross-origin. Comma-separate multiple origins in OUTREACH_ALLOWED_ORIGIN.
const allowedOrigins = (process.env.OUTREACH_ALLOWED_ORIGIN || 'http://localhost:8000')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
}));

app.use(express.json({ limit: '5mb' }));

mountOutreach(app, { db, auth, apiBase: API_BASE });
mountLeads(app, { db, auth, apiBase: API_BASE });

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Outreach server on http://localhost:${PORT}`);
  console.log(`  api    ${API_BASE}/*`);
  console.log(`  db     ${DB_PATH}`);
});
