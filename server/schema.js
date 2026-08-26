'use strict';
/**
 * Schema the outreach module depends on — extracted verbatim from RawLeads
 * /opt/rawleads/db.js and server.js.
 *
 * Call `applySchema(db)` against your own better-sqlite3 handle. Everything is
 * CREATE TABLE IF NOT EXISTS / ALTER ... in a try-catch, so it is safe to run
 * against an existing database: the smtp_* columns are simply added to your
 * `users` table and the two outreach_* tables are created if missing.
 */
module.exports = function applySchema(db) {
  // The outreach routes read/write these columns on `users`. If your dashboard
  // already has a users table, these ALTERs just add the SMTP fields to it.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      plan TEXT DEFAULT 'free', created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Verbatim from db.js — the SMTP credential columns on users.
  for (const col of [
    'ALTER TABLE users ADD COLUMN smtp_host TEXT',
    'ALTER TABLE users ADD COLUMN smtp_port INTEGER',
    'ALTER TABLE users ADD COLUMN smtp_secure INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN smtp_user TEXT',
    'ALTER TABLE users ADD COLUMN smtp_pass_enc TEXT',
    'ALTER TABLE users ADD COLUMN smtp_from_name TEXT',
    'ALTER TABLE users ADD COLUMN smtp_from_email TEXT',
    // server.js:83 — free-plan send counter used by POST /outreach/send
    'ALTER TABLE users ADD COLUMN trial_emails_sent INTEGER DEFAULT 0',
  ]) { try { db.prepare(col).run(); } catch {} }

  // Verbatim from db.js — the outreach tables.
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_templates (
      id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS outreach_sends (
      id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id),
      lead_id TEXT REFERENCES leads(id), template_id TEXT,
      subject TEXT, to_email TEXT, to_name TEXT,
      status TEXT DEFAULT 'pending', error TEXT,
      sent_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_osends_user ON outreach_sends(user_id);
    CREATE INDEX IF NOT EXISTS idx_osends_lead ON outreach_sends(lead_id);
  `);

  // NOTE: db.js runs this ALTER before outreach_templates exists, which silently
  // no-ops on a fresh database and leaves the column missing. Run it after the
  // CREATE TABLE above so a clean install gets builder_json too.
  try { db.prepare('ALTER TABLE outreach_templates ADD COLUMN builder_json TEXT').run(); } catch {}

  // server.js:104 — dedup index used by POST /outreach/send.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sends_dedup ON outreach_sends(lead_id, template_id, status);`);

  // The outreach send route reads leads by id. Created only if your dashboard
  // does not already have a `leads` table; column set is verbatim from db.js.
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, job_id TEXT, user_id INTEGER REFERENCES users(id),
      business_name TEXT, phone TEXT, email TEXT, address TEXT, industry TEXT,
      location TEXT, rating REAL, website TEXT, ig_handle TEXT, followers INTEGER,
      bio TEXT, niche TEXT, maps_url TEXT, source TEXT DEFAULT 'google_maps',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
  `);
};
