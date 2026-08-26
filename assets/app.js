/* Shared chrome: theme toggle, nav highlight, clipboard helper.
   Kept dependency-free so every page is a plain static file. */
(function () {
  "use strict";

  var KEY = "sdl-theme";
  var SIDEBAR_KEY = "sdl-sidebar";

  /* Theme is resolved before first paint by the inline snippet in each page;
     this only wires the control and keeps the two in sync. */
  function current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode */ }
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
      btn.setAttribute("aria-label",
        mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
      var knob = btn.querySelector(".knob");
      if (knob) knob.textContent = mode === "dark" ? "\u263E" : "\u2600";
    }
  }

  /* Sidebar open/closed is likewise resolved before first paint; this wires
     the logo button that toggles it and keeps the two in sync. */
  function sidebarState() {
    return document.documentElement.getAttribute("data-sidebar") === "collapsed"
      ? "collapsed" : "open";
  }

  function applySidebar(state) {
    if (state === "collapsed") {
      document.documentElement.setAttribute("data-sidebar", "collapsed");
    } else {
      document.documentElement.removeAttribute("data-sidebar");
    }
    try { localStorage.setItem(SIDEBAR_KEY, state); } catch (e) { /* private mode */ }
    var btn = document.getElementById("sidebar-toggle");
    if (btn) btn.setAttribute("aria-expanded", state === "open" ? "true" : "false");
  }

  function buildChrome() {
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".sidebar-nav .navlink").forEach(function (a) {
      var target = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
      if (target === here || (here === "" && target === "index.html")) {
        a.setAttribute("aria-current", "page");
      }
    });
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        apply(current() === "dark" ? "light" : "dark");
      });
    }
    apply(current());

    var sidebarBtn = document.getElementById("sidebar-toggle");
    if (sidebarBtn) {
      sidebarBtn.addEventListener("click", function () {
        applySidebar(sidebarState() === "collapsed" ? "open" : "collapsed");
      });
    }
    applySidebar(sidebarState());
  }

  /* Clipboard with a fallback for browsers that block the async API on
     file:// or without a user-gesture chain. Returns a promise of boolean. */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; }, function () { return legacy(text); });
    }
    return Promise.resolve(legacy(text));
  }

  function legacy(text) {
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

  window.SDL = {
    copy: copy,
    /* Transient status message in an element, cleared after a beat. */
    flash: function (el, msg, ms) {
      if (!el) return;
      el.textContent = msg;
      clearTimeout(el._flashT);
      el._flashT = setTimeout(function () { el.textContent = ""; }, ms || 2600);
    },
    esc: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildChrome);
  } else {
    buildChrome();
  }
})();
