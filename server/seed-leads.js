'use strict';
/**
 * One-time (idempotent) import of data/leads.json into the `leads` table the
 * outreach module reads from — NOT part of the RawLeads extraction. The
 * dashboard's leads live in a static JSON file (no accounts, no database);
 * this is the bridge that gives the Outreach tab something to send to.
 *
 * Safe to call on every boot: it only inserts rows whose id isn't already
 * present, so re-running after editing data/leads.json just adds new leads.
 */
const fs   = require('fs');
const path = require('path');

const ADMIN_USER_ID = 1;

function ensureAdminUser(db) {
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(ADMIN_USER_ID);
  if (!row) {
    db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, 'admin@sdlcreations.local', 'n/a')")
      .run(ADMIN_USER_ID);
  }
}

function rowsFrom(list, prefix, source) {
  return list.map((l, i) => ({
    id: prefix + '-' + String(i + 1).padStart(4, '0'),
    business_name: l.org || l.name || '',
    phone: l.phone || '',
    email: l.email || '',
    address: [l.suburb, l.postcode ? 'NSW ' + l.postcode : 'NSW'].filter(Boolean).join(' '),
    industry: l.type || '',
    location: l.region || '',
    website: l.website || '',
    source,
  }));
}

module.exports = function seedLeads(db, dataPath) {
  ensureAdminUser(db);

  const file = dataPath || path.join(__dirname, '..', 'data', 'leads.json');
  if (!fs.existsSync(file)) return { inserted: 0 };

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = [
    ...rowsFrom(data.architects?.rows || [], 'arch', 'google_search'),
    ...rowsFrom(data.designers?.rows || [], 'land', 'google_maps'),
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO leads
      (id, user_id, business_name, phone, email, address, industry, location, website, source)
    VALUES (@id, @user_id, @business_name, @phone, @email, @address, @industry, @location, @website, @source)
  `);
  const insertAll = db.transaction(rs => {
    let n = 0;
    for (const r of rs) { const info = insert.run({ ...r, user_id: ADMIN_USER_ID }); n += info.changes; }
    return n;
  });

  const inserted = insertAll(rows);
  return { inserted, total: rows.length };
};
