/* global System */
import { config, morph } from 'lively.morphic';
import { part } from 'lively.morphic/components/core.js';
import {
  createMorphSnapshot,
  serializeMorph
} from 'lively.morphic/serialization.js';
import * as modules from 'lively.modules';

import { resource } from 'lively.resources';
import { Path, obj, arr } from 'lively.lang';
import { Color } from 'lively.graphics';
import { LoadingIndicator } from 'lively.components';
import { removeUnreachableObjects } from 'lively.serializer2';
import { moduleOfId, isReference, referencesOfId, classNameOfId } from 'lively.serializer2/snapshot-navigation.js';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';

import { StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';
import { FreezerPrompt } from './src/ui.cp.js';
import LivelyRollup from './src/bundler.js';
import { transpileAttributeConnections } from './src/util/helpers.js';

const { module } = modules;

/*

How to build the bootstrap and memory adapters with the freezer. Will replace build scripts completely in the future.

await bootstrapLibrary('lively.classes/runtime.js', '/classes.runtime.min.js',);
await bootstrapLibrary('/lively.server/index-base.js', 'lively.server/bin/server.min.js', false)
await bootstrapLibrary('lively.morphic/web/bootstrap.js', 'lively.morphic/web/lively.bootstrap.min.js');
await bootstrapLibrary('lively.modules/tools/bootstrap.js', 'lively.modules/dist/new_lively.modules.bootstrap.min.js', false, 'lively.modules');

await jspmCompile(
  url = 'https://dev.jspm.io/pouchdb-adapter-memory',
  out = 'lively.storage/dist/pouchdb-adapter-mem.min.js',
  globalName = 'window.pouchdbAdapterMem', redirect = {
   "https://dev.jspm.io/npm:ltgt@2.1.3/index.dew.js": "https://dev.jspm.io/npm:ltgt@2.2.1/index.dew.js"
  }
)
*/

// fixme: Why is that a difference between parts and worlds? Why do we need kld-intersections at all?
const DEFAULT_EXCLUDED_MODULES_PART = [
  'kld-intersections'
];

const DEFAULT_EXCLUDED_MODULES_WORLD = [
  'lively.ast',
  'lively.vm',
  'lively-system-interface',
  'pouchdb',
  'pouchdb-adapter-mem',
  'https://unpkg.com/rollup@1.17.0/dist/rollup.browser.js',
  'lively.halos'
];

/**
 * Generates the html file that will serve as the index.html for loading the
 * frozen morph. Note that this convenience method only works when we freeze
 * instantiated morphs, it does not yet work when we bundle a library that
 * auto executes.
 * @param { Morph } part - The morph that is supposed to be frozen.
 * @returns { string } The html code of the index.html.
 */
export async function generateLoadHtml (part) {
  const htmlTemplate = await resource(System.decanonicalize('lively.freezer/src/util/load-template.html')).read();
  return htmlTemplate
    .replace('__TITLE_TAG__', part.title || part.name)
    .replace('__HEAD_HTML__', part.__head_html__ || '')
    .replace('__LOADING_HTML__', part.__loading_html__ || '')
    .replace('__CRAWLER_HTML__', part.__crawler_html__ || '');
}

/**
 * This clears up all of the ide related tools that may be still present in the world
 * but are not meant to be bundled. There is also some minor cleanup of unneeded data
 * and attribute connections.
 * @param { object } snap - The snapshot of the world.
 */
function clearWorldSnapshot (snap) {
  const deletedIds = [];
  const toolIds = [];
  obj.values(snap.snapshot).forEach(m => delete m.props.metadata);
  transpileAttributeConnections(snap);
  // remove objects that are part of the lively.ide or lively.halo package (dev tools)
  for (const id in snap.snapshot) {
    delete snap.snapshot[id].props.localComponents; // remove local components since we dont need them in frozen snaps
    delete snap.snapshot[id].props.metadata;
    delete snap.snapshot[id]._cachedLineCharBounds;
    if (id === snap.id) {
      snap.snapshot[id].props.showsUserFlap = { value: false };
    }
    const module = moduleOfId(snap.snapshot, id);
    if (!module.package) continue;
    if (module.package.name === 'lively.ide') toolIds.push(id);
    if (DEFAULT_EXCLUDED_MODULES_WORLD.includes(module.package.name)) {
      // fixme: we also need to kill of packages which themselves require one of the "taboo" packages
      delete snap.snapshot[id];
      deletedIds.push(id);
      continue;
    }
  }

  // remove all windows that are emptied due to the clearance process or contain tools
  for (const id in snap.snapshot) {
    const className = classNameOfId(snap.snapshot, id);
    if (arr.intersect(referencesOfId(snap.snapshot, id), [...deletedIds, ...toolIds]).length > 0) {
      if (className === 'Window') {
        delete snap.snapshot[id];
        continue;
      }
      for (const [key, { value: v }] of Object.entries(snap.snapshot[id].props)) {
        if (isReference(v) && deletedIds.includes(v.id)) {
          delete snap.snapshot[id].props[key];
        }
        if (Array.isArray(v)) {
          // also remove references that are stuck inside array values
          snap.snapshot[id].props[key].value = v.filter(v => !(isReference(v) && deletedIds.includes(v.id)));
        }
      }
    }
  }
  removeUnreachableObjects([snap.id], snap.snapshot);
  return snap;
}

/**
 * The prompts the user to configure and confirm the settings for 
 * the bunding process,
 * @param { Morph } target - The part/world to be frozen.
 * @param { Morph } requester - The tool that requested the prompt (usually the Object Editor)
 */
async function promptForFreezing (target, requester) {
  const freezerPrompt = part(FreezerPrompt);
  const userName = $world.getCurrentUser().name;
  const previouslyExcludedPackages = Path('metadata.excludedPackages').get(target);
  const previouslyPublishedDir = Path('metadata.publishedLocation').get(target) || resource(System.baseURL).join('users').join(userName).join('published').join(target.name).url;
  let res;
  await $world.withRequesterDo(requester, async (pos) => {
    freezerPrompt.excludedPackages = previouslyExcludedPackages;
    freezerPrompt.directory = previouslyPublishedDir;
    freezerPrompt.openInWorld();
    freezerPrompt.center = pos;
    res = await freezerPrompt.activate();
  });
  return res;
}

/**
 * Bundles a given part (in the form of a snapshot or as a live object) into a standalone
 * static website that can be loaded very quickly.
 */
export async function bundlePart (partOrSnapshot, {
  exclude: excludedModules = [],
  compress = false,
  output = 'es2019',
  requester,
  useTerser
}) {
  const snapshot = partOrSnapshot.isMorph
    ? await createMorphSnapshot(partOrSnapshot, {
      frozenSnapshot: true
    })
    : partOrSnapshot;
  transpileAttributeConnections(snapshot);
  const bundle = new LivelyRollup({ excludedModules, snapshot, useTerser });
  const rollupBundle = async () => {
    let res;
    try {
      res = await bundle.rollup(compress, output);
    } catch (e) {
      if (e.name === 'Exclusion Conflict') {
        // adjust the excluded Modules
        const proceed = await $world.confirm([
          e.message.replace('Could not load __root_module__:', ''), {}, '\n', {}, 'Packages are usually excluded to reduce the payload of a frozen interactive.\nIn order to fix this issue you can either remove the problematic package from the exclusion list,\nor remove the morph that requires this package directly. Removing the package from the\nexclusion list is a quick fix yet it may increase the payload of your frozen interactive substantially.', { fontSize: 13, fontWeight: 'normal' }], { requester, width: 600, confirmLabel: 'Remove Package from Exclusion Set', rejectLabel: 'Cancel' });
        if (proceed) {
          bundle.excludedModules = e.reducedExclusionSet;
          return await rollupBundle();
        }
      }
      throw e;
    }
    return res;
  };
  return await rollupBundle();
}

export async function jspmCompile (url, out, globalName, redirect = {}) {
  module(url)._source = null;
  const m = new LivelyRollup({ rootModule: module(url), includePolyfills: false, globalName, redirect });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  const res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min);
}

export async function bootstrapLibrary (url, out, asBrowserModule = true, globalName) {
  module(url)._source = null;
  const m = new LivelyRollup({ rootModule: module(url), asBrowserModule, globalName });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  const res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min);
}

export async function interactivelyFreezeWorld (world) {
  /*
    Function prompts the user for a name to publish the part under.
    Data is uploaded to directory and then returns a link to the folder.
  */
  const userName = $world.getCurrentUser().name;
  const frozenPartsDir = await resource(System.baseURL).join('users').join(userName).join('published/').ensureExistance();
  let publicAlias = world.metadata.commit.name;
  let publicationDir = frozenPartsDir.join(publicAlias + '/');
  const assetDir = await publicationDir.join('assets/').ensureExistance();
  while (await publicationDir.exists()) {
    const proceed = await $world.confirm(`A world published as "${publicAlias}" already exists.\nDo you want to overwrite this publication?`, {
      rejectLabel: 'CHANGE NAME'
    });
    if (proceed) break;
    publicAlias = await $world.prompt('Please enter a different name for this published world:');
    if (!publicAlias) return;
    publicationDir = frozenPartsDir.join(publicAlias + '/');
  }

  await publicationDir.ensureExistance();

  // remove the metadata props
  const worldSnap = clearWorldSnapshot(serializeMorph(world));

  // freeze the world
  let frozen;
  try {
    frozen = await bundlePart(worldSnap, {
      compress: true,
      exclude: DEFAULT_EXCLUDED_MODULES_WORLD
    });
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing World', { status: 'Writing files...' });
  await publicationDir.join('index.html').write(await generateLoadHtml(world, frozen.format));
  await publicationDir.join('load.js').write(frozen.min);
  li.status = 'copying asset files...';
  for (const asset of frozen.assets) await asset.copyTo(assetDir);
  const dynamicParts = await publicationDir.join('dynamicParts/').ensureExistance();
  for (const [partName, snapshot] of Object.entries(frozen.dynamicParts)) {
    await dynamicParts.join(partName + '.json').writeJson(snapshot);
  }
  li.remove();
  $world.setStatusMessage([`Published ${publicAlias}. Click `, null, 'here', {
    textDecoration: 'underline',
    fontWeight: 'bold',
    doit: { code: `window.open("${publicationDir.join('index.html').url}")` }
  }, ' to view.'], StatusMessageConfirm, 10000);
}

export async function interactivelyFreezePart (part, requester = false) {
  /*
    Function prompts the user for a name to publish the part under.
    Data is uploaded to directory and then returns a link to the folder.
  */

  const options = await promptForFreezing(part, requester);

  if (!options) return;
  const publicationDir = await resource(System.baseURL).join(options.location).asDirectory().ensureExistance();
  const publicationDirShell = resource(await defaultDirectory()).join('..').join(options.location).withRelativePartsResolved().asDirectory();

  part.changeMetaData('excludedPackages', options.excludedPackages, true, false);
  part.changeMetaData('publishedLocation', options.location, true, false);

  await publicationDir.ensureExistance();

  let worldSnap;
  if (part.isWorld) {
    worldSnap = clearWorldSnapshot(serializeMorph(part));
  }

  // freeze the part
  let frozen;
  try {
    frozen = await bundlePart(worldSnap || part, {
      compress: true,
      useTerser: options.useTerser,
      exclude: options.excludedPackages,
      requester: false
    });
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing Part', { status: 'Writing files...' });
  let currentFile = '';
  publicationDir.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    li.progress = p;
    li.status = 'Writing file ' + currentFile + ' ' + (100 * p).toFixed() + '%';
  };
  currentFile = 'index.html';
  // if the module is split, include systemjs
  await publicationDir.join(currentFile).write(await generateLoadHtml(part, frozen.format));

  if (obj.isArray(frozen)) {
    for (const part of frozen) {
      currentFile = part.fileName;
      await publicationDir.join(currentFile).write(part.min);
      try {
        await publicationDirShell.join(currentFile + '.gz').gzip(part.min);
        await publicationDirShell.join(currentFile + '.br').brotli(part.min);
      } catch (err) {

      }
    }
    currentFile = 'load.js';
    await publicationDir.join(currentFile).write(frozen.load.min);
    try {
      currentFile = 'load.js.gz';
      await publicationDirShell.join(currentFile).gzip(frozen.load.min);
      currentFile = 'load.js.br';
      await publicationDirShell.join(currentFile).brotli(frozen.load.min);
    } catch (err) {

    }
  } else {
    currentFile = 'load.js';
    await publicationDir.join(currentFile).write(frozen.min);
    currentFile = 'load.js.gz';
    await publicationDirShell.join(currentFile).gzip(frozen.min);
    currentFile = 'load.js.br';
    await publicationDirShell.join(currentFile).brotli(frozen.min);
  }

  li.status = 'Copying dynamic parts...'; // to be unified by url parts fetching
  const dynamicParts = await publicationDir.join('dynamicParts/').ensureExistance();
  for (const [partName, snapshot] of Object.entries(frozen.dynamicParts)) {
    if (partName.startsWith('part://')) {
      frozen.masterComponents[partName.replace('part://', 'styleguide://')] = snapshot;
      continue;
    }
    currentFile = partName + '.json';
    await dynamicParts.join(currentFile).writeJson(snapshot);
  }
  li.status = 'Copying assets...';
  const assetDir = await publicationDir.join('assets/').ensureExistance();
  // copy font awesome assets
  await resource(config.css.fontAwesome).parent().copyTo(assetDir.join('fontawesome-free-5.12.1/css/'));
  await resource(config.css.fontAwesome).parent().parent().join('webfonts/').copyTo(assetDir.join('fontawesome-free-5.12.1/webfonts/'));
  // copy inconsoloata
  await resource(config.css.inconsolata).parent().copyTo(assetDir.join('inconsolata/'));
  for (const asset of frozen.assets) {
    currentFile = asset.url;
    // skip if exists
    // if (await assetDir.join(asset.name()).exists()) continue;
    await asset.copyTo(assetDir);
  }

  // then copy over the style morphs
  li.status = 'Copying master components...';
  // replace this by prefetched master components
  const masterDir = await publicationDir.join('masters/').ensureExistance();
  for (const url in frozen.masterComponents) {
    const masterFile = await masterDir
      .join(url.replace('styleguide://', '') + '.json')
      .ensureExistance();
    await masterFile.writeJson(frozen.masterComponents[url]);
  }

  li.remove();
  $world.setStatusMessage([`Published ${part.name}. Click `, null, 'here', {
    textDecoration: 'underline',
    fontWeight: 'bold',
    doit: { code: `window.open("${publicationDir.join('index.html').url}")` }
  }, ' to view.'], StatusMessageConfirm, false);
}
