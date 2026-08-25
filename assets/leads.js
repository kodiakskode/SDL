/* Leads table: two lists behind one dropdown, filtered and sorted client-side.
   750 rows per list renders fast enough without virtualisation. */
(function () {
  "use strict";

  var DB = null;                 // { architects:{...}, designers:{...} }
  var listKey = "architects";
  var view = [];                 // row objects passing the current filters
  var sel = Object.create(null); // key -> true, kept across filter changes
  var sortKey = "org", sortDir = 1;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    list: $("f-list"), q: $("q"), region: $("f-region"), contact: $("f-contact"),
    status: $("f-status"), tbody: $("tb"), empty: $("empty"), tally: $("tally"),
    note: $("note"), selCount: $("sel-count"), all: $("check-all"),
    kTotal: $("k-total"), kEmail: $("k-email"), kPhone: $("k-phone"), kShown: $("k-shown")
  };

  function rows() { return DB[listKey].rows; }
  function keyOf(r) { return listKey + "|" + (r.ref || "") + "|" + r.name + "|" + r.org; }

  function selectedRows() {
    var out = view.filter(function (r) { return sel[keyOf(r)]; });
    return out.length ? out : view;   // nothing ticked = act on the whole filtered set
  }

  function fillRegions() {
    var seen = {}, list = [];
    rows().forEach(function (r) {
      if (r.region && !seen[r.region]) { seen[r.region] = 1; list.push(r.region); }
    });
    list.sort();
    el.region.innerHTML = '<option value="">All regions</option>' +
      list.map(function (r) {
        return '<option value="' + SDL.esc(r) + '">' + SDL.esc(r) + '</option>';
      }).join("");
  }

  function fillStatuses() {
    var seen = {}, list = [];
    rows().forEach(function (r) {
      if (r.status && !seen[r.status]) { seen[r.status] = 1; list.push(r.status); }
    });
    list.sort();
    el.status.innerHTML = '<option value="">Any status</option>' +
      list.map(function (s) {
        return '<option value="' + SDL.esc(s) + '">' + SDL.esc(s) + '</option>';
      }).join("");
  }

  function rebuild() {
    var term = el.q.value.trim().toLowerCase();
    var reg = el.region.value, con = el.contact.value, st = el.status.value;
    var out = rows().filter(function (r) {
      if (reg && r.region !== reg) return false;
      if (st && r.status !== st) return false;
      if (con === "email" && !r.email) return false;
      if (con === "phone" && !r.phone) return false;
      if (con === "both" && !(r.email && r.phone)) return false;
      if (con === "web" && !r.website) return false;
      if (term) {
        var hay = (r.name + " " + r.org + " " + r.suburb + " " + r.postcode + " " +
                   r.region + " " + r.email + " " + r.phone).toLowerCase();
        if (hay.indexOf(term) === -1) return false;
      }
      return true;
    });

    var dir = sortDir;
    out.sort(function (a, b) {
      var x = a[sortKey] || "", y = b[sortKey] || "";
      // Blanks always sink, whichever way the column is pointing.
      if (!x && y) return 1;
      if (x && !y) return -1;
      return x < y ? -dir : x > y ? dir : 0;
    });

    view = out;
    render();
    counts();
  }

  function render() {
    var html = view.map(function (r) {
      var k = keyOf(r);
      var web = r.website
        ? '<a href="' + SDL.esc(r.website) + '" target="_blank" rel="noopener">site</a>'
        : '<span class="dim">&mdash;</span>';
      var mail = r.email
        ? '<a href="mailto:' + SDL.esc(r.email) + '">' + SDL.esc(r.email) + '</a>'
        : '<span class="dim">&mdash;</span>';
      var phone = r.phone
        ? '<a href="tel:' + SDL.esc(r.phone.replace(/\s/g, "")) + '">' + SDL.esc(r.phone) + '</a>'
        : '<span class="dim">&mdash;</span>';
      var tagClass = /evidenced|Practising \/ Active/.test(r.status) ? "pill" : "pill muted";
      var tag = '<span class="' + tagClass + '" title="' + SDL.esc(r.statusNote || r.status) + '">' +
        SDL.esc(shortStatus(r.status)) + '</span>';
      var place = SDL.esc(r.suburb || "—") + (r.postcode ? " " + SDL.esc(r.postcode) : "");
      return '<tr data-k="' + SDL.esc(k) + '">' +
        '<td class="pick"><input type="checkbox" class="rowpick" ' +
          (sel[k] ? "checked " : "") + 'aria-label="Select ' + SDL.esc(r.name || r.org) + '"></td>' +
        '<td><span class="strong">' + SDL.esc(r.org || r.name || "—") + '</span>' +
          '<span class="sub">' + SDL.esc(r.org ? (r.name || r.type) : r.type) + '</span></td>' +
        '<td><span class="strong">' + place + '</span>' +
          '<span class="sub">' + SDL.esc(r.region || "") + '</span></td>' +
        '<td class="mono small">' + phone + '</td>' +
        '<td class="mono small ell">' + mail + '</td>' +
        '<td class="mono small">' + web + '</td>' +
        '<td>' + tag + '</td></tr>';
    }).join("");
    el.tbody.innerHTML = html;
    el.empty.hidden = view.length !== 0;
    syncAll();
  }

  function shortStatus(s) {
    if (!s) return "—";
    if (s.indexOf("evidenced") > -1) return "LDI / AILDM";
    if (s.indexOf("unverified") > -1) return "Unverified";
    return s.replace(" / Active", "");
  }

  function counts() {
    var d = DB[listKey].stats;
    el.kTotal.textContent = d.total.toLocaleString();
    el.kEmail.textContent = d.withEmail.toLocaleString();
    el.kPhone.textContent = d.withPhone.toLocaleString();
    el.kShown.textContent = view.length.toLocaleString();
    el.tally.textContent = view.length.toLocaleString() + " of " +
      d.total.toLocaleString() + " shown";
    var n = view.filter(function (r) { return sel[keyOf(r)]; }).length;
    el.selCount.textContent = n ? n.toLocaleString() + " selected" : "none selected";
  }

  function syncAll() {
    var picked = view.filter(function (r) { return sel[keyOf(r)]; }).length;
    el.all.checked = view.length > 0 && picked === view.length;
    el.all.indeterminate = picked > 0 && picked < view.length;
  }

  /* ── copying ──────────────────────────────────────────────────── */
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }

  function doCopy(text, label) {
    if (!text) { SDL.flash(el.note, "Nothing to copy"); return; }
    SDL.copy(text).then(function (ok) {
      SDL.flash(el.note, ok ? label : "Clipboard blocked by browser");
    });
  }

  function wire() {
    el.list.addEventListener("change", function () {
      listKey = el.list.value;
      el.region.value = ""; el.status.value = "";
      fillRegions(); fillStatuses();
      document.getElementById("list-note").textContent = DB[listKey].note;
      rebuild();
    });

    [el.q, el.region, el.contact, el.status].forEach(function (c) {
      c.addEventListener("input", rebuild);
      c.addEventListener("change", rebuild);
    });

    document.getElementById("reset").addEventListener("click", function () {
      el.q.value = ""; el.region.value = ""; el.contact.value = ""; el.status.value = "";
      rebuild();
    });

    el.tbody.addEventListener("change", function (ev) {
      if (!ev.target.classList.contains("rowpick")) return;
      var k = ev.target.closest("tr").dataset.k;
      if (ev.target.checked) sel[k] = true; else delete sel[k];
      counts(); syncAll();
    });

    el.all.addEventListener("change", function () {
      var on = el.all.checked;
      view.forEach(function (r) {
        var k = keyOf(r);
        if (on) sel[k] = true; else delete sel[k];
      });
      render(); counts();
    });

    document.getElementById("clear-sel").addEventListener("click", function () {
      sel = Object.create(null);
      render(); counts();
      SDL.flash(el.note, "Selection cleared");
    });

    document.querySelectorAll("th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.sort;
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
        document.querySelectorAll("th .ind").forEach(function (s) { s.textContent = ""; });
        var ind = th.querySelector(".ind");
        if (ind) ind.textContent = sortDir < 0 ? "▼" : "▲";
        rebuild();
      });
    });

    document.getElementById("copy-email").addEventListener("click", function () {
      var set = selectedRows();
      var seen = {}, mails = [];
      set.forEach(function (r) {
        if (r.email && !seen[r.email]) { seen[r.email] = 1; mails.push(r.email); }
      });
      doCopy(mails.join(", "), mails.length + " email addresses copied");
    });

    document.getElementById("copy-phone").addEventListener("click", function () {
      var set = selectedRows();
      var seen = {}, out = [];
      set.forEach(function (r) {
        if (r.phone && !seen[r.phone]) { seen[r.phone] = 1; out.push(r.phone); }
      });
      doCopy(out.join("\n"), out.length + " phone numbers copied");
    });

    document.getElementById("copy-csv").addEventListener("click", function () {
      var set = selectedRows();
      var head = ["name", "business", "suburb", "postcode", "region",
                  "phone", "email", "website", "category", "status"];
      var lines = [head.map(csvCell).join(",")];
      set.forEach(function (r) {
        lines.push([r.name, r.org, r.suburb, r.postcode, r.region,
                    r.phone, r.email, r.website, r.type, r.status]
                   .map(csvCell).join(","));
      });
      doCopy(lines.join("\n"), set.length + " rows copied as CSV");
    });
  }

  fetch("data/leads.json")
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (d) {
      DB = d;
      fillRegions(); fillStatuses();
      document.getElementById("list-note").textContent = DB[listKey].note;
      wire();
      rebuild();
    })
    .catch(function () {
      el.empty.hidden = false;
      el.empty.textContent =
        "Could not load data/leads.json. Open this page over http:// (or on GitHub Pages) — " +
        "browsers block file:// fetches.";
    });
})();
