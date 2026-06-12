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

  const desktop = window.livelyDesktop || {};
  const desktopDebugger = desktop.debugger || {};
  const debuggerState = window.__LIVELY_DESKTOP_DEBUGGER__ || (window.__LIVELY_DESKTOP_DEBUGGER__ = {
    armedHalt: null,
    captures: [],
    serviceAttached: !!desktopDebugger.inspectorServiceAttached
  });
  if (desktopDebugger.inspectorServiceAttached) debuggerState.serviceAttached = true;

  function armHalt (capture) {
    if (!debuggerState.serviceAttached) return false;
    debuggerState.armedHalt = {
      captureId: capture && capture.captureId,
      reason: capture && capture.reason || 'halt',
      armedAt: Date.now()
    };
    return true;
  }

  function consumeArmedHalt () {
    const capture = debuggerState.armedHalt;
    debuggerState.armedHalt = null;
    return capture;
  }

  function isAvailable () {
    return !!debuggerState.serviceAttached;
  }

  function setServiceAttached (attached) {
    debuggerState.serviceAttached = !!attached;
    return debuggerState.serviceAttached;
  }

  function breakpointTrap () {
    return true;
  }

  function deliverCapture (descriptor) {
    debuggerState.captures.push(descriptor);
    debuggerState.lastCapture = descriptor;
    try {
      window.dispatchEvent(new CustomEvent('lively-desktop-debugger-capture', { detail: descriptor }));
    } catch (_) {}
    return true;
  }

  window.livelyDesktop = {
    ...desktop,
    navigateToDashboard: navigateToDashboard,
    showDevTools: showDevTools,
    showDesktopMessage: showDesktopMessage,
    confirmDesktopAction: confirmDesktopAction,
    debugger: {
      ...desktopDebugger,
      armHalt: desktopDebugger.armHalt || armHalt,
      consumeArmedHalt: desktopDebugger.consumeArmedHalt || consumeArmedHalt,
      isAvailable: desktopDebugger.isAvailable || isAvailable,
      setServiceAttached: desktopDebugger.setServiceAttached || setServiceAttached,
      breakpointTrap: desktopDebugger.breakpointTrap || breakpointTrap,
      deliverCapture: desktopDebugger.deliverCapture || deliverCapture
    }
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
