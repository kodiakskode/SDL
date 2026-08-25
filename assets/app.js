/* Shared chrome: theme toggle, nav highlight, clipboard helper.
   Kept dependency-free so every page is a plain static file. */
(function () {
  "use strict";

  var KEY = "sdl-theme";

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

  function buildChrome() {
    var bar = document.querySelector(".topbar");
    if (!bar) return;
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    bar.querySelectorAll(".navlink").forEach(function (a) {
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
