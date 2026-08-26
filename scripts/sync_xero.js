/* Pull SDL's figures out of Xero and write data/metrics.json.
   Run by .github/workflows/sync-metrics.yml on a schedule.

   Why Xero and not JACK: jackapp.io has no public API. JACK's documented
   outbound path is its two-way Xero sync, so Xero is the system of record for
   anything financial and the only supported way to get these numbers out
   without scraping. (Do not confuse jackapp.io with itsjack.com — a different
   company whose payments API tops the search results.)

   Auth is a free Xero "Web app" (standard OAuth2, authorization_code grant) —
   NOT a Custom Connection, which needs an extra paid A$10/month subscription
   on the Xero org. The one-time login a Web app needs is done once, locally,
   by scripts/xero_oauth_bootstrap.js (see that file); everything after that
   runs unattended, because this script rotates its own refresh token.

   Required env:
     XERO_CLIENT_ID, XERO_CLIENT_SECRET   from the Web app
     XERO_REFRESH_TOKEN                   from the bootstrap script; rotated
                                           here on every run (see rotateSecret)
     XERO_TENANT_ID                       from the bootstrap script — REQUIRED
                                           (unlike a Custom Connection, one
                                           Web app token can span several
                                           orgs, so Xero needs telling which)

   Optional env (only for rotating XERO_REFRESH_TOKEN back into GitHub —
   without these the script still runs, it just can't save the new token,
   and the one it has will stop working after 60 days of not being used):
     GH_SECRETS_PAT   a fine-grained PAT scoped to just this repo, with the
                       "Secrets" repository permission set to read+write.
                       Nothing else — it can't touch code, issues or other
                       repos. See the README's Business metrics section for
                       how to create one.
     GITHUB_REPOSITORY   set automatically inside GitHub Actions
                          ("owner/repo"); only needs setting by hand for a
                          local test run.

   Xero's refresh tokens ROTATE: every time one is used, Xero invalidates it
   and returns a new one in the same response. This script uses the secret's
   current value once, then immediately writes the new one back — if that
   write fails partway (bad PAT, GitHub outage), the run still finishes with
   the metrics it fetched, but the *next* run will fail because the secret
   still holds the now-dead token. Check the Actions log if a run fails with
   a 400 from /connect/token; re-run scripts/xero_oauth_bootstrap.js to
   recover.

   Scopes to grant: accounting.invoices.read, accounting.contacts.read,
   accounting.settings.read — plus offline_access, which is what makes Xero
   issue a refresh token at all.

   Xero's current portal issues GRANULAR scopes. The older umbrella scope
   accounting.transactions.read no longer validates — requesting it makes the
   authorize endpoint fail with invalid_scope (a 500 page in the browser), so
   don't reintroduce it. accounting.settings.read is what exposes Tracking
   Categories, which is where job names live.
*/
"use strict";

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "metrics.json");
const API = "https://api.xero.com/api.xro/2.0";
const MONTHS_BACK = 12;
const TOP_JOBS = 12;   // how many jobs the home page charts; `all` keeps the rest

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

// Set once token() runs, so main() can persist whatever Xero handed back —
// even if it's identical to the old one, writing it back is harmless.
let newRefreshToken = null;

async function token() {
  const id = need("XERO_CLIENT_ID"), secret = need("XERO_CLIENT_SECRET");
  const refreshToken = need("XERO_REFRESH_TOKEN");
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  if (!res.ok) throw new Error(`Xero token ${res.status}: ${await res.text()}`);
  const data = await res.json();
  newRefreshToken = data.refresh_token;
  return data.access_token;
}

/* Xero secrets are encrypted with the repo's public key before the GitHub API
   will accept them (libsodium sealed box) — this mirrors GitHub's own
   documented Node example for setting Actions secrets. Skipped quietly if
   GH_SECRETS_PAT isn't set, so this script still works for a local test run
   or before that PAT has been created. */
async function rotateSecret() {
  const pat = process.env.GH_SECRETS_PAT;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!pat || !repo || !newRefreshToken) {
    /* Xero has ALREADY invalidated the token we came in with — it rotates on
       every use. Printing the replacement is not optional: discard it and the
       connection is simply dead, needing the whole browser login again. Xero
       honours the previous token for a short grace period, which is the only
       reason a missed rotation is ever recoverable. */
    console.log("Could not save the rotated refresh token (GH_SECRETS_PAT / GITHUB_REPOSITORY not set).");
    if (newRefreshToken) {
      console.log("The OLD token is now spent. Store this replacement as XERO_REFRESH_TOKEN:");
      console.log("  " + newRefreshToken);
    }
    return;
  }

  const sodium = require("libsodium-wrappers");
  await sodium.ready;

  const api = `https://api.github.com/repos/${repo}/actions/secrets`;
  const ghHeaders = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const keyRes = await fetch(`${api}/public-key`, { headers: ghHeaders });
  if (!keyRes.ok) throw new Error(`GitHub public-key ${keyRes.status}: ${await keyRes.text()}`);
  const { key, key_id } = await keyRes.json();

  const sealed = sodium.crypto_box_seal(
    sodium.from_string(newRefreshToken),
    sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  );
  const encrypted_value = sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);

  const putRes = await fetch(`${api}/XERO_REFRESH_TOKEN`, {
    method: "PUT",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_value, key_id })
  });
  if (!putRes.ok) throw new Error(`GitHub secret update ${putRes.status}: ${await putRes.text()}`);
  console.log("Rotated XERO_REFRESH_TOKEN.");
}

/* Xero allows 60 calls/min and 5000/day per tenant. We make a handful per run,
   but retry politely on the documented 429 so a burst never fails the job. */
async function get(pathname, tok, params = {}) {
  const url = new URL(API + pathname);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = {
    Authorization: `Bearer ${tok}`, Accept: "application/json",
    "Xero-Tenant-Id": need("XERO_TENANT_ID")
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      const wait = (Number(res.headers.get("Retry-After")) || 5) * 1000;
      console.warn(`rate limited, waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Xero ${pathname} ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error(`Xero ${pathname}: still rate limited after 4 attempts`);
}

const ym = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/* Xero returns at most 100 invoices per page and gives no total count, so the
   only way to know you have them all is to keep asking until a short page
   comes back. Skipping this silently truncates every figure at 100 invoices —
   which is exactly what an earlier version of this script did. */
async function getAllInvoices(tok, params) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const res = await get("/Invoices", tok, { ...params, page });
    const batch = res.Invoices || [];
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  throw new Error("Invoice pagination exceeded 100 pages — refusing to loop further");
}

/* Per-job figures come from Xero Tracking Categories, which live on invoice
   LINE ITEMS, not on the invoice — so these calls can't use summaryOnly,
   which omits line items entirely.

   A single invoice can span several jobs, so revenue is attributed per line.
   AmountDue is only known at invoice level, so it's split across that
   invoice's jobs in proportion to their line amounts; an invoice with no job
   tag at all is counted in `untagged` rather than silently dropped. */
function jobBreakdown(invoices, categoryName) {
  const jobs = new Map();
  let taggedInvoices = 0, untaggedInvoices = 0, untaggedAmount = 0;

  const pick = li => (li.Tracking || []).find(t => t.Name === categoryName);

  for (const inv of invoices) {
    const lines = inv.LineItems || [];
    const lineTotal = lines.reduce((a, l) => a + Math.abs(l.LineAmount || 0), 0);
    let invoiceHasTag = false;

    for (const li of lines) {
      const tag = pick(li);
      if (!tag || !tag.Option) continue;
      invoiceHasTag = true;

      const j = jobs.get(tag.Option) || { name: tag.Option, invoiced: 0, outstanding: 0, invoices: new Set() };
      j.invoiced += li.LineAmount || 0;
      // Proportional share of what's still owed on the parent invoice.
      if (lineTotal > 0) {
        j.outstanding += (inv.AmountDue || 0) * (Math.abs(li.LineAmount || 0) / lineTotal);
      }
      j.invoices.add(inv.InvoiceID);
      jobs.set(tag.Option, j);
    }

    if (invoiceHasTag) taggedInvoices++;
    else { untaggedInvoices++; untaggedAmount += inv.Total || 0; }
  }

  const round = n => Math.round(n);
  const list = [...jobs.values()]
    .map(j => ({ name: j.name, invoiced: round(j.invoiced), outstanding: round(j.outstanding), invoices: j.invoices.size }))
    .sort((a, b) => b.invoiced - a.invoiced);

  return {
    category: categoryName,
    totalJobs: list.length,
    taggedInvoices,
    untaggedInvoices,
    untaggedAmount: round(untaggedAmount),
    top: list.slice(0, TOP_JOBS),
    all: list
  };
}

async function main() {
  const tok = await token();
  const now = new Date();

  // Window start: first day of the month, MONTHS_BACK - 1 months ago.
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1), 1));

  // ACCREC = invoices we issued. Drafts and deleted are excluded so the
  // numbers match what Xero itself reports. Full detail (no summaryOnly) so
  // line-item Tracking comes through for the per-job breakdown.
  const invoices = await getAllInvoices(tok, {
    where: `Type=="ACCREC" AND Date>=DateTime(${from.getUTCFullYear()},${from.getUTCMonth() + 1},1) `
         + `AND Status!="DELETED" AND Status!="VOIDED" AND Status!="DRAFT"`,
    order: "Date ASC"
  });

  // ACCPAY = bills we owe. Only the totals matter here, so summary is enough.
  const bills = await getAllInvoices(tok, {
    where: `Type=="ACCPAY" AND Status=="AUTHORISED"`,
    summaryOnly: "true"
  });

  // Which tracking category holds job names — usually literally "Jobs".
  const tcRes = await get("/TrackingCategories", tok);
  const activeCat = (tcRes.TrackingCategories || []).find(c => c.Status === "ACTIVE");
  const jobs = activeCat ? jobBreakdown(invoices, activeCat.Name) : null;

  const months = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ m: ym(d), invoiced: 0, paid: 0 });
  }
  const byMonth = new Map(months.map(m => [m.m, m]));

  let outstanding = 0, overdue = 0, openInvoices = 0;
  const ageing = { "Current": 0, "1–30": 0, "31–60": 0, "60+": 0 };
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (const inv of invoices) {
    // Xero serialises dates as /Date(1690000000000+0000)/
    const ts = Number(String(inv.DateString ? inv.DateString : inv.Date).replace(/\D/g, "").slice(0, 13));
    const date = inv.DateString ? new Date(inv.DateString) : new Date(ts);
    const bucket = byMonth.get(ym(date));
    if (bucket) {
      bucket.invoiced += inv.Total || 0;
      bucket.paid += inv.AmountPaid || 0;
    }

    const due = inv.AmountDue || 0;
    if (due > 0) {
      outstanding += due;
      openInvoices++;
      const dueDate = inv.DueDateString ? new Date(inv.DueDateString) : null;
      const daysLate = dueDate ? Math.floor((today - dueDate) / 86400000) : 0;
      if (daysLate > 0) overdue += due;
      if (daysLate <= 0) ageing["Current"] += due;
      else if (daysLate <= 30) ageing["1–30"] += due;
      else if (daysLate <= 60) ageing["31–60"] += due;
      else ageing["60+"] += due;
    }
  }

  const billsDue = bills.reduce((a, b) => a + (b.AmountDue || 0), 0);
  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  const round = n => Math.round(n);
  const out = {
    generated: new Date().toISOString(),
    source: "xero",
    sample: false,
    currency: invoices[0]?.CurrencyCode || "AUD",
    current: {
      revenueMTD: round(thisMonth ? thisMonth.invoiced : 0),
      revenueMTDPrev: round(prevMonth ? prevMonth.invoiced : 0),
      outstanding: round(outstanding),
      overdue: round(overdue),
      billsDue: round(billsDue),
      openInvoices
    },
    months: months.map(m => ({ m: m.m, invoiced: round(m.invoiced), paid: round(m.paid) })),
    ageing: Object.entries(ageing).map(([bucket, amount]) => ({ bucket, amount: round(amount) })),
    jobs
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${OUT} — ${invoices.length} invoices, ${months.length} months, `
            + `$${round(outstanding).toLocaleString()} outstanding`);
  if (jobs) {
    console.log(`jobs: ${jobs.totalJobs} tracked via "${jobs.category}"; `
              + `${jobs.taggedInvoices} invoices tagged, ${jobs.untaggedInvoices} untagged `
              + `($${jobs.untaggedAmount.toLocaleString()})`);
  }

  // Xero already rotated the refresh token the moment token() used the old
  // one — write the new one back now, or the next scheduled run fails.
  await rotateSecret();
}

main().catch(err => { console.error(err.message); process.exit(1); });
