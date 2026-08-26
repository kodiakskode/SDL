/* Leads table: any number of lists behind one dropdown, filtered and sorted
   client-side. architects/designers come from data/leads.json; anything
   imported via "Import CSV / Excel…" is parsed in the browser, kept in this
   device's localStorage (matching how the rest of the dashboard stores
   things), and — best effort, if the Outreach backend is reachable — synced
   there too so it shows up as a filterable list on the Outreach tab. */
(function () {
  "use strict";

  var CUSTOM_KEY = "sdl-custom-leads"; // localStorage: { [listId]: {label, note, rows, stats} }

  var DB = null;                 // { architects:{...}, designers:{...}, [customId]:{...} }
  var BUILTIN = { architects: 1, designers: 1 };
  var listKey = "architects";
  var view = [];                 // row objects passing the current filters
  var sel = Object.create(null); // key -> true, kept across filter changes
  var sortKey = "org", sortDir = 1;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    list: $("f-list"), q: $("q"), region: $("f-region"), contact: $("f-contact"),
    status: $("f-status"), tbody: $("tb"), empty: $("empty"), tally: $("tally"),
    note: $("note"), selCount: $("sel-count"), all: $("check-all"),
    kTotal: $("k-total"), kEmail: $("k-email"), kPhone: $("k-phone"), kShown: $("k-shown"),
    importBtn: $("import-list"), importFile: $("import-file"), importNote: $("import-note"),
    deleteBtn: $("delete-list")
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
    el.selCount.textContent = n ? n.toLocaleString() + " ticked" : "None ticked";
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

  /* ── custom (imported) lists ──────────────────────────────────── */
  function loadCustom() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveCustom(custom) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); } catch (e) {}
  }

  function slugify(title) {
    var s = String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return (s || "list").slice(0, 60);
  }

  function statsFor(rowsArr) {
    var withEmail = 0, withPhone = 0;
    rowsArr.forEach(function (r) { if (r.email) withEmail++; if (r.phone) withPhone++; });
    return { total: rowsArr.length, withEmail: withEmail, withPhone: withPhone, withWeb: 0 };
  }

  function addCustomListOption(id, label) {
    var opt = document.createElement("option");
    opt.value = id; opt.textContent = label;
    el.list.appendChild(opt);
  }

  function loadAllCustomIntoDB() {
    var custom = loadCustom();
    Object.keys(custom).forEach(function (id) {
      DB[id] = custom[id];
      addCustomListOption(id, custom[id].label);
    });
  }

  /* ── file parsing ─────────────────────────────────────────────── */
  function parseCSV(text) {
    // Hand-rolled RFC4180-ish parser: quoted fields, escaped "" quotes,
    // commas/newlines inside quotes, \r\n or \n line endings.
    var rows = [], row = [], field = "", inQuotes = false, i = 0, n = text.length;
    while (i < n) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || r[0] !== ""; });
  }

  var HEADER_ALIASES = {
    org:      ["business", "business name", "company", "organisation", "organization", "org", "employer"],
    name:     ["name", "full name", "contact", "contact name", "person"],
    email:    ["email", "e-mail", "email address", "contact email"],
    phone:    ["phone", "telephone", "mobile", "contact number", "phone number", "tel"],
    suburb:   ["suburb", "city", "town", "address", "location"],
    postcode: ["postcode", "post code", "zip", "zip code"],
    region:   ["region", "state", "area"],
    website:  ["website", "url", "web", "site", "web site"],
    type:     ["type", "category", "industry", "role"],
    status:   ["status"]
  };

  function mapHeaders(headers) {
    var norm = headers.map(function (h) { return String(h || "").trim().toLowerCase(); });
    var map = {}; // field -> column index
    Object.keys(HEADER_ALIASES).forEach(function (field) {
      var aliases = HEADER_ALIASES[field];
      for (var i = 0; i < norm.length; i++) {
        if (aliases.indexOf(norm[i]) !== -1 && map[field] === undefined) { map[field] = i; break; }
      }
    });
    return map;
  }

  function rowsFromTable(table) {
    // table: array of arrays, first row = headers
    if (!table.length) return [];
    var headers = table[0], map = mapHeaders(headers);
    var hasAnyMap = Object.keys(map).length > 0;
    var body = table.slice(1);

    // No recognisable headers and exactly one column: treat every non-empty
    // cell (including the first row) as a bare email/name list.
    if (!hasAnyMap && headers.length === 1) {
      return table.filter(function (r) { return r[0] && r[0].trim(); }).map(function (r) {
        var v = r[0].trim();
        return /@/.test(v) ? { email: v } : { org: v };
      });
    }

    return body.map(function (r) {
      var out = {};
      Object.keys(map).forEach(function (field) {
        var v = r[map[field]];
        if (v != null && String(v).trim()) out[field] = String(v).trim();
      });
      return out;
    }).filter(function (o) { return Object.keys(o).length > 0; });
  }

  function rowsFromXlsx(workbook) {
    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    var table = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
    return rowsFromTable(table);
  }

  function toLeadRow(raw, i) {
    return {
      name: raw.name || "", org: raw.org || (raw.name ? "" : ""), suburb: raw.suburb || "",
      postcode: raw.postcode || "", region: raw.region || "Imported",
      email: raw.email || "", phone: raw.phone || "", website: raw.website || "",
      ref: "", type: raw.type || "Imported contact",
      status: raw.status || "Unverified", statusNote: "From an imported CSV/Excel file",
      source: ""
    };
  }

  function apiBase() {
    return window.SDL_OUTREACH_API_BASE || "https://sdl.helixsolution.au/rawleads/api";
  }

  function syncImportToBackend(title, rawRows) {
    // Best effort — the outreach backend may not be deployed/reachable yet.
    // Local storage above is the source of truth for this page either way.
    fetch(apiBase() + "/leads/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        rows: rawRows.map(function (r) {
          return {
            business_name: r.org || r.name || "", email: r.email || "", phone: r.phone || "",
            address: [r.suburb, r.postcode].filter(Boolean).join(" "),
            industry: r.type || "", location: r.region || "", website: r.website || ""
          };
        })
      })
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function () {
        SDL.flash(el.importNote, "Imported — also synced to the Outreach tab");
      })
      .catch(function () {
        SDL.flash(el.importNote, "Imported — saved on this device (Outreach server not reachable to sync)");
      });
  }

  function handleImport(file) {
    var title = window.prompt("Title for this list (e.g. “Referral partners 2026”):", file.name.replace(/\.[^.]+$/, ""));
    if (!title || !title.trim()) return;
    title = title.trim();

    var isExcel = /\.(xlsx|xls)$/i.test(file.name);
    var reader = new FileReader();
    reader.onerror = function () { SDL.flash(el.importNote, "Could not read that file"); };
    reader.onload = function () {
      var raw;
      try {
        if (isExcel) {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
          raw = rowsFromXlsx(wb);
        } else {
          raw = rowsFromTable(parseCSV(String(reader.result)));
        }
      } catch (e) {
        SDL.flash(el.importNote, "Could not parse that file — is it a valid CSV/Excel file?");
        return;
      }
      if (!raw.length) { SDL.flash(el.importNote, "No rows found in that file"); return; }

      var rowsArr = raw.map(toLeadRow);
      var custom = loadCustom();
      var id = "custom-" + slugify(title);
      if (custom[id] || BUILTIN[id]) {
        var n = 2;
        while (custom["custom-" + slugify(title) + "-" + n] || BUILTIN["custom-" + slugify(title) + "-" + n]) n++;
        id = "custom-" + slugify(title) + "-" + n;
      }

      var entry = {
        label: title, note: rowsArr.length + " contacts imported from " + file.name + ".",
        rows: rowsArr, stats: statsFor(rowsArr)
      };
      custom[id] = entry;
      saveCustom(custom);

      DB[id] = entry;
      addCustomListOption(id, title);
      el.list.value = id;
      listKey = id;
      el.region.value = ""; el.status.value = "";
      fillRegions(); fillStatuses();
      document.getElementById("list-note").textContent = entry.note;
      el.deleteBtn.hidden = false;
      rebuild();

      SDL.flash(el.importNote, rowsArr.length + " contacts imported as “" + title + "”");
      syncImportToBackend(title, raw);
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }

  function deleteCurrentList() {
    if (BUILTIN[listKey]) return;
    if (!window.confirm('Delete the list "' + DB[listKey].label + '"? This only removes it from this device.')) return;
    var id = listKey;
    var custom = loadCustom();
    delete custom[id];
    saveCustom(custom);
    delete DB[id];
    var opt = el.list.querySelector('option[value="' + id.replace(/"/g, '\\"') + '"]');
    if (opt) opt.remove();

    // best effort backend cleanup too
    fetch(apiBase() + "/leads/lists/" + encodeURIComponent(id), { method: "DELETE" }).catch(function () {});

    listKey = "architects";
    el.list.value = listKey;
    el.deleteBtn.hidden = true;
    el.region.value = ""; el.status.value = "";
    fillRegions(); fillStatuses();
    document.getElementById("list-note").textContent = DB[listKey].note;
    rebuild();
  }

  function wire() {
    el.list.addEventListener("change", function () {
      listKey = el.list.value;
      el.deleteBtn.hidden = !!BUILTIN[listKey];
      el.region.value = ""; el.status.value = "";
      fillRegions(); fillStatuses();
      document.getElementById("list-note").textContent = DB[listKey].note;
      rebuild();
    });

    el.importBtn.addEventListener("click", function () { el.importFile.click(); });
    el.importFile.addEventListener("change", function () {
      var f = el.importFile.files && el.importFile.files[0];
      el.importFile.value = ""; // allow re-selecting the same file later
      if (f) handleImport(f);
    });
    el.deleteBtn.addEventListener("click", deleteCurrentList);

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
      SDL.flash(el.note, "Unticked");
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
      loadAllCustomIntoDB();
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
