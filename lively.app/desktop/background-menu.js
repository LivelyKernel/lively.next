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
  const { createUpdateService } = require('./updates.cjs');

  function uniquePaths (paths) {
    return Array.from(new Set(paths.filter(Boolean).map(p => path.resolve(p))));
  }

  function candidateRootsFrom (base) {
    if (!base) return [];
    const roots = [];
    let dir = path.resolve(base);
    try {
      if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) dir = path.dirname(dir);
    } catch (_) {}

    for (let i = 0; i < 8; i++) {
      roots.push(
        dir,
        path.join(dir, 'app'),
        path.join(dir, 'app.nw', 'app'),
        path.join(dir, 'Resources', 'app.nw', 'app'),
        path.join(dir, 'Contents', 'Resources', 'app.nw', 'app')
      );
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return roots;
  }

  function findRootDir (logFn) {
    const appStartPath = typeof nw !== 'undefined' && nw.App && nw.App.startPath;
    const candidates = uniquePaths([
      ...candidateRootsFrom(__dirname),
      ...candidateRootsFrom(process.cwd && process.cwd()),
      ...candidateRootsFrom(process.execPath),
      ...candidateRootsFrom(process.argv && process.argv[0]),
      ...candidateRootsFrom(appStartPath)
    ]);
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'lively.installer/packages-config.json'))) return c;
    }
    if (logFn) {
      logFn(
        'rootDir unavailable; __dirname=' + __dirname +
        ', cwd=' + (process.cwd && process.cwd()) +
        ', execPath=' + process.execPath +
        ', appStartPath=' + (appStartPath || '') +
        ', checked=' + candidates.slice(0, 20).join(', ')
      );
    }
    return null;
  }

  function desktopDataDir () {
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'lively.next');
    }
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'lively.next');
    }
    return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'lively.next');
  }

  const fallbackLogFile = path.join(desktopDataDir(), 'boot.log');
  let logFile = fallbackLogFile;
  function log (msg) {
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, '[' + new Date().toISOString() + '] menu: ' + msg + '\n');
    } catch (_) {}
  }

  const rootDir = findRootDir(log);
  const bundled = !rootDir || !__dirname.startsWith(rootDir + path.sep);
  logFile = bundled
    ? fallbackLogFile
    : path.join(rootDir, 'lively.app', 'boot.log');
  log('background menu rootDir=' + (rootDir || '(unavailable)') + ', bundled=' + bundled);

  const updateService = rootDir
    ? createUpdateService({ rootDir, desktopDir: __dirname, log })
    : null;

  function withMainWindow (fn, onMissing) {
    nw.Window.getAll(function (wins) {
      wins = wins || [];
      const win = wins.find(isMainWindow) || wins[0];
      if (!win) {
        log('menu action skipped: no window');
        if (onMissing) onMissing();
        return;
      }
      log('menu action using window: ' + windowLocation(win));
      fn(win);
    });
  }

  function windowLocation (win) {
    try {
      return String(win.window && win.window.location && win.window.location.href || '');
    } catch (_) {
      return '';
    }
  }

  function isMainWindow (win) {
    try {
      const w = win.window;
      if (!w) return false;
      if (w.__LIVELY_DESKTOP_APP__ || w.livelyDesktop || w.livelyBoot) return true;
      const href = windowLocation(win);
      return /\/boot\.html$/.test(href) || /^https?:\/\/(127\.0\.0\.1|localhost):\d+\//.test(href);
    } catch (_) {
      return false;
    }
  }

  function pageHelper (win) {
    try {
      return win.window && win.window.livelyDesktop;
    } catch (err) {
      log('page helper access failed: ' + err.message);
      return null;
    }
  }

  function showMessage (win, title, message) {
    try {
      const helper = pageHelper(win);
      if (helper && typeof helper.showDesktopMessage === 'function') {
        helper.showDesktopMessage(title, message);
        return;
      }
      win.window.alert([title, message].filter(Boolean).join('\n\n'));
    } catch (err) {
      log('message display failed: ' + (err.stack || err));
    }
  }

  function confirmAction (win, title, message) {
    try {
      const helper = pageHelper(win);
      if (helper && typeof helper.confirmDesktopAction === 'function') {
        return helper.confirmDesktopAction(title, message);
      }
      return win.window.confirm([title, message].filter(Boolean).join('\n\n'));
    } catch (err) {
      log('confirmation display failed: ' + (err.stack || err));
      return false;
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
    log('Open Dev Tools clicked');
    withMainWindow(function (win) {
      try {
        const helper = pageHelper(win);
        if (helper && typeof helper.showDevTools === 'function') {
          try {
            if (helper.showDevTools()) return;
          } catch (err) {
            log('page helper DevTools failed: ' + (err.stack || err));
          }
          log('page helper could not open DevTools, falling back to background window');
        }

        if (typeof win.showDevTools !== 'function') {
          log('devtools unavailable; NW.js SDK flavor is required');
          return;
        }
        win.showDevTools();
      } catch (err) {
        log('devtools click failed: ' + (err.stack || err));
      }
    });
  }

  let updateBusy = false;
  let updateMenuItem = null;

  function setUpdateMenuState (label, enabled) {
    if (!updateMenuItem) return;
    updateMenuItem.label = label;
    updateMenuItem.enabled = enabled;
  }

  function versionLabel (result) {
    return result && (result.version ||
      result.buildInfo && result.buildInfo.version ||
      result.buildInfo && result.buildInfo.sha) ||
      'unknown';
  }

  function failureDetails (result) {
    return [result.message, result.error].filter(Boolean).join('\n\n');
  }

  function closeForUpdate (win) {
    try {
      win.close();
    } catch (err) {
      log('window close for update failed: ' + (err.stack || err));
    }
    setTimeout(function () {
      try {
        if (nw.App && typeof nw.App.quit === 'function') nw.App.quit();
      } catch (err) {
        log('app quit for update failed: ' + (err.stack || err));
      }
    }, 2500);
  }

  function checkForUpdates () {
    log('Check for Updates clicked');
    if (updateBusy) return;
    if (!updateService) {
      log('update check skipped: rootDir unavailable');
      return;
    }

    updateBusy = true;
    setUpdateMenuState('Checking for Updates...', false);

    withMainWindow(async function (win) {
      try {
        log('update check started: source=' + updateService.source + ', channel=' + updateService.channel);
        const checked = await updateService.checkForUpdates();
        log('update check completed: state=' + checked.state + ', ok=' + checked.ok);
        if (!checked.ok) {
          showMessage(win, 'lively.next updates', failureDetails(checked));
          return;
        }

        if (!checked.updateInfo) {
          showMessage(
            win,
            'lively.next is up to date',
            'Current version: ' + versionLabel(checked)
          );
          return;
        }

        const targetVersion = checked.targetVersion || 'latest';
        const download = confirmAction(
          win,
          'Update available',
          'Version ' + targetVersion + ' is available. Download it now?'
        );
        if (!download) return;

        let lastProgress = -1;
        setUpdateMenuState('Downloading Update...', false);
        const downloaded = await updateService.downloadUpdate(checked.updateInfo, function (percent) {
          const rounded = Math.max(0, Math.min(100, Math.floor(percent)));
          if (rounded === lastProgress || rounded < lastProgress + 5 && rounded !== 100) return;
          lastProgress = rounded;
          log('update download progress: ' + rounded + '%');
          setUpdateMenuState('Downloading Update ' + rounded + '%', false);
        });

        if (!downloaded.ok) {
          showMessage(win, 'Update download failed', failureDetails(downloaded));
          return;
        }

        const restart = confirmAction(
          win,
          'Update ready',
          'Restart lively.next now to apply version ' + targetVersion + '?'
        );
        if (!restart) {
          showMessage(win, 'Update ready', 'The update will be applied when you restart lively.next.');
          return;
        }

        const applying = updateService.applyUpdate(checked.updateInfo, { restart: true });
        if (!applying.ok) {
          showMessage(win, 'Update apply failed', failureDetails(applying));
          return;
        }

        log('Velopack updater launched, closing app for update');
        closeForUpdate(win);
      } catch (err) {
        log('update check failed: ' + (err.stack || err));
        showMessage(win, 'Update check failed', err && err.message || String(err));
      } finally {
        updateBusy = false;
        setUpdateMenuState('Check for Updates...', true);
      }
    }, function () {
      updateBusy = false;
      setUpdateMenuState('Check for Updates...', true);
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
    label: 'Open Dev Tools',
    key: 'i',
    modifiers: mod + '+alt',
    click: showDevTools
  }));
  goMenu.append(new nw.MenuItem({ type: 'separator' }));
  updateMenuItem = new nw.MenuItem({
    label: 'Check for Updates...',
    click: checkForUpdates
  });
  goMenu.append(updateMenuItem);
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
