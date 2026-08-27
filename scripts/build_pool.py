"""Vendor the Pool Finder pages into the dashboard.

Source: https://github.com/ddeonmadeit/pool — index.html (Pool Finder) and
mail-list.html (Mail List), the pages published at
https://ddeonmadeit.github.io/pool/. The markup, the embedded lead data and the
whole filter/sort/track script are carried across untouched. This script only:

  1. wraps each in the dashboard's head + nav so they share the theme toggle,
  2. layers assets/pool-skin.css over its own stylesheet,
  3. adds a checkbox column and a selection bar so the addresses in the table —
     the ones ticked, or every row passing the current filters — can be copied
     out as plain lines or as CSV.

Usage: python3 scripts/build_pool.py [path/to/upstream/checkout]
Re-run after pulling a newer upstream.
"""
import os
import re
import sys

COLGROUP = """<colgroup>
        <col style="width:42px"><col style="width:19%"><col style="width:11%">
        <col style="width:9%"><col style="width:8%"><col style="width:6%">
        <col style="width:6%"><col style="width:5%"><col style="width:5%">
        <col style="width:5%"><col style="width:10%"><col style="width:11%">
        <col style="width:5%">
      </colgroup>"""

def pagehead(short_title, here):
    """Compact bold-caps page title, with the Pool Finder / Mail List
    sub-nav sitting right under it — in the spot the old H1 + lede used
    to occupy, on our filenames."""
    link = lambda href, label: \
        '<a href="%s"%s>%s</a>' % (href, ' class="on"' if here == href else "", label)
    return (
        '<div class="pagehead">\n'
        '  <p class="page-title">%s</p>\n'
        '  <nav class="pagenav" aria-label="Pool Finder pages">%s%s</nav>\n'
        '</div>\n\n'
    ) % (short_title,
         link("pool.html", "Pool Finder"), link("mail-list.html", "Mail List"))

WELL_HEAD_OLD = """  <div class="well-head">
    <span class="well-title">Outreach ledger &middot; NSW historical imagery 1978&ndash;2005</span>
    <span class="well-count" id="saved"></span>
  </div>"""

WELL_HEAD_NEW = """  <div class="well-head">
    <span class="well-title" id="sel-count">None ticked</span>
    <button type="button" class="key primary" id="copy-addr">Copy addresses</button>
    <button type="button" class="key" id="copy-addr-csv">Copy CSV</button>
    <button type="button" class="key" id="clear-sel">Untick</button>
    <span class="well-count" id="copy-note"></span>
    <span class="well-count" id="saved"></span>
  </div>"""

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
    selCount.textContent = n ? n.toLocaleString() + " ticked" : "None ticked";
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
    noteFlash("Unticked");
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

UP = sys.argv[1] if len(sys.argv) > 1 else "/home/user/ddeonmadeit/pool"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAG = os.path.join(ROOT, "scripts")


def once(haystack, needle, label):
    n = haystack.count(needle)
    if n != 1:
        raise SystemExit("expected 1 occurrence of %s upstream, found %d" % (label, n))


def vendor(src_name, out_name, short_title, desc, page_title):
    """Shared for both upstream pages: strip their chassis, keep everything else."""
    src = open(os.path.join(UP, src_name), encoding="utf-8").read()
    upstream_style = src[src.index("<style>"):src.index("</style>") + len("</style>")]

    body = src[src.index('<div class="shell">'):]
    # The nav fragment opens .shell; drop the vendored opener.
    body = body[len('<div class="shell">'):].lstrip("\n")

    # 1. the upstream chassis goes; the dashboard header replaces it, and the
    #    sub-nav it carried is rebuilt on our filenames.
    chassis = re.search(r'<div class="chassis">.*?</div>\n', body, re.S)
    if not chassis:
        raise SystemExit("%s: could not find the upstream .chassis block" % src_name)
    body = body[:chassis.start()] + pagehead(short_title, out_name) + body[chassis.end():]

    # 1b. Pool Finder only: the era/condition legend rows under the stats
    #     strip are dropped — informational clutter, not a control.
    if src_name == "index.html":
        legend = re.findall(r'<div class="legend">.*?</div>\n', body)
        if len(legend) != 2:
            raise SystemExit("expected 2 <div class=\"legend\"> rows upstream, found %d" % len(legend))
        for block in legend:
            body = body.replace(block, "", 1)

    # 2. the long explainer folds into a collapsible block
    foot = re.search(r"<footer>.*?</footer>", body, re.S)
    if not foot:
        raise SystemExit("%s: could not find the upstream <footer>" % src_name)
    inner = foot.group(0)[len("<footer>"):-len("</footer>")]
    body = (body[:foot.start()] +
            '<details class="note-block">\n'
            '  <summary>How this works</summary>\n'
            '  <div class="note-body">' + inner + '</div>\n'
            '</details>\n' +
            body[foot.end():])

    if src_name == "index.html":
        body = add_selection(body)

    head = (open(os.path.join(FRAG, "_head.html"), encoding="utf-8").read()
            .replace("__TITLE__", page_title).replace("__DESC__", desc))
    head = head.replace("</head>", upstream_style +
                        '\n<link rel="stylesheet" href="assets/pool-skin.css?v=4">\n</head>')
    nav = open(os.path.join(FRAG, "_nav.html"), encoding="utf-8").read()

    out = os.path.join(ROOT, out_name)
    # nav (from _nav.html) opens .app-shell/.sidebar/.main-col/.shell; body
    # closes .shell itself (see the note-block/</details> patch above), so
    # this only needs to close .main-col and .app-shell before the footer.
    open(out, "w", encoding="utf-8").write(
        head + nav + body + '\n</div>\n</div>\n<script src="assets/app.js?v=4"></script>\n</body>\n</html>\n')
    print("wrote %s (%.1f MB)" % (out_name, os.path.getsize(out) / 1e6))


def add_selection(body):
    """Pool Finder only: a tick column, and copying the addresses out."""
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

    once(body, WELL_HEAD_OLD, "well head")
    body = body.replace(WELL_HEAD_OLD, WELL_HEAD_NEW, 1)

    old_row = ("html += '<tr class=\"lead\" data-i=\"' + i + '\" data-s=\"' + stt + '\">' +\n"
               "        '<td><span class=\"addr\">'")
    if body.count(old_row) != 1:
        raise SystemExit("upstream row template changed; update build_pool.py")
    body = body.replace(old_row,
        ("html += '<tr class=\"lead\" data-i=\"' + i + '\" data-s=\"' + stt + '\">' +\n"
         "        '<td class=\"pick\"><input type=\"checkbox\" class=\"rowpick\"' +\n"
         "        (picked[i] ? ' checked' : '') + ' aria-label=\"Select ' + esc(d[A]) + '\"></td>' +\n"
         "        '<td><span class=\"addr\">'"), 1)

    tail = "\n  rebuild();\n})();\n</script>"
    once(body, tail, "script tail")
    return body.replace(tail, "\n" + SELECT_JS + tail, 1)


vendor("index.html", "pool.html", "POOL FINDER",
       "Sydney properties with a pool confirmed 20+ years old from NSW government "
       "aerial imagery — filter, select and copy addresses.",
       "Pool Finder")

vendor("mail-list.html", "mail-list.html", "MAIL LIST",
       "Mail-ready Sydney pool leads sorted into value bands for a physical-mail run.",
       "Mail List")
