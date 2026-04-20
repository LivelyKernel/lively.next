// Injected into every page loaded in the NW.js window via inject_js_end.
//
// Installs the native menu from renderer context, where NW.js reliably
// dispatches callbacks, and binds keyboard shortcuts that the native
// menu's `key` modifiers don't consistently pick up on macOS.

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

  function installAppMenu () {
    if (!window.nw || !window.nw.Menu || !window.nw.MenuItem || !window.nw.Window) return;

    const menu = new window.nw.Menu({ type: 'menubar' });
    if (navigator.platform.includes('Mac')) {
      menu.createMacBuiltin('lively.next', { hideEdit: false });
    }

    const goMenu = new window.nw.Menu();
    const mod = navigator.platform.includes('Mac') ? 'cmd' : 'ctrl';
    goMenu.append(new window.nw.MenuItem({
      label: 'Dashboard',
      key: 'd',
      modifiers: mod + '+shift',
      click: navigateToDashboard
    }));
    goMenu.append(new window.nw.MenuItem({ type: 'separator' }));
    goMenu.append(new window.nw.MenuItem({
      label: 'Show DevTools',
      key: 'i',
      modifiers: mod + '+alt',
      click: showDevTools
    }));

    menu.append(new window.nw.MenuItem({ label: 'Go', submenu: goMenu }));
    window.nw.Window.get().menu = menu;
  }

  installAppMenu();

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
  });
})();
