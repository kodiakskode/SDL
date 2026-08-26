'use strict';
/**
 * Open access — NOT part of the RawLeads extraction, and not what server/auth.js
 * does. There are no user accounts anywhere on this dashboard, and the owner
 * chose to run the Outreach tab without a login gate (it's just them), so
 * every request is treated as the same single admin user.
 *
 * Every outreach/leads route only relies on `req.user.id` being set — swap
 * this back out for server/auth.js (JWT) in server/index.js if that
 * trade-off ever needs to change.
 */
module.exports = function noAuth(req, res, next) {
  req.user = { id: 1 };
  next();
};
