'use strict';
/**
 * Lead listing + list management for the outreach picker — NOT part of the
 * RawLeads extraction. server/outreach.js expects a `leads` SQL table (see
 * schema.js) and its own send route reads rows out of it directly, but the
 * route that *lists* leads for the picker lived in the original app's much
 * larger server.js and wasn't part of the outreach slice. This is the small
 * glue that fills that gap, plus two dashboard-specific additions:
 *
 *   GET  /leads        list leads, filterable by list (source), same as before
 *   GET  /leads/lists   every list (architects, designers, and any uploaded
 *                       CSV/Excel list from leads.html) with its row count,
 *                       so the Outreach tab can build a real filter instead
 *                       of the fixed google_maps/instagram/google_search one
 *                       rawleads shipped with
 *   POST /leads/import  leads.html's CSV/Excel importer posts parsed rows
 *                       here under a title; this creates the list (a
 *                       lead_lists row) and inserts the rows tagged with it
 */
const crypto = require('crypto');

function slugify(title) {
  const base = String(title).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'list';
  return base.slice(0, 60);
}

module.exports = function mountLeads(app, opts) {
  const db   = opts.db;
  const auth = opts.auth;
  const P    = opts.apiBase || '/rawleads/api';

  app.get(P + '/leads', auth, (req, res) => {
    const { source = 'all', search = '', has_email } = req.query;
    const clauses = ['user_id = ?'];
    const params = [req.user.id];
    if (has_email === '1') clauses.push("email IS NOT NULL AND email != ''");
    if (source && source !== 'all') { clauses.push('source = ?'); params.push(source); }
    if (search) {
      clauses.push('(business_name LIKE ? OR email LIKE ? OR address LIKE ?)');
      const s = '%' + search + '%';
      params.push(s, s, s);
    }
    const where = clauses.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) n FROM leads WHERE ${where}`).get(...params).n;
    const rows  = db.prepare(`SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC, id LIMIT 200`).all(...params);
    res.json({ leads: rows, total });
  });

  app.get(P + '/leads/lists', auth, (req, res) => {
    const rows = db.prepare(`
      SELECT ll.id, ll.label,
        (SELECT COUNT(*) FROM leads l WHERE l.source = ll.id AND l.user_id = ll.user_id) as count,
        (SELECT COUNT(*) FROM leads l WHERE l.source = ll.id AND l.user_id = ll.user_id AND l.email IS NOT NULL AND l.email != '') as withEmail
      FROM lead_lists ll WHERE ll.user_id = ? ORDER BY ll.label
    `).all(req.user.id);
    res.json({ lists: rows });
  });

  app.post(P + '/leads/import', auth, (req, res) => {
    const { title, rows } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'rows required' });
    if (rows.length > 5000) return res.status(400).json({ error: 'Too many rows (max 5000)' });

    let id = slugify(title);
    const taken = row => db.prepare('SELECT 1 FROM lead_lists WHERE id = ?').get(row);
    if (taken(id)) {
      let n = 2;
      while (taken(id + '-' + n)) n++;
      id = id + '-' + n;
    }

    const insertList = db.prepare('INSERT INTO lead_lists (id, user_id, label) VALUES (?,?,?)');
    const insertLead = db.prepare(`
      INSERT INTO leads (id, user_id, business_name, phone, email, address, industry, location, website, source)
      VALUES (@id, @user_id, @business_name, @phone, @email, @address, @industry, @location, @website, @source)
    `);

    const run = db.transaction(() => {
      insertList.run(id, req.user.id, String(title).trim());
      let n = 0;
      for (const r of rows) {
        const business_name = String(r.business_name || r.name || '').trim();
        if (!business_name && !r.email) continue; // skip fully-empty rows
        insertLead.run({
          id: id + '-' + crypto.randomUUID().slice(0, 8),
          user_id: req.user.id,
          business_name,
          phone: String(r.phone || '').trim(),
          email: String(r.email || '').trim(),
          address: String(r.address || '').trim(),
          industry: String(r.industry || '').trim(),
          location: String(r.location || '').trim(),
          website: String(r.website || '').trim(),
          source: id,
        });
        n++;
      }
      return n;
    });

    const count = run();
    res.json({ id, label: String(title).trim(), count });
  });

  app.delete(P + '/leads/lists/:id', auth, (req, res) => {
    if (req.params.id === 'architects' || req.params.id === 'designers') {
      return res.status(400).json({ error: 'Cannot delete a built-in list' });
    }
    const del = db.transaction(() => {
      db.prepare('DELETE FROM leads WHERE source = ? AND user_id = ?').run(req.params.id, req.user.id);
      db.prepare('DELETE FROM lead_lists WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    });
    del();
    res.json({ ok: true });
  });
};
