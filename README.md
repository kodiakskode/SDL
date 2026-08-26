# SDL Creations — dashboard

A static, no-build dashboard: four pages, one shared theme, no third-party
services. Published free on GitHub Pages, no ads. Outreach is the one page
that isn't fully static — it talks to a small backend (`server/`) for SMTP
sending, templates and history; see [Outreach backend](#outreach-backend)
below.

| Page | File | What it does |
| --- | --- | --- |
| Home | `index.html` | Overview, live counts, links into the other pages |
| Leads | `leads.html` | 66 Sydney landscape architects + 110 Sydney landscape designers + anything you import, behind one dropdown (with an All Lists option) |
| Pool Finder | `pool.html` | 12,132 Sydney properties with a pool confirmed 20+ years old |
| Mail List | `mail-list.html` | The mail-ready set in two value bands, reached from Pool Finder |
| Outreach | `outreach.html` | Email templates, SMTP settings, sending and history — a RawLeads outreach tab wired to the leads above |

## Look

**Layout** — a left sidebar (`.app-shell` in `scripts/_nav.html`), not a top
bar. The logo sits in its own row at the top of the sidebar and is itself
the toggle: click it to open or close the nav panel below it
(`data-sidebar="collapsed"` on `<html>`, remembered in
`localStorage.sdl-sidebar` and resolved before first paint, same mechanism
as the theme). Narrow screens ignore that preference and always show a
slim icon-only rail — 208px of sidebar would swallow most of a phone
screen.

**Scale** — the whole dashboard renders at 125% (`html{zoom:1.25}` in
`assets/theme.css`), same effect as the browser's own zoom, so it applies to
every page — including the vendored Pool Finder/Mail List and the Outreach
tab — without converting anything to rem.

**Type** — Helvetica throughout (`--font-ui`, `--font-num` and `--font-mono` all
resolve to `"Helvetica Neue", Helvetica, Arial, sans-serif`). No web font, so
nothing to load — every page, including the vendored Pool Finder and Mail List
and the Outreach tab, sets the same stack.

**Colour** — light taupe/cream ground, very dark brown ink, highlights in the
logo's green (`#5d622a`). The button top right inverts it; the choice is
remembered per browser. The logo is the mark alone, in the left corner:
`assets/logo-light.svg` (green) on light, `assets/logo-dark.svg` (light taupe)
on dark. Replace either file in place and the header picks it up.

**Depth** — the Pool Finder's metal panelling, in this palette. One light source
straight overhead, so every edge is horizontal: a hairline highlight along the
top inside of a raised face, a dark lip along its bottom, a soft drop beneath —
and the inverse, sunk from the top, for anything that holds content. Six recipes
in `assets/theme.css` do all of it:

| Token | Used for |
| --- | --- |
| `--sh-chassis` | the header bar |
| `--sh-key` | buttons, nav links, cards, status keys |
| `--sh-key-press` | those same faces, pressed |
| `--sh-panel` | filter bars, stat strip, note blocks |
| `--sh-well` | table panels — anything that holds content |
| `--sh-field` | inputs, selects, tick boxes |

Panels carry the relief; text stays flat so it reads clean. The metal tokens are
namespaced `--m-*` because the vendored Pool Finder stylesheet defines its own
`--ground`, `--edge-light`, `--edge-dark` and `--pad`, and it loads after this
one.


## Copying data out

Both tables share the same rule: **tick rows to narrow it; with nothing ticked,
copying takes every row matching the current filters.** Filter first or tick
first, either order works.

- **Pool Finder** — *Copy addresses* gives one address per line
  (`41 PARK STREET GLENBROOK NSW 2773`), ready to paste into a mail merge.
  *Copy addresses as CSV* adds suburb, postcode, pool age, condition, value,
  score and mail-ready flag.
- **Leads** — *Copy emails* (comma-separated, de-duplicated, ready for a To:
  field), *Copy phones*, or *Copy rows as CSV*.

Lead status, notes and the theme live in this browser's `localStorage`, so
they are per-device. The Pool Finder's **Back up** / **Restore** buttons move
that tracking to another machine.

### Importing your own list

**Import CSV / Excel…**, next to the List dropdown on the Leads page, adds a
new list from a `.csv`, `.xlsx` or `.xls` file — pick a title for it and it
behaves exactly like Landscape Architects/Designers: filter, tick, copy. It's
matched against common header names (Business/Company/Org, Name, Email,
Phone/Mobile, Suburb/City, Postcode, Region/State, Website, Type, Status —
case-insensitive, any subset); a single-column file with no header is read as
a bare list of emails or names. Parsing is entirely client-side (CSV by hand,
Excel via [SheetJS](https://sheetjs.com), vendored at
`assets/js/xlsx.full.min.js`) and the result is saved to this browser's
`localStorage`, same as everything else on this page — **Delete this list**
removes it again, only from this device.

If the Outreach backend (see below) is reachable, the import is also posted
to it — `POST /leads/import` — so the new list shows up as a filterable
option on the Outreach tab's recipient picker alongside the built-in lists,
next to everyone else's email. If the backend isn't reachable at import time,
the list still works fine on the Leads page; it just isn't sendable from
Outreach until you import it again with a live connection.

## Layout

```
index.html leads.html outreach.html   built from scripts/pages/*.body.html
pool.html  mail-list.html             vendored - see below
assets/  theme.css  pool-skin.css  app.js  leads.js
         logo-light.svg  logo-dark.svg
         outreach.css  outreach-app.jsx    Outreach tab, styled for this theme
         js/  react.min.js  react-dom.min.js  babel.min.js   vendored, in-browser JSX
data/    leads.json                  cleaned lead lists
scripts/ build_leads.py build_pool.py
         _head.html _nav.html _foot.html  pages/*.body.html
server/  outreach.js schema.js auth.js helpers.js   verbatim from rawleads
         leads.js seed-leads.js no-auth.js           new — see Outreach backend
         index.js  package.json  .env.example
mail_merge.csv  leads_full.csv        Pool Finder downloads
```

Every page shares `scripts/_head.html`, `_nav.html` and `_foot.html`, so the
header is defined once. `scripts/build_pages.py` reassembles the three
hand-edited pages after you edit a fragment or a body file; `build_pool.py`
does the two vendored ones.

## Regenerating

**Leads** — `data/leads.json` no longer matches `scripts/build_leads.py`.
That script builds the *original* two 750-row spreadsheets (NSW-registered
architects, and a loosely-categorised "landscape" list that turned out to be
full of unrelated trades — excavation, mowing, fencing). Both lists have
since been replaced by hand:

- **`designers`** — the original 750 filtered down to 110 confirmed landscape
  *design* businesses in Sydney (excavation/mowing/paving/fencing/concreting
  and other non-design trades removed, regional-NSW rows dropped).
- **`architects`** — the original 750 general architects replaced entirely.
  The NSW Architects Registration Board doesn't register landscape
  architects at all (0 of the original 750 were landscape specialists), so
  this is a from-scratch list of 66 landscape architecture/design practices
  in Sydney, compiled from public directories and each firm's own site.

Don't run `build_leads.py` against `data/leads.json` — it would overwrite
both curated lists with the original, uncurated ones. Each list's `note`
field (shown on the Leads page) documents exactly how it was built.

**Pool Finder and Mail List** — `pool.html` and `mail-list.html` are vendored
from [ddeonmadeit/pool](https://github.com/ddeonmadeit/pool). The markup,
embedded data and the entire filter/sort/track script are carried across
untouched; the build only wraps each in this dashboard's head and nav, layers
`assets/pool-skin.css` over the upstream stylesheet, rebuilds the two-page
sub-nav on our filenames, folds the long explainer into a collapsible block,
and (on Pool Finder) adds the tick column and address copying.

```bash
git clone --depth 1 https://github.com/ddeonmadeit/pool /tmp/pool
python3 scripts/build_pool.py /tmp/pool
```

The script asserts on every upstream anchor it edits, so if that page changes
shape the build fails loudly instead of producing a broken page.

## Outreach backend

The Outreach page is [kodiakskode/rawleads](https://github.com/kodiakskode/rawleads)'s
outreach tab, dropped in per its own README: `server/outreach.js`, `schema.js`,
`auth.js` and `helpers.js` are carried over verbatim, and `assets/outreach-app.jsx`
is `src/OutreachTab.jsx` verbatim (only its literal "signal orange" colors were
hue-rotated to this dashboard's green, so the two never fight — logic and
structure are untouched). `assets/outreach.css` is `src/outreach.css` scoped
under `.rl-outreach`, with rawleads' own page chrome (its topbar/nav/theme
toggle) dropped in favour of this dashboard's, and its design tokens remapped
to the palette above.

Two files are new, not from rawleads, because a static dashboard with no
accounts needed a bit more glue than "drop it into your Express app":

| File | Why |
| --- | --- |
| `server/leads.js` | Lists leads for the send picker (the route existed in RawLeads' full server.js but wasn't part of the outreach extraction), plus list management: `GET /leads/lists`, `POST /leads/import` and `DELETE /leads/lists/:id` back the Leads page's CSV/Excel importer and the Outreach tab's list filter. |
| `server/seed-leads.js` | Idempotently imports `data/leads.json` into the SQL `leads` table `server/outreach.js` sends from — the dashboard's leads are a static JSON file, not a database. |

**No login.** There are no user accounts anywhere on this dashboard, and the
owner chose to run Outreach the same way: `server/no-auth.js` treats every
request as the same single admin user instead of `server/auth.js`'s JWT
check. That means anyone who can reach the API can send mail through the
configured SMTP account and read the send history — acceptable for a
low-traffic personal tool, but keep `OUTREACH_ALLOWED_ORIGIN` narrow and
don't publish the server's URL if that trade-off ever needs to change (or
put it behind auth at the network level, and swap `no-auth` back for
`auth` in `server/index.js`).

GitHub Pages can't run Node, so this backend runs elsewhere —
**https://sdl.helixsolution.au**, in production. `outreach.html` and
`leads.html` both call whatever `SDL_OUTREACH_API_BASE` resolves to: a
`localStorage.sdl-outreach-api` override if you've set one on that browser,
falling back to that domain otherwise. The server's CORS allowlist
(`OUTREACH_ALLOWED_ORIGIN`) must be the dashboard's real GitHub Pages
origin — `https://kodiakskode.github.io`, no path — or the browser blocks
every request.

```bash
cd server
npm install
cp .env.example .env      # fill in OUTREACH_SECRET at minimum
npm start
```

See `server/.env.example` for every variable (the deploy runbook covers
running it persistently behind nginx on that domain), and the comment at
the top of each `server/*.js` file for whether it's verbatim from rawleads
or new. Open the Outreach tab — it talks to the server directly, no
sign-in step. To point a browser at a different backend (e.g. while
developing locally), run:

```js
localStorage.setItem('sdl-outreach-api', 'http://localhost:3021/rawleads/api');
```

## Business metrics (JACK App → Xero → dashboard)

The home page's KPI row and two charts read `data/metrics.json`, refreshed daily
by `.github/workflows/sync-metrics.yml`.

**Why Xero and not JACK directly.** [JACK App](https://jackapp.io) has no public
API. Its documented outbound path is the two-way Xero sync, so Xero is the system
of record for anything financial and the supported way to get these figures out.
Note that the "JACK API documentation" that tops a web search belongs to
`itsjack.com` — *Jack App Financial*, an unrelated payments company. Different
product; those docs do not apply.

**Because the dashboard is a static site, a committed file is what "live" means.**
The Action fetches, writes `data/metrics.json`, and commits it. That keeps the
Xero credentials in GitHub Secrets rather than the browser, needs no CORS, and
makes git history a free backup of every snapshot — which is also where the
chart history comes from.

### Setting it up

Custom Connections are **not** created in the Xero accounting app. The
*Connected apps* page there (`apps.xero.com/.../connected`) only lists what is
already connected to the org — it has no "add custom connection" option. They
live in the separate **Xero Developer portal**.

1. Go to **[developer.xero.com/app/manage](https://developer.xero.com/app/manage)**
   and sign in with the Xero login. → **New app** → name it → integration type
   **Custom connection**.
2. Choose the scope `accounting.transactions.read` (add `accounting.reports.read`
   only if you later pull Xero's own report endpoints), and pick the Xero user
   who will authorise it — that must be someone with admin on the SDL org.
3. That user gets an email with an authorisation link. Completing it activates
   the connection, and is where the org takes on the Custom Connection
   subscription: **A$10/month inc GST** per connection, AU/NZ/UK/US only.
   It is free against the **Xero Demo Company**, so the whole pipeline can be
   tested end to end before anything is paid for.
4. Back in **My Apps**, copy the `client_id` and `client_secret` into repository
   secrets (**Settings → Secrets and variables → Actions**) as `XERO_CLIENT_ID`
   and `XERO_CLIENT_SECRET`.
5. Run the workflow from the **Actions** tab, then let the daily schedule take over.

`XERO_TENANT_ID` is **optional and normally unnecessary**: a Custom Connection is
bound to exactly one organisation, so the token identifies it and the
`Xero-Tenant-Id` header is not required. The script still sends it when the
secret exists, so the same code works against a standard multi-org OAuth2 app,
where that header *is* required.

**If the A$10/month is not wanted**, the alternative is a standard OAuth2 web app
(free), but its refresh tokens rotate on every use and expire after 60 days — so
a scheduled job has to write each new refresh token back into a secret to stay
alive. That is meaningfully more moving parts for the saving.

Until those secrets exist the page serves the placeholder `data/metrics.json` and
shows a **Sample data** flag in the header, so the figures are never mistaken for
SDL's real numbers.

### Chart colours are validated, not chosen

The brand green `#5d622a` is not usable as a data mark: it fails the chroma floor
(0.079 — it reads gray) and collapses against rust under protanopia (ΔE 2.9). The
chart palette re-steps it to a higher-chroma olive of the same family and pairs it
with a blue that clears CVD separation in both modes.

| Role | Light | Dark |
| --- | --- | --- |
| Series 1 (Invoiced) | `#6f7a1f` | `#8a9445` |
| Series 2 (Paid) | `#2a78d6` | `#4a90d0` |
| Ageing ramp (ordinal) | `#9aa663 → #414717` | `#646d2c → #c6cf90` |

The ageing ramp is **ordinal**, not categorical — the buckets have an order, so
they take one hue in monotone lightness steps, and the ramp flips anchor in dark
mode so the oldest bucket stays the most prominent against its surface. Re-run
the checks after any change with the dataviz validator rather than eyeballing them.

## Publishing

GitHub Pages, project site, free and ad-free. In the repository:
**Settings → Pages → Source: Deploy from a branch**, pick this branch and the
`/ (root)` folder. `.nojekyll` is already committed so the `assets/` and
`data/` folders are served as-is.

## Data

Lead lists are compiled from public business directories (Yellow Pages, True
Local, Houzz and similar) and each firm's own website — 66 landscape
architecture practices and 110 landscape design businesses, both scoped to
the Sydney metro area. Every row with an email has that email confirmed as
published text on the firm's own site (never guessed or pattern-generated);
rows without one are phone/website-only. See each list's `note` field
(shown on the Leads page) for exactly how it was filtered.

Pool data: OpenStreetMap contributors (ODbL) · NSW Spatial Services,
Department of Customer Service (CC BY 4.0).
