// Velopack integration for the NW.js desktop app.
//
// This module intentionally stays CJS and desktop-only. The Velopack JS SDK is
// native-backed, so browser/world code should only talk to it through the native
// desktop menu/bridge.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { spawn } = require('child_process');

const VELOPACK_PACKAGE = 'velopack';
const NEON_LOAD_PACKAGE = '@neon-rs/load';
const WINDOWS_HELPER_ENV = 'LIVELY_VELOPACK_HELPER';

let velopackModule = null;
let velopackLoadError = null;
let flatnResolverInstalled = false;

function noop () {}

function readJson (file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function packageDirName (name) {
  return name.replace(/\//g, '__SLASH__');
}

function findFlatnPackageDir (rootDir, name) {
  const parent = path.join(rootDir, 'lively.next-node_modules', packageDirName(name));
  if (!fs.existsSync(parent)) return null;

  const versions = fs.readdirSync(parent, { withFileTypes: true })
    .filter(ea => ea.isDirectory())
    .map(ea => ea.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return versions.length ? path.join(parent, versions[versions.length - 1]) : null;
}

function packageMain (dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  return path.join(dir, pkg && pkg.main ? pkg.main : 'index.js');
}

function installFlatnResolver (rootDir) {
  if (flatnResolverInstalled) return;

  const velopackDir = findFlatnPackageDir(rootDir, VELOPACK_PACKAGE);
  const neonLoadDir = findFlatnPackageDir(rootDir, NEON_LOAD_PACKAGE);
  if (!velopackDir || !neonLoadDir) return;

  const velopackMain = packageMain(velopackDir);
  const neonLoadMain = packageMain(neonLoadDir);
  const resolveFilename = Module._resolveFilename;

  Module._resolveFilename = function livelyDesktopVelopackResolve (request, parent, isMain, options) {
    if (request === VELOPACK_PACKAGE) return velopackMain;
    if (request === NEON_LOAD_PACKAGE) return neonLoadMain;
    return resolveFilename.call(this, request, parent, isMain, options);
  };

  flatnResolverInstalled = true;
}

function loadVelopack (rootDir, log = noop) {
  if (velopackModule) return { ok: true, module: velopackModule };
  if (velopackLoadError) return { ok: false, error: velopackLoadError };
  if (nwWindowsSdkUnavailable()) {
    velopackLoadError = new Error('Velopack native SDK is not loaded in-process under NW.js on Windows. Use a bundled Node helper process for Velopack operations.');
    return { ok: false, error: velopackLoadError };
  }

  try {
    // Packaged builds use flatn instead of a conventional node_modules tree.
    // Install these aliases before the first require; unresolved package lookup
    // can be surprisingly expensive in NW.js.
    log('Velopack SDK installing flatn resolver');
    installFlatnResolver(rootDir);
    log('Velopack SDK requiring package');
    velopackModule = require(VELOPACK_PACKAGE);
    log('Velopack SDK package required');
    return { ok: true, module: velopackModule };
  } catch (err) {
    velopackLoadError = err;
    return { ok: false, error: err };
  }
}

function readBuildInfo (desktopDir, rootDir = null) {
  const candidates = uniquePaths([
    desktopDir && path.join(desktopDir, 'build-info.json'),
    path.join(__dirname, 'build-info.json'),
    rootDir && path.join(rootDir, '..', 'desktop', 'build-info.json'),
    rootDir && path.join(rootDir, 'desktop', 'build-info.json')
  ]);

  for (const file of candidates) {
    const info = readJson(file);
    if (info) return info;
  }

  return {};
}

function updateSourceFrom (buildInfo) {
  return process.env.LIVELY_APP_UPDATE_URL || buildInfo.updateUrl || '';
}

function updateChannelFrom (buildInfo) {
  return process.env.LIVELY_APP_UPDATE_CHANNEL || buildInfo.updateChannel || '';
}

function serializableError (err) {
  const msg = err && (err.stack || err.message || String(err));
  return msg || 'Unknown Velopack error';
}

function errorMessage (err) {
  const msg = err && (err.message || String(err));
  return msg || 'Unknown Velopack error';
}

function nwWindowsSdkUnavailable () {
  return process.platform === 'win32' && typeof nw !== 'undefined';
}

function classifyError (err) {
  const message = err && (err.message || String(err)) || '';
  if (/not properly installed|Could not locate|auto-locate app manifest/i.test(message)) return 'not-installed';
  if (/Cannot find module|no precompiled module|unsupported|not loaded in-process|helper process/i.test(message)) return 'sdk-unavailable';
  return 'error';
}

function assetVersion (asset) {
  return asset && asset.Version || '';
}

function updateVersion (updateInfo) {
  return updateInfo && updateInfo.TargetFullRelease && assetVersion(updateInfo.TargetFullRelease) || '';
}

function createManager (Velopack, source, channel, locator) {
  const options = channel ? { ExplicitChannel: channel } : undefined;
  return new Velopack.UpdateManager(source, options, locator || undefined);
}

function pathIsInside (candidate, parent) {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function ancestorAppBundles (start) {
  if (!start) return [];

  let dir = start;
  try {
    const stat = fs.existsSync(dir) && fs.statSync(dir);
    if (stat && stat.isFile()) dir = path.dirname(dir);
  } catch (_) {}

  const bundles = [];
  while (dir && dir !== path.dirname(dir)) {
    if (/\.app$/i.test(dir)) bundles.push(dir);
    dir = path.dirname(dir);
  }

  return bundles;
}

function uniquePaths (paths) {
  const seen = new Set();
  return paths.filter(file => {
    if (!file || seen.has(file)) return false;
    seen.add(file);
    return true;
  });
}

function appBundleForRootDir (rootDir) {
  const candidates = uniquePaths([
    ...ancestorAppBundles(rootDir),
    ...ancestorAppBundles(process.execPath),
    ...ancestorAppBundles(process.argv && process.argv[0])
  ]);
  const resolvedRoot = rootDir && path.resolve(rootDir);

  if (resolvedRoot) {
    const rootBundle = candidates.find(bundle => {
      const appNwDir = path.join(bundle, 'Contents', 'Resources', 'app.nw');
      return pathIsInside(resolvedRoot, appNwDir);
    });
    if (rootBundle) return rootBundle;
  }

  const bundleWithAppNw = candidates.find(bundle => {
    return fs.existsSync(path.join(bundle, 'Contents', 'Resources', 'app.nw'));
  });
  if (bundleWithAppNw) return bundleWithAppNw;

  return candidates[candidates.length - 1] || null;
}

function manifestId (manifestPath) {
  let source = '';
  try {
    source = fs.readFileSync(manifestPath, 'utf8');
  } catch (_) {
    return '';
  }

  const match = source.match(/<id>([^<]+)<\/id>/i);
  return match && match[1] || '';
}

function defaultMacPackagesDir (appId) {
  return path.join(os.homedir(), 'Library', 'Caches', 'velopack', appId, 'packages');
}

function windowsAppContentDir (rootDir, desktopDir) {
  const candidates = uniquePaths([
    rootDir && path.resolve(rootDir, '..'),
    desktopDir && path.resolve(desktopDir, '..'),
    rootDir,
    desktopDir
  ]);
  return candidates.find(dir => {
    return dir &&
      fs.existsSync(path.join(dir, 'desktop')) &&
      fs.existsSync(path.join(dir, 'app'));
  }) || candidates[0] || null;
}

function firstExistingPath (paths) {
  return paths.find(file => file && fs.existsSync(file)) || paths.find(Boolean) || null;
}

function createWindowsVelopackLocator (rootDir, options = {}) {
  if (process.platform !== 'win32') return null;

  const currentDir = windowsAppContentDir(rootDir, options.desktopDir);
  if (!currentDir) return null;

  const parentDir = path.dirname(currentDir);
  const updateExePath = firstExistingPath([
    path.join(parentDir, 'Update.exe'),
    path.join(currentDir, 'Update.exe')
  ]);
  const manifestPath = firstExistingPath([
    path.join(currentDir, 'sq.version'),
    path.join(parentDir, 'sq.version')
  ]);
  const isPortable =
    fs.existsSync(path.join(currentDir, 'Update.exe')) ||
    path.basename(currentDir).toLowerCase() !== 'current';

  return {
    RootAppDir: currentDir,
    UpdateExePath: updateExePath,
    PackagesDir: options.packagesDir || path.join(isPortable ? currentDir : parentDir, 'packages'),
    ManifestPath: manifestPath,
    CurrentBinaryDir: currentDir,
    IsPortable: isPortable
  };
}

function createVelopackLocator (rootDir, options = {}) {
  if (process.platform === 'win32') return createWindowsVelopackLocator(rootDir, options);
  if (process.platform !== 'darwin') return null;

  const bundleDir = appBundleForRootDir(rootDir);
  if (!bundleDir) return null;

  const macosDir = path.join(bundleDir, 'Contents', 'MacOS');
  const updateExePath = path.join(macosDir, 'UpdateMac');
  const manifestPath = path.join(macosDir, 'sq.version');
  const appId = manifestId(manifestPath) || 'next.lively.app';

  return {
    RootAppDir: bundleDir,
    UpdateExePath: updateExePath,
    PackagesDir: options.packagesDir || defaultMacPackagesDir(appId),
    ManifestPath: manifestPath,
    CurrentBinaryDir: macosDir,
    IsPortable: true
  };
}

function macInstallProblem (rootDir, locator = createVelopackLocator(rootDir)) {
  if (process.platform !== 'darwin' || !locator) return null;

  const required = [
    locator.UpdateExePath,
    locator.ManifestPath
  ];
  const missing = required.filter(file => !fs.existsSync(file));
  if (!missing.length) return null;

  return {
    bundleDir: locator.RootAppDir,
    missing,
    message: [
      'This app is missing Velopack updater files, so it cannot self-update.',
      '',
      'Expected files:',
      ...missing.map(file => '- ' + file),
      '',
      'Install the macOS Setup.pkg from the lively.next-osx-arm64-velopack artifact. If this app was copied from the raw NW.js bundle, or an older /Applications/lively.next.app was kept during installation, Velopack cannot manage it.'
    ].join('\n')
  };
}

function updateCheckTimeoutMs () {
  const timeout = Number(process.env.LIVELY_APP_UPDATE_CHECK_TIMEOUT_MS || 30000);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 30000;
}

function helperCommandTimeoutMs (command) {
  if (command === 'check') return updateCheckTimeoutMs() + 10000;
  if (command === 'status') return 10000;
  return 0;
}

function withTimeout (promise, timeout, label) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + ' timed out after ' + timeout + 'ms')), timeout);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function findBundledNodeBinary (rootDir, desktopDir) {
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const candidates = uniquePaths([
    rootDir && path.resolve(rootDir, '..', 'node', nodeName),
    rootDir && path.resolve(rootDir, '..', 'node', 'bin', nodeName),
    desktopDir && path.resolve(desktopDir, '..', 'node', nodeName),
    desktopDir && path.resolve(desktopDir, '..', 'node', 'bin', nodeName)
  ]);
  return candidates.find(file => fs.existsSync(file)) || null;
}

function windowsHelperConfig (rootDir, desktopDir) {
  if (process.platform !== 'win32' || process.env[WINDOWS_HELPER_ENV] === '1') return null;
  const node = findBundledNodeBinary(rootDir, desktopDir);
  const helper = desktopDir && path.join(desktopDir, 'velopack-helper.cjs');
  if (!node || !helper || !fs.existsSync(helper)) return null;
  return { node, helper };
}

function windowsHelperEnv () {
  return { ...process.env, [WINDOWS_HELPER_ENV]: '1' };
}

function helperUnavailable (source, channel, buildInfo, message, extra = {}) {
  return {
    ok: false,
    state: 'helper-unavailable',
    message,
    source,
    channel,
    buildInfo,
    ...extra
  };
}

function invokeWindowsHelper ({ command, rootDir, desktopDir, payload = {}, log = noop, progress = noop }) {
  const config = windowsHelperConfig(rootDir, desktopDir);
  const buildInfo = readBuildInfo(desktopDir, rootDir);
  const source = updateSourceFrom(buildInfo);
  const channel = updateChannelFrom(buildInfo);
  if (!config) {
    return Promise.resolve(helperUnavailable(
      source,
      channel,
      buildInfo,
      'The Windows Velopack helper is not available in this build.'
    ));
  }

  return new Promise(resolve => {
    const child = spawn(config.node, [config.helper], {
      cwd: path.dirname(desktopDir),
      env: windowsHelperEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let settled = false;
    let result = null;
    let stderr = '';
    let stdoutBuffer = '';
    let timeout = null;

    function finish (value) {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(value);
    }

    function parseLine (line) {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch (_) {
        log('Velopack helper stdout: ' + line);
        return;
      }

      if (event.type === 'progress') {
        progress(Number(event.percent) || 0);
      } else if (event.type === 'log') {
        log('Velopack helper: ' + event.message);
      } else if (event.type === 'result') {
        result = event.result;
      } else if (event.type === 'error') {
        result = {
          ok: false,
          state: 'error',
          message: 'Velopack helper failed.',
          error: event.error
        };
      }
    }

    function parseStdout (chunk) {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      lines.forEach(parseLine);
    }

    child.on('error', err => {
      finish(helperUnavailable(
        source,
        channel,
        buildInfo,
        'The Windows Velopack helper could not be started.',
        { error: errorMessage(err) }
      ));
    });
    child.stdout.on('data', data => parseStdout(String(data)));
    child.stderr.on('data', data => { stderr += String(data); });
    child.on('close', code => {
      if (stdoutBuffer) parseLine(stdoutBuffer);
      if (result) return finish(result);
      finish(helperUnavailable(
        source,
        channel,
        buildInfo,
        'The Windows Velopack helper exited without a result.',
        { error: stderr.trim() || 'exit code ' + code }
      ));
    });

    const timeoutMs = helperCommandTimeoutMs(command);
    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        try { child.kill(); } catch (_) {}
        finish(helperUnavailable(
          source,
          channel,
          buildInfo,
          'The Windows Velopack helper timed out.',
          { error: command + ' timed out after ' + timeoutMs + 'ms' }
        ));
      }, timeoutMs);
    }

    child.stdin.end(JSON.stringify({
      command,
      rootDir,
      desktopDir,
      ...payload
    }));
  });
}

function startWindowsApplyHelper ({ rootDir, desktopDir, updateInfo, options = {}, log = noop }) {
  const config = windowsHelperConfig(rootDir, desktopDir);
  const buildInfo = readBuildInfo(desktopDir, rootDir);
  const source = updateSourceFrom(buildInfo);
  const channel = updateChannelFrom(buildInfo);
  if (!config) {
    return helperUnavailable(
      source,
      channel,
      buildInfo,
      'The Windows Velopack helper is not available in this build.'
    );
  }

  const payloadFile = path.join(
    os.tmpdir(),
    'lively-next-velopack-apply-' + process.pid + '-' + Date.now() + '.json'
  );
  fs.writeFileSync(payloadFile, JSON.stringify({
    command: 'apply',
    rootDir,
    desktopDir,
    updateInfo,
    options,
    parentPid: process.pid
  }));

  try {
    const child = spawn(config.node, [config.helper, '--payload', payloadFile], {
      cwd: path.dirname(desktopDir),
      env: windowsHelperEnv(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    log('Velopack helper apply process started: pid=' + child.pid);
    return {
      ok: true,
      state: 'applying',
      source,
      channel,
      buildInfo,
      targetVersion: updateVersion(updateInfo) || assetVersion(updateInfo),
      helperPid: child.pid
    };
  } catch (err) {
    try { fs.rmSync(payloadFile, { force: true }); } catch (_) {}
    return helperUnavailable(
      source,
      channel,
      buildInfo,
      'The Windows Velopack helper could not be started.',
      { error: errorMessage(err) }
    );
  }
}

function createWindowsHelperUpdateService ({ rootDir, desktopDir, log = noop }) {
  const buildInfo = readBuildInfo(desktopDir, rootDir);
  const source = updateSourceFrom(buildInfo);
  const channel = updateChannelFrom(buildInfo);
  log('Velopack update service initialized: source=' + (source || '(none)') + ', channel=' + (channel || '(none)') + ', helper=windows-node');

  function unavailable (state, message, extra = {}) {
    return {
      ok: false,
      state,
      message,
      source,
      channel,
      buildInfo,
      ...extra
    };
  }

  function status () {
    const config = windowsHelperConfig(rootDir, desktopDir);
    if (!source) {
      return unavailable('unconfigured', 'No Velopack update feed is configured for this build.');
    }
    if (!config) {
      return helperUnavailable(
        source,
        channel,
        buildInfo,
        'The Windows Velopack helper is not available in this build.'
      );
    }
    return {
      ok: true,
      state: 'helper-ready',
      source,
      channel,
      buildInfo
    };
  }

  async function checkForUpdates () {
    if (!source) return unavailable('unconfigured', 'No Velopack update feed is configured for this build.');
    return invokeWindowsHelper({ command: 'check', rootDir, desktopDir, log });
  }

  async function downloadUpdate (updateInfo, progress) {
    if (!source) return unavailable('unconfigured', 'No Velopack update feed is configured for this build.');
    return invokeWindowsHelper({
      command: 'download',
      rootDir,
      desktopDir,
      payload: { updateInfo },
      log,
      progress
    });
  }

  function applyUpdate (updateInfoOrAsset, options = {}) {
    if (!source) return unavailable('unconfigured', 'No Velopack update feed is configured for this build.');
    if (!updateInfoOrAsset) return unavailable('no-pending-update', 'There is no downloaded update to apply.');
    return startWindowsApplyHelper({
      rootDir,
      desktopDir,
      updateInfo: updateInfoOrAsset,
      options,
      log
    });
  }

  return {
    buildInfo,
    source,
    channel,
    status,
    checkForUpdates,
    downloadUpdate,
    applyUpdate
  };
}

function runVelopackStartup ({ rootDir, desktopDir, log = noop }) {
  log('Velopack startup hook loading SDK');
  const loaded = loadVelopack(rootDir, log);
  log('Velopack startup hook SDK ' + (loaded.ok ? 'loaded' : 'unavailable'));
  const buildInfo = readBuildInfo(desktopDir, rootDir);
  const locator = createVelopackLocator(rootDir, { desktopDir });

  if (!loaded.ok) {
    log('Velopack SDK unavailable: ' + serializableError(loaded.error));
    return { ok: false, state: 'sdk-unavailable', error: serializableError(loaded.error), buildInfo };
  }

  try {
    log('Velopack startup hook running');
    const app = loaded.module.VelopackApp.build()
      .setLogger((level, msg) => log('Velopack ' + level + ': ' + msg));
    if (locator) app.setLocator(locator);
    app.run();
    log('Velopack startup hook completed');
    return { ok: true, state: 'ready', buildInfo };
  } catch (err) {
    log('Velopack startup hook failed: ' + serializableError(err));
    return { ok: false, state: classifyError(err), error: serializableError(err), buildInfo };
  }
}

function createUpdateService ({ rootDir, desktopDir, log = noop, locator: locatorOverride = null, packagesDir = null }) {
  const helperConfig = windowsHelperConfig(rootDir, desktopDir);
  if (helperConfig) return createWindowsHelperUpdateService({ rootDir, desktopDir, log });

  const buildInfo = readBuildInfo(desktopDir, rootDir);
  const source = updateSourceFrom(buildInfo);
  const channel = updateChannelFrom(buildInfo);
  const locator = locatorOverride || createVelopackLocator(rootDir, { desktopDir, packagesDir });
  log('Velopack update service initialized: source=' + (source || '(none)') + ', channel=' + (channel || '(none)'));

  function unavailable (state, message, extra = {}) {
    return {
      ok: false,
      state,
      message,
      source,
      channel,
      buildInfo,
      ...extra
    };
  }

  function managerResult () {
    if (!source) {
      return unavailable(
        'unconfigured',
        'No Velopack update feed is configured for this build.'
      );
    }

    const loaded = loadVelopack(rootDir);
    if (!loaded.ok) {
      return unavailable(
        'sdk-unavailable',
        'Velopack is not available in this build.',
        { error: errorMessage(loaded.error) }
      );
    }

    const installProblem = macInstallProblem(rootDir, locator);
    if (installProblem) {
      return unavailable(
        'not-installed',
        installProblem.message,
        { missingFiles: installProblem.missing, bundleDir: installProblem.bundleDir }
      );
    }

    try {
      const manager = createManager(loaded.module, source, channel, locator);
      return { ok: true, manager, source, channel, buildInfo };
    } catch (err) {
      return unavailable(
        classifyError(err),
        classifyError(err) === 'not-installed'
          ? 'This app was not installed by Velopack, so it cannot self-update.'
          : 'Velopack could not be initialized.',
        { error: errorMessage(err) }
      );
    }
  }

  function status () {
    const result = managerResult();
    if (!result.ok) return result;

    try {
      return {
        ok: true,
        state: 'ready',
        source,
        channel,
        buildInfo,
        appId: result.manager.getAppId(),
        version: result.manager.getCurrentVersion(),
        portable: result.manager.isPortable(),
        pendingRestart: result.manager.getUpdatePendingRestart()
      };
    } catch (err) {
      return unavailable(classifyError(err), 'Velopack status is unavailable.', {
        error: serializableError(err)
      });
    }
  }

  async function checkForUpdates () {
    const result = managerResult();
    if (!result.ok) return result;

    try {
      log('Velopack checking for updates from ' + source + (channel ? ' channel=' + channel : ''));
      const updateInfo = await withTimeout(
        result.manager.checkForUpdatesAsync(),
        updateCheckTimeoutMs(),
        'Velopack update check'
      );
      return {
        ok: true,
        state: updateInfo ? 'update-available' : 'up-to-date',
        source,
        channel,
        buildInfo,
        version: result.manager.getCurrentVersion(),
        appId: result.manager.getAppId(),
        updateInfo,
        targetVersion: updateVersion(updateInfo)
      };
    } catch (err) {
      return unavailable(classifyError(err), 'Update check failed.', {
        error: serializableError(err)
      });
    }
  }

  async function downloadUpdate (updateInfo, progress) {
    const result = managerResult();
    if (!result.ok) return result;

    try {
      await result.manager.downloadUpdateAsync(updateInfo, progress || noop);
      return {
        ok: true,
        state: 'downloaded',
        source,
        channel,
        buildInfo,
        updateInfo,
        targetVersion: updateVersion(updateInfo)
      };
    } catch (err) {
      return unavailable(classifyError(err), 'Update download failed.', {
        error: serializableError(err)
      });
    }
  }

  function applyUpdate (updateInfoOrAsset, { silent = false, restart = true, restartArgs = [] } = {}) {
    const result = managerResult();
    if (!result.ok) return result;

    try {
      const update = updateInfoOrAsset || result.manager.getUpdatePendingRestart();
      if (!update) {
        return unavailable('no-pending-update', 'There is no downloaded update to apply.');
      }
      result.manager.waitExitThenApplyUpdate(update, silent, restart, restartArgs);
      return {
        ok: true,
        state: 'applying',
        source,
        channel,
        buildInfo,
        targetVersion: updateVersion(update) || assetVersion(update)
      };
    } catch (err) {
      return unavailable(classifyError(err), 'Update apply failed.', {
        error: serializableError(err)
      });
    }
  }

  return {
    buildInfo,
    source,
    channel,
    status,
    checkForUpdates,
    downloadUpdate,
    applyUpdate
  };
}

module.exports = {
  createUpdateService,
  runVelopackStartup,
  loadVelopack,
  appBundleForRootDir,
  createVelopackLocator
};
