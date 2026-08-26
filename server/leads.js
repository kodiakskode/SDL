'use strict';
/**
 * Lead listing for the outreach picker — NOT part of the RawLeads extraction.
 * server/outreach.js expects a `leads` SQL table (see schema.js) and its own
 * send route reads rows out of it directly, but the route that *lists* leads
 * for the picker lived in the original app's much larger server.js and wasn't
 * part of the outreach slice. This is the small glue that fills that gap:
 * it serves the rows server/seed-leads.js imports from data/leads.json.
 */
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
};
