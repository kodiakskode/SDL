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
