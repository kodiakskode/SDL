"""Vendor the Pool Finder into the dashboard.

Source: https://github.com/ddeonmadeit/pool (index.html — the page published at
https://ddeonmadeit.github.io/pool/). The markup, the embedded lead data and the
whole filter/sort/track script are carried across untouched. This script only:

  1. wraps it in the dashboard's head + nav so it shares the theme toggle,
  2. layers assets/pool-skin.css over its own stylesheet,
  3. adds a checkbox column and a selection bar so the addresses in the table —
     the ones ticked, or every row passing the current filters — can be copied
     out as plain lines or as CSV.

Re-run after pulling a newer upstream index.html.
"""
import os
import re
import sys

COLGROUP = """<colgroup>
        <col style="width:42px"><col style="width:20%"><col style="width:9%">
        <col style="width:10%"><col style="width:8%"><col style="width:5%">
        <col style="width:5%"><col style="width:5%"><col style="width:5%">
        <col style="width:5%"><col style="width:10%"><col style="width:13%">
        <col style="width:5%">
      </colgroup>"""

PAGEHEAD = """<div class="pagehead">
  <p class="eyebrow">Pool Finder</p>
  <div class="row">
    <div>
      <h1>Sydney pools, 20+ years old</h1>
      <p class="lede">Properties whose pool is confirmed pre-2006 from NSW government
        aerial imagery, scored and filterable. Tick rows, or filter down to the set you
        want and copy every address in it.</p>
    </div>
  </div>
</div>

"""

SELECT_BAR = """<div class="select-bar">
  <span class="lbl">Selection <span id="sel-count">none ticked</span></span>
  <button type="button" class="key primary" id="copy-addr">Copy addresses</button>
  <button type="button" class="key" id="copy-addr-csv">Copy addresses as CSV</button>
  <button type="button" class="key" id="clear-sel">Clear selection</button>
  <span id="copy-note"></span>
  <span class="ctl-label" style="margin-left:auto">Tick rows to narrow it &mdash; with
    nothing ticked, copying takes every address matching the filters</span>
</div>

"""

SELECT_JS = r"""  // ── address selection and copying ──────────────────────────────
  // Ticks are held by DATA index, so they survive filtering, sorting and the
  // virtualised scroll. With nothing ticked, copying acts on the whole
  // filtered view - "before or after filtering", either way round.
  var picked = Object.create(null);
  var checkAll = document.getElementById("check-all");
  var selCount = document.getElementById("sel-count");
  var copyNote = document.getElementById("copy-note");

  function pickedInView() {
    return view.filter(function (i) { return picked[i]; });
  }

  function targetRows() {
    var p = pickedInView();
    return p.length ? p : view;
  }

  function syncSel() {
    var n = pickedInView().length;
    selCount.textContent = n ? n.toLocaleString() + " ticked" : "none ticked";
    checkAll.checked = view.length > 0 && n === view.length;
    checkAll.indeterminate = n > 0 && n < view.length;
  }

  tbody.addEventListener("change", function (ev) {
    if (!ev.target.classList.contains("rowpick")) return;
    var i = +ev.target.closest("tr.lead").dataset.i;
    if (ev.target.checked) picked[i] = true; else delete picked[i];
    syncSel();
  });

  checkAll.addEventListener("change", function () {
    var on = checkAll.checked;
    for (var k = 0; k < view.length; k++) {
      if (on) picked[view[k]] = true; else delete picked[view[k]];
    }
    render();
    syncSel();
  });

  document.getElementById("clear-sel").addEventListener("click", function () {
    picked = Object.create(null);
    render();
    syncSel();
    noteFlash("Selection cleared");
  });

  // The filter controls carry their own listeners registered before this block,
  // so hook the bubble phase on document: by the time this runs, view is fresh.
  document.addEventListener("input", function () { setTimeout(syncSel, 0); });
  document.addEventListener("change", function () { setTimeout(syncSel, 0); });
  document.addEventListener("click", function () { setTimeout(syncSel, 0); });

  var noteT;
  function noteFlash(msg) {
    copyNote.textContent = msg;
    clearTimeout(noteT);
    noteT = setTimeout(function () { copyNote.textContent = ""; }, 3000);
  }

  function toClipboard(text, label) {
    if (!text) { noteFlash("Nothing to copy"); return; }
    var done = function (ok) { noteFlash(ok ? label : "Clipboard blocked by browser"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); },
                                              function () { done(legacyCopy(text)); });
    } else {
      done(legacyCopy(text));
    }
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function addressLine(i) {
    var d = DATA[i];
    return d[A] + " NSW" + (d[PC] ? " " + d[PC] : "");
  }

  document.getElementById("copy-addr").addEventListener("click", function () {
    var rows = targetRows();
    var text = rows.map(addressLine).join("\n");
    toClipboard(text, rows.length.toLocaleString() + " addresses copied" +
      (pickedInView().length ? " (ticked)" : " (whole filtered set)"));
  });

  document.getElementById("copy-addr-csv").addEventListener("click", function () {
    var rows = targetRows();
    var head = ["address", "suburb", "postcode", "pool_built_by", "min_age_years",
                "condition", "est_value", "score", "mail_ready"];
    var cell = function (v) {
      return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    };
    var lines = [head.map(cell).join(",")];
    rows.forEach(function (i) {
      var d = DATA[i];
      lines.push([d[A], d[S], d[PC] || "", d[YR], NOW - d[YR],
                  (COND[d[CD]] || COND[4])[0], d[EV] || "", d[SC],
                  d[MR] ? "yes" : "no"].map(cell).join(","));
    });
    toClipboard(lines.join("\n"),
      rows.length.toLocaleString() + " addresses copied as CSV");
  });

  syncSel();
"""

SRC = sys.argv[1] if len(sys.argv) > 1 else "/home/user/ddeonmadeit/pool/index.html"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "pool.html")
FRAG = os.path.dirname(os.path.abspath(__file__))

src = open(SRC, encoding="utf-8").read()


def once(haystack, needle, label):
    n = haystack.count(needle)
    if n != 1:
        raise SystemExit("expected 1 occurrence of %s upstream, found %d" % (label, n))


# ── split the upstream file ───────────────────────────────────────
style_start = src.index("<style>")
style_end = src.index("</style>") + len("</style>")
upstream_style = src[style_start:style_end]
body = src[src.index('<div class="shell">'):]
# The head fragment already opens .shell; drop the vendored opener.
body = body[len('<div class="shell">'):].lstrip("\n")

# ── 1. drop the upstream chassis; the dashboard nav replaces it ───
chassis = re.search(r'<div class="chassis">.*?</div>\n', body, re.S)
if not chassis:
    raise SystemExit("could not find the upstream .chassis block")
body = body[:chassis.start()] + PAGEHEAD + body[chassis.end():]

# ── 2. checkbox column ────────────────────────────────────────────
old_cols = re.search(r"<colgroup>.*?</colgroup>", body, re.S)
if not old_cols:
    raise SystemExit("could not find the upstream <colgroup>")
body = body[:old_cols.start()] + COLGROUP + body[old_cols.end():]

once(body, '<th class="sortable" data-sort="suburb">', "address <th>")
body = body.replace(
    '<th class="sortable" data-sort="suburb">',
    '<th class="pick"><input type="checkbox" id="check-all" '
    'aria-label="Select every row matching the filters"></th>\n'
    '        <th class="sortable" data-sort="suburb">', 1)

# The upstream pad rows understate the column count; fix it while we are here.
body = body.replace('<td colspan="11"></td>', '<td colspan="13"></td>')

# ── 3. selection bar above the well ───────────────────────────────
once(body, '<div class="well">', "well")
body = body.replace('<div class="well">', SELECT_BAR + '<div class="well">', 1)

# ── 4. row markup: prepend the checkbox cell ──────────────────────
old_row = ("html += '<tr class=\"lead\" data-i=\"' + i + '\" data-s=\"' + stt + '\">' +\n"
           "        '<td><span class=\"addr\">'")
if body.count(old_row) != 1:
    raise SystemExit("upstream row template changed; update build_pool.py")
body = body.replace(old_row,
    ("html += '<tr class=\"lead\" data-i=\"' + i + '\" data-s=\"' + stt + '\">' +\n"
     "        '<td class=\"pick\"><input type=\"checkbox\" class=\"rowpick\"' +\n"
     "        (picked[i] ? ' checked' : '') + ' aria-label=\"Select ' + esc(d[A]) + '\"></td>' +\n"
     "        '<td><span class=\"addr\">'"), 1)

# ── 5. selection + copy behaviour, injected before the closing IIFE ──
tail = "\n  rebuild();\n})();\n</script>"
once(body, tail, "script tail")
body = body.replace(tail, "\n" + SELECT_JS + tail, 1)

# ── assemble ──────────────────────────────────────────────────────
head = (open(os.path.join(FRAG, "_head.html"), encoding="utf-8").read()
        .replace("__TITLE__", "Pool Finder")
        .replace("__DESC__", "Sydney properties with a pool confirmed 20+ years old from "
                             "NSW government aerial imagery — filter, select and copy addresses."))
head = head.replace("</head>", upstream_style +
                    '\n<link rel="stylesheet" href="assets/pool-skin.css">\n</head>')
nav = open(os.path.join(FRAG, "_nav.html"), encoding="utf-8").read()

open(OUT, "w", encoding="utf-8").write(
    head + nav + body + '\n<script src="assets/app.js"></script>\n</body>\n</html>\n')
print("wrote %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
