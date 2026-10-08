// Injected into every page loaded in the NW.js window via inject_js_end.
//
// Exposes page-side helpers that the persistent background-page menu can call,
// and keeps a couple of keyboard shortcuts as a fallback on macOS.

(function () {
  'use strict';

  // Marker so node-main can verify inject_js_end is actually running.
  window.__LIVELY_INJECT_LOADED__ = Date.now();
  window.__LIVELY_DESKTOP_APP__ = true;

  function resolveDashboardUrl () {
    if (window.livelyNative) return livelyNative.dashboardURL;
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
    try {
      if (!window.nw || !window.nw.Window) return false;
      window.nw.Window.get().showDevTools();
      return true;
    } catch (_) {
      return false;
    }
  }

  function showDesktopMessage (title, message) {
    window.alert([title, message].filter(Boolean).join('\n\n'));
  }

  function confirmDesktopAction (title, message) {
    return window.confirm([title, message].filter(Boolean).join('\n\n'));
  }

  window.livelyDesktop = {
    navigateToDashboard: navigateToDashboard,
    showDevTools: showDevTools,
    showDesktopMessage: showDesktopMessage,
    confirmDesktopAction: confirmDesktopAction
  };

  // The transparent frame lets the dashboard and the world's toolbar paint
  // behind the window controls. Reserve its height in the existing toolbar.
  function installTitlebar () {
    const mac = navigator.platform.startsWith('Mac');
    const height = 32;
    window.livelyDesktop.titlebarHeight = height;
    const style = document.createElement('style');
    style.textContent = `
      #lively-desktop-titlebar {
        position: fixed; inset: 0 0 auto; height: ${height}px; z-index: 2147483647;
        display: flex; align-items: center; gap: 4px; padding: 0 8px;
        background: transparent; color: #292929; font: 13px system-ui, sans-serif;
        user-select: none; -webkit-app-region: drag;
      }
      #lively-desktop-titlebar .window-title {
        position: absolute; inset: 0 128px; line-height: ${height}px; text-align: center;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;
      }
      #lively-desktop-titlebar .window-controls { display: flex; margin-left: auto; }
      #lively-desktop-titlebar button {
        -webkit-app-region: no-drag; border: 0; background: transparent; color: inherit;
        font: inherit; width: 36px; height: 28px; border-radius: 4px; padding: 0;
      }
      #lively-desktop-titlebar:not(.mac) button:hover { background: rgba(0,0,0,.12); }
      #lively-desktop-titlebar button:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
      #lively-desktop-titlebar:not(.mac) button[data-action=close]:hover { background: #c42b1c; color: white; }
      #lively-desktop-titlebar[data-inactive] { color: #484848; }
      #lively-desktop-titlebar.mac .window-controls { order: -1; margin: 0 auto 0 0; }
      #lively-desktop-titlebar.mac button {
        position: relative; width: 20px; height: 28px; border-radius: 0;
        background: transparent; color: #292929; font: 12px/12px system-ui, sans-serif;
      }
      #lively-desktop-titlebar.mac button::before {
        content: ''; position: absolute; width: 12px; height: 12px; top: 8px; left: 4px;
        box-sizing: border-box; border: 1px solid rgba(0,0,0,.15); border-radius: 50%;
      }
      #lively-desktop-titlebar.mac button[data-action=close]::before { background: #ff5f57; }
      #lively-desktop-titlebar.mac button[data-action=minimize]::before { background: #febc2e; }
      #lively-desktop-titlebar.mac button[data-action=maximize]::before { background: #28c840; }
      #lively-desktop-titlebar.mac[data-inactive] button::before { background: #b8b8b8; }
      #lively-desktop-titlebar.mac button span { position: relative; opacity: 0; }
      #lively-desktop-titlebar.mac .window-controls:hover button span { opacity: .55; }
      #lively-desktop-titlebar.mac button:focus-visible span { opacity: 1; }
    `;
    document.head.appendChild(style);
    const titlebar = document.createElement('header');
    titlebar.id = 'lively-desktop-titlebar';
    if (mac) titlebar.className = 'mac';
    const title = document.createElement('span');
    title.className = 'window-title';
    titlebar.appendChild(title);
    window.livelyDesktop.setTitle = text => {
      title.textContent = text;
      // NW.js 0.111.1 draws a clipped native caption even with frame: false
      // on macOS (nwjs/nw.js#8364). Empty titles fall back to the manifest title.
      document.title = mac ? '\u200b' : text;
    };
    window.livelyDesktop.setTitle(document.title || 'lively.next');
    const controls = document.createElement('div');
    controls.className = 'window-controls';
    function button (parent, action, label, symbol, callback) {
      const element = document.createElement('button');
      element.type = 'button';
      element.dataset.action = action;
      element.title = label;
      element.setAttribute('aria-label', label);
      const glyph = document.createElement('span');
      glyph.textContent = symbol;
      element.appendChild(glyph);
      element.addEventListener('click', callback);
      parent.appendChild(element);
      return element;
    }
    if (!mac) button(titlebar, 'menu', 'Go menu', 'Go', () => {
      const menu = window.livelyDesktop.menu;
      if (menu) menu.popup(8, height);
    });
    titlebar.appendChild(controls);
    let maximized = false;
    const action = name => window.livelyDesktop.windowAction?.(name);
    const toggleMaximize = () => action(maximized ? 'restore' : 'maximize');
    const close = () => action('close');
    if (mac) button(controls, 'close', 'Close window', '×', close);
    button(controls, 'minimize', 'Minimize window', '−', () => action('minimize'));
    const maximize = button(controls, 'maximize', mac ? 'Zoom window' : 'Maximize window', mac ? '↗' : '□', toggleMaximize);
    if (!mac) button(controls, 'close', 'Close window', '×', close);
    titlebar.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMaximize(); });
    document.body.appendChild(titlebar);
    window.livelyDesktop.setWindowState = (isMaximized, focused) => {
      maximized = isMaximized;
      maximize.firstChild.textContent = mac
        ? (maximized ? '↙' : '↗') : (maximized ? '❐' : '□');
      maximize.title = maximized ? 'Restore window' : mac ? 'Zoom window' : 'Maximize window';
      maximize.setAttribute('aria-label', maximize.title);
      titlebar.toggleAttribute('data-inactive', !focused);
    };
    window.livelyDesktop.setWindowState(false, document.hasFocus());
  }
  installTitlebar();

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
