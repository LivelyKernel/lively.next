/*global System,TextEncoder*/
import {rollup} from 'https://unpkg.com/rollup@1.17.0/dist/rollup.browser.js';
import semver from 'semver';
import { compress } from 'wasm-brotli';
import 'wasm-flate';
import {
  createMorphSnapshot, serializeMorph,
  loadPackagesAndModulesOfSnapshot,
  findRequiredPackagesOfSnapshot
} from "lively.morphic/serialization.js";
import { MorphicDB, config, morph } from "lively.morphic";
import { module } from "lively.modules";
import * as ast from 'lively.ast';
import * as classes from 'lively.classes';
import { resource } from "lively.resources";
import { es5Transpilation, stringifyFunctionWithoutToplevelRecorder } from "lively.source-transform";
import {
  rewriteToCaptureTopLevelVariables,
  insertCapturesForExportedImports
} from "lively.source-transform/capturing.js";
import { compose } from "lively.lang/function.js";
import { requiredModulesOfSnapshot, locateClass, removeUnreachableObjects } from "lively.serializer2";
import { runCommand } from "lively.ide/shell/shell-interface.js";
import { Path, obj, promise, string, arr } from "lively.lang";
import { Color } from "lively.graphics";
import { moduleOfId, isReference, referencesOfId, classNameOfId } from "lively.serializer2/snapshot-navigation.js";
import { LoadingIndicator } from "lively.components";

if (!LoadingIndicator) {
  LoadingIndicator = {
    open: () => LoadingIndicator,
    remove: () => {},
    whenRendered: () => {}
  }
}


// fixme: read form localconfig

// client bootstrap

// await bootstrapLibrary('lively.morphic/web/bootstrap.js', 'lively.morphic/web/lively.bootstrap.min.js');
// await bootstrapLibrary('lively.modules/tools/bootstrap.js', 'lively.modules/dist/lively.modules.bootstrap.min.js', false, 'lively.modules');
/* 
await jspmCompile(url = 'https://dev.jspm.io/pouchdb-adapter-memory', out = 'lively.storage/dist/pouchdb-adapter-mem.min.js', globalName = 'window.pouchdbAdapterMem', redirect = {
   "https://dev.jspm.io/npm:ltgt@2.1.3/index.dew.js": "https://dev.jspm.io/npm:ltgt@2.2.1/index.dew.js"
})
*/

async function jspmCompile(url, out, globalName, redirect = {}) {
  module(url)._source = null
  let m = new LivelyRollup({ rootModule: module(url), includePolyfills: false, globalName, includeRuntime: false, jspm: true, redirect });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  let res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min); 
}

async function bootstrapLibrary(url, out, asBrowserModule = true, globalName) {
  module(url)._source = null
  let m = new LivelyRollup({ rootModule: module(url), asBrowserModule, globalName, includeRuntime: false });
  m.excludedModules = ['babel-plugin-transform-jsx'];
  let res = await m.rollup(true, 'es2019');
  await resource(System.baseURL).join(out).write(res.min); 
}

// todo: also do this for the server
// todo: decouple rollup from lively.modules resolution mechanism

const CLASS_INSTRUMENTATION_MODULES = [
  'lively.morphic', 
  'lively.components',
  'lively.ide',
  'typeshift.components',
  //'lively.halos'        
];

const ADVANCED_EXCLUDED_MODULES = [
  'lively.ast',
  'lively.vm',
  'lively.ide',
  'lively.modules',
  'babel-plugin-transform-jsx'
]

const DEFAULT_EXCLUDED_MODULES_PART = [
  'wasm-brotli',
  'kld-intersections',
  'pouchdb',
  'pouchdb-adapter-mem',
  'lively-system-interface',
  'lively.halos',
];

const DEFAULT_EXCLUDED_MODULES_WORLD = [
  'lively.ast',
  'lively.vm',
  'lively-system-interface',
  'pouchdb',
  'pouchdb-adapter-mem',
  'https://unpkg.com/rollup@1.17.0/dist/rollup.browser.js',
  'wasm-brotli',
  'lively.halos'
];

export async function generateLoadHtml(part, format = 'global') {
  const addScripts = `
      <noscript>
         <meta http-equiv="refresh" content="0;url=/noscript.html">
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
     <meta content="text/html;charset=utf-8" http-equiv="Content-Type">
     <meta name="viewport" content="minimum-scale=1.0, maximum-scale=1.0, initial-scale=1.0, viewport-fit=cover">
     <meta name="apple-mobile-web-app-capable" content="yes">
     <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
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

export async function interactivelyFreezeWorld(world) {
  /*
    Function prompts the user for a name to publish the part under.
    Data is uploaded to directory and then returns a link to the folder. 
  */ 
  let userName = $world.getCurrentUser().name;
  let frozenPartsDir = await resource(System.baseURL).join('users').join(userName).join('published/').ensureExistance();
  let publicAlias = world.metadata.commit.name;
  let publicationDir = frozenPartsDir.join(publicAlias + '/');
  let assetDir = await publicationDir.join('assets/').ensureExistance();
  while (await publicationDir.exists()) {
    let proceed = await $world.confirm(`A world published as "${publicAlias}" already exists.\nDo you want to overwrite this publication?`, {
      rejectLabel: 'CHANGE NAME'
    });
    if (proceed) break;
    publicAlias = await $world.prompt('Please enter a different name for this published world:');
    if (!publicAlias) return;
    publicationDir = frozenPartsDir.join(publicAlias + '/');
  }

  await publicationDir.ensureExistance();

  // remove the metadata props
  const worldSnap = serializeMorph(world);
  const deletedIds = [];
  obj.values(worldSnap.snapshot).forEach(m => delete m.props.metadata);
  // remove objects that are part of the lively.ide or lively.halo package (dev tools)
  for (let id in worldSnap.snapshot) {
     delete worldSnap.snapshot[id].props.metadata;
     delete worldSnap.snapshot[id]._cachedLineCharBounds;
     let module = moduleOfId(worldSnap.snapshot, id);
     if (!module.package) continue;
     if (DEFAULT_EXCLUDED_MODULES_WORLD.includes(module.package.name)) {
       // fixme: we also need to kill of packages which themselves require one of the "taboo" packages
       delete worldSnap.snapshot[id];
       deletedIds.push(id);
       continue;
     }
     // transform sources for attribute connections
     if (classNameOfId(worldSnap.snapshot, id) === 'AttributeConnection') {
        let props = worldSnap.snapshot[id].props;
        if (props.converterString) {
           props.converterString.value = es5Transpilation(`(${props.converterString.value})`); 
        }
        if (props.updaterString) {
           props.updaterString.value = es5Transpilation(`(${props.updaterString.value})`);
        }
     }    
  }

  // remove all windows that are emptied due to the clearance process
  for (let id in worldSnap.snapshot) {
     let className = classNameOfId(worldSnap.snapshot, id);
     if ( arr.intersect(referencesOfId(worldSnap.snapshot, id), deletedIds).length > 0) {
         if (className === 'Window') {
           delete worldSnap.snapshot[id];
           continue;
         }
         for (let [key, {value: v}] of Object.entries(worldSnap.snapshot[id].props)) {
           if (isReference(v) && deletedIds.includes(v.id)) {
             delete worldSnap.snapshot[id].props[key];
           }
           if (arr.isArray(v)) { 
             // also remove references that are stuck inside array values
             worldSnap.snapshot[id].props[key].value = v.filter(v => !(isReference(v) && deletedIds.includes(v.id)));
           }
         }   
     }
  }
  removeUnreachableObjects([worldSnap.id], worldSnap.snapshot);

  // freeze the world
  let frozen;
  try {
    frozen = await bundlePart(worldSnap, {
      compress: true,
      exclude: DEFAULT_EXCLUDED_MODULES_WORLD
    });
  } catch(e) {
    throw e;
  }

  let li = LoadingIndicator.open('Freezing World', {status: 'Writing files...'})
  await publicationDir.join('index.html').write(await generateLoadHtml(world, frozen.format));
  await publicationDir.join('load.js').write(frozen.min);
  li.status = 'copying asset files...'
  for (let asset of frozen.assets) await asset.copyTo(assetDir);
  let dynamicParts = await publicationDir.join('dynamicParts/').ensureExistance();
  for (let [partName, snapshot] of Object.entries(frozen.dynamicParts)) {
    await dynamicParts.join(partName + '.json').writeJson(snapshot);
  }
  li.remove();
  $world.setStatusMessage([`Published ${publicAlias}. Click `,null, 'here', {
    textDecoration: 'underline', fontWeight: 'bold',
    doit: {code: `window.open("${publicationDir.join('index.html').url}")`}
  }, ' to view.'], Color.green, 10000);
}


export async function interactivelyFreezePart(part, requester = false) {
  /*
    Function prompts the user for a name to publish the part under.
    Data is uploaded to directory and then returns a link to the folder. 
  */ 
  let userName = $world.getCurrentUser().name;
  let frozenPartsDir = await resource(System.baseURL).join('users').join(userName).join('published/').ensureExistance();
  let advanced = 'Advanced' === await $world.multipleChoicePrompt([`Select Optimization Level\n`, {fontSize: 20}, `Please select the code optimization degree for this compilation. Selecting "Advanced" will prune off more of the systems's default modules, resultung in a smaller payload and faster loading times.`, {fontSize: 15, fontWeight: 'normal'}], {
    choices: ['Advanced', 'Default'], requester
  });
  let publicAlias = await $world.prompt('Please enter a name for this published part:', {
    requester, input: (part.metadata && part.metadata.publishedAlias) || ''
  });
  if (!publicAlias) return;
  let publicationDir = frozenPartsDir.join(publicAlias + '/');
  while (await publicationDir.exists()) {
    let proceed = await $world.confirm(`A part published as "${publicAlias}" already exists.\nDo you want to overwrite this publication?`, { requester });
    if (proceed) break;
    publicAlias = await $world.prompt('Please enter a different name for this published part:', { requester });
    if (!publicAlias) return;
    publicationDir = frozenPartsDir.join(publicAlias + '/');
  }

  part.changeMetaData('publishedAlias', publicAlias, true, false)

  await publicationDir.ensureExistance();

  // freeze the part
  let frozen;
  try {
    frozen = await bundlePart(part, {
      compress: true,
      exclude: [...DEFAULT_EXCLUDED_MODULES_PART, ...advanced ? ADVANCED_EXCLUDED_MODULES : []],
      requester
    });
  } catch(e) {
    throw e;
  }
  
  let li = LoadingIndicator.open('Freezing Part', {status: 'Writing files...'});
  let currentFile = '';
  publicationDir.onProgress = (evt) => {
    // set progress of loading indicator
    let p = evt.loaded / evt.total;
    li.progress = p;
    li.status = 'Writing file ' + currentFile + ' ' + (100 * p).toFixed() + '%';
  };
  currentFile = 'index.html';
  // if the module is split, include systemjs
  await publicationDir.join(currentFile).write(await generateLoadHtml(part, frozen.format));
  
  if (obj.isArray(frozen)) {
    for (let part of frozen) {
      currentFile = part.fileName;
      await publicationDir.join(currentFile).write(part.min); 
    }
    currentFile = 'load.js';
    await publicationDir.join(currentFile).write(frozen.load.min);
    currentFile = 'load.js.gz'    
    await publicationDir.join(currentFile).write(frozen.load.gzip);
    currentFile = 'load.js.br'    
    await publicationDir.join(currentFile).write(frozen.load.brotli);    
  } else {
    currentFile = 'load.js';
    await publicationDir.join(currentFile).write(frozen.min);
    currentFile = 'load.js.gz'    
    await publicationDir.join(currentFile).write(frozen.gzip); 
    currentFile = 'load.js.br'    
    await publicationDir.join(currentFile).write(frozen.brotli);    
  }
  let dynamicParts = await publicationDir.join('dynamicParts/').ensureExistance();
  for (let [partName, snapshot] of Object.entries(frozen.dynamicParts)) {
    currentFile = partName + '.json';
    await dynamicParts.join(currentFile).writeJson(snapshot);
  }
  let assetDir = await publicationDir.join('assets/').ensureExistance();
  // copy font awesome assets
  await resource(System.baseURL).join(config.css.fontAwesome).parent().copyTo(assetDir.join('fontawesome-free-5.12.1/css/'));
  await resource(System.baseURL).join(config.css.fontAwesome).parent().parent().join('webfonts/').copyTo(assetDir.join('fontawesome-free-5.12.1/webfonts/'));
  // copy inconsoloata
  await resource(System.baseURL).join(config.css.inconsolata).parent().copyTo(assetDir.join('inconsolata/'));
  li.status = 'Copying assets...'
  for (let asset of frozen.assets) await asset.copyTo(assetDir);
  li.remove();
  $world.setStatusMessage([`Published ${publicAlias}. Click `,null, 'here', {
    textDecoration: 'underline', fontWeight: 'bold',
    doit: {code: `window.open("${publicationDir.join('index.html').url}")`}
  }, ' to view.'], Color.green, 10000);
}

export async function displayFrozenPartsFor(user = $world.getCurrentUser(), requester) {
  let userName = user.name;
  let frozenPartsDir = resource(System.baseURL).join('users').join(userName).join('published/');
  if (!await frozenPartsDir.exists()) return;
  let publishedItems = (await frozenPartsDir.dirList()).map(dir => [dir.name(), dir.join('index.html').url])
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
          link: url, fontColor: 'inherit',
        }, name, {
          fontStyle: 'italic', fontWeight: 'bold',
          textStyleClasses: ['annotation', 'truncated-text']
        }]
      })
    } 
  }), {
    requester, fuzzy: true, onSelection: (_, prompt) => {
      prompt.submorphs[2].items.forEach(item => item.morph.fontColor = Color.white);
      if (prompt.submorphs[2].selectedItems[0])
        prompt.submorphs[2].selectedItems[0].morph.fontColor = Color.black;                   
    }
  });
}
  
function belongsToObjectPackage(moduleId) {
  return Path('config.lively.isObjectPackage').get(module(moduleId).package());
}

function cleanSnapshot({snapshot}) {
  Object.values(snapshot).forEach(entry => {
    delete entry.rev;
    if (entry.props && entry.props._rev) delete entry.props._rev;
  });
}

async function getRequiredModulesFromSnapshot(snap, frozenPart, includeDynamicParts=false) {
  var imports = requiredModulesOfSnapshot(snap), // do this after the replacement of calls
      dynamicPartImports = [],
      moduleImports = [];

  let { packages: additionalImports } = await findRequiredPackagesOfSnapshot(snap);
  Object.keys(additionalImports['local://lively-object-modules/'] || {}).forEach(packageName => {
    let filename = `${packageName}/index.js`;
    if (!imports.includes(filename)) {
      imports.push(filename);
    }
  });

  for (let m of imports) {
    const mod = module(m),
          modImports = await mod.requirements(),
          partModuleSource = (mod._source || await mod.source()),
          parsedModuleSource = ast.parse(partModuleSource),
          isObjectPackageModule = belongsToObjectPackage(m),
          dynamicPartLoads = [];
    moduleImports.push(...modImports.map(m => m.id).filter(id => belongsToObjectPackage(id)));
    // extract also modules that are "dependents" and loaded by the SystemJS engine
    ast.AllNodesVisitor.run(parsedModuleSource, (node, path) => {
      if (node.type === 'CallExpression' &&
          ['loadObjectFromPartsbinFolder', 'loadPart'].includes(node.callee.name)) {
        dynamicPartLoads.push(node.arguments[0].value);
        frozenPart.hasDynamicImports = true;
      }
      if (isObjectPackageModule && node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System') {
          frozenPart.modulesWithDynamicLoads.add(mod.id);
          frozenPart.hasDynamicImports = true;
        }
      }
    });

    // try to resolve them
    for (let partName of arr.compact(dynamicPartLoads)) {
      let dynamicPart = await MorphicDB.default.fetchSnapshot('part', partName);
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
          dynamicPartImports.push(...(await getRequiredModulesFromSnapshot(dynamicPart, frozenPart, includeDynamicParts)));
        } else if (frozenPart) {
          let resolved = frozenPart.warnings.resolvedLoads;
          if (resolved) {
            resolved.add(partName);
          } else {
            frozenPart.warnings.resolvedLoads = new Set([partName]);
          }
        }
      }
    }
    
  }
  return arr.uniq([...imports, ...dynamicPartImports, ...moduleImports]);
}

async function evalOnServer(code) {
  if (System.get('@system-env').node) {
    return eval(code)
  }
  let {default: EvalBackendChooser} = await System.import("lively.ide/js/eval-backend-ui.js"),
        {RemoteCoreInterface} = await System.import("lively-system-interface/interfaces/interface.js"),
    // fetch next available nodejs env
        remoteInterface = (await EvalBackendChooser.default.allEvalBackends())
      .map(backend => backend.coreInterface)
      .find(coreInterface => coreInterface instanceof RemoteCoreInterface);
   return await remoteInterface.runEvalAndStringify(code);
}

class LivelyRollup {

  constructor(props = {}) {
    this.setup(props);
  }

  setup({
    excludedModules = [],
    snapshot,
    rootModule,
    globalName,
    asBrowserModule = true,
    includeRuntime = true,
    jspm = false,
    redirect = {
       "https://dev.jspm.io/npm:ltgt@2.1.3/index.dew.js": "https://dev.jspm.io/npm:ltgt@2.2.1/index.dew.js" // this is always needed
    },
    includePolyfills = true 
  }) {
    this.globalMap = {};
    this.jspm = jspm;
    this.includePolyfills = includePolyfills;
    this.includeRuntime = includeRuntime;
    this.snapshot = snapshot;
    this.rootModule = rootModule;
    this.globalName = globalName;
    this.dynamicParts = {}; // parts loaded via loadPart/loadObjectsFromPartsbinFolder
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
  }
  
  resolveRelativeImport(moduleId, path) {
    if (!path.startsWith('.')) return module(path).id;
    return resource(module(moduleId).id).join('..').join(path).withRelativePartsResolved().url
  }

  translateToEsm(jsonString) {
    let source = '';
    for (let [key, value] of Object.entries(JSON.parse(jsonString))) {
       source += `export var ${key} = ${JSON.stringify(value)};\n`;
    }
    return source;
  }

  normalizedId(id) {
    return id.replace(System.baseURL, '').replace('local://lively-object-modules/', '');
  }

  getTransformOptions(mod) {
    if (mod.id === '@empty') return {}
    let classToFunction = {
      classHolder: ast.parse(`(lively.FreezerRuntime.recorderFor("${this.normalizedId(mod.id)}"))`), 
      functionNode: {type: "Identifier", name: "initializeES6ClassForLively"},
      currentModuleAccessor: ast.parse(`({
        pathInPackage: () => {
           return "${mod.pathInPackage()}"
        },
        unsubscribeFromToplevelDefinitionChanges: () => () => {},
        subscribeToToplevelDefinitionChanges: () => () => {},
        package: () => { 
          return {
            name: "${mod.package().name}",
            version: "${mod.package().version}"
          } 
        } 
      })`).body[0].expression,
    }
    return {
       exclude: [
         'System',
         ...mod.dontTransform, 
         ...arr.range(0, 50).map(i => `__captured${i}__`)], 
        classToFunction
     }
  }

  checkIfImportedModuleExcluded() {
    const conflicts = arr.intersect(this.importedModules.map(id => module(id).package()), arr.compact(this.excludedModules.map(id => module(id).package())));
    if (conflicts.length > 0) {
      let multiple = conflicts.length > 1;
      let error = Error(`Package${multiple ? 's' : ''} ${conflicts.map(p => `"${p.name}"`)}\n${multiple ? 'are' : 'is'} directly required by part, yet set to be excluded.`);
      error.name = 'Exclusion Conflict'
      error.reducedExclusionSet = arr.withoutAll(this.excludedModules, conflicts.map(p => p.name));
      throw error;
    }
  }

  async getPartModule(partName) {
    let snapshot = this.dynamicParts[partName];
    let modules = await getRequiredModulesFromSnapshot(snapshot, this);
    return modules.map(path => `import "${path}"`).join('\n');
  }

  async getRootModule() {
    if (this.rootModule) {
      if ((await this.rootModule.exports()).length > 0)
        return `export * from "${this.rootModule.id}";`;
      return await this.rootModule.source();
    }
    this.dynamicParts = {}; // needed such that required modules are fetched correctly
    this.importedModules = await getRequiredModulesFromSnapshot(this.snapshot, this, true);
    this.checkIfImportedModuleExcluded();
    // instead of combining all imported modules here in the root module,
    // split them up in groups, with respect to the part who imports them
    // this can save additional initial loading time
    return arr.uniq((await getRequiredModulesFromSnapshot(this.snapshot, this)).map(path => `import "${path}"`)).join('\n')
       + `\nimport { World, MorphicEnv, loadMorphFromSnapshot } from "lively.morphic";
            import { deserialize } from 'lively.serializer2';
            import { resource, loadViaScript } from 'lively.resources';
            import { promise } from 'lively.lang';
            import {pt} from "lively.graphics";
            ${await resource(System.baseURL).join('localconfig.js').read()}
            const snapshot = JSON.parse(${ JSON.stringify(JSON.stringify(this.snapshot)) })
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
                    MorphicEnv.default().setWorldRenderedOn(obj, node, window.prerenderNode);
                    obj.resizePolicy === 'elastic' && obj.execCommand("resize to fit window");
                  } else {
                    try {
                      window.onresize = lively.FreezerRuntime.resizeHandler = () => obj.execCommand('resize on client');
                      obj.openInWorld(pt(0,0));
                      obj.execCommand('resize on client');
                    } catch (err) {
                      obj.position = pt(0,0);
                    }
                  }
                });
             }`;
  }
  
  resolveId(id, importer) {
    if (id === '__root_module__') return id;
    if (id.startsWith('[PART_MODULE]')) return id;
    if (importer != '__root_module__' &&
        (id.includes('jspm.io') || importer.includes('jspm.io'))
        && this.jspm && importer) {
      let { url } = resource(importer).root();
      if (url.includes('jspm.io')) {
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
    if (!importer) return id;
    let importingPackage = module(importer).package();
    let importedPackage = module(id).package();
    let mappedId;
    if (id == 'lively.ast' && this.excludedModules.includes(id)) {
      return { id, external: true };
    }

    // if we are imported from a non dynamic context this does not apply
    let dynamicContext = this.dynamicModules.has(module(importer).id) || this.dynamicModules.has(module(id).id);
    if (!dynamicContext) {
      if (importingPackage && this.excludedModules.includes(importingPackage.name)) return false;
      if (this.excludedModules.includes(id)) return false; 
    } else {
      this.dynamicModules.add(module(id).id);
    }
    
    if (importingPackage && importingPackage.map) this.globalMap = {...this.globalMap, ...importingPackage.map};
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
      id = this.resolveRelativeImport(importer, id);
      if (!dynamicContext && this.excludedModules.includes(id)) return false;
    }
    if (!id.endsWith('.json') && module(id).format() !== 'register' && !this.jspm) {
      this.globalModules[id] = true;
      return { id, external: true }
    }
    return module(id).id;
  }

  warn(warning, warn) {
    switch (warning.code) {
      case "THIS_IS_UNDEFINED":
      case "EVAL":
      case "MODULE_LEVEL_DIRECTIVE":
        return;
    }
    warn(warning);
  }

  async load(id) {
    id = this.redirect[id] || id;
    if (id == 'lively.ast' && this.excludedModules.includes(id)) {
      return `
        let nodes = {}, query = {}, transform = {}, BaseVisitor = Object;
        export { nodes, query, transform, BaseVisitor };`
    }
    if (id === '__root_module__') {
      let res = await this.getRootModule();
      return res;
    }
    if (id.startsWith('[PART_MODULE]')) {
      let res = await this.getPartModule(id.replace('[PART_MODULE]', ''));
      return res;
    }
    let mod = module(id);
    let pkg = mod.package();
    if (pkg && this.excludedModules.includes(pkg.name) &&
        !mod.id.endsWith('.json') && 
        !this.dynamicModules.has(pkg.name) &&
        !this.dynamicModules.has(mod.id)) {
      return '';
    }
    if (id.endsWith('.json')) {
       return this.translateToEsm(mod._source || await mod.source());
    }
    let s = await mod.source();
    return s;
  }

  needsScopeToBeCaptured(moduleId) {
    if ([...this.dynamicModules.values()].find(id => 
      module(id).package() && module(id).package() === module(moduleId).package())
       ) return true;
    if (this.importedModules.find(id => module(id).package() === module(moduleId).package())) return true;
    return belongsToObjectPackage(moduleId)
  }

  needsClassInstrumentation(moduleId) {
    if (CLASS_INSTRUMENTATION_MODULES.some(m => moduleId.includes(m))) {
      return true;
    }
  }

  needsDynamicLoadTransform(moduleId) {
     return this.modulesWithDynamicLoads.has(moduleId);
  }
  
  async transform(source, id) {

    if (id === '__root_module__' || id.endsWith('.json')) {
       return source
    }
    
    if (this.needsDynamicLoadTransform(id)) {
      source = this.instrumentDynamicLoads(source);
    }
    // this capturing stuff needs to behave differently when we have dynamic imports
    if (this.needsScopeToBeCaptured(id)) {
      source = this.captureScope(source, id);
    } else if (this.needsClassInstrumentation(id)) {
      source = this.instrumentClassDefinitions(source, id);
    }
    
    return source;
  }

  instrumentDynamicLoads(source) {
    let parsed = ast.parse(source),
        nodesToReplace = [];
    
    ast.AllNodesVisitor.run(parsed, (node, path) => {
      // we checked beforehand if the user has decided to use dynamic imports
      // if that is the case, we run on systemjs anyways, so there is no need to stub it
      if (node.type === 'AwaitExpression' &&
          ['loadObjectFromPartsbinFolder', 'loadPart'].includes(node.argument.callee.name)) {
        let partName = node.argument.arguments[0].value;
        nodesToReplace.push({
          // fixme: replace by a dynamic import of the generated deps module, followed by the import
          // like so: `await import("${node.arguments.id}"); lively.FreezerRuntime.loadObjectFromPartsbinFolder`
          target: node,
          replacementFunc: () => `await import("[PART_MODULE]${partName}") && await lively.FreezerRuntime.loadObjectFromPartsbinFolder("${partName}")`
          // target: node.callee, replacementFunc: () => 'lively.FreezerRuntime.loadObjectFromPartsbinFolder' 
        });
      }
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System') {
          nodesToReplace.push({
            target: node.callee, replacementFunc: () => 'import' 
          });
        }
      }
    });

    return ast.transform.replaceNodes(nodesToReplace, source).source;
  }

  instrumentClassDefinitions(source, id) {
    let importerString = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n'
    let mod = module(id);
    let tfm = compose(classes.classToFunctionTransform, ast.transform.objectSpreadTransform, ast.stringify)
    return tfm(ast.parse(importerString + source), this.getTransformOptions(mod).classToFunction);
  }

  captureScope(source, id) {
    let importerString = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n'
    let recorderString = `const __varRecorder__ = lively.FreezerRuntime.recorderFor("${this.normalizedId(id)}");\n`;
    let tfm = compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform);
    let captureObj = {name: `__varRecorder__`, type: 'Identifier'};
    let mod = module(id);
    let parsed = ast.parse(importerString + source);
    return recorderString + ast.stringify(insertCapturesForExportedImports(tfm(parsed, captureObj, this.getTransformOptions(mod)), { captureObj }));
  }
  
  deriveVarName(moduleId) { return string.camelize(arr.last(moduleId.split('/')).replace(/\.js|\.min/g, '').split('.').join('')) }

  async wrapStandalone(moduleId) {
    let mod = module(moduleId);
    if (!mod._source) await mod.source();
    let globalVarName = this.deriveVarName(moduleId)
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
    return { code, global: globalVarName}
  }

  async generateGlobals(systemJsEnabled) {
    let code = '',
        globals = {};

    if (!systemJsEnabled) {
      code += `${this.asBrowserModule ? 'var fs = {};' : 'var fs = require("fs");'} var _missingExportShim, show, System, require, timing, lively, Namespace, localStorage;`;
    }

    // this is no longer an issue due to removal of all non ESM modules from our system. Can be removed?
    for (let modId in this.globalModules) {
      let { code: newCode, global: newGlobal } = await this.wrapStandalone(modId);
      code += newCode;
      globals[modId] = newGlobal;
    }

    if (systemJsEnabled) {
      code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/0.21/dist/system.src.js').read();
      //code += await resource(System.decanonicalize('systemjs/dist/system.js')).read();
      //code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/master/dist/s.js').read();
      //code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/master/dist/extras/named-register.js').read();
      // stub the globals
      code += `
         const _origGet = System.get.bind(System);
         System.get = (id, recorder = true) => (lively.FreezerRuntime && lively.FreezerRuntime.get(id, recorder)) || _origGet(id);
      `;
      //if (this.asBrowserModule) code += 'System.global = window;\n'
      code += `
         const _origDecanonicalize = System.decanonicalize.bind(System);
         System.decanonicalize = (id) =>
            lively.FreezerRuntime ? lively.FreezerRuntime.decanonicalize(id) : _origDecanonicalize(id);
      `
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
      }));\n`
      code += `System.config({
        transpiler: 'stub-transpiler'
      });\n`
      code += 'System.trace = false;\n';
      for (let id of this.excludedModules.concat(this.asBrowserModule ? ["fs", "events"] : [])) {
        //code += `"${id}": "@empty",`
        code += `System.set("${id}", System.newModule({ default: {} }));\n`;
        //code += `System.register("${id}", [], (exports) => ({ execute: () => { console.log('loaded ${id}'); exports({ default: {} }) }, setters: []}));\n`;
      }
    } else {
      for (let id of this.excludedModules) {
        let varName = globals[id] = this.deriveVarName(id);
        code += `var ${varName} = {};\n`;
      }
    }
    
    return {
      code, globals
    }
  }
  
  async getRuntimeCode() {
    let runtimeCode = await module('lively.freezer/runtime.js').source();
    runtimeCode =`(${runtimeCode.slice(0,-1).replace('export ', '')}})();\n`;
    if (!this.hasDynamicImports) {
      // If there are no dynamic imports, we compile without systemjs and
      // can stub it with our FreezerRuntime
      runtimeCode += 'if (!window.System) window.System = window.lively.FreezerRuntime;\n'
    }
    return es5Transpilation(runtimeCode);
  }

  getAssetsFromSnapshot({snapshot: snap}) {

    Object.entries(snap).map(([k, v]) => {
      if (!classNameOfId(snap, k) || !moduleOfId(snap, k).package) return;
      let klass = locateClass({
        className: classNameOfId(snap, k),
        module: moduleOfId(snap, k)
      });
      let toBeCopied = Object.entries(klass[Symbol.for("lively.classes-properties-and-settings")].properties)
                             .map(([key, settings]) => settings.copyAssetOnFreeze && key)
                             .filter(Boolean);
      for (let prop of toBeCopied) {
        if (v.props[prop].value.startsWith('assets')) continue; // already copied
        let path = v.props[prop].value;
        if (path.startsWith('data:')) continue; // data URL can not be copied
        let asset = resource(path);
        if (asset.host() != resource(System.baseURL).host()) continue;
        asset._from = k;
        this.assetsToCopy.push(asset);
        v.props[prop].value = 'assets/' + asset.name(); // this may be causing duplicates
      }
    });
    console.log('[ASSETS]', this.assetsToCopy);
  }

  async rollup(compressBundle, output) {
    let li = LoadingIndicator.open('Freezing Part', { status: 'Bundling...' });
    let depsCode, bundledCode, splitModule;

    this.getAssetsFromSnapshot(this.snapshot);

    await li.whenRendered();
    try {
      let bundle = await rollup({
        input: this.rootModule ? this.rootModule.id : '__root_module__',
        shimMissingExports: true,
        onwarn: (warning, warn) => { return this.warn(warning, warn) },
        plugins: [{
          resolveId: (id, importer) => {
            let res = this.resolveId(id, importer);
            return res;
          },
          resolveDynamicImport: (id, importer) => {
            // schedule a request to initiate a nested rollup that bundles
            // the dynamically loaded bundles separately
            console.log(id, importer);
            this.dynamicModules.add(module(id).id);
            let res = this.resolveId(id, importer); // dynamic imports are never excluded
            if (res && obj.isString(res)) {
              return {
                external: false,
                id: res
              }
            }
            return res;
          },
          load: async (id) => { return await this.load(id) },
          transform: async (source, id) => { return await this.transform(source, id)}
        }]
      });
      let globals;
      ({code: depsCode, globals} = await this.generateGlobals(this.hasDynamicImports));
      if (this.hasDynamicImports) {
        splitModule = (await bundle.generate({ format: 'system', globals }));
      } else
        bundledCode = (await bundle.generate({ format: 'iife', globals, name: this.globalName || 'frozenPart' })).output[0].code;
    } finally {
      li.remove();
    }

    let res;
    if (splitModule) {
      res = splitModule.output;
      // it seems like rollup sometimes returns duplicates which are optimized away by closure
      // causing issues when reassigned the minified pieces
      //res = arr.uniqBy(res, (snipped1, snipped2) => snipped1.code === snipped2.code);
      let loadCode = `
        System.config({
          meta: {
           ${
            res.map(snippet => `'./${snippet.fileName}': {format: "system"}`).join(',\n') // makes sure that compressed modules are still recognized as such
            }
          }
        });
        System.import("./__root_module__.js").then(m => { System.trace = false; m.renderFrozenPart(); });
      `
      // concat all snippets and compile them on server
      // unsert hint strings
      res.forEach((snippet, i) => {
        snippet.instrumentedCode = snippet.code.replace('System.register(', `System.register("${i}",` );
      });
      let { min, code } = await this.transpileAndCompressOnServer({
          depsCode,
          bundledCode: [loadCode, ...res.map(snippet => snippet.instrumentedCode)].join('\n'),
          output, compressBundle
      });
      
      let [compiledLoad, ...compiledSnippets] = min.split(/\nSystem.register\(/);

      // ensure that all compiled snippets are present
      // clear the hints
      let adjustedSnippets = new Map(); // ensure order
      res.forEach((snippet, i) => {
        adjustedSnippets.set(i, snippet.code);
      });
      compiledSnippets.forEach((compiledSnippet) => {
        let hint = Number(compiledSnippet.match(/\"[0-9]+\"/)[0].slice(1,-1));
        adjustedSnippets.set(hint, compiledSnippet.replace(/\"[0-9]+\"\,/, 'System.register('));
      });
      compiledSnippets = [...adjustedSnippets.values()];
      
      res.load = { min: compiledLoad };
      for (let [snippet, compiled] of arr.zip(res, compiledSnippets))
        snippet.min = compiled;
    } else {
      res = await this.transpileAndCompressOnServer({
        depsCode, bundledCode: bundledCode, output, compressBundle
      });
    }

    res.format = !this.hasDynamicImports ? 'global' : 'systemjs';
    for (let part in this.dynamicParts) {
      this.getAssetsFromSnapshot(this.dynamicParts[part]);
    }
    res.dynamicParts = this.dynamicParts;
    res.assets = this.assetsToCopy;

    return res
  }

  async transpileAndCompressOnServer({
      depsCode = '',
      bundledCode,
      output,
      fileName = '',
      compressBundle,
      addRuntime = true,
      optimize = true,
      includePolyfills = this.includePolyfills 
    }) {
    let li = LoadingIndicator.open("Freezing Part", { status: 'Optimizing...'});
    
    let runtimeCode = addRuntime ? await this.getRuntimeCode() : "";
    let regeneratorSource = '';
    let polyfills = !includePolyfills ? "" : await module('lively.freezer/deps/pep.min.js').source();
    polyfills += !includePolyfills ? "" : await module('lively.freezer/deps/fetch.umd.js').source();
    
    let code = runtimeCode + polyfills + regeneratorSource + depsCode + bundledCode;
    // write file
    if (!optimize) { li.remove(); return { code, min: code }; }
    let res = await compileOnServer(code, li, fileName); // seems to be faster for now
    //res = await compileViaGoogle(code, li, fileName);
    li.status = `Compressing ${fileName}...`;
    
    if (compressBundle) {
      res.brotli = await compress(new TextEncoder('utf-8').encode(res.min));
      res.gzip = window.flate.deflate_encode_raw(new TextEncoder('utf-8').encode(res.min));
    }
    li.remove();
    return res;
  }
}

async function compileViaGoogle(code, li, fileName) {
  let compile = resource('https://closure-compiler.appspot.com/compile')
  compile.headers["Content-type"] = "application/x-www-form-urlencoded";
  li.status = `Compiling ${fileName} on Google's servers.`;
  let queryString = compile.withQuery({
    js_code: code,
    warning_level: 'QUIET',
    output_format: 'text',
    output_info: 'compiled_code',
    language_out: 'ECMASCRIPT5'
  }).path().split('?')[1]
  let min = await compile.post(queryString);
  return {
    min,
    code
  }
}

async function compileOnServer(code, loadingIndicator, fileName = 'data') {
  let googleClosure = System.decanonicalize('google-closure-compiler-linux/compiler').replace(System.baseURL, '../');
  let tmp = resource(System.decanonicalize('lively.freezer/tmp.js'));
  let min = resource(System.decanonicalize('lively.freezer/tmp.min.js'));
  tmp.onProgress = (evt) => {
    // set progress of loading indicator
    let p = evt.loaded / evt.total;
    loadingIndicator.progress = p;
    loadingIndicator.status = `Sending ${fileName} to Google Closure: ` + (100 * p).toFixed() + '%';
  };
  min.onProgress = (evt) => {
    // set progress of loading indicator
    let p = evt.loaded / evt.total;
    loadingIndicator.progress = p;
    loadingIndicator.status = 'Retrieving compiled code...' + (100 * p).toFixed() + '%';
  };
  await tmp.write(code);
  let cwd = await evalOnServer('System.baseURL + "lively.freezer/"').then(cwd => cwd.replace('file://', ''));
  let c, res = {};
  if (System.get('@system-env').node) {
    let { default: ServerCommand } = await System.import('lively.shell/server-command.js')
    let cmd = new ServerCommand().spawn({
      command: `${googleClosure} tmp.js > tmp.min.js --warning_level=QUIET`,
      cwd
    });
    c = { status: 'started' };
    cmd.on("stdout", stdout => c.status = 'exited');
  } else {
    c = await runCommand(`${googleClosure} tmp.js > tmp.min.js --warning_level=QUIET`, { cwd }); 
  }
  loadingIndicator.status = `Compiling ${fileName}...`;
  loadingIndicator.progress = 0.01;
  for (let i of arr.range(0, code.length / 62000)) {
    await promise.delay(400);
    if (c.status.startsWith('exited')) break;
    loadingIndicator.progress = (i + 1) / (code.length / 62000);
  }
  await promise.waitFor(50000, () => c.status.startsWith('exited'));
  if (c.stderr) {
    loadingIndicator && loadingIndicator.remove();
    throw new Error(c.stderr);
  }
  res.code = code;
  
  res.min = await min.read();
  await Promise.all([tmp, min].map(m => m.remove()));
  return res;
}

function transpileAttributeConnections(snap) {
  let transpile = compose((c) => `(${c})`, es5Transpilation, stringifyFunctionWithoutToplevelRecorder);
  Object.values(snap.snapshot).filter(m => Path(["lively.serializer-class-info", "className"]).get(m) == 'AttributeConnection').forEach(m => {
    if (m.props.converterString) {
      return m.props.converterString.value = transpile(m.props.converterString.value);
    }
    if (m.props.updaterString) {
      return m.props.updaterString.value = transpile(m.props.updaterString.value);
    }
  });
}
// partOrSnapshot = this.get('world landing page')
export async function bundlePart(partOrSnapshot, { exclude: excludedModules = [], compress = false, output = 'es2019', requester }) {
  let snapshot = partOrSnapshot.isMorph ? await createMorphSnapshot(partOrSnapshot) : partOrSnapshot;
  transpileAttributeConnections(snapshot);
  let bundle = new LivelyRollup({ excludedModules, snapshot, jspm: true });
  let rollupBundle = async () => {
    let res;
    try {
      res = await bundle.rollup(compress, output);
    } catch (e) {
      if (e.name == 'Exclusion Conflict') {
        // adjust the excluded Modules
        let proceed = await $world.confirm([
          e.message.replace('Could not load __root_module__:', ''), {}, '\n', {}, 'Packages are usually excluded to reduce the payload of a frozen interactive.\nIn order to fix this issue you can either remove the problematic package from the exclusion list,\nor remove the morph that requires this package directly. Removing the package from the\nexclusion list is a quick fix yet it may increase the payload of your frozen interactive substantially.', {fontSize: 13, fontWeight: 'normal'}], { requester, confirmLabel: 'Remove Package from Exclusion Set', rejectLabel: 'Cancel' });
        if (proceed) {
          bundle.excludedModules = e.reducedExclusionSet;
          return await rollupBundle();
        }
      }
      throw e;
    }
    return res;
  }
  return await rollupBundle();
}
