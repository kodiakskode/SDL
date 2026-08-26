'use strict';
/**
 * One-time (idempotent) import of data/leads.json into the `leads` table the
 * outreach module reads from — NOT part of the RawLeads extraction. The
 * dashboard's leads live in a static JSON file (no accounts, no database);
 * this is the bridge that gives the Outreach tab something to send to.
 *
 * Safe to call on every boot: leads are upserted by id, so re-running after
 * editing data/leads.json updates existing rows and adds new ones. Each of
 * the two built-in lists also gets a row in `lead_lists` (id 'architects' /
 * 'designers') so the Outreach tab's list filter has a real label to show,
 * the same way an uploaded CSV/Excel list does (see server/leads.js).
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
    ...rowsFrom(data.architects?.rows || [], 'arch', 'architects'),
    ...rowsFrom(data.designers?.rows || [], 'land', 'designers'),
  ];

  const upsertList = db.prepare(`
    INSERT INTO lead_lists (id, user_id, label) VALUES (@id, @user_id, @label)
    ON CONFLICT(id) DO UPDATE SET label = excluded.label
  `);
  upsertList.run({ id: 'architects', user_id: ADMIN_USER_ID, label: data.architects?.label || 'Landscape Architects' });
  upsertList.run({ id: 'designers',  user_id: ADMIN_USER_ID, label: data.designers?.label  || 'Landscape Designers' });

  const upsert = db.prepare(`
    INSERT INTO leads
      (id, user_id, business_name, phone, email, address, industry, location, website, source)
    VALUES (@id, @user_id, @business_name, @phone, @email, @address, @industry, @location, @website, @source)
    ON CONFLICT(id) DO UPDATE SET
      business_name = excluded.business_name, phone = excluded.phone, email = excluded.email,
      address = excluded.address, industry = excluded.industry, location = excluded.location,
      website = excluded.website, source = excluded.source
  `);
  const upsertAll = db.transaction(rs => {
    let n = 0;
    for (const r of rs) { const info = upsert.run({ ...r, user_id: ADMIN_USER_ID }); n += info.changes; }
    return n;
  });

  const upserted = upsertAll(rows);
  return { inserted: upserted, total: rows.length };
};
