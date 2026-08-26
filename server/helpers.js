'use strict';
// XSS helpers — verbatim from RawLeads server.js lines 21-30.
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeUrl(u) {
  if (!u) return '#';
  const s = String(u).trim();
  return /^javascript:/i.test(s) ? '#' : s;
}

module.exports = { escHtml, safeUrl };
