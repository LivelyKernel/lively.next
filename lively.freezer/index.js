/* global System,TextEncoder */
import * as Rollup from 'rollup';
import jsonPlugin from 'https://jspm.dev/@rollup/plugin-json';
import { MorphicDB, config, morph } from 'lively.morphic';
import {
  createMorphSnapshot, serializeMorph,
  loadPackagesAndModulesOfSnapshot,
  findRequiredPackagesOfSnapshot
} from 'lively.morphic/serialization.js';
import * as modules from 'lively.modules';
import * as ast from 'lively.ast';
import * as classes from 'lively.classes';
import { resource } from 'lively.resources';

import { es5Transpilation, stringifyFunctionWithoutToplevelRecorder } from 'lively.source-transform';
import {
  rewriteToCaptureTopLevelVariables,
  insertCapturesForExportedImports
} from 'lively.source-transform/capturing.js';
import { Path, obj, promise, string, arr, fun } from 'lively.lang';
import { Color } from 'lively.graphics';
import { LoadingIndicator } from 'lively.components';
import { requiredModulesOfSnapshot, ExpressionSerializer, serialize, locateClass, removeUnreachableObjects } from 'lively.serializer2';
import { moduleOfId, isReference, referencesOfId, classNameOfId } from 'lively.serializer2/snapshot-navigation.js';
import { runCommand, defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { loadPart } from 'lively.morphic/partsbin.js';
import { runEval } from 'lively.vm';
import { localInterface } from 'lively-system-interface';

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

async function jspmCompile (url, out, globalName, redirect = {}) {
  module(url)._source = null;
  const m = new LivelyRollup({ rootModule: module(url), includePolyfills: false, globalName, includeRuntime: false, jspm: true, redirect });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  const res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min);
}

async function bootstrapLibrary (url, out, asBrowserModule = true, globalName) {
  module(url)._source = null;
  const m = new LivelyRollup({ rootModule: module(url), asBrowserModule, globalName, includeRuntime: false, jspm: true });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  const res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min);
}

function fixSourceForBugsInGoogleClosure (id, source) {
  /*
    rms 27.9.20
    Given that Google Closure is at the core of what anything that drives this company's revenue,
    it is surprising how often it can be crashed by certain kinds of syntax trees.
    This method checks for known issues with certain modules, and attempts to fix the source accordingly.
  */
  if (id.includes('rollup')) {
    return source.replace('if(({entryModules:this.entryModules,implicitEntryModules:this.implicitEntryModules}=await this.moduleLoader.addEntryModules((e=this.options.input,Array.isArray(e)?e.map(e=>({fileName:null,id:e,implicitlyLoadedAfter:[],importer:void 0,name:null})):Object.keys(e).map(t=>({fileName:null,id:e[t],implicitlyLoadedAfter:[],importer:void 0,name:t}))),!0)),0===this.entryModules.length)',
      `({entryModules:this.entryModules,implicitEntryModules:this.implicitEntryModules}=await this.moduleLoader.addEntryModules((e=this.options.input,Array.isArray(e)?e.map(e=>({fileName:null,id:e,implicitlyLoadedAfter:[],importer:void 0,name:null})):Object.keys(e).map(t=>({fileName:null,id:e[t],implicitlyLoadedAfter:[],importer:void 0,name:t}))),!0))
      if(0===this.entryModules.length)`);
  }
  if (id.includes('lottie-web') && source.includes('var loopIn, loop_in, loopOut, loop_out, smooth;')) {
    return source.replace('var loopIn, loop_in, loopOut, loop_out, smooth;', `function __capture__(...args) { if (args[100]) console.log(args) }; var loopIn, loop_in, loopOut, loop_out, smooth; __capture__($bm_sum, $bm_sub, $bm_mul, $bm_div, $bm_mod, radiansToDegrees, length);
`);
  }
  return source;
}

// The exclusion sets are used for optimization of the generated package.
// TODO: make the selection of excluded packages more comprehensive and part of the future freeze wizard

const CLASS_INSTRUMENTATION_MODULES = [
  'lively.morphic',
  'lively.components',
  'lively.ide',
  'lively.halos',
  'lively.user',
  'lively.bindings',
  'typeshift.components',
  'lively.collab',
  'https://jspm.dev/npm:rollup@2.28.2' // this contains a bunch of class definitions which right now screws up the closure compiler
];

const ESM_CDNS = ['jspm.dev', 'jspm.io', 'skypack.dev'];

const CLASS_INSTRUMENTATION_MODULES_EXCLUSION = [
  'lively.lang'
];

const ADVANCED_EXCLUDED_MODULES = [
  'lively.ast',
  'lively.vm',
  'lively.ide',
  'lively.modules',
  'babel-plugin-transform-jsx',
  'lively-system-interface',
  'lively.storage',
  'lively.collab',
  'localconfig.js'
];

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

function generateResourceExtensionModule (frozenPart) {
  return `
    import { resource, unregisterExtension, registerExtension } from "lively.resources";
    import { PartResource } from "lively.morphic/partsbin.js";
    import { StyleGuideResource } from "lively.morphic/style-guide.js";
    
    const partURLRe = /^part:\\/\\/([^\\/]+)\\/(.*)$/;
    
    class FrozenPartResource extends PartResource {
      async read() {
        switch (this.url) {
          ${
            Object.keys(frozenPart.dynamicParts).map(partUrl => `
              case "${partUrl}":
                return (await import("[PART_MODULE]${partUrl}") && await super.read());`).join('\n')
           }
           default:
             return await super.read();
        }
      }
    }
    
    const frozenPart = {
      name: 'part',
      matches: (url) => url.match(partURLRe),
      resourceClass: FrozenPartResource
    }
    
    unregisterExtension('part')
    registerExtension(frozenPart)
    
    // do this also for styleguides to remove funny frozen code from the style guide code
    
    class FrozenStyleGuideResource extends StyleGuideResource {
      get worldName() {
        const match = this.url.match(styleGuideURLRe);
        let [_, worldName, name] = match;
        return worldName;
      }
    
      async read() {
        let rootDir = resource(System.baseURL);
        if (rootDir.isFile()) rootDir = rootDir.parent();
        const masterDir = rootDir.join('masters/');
        const component = await this.fetchFromMasterDir(masterDir, this.componentName);
        return await this.resolveComponent(component);
      }
    }
    
    const styleGuideURLRe = /^styleguide:\\/\\/([^\\/]+)\\/(.*)$/;
    
    const frozenStyleGuide = {
      name: 'styleguide',
      matches: (url) => url.match(styleGuideURLRe),
      resourceClass: FrozenStyleGuideResource
    }
    
    unregisterExtension('styleguide')
    registerExtension(frozenStyleGuide)
  `;
}

export async function generateLoadHtml (part, format = 'global') {
  const addScripts = `
      <noscript>
         <meta http-equiv="refresh" content="0;url=noscript.html">
      </noscript>
      <title>${part.title || part.name}</title>
      ${part.__head_html__ || ''}
      <link type="text/css" rel="stylesheet" id="lively-font-awesome" href="assets/fontawesome-free-5.12.1/css/all.css">
      <link type="text/css" rel="stylesheet" id="lively-font-inconsolata" href="assets/inconsolata/inconsolata.css">
      <style>
        #prerender {
           position: absolute
        }
        html {
          touch-action: manipulation;
        }
        .Morph {
          touch-action: manipulation;
        }
      </style> 
      <script>
        if (!window.location.origin) {
          window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
        }
        lively = {};
      </script>
      <script>
      // check browser support
        var browser = (function (agent) {
        switch (true) {
            case agent.indexOf("edge") > -1: return "edge";
            case agent.indexOf("edg") > -1: return "chromium based edge (dev or canary)";
            case agent.indexOf("opr") > -1 && !!window.opr: return "opera";
            case agent.indexOf("chrome") > -1 && !!window.chrome: return "chrome";
            case agent.indexOf("trident") > -1: return "ie";
            case agent.indexOf("firefox") > -1: return "firefox";
            case agent.indexOf("safari") > -1: return "safari";
            default: return "other";
        }
        })(window.navigator.userAgent.toLowerCase());
        if (browser == 'edge' || browser =='ie') {
          window.BROWSER_UNSUPPORTED = true;
        }
      </script>
      <link rel="preload" id="loader" href="load.js" as="script">`;

  let html = `
     <!DOCTYPE html>
     <head>
     <meta content="utf-8" http-equiv="encoding">
     <meta name="viewport" content="minimum-scale=1.0, maximum-scale=1.0, initial-scale=1.0, width=device-width">
     <meta content="text/html;charset=utf-8" http-equiv="Content-Type">
     <meta name="apple-mobile-web-app-capable" content="yes">
     <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`;
  html += addScripts;
  html += `</head><body style="margin: 0; overflow-x: hidden; width: 100%; height: 100%;"><div id="loading-screen">${part.__loading_html__ || ''}</div><div id="crawler content">${part.__crawler_html__ || ''}</div>
<script id="crawler checker">
    var botPattern = "(googlebot\/|Googlebot-Mobile|Googlebot-Image|Google favicon|Mediapartners-Google|bingbot|slurp|java|wget|curl|Commons-HttpClient|Python-urllib|libwww|httpunit|nutch|phpcrawl|msnbot|jyxobot|FAST-WebCrawler|FAST Enterprise Crawler|biglotron|teoma|convera|seekbot|gigablast|exabot|ngbot|ia_archiver|GingerCrawler|webmon |httrack|webcrawler|grub.org|UsineNouvelleCrawler|antibot|netresearchserver|speedy|fluffy|bibnum.bnf|findlink|msrbot|panscient|yacybot|AISearchBot|IOI|ips-agent|tagoobot|MJ12bot|dotbot|woriobot|yanga|buzzbot|mlbot|yandexbot|purebot|Linguee Bot|Voyager|CyberPatrol|voilabot|baiduspider|citeseerxbot|spbot|twengabot|postrank|turnitinbot|scribdbot|page2rss|sitebot|linkdex|Adidxbot|blekkobot|ezooms|dotbot|Mail.RU_Bot|discobot|heritrix|findthatfile|europarchive.org|NerdByNature.Bot|sistrix crawler|ahrefsbot|Aboundex|domaincrawler|wbsearchbot|summify|ccbot|edisterbot|seznambot|ec2linkfinder|gslfbot|aihitbot|intelium_bot|facebookexternalhit|yeti|RetrevoPageAnalyzer|lb-spider|sogou|lssbot|careerbot|wotbox|wocbot|ichiro|DuckDuckBot|lssrocketcrawler|drupact|webcompanycrawler|acoonbot|openindexspider|gnam gnam spider|web-archive-net.com.bot|backlinkcrawler|coccoc|integromedb|content crawler spider|toplistbot|seokicks-robot|it2media-domain-crawler|ip-web-crawler.com|siteexplorer.info|elisabot|proximic|changedetection|blexbot|arabot|WeSEE:Search|niki-bot|CrystalSemanticsBot|rogerbot|360Spider|psbot|InterfaxScanBot|Lipperhey SEO Service|CC Metadata Scaper|g00g1e.net|GrapeshotCrawler|urlappendbot|brainobot|fr-crawler|binlar|SimpleCrawler|Livelapbot|Twitterbot|cXensebot|smtbot|bnf.fr_bot|A6-Indexer|ADmantX|Facebot|Twitterbot|OrangeBot|memorybot|AdvBot|MegaIndex|SemanticScholarBot|ltx71|nerdybot|xovibot|BUbiNG|Qwantify|archive.org_bot|Applebot|TweetmemeBot|crawler4j|findxbot|SemrushBot|yoozBot|lipperhey|y!j-asr|Domain Re-Animator Bot|AddThis)";
    var re = new RegExp(botPattern, 'i');
    var userAgent = navigator.userAgent;
    if (!re.test(userAgent) && !window.BROWSER_UNSUPPORTED) {
      document.getElementById("crawler content").remove();
      var script = document.createElement('script');
      script.setAttribute('src',"load.js");
      script.onload = function() {
        if (window.frozenPart && window.frozenPart.renderFrozenPart)
          window.frozenPart.renderFrozenPart();
      }
      document.head.appendChild(script);
    }
    document.getElementById("crawler checker").remove();
</script>
</body>`;
  return html;
}

function clearWorldSnapshot (snap) {
  const deletedIds = [];
  const toolIds = [];
  obj.values(snap.snapshot).forEach(m => delete m.props.metadata);
  // remove objects that are part of the lively.ide or lively.halo package (dev tools)
  for (const id in snap.snapshot) {
    delete snap.snapshot[id].props.localComponents; // remove local components since we dont need them in frozen snaps
    delete snap.snapshot[id].props.metadata;
    delete snap.snapshot[id]._cachedLineCharBounds;
    if (id == snap.id) {
      snap.snapshot[id].props.showsUserFlap = { value: false };
    }
    const module = moduleOfId(snap.snapshot, id);
    if (!module.package) continue;
    if (module.package.name == 'lively.ide') toolIds.push(id);
    if (DEFAULT_EXCLUDED_MODULES_WORLD.includes(module.package.name)) {
      // fixme: we also need to kill of packages which themselves require one of the "taboo" packages
      delete snap.snapshot[id];
      deletedIds.push(id);
      continue;
    }

    // transform sources for attribute connections
    if (classNameOfId(snap.snapshot, id) === 'AttributeConnection') {
      const props = snap.snapshot[id].props;
      if (props.converterString) {
        props.converterString.value = es5Transpilation(`(${props.converterString.value})`);
      }
      if (props.updaterString) {
        props.updaterString.value = es5Transpilation(`(${props.updaterString.value})`);
      }
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
        if (arr.isArray(v)) {
          // also remove references that are stuck inside array values
          snap.snapshot[id].props[key].value = v.filter(v => !(isReference(v) && deletedIds.includes(v.id)));
        }
      }
    }
  }
  removeUnreachableObjects([snap.id], snap.snapshot);
  return snap;
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
  }, ' to view.'], Color.green, 10000);
}

async function promptForFreezing (target, requester) {
  const freezerPrompt = await resource('part://SystemDialogs/freezer prompt').read();
  const userName = $world.getCurrentUser().name;
  const previouslyExcludedPackages = Path('metadata.excludedPackages').get(target) || ADVANCED_EXCLUDED_MODULES;
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

let masterComponents;

export async function interactivelyFreezePart (part, requester = false) {
  /*
    Function prompts the user for a name to publish the part under.
    Data is uploaded to directory and then returns a link to the folder.
  */

  const userName = $world.getCurrentUser().name;
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
  masterComponents = frozen.masterComponents;
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
  }, ' to view.'], Color.green, false);
}

export async function displayFrozenPartsFor (user = $world.getCurrentUser(), requester) {
  const userName = user.name;
  const frozenPartsDir = resource(System.baseURL).join('users').join(userName).join('published/');
  if (!await frozenPartsDir.exists()) return;
  const publishedItems = (await frozenPartsDir.dirList()).map(dir => [dir.name(), dir.join('index.html').url]);
  $world.filterableListPrompt('Published Parts', publishedItems.map(([name, url]) => {
    return {
      isListItem: true,
      autoFit: true,
      string: name,
      morph: morph({
        type: 'text',
        fontSize: 14,
        fontColor: Color.white,
        fill: Color.transparent,
        readOnly: true,
        fixedWidth: true,
        textAndAttributes: [url.replace(System.baseURL, ''), {
          link: url, fontColor: 'inherit'
        }, name, {
          fontStyle: 'italic',
          fontWeight: 'bold',
          textStyleClasses: ['annotation', 'truncated-text']
        }]
      })
    };
  }), {
    requester,
    fuzzy: true,
    onSelection: (_, prompt) => {
      prompt.submorphs[2].items.forEach(item => item.morph.fontColor = Color.white);
      if (prompt.submorphs[2].selectedItems[0]) { prompt.submorphs[2].selectedItems[0].morph.fontColor = Color.black; }
    }
  });
}

/* HELPERS */

function belongsToObjectPackage (moduleId) {
  return Path('config.lively.isObjectPackage').get(module(moduleId).package());
}

function belongsToLivelyPackage (moduleId) {
  const pkg = module(moduleId).package();
  return pkg && pkg.name.startsWith('lively');
}

function cleanSnapshot ({ snapshot }) {
  Object.values(snapshot).forEach(entry => {
    delete entry.rev;
    if (entry.props && entry.props._rev) delete entry.props._rev;
  });
}

// await evalOnServer('1 + 1')

export async function evalOnServer (code) {
  if (System.get('@system-env').node) {
    return eval(code);
  }
  const { default: EvalBackendChooser } = await System.import('lively.ide/js/eval-backend-ui.js');
  const { RemoteCoreInterface } = await System.import('lively-system-interface/interfaces/interface.js');
  // fetch next available nodejs env
  const remoteInterface = (await EvalBackendChooser.default.allEvalBackends())
    .map(backend => backend.coreInterface)
    .find(coreInterface => coreInterface instanceof RemoteCoreInterface);
  return await remoteInterface.runEvalAndStringify(code, { classTransform: classes.classToFunctionTransform });
}

function findMasterComponentsInSnapshot (snap) {
  const masterComponents = new Set();
  const exprSerializer = new ExpressionSerializer();
  let props;
  for (const id in snap.snapshot) {
    if (props = snap.snapshot[id].props.master) {
      // also handle expression!
      if (typeof props.value === 'string') {
        props = exprSerializer.deserializeExpr(props.value);
      } else if (props.value == false) {
        continue;
      } else {
        props = snap.snapshot[props.value.id].props;
      }
      const { auto, click, hover } = props;
      arr.compact([auto, click, hover]).forEach((url) => masterComponents.add(url.value || url));
    }
  }
  return [...masterComponents];
}

async function getRequiredModulesFromSnapshot (snap, frozenPart, includeDynamicParts = false, includeObjectModules = true) {
  let imports = requiredModulesOfSnapshot(snap); // do this after the replacement of calls
  const dynamicPartImports = [];
  let requiredMasterComponents = new Set();
  const objectModules = [];

  frozenPart.getAssetsFromSnapshot(snap);

  // flatten imports to all imports of the object package
  imports = arr.flatten(
    imports.map(modId =>
      module(modId)
        .requirements()
        .map(mod => mod.id)
        .filter(id => belongsToObjectPackage(id))
        .concat(modId)));

  findMasterComponentsInSnapshot(snap).forEach(url => requiredMasterComponents.add(url));

  const { packages: additionalImports } = await findRequiredPackagesOfSnapshot(snap);
  Object.entries(additionalImports['local://lively-object-modules/'] || {}).forEach(([packageName, pkg]) => {
    Object.keys(pkg).filter(key => key.endsWith('.js')).forEach(file => {
      const filename = `${packageName}/${file}`;
      if (imports.includes(filename)) arr.remove(imports, filename);
      objectModules.push(filename);
    });
  });
  // [...imports, ...objectModules].map(id => belongsToObjectPackage(id))
  for (const m of [...imports, ...objectModules]) {
    if (m.endsWith('.json')) continue;
    const mod = module(m);
    const partModuleSource = (mod._source || await mod.source());
    const parsedModuleSource = ast.parse(partModuleSource);
    const isObjectPackageModule = belongsToObjectPackage(m);
    const dynamicPartFetches = [];
    const dynamicPartLoads = [];

    // scan for dynamic imports
    ast.AllNodesVisitor.run(parsedModuleSource, (node, path) => {
      // dynamic import detection
      if (node.type === 'CallExpression' &&
          ['loadObjectFromPartsbinFolder', 'loadPart'].includes(node.callee.name)) {
        dynamicPartLoads.push(node.arguments[0].value);
        frozenPart.hasDynamicImports = true;
      }
      // part loading necceciates a dynamic import. this automatically causes syleguides to be fetched dynamically too.
      if (node.type === 'Literal' && obj.isString(node.value) && node.value.match(/^part:\/\/.*\/.+/)) {
        const partUrl = node.value;
        dynamicPartFetches.push(partUrl);
        frozenPart.hasDynamicImports = true;
      }

      // just styleguides usage itself does not necceciate a dynamic import
      if (node.type === 'Literal' && typeof node.value === 'string' && node.value.match(/^styleguide:\/\/.*\/.+/)) {
        requiredMasterComponents.add(node.value);
      }
      if (isObjectPackageModule &&
          node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System') {
          frozenPart.modulesWithDynamicLoads.add(mod.id);
          frozenPart.dynamicModules.add(node.arguments[0].value);
          frozenPart.hasDynamicImports = true;
        }
      }
    });

    // try to resolve them
    if (!frozenPart.__cachedSnapshots__) frozenPart.__cachedSnapshots__ = {};

    for (const partUrl of arr.compact(dynamicPartFetches)) {
      const styleguideUrl = partUrl.replace('part://', 'styleguide://'); // makes for faster freezing
      if (!frozenPart.__cachedSnapshots__[styleguideUrl]) console.log('snapshotting', partUrl);
      // this is way cheaper
      const partSnapshot = frozenPart.__cachedSnapshots__[styleguideUrl] || serialize(await resource(styleguideUrl).read());
      frozenPart.__cachedSnapshots__[styleguideUrl] = partSnapshot;

      if (partSnapshot) {
        transpileAttributeConnections(partSnapshot);
        cleanSnapshot(partSnapshot);
        if (frozenPart) {
          if (frozenPart.dynamicParts[partUrl]) continue;
          frozenPart.dynamicParts[partUrl] = partSnapshot;
          frozenPart.modulesWithDynamicLoads.add(mod.id);
        }
        if (includeDynamicParts) {
          // load the packages of the part, if they are not loaded
          // await loadPackagesAndModulesOfSnapshot(dynamicPart); these have already been loaded in the resource read()
          const sub = await getRequiredModulesFromSnapshot(partSnapshot, frozenPart, includeDynamicParts, false);
          dynamicPartImports.push(...sub.requiredModules);
          // these should be loaded just as lazily
          sub.requiredMasterComponents.forEach(url => requiredMasterComponents.add(url));
        } else if (frozenPart) {
          const resolved = frozenPart.warnings.resolvedLoads;
          if (resolved) {
            resolved.add(partUrl);
          } else {
            frozenPart.warnings.resolvedLoads = new Set([partUrl]);
          }
        }
      }
    }

    for (const partName of arr.compact(dynamicPartLoads)) {
      const dynamicCommit = await MorphicDB.default.fetchCommit('part', partName);
      if (!dynamicCommit) continue; // this is not within the db
      const dynamicPart = frozenPart.__cachedSnapshots__[dynamicCommit._id] || await MorphicDB.default.fetchSnapshot(dynamicCommit);
      frozenPart.__cachedSnapshots__[dynamicCommit._id] = dynamicPart;

      if (dynamicPart) {
        transpileAttributeConnections(dynamicPart);
        cleanSnapshot(dynamicPart);
        if (frozenPart) {
          if (frozenPart.dynamicParts[partName]) continue;
          frozenPart.dynamicParts[partName] = dynamicPart;
          frozenPart.modulesWithDynamicLoads.add(mod.id);
        }
        if (includeDynamicParts) {
          // load the packages of the part, if they are not loaded
          await loadPackagesAndModulesOfSnapshot(dynamicPart);
          const sub = await getRequiredModulesFromSnapshot(dynamicPart, frozenPart, includeDynamicParts, false);
          dynamicPartImports.push(...sub.requiredModules);
          sub.requiredMasterComponents.forEach(url => requiredMasterComponents.add(url));
        } else if (frozenPart) {
          const resolved = frozenPart.warnings.resolvedLoads;
          if (resolved) {
            resolved.add(partName);
          } else {
            frozenPart.warnings.resolvedLoads = new Set([partName]);
          }
        }
      }
    }
  }

  requiredMasterComponents = arr.compact([...requiredMasterComponents]);
  // also add the required modules of the master components. This is actually a bad practice from the side of the master component
  // provider. a master component should not come with a custom class that has nothing to do with the original.
  const urlToSnap = {};
  if (!frozenPart._masterToMods) frozenPart._masterToMods = {};
  for (const url of requiredMasterComponents) {
    if (frozenPart.requiredMasterComponents.has(url)) {
      if (frozenPart._masterToMods[url]) { dynamicPartImports.push(...frozenPart._masterToMods[url]); }
      continue;
    }
    frozenPart.requiredMasterComponents.add(url);
    // url = 'styleguide://SystemWidgets/list/light'
    // frozenPart = fp
    urlToSnap[url] = frozenPart.__cachedSnapshots__[url] || serialize(await resource(url).read());
    const { requiredModules: modulesOfMaster } = await getRequiredModulesFromSnapshot(urlToSnap[url], frozenPart, includeDynamicParts, true);
    frozenPart._masterToMods[url] = modulesOfMaster;
    dynamicPartImports.push(...modulesOfMaster);
  }

  return {
    requiredModules: arr.uniq([...imports, ...dynamicPartImports, ...(includeObjectModules ? objectModules : [])]),
    requiredMasterComponents
  };
}

async function compileViaGoogle (code, li, fileName) {
  const compile = resource('https://closure-compiler.appspot.com/compile');
  compile.headers['Content-type'] = 'application/x-www-form-urlencoded';
  li.status = `Compiling ${fileName} on Google's servers.`;
  const queryString = compile.withQuery({
    js_code: code,
    warning_level: 'QUIET',
    output_format: 'text',
    output_info: 'compiled_code',
    language_out: 'ECMASCRIPT5'
  }).path().split('?')[1];
  const min = await compile.post(queryString);
  return {
    min,
    code
  };
}

async function compileOnServer (code, loadingIndicator, fileName = 'data', useTerser) {
  const osName = await evalOnServer('process.platform');
  const googleClosure = System.decanonicalize(`google-closure-compiler-${osName == 'darwin' ? 'osx' : 'linux'}/compiler`).replace(System.baseURL, '../');
  const tmp = resource(System.decanonicalize('lively.freezer/tmp.js'));
  const min = resource(System.decanonicalize('lively.freezer/tmp.min.js'));
  tmp.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    loadingIndicator.progress = p;
    loadingIndicator.status = `Sending ${fileName} to Google Closure: ` + (100 * p).toFixed() + '%';
  };
  min.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    loadingIndicator.progress = p;
    loadingIndicator.status = 'Retrieving compiled code...' + (100 * p).toFixed() + '%';
  };
  await tmp.write(code);
  const presetPath = await evalOnServer('System.decanonicalize(\'@babel/preset-env\').replace(\'file://\', \'\')');
  const babelPath = await evalOnServer('System.decanonicalize(\'@babel/cli/bin/babel.js\').replace(System.baseURL, \'../\')');
  const cwd = await evalOnServer('System.baseURL + "lively.freezer/"').then(cwd => cwd.replace('file://', ''));
  let c; const res = {};
  if (System.get('@system-env').node) {
    const { default: ServerCommand } = await System.import('lively.shell/server-command.js');
    const cmd = new ServerCommand().spawn({
      command: `${googleClosure} tmp.js > tmp.min.js --warning_level=QUIET`,
      cwd
    });
    c = { status: 'started' };
    cmd.on('stdout', stdout => c.status = 'exited');
  } else {
    const transpilationSpeed = 100000;
    // problem terser fails to convert class definitions into functions
    // combine with babel transform
    await resource(System.baseURL).join('lively.freezer/.babelrc').writeJson({
      presets: [[presetPath, { modules: false }]]
      // plugins: [transformRuntime]
      // [generatorPath, { minified: true, comments: false }]],
    });
    if (useTerser) {
      c = await runCommand(`${babelPath} -o tmp.es5.js tmp.js`, { cwd });
      loadingIndicator.status = `Transpiling ${fileName}...`;
      loadingIndicator.progress = 0.01;
      for (const i of arr.range(0, code.length / transpilationSpeed)) {
        await promise.delay(400);
        if (c.status.startsWith('exited')) break;
        loadingIndicator.progress = (i + 1) / (code.length / transpilationSpeed);
      }
      await promise.waitFor(100 * 1000, () => c.status.startsWith('exited'));
      c = await runCommand('terser --compress --mangle --comments false --ecma 5 --output tmp.min.js -- tmp.es5.js', { cwd });
    } else {
      c = await runCommand(`${googleClosure} tmp.js > tmp.min.js --warning_level=QUIET`, { cwd });
    }
  }
  const compressionSpeed = 150000;
  loadingIndicator.status = `Compressing ${fileName}...`;
  loadingIndicator.progress = 0.01;
  for (const i of arr.range(0, code.length / compressionSpeed)) {
    await promise.delay(400);
    if (c.status.startsWith('exited')) break;
    loadingIndicator.progress = (i + 1) / (code.length / compressionSpeed);
  }
  await promise.waitFor(100 * 1000, () => c.status.startsWith('exited'));
  if (c.stderr && c.exitCode != 0) {
    loadingIndicator && loadingIndicator.remove();
    throw new Error(c.stderr);
  }
  res.code = code;

  res.min = await min.read();
  await Promise.all([tmp, min].map(m => m.remove()));
  return res;
}

function transpileAttributeConnections (snap) {
  const transpile = fun.compose((c) => `(${c})`, es5Transpilation, stringifyFunctionWithoutToplevelRecorder);
  Object.values(snap.snapshot).filter(m => Path(['lively.serializer-class-info', 'className']).get(m) == 'AttributeConnection').forEach(m => {
    if (m.props.converterString) {
      return m.props.converterString.value = transpile(m.props.converterString.value);
    }
    if (m.props.updaterString) {
      return m.props.updaterString.value = transpile(m.props.updaterString.value);
    }
  });
}

class LivelyRollup {
  constructor (props = {}) {
    this.setup(props);
  }

  setup ({
    excludedModules = [],
    snapshot,
    rootModule,
    globalName,
    asBrowserModule = true,
    includeRuntime = true,
    jspm = false,
    useTerser = true,
    redirect = {
      fs: modules.module('lively.freezer/node-fs-wrapper.js').id,
      'https://dev.jspm.io/npm:ltgt@2.1.3/index.dew.js': 'https://dev.jspm.io/npm:ltgt@2.2.1/index.dew.js' // this is always needed
    },
    includePolyfills = true
  }) {
    this.useTerser = useTerser;
    this.globalMap = {};
    this.jspm = jspm;
    this.includePolyfills = includePolyfills;
    this.includeRuntime = includeRuntime;
    this.snapshot = snapshot;
    this.rootModule = rootModule;
    this.globalName = globalName;
    this.dynamicParts = {}; // parts loaded via loadPart/loadObjectsFromPartsbinFolder/resource("part://....")
    this.dynamicModules = new Set(); // modules loaded via System.import(...)
    this.modulesWithDynamicLoads = new Set();
    this.hasDynamicImports = false;
    this.globalModules = {};
    this.importedModules = [];
    this.asBrowserModule = asBrowserModule;
    this.resolved = {};
    this.redirect = redirect;
    this.excludedModules = excludedModules;
    this.assetsToCopy = [];
    this.requiredMasterComponents = new Set();
  }

  async resolveRelativeImport (moduleId, path) {
    if (!path.startsWith('.')) return System.normalize(path);
    return resource(await System.normalize(moduleId)).join('..').join(path).withRelativePartsResolved().url;
  }

  translateToEsm (jsonString) {
    let source = '';
    if (jsonString.match(/\nexport/)) return jsonString;
    for (const [key, value] of Object.entries(JSON.parse(jsonString))) {
      source += `export var ${key} = ${JSON.stringify(value)};\n`;
    }
    return source;
  }

  normalizedId (id) {
    return id.replace(System.baseURL, '').replace('local://lively-object-modules/', '');
  }

  getTransformOptions (mod) {
    if (mod.id === '@empty') return {};
    let version, name;
    const pkg = mod.package();
    if (pkg) {
      name = pkg.name;
      version = pkg.version;
    } else {
      // assuming the module if from jspm
      version = mod.id.split('@')[1];
      name = mod.id.split('npm:')[1].split('@')[0];
    }
    const classToFunction = {
      classHolder: ast.parse(`(lively.FreezerRuntime.recorderFor("${this.normalizedId(mod.id)}"))`),
      functionNode: { type: 'Identifier', name: 'initializeES6ClassForLively' },
      transform: classes.classToFunctionTransform,
      currentModuleAccessor: ast.parse(`({
        pathInPackage: () => {
           return "${mod.pathInPackage()}"
        },
        unsubscribeFromToplevelDefinitionChanges: () => () => {},
        subscribeToToplevelDefinitionChanges: () => () => {},
        package: () => { 
          return {
            name: "${name}",
            version: "${version}"
          } 
        } 
      })`).body[0].expression
    };
    return {
      exclude: [
        'System',
        ...mod.dontTransform,
        ...arr.range(0, 50).map(i => `__captured${i}__`)],
      classToFunction
    };
  }

  checkIfImportedModuleExcluded () {
    const conflicts = arr.intersect(this.importedModules.map(id => module(id).package()), arr.compact(this.excludedModules.map(id => module(id).package())));
    if (conflicts.length > 0) {
      const multiple = conflicts.length > 1;
      const error = Error(`Package${multiple ? 's' : ''} ${conflicts.map(p => `"${p.name}"`)}\n${multiple ? 'are' : 'is'} directly required by part, yet set to be excluded.`);
      error.name = 'Exclusion Conflict';
      error.reducedExclusionSet = arr.withoutAll(this.excludedModules, conflicts.map(p => p.name));
      throw error;
    }
  }

  async getPartModule (partNameOrUrl) {
    const snapshot = this.dynamicParts[partNameOrUrl];
    // snapshot = await createMorphSnapshot(this.get('world-list'))
    // snapshot = snap
    // fp = { warnings: {}, dynamicParts: {}, dynamicModules: new Set(), requiredMasterComponents: new Set(), modulesWithDynamicLoads: new Set() }
    // let { requiredModules: modules, requiredMasterComponents } = await getRequiredModulesFromSnapshot(snapshot, fp);
    const { requiredModules: modules, requiredMasterComponents } = await getRequiredModulesFromSnapshot(snapshot, this);
    console.log('required modules:', partNameOrUrl, modules);
    return modules.map(path => `import "${path}"`).join('\n');
  }

  async getRootModule () {
    if (this.rootModule) {
      if ((await this.rootModule.exports()).length > 0) { return `export * from "${this.rootModule.id}";`; }
      return await this.rootModule.source();
    }
    this.dynamicParts = {}; // needed such that required modules are fetched correctly
    const { requiredModules, requiredMasterComponents } = await getRequiredModulesFromSnapshot(this.snapshot, this, true);
    this.importedModules = requiredModules;
    this.checkIfImportedModuleExcluded();
    // console.log('Masters for root:', requiredMasterComponents, requiredModules);
    return generateResourceExtensionModule(this) + arr.uniq((await getRequiredModulesFromSnapshot(this.snapshot, this)).requiredModules.map(path => `import "${path}"`)).join('\n') +
       `\nimport { World, MorphicEnv, loadMorphFromSnapshot } from "lively.morphic";
            import { deserialize } from 'lively.serializer2';
            import { loadViaScript } from 'lively.resources';
            import { promise } from 'lively.lang';
            import { pt } from "lively.graphics";
            ${this.excludedModules.includes('localconfig.js') ? '' : await resource(System.baseURL).join('localconfig.js').read()}
            const snapshot = JSON.parse(${JSON.stringify(JSON.stringify(obj.dissoc(this.snapshot, ['preview', 'packages'])))})
            lively.resources = { resource, loadViaScript };
            lively.morphic = { loadMorphFromSnapshot };
            export async function renderFrozenPart(node = document.body) {
                if (!MorphicEnv.default().world) {
                  let world = window.$world = window.$$world = new World({
                    name: snapshot.name, extent: pt(window.innerWidth, window.innerHeight)
                  });
                  MorphicEnv.default().setWorldRenderedOn(world, node, window.prerenderNode);
                }
                window.$world.dontRecordChangesWhile(() => {
                  let obj = deserialize(snapshot, {
                     reinitializeIds: function(id) { return id }
                  });
                  if (obj.isWorld) {
                    obj.position = pt(0,0);
                    obj.isEmbedded = true;
                    MorphicEnv.default().setWorldRenderedOn(obj, node, window.prerenderNode);
                    obj.resizePolicy === 'elastic' && obj.execCommand("resize to fit window");
                  } else {
                    try {
                      if (node != document.body) {
                        const observer = new window.ResizeObserver(entries =>
                          obj.execCommand('resize on client', entries[0]));
                        observer.observe(node);
                      } else {
                        window.onresize = lively.FreezerRuntime.resizeHandler = () => obj.execCommand('resize on client');
                      }
                      obj.openInWorld(pt(0,0));
                      obj.execCommand('resize on client', node);
                    } catch (err) {
                      obj.position = pt(0,0);
                    }
                  }
                });
             }`;
  }

  async resolveId (id, importer) {
    if (id == 'fs') return 'fs';
    if (this.resolved[id]) return this.resolved[id];
    if (id === '__root_module__') return id;
    if (id.startsWith('[PART_MODULE]')) return id;
    if (!importer) return id;
    const isCdnImport = ESM_CDNS.find(cdn => id.includes(cdn) || importer.includes(cdn));
    if (importer != '__root_module__' &&
        isCdnImport &&
        this.jspm && importer) {
      const { url } = resource(importer).root();
      if (ESM_CDNS.find(cdn => url.includes(cdn))) {
        if (id.startsWith('.')) {
          id = resource(importer).parent().join(id).withRelativePartsResolved().url;
        } else {
          id = resource(url).join(id).withRelativePartsResolved().url;
        }
        if (this.redirect[id]) {
          id = this.redirect[id];
        }
      }
    }
    const importingPackage = module(importer).package();
    const importedPackage = module(id).package();
    let mappedId;
    if (['lively.ast', 'lively.modules'].includes(id) && this.excludedModules.includes(id)) {
      return id;
    }

    // if we are imported from a non dynamic context this does not apply
    const dynamicContext = this.dynamicModules.has(module(importer).id) || this.dynamicModules.has(module(id).id);
    if (!dynamicContext) {
      if (importingPackage && this.excludedModules.includes(importingPackage.name)) return false;
      if (this.excludedModules.includes(id)) return false;
    } else {
      this.dynamicModules.add(module(id).id);
    }

    if (importingPackage && importingPackage.map) this.globalMap = { ...this.globalMap, ...importingPackage.map };
    if (importingPackage && importingPackage.map[id] || this.globalMap[id]) {
      mappedId = id;
      if (!importingPackage.map[id] && this.globalMap[id]) {
        console.warn(`[freezer] No mapping for "${id}" provided by package "${importingPackage.name}". Guessing "${this.globalMap[id]}" based on past resolutions. Please consider adding a map entry to this package config in oder to make the package definition sound and work independently of the current setup!`);
      }
      id = importingPackage.map[id] || this.globalMap[id];
      if (id['~node']) id = id['~node'];
      importer = importingPackage.url;
    }
    if (id.startsWith('.')) {
      id = await this.resolveRelativeImport(importer, id);
      if (!dynamicContext && this.excludedModules.includes(id)) return false;
    }
    if (!id.endsWith('.json') && module(id).format() !== 'register' && !this.jspm) {
      this.globalModules[id] = true;
      return { id, external: true };
    }
    if (!id.endsWith('.js') && !isCdnImport) {
      const normalizedId = await System.normalize(id);
      return this.resolved[id] = normalizedId;
    }
    return this.resolved[id] = module(id).id; // this does not seem to work for non .js modules
  }

  warn (warning, warn) {
    switch (warning.code) {
      case 'THIS_IS_UNDEFINED':
      case 'EVAL':
      case 'MODULE_LEVEL_DIRECTIVE':
        return;
    }
    warn(warning);
  }

  async load (id) {
    id = this.redirect[id] || id;
    if (this.excludedModules.includes(id)) {
      if (id == 'lively.ast') {
        return `
        let nodes = {}, query = {}, transform = {}, BaseVisitor = Object;
        export { nodes, query, transform, BaseVisitor };`;
      }
      if (id == 'lively.modules') {
        return `
        let scripting = {};
        export { scripting };`;
      }
    }

    if (id === '__root_module__') {
      const res = await this.getRootModule();
      return res;
    }
    if (id === 'fs') {
      return 'const fs = require("fs"); export default fs;';
    }
    if (id.startsWith('[PART_MODULE]')) {
      const res = await this.getPartModule(id.replace('[PART_MODULE]', ''));
      return res;
    }
    const mod = module(id);
    const pkg = mod.package();
    if (pkg && this.excludedModules.includes(pkg.name) &&
        !mod.id.endsWith('.json') &&
        !this.dynamicModules.has(pkg.name) &&
        !this.dynamicModules.has(mod.id)) {
      return '';
    }
    if (id.endsWith('.json')) {
      return await resource(mod.id).read();
      // return this.translateToEsm(mod._source || await mod.source()); what is this needed for again?
    }
    let s = await mod.source();

    s = fixSourceForBugsInGoogleClosure(id, s);

    return s;
  }

  needsScopeToBeCaptured (moduleId) {
    if ([...this.dynamicModules.values()].find(id =>
      module(id).package() && module(id).package() === module(moduleId).package())
    ) return true;
    if (this.importedModules.find(id => module(id).package() === module(moduleId).package())) return true;
    return belongsToObjectPackage(moduleId);
  }

  needsClassInstrumentation (moduleId, moduleSource) {
    if (moduleSource.match(/extends\ (Morph|Image|Ellipse|HTMLMorph|Path|Polygon|Text|InteractiveMorph)/)) return true;
    if (CLASS_INSTRUMENTATION_MODULES_EXCLUSION.some(pkgName => moduleId.includes(pkgName))) { return false; }
    if (CLASS_INSTRUMENTATION_MODULES.some(pkgName => moduleId.includes(pkgName) || pkgName == moduleId) || belongsToObjectPackage(moduleId)) {
      return true;
    }
  }

  needsDynamicLoadTransform (moduleId) {
    return this.modulesWithDynamicLoads.has(moduleId) || !belongsToLivelyPackage(moduleId); // seem to sometimes be not checked for dynamic loads
  }

  async transform (source, id) {
    if (source.includes('thisComp') && source.split('var $bm_sum = sum;').length > 2) console.log(id);

    if (id === '__root_module__' || id.endsWith('.json')) {
      return source;
    }

    if (this.needsDynamicLoadTransform(id)) {
      source = await this.instrumentDynamicLoads(source, id);
    }
    // this capturing stuff needs to behave differently when we have dynamic imports
    if (this.needsScopeToBeCaptured(id) || this.needsClassInstrumentation(id, source)) {
      source = this.captureScope(source, id);
    }

    return source;
  }

  async instrumentDynamicLoads (source, moduleId) {
    const parsed = ast.parse(source);
    const nodesToReplace = [];
    let importUrls = [];

    ast.AllNodesVisitor.run(parsed, (node, path) => {
      // we checked beforehand if the user has decided to use dynamic imports
      // if that is the case, we run on systemjs anyways, so there is no need to stub it
      if (node.type === 'AwaitExpression' && node.argument.callee &&
          ['loadObjectFromPartsbinFolder', 'loadPart'].includes(node.argument.callee.name)) {
        const partName = node.argument.arguments[0].value;
        nodesToReplace.push({
          // fixme: replace by a dynamic import of the generated deps module, followed by the import
          // like so: `await import("${node.arguments.id}"); lively.FreezerRuntime.loadObjectFromPartsbinFolder`
          target: node,
          replacementFunc: () => `await import("[PART_MODULE]${partName}") && await window.loadCompiledFrozenPart("${partName}")`
          // target: node.callee, replacementFunc: () => 'lively.FreezerRuntime.loadObjectFromPartsbinFolder'
        });
      }
      // if (node.type === 'CallExpression' && Path('callee.name').get(node) == 'resource' &&
      //     (Path('arguments.0.value').get(node) || '').match(/^part:\/\/.*\/.+/)) {
      //   const partUrl = Path('arguments.0.value').get(node);
      //   nodesToReplace.push({
      //     // fixme: replace by a dynamic import of the generated deps module, followed by the import
      //     // like so: `await import("${node.arguments.id}"); lively.FreezerRuntime.loadObjectFromPartsbinFolder`
      //     target: node,
      //     replacementFunc: () => `(await import("[PART_MODULE]${partUrl}") && await resource("${partUrl}"))`
      //     // target: node.callee, replacementFunc: () => 'lively.FreezerRuntime.loadObjectFromPartsbinFolder'
      //   });
      // }
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System') {
          const idx = importUrls.push(localInterface.runEval(ast.stringify(node.arguments[0]), {
            targetModule: moduleId
          }));
          nodesToReplace.push({
            target: node.arguments[0],
            replacementFunc: () => {
              // if the result has not been computed, log an error
              return `"${importUrls[idx - 1]}"`;
            }
          });
          nodesToReplace.push({
            target: node.callee, replacementFunc: () => 'import'
          });
        }
      }
    });

    importUrls = (await Promise.all(importUrls)).map(res => res.value);

    // last minute discovery of dynamic imports
    if (!this.hasDynamicImports) this.hasDynamicImports = importUrls.length > 0;

    return ast.transform.replaceNodes(nodesToReplace, source).source;
  }

  instrumentClassDefinitions (source, id) {
    // this is not really working anyways
    let classRuntimeImport = '';
    const mod = module(id);
    const parsed = ast.parse(source);
    const recorderString = `const __varRecorder__ = lively.FreezerRuntime.recorderFor("${this.normalizedId(id)}");\n`;
    if (ast.query.scopes(parsed).classDecls.length) {
      classRuntimeImport = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n';
    }
    const captureObj = { name: '__varRecorder__', type: 'Identifier' };
    const tfm = fun.compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform, ast.stringify);
    return recorderString + classRuntimeImport + tfm(parsed, captureObj, this.getTransformOptions(mod));
  }

  captureScope (source, id) {
    let classRuntimeImport = '';
    const recorderString = `const __varRecorder__ = lively.FreezerRuntime.recorderFor("${this.normalizedId(id)}");\n`;
    const tfm = fun.compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform);
    const captureObj = { name: '__varRecorder__', type: 'Identifier' };
    const exportObj = { name: '__expRecorder__', type: 'Identifier' };
    // id = 'lively.vm/index.js'
    const mod = module(id);
    // source = mod._source
    const parsed = ast.parse(source);
    // opts = {}

    const opts = this.getTransformOptions(mod);
    if (this.needsClassInstrumentation(id)) { classRuntimeImport = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n'; } else { opts.classToFunction = false; }
    const instrumented = insertCapturesForExportedImports(tfm(parsed, captureObj, opts), { captureObj });
    const imports = [];
    let defaultExport = '';
    const toBeReplaced = [];

    ast.custom.forEachNode(instrumented, (n) => {
      if (n.type == 'ImportDeclaration') arr.pushIfNotIncluded(imports, n);
      if (n.type == 'Literal' && typeof n.value === 'string' && n.value.match(/^styleguide:\/\/.+\/.+/)) {
        if (!this.requiredMasterComponents.has(n.value)) console.log('DID NOT CAPTURE', n.value);
        this.requiredMasterComponents.add(n.value);
      }
      if (n.type == 'ExportDefaultDeclaration') {
        let exp;
        switch (n.declaration.type) {
          case 'Literal':
            exp = Path('declaration.raw').get(n);
            break;
          case 'Identifier':
            exp = Path('declaration.name').get(n);
            break;
          case 'ClassDeclaration':
          case 'FunctionDeclaration':
            exp = Path('declaration.id.name').get(n);
            break;
        }
        if (exp) defaultExport = `${captureObj.name}.default = ${exp};\n`;
      }
    });

    for (const stmts of Object.values(arr.groupBy(imports, imp => imp.source.value))) {
      const toBeMerged = arr.filter(stmts, stmt => arr.all(stmt.specifiers, spec => spec.type == 'ImportSpecifier'));
      if (toBeMerged.length > 1) {
        // merge statements
        // fixme: if specifiers are not named, these can not be merged
        // fixme: properly handle default export
        const mergedSpecifiers = arr.uniqBy(
          arr.flatten(toBeMerged.map(stmt => stmt.specifiers)),
          (spec1, spec2) =>
            spec1.type == 'ImportSpecifier' &&
            spec2.type == 'ImportSpecifier' &&
            spec1.imported.name == spec2.imported.name &&
            spec1.local.name == spec2.local.name
        );
        toBeMerged[0].specifiers = mergedSpecifiers;
        toBeReplaced.push(...toBeMerged.slice(1).map(stmt => {
          stmt.body = [];
          stmt.type = 'Program';
          return stmt;
        }));
      }
    }

    return recorderString + classRuntimeImport + ast.stringify(instrumented) + defaultExport;
  }

  deriveVarName (moduleId) { return string.camelize(arr.last(moduleId.split('/')).replace(/\.js|\.min/g, '').split('.').join('')); }

  async wrapStandalone (moduleId) {
    const mod = module(moduleId);
    if (!mod._source) await mod.source();
    const globalVarName = this.deriveVarName(moduleId);
    let code;
    if (mod.format() === 'global') {
      code = `var ${globalVarName} = (function() {
         var fetchGlobals = prepareGlobal("${mod.id}");
         ${mod._source};
         return fetchGlobals();
      })();\n`;
    } else {
      code = `
      var ${globalVarName};
      (function(module /* exports, require */) {
             // optional parameters
             var exports = arguments.length > 0 && arguments[1] !== undefined ? arguments[1] : {};
             var require = arguments.length > 1 && arguments[2] !== undefined ? arguments[2] : function () {};

             // try to simulate node.js context
             var exec = function(exports, require) {
                ${mod._source} 
             };
             exec(exports, require);
             if (typeof module.exports != 'function' && Object.keys(module.exports).length === 0) Object.assign(module.exports, exports);
             if (typeof module.exports != 'function' && Object.keys(module.exports).length === 0) {
                exec(); // try to run as global
             }
             ${globalVarName} = module.exports;
           })({exports: {}});\n`;
    }
    return { code, global: globalVarName };
  }

  async generateGlobals (systemJsEnabled) {
    let code = '';
    const globals = {};

    if (!systemJsEnabled) {
      code += `${this.asBrowserModule ? 'var fs = {};' : 'var fs = require("fs");'} var _missingExportShim, show, System, require, timing, lively, Namespace, localStorage;`;
    }

    // this is no longer an issue due to removal of all non ESM modules from our system. Can be removed?
    for (const modId in this.globalModules) {
      const { code: newCode, global: newGlobal } = await this.wrapStandalone(modId);
      code += newCode;
      globals[modId] = newGlobal;
    }

    if (systemJsEnabled) {
      code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/0.21/dist/system.src.js').read();
      // code += await resource(System.decanonicalize('systemjs/dist/system.js')).read();
      // code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/master/dist/s.js').read();
      // code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/master/dist/extras/named-register.js').read();
      // stub the globals
      code += `
         const _origGet = System.get.bind(System);
         System.get = (id, recorder = true) => (lively.FreezerRuntime && lively.FreezerRuntime.get(id, recorder)) || _origGet(id);
      `;
      // if (this.asBrowserModule) code += 'System.global = window;\n'
      code += `
         const _origDecanonicalize = System.decanonicalize.bind(System);
         System.decanonicalize = (id) =>
            lively.FreezerRuntime ? lively.FreezerRuntime.decanonicalize(id) : _origDecanonicalize(id);
      `;
      code += 'window._missingExportShim = () => {};\n';
      code += `
         const _originalRegister = System.register.bind(System);
         System.register = (name, deps, def) => {
           if (typeof name != 'string') {
             def = deps;
             deps = name;
             return _originalRegister(deps, (exports, module) => {
               let res = def(exports, module);
               if (!res.setters) res.setters = [];
               return res;
             });
           }
           return _originalRegister(name, deps, (exports, module) => {
             let res = def(exports, module);
             if (!res.setters) res.setters = [];
             return res;
           })
        };
      `;
      // map fs as global
      code += `System.set('stub-transpiler', System.newModule({
        translate: (load) => {
           return load.source;
        }
      }));\n`;
      code += `System.config({
        transpiler: 'stub-transpiler'
      });\n`;
      code += 'System.trace = false;\n';
      for (const id of this.excludedModules.concat(this.asBrowserModule ? ['fs', 'events'] : [])) {
        // code += `"${id}": "@empty",`
        code += `System.set("${id}", System.newModule({ default: {} }));\n`;
        // code += `System.register("${id}", [], (exports) => ({ execute: () => { console.log('loaded ${id}'); exports({ default: {} }) }, setters: []}));\n`;
      }
    } else {
      for (const id of this.excludedModules) {
        const varName = globals[id] = this.deriveVarName(id);
        code += `var ${varName} = {};\n`;
      }
    }

    return {
      code, globals
    };
  }

  async getRuntimeCode () {
    let runtimeCode = await module('lively.freezer/runtime.js').source();
    runtimeCode = `(${runtimeCode.slice(0, -1).replace('export ', '')}})();\n`;
    if (!this.hasDynamicImports) {
      // If there are no dynamic imports, we compile without systemjs and
      // can stub it with our FreezerRuntime
      runtimeCode += `
var G = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
if (!G.System) G.System = G.lively.FreezerRuntime;`;
    }
    return es5Transpilation(runtimeCode);
  }

  getAssetsFromSnapshot ({ snapshot: snap }) {
    Object.entries(snap).map(([k, v]) => {
      if (!classNameOfId(snap, k) || !moduleOfId(snap, k).package) return;
      const klass = locateClass({
        className: classNameOfId(snap, k),
        module: moduleOfId(snap, k)
      });
      const toBeCopied = Object.entries(klass[Symbol.for('lively.classes-properties-and-settings')].properties)
        .map(([key, settings]) => settings.copyAssetOnFreeze && key)
        .filter(Boolean);
      for (const prop of toBeCopied) {
        if (!v.props[prop]) continue; // may be styled and not present in snapshot
        if (v.props[prop].value.startsWith('assets')) continue; // already copied
        const path = v.props[prop].value;
        if (path == '' || path.startsWith('data:')) continue; // data URL can not be copied
        const asset = resource(path);
        if (asset.host() != resource(System.baseURL).host()) continue;
        asset._from = k;
        if (!this.assetsToCopy.find(res => res.url == asset.url)) { this.assetsToCopy.push(asset); }
        v.props[prop].value = 'assets/' + asset.name(); // this may be causing duplicates
      }
    });
    console.log('[ASSETS]', this.assetsToCopy);
  }

  async rollup (compressBundle, output) {
    const li = LoadingIndicator.open('Freezing Part', { status: 'Bundling...' });
    let depsCode, bundledCode, splitModule;

    if (this.snapshot) this.getAssetsFromSnapshot(this.snapshot);

    await li.whenRendered();
    try {
      const bundle = await Rollup.rollup({
        input: this.rootModule ? this.rootModule.id : '__root_module__',
        shimMissingExports: true,
        onwarn: (warning, warn) => { return this.warn(warning, warn); },
        plugins: [{
          resolveId: async (id, importer) => {
            const res = await this.resolveId(id, importer);
            return res;
          },
          resolveDynamicImport: (id, importer) => {
            // schedule a request to initiate a nested rollup that bundles
            // the dynamically loaded bundles separately
            this.dynamicModules.add(module(id).id);
            const res = this.resolveId(id, importer); // dynamic imports are never excluded
            if (res && obj.isString(res)) {
              return {
                external: false,
                id: res
              };
            }
            return res;
          },
          load: async (id) => {
            const src = await this.load(id);
            return src;
          },
          transform: async (source, id) => { return await this.transform(source, id); }
        }, jsonPlugin()]
      });
      let globals;
      ({ code: depsCode, globals } = await this.generateGlobals(this.hasDynamicImports));
      if (this.hasDynamicImports) {
        splitModule = (await bundle.generate({ format: 'system', globals }));
      } else { bundledCode = (await bundle.generate({ format: this.asBrowserModule ? 'iife' : 'cjs', globals, name: this.globalName || 'frozenPart' })).output[0].code; }
    } finally {
      li.remove();
    }

    let res;
    if (splitModule) {
      res = splitModule.output;
      // it seems like rollup sometimes returns duplicates which are optimized away by closure
      // causing issues when reassigned the minified pieces
      // res = arr.uniqBy(res, (snipped1, snipped2) => snipped1.code === snipped2.code);
      const loadCode = `
        
        window.frozenPart = {
          renderFrozenPart: (domNode, baseURL) => {
            if (baseURL) System.config( { baseURL });
            if (!baseURL) baseURL = './';
            System.config({
              meta: {
               ${
                res.map(snippet => `[baseURL + '${snippet.fileName}']: {format: "system"}`).join(',\n') // makes sure that compressed modules are still recognized as such
                }
              }
            });
            System.import("__root_module__.js").then(m => { System.trace = false; m.renderFrozenPart(domNode); });
          }
        }
      `;
      // concat all snippets and compile them on server
      // insert hint strings
      res.forEach((snippet, i) => {
        snippet.instrumentedCode = snippet.code.replace('System.register(', `System.register("${i}",`);
      });

      const { min, code } = await this.transpileAndCompressOnServer({
        depsCode,
        bundledCode: [loadCode, ...res.map(snippet => snippet.instrumentedCode)].join('\n'),
        output,
        compressBundle: false
      });

      // let [compiledLoad, ...compiledSnippets] = [depsCode + loadCode, ...res.map(snippet => snippet.instrumentedCode)]
      let [compiledLoad, ...compiledSnippets] = min.split(this.useTerser ? /\,System.register\(/ : /\nSystem.register\(/);

      // ensure that all compiled snippets are present
      // clear the hints
      const adjustedSnippets = new Map(); // ensure order
      res.forEach((snippet, i) => {
        adjustedSnippets.set(i, snippet.code);
      });
      compiledSnippets.forEach((compiledSnippet) => {
        const hint = Number(compiledSnippet.match(/\"[0-9]+\"/)[0].slice(1, -1));
        adjustedSnippets.set(hint, compiledSnippet.replace(/\"[0-9]+\"\,/, 'System.register('));
      });
      compiledSnippets = [...adjustedSnippets.values()];

      res.load = { min: compiledLoad };
      for (const [snippet, compiled] of arr.zip(res, compiledSnippets)) { snippet.min = compiled; }
    } else {
      res = await this.transpileAndCompressOnServer({
        depsCode, bundledCode: bundledCode, output, compressBundle
      });
    }

    res.format = !this.hasDynamicImports ? 'global' : 'systemjs';
    for (const part in this.dynamicParts) {
      this.getAssetsFromSnapshot(this.dynamicParts[part]);
    }
    // extract the master components
    res.masterComponents = {};
    for (const comp of this.requiredMasterComponents) {
      const snap = serialize(await resource(comp).read());
      this.getAssetsFromSnapshot(snap);
      res.masterComponents[comp] = snap;
    }
    res.dynamicParts = this.dynamicParts;
    res.assets = this.assetsToCopy;
    // res.masterComponents = this.requiredMasterComponents];

    res.rollup = this;

    return res;
  }

  async transpileAndCompressOnServer ({
    depsCode = '',
    bundledCode,
    output,
    fileName = '',
    compressBundle,
    addRuntime = true,
    optimize = true,
    includePolyfills = this.includePolyfills && this.asBrowserModule
  }) {
    const li = LoadingIndicator.open('Freezing Part', { status: 'Optimizing...' });
    const runtimeCode = addRuntime ? await this.getRuntimeCode() : '';
    const regeneratorSource = addRuntime ? await resource('https://unpkg.com/regenerator-runtime@0.13.7/runtime.js').read() : '';
    let polyfills = ''; //! includePolyfills ? '' : await module('lively.freezer/deps/pep.min.js').source();
    polyfills += !includePolyfills ? '' : await module('lively.freezer/deps/fetch.umd.js').source();

    const code = runtimeCode + polyfills + regeneratorSource + depsCode + bundledCode;
    // due to a bug in google closure this little dance is needed:
    // code = code.split(`const i = e[s],
    //                         n = i.facadeModule;`).join(`var i = e[s], n = i.facadeModule;`);

    // write file
    if (!optimize) { li.remove(); return { code, min: code }; }
    const res = await compileOnServer(code, li, fileName, this.useTerser); // seems to be faster for now
    // res = await compileViaGoogle(code, li, fileName);

    li.remove();
    return res;
  }
}

export async function bundlePart (partOrSnapshot, { exclude: excludedModules = [], compress = false, output = 'es2019', requester, useTerser }) {
  const snapshot = partOrSnapshot.isMorph
    ? await createMorphSnapshot(partOrSnapshot, {
      frozenSnapshot: true
    })
    : partOrSnapshot;
  transpileAttributeConnections(snapshot);
  const bundle = new LivelyRollup({ excludedModules, snapshot, jspm: true, useTerser });
  const rollupBundle = async () => {
    let res;
    try {
      res = await bundle.rollup(compress, output);
    } catch (e) {
      if (e.name == 'Exclusion Conflict') {
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
