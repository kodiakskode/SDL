/* Pull SDL's figures out of Xero and write data/metrics.json.
   Run by .github/workflows/sync-metrics.yml on a schedule.

   Why Xero and not JACK: jackapp.io has no public API. JACK's documented
   outbound path is its two-way Xero sync, so Xero is the system of record for
   anything financial and the only supported way to get these numbers out
   without scraping. (Do not confuse jackapp.io with itsjack.com — a different
   company whose payments API tops the search results.)

   Auth is a Xero Custom Connection (machine-to-machine OAuth2, client
   credentials), created at developer.xero.com/app/manage — NOT in the Xero
   accounting app's Connected apps page, which only lists what is already
   connected to the org.

   Required env:
     XERO_CLIENT_ID, XERO_CLIENT_SECRET   from the Custom Connection app
     XERO_TENANT_ID                       optional; see below

   A Custom Connection is bound to exactly one organisation, so the token by
   itself identifies the org and the Xero-Tenant-Id header is not required —
   which is why XERO_TENANT_ID is optional here. It is still sent when set, so
   the same script works unchanged against a standard OAuth2 app, where the
   header IS required because one token can span several orgs.

   Scopes to grant: accounting.transactions.read (add accounting.reports.read
   only if you later pull Xero's own reports).
*/
"use strict";

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "metrics.json");
const API = "https://api.xero.com/api.xro/2.0";
const MONTHS_BACK = 12;

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

async function token() {
  const id = need("XERO_CLIENT_ID"), secret = need("XERO_CLIENT_SECRET");
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: process.env.XERO_SCOPES || "accounting.transactions.read"
    })
  });
  if (!res.ok) throw new Error(`Xero token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

/* Xero allows 60 calls/min and 5000/day per tenant. We make a handful per run,
   but retry politely on the documented 429 so a burst never fails the job. */
async function get(pathname, tok, params = {}) {
  const url = new URL(API + pathname);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = { Authorization: `Bearer ${tok}`, Accept: "application/json" };
  // Only meaningful for a multi-org OAuth2 app; a Custom Connection ignores it.
  if (process.env.XERO_TENANT_ID) headers["Xero-Tenant-Id"] = process.env.XERO_TENANT_ID;

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

async function main() {
  const tok = await token();
  const now = new Date();

  // Window start: first day of the month, MONTHS_BACK - 1 months ago.
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1), 1));

  // ACCREC = invoices we issued. Drafts and deleted are excluded so the
  // numbers match what Xero itself reports.
  const invRes = await get("/Invoices", tok, {
    where: `Type=="ACCREC" AND Date>=DateTime(${from.getUTCFullYear()},${from.getUTCMonth() + 1},1) `
         + `AND Status!="DELETED" AND Status!="VOIDED" AND Status!="DRAFT"`,
    order: "Date ASC", page: 1, summaryOnly: "true"
  });
  const invoices = invRes.Invoices || [];

  // ACCPAY = bills we owe.
  const billRes = await get("/Invoices", tok, {
    where: `Type=="ACCPAY" AND Status=="AUTHORISED"`,
    summaryOnly: "true"
  });
  const bills = billRes.Invoices || [];

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
    ageing: Object.entries(ageing).map(([bucket, amount]) => ({ bucket, amount: round(amount) }))
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${OUT} — ${invoices.length} invoices, ${months.length} months, `
            + `$${round(outstanding).toLocaleString()} outstanding`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
