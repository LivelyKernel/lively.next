/* global System */
import { config, part } from 'lively.morphic';
import { resource } from 'lively.resources';
import { Path, obj, arr } from 'lively.lang';
import { LoadingIndicator } from 'lively.components';
import { removeUnreachableObjects } from 'lively.serializer2';

import { createMorphSnapshot, serializeMorph } from 'lively.morphic/serialization.js';
import { moduleOfId, isReference, referencesOfId, classNameOfId } from 'lively.serializer2/snapshot-navigation.js';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';

import { FreezerPrompt } from './src/ui.cp.js';
import LivelyRollup, { resolvePackage, decanonicalizeFileName } from './src/bundler.js';
import { transpileAttributeConnections } from './src/util/helpers.js';
import { topLevelDeclsAndRefs } from 'lively.ast/lib/query.js';
import { parse, stringify } from 'lively.ast';

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
  'lively.storage',
  'lively.user'
];

/**
 * Generates the html file that will serve as the index.html for loading the
 * frozen morph. Note that this convenience method only works when we freeze
 * instantiated morphs, it does not yet work when we bundle a library that
 * auto executes.
 * @param { Morph } part - The morph that is supposed to be frozen.
 * @returns { string } The html code of the index.html.
 */
export async function generateLoadHtml (partOrModule, importMap) {
  const htmlTemplate = await resource(await decanonicalizeFileName('lively.freezer/src/util/load-template.html')).read();
  // fixme: what to do when we receive a module?
  let title = partOrModule.title || partOrModule.name;
  let head = partOrModule.__head_html__ || '';
  let load = partOrModule.__loading_html__ || '';
  let crawler = partOrModule.__crawler_html__ || '';
  if (partOrModule.source) {
    // extract stuff from the source code
    if (importMap) {
      head += importMap;
    }
  }
  return htmlTemplate
    .replace('__TITLE_TAG__', title)
    .replace('__HEAD_HTML__', head)
    .replace('__LOADING_HTML__', load)
    .replace('__CRAWLER_HTML__', crawler);
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
  const userName = $world.getCurrentUser().name;
  const previouslyExcludedPackages = excludedModules || Path('metadata.excludedPackages').get(targetOrModule) || DEFAULT_EXCLUDED_MODULES;
  const previouslyPublishedDir = Path('metadata.publishedLocation').get(targetOrModule) ||
                                 resource(System.baseURL).join('users').join(userName).join('published').join(targetOrModule.name ||
                                 resolvePackage(targetOrModule).name).url;
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
    await freezerPrompt.whenRendered();
    freezerPrompt.center = pos; // wait for css layout...
    res = await freezerPrompt.activate();
  });
  return res;
}

async function rollupBundle ({ bundle, compress, output, requester }) {
  let res;
  try {
    res = await bundle.rollup(compress, output);
  } catch (e) {
    if (e.name === 'Exclusion Conflict') {
      // adjust the excluded Modules
      const proceed = await requester.world().confirm([
        e.message.replace('Could not load __root_module__:', ''), {}, '\n', {},
        'Packages are usually excluded to reduce the payload of a frozen interactive.\nIn order to fix this issue you can either remove the problematic package from the exclusion list,\nor remove the morph that requires this package directly. Removing the package from the\nexclusion list is a quick fix yet it may increase the payload of your frozen interactive substantially.',
        { fontSize: 13, fontWeight: 'normal' }
      ],
      {
        requester,
        width: 600,
        confirmLabel: 'Remove Package from Exclusion Set',
        rejectLabel: 'Cancel'
      });
      if (proceed) {
        bundle.excludedModules = e.reducedExclusionSet;
        return await rollupBundle();
      }
    }
    throw e;
  }
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
  return await rollupBundle({ bundle, compress, output, requester });
}

/**
 * Bundles a given part (in the form of a snapshot or as a live object) into a standalone
 * static website that can be loaded very quickly.
 */
// frozen = await bundleModule(module('galyleo-dashboard').id, { exclude: DEFAULT_EXCLUDED_MODULES, compress: true, requester: $world, mainFunction: 'main', useTerser: false })
export async function bundleModule (moduleId, {
  exclude: excludedModules = [],
  compress = false,
  output = 'es2019',
  requester,
  mainFunction,
  useTerser
}) {
  const bundle = new LivelyRollup({ excludedModules, rootModule: moduleId, mainFunction, useTerser, useLivelyWorld: true });
  return await rollupBundle({ bundle, compress, output, requester });
}

export async function jspmCompile (url, out, globalName, redirect = {}) {
  const m = new LivelyRollup({ rootModule: url, includePolyfills: false, globalName, redirect });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  const res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min);
}

export async function bootstrapLibrary (url, out, asBrowserModule = true, globalName) {
  const m = new LivelyRollup({ rootModule: url, asBrowserModule, globalName });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  const res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min);
}

/**
 * Handles the writing of all the files of a finished frozen bundle.
 * @param { object } frozen - A finished build.
 * @param { LoadingIndicator } li - Indicator to visualize the progress of writing the files.
 * @param { object } handles - Resource handles that will be utilized to write to the proper directory.
 * @param { HTTPResource } handles.dir - A http resource handle.
 * @param { ShellResource } handles.shell - A shell resource handle for sending shell commands to the server in order to compress files.
 */
async function writeFiles (frozen, li, { dir, shell }) {
  const target = frozen.part || frozen.rootModule;
  let currentFile = '';
  dir.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    li.progress = p;
    li.status = 'Writing file ' + currentFile + ' ' + (100 * p).toFixed() + '%';
  };
  currentFile = 'index.html';
  // if the module is split, include systemjs
  await dir.join(currentFile).write(await generateLoadHtml(target, frozen.importMap));

  if (obj.isArray(frozen)) {
    for (const splitModule of frozen) {
      currentFile = splitModule.fileName;
      await dir.join(currentFile).write(splitModule.min);
      try {
        await shell.join(currentFile + '.gz').gzip(splitModule.min);
        await shell.join(currentFile + '.br').brotli(splitModule.min);
      } catch (err) {

      }
    }
    currentFile = 'load.js';
    await dir.join(currentFile).write(frozen.load.min);
    try {
      currentFile = 'load.js.gz';
      await shell.join(currentFile).gzip(frozen.load.min);
      currentFile = 'load.js.br';
      await shell.join(currentFile).brotli(frozen.load.min);
    } catch (err) {

    }
  } else {
    currentFile = 'load.js';
    await dir.join(currentFile).write(frozen.min);
    currentFile = 'load.js.gz';
    await shell.join(currentFile).gzip(frozen.min);
    currentFile = 'load.js.br';
    await shell.join(currentFile).brotli(frozen.min);
  }

  await dir.join('@empty').write('');

  li.status = 'Copying assets...';
  const assetDir = await dir.join('assets/').ensureExistance();
  // copy font awesome assets
  await resource(config.css.fontAwesome).parent().copyTo(assetDir.join('fontawesome-free-6.1.1-web/css/'));
  await resource(config.css.fontAwesome).parent().parent().join('webfonts/').copyTo(assetDir.join('fontawesome-free-6.1.1-web/webfonts/'));
  // copy inconsoloata font
  await resource(config.css.inconsolata).parent().copyTo(assetDir.join('inconsolata/'));
  for (const asset of frozen.assets) {
    currentFile = asset.url;
    // skip if exists
    await asset.copyTo(assetDir);
  }

  // then copy over the style morphs
  li.status = 'Copying master components...';
  // replace this by prefetched master components
  for (const url in frozen.masterComponents) {
    const masterDir = await dir.join('masters/').ensureExistance();
    const masterFile = await masterDir
      .join(url.replace('styleguide://', '') + '.json')
      .ensureExistance();
    await masterFile.writeJson(frozen.masterComponents[url]);
  }

  li.remove();
  $world.setStatusMessage([`Published ${target.name || target.url}. Click `, null, 'here', {
    textDecoration: 'underline',
    fontWeight: 'bold',
    doit: { code: `window.open("${dir.join('index.html').url}")` }
  }, ' to view.'], StatusMessageConfirm, false);
}

/**
 * Function prompts the user for a name to publish the part under.
 * Data is uploaded to directory and then returns a link to the folder.
 */
export async function interactivelyFreezeWorld (world) {
  const userName = world.getCurrentUser().name;
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
  await writeFiles(frozen, li, { dir: publicationDir, shell: publicationDirShell });
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
      useTerser: options.useTerser,
      exclude: options.excludedPackages,
      requester: false
    });
    frozen.part = part;
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing Part', { status: 'Writing files...' });
  await writeFiles(frozen, li, { dir: publicationDir, shell: publicationDirShell });
}

export async function interactivelyFreezeModule (moduleUrl, requester) {
  const source = await resource(moduleUrl).read();
  const { varDecls } = topLevelDeclsAndRefs(parse(source));
  const excludedModuleNode = varDecls.find(decl => Path('declarations.0.id.name').get(decl) === 'EXCLUDED_MODULES');
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
      useTerser: options.useTerser,
      exclude: options.excludedPackages,
      mainFunction: options.mainFunction,
      requester
    });
    frozen.rootModule = { source, title };
  } catch (e) {
    throw e;
  }

  const li = LoadingIndicator.open('Freezing Module', { status: 'Writing files...' });

  writeFiles(frozen, li, { dir: publicationDir, shell: publicationDirShell });
}
