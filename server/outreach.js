'use strict';
/**
 * RawLeads — Outreach backend.
 *
 * Copied verbatim from the production RawLeads server (/opt/rawleads/server.js,
 * lines 617-892). The untouched original slice is kept at
 * reference/server.js.outreach-slice.js for byte-level comparison.
 *
 * The ONLY change made to the code below is that the ten route paths, which
 * were hard-coded as '/rawleads/api/outreach/...', are now built from the `P`
 * prefix so the module can be mounted anywhere. Every handler body is
 * unmodified.
 *
 * Usage from a host dashboard:
 *
 *   const mountOutreach = require('./server/outreach');
 *   mountOutreach(app, { db, auth });
 *
 * Requirements on the host app:
 *   - `db`   : a better-sqlite3 handle with the tables in server/schema.js applied
 *   - `auth` : express middleware that sets `req.user.id`
 *   - express.json() body parsing already registered
 */
const crypto = require('crypto');
const { escHtml, safeUrl } = require('./helpers');

module.exports = function mountOutreach(app, opts) {
  const db      = opts.db;
  const auth    = opts.auth;
  const P       = (opts.apiBase || '/rawleads/api') + '/outreach';
  // Free-plan send cap, verbatim from server.js:54 (FREE_LIMITS.emailsSent)
  const FREE_LIMITS = opts.freeLimits || { maps: 100, ig: 100, gs: 100, emailsSent: 200 };

// ─────────────────────────────────────────────────────────────────────────────
// BEGIN verbatim slice — server.js lines 617-892
// ─────────────────────────────────────────────────────────────────────────────

// ── Outreach routes ───────────────────────────────────────────────────────────
const nodemailer = require('nodemailer');

const ENC_KEY = Buffer.from(
  (process.env.OUTREACH_SECRET || 'rawleads-outreach-key-32-chars!!').padEnd(32, '!').slice(0, 32),
  'utf8'
);
function encryptPass(text) {
  const iv  = crypto.randomBytes(12);
  const c   = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return iv.toString('hex') + ':' + enc.toString('hex') + ':' + tag.toString('hex');
}
function decryptPass(str) {
  try {
    const [ivH, encH, tagH] = str.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivH, 'hex'));
    decipher.setAuthTag(Buffer.from(tagH, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encH, 'hex')), decipher.final()]).toString('utf8');
  } catch { return null; }
}
function mergeTemplate(text, lead) {
  return text
    .replace(/\{\{name\}\}/gi,        escHtml(lead.business_name || lead.ig_handle || ''))
    .replace(/\{\{business\}\}/gi,    escHtml(lead.business_name || ''))
    .replace(/\{\{phone\}\}/gi,       escHtml(lead.phone || ''))
    .replace(/\{\{email\}\}/gi,       escHtml(lead.email || ''))
    .replace(/\{\{address\}\}/gi,     escHtml(lead.address || ''))
    .replace(/\{\{industry\}\}/gi,    escHtml(lead.industry || ''))
    .replace(/\{\{niche\}\}/gi,       escHtml(lead.niche || lead.industry || ''))
    .replace(/\{\{location\}\}/gi,    escHtml(lead.location || ''))
    .replace(/\{\{rating\}\}/gi,      escHtml(String(lead.rating || '')))
    .replace(/\{\{ig_handle\}\}/gi,   lead.ig_handle ? escHtml('@' + lead.ig_handle) : '')
    .replace(/\{\{followers\}\}/gi,   lead.followers != null ? escHtml(lead.followers.toLocaleString()) : '');
}

// GET smtp settings (no password returned)
app.get(P + '/smtp', auth, (req, res) => {
  const u = db.prepare('SELECT smtp_host,smtp_port,smtp_secure,smtp_user,smtp_from_name,smtp_from_email,smtp_pass_enc FROM users WHERE id=?').get(req.user.id);
  const configured = !!(u.smtp_host && u.smtp_user && u.smtp_pass_enc);
  const { smtp_pass_enc: _p, ...safeU } = u;
  // Return both smtp_from_name and from_name so all UI components work
  res.json({ configured, ...safeU, from_name: u.smtp_from_name||'', from_email: u.smtp_from_email||u.smtp_user||'' });
});

// POST save smtp settings
app.post(P + '/smtp', auth, (req, res) => {
  // Accept smtp_-prefixed field names sent by the frontend form
  const host       = req.body.smtp_host       || req.body.host;
  const port       = req.body.smtp_port       || req.body.port;
  const secure     = req.body.smtp_secure     !== undefined ? req.body.smtp_secure     : req.body.secure;
  const smtpUser   = req.body.smtp_user       || req.body.user;
  const pass       = req.body.smtp_pass       || req.body.pass;
  const from_name  = req.body.smtp_from_name  || req.body.from_name;
  const from_email = req.body.smtp_from_email || req.body.from_email;

  if (!host || !smtpUser) return res.status(400).json({ error: 'Host and username are required' });

  // Keep existing password when field is left blank (update scenario)
  const existing = db.prepare('SELECT smtp_pass_enc FROM users WHERE id=?').get(req.user.id);
  let enc;
  if (pass && String(pass).trim()) {
    enc = encryptPass(String(pass).trim());
  } else if (existing && existing.smtp_pass_enc) {
    enc = existing.smtp_pass_enc;
  } else {
    return res.status(400).json({ error: 'Password is required for initial setup' });
  }

  const secureVal = (String(secure) === '1' || secure === true || secure === 1) ? 1 : 0;
  db.prepare('UPDATE users SET smtp_host=?,smtp_port=?,smtp_secure=?,smtp_user=?,smtp_pass_enc=?,smtp_from_name=?,smtp_from_email=? WHERE id=?')
    .run(host, port||587, secureVal, smtpUser, enc, from_name||smtpUser, from_email||smtpUser, req.user.id);

  // Return full smtp object so frontend state updates correctly after save
  const u = db.prepare('SELECT smtp_host,smtp_port,smtp_secure,smtp_user,smtp_from_name,smtp_from_email,smtp_pass_enc FROM users WHERE id=?').get(req.user.id);
  const configured = !!(u.smtp_host && u.smtp_user && u.smtp_pass_enc);
  const { smtp_pass_enc: _p2, ...safeU } = u;
  res.json({ configured, ...safeU, from_name: u.smtp_from_name||'', from_email: u.smtp_from_email||u.smtp_user||'' });
});

// POST test smtp connection
app.post(P + '/smtp/test', auth, async (req, res) => {
  const u = db.prepare('SELECT smtp_host,smtp_port,smtp_secure,smtp_user,smtp_pass_enc,smtp_from_name,smtp_from_email FROM users WHERE id=?').get(req.user.id);
  if (!u.smtp_host || !u.smtp_pass_enc) return res.status(400).json({ error: 'Save your SMTP settings first before testing' });
  const pass = decryptPass(u.smtp_pass_enc);
  try {
    const t = nodemailer.createTransport({ host:u.smtp_host, port:u.smtp_port||587, secure:!!u.smtp_secure, auth:{ user:u.smtp_user, pass }, tls:{ rejectUnauthorized:false } });
    await t.verify();
    res.json({ message: 'Connection successful! Your email is ready to send.' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// GET templates
app.get(P + '/templates', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM outreach_templates WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

// POST create template
app.post(P + '/templates', auth, (req, res) => {
  const { name, subject, body, builder_json } = req.body;
  if (!name || !subject) return res.status(400).json({ error: 'name and subject required' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO outreach_templates (id,user_id,name,subject,body,builder_json) VALUES (?,?,?,?,?,?)').run(id, req.user.id, name, subject, body||'', builder_json||null);
  res.json(db.prepare('SELECT * FROM outreach_templates WHERE id=?').get(id));
});

// PUT update template
app.put(P + '/templates/:id', auth, (req, res) => {
  const t = db.prepare('SELECT id FROM outreach_templates WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  const { name, subject, body, builder_json } = req.body;
  db.prepare('UPDATE outreach_templates SET name=?,subject=?,body=?,builder_json=? WHERE id=?').run(name, subject, body||'', builder_json||null, req.params.id);
  res.json(db.prepare('SELECT * FROM outreach_templates WHERE id=?').get(req.params.id));
});

// DELETE template
app.delete(P + '/templates/:id', auth, (req, res) => {
  db.prepare('DELETE FROM outreach_templates WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// GET outreach history
app.get(P + '/history', auth, (req, res) => {
  const { page = 1 } = req.query;
  const offset = (parseInt(page)-1)*50;
  const rows  = db.prepare('SELECT s.*,l.business_name,l.ig_handle FROM outreach_sends s LEFT JOIN leads l ON l.id=s.lead_id WHERE s.user_id=? ORDER BY s.sent_at DESC LIMIT 50 OFFSET ?').all(req.user.id, offset);
  const total = db.prepare('SELECT COUNT(*) as n FROM outreach_sends WHERE user_id=?').get(req.user.id).n;
  res.json({ sends: rows, total, pages: Math.ceil(total/50) });
});

// Builder HTML renderer (mirrors frontend builderToHtml)
function renderBuilderHtml(data, lead) {
  const dStyle = { font:'Helvetica,Arial,sans-serif', textColor:'#e8edf2', bgColor:'#0b0f1a', cardColor:'#111827', accentColor:'#D86C2D', cardEnabled:true, cardPadding:32, cardRadius:12, cardMarginTop:0 };
  const s = Object.assign({}, dStyle, data.style || {});
  const logo = data.logo || {};
  const footer = data.footer || {};
  function m(t) { return !t ? '' : t
    .replace(/\{\{name\}\}/gi, lead.business_name||lead.ig_handle||'')
    .replace(/\{\{business\}\}/gi, lead.business_name||'')
    .replace(/\{\{phone\}\}/gi, lead.phone||'')
    .replace(/\{\{email\}\}/gi, lead.email||'')
    .replace(/\{\{address\}\}/gi, lead.address||'')
    .replace(/\{\{industry\}\}/gi, lead.industry||'')
    .replace(/\{\{niche\}\}/gi, lead.niche||lead.industry||'')
    .replace(/\{\{location\}\}/gi, lead.location||'')
    .replace(/\{\{ig_handle\}\}/gi, lead.ig_handle?'@'+lead.ig_handle:'')
    .replace(/\{\{followers\}\}/gi, lead.followers!=null?String(lead.followers):''); }
  const allBlocks = data.blocks || [];
  const aboveBlocks  = allBlocks.filter(b => b.zone === 'above');
  const insideBlocks = allBlocks.filter(b => !b.zone || b.zone === 'inside');
  const belowBlocks  = allBlocks.filter(b => b.zone === 'below');
  function renderBlock(b) {
    const al = b.align||'left';
    if (b.type==='text') { const tt=b.textType||'p'; if(tt!=='p'){ const sz=tt==='h1'?'28px':tt==='h3'?'16px':'22px'; return `<div style="text-align:${al};margin:0 0 12px"><${tt} style="font-family:${s.font};color:${b.color||s.textColor};font-size:${sz};font-weight:700;margin:0;line-height:1.3">${m(b.content||'')}</${tt}></div>`; } else { return `<div style="text-align:${al};margin:0 0 14px"><p style="font-family:${s.font};color:${b.color||s.textColor};font-size:15px;line-height:1.7;margin:0">${m((b.content||'').replace(/\n/g,'<br>'))}</p></div>`; } }
    if (b.type==='button') return `<div style="text-align:${al};margin:8px 0 20px"><a href="${safeUrl(b.url)}" style="display:inline-block;background:${b.bgColor||s.accentColor};color:${b.textColor||'#fff'};font-family:${s.font};font-size:14px;font-weight:600;padding:${b.paddingY||14}px ${b.paddingX||24}px;border-radius:${b.radius!=null?b.radius:10}px;text-decoration:none;line-height:1">${m(b.content||'Button')}</a></div>`;
    if (b.type==='image'&&b.src) return `<div style="text-align:${al};margin:8px 0 16px"><img src="${safeUrl(b.src)}" alt="${escHtml(b.alt||'')}" style="max-width:100%;border-radius:6px;display:inline-block"></div>`;
    if (b.type==='divider') return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0">`;
    if (b.type==='spacer') return `<div style="height:${b.height||24}px"></div>`;
    return '';
  }
  const aboveHtml  = aboveBlocks.map(renderBlock).join('');
  let innerHtml = '';
  if (logo.enabled && logo.src) innerHtml += `<div style="text-align:center;padding:16px 0 8px"><img src="${logo.src}" alt="${logo.alt||'Logo'}" style="max-height:60px;max-width:220px;display:inline-block"></div>`;
  innerHtml += insideBlocks.map(renderBlock).join('');
  if (footer.enabled && footer.content) innerHtml += `<div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-family:${s.font};font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6">${m(footer.content).replace(/\n/g,'<br>')}</div>`;
  const belowHtml  = belowBlocks.map(renderBlock).join('');
  const useCard = s.cardEnabled !== false;
  const cp  = Math.max(0, parseInt(s.cardPadding)   || 32);
  const cr  = Math.max(0, parseInt(s.cardRadius)    || 12);
  const cmt = Math.max(0, parseInt(s.cardMarginTop) || 0);
  const aboveSection = aboveHtml ? `<div style="max-width:600px;margin:0 auto">${aboveHtml}</div>` : '';
  const belowSection = belowHtml ? `<div style="max-width:600px;margin:0 auto">${belowHtml}</div>` : '';
  const cardDiv = useCard
    ? `<div style="max-width:600px;margin:${cmt}px auto 0;background:${s.cardColor};border-radius:${cr}px;padding:${cp}px ${Math.round(cp*1.1)}px">${innerHtml}</div>`
    : `<div style="max-width:600px;margin:${cmt}px auto 0">${innerHtml}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:${s.bgColor}">${aboveSection}${cardDiv}${belowSection}</body></html>`;
}

// POST send emails
app.post(P + '/send', auth, async (req, res) => {
  let { lead_ids, template_id } = req.body;
  if (!lead_ids?.length || !template_id) return res.status(400).json({ error: 'lead_ids and template_id required' });

  const u = db.prepare('SELECT smtp_host,smtp_port,smtp_secure,smtp_user,smtp_pass_enc,smtp_from_name,smtp_from_email,plan,trial_emails_sent FROM users WHERE id=?').get(req.user.id);
  if (!u.smtp_host || !u.smtp_pass_enc) return res.status(400).json({ error: 'Configure SMTP settings first' });
  if (u.plan === 'free') {
    const remaining = FREE_LIMITS.emailsSent - (u.trial_emails_sent || 0);
    if (remaining <= 0) return res.status(403).json({ error: 'Trial limit reached: 200 emails sent. Upgrade to continue.', upgrade: true });
    lead_ids = lead_ids.slice(0, remaining);
  }

  const tmpl = db.prepare('SELECT * FROM outreach_templates WHERE id=? AND user_id=?').get(template_id, req.user.id);
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });

  const pass = decryptPass(u.smtp_pass_enc);
  const transporter = nodemailer.createTransport({
    host: u.smtp_host, port: u.smtp_port || 587, secure: !!u.smtp_secure,
    auth: { user: u.smtp_user, pass }
  });

  // Parse builder data once, outside the loop
  let builderData = null;
  try { if (tmpl.builder_json) builderData = JSON.parse(tmpl.builder_json); } catch {}
  const isBuilder = builderData && !builderData.rawMode;
  const subjectTpl = isBuilder ? (builderData.subject || tmpl.subject) : tmpl.subject;

  // Batch-fetch all leads and already-sent set in one query each (no N+1)
  const cappedIds = lead_ids.slice(0, 200);
  const placeholders = cappedIds.map(() => '?').join(',');
  const leadsMap = new Map(
    db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders}) AND user_id=?`).all(...cappedIds, req.user.id).map(l => [l.id, l])
  );
  const alreadySent = new Set(
    db.prepare(`SELECT lead_id FROM outreach_sends WHERE lead_id IN (${placeholders}) AND template_id=? AND status='sent'`).all(...cappedIds, template_id).map(r => r.lead_id)
  );

  let sent = 0, failed = 0;
  const results = [];

  for (const leadId of cappedIds) {
    const lead = leadsMap.get(leadId);
    if (!lead || !lead.email) { failed++; results.push({ leadId, status: 'failed', error: 'No email' }); continue; }
    if (alreadySent.has(leadId)) { results.push({ leadId, status: 'skipped', error: 'Already sent' }); continue; }

    const subject = mergeTemplate(subjectTpl, lead);
    const sendId  = crypto.randomUUID();
    const html    = isBuilder ? renderBuilderHtml(builderData, lead) : mergeTemplate(tmpl.body, lead).replace(/\n/g,'<br>');
    const text    = isBuilder ? null : mergeTemplate(tmpl.body, lead);

    try {
      await transporter.sendMail({
        from: `"${u.smtp_from_name || u.smtp_user}" <${u.smtp_from_email || u.smtp_user}>`,
        to: lead.email,
        subject,
        ...(text ? { text, html } : { html }),
      });
      db.prepare('INSERT INTO outreach_sends (id,user_id,lead_id,template_id,subject,to_email,to_name,status) VALUES (?,?,?,?,?,?,?,?)')
        .run(sendId, req.user.id, leadId, template_id, subject, lead.email, lead.business_name || lead.ig_handle || '', 'sent');
      if (u.plan === 'free') db.prepare('UPDATE users SET trial_emails_sent=trial_emails_sent+1 WHERE id=?').run(req.user.id);
      sent++;
      results.push({ leadId, status: 'sent' });
    } catch(e) {
      db.prepare('INSERT INTO outreach_sends (id,user_id,lead_id,template_id,subject,to_email,to_name,status,error) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(sendId, req.user.id, leadId, template_id, subject, lead.email, lead.business_name || '', 'failed', e.message.slice(0, 500));
      failed++;
      results.push({ leadId, status: 'failed', error: e.message });
    }
  }

  res.json({ sent, failed, results });
});


// POST send a test email to a given address
app.post(P + '/send-test', auth, async (req, res) => {
  const { to_email, subject, rawMode, rawBody, builder_json } = req.body;
  if (!to_email) return res.status(400).json({ error: 'to_email required' });
  const u = db.prepare('SELECT smtp_host,smtp_port,smtp_secure,smtp_user,smtp_pass_enc,smtp_from_name,smtp_from_email FROM users WHERE id=?').get(req.user.id);
  if (!u?.smtp_host || !u?.smtp_pass_enc) return res.status(400).json({ error: 'Configure SMTP settings first' });
  const pass = decryptPass(u.smtp_pass_enc);
  const transporter = nodemailer.createTransport({ host:u.smtp_host, port:u.smtp_port||587, secure:!!u.smtp_secure, auth:{ user:u.smtp_user, pass } });
  const emptyLead = { business_name:'', email:'', phone:'', address:'', industry:'', location:'', ig_handle:'', followers:null, niche:'' };
  let html;
  if (rawMode || !builder_json) {
    html = (rawBody||'').replace(/\n/g,'<br>');
  } else {
    let bd; try { bd = JSON.parse(builder_json); } catch { return res.status(400).json({ error:'Invalid builder_json' }); }
    html = renderBuilderHtml(bd, emptyLead);
  }
  try {
    await transporter.sendMail({ from:`"${u.smtp_from_name||u.smtp_user}" <${u.smtp_from_email||u.smtp_user}>`, to:to_email, subject:'[TEST] '+(subject||'Email Preview'), html });
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// END verbatim slice
// ─────────────────────────────────────────────────────────────────────────────
};
