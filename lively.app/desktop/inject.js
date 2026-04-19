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

  // Marker so node-main can detect whether we actually ran on this page.
  window.__LIVELY_INJECT_LOADED__ = Date.now();

  function dashboardUrl () {
    return (window.__LIVELY_DASHBOARD_URL__ || window.location.origin + '/dashboard/');
  }

  window.livelyNav = function (url) {
    console.log('[lively.app] livelyNav →', url);
    window.location.href = url;
  };

  window.addEventListener('keydown', function (e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      window.livelyNav(dashboardUrl());
    }
  });

  console.log('[lively.app] inject.js loaded');
})();
