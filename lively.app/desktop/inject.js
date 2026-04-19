// Injected into every page loaded in the NW.js window via inject_js_end.
//
// Exposes window.livelyNav(url) so node-main menu click handlers can
// navigate the page by calling a plain function — reliable across the
// node↔DOM boundary — instead of assigning location.href from node
// context, which is flaky in NW.js.
//
// Also binds a few keyboard shortcuts that the native menu's `key`
// modifiers don't reliably pick up on macOS (Cmd+D / Cmd+R conflict
// with Chromium defaults; this runs before Chromium's bookmark/reload
// handlers and preventDefaults).

(function () {
  'use strict';

  // Navigation target stored by node-main before the window is shown;
  // inject.js falls back to location.origin if missing.
  function dashboardUrl () {
    return (window.__LIVELY_DASHBOARD_URL__ || window.location.origin + '/dashboard/');
  }

  window.livelyNav = function (url) {
    window.location.href = url;
  };

  window.addEventListener('keydown', function (e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    // Cmd/Ctrl + Shift + D → Dashboard (not conflicting with Chromium
    // bookmark add on Cmd+D).
    if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      window.livelyNav(dashboardUrl());
    }
  });
})();
