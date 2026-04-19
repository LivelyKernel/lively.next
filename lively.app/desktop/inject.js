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

  // Marker so node-main can verify inject_js_end is actually running.
  window.__LIVELY_INJECT_LOADED__ = Date.now();

  // node-main menu click handlers post a message rather than setting
  // location.href directly — assignment across the node↔DOM boundary is
  // unreliable in NW.js (broken since 0.12.x per nwjs/nw.js#4313). DOM
  // side picks up the message and navigates.
  window.addEventListener('message', function (ev) {
    const d = ev.data;
    if (d && d.type === 'lively-nav' && typeof d.url === 'string') {
      window.location.href = d.url;
    }
  });

  // Keyboard shortcut: Cmd/Ctrl + Shift + D → Dashboard.
  // Works from any page, regardless of menu/window focus — a reliable
  // fallback if the native menu hotkey fails to register.
  window.addEventListener('keydown', function (e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || !e.shiftKey) return;
    if (e.key === 'D' || e.key === 'd') {
      e.preventDefault();
      window.location.href = window.location.origin + '/dashboard/';
    }
  });
})();
