/* global System,fetch */
import { resource, registerExtension as registerResourceExension } from 'lively.resources';
import { subscribe, emit } from 'lively.notifications';
import { Path, obj, date, promise, string } from 'lively.lang';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import ShellClientResource from 'lively.shell/client-resource.js';

import { MorphicEnv } from './env.js';
import { createMorphSnapshot } from './serialization.js';
import { MorphicDB } from './morphicdb/index.js';
import { ensureCommitInfo } from './morphicdb/db.js';
import { pathForBrowserHistory } from './helpers.js';
import { part } from './components/core.js';

function reportWorldLoad (world, user) {
  const userId = user ? `${user.name} (${(user.token || '').slice(0, 5)})` : '---';
  fetch(string.joinPath(System.baseURL, '/report-world-load'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${userId} logged in at ${world.name} [${window._livelyLoadId}]`
    })
  }).catch(err => console.warn(`report-world-load failed: ${err}`));
}

async function setupLively2Lively (world) {
  const user = world.getCurrentUser();
  const info = { world: world.name };
  if (user) {
    info.userToken = user.token;
    info.userRealm = user.realm;
  }

  await lively.modules.importPackage('lively.2lively');
  const { default: L2LClient } = await System.import('lively.2lively/client.js');
  const client = await L2LClient.forLivelyInBrowser(info);
  console.log(`[lively] lively2lively client created ${client}`);

  // FIXME... put this go somewhere else...?
  if (!client._onUserChange) {
    client._onUserChange = function (evt) {
      if (client.isOnline() && evt.user) {
        const { token: userToken, realm: userRealm } = evt.user;
        client.info = { ...client.info, userToken, userRealm };
        client.unregister().then(() => client.register())
          .then(() => console.log('re-registered after user change'));
      }
    };

    subscribe('lively.user/userchanged', client._onUserChange, System);

    client.once('registered', () => {
      reportWorldLoad(world, user);
    });

    client.on('registered', () => {
      const flap = world.get('user flap');
      flap && flap.updateNetworkIndicator(client);
    });
    client.on('connected', () => {
      const flap = world.get('user flap');
      flap && flap.updateNetworkIndicator(client);
    });
    client.on('reconnecting', () => {
      const flap = world.get('user flap');
      flap && flap.updateNetworkIndicator(client);
    });
    client.on('disconnected', () => {
      const flap = world.get('user flap');
      flap && flap.updateNetworkIndicator(client);
    });
  } else reportWorldLoad(world, user);

  return client;
}

async function setupLivelyShell (opts) {
  await lively.modules.importPackage('lively.shell');
  const { default: ClientCommand } = await System.import('lively.shell/client-command.js');
  const { resourceExtension } = await System.import('lively.shell/client-resource.js');
  const { l2lClient } = opts;
  ClientCommand.installLively2LivelyServices(l2lClient);
  resourceExtension.resourceClass.defaultL2lClient = l2lClient;
  registerResourceExension(resourceExtension);
  console.log('[lively] lively.shell setup');
}

async function loadLocalConfig () {
  const localconfig = lively.modules.module('localconfig.js');
  try {
    // reload so that localconfig module actually executes, even if it was loaded before
    if (await resource(localconfig.id).exists()) { await localconfig.reload({ resetEnv: false, reloadDeps: false }); }
  } catch (err) {
    console.error('Error loading localconfig:', err);
    if (typeof $world !== 'undefined') { $world.showError(`Error loading localconfig.js: ${err}`); }
  }
}

export async function loadWorld (newWorld, oldWorld, options = {}) {
  // oldWorld is optional

  let {
    env,
    root,
    verbose = true,
    localconfig = true,
    l2l = true,
    shell = true,
    worldLoadDialog = false,
    showUserFlap = typeof newWorld.showsUserFlap === 'undefined'
      ? true
      : newWorld.showsUserFlap
  } = options;

  env = env || (oldWorld ? oldWorld.env : MorphicEnv.default());

  const doc = env.domEnv.document || document;
  const nativeLoadingIndicator = doc.getElementById('dom-loading-indicator');

  try {
    const l2lClient = l2l && await setupLively2Lively(newWorld);

    if (l2lClient && shell) await setupLivelyShell({ l2lClient });

    if (verbose && nativeLoadingIndicator) nativeLoadingIndicator.style.display = '';

    localconfig && await loadLocalConfig();

    // if root is defined render on the root node
    await env.setWorld(newWorld, root);

    worldLoadDialog && newWorld.execCommand('load world');

    if (options.pathForBrowserHistory) {
      window.history.pushState({}, 'lively.next', options.pathForBrowserHistory);
    }

    newWorld.showsUserFlap = showUserFlap; // will initialize Comment Browser

    if (oldWorld) { oldWorld.onUnload(); }

    emit('world/loaded', newWorld);

    return newWorld;
  } catch (e) {
    console.error('Error loading world: ', e);
    if (oldWorld) {
      await env.setWorld(oldWorld);
      oldWorld.showError(e);
    }
    throw e;
  } finally {
    if (nativeLoadingIndicator) nativeLoadingIndicator.style.display = 'none';
  }
}

export async function loadWorldFromCommit (commitOrId, oldWorld, options) {
  if (oldWorld) {
    oldWorld.name = null;
    if (oldWorld.metadata) oldWorld.metadata.commit = {};
  }
  const db = MorphicDB.default;
  const newWorld = await db.load('world', undefined, options, commitOrId);
  const queryString = typeof document !== 'undefined' ? document.location.search : '';
  options = {
    pathForBrowserHistory: pathForBrowserHistory(newWorld.name, queryString),
    ...options
  };
  return loadWorld(newWorld, oldWorld, options);
}

export async function loadWorldFromDB (name, ref, oldWorld, options) {
  if (oldWorld) {
    oldWorld.name = null;
    if (oldWorld.metadata) oldWorld.metadata.commit = {};
  }
  const db = MorphicDB.default;
  const newWorld = await db.load('world', name, options, undefined/* commit||id */, ref || undefined);
  const queryString = typeof document !== 'undefined' ? document.location.search : '';
  options = {
    pathForBrowserHistory: pathForBrowserHistory(name, queryString),
    ...options
  };
  return loadWorld(newWorld, oldWorld, options);
}

export async function loadWorldFromURL (url, oldWorld, options) {
  const worldResource = url.isResource
    ? url
    : resource(System.decanonicalize(url));
  const name = worldResource.nameWithoutExt();
  return loadWorldFromDB(name, undefined, oldWorld, options);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function interactivelySaveWorld (world, options) {
  options = {
    showSaveDialog: true,
    useExpectedCommit: true,
    errorOnMissingExpectedCommit: false,
    confirmOverwrite: true,
    ...options
  };

  const { SaveWorldDialog } = await System.import('lively.ide/studio/dialogs.cp.js');
  let name = world.name; let tags = []; let description = '';
  const oldCommit = await ensureCommitInfo(Path('metadata.commit').get(world));
  let db = options.morphicdb || MorphicDB.default;
  let jsonStoragePath = '';
  let mode = 'db';

  if (options.showSaveDialog) {
    const dialog = part(SaveWorldDialog, {
      viewModel: oldCommit || {}
    });
    const { commit, db: dialogDB, mode: storageMode, filePath } = await world.openPrompt(dialog, { targetWorld: world });
    if (dialogDB) db = dialogDB;
    mode = storageMode;
    jsonStoragePath = filePath;
    ({ name, tags, description } = commit || {});
    if (!name) return null;
  } else if (oldCommit) {
    ({ name, tags, description } = oldCommit);
  }

  const i = $world.execCommand('open loading indicator', `saving ${name}...`);
  await promise.delay(80);

  if (mode === 'json') {
    const resourceHandle = resource(System.baseURL).join(jsonStoragePath).withRelativePartsResolved();

    if (await resourceHandle.exists()) {
      i.visible = false;
      const proceed = await $world.confirm([
        'File Conflict\n', {},
        'The file you want to save the world to\n', { fontSize: 15, fontWeight: 'normal' },
        resourceHandle.url, { textStyle: 'italic', fontSize: 15, fontWeight: 'normal' },
        '\n already exists. Overwrite?', { fontSize: 15, fontWeight: 'normal' }
      ], { lineWrapping: false });
      if (!proceed) {
        i.remove();
        return;
      }
      i.visible = true;
    } else await resourceHandle.ensureExistance();

    world.changeMetaData('file', jsonStoragePath, false, false);

    const snap = await createMorphSnapshot(world);
    await resourceHandle.writeJson(snap);
    await resource((await defaultDirectory(ShellClientResource.defaultL2lClient)) + '/..')
      .join(jsonStoragePath.replace('.json', '.br.json'))
      .withRelativePartsResolved()
      .brotli(JSON.stringify(snap));
    i.remove();
    world.setStatusMessage(`saved world ${name} to file: ${resourceHandle.url}`);
    return;
  }

  try {
    const snapshotOptions = {
      previewWidth: 200,
      previewHeight: 200,
      previewType: 'png',
      ignoreMorphs: [i],
      moduleManager: options.moduleManager
    };
    const ref = 'HEAD';
    const oldName = oldCommit ? oldCommit.name : world.name;
    let expectedParentCommit;

    if (options.useExpectedCommit) {
      if (oldName !== name && options.confirmOverwrite) {
        const { exists, commitId: existingCommitId } = await db.exists('world', name);
        if (exists) {
          i.center = world.windowBounds().center();
          i.visible = false;
          const overwrite = await world.confirm(['The world\n', { fontWeight: 'normal' }, `"${name}"`, { }, '\nalready exists, overwrite?', { fontWeight: 'normal' }], { hasFixedPosition: true, width: 350 });
          i.visible = true;
          if (!overwrite) return null;
          expectedParentCommit = existingCommitId;
        }
        world.name = name;
      } else {
        expectedParentCommit = oldCommit ? oldCommit._id : undefined;
      }
    }

    const commitSpec = {
      author: world.getCurrentUser(),
      message: 'world save',
      tags,
      description
    };
    const commit = await db.snapshotAndCommit(
      'world', name, world, snapshotOptions,
      commitSpec, ref, expectedParentCommit);

    // hist
    if (window.history) {
      const path = pathForBrowserHistory(name);
      window.history.pushState({}, 'lively.next', path);
    }

    world.setStatusMessage(`saved world ${name}`);
    world.get('world-list') && world.get('world-list').onWorldSaved(name);

    return commit;
  } catch (err) {
    if (err.message.includes('but no version entry exists') && !options.errorOnMissingExpectedCommit) {
      return interactivelySaveWorld(world, { ...options, morphicdb: db, useExpectedCommit: false, showSaveDialog: false });
    }

    const [_, __, expectedVersion, actualVersion] = err.message.match(/Trying to store "([^\"]+)" on top of expected version ([^\s]+) but ref HEAD is of version ([^\s\!]+)/) || [];
    if (expectedVersion && actualVersion) {
      const [newerCommit] = await db.log(actualVersion, 1, /* includeCommits = */true);
      let overwrite = true;
      if (options.confirmOverwrite) {
        const { author: { name: authorName }, timestamp } = newerCommit;
        const overwriteQ = `The current version of world ${name} is not the most recent!\n` +
                       `A newer version by ${authorName} was saved on ` +
                       `${date.format(new Date(timestamp), 'yyyy-mm-dd HH:MM')}. Overwrite?`;
        overwrite = await world.confirm(['Version Conflict\n', null, overwriteQ, { fontSize: 16, fontWeight: 'normal' }], { width: 600 });
      }
      if (!overwrite) return null;
      world.changeMetaData('commit', obj.dissoc(newerCommit, ['preview']), /* serialize = */true, /* merge = */false);
      return interactivelySaveWorld(world, { ...options, morphicdb: db, showSaveDialog: false });
    }

    console.error(err);
    world.logError('Error saving world: ' + err);
  } finally { i.remove(); }
}
