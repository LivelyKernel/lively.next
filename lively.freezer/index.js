/* global System */
import { rollup } from 'rollup';
import { part } from 'lively.morphic';
import { resource } from 'lively.resources';
import { Path, obj, arr } from 'lively.lang';
import { LoadingIndicator } from 'lively.components';
import { removeUnreachableObjects } from 'lively.serializer2';
import { createMorphSnapshot, serializeMorph } from 'lively.morphic/serialization.js';
import { moduleOfId, isReference, referencesOfId, classNameOfId } from 'lively.serializer2/snapshot-navigation.js';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';

import { FreezerPrompt } from './src/ui.cp.js';
import { transpileAttributeConnections, writeFiles } from './src/util/helpers.js';
import { topLevelDeclsAndRefs } from 'lively.ast/lib/query.js';
import { parse, stringify } from 'lively.ast';
import BrowserResolver from './src/resolvers/browser.js';
import { lively } from './src/plugins/rollup.js'; // for rollup

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
  'rollup',
  'lively.halos'
];

const DEFAULT_EXCLUDED_MODULES = [
  'lively.ast',
  'lively.vm',
  'lively-system-interface',
  'pouchdb',
  'pouchdb-adapter-mem',
  'rollup',
  'lively.halos',
  'lively.ide',
  'lively.freezer',
  'lively.modules',
  'lively.storage'
];

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
      snap.snapshot[id].props.askForName = { value: false };
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
 * @param { Morph|string } targetOrModule - The part/world to be frozen.
 * @param { Morph } requester - The tool that requested the prompt (usually the Object Editor)
 */
async function promptForFreezing (targetOrModule, requester, title = 'Freeze Part', excludedModules = false) {
  const freezerPrompt = part(FreezerPrompt, {
    submorphs: [
      {
        name: 'prompt title',
        textAndAttributes: [title, null]
      }
    ]
  });
  const userName = $world.currentUsername;
  const previouslyExcludedPackages = excludedModules || Path('metadata.excludedPackages').get(targetOrModule) || DEFAULT_EXCLUDED_MODULES;
  const previouslyPublishedDir = Path('metadata.publishedLocation').get(targetOrModule) ||
                                 resource(System.baseURL).join('users').join(userName).join('published').join(targetOrModule.name ||
                                 BrowserResolver.resolvePackage(targetOrModule).name).url;
  let res;
  await $world.withRequesterDo(requester, async (pos) => {
    freezerPrompt.isModuleBundle = typeof targetOrModule === 'string';
    if (freezerPrompt.isModuleBundle && requester.isBrowser) {
      freezerPrompt.mainCandidates = requester.renderedCodeEntities()
        .filter(node => node.type === 'function-decl')
        .map(node => node.name);
    }
    freezerPrompt.excludedPackages = previouslyExcludedPackages;
    freezerPrompt.directory = previouslyPublishedDir;
    freezerPrompt.openInWorld();
    freezerPrompt.env.forceUpdate();
    // FIXME: The above flush, should not be needed.
    //        layouts should implement a kind of "estimated bounds"
    //        flag on their submorphs before they are mounted
    //        in order to trigger a forced measure when we operate with
    //        geometrical properties such as 'center'.
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
  requester,
  useTerser
}) {
  const jsonPlugin = await System.import('esm://cache/@rollup/plugin-json');
  const snapshot = partOrSnapshot.isMorph
    ? await createMorphSnapshot(partOrSnapshot, {
      frozenSnapshot: true
    })
    : partOrSnapshot;
  transpileAttributeConnections(snapshot);
  const freezerPlugin = lively({
    excludedModules,
    snapshot, // use this as an entry point
    useTerser,
    resolver: BrowserResolver
  });
  const bundle = await rollup({
    plugins: [
      freezerPlugin,
      jsonPlugin({ exclude: /esm\:\/\/cache\/.*\.json/ })
    ]
  });
  return await bundle.generate({
    globalName: 'frozenPart',
    format: 'system',
    plugins: [freezerPlugin]
  });
  // TODO: just write the files...
}

/**
 * Bundles a given part (in the form of a snapshot or as a live object) into a standalone
 * static website that can be loaded very quickly.
 */
// import { module } from 'lively.modules';
// frozen = await bundleModule(module('galyleo-dashboard').id, { exclude: DEFAULT_EXCLUDED_MODULES, compress: true, requester: $world, mainFunction: 'main', useTerser: false })
export async function bundleModule (moduleId, {
  exclude: excludedModules = [],
  compress = false,
  minify = true,
  output = 'es2019',
  requester,
  mainFunction,
  htmlConfig,
  useTerser
}) {
  const { default: jsonPlugin } = await System.import('esm://cache/@rollup/plugin-json');
  // fixme: maybe its better to make the plugin devoid of state...?
  const bundle = await rollup({
    input: moduleId,
    plugins: [
      lively({
        excludedModules,
        mainFunction,
        useTerser,
        compress,
        minify,
        resolver: BrowserResolver,
        autoRun: htmlConfig
      }),
      jsonPlugin({ exclude: /esm\:\/\/cache\/.*\.json/ })
    ]
  });
  return await bundle.generate({
    format: 'system'
  });
}

export async function jspmCompile (url, out, globalName, redirect = {}) {
  const jsonPlugin = await System.import('esm://cache/@rollup/plugin-json');
  const freezerPlugin = lively({
    includePolyfills: false,
    redirect,
    resolver: BrowserResolver,
    excludedModules: ['babel-plugin-transform-jsx']
  });
  const bundle = await rollup({
    input: url,
    plugins: [
      freezerPlugin,
      jsonPlugin({ exclude: /esm\:\/\/cache\/.*\.json/ })
    ]
  });
  await bundle.generate({
    globalName,
    format: 'system',
    plugins: [freezerPlugin]
  });
}

export async function bootstrapLibrary (url, out, asBrowserModule = true, globalName) {
  const jsonPlugin = await System.import('esm://cache/@rollup/plugin-json');
  const bundle = await rollup({
    input: url,
    plugins: [
      lively({
        asBrowserModule,
        resolver: BrowserResolver,
        excludedModules: ['babel-plugin-transform-jsx']
      }),
      jsonPlugin({ exclude: /esm\:\/\/cache\/.*\.json/ })
    ]
  });
  await bundle.generate({
    format: 'system',
    globalName
  });
}

/**
 * Function prompts the user for a name to publish the part under.
 * Data is uploaded to directory and then returns a link to the folder.
 */
export async function interactivelyFreezeWorld (world) {
  const userName = world.currentUsername;
  let publicAlias = world.metadata.commit.name;
  const frozenPartsDir = await resource(System.baseURL).join('users').join(userName).join('published/').ensureExistance();
  const publicationDirShell = resource(await defaultDirectory()).join('..').join('users').join(userName).join('published/').withRelativePartsResolved().asDirectory();

  let publicationDir = frozenPartsDir.join(publicAlias + '/');
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
    frozen.part = world;
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing World', { status: 'Writing files...' });
  await writeFiles(frozen, li, { dir: publicationDir, shell: publicationDirShell, resolver: BrowserResolver });
}

/**
 * Function prompts the user for a name to publish the part under.
 * Data is uploaded to directory and then returns a link to the folder.
 */
export async function interactivelyFreezePart (part, requester = false) {
  const options = await promptForFreezing(part, requester, 'Freeze Part');

  if (!options) return;
  const publicationDir = await resource(System.baseURL).join(options.location).asDirectory().ensureExistance();
  const publicationDirShell = resource(await defaultDirectory()).join('..').join(options.location).withRelativePartsResolved().asDirectory();

  part.changeMetaData('excludedPackages', options.excludedPackages, true, false);
  part.changeMetaData('publishedLocation', options.location, true, false);

  let worldSnap;
  if (part.isWorld) {
    worldSnap = clearWorldSnapshot(serializeMorph(part));
  }

  // freeze the part
  let frozen;
  try {
    frozen = await bundlePart(worldSnap || part, {
      compress: true,
      minify: options.minify,
      useTerser: options.useTerser,
      exclude: options.excludedPackages,
      requester: false
    });
    frozen.part = part;
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing Part', { status: 'Writing files...' });
  await writeFiles(frozen, li, { dir: publicationDir, shell: publicationDirShell, resolver: BrowserResolver });
}

export async function interactivelyFreezeModule (moduleUrl, requester) {
  const source = await resource(moduleUrl).read();
  const { varDecls } = topLevelDeclsAndRefs(parse(source));
  const excludedModuleNode = varDecls.find(decl => Path('declarations.0.id.name').get(decl) === 'EXCLUDED_MODULES');
  // fixme: what about head, loadHtml etc?
  const titleNode = varDecls.find(decl => Path('declarations.0.id.name').get(decl) === 'TITLE');
  let excludedModules = DEFAULT_EXCLUDED_MODULES; let title = moduleUrl;
  try {
    excludedModules = eval(stringify(excludedModuleNode.declarations[0].init));
    title = eval(stringify(titleNode.declarations[0].init));
  } catch (err) {
    // do nothing
  }
  const options = await promptForFreezing(moduleUrl, requester, 'Freeze Module', excludedModules);
  if (!options) return;
  const publicationDir = await resource(System.baseURL).join(options.location).asDirectory().ensureExistance();
  const publicationDirShell = resource(await defaultDirectory()).join('..').join(options.location).withRelativePartsResolved().asDirectory();

  // check for excluded modules
  let frozen;
  try {
    frozen = await bundleModule(moduleUrl, {
      compress: true,
      minify: options.minify,
      useTerser: options.useTerser,
      exclude: options.excludedPackages,
      htmlConfig: { title }, // auto generate a index.html that does the absolute basics
      requester
    });
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing Module', { status: 'Writing files...' });

  await writeFiles(frozen, li, { dir: publicationDir, shell: publicationDirShell, resolver: BrowserResolver });
}
