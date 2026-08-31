/* Inline-SVG charts for the dashboard. No libraries, no build step — the site
   is static and stays that way.

   Colours come from CSS custom properties so both themes work from one render
   path, and every palette in theme.css was checked with the dataviz validator
   (lightness band, chroma floor, CVD separation, normal-vision floor, contrast)
   rather than picked by eye.

   Tooltips enhance but never gate: every value is also in the table view under
   each chart, so nothing needs a pointer to be readable. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* $128K / $1.4M — proportional figures, compact. */
  function money(v) {
    var a = Math.abs(v);
    if (a >= 1000000) return "$" + (v / 1000000).toFixed(a % 1000000 === 0 ? 0 : 1) + "M";
    if (a >= 1000) return "$" + Math.round(v / 1000) + "K";
    return "$" + Math.round(v);
  }

  function moneyFull(v) {
    return "$" + Math.round(v).toLocaleString("en-AU");
  }

  /* "2026-08" -> "Aug 26" */
  function monthLabel(m) {
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var p = String(m).split("-");
    return (MONTHS[+p[1] - 1] || p[1]) + " " + String(p[0]).slice(2);
  }

  /* Axis ticks on clean round numbers, so they can carry the values that are
     not directly labelled. */
  function ticks(max, count) {
    var raw = max / count;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var step = mag * 10;
    [1, 2, 2.5, 4, 5, 10].some(function (m) {
      if (mag * m >= raw) { step = mag * m; return true; }
      return false;
    });
    // Run past max, never up to it — stopping early puts the top gridline
    // below the highest point and the line overshoots the plot.
    var out = [];
    for (var v = 0; ; v += step) {
      out.push(v);
      if (v >= max) break;
    }
    return out;
  }

  /* ── shared tooltip ─────────────────────────────────────────────
     One node, moved around. Labels go in via textContent — series and
     bucket names arrive from a JSON feed and are not trusted markup. */
  var tip;
  function tooltip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.setAttribute("role", "status");
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  function showTip(html_rows, title, x, y) {
    var t = tooltip();
    t.textContent = "";
    var h = document.createElement("div");
    h.className = "chart-tip-title";
    h.textContent = title;
    t.appendChild(h);
    html_rows.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "chart-tip-row";
      var key = document.createElement("span");
      key.className = "chart-tip-key" + (r.dash ? " dash" : "");
      key.style.color = r.color;
      if (!r.dash) key.style.background = r.color;
      var val = document.createElement("b");
      val.textContent = r.value;              // value leads
      var name = document.createElement("span");
      name.className = "chart-tip-name";
      name.textContent = r.name;              // label follows
      row.appendChild(key); row.appendChild(val); row.appendChild(name);
      t.appendChild(row);
    });
    t.hidden = false;
    var w = t.offsetWidth, vh = t.offsetHeight;
    var left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
    var top = y - vh - 14;
    if (top < 8) top = y + 18;
    t.style.left = left + "px";
    t.style.top = top + "px";
  }

  function hideTip() { if (tip) tip.hidden = true; }

  /* ── line chart: two series over time ──────────────────────────
     Crosshair snaps to the nearest month and the readout lists both series,
     so the pointer never has to land on a 2px stroke. */
  function lineChart(host, cfg) {
    host.textContent = "";
    var W = host.clientWidth || 560, H = cfg.height || 220;
    var m = { t: 16, r: 62, b: 26, l: 48 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var max = 0;
    cfg.rows.forEach(function (r) {
      cfg.series.forEach(function (s) { max = Math.max(max, r[s.key]); });
    });
    var tk = ticks(max, 4);
    var top = tk[tk.length - 1];

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%", height: H,
      role: "img", "aria-label": cfg.title
    });

    var x = function (i) {
      return m.l + (cfg.rows.length === 1 ? iw / 2 : (i / (cfg.rows.length - 1)) * iw);
    };
    var y = function (v) { return m.t + ih - (v / top) * ih; };

    // gridlines — hairline, solid, recessive
    tk.forEach(function (v) {
      svg.appendChild(el("line", {
        x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v),
        stroke: css("--c-grid"), "stroke-width": 1
      }));
      var lab = el("text", {
        x: m.l - 8, y: y(v) + 3, "text-anchor": "end",
        class: "chart-axis"
      });
      lab.textContent = v === 0 ? "0" : money(v);
      svg.appendChild(lab);
    });

    /* x labels — every other month so they never collide. The stride is
       anchored to the LAST row, not the first: anchoring to the first and
       then force-adding the final label (the previous approach) puts two
       labels side by side whenever the count is even, which overlapped
       "Jul 26" and "Aug 26" at phone widths. This way the newest month is
       always labelled and spacing stays even. */
    cfg.rows.forEach(function (r, i) {
      if ((cfg.rows.length - 1 - i) % 2 !== 0) return;
      var lab = el("text", {
        x: x(i), y: H - 8, "text-anchor": "middle", class: "chart-axis"
      });
      lab.textContent = monthLabel(r.m);
      svg.appendChild(lab);
    });

    var crosshair = el("line", {
      y1: m.t, y2: m.t + ih, stroke: css("--c-grid"),
      "stroke-width": 1, opacity: 0
    });
    svg.appendChild(crosshair);

    // lines: 2px, round join/cap. Every series here is a shade of the same
    // green, so the second line also carries a dash pattern — a channel
    // besides hue for telling two close or crossing lines apart.
    cfg.series.forEach(function (s, si) {
      var d = cfg.rows.map(function (r, i) {
        return (i ? "L" : "M") + x(i) + " " + y(r[s.key]);
      }).join(" ");
      svg.appendChild(el("path", {
        d: d, fill: "none", stroke: css(s.color), "stroke-width": 2,
        "stroke-linejoin": "round", "stroke-linecap": "round",
        "stroke-dasharray": si % 2 ? "6 4" : null
      }));
    });

    // end markers (r>=4) with a 2px surface ring, plus one direct end-label each
    var ends = cfg.series.map(function (s) {
      var last = cfg.rows[cfg.rows.length - 1];
      return { s: s, v: last[s.key], y: y(last[s.key]) };
    }).sort(function (a, b) { return a.y - b.y; });

    // nudge apart only if they would overlap, and keep the marker on the line
    if (ends.length === 2 && ends[1].y - ends[0].y < 13) {
      ends[0].ly = ends[0].y - 6; ends[1].ly = ends[1].y + 7;
    } else {
      ends.forEach(function (e) { e.ly = e.y + 3; });
    }

    ends.forEach(function (e) {
      svg.appendChild(el("circle", {
        cx: x(cfg.rows.length - 1), cy: e.y, r: 4.5,
        fill: css(e.s.color), stroke: css("--c-surface"), "stroke-width": 2
      }));
      var lab = el("text", {
        x: x(cfg.rows.length - 1) + 10, y: e.ly, class: "chart-endlabel"
      });
      lab.textContent = money(e.v);
      svg.appendChild(lab);
    });

    // hover layer — one hit band per month, far wider than the marks
    var hot = el("g", {});
    cfg.rows.forEach(function (r, i) {
      var bw = iw / cfg.rows.length;
      var rect = el("rect", {
        x: x(i) - bw / 2, y: m.t, width: bw, height: ih,
        fill: "transparent", tabindex: 0, role: "button",
        "aria-label": monthLabel(r.m) + ": " + cfg.series.map(function (s) {
          return s.name + " " + moneyFull(r[s.key]);
        }).join(", ")
      });
      function enter(ev) {
        crosshair.setAttribute("opacity", 1);
        crosshair.setAttribute("x1", x(i));
        crosshair.setAttribute("x2", x(i));
        var box = host.getBoundingClientRect();
        var scale = box.width / W;
        showTip(cfg.series.map(function (s, si) {
          return { name: s.name, value: moneyFull(r[s.key]), color: css(s.color), dash: si % 2 === 1 };
        }), monthLabel(r.m),
          box.left + x(i) * scale,
          box.top + Math.min(y(r[cfg.series[0].key]), y(r[cfg.series[1].key])) * scale);
      }
      function leave() { crosshair.setAttribute("opacity", 0); hideTip(); }
      rect.addEventListener("pointerenter", enter);
      rect.addEventListener("pointermove", enter);
      rect.addEventListener("pointerleave", leave);
      rect.addEventListener("focus", enter);
      rect.addEventListener("blur", leave);
      hot.appendChild(rect);
    });
    svg.appendChild(hot);
    host.appendChild(svg);
  }

  /* ── ordinal bar chart ─────────────────────────────────────────
     Ageing buckets are ordinal — swapping their order would change the
     meaning — so they take one hue in monotone lightness steps, not
     categorical hues. */
  function barChart(host, cfg) {
    host.textContent = "";
    var rows = cfg.rows;
    var max = rows.reduce(function (a, r) { return Math.max(a, r.value); }, 0);
    var frag = document.createDocumentFragment();

    rows.forEach(function (r, i) {
      var row = document.createElement("div");
      row.className = "bar-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", r.label + ": " + moneyFull(r.value));

      var lab = document.createElement("span");
      lab.className = "bar-label";
      lab.textContent = r.label;

      var track = document.createElement("span");
      track.className = "bar-track";
      var fill = document.createElement("span");
      fill.className = "bar-fill";
      fill.style.width = max ? (r.value / max) * 100 + "%" : "0%";
      fill.style.background = css(cfg.ramp[i] || cfg.ramp[cfg.ramp.length - 1]);
      track.appendChild(fill);

      var val = document.createElement("span");
      val.className = "bar-value";
      val.textContent = money(r.value);

      row.appendChild(lab); row.appendChild(track); row.appendChild(val);

      function enter() {
        var b = row.getBoundingClientRect();
        showTip([{ name: cfg.seriesName, value: moneyFull(r.value),
                   color: css(cfg.ramp[i] || cfg.ramp[0]) }],
                r.label, b.left + b.width / 2, b.top);
      }
      row.addEventListener("pointerenter", enter);
      row.addEventListener("pointerleave", hideTip);
      row.addEventListener("focus", enter);
      row.addEventListener("blur", hideTip);
      frag.appendChild(row);
    });
    host.appendChild(frag);
  }

  window.SDLCharts = {
    lineChart: lineChart, barChart: barChart,
    money: money, moneyFull: moneyFull, monthLabel: monthLabel
  };
})();
