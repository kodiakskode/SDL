# SDL Creations — dashboard

A static, no-build dashboard: four pages, one shared theme, no server and no
third-party services. Published free on GitHub Pages, no ads.

| Page | File | What it does |
| --- | --- | --- |
| Home | `index.html` | Overview, live counts, links into the other pages |
| Leads | `leads.html` | 750 NSW architects + 750 NSW landscape designers behind one dropdown |
| Pool Finder | `pool.html` | 12,132 Sydney properties with a pool confirmed 20+ years old |
| Mail List | `mail-list.html` | The mail-ready set in two value bands, reached from Pool Finder |
| Outreach | `outreach.html` | Placeholder, styled and wired into the nav |

## Look

**Type** — FT Overpass, self-hosted at `assets/fonts/ft-overpass.woff2`. The ten
digit outlines in the supplied OTF are all the same wrong glyph, so `0`-`9` are
subset out of the web font and fall through per-glyph to **Overpass**, the family
FT Overpass is drawn from. Overpass also covers the handful of characters FT
Overpass lacks (`'` `"` `<` `>` `~` `.`). Anything mostly numeric is set in
Overpass outright, via `--font-num`, so a single string never mixes the two.
`--font-mono` is Overpass Mono, for labels and tabular figures.

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

Nothing is uploaded. Lead status, notes and the theme live in this browser's
`localStorage`, so they are per-device. The Pool Finder's **Back up** /
**Restore** buttons move that tracking to another machine.

## Layout

```
index.html leads.html outreach.html   built from scripts/pages/*.body.html
pool.html  mail-list.html             vendored - see below
assets/  theme.css  pool-skin.css  app.js  leads.js
         logo-light.svg  logo-dark.svg  fonts/ft-overpass.woff2
data/    leads.json                  cleaned lead lists
scripts/ build_leads.py build_pool.py
         _head.html _nav.html _foot.html  pages/*.body.html
mail_merge.csv  leads_full.csv        Pool Finder downloads
```

Every page shares `scripts/_head.html`, `_nav.html` and `_foot.html`, so the
header is defined once. `scripts/build_pages.py` reassembles the three
hand-edited pages after you edit a fragment or a body file; `build_pool.py`
does the two vendored ones.

## Regenerating

**Leads** — `data/leads.json` is built from the two source spreadsheets:

```bash
pip install openpyxl
python3 scripts/build_leads.py     # edit the SRC path at the top first
```

It normalises phone numbers to Australian formats, validates emails, drops
placeholder values, title-cases shouted names, derives a suburb and postcode
from free-text addresses, maps postcodes onto NSW regions, and marks LDI/AILDM
membership only where the source carried separate evidence (28 of 750 —
the rest are labelled unverified rather than claimed as members).

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

1. In Xero: **Settings → Connected apps → Custom Connection**. Custom Connections
   are machine-to-machine (client-credentials OAuth2) — one organisation, no
   consent screen. Grant scopes `accounting.reports.read` and
   `accounting.transactions.read`.
2. Add three repository secrets (**Settings → Secrets and variables → Actions**):
   `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_TENANT_ID`.
3. Run the workflow once from the **Actions** tab to confirm, then let the daily
   schedule take over.

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

Lead lists are compiled from public professional listings — NSW Architects
Registration Board profiles, and public NSW landscape/garden design business
listings. Email coverage on the landscape list is thin (18 of 750); phone
coverage is near total, because most of those businesses publish a contact
form rather than an address.

Pool data: OpenStreetMap contributors (ODbL) · NSW Spatial Services,
Department of Customer Service (CC BY 4.0).
