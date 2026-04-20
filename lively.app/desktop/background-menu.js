// Persistent NW.js background-page menu.
//
// NW.js explicitly warns that menus created in navigable pages stop working
// after navigation/reload. This script lives in `bg-script`, so the menu and
// its callbacks survive the boot.html -> dashboard transition.

(function () {
  'use strict';

  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  function findRootDir () {
    const candidates = [
      path.resolve(__dirname, '..', '..'),
      path.resolve(__dirname, '..', 'app'),
      path.resolve(__dirname, '..')
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'lively.installer/packages-config.json'))) return c;
    }
    return null;
  }

  const rootDir = findRootDir();
  const bundled = !rootDir || !__dirname.startsWith(rootDir + path.sep);
  const logFile = bundled
    ? path.join(os.homedir(), '.local', 'share', 'lively.next', 'boot.log')
    : path.join(rootDir, 'lively.app', 'boot.log');

  function log (msg) {
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, '[' + new Date().toISOString() + '] menu: ' + msg + '\n');
    } catch (_) {}
  }

  function withMainWindow (fn) {
    nw.Window.getAll(function (wins) {
      const win = wins && wins[0];
      if (!win) {
        log('menu action skipped: no window');
        return;
      }
      fn(win);
    });
  }

  function pageHelper (win) {
    try {
      return win.window && win.window.livelyDesktop;
    } catch (err) {
      log('page helper access failed: ' + err.message);
      return null;
    }
  }

  function navigateToDashboard () {
    log('Dashboard clicked');
    withMainWindow(function (win) {
      try {
        const helper = pageHelper(win);
        if (helper && typeof helper.navigateToDashboard === 'function') {
          helper.navigateToDashboard();
          return;
        }

        const href = String(win.window.location && win.window.location.href || '');
        if (/^https?:\/\//.test(href)) {
          win.window.location.href = new URL('/dashboard/', href).toString();
          return;
        }

        log('dashboard navigation unavailable from href=' + href);
      } catch (err) {
        log('dashboard click failed: ' + (err.stack || err));
      }
    });
  }

  function showDevTools () {
    log('Show DevTools clicked');
    withMainWindow(function (win) {
      try {
        const helper = pageHelper(win);
        if (helper && typeof helper.showDevTools === 'function') {
          helper.showDevTools();
          return;
        }
        win.showDevTools();
      } catch (err) {
        log('devtools click failed: ' + (err.stack || err));
      }
    });
  }

  const menu = new nw.Menu({ type: 'menubar' });
  if (process.platform === 'darwin') {
    menu.createMacBuiltin('lively.next', { hideEdit: false });
  }

  const goMenu = new nw.Menu();
  const mod = process.platform === 'darwin' ? 'cmd' : 'ctrl';
  goMenu.append(new nw.MenuItem({
    label: 'Dashboard',
    key: 'd',
    modifiers: mod + '+shift',
    click: navigateToDashboard
  }));
  goMenu.append(new nw.MenuItem({ type: 'separator' }));
  goMenu.append(new nw.MenuItem({
    label: 'Show DevTools',
    key: 'i',
    modifiers: mod + '+alt',
    click: showDevTools
  }));
  menu.append(new nw.MenuItem({ label: 'Go', submenu: goMenu }));

  function attachMenu (win, reason) {
    try {
      win.menu = menu;
      log('native menu attached (' + reason + ')');
    } catch (err) {
      log('menu attach failed (' + reason + '): ' + (err.stack || err));
    }
  }

  function attachMenuWhenWindowExists () {
    nw.Window.getAll(function (wins) {
      const win = wins && wins[0];
      if (!win) {
        setTimeout(attachMenuWhenWindowExists, 250);
        return;
      }

      win.on('loaded', function () { attachMenu(win, 'loaded'); });
      attachMenu(win, 'initial');
    });
  }

  attachMenuWhenWindowExists();
})();
