# SDL Creations — dashboard

A static, no-build dashboard: four pages, one shared theme, no server and no
third-party services. Published free on GitHub Pages, no ads.

| Page | File | What it does |
| --- | --- | --- |
| Home | `index.html` | Overview, live counts, links into the other pages |
| Leads | `leads.html` | 750 NSW architects + 750 NSW landscape designers behind one dropdown |
| Pool Finder | `pool.html` | 12,132 Sydney properties with a pool confirmed 20+ years old |
| Outreach | `outreach.html` | Placeholder, styled and wired into the nav |

## Look

Light taupe/cream ground, very dark brown ink, highlights in the logo's green
(`#5d622a`). The button in the top right inverts it to dark; the choice is
remembered per browser. Depth is neumorphic throughout — a single light source
from the top left, raised faces for anything you press, inset wells for anything
that holds content, embossed text on raised surfaces.

The logo sits small in the centre of the header: `assets/logo-light.svg` (green)
on light, `assets/logo-dark.svg` (light taupe) on dark. Replace either file
in place and the header picks it up — no markup change needed.

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
index.html leads.html outreach.html   hand-edited pages
pool.html                             generated — see below
assets/  theme.css  pool-skin.css  app.js  leads.js  logo-light.svg  logo-dark.svg
data/    leads.json                  cleaned lead lists
scripts/ build_leads.py build_pool.py _head.html _nav.html
mail_merge.csv  leads_full.csv        Pool Finder downloads
```

The nav block is repeated in each hand-edited page — change it in all four
(`scripts/_nav.html` is the copy `build_pool.py` uses).

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

**Pool Finder** — `pool.html` is vendored from
[ddeonmadeit/pool](https://github.com/ddeonmadeit/pool). The markup, embedded
data and the entire filter/sort/track script are carried across untouched;
the build only wraps it in this dashboard's head and nav, layers
`assets/pool-skin.css` over its own stylesheet, and adds the tick column and
address copying.

```bash
git clone --depth 1 https://github.com/ddeonmadeit/pool /tmp/pool
python3 scripts/build_pool.py /tmp/pool/index.html
```

The script asserts on every upstream anchor it edits, so if that page changes
shape the build fails loudly instead of producing a broken page.

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
