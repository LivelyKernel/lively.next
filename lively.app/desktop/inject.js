// Injected into every page loaded in the NW.js window via inject_js_end.
//
// Exposes page-side helpers that the persistent background-page menu can call,
// and keeps a couple of keyboard shortcuts as a fallback on macOS.

(function () {
  'use strict';

  // Marker so node-main can verify inject_js_end is actually running.
  window.__LIVELY_INJECT_LOADED__ = Date.now();

  function resolveDashboardUrl () {
    if ((window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
        window.location.origin && window.location.origin !== 'null') {
      return window.location.origin + '/dashboard/';
    }

    const boot = window.livelyBoot;
    if (boot && typeof boot.dashboardUrl === 'string' && boot.dashboardUrl) {
      return boot.dashboardUrl;
    }

    return '';
  }

  function navigateToDashboard () {
    const url = resolveDashboardUrl();
    if (url) window.location.href = url;
  }

  function showDevTools () {
    if (!window.nw || !window.nw.Window) return;
    window.nw.Window.get().showDevTools();
  }

  window.livelyDesktop = {
    navigateToDashboard: navigateToDashboard,
    showDevTools: showDevTools
  };

  // Keyboard shortcut: Cmd/Ctrl + Shift + D → Dashboard.
  // Works from any page, regardless of menu/window focus — a reliable
  // fallback if the native menu hotkey fails to register.
  window.addEventListener('keydown', function (e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || !e.shiftKey) return;
    if (e.key === 'D' || e.key === 'd') {
      e.preventDefault();
      navigateToDashboard();
    }
  }, true);

  window.addEventListener('keydown', function (e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || !e.altKey) return;
    if (e.key === 'I' || e.key === 'i') {
      e.preventDefault();
      showDevTools();
    }
  }, true);
})();
