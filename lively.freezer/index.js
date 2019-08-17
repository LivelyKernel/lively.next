/*global System,TextEncoder*/
import { rollup } from 'https://unpkg.com/rollup@1.17.0/dist/rollup.browser.js';
import {compress} from 'wasm-brotli'
import {
  createMorphSnapshot,
  loadPackagesAndModulesOfSnapshot,
  findRequiredPackagesOfSnapshot
} from "lively.morphic/serialization.js";
import { MorphicDB, morph } from "lively.morphic";
import { module } from "lively.modules";
import * as ast from 'lively.ast';
import * as classes from 'lively.classes';
import { resource } from "lively.resources";
import LoadingIndicator from "lively.components/loading-indicator.js";
import { es5Transpilation } from "lively.source-transform";
import {
  rewriteToCaptureTopLevelVariables,
  insertCapturesForExportedImports
} from "lively.source-transform/capturing.js";
import { compose } from "lively.lang/function.js";
import { requiredModulesOfSnapshot } from "lively.serializer2";
import { AllNodesVisitor } from "lively.ast/lib/visitors.js";
import { runCommand } from "lively.ide/shell/shell-interface.js";
import { Path, promise, string, arr } from "lively.lang";
import { Color } from "lively.graphics";

// part = this.get('typeshift wrapper')
/*
frozen = await bundlePart(part, { compress: true, exclude: [
    'lively.ast', 'lively.vm', 'lively-system-interface', 'lively.halos', 'lively.ide', 'pouchdb', 'pouchdb-adapter-mem', 'bowser'
]})
await resource('https://admin.typeshift.io/rollup-test.closure.js').write(frozen.min)
*/
// frozen = await bundlePart(part, { compress: true })

export async function generateLoadHtml(part) {
  const addScripts = `
      <noscript>
         <meta http-equiv="refresh" content="0;url=/noscript.html">
      </noscript>
      <title>${part.title || part.name}</title>
      ${part.__head_html__ || ''}
      <style>
        #prerender {
           position: absolute
        }
        html {
          touch-action: manipulation;
        }
      </style> 
      <script>
        if (!window.location.origin) {
          window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
        }
        lively = {};
        System = { baseUrl: window.location.origin };
      </script>
      <link rel="preload" id="loader" href="load.js" as="script">`;

   let html = `
     <!DOCTYPE html>
     <head>
     <meta content="utf-8" http-equiv="encoding">
     <meta content="text/html;charset=utf-8" http-equiv="Content-Type">
     <meta name="viewport" content="minimum-scale=1.0, maximum-scale=5.0, initial-scale=1.0, viewport-fit=cover">
     <meta name="apple-mobile-web-app-capable" content="yes">
     <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
  html += addScripts;
  html += `</head><body style="margin: 0; overflow-x: hidden; width: 100%; height: 100%;"><div id="loading screen">${part.__loading_html__ || ''}</div><div id="crawler content">${part.__crawler_html__ || ''}</div>
<script id="crawler checker">
    var botPattern = "(googlebot\/|Googlebot-Mobile|Googlebot-Image|Google favicon|Mediapartners-Google|bingbot|slurp|java|wget|curl|Commons-HttpClient|Python-urllib|libwww|httpunit|nutch|phpcrawl|msnbot|jyxobot|FAST-WebCrawler|FAST Enterprise Crawler|biglotron|teoma|convera|seekbot|gigablast|exabot|ngbot|ia_archiver|GingerCrawler|webmon |httrack|webcrawler|grub.org|UsineNouvelleCrawler|antibot|netresearchserver|speedy|fluffy|bibnum.bnf|findlink|msrbot|panscient|yacybot|AISearchBot|IOI|ips-agent|tagoobot|MJ12bot|dotbot|woriobot|yanga|buzzbot|mlbot|yandexbot|purebot|Linguee Bot|Voyager|CyberPatrol|voilabot|baiduspider|citeseerxbot|spbot|twengabot|postrank|turnitinbot|scribdbot|page2rss|sitebot|linkdex|Adidxbot|blekkobot|ezooms|dotbot|Mail.RU_Bot|discobot|heritrix|findthatfile|europarchive.org|NerdByNature.Bot|sistrix crawler|ahrefsbot|Aboundex|domaincrawler|wbsearchbot|summify|ccbot|edisterbot|seznambot|ec2linkfinder|gslfbot|aihitbot|intelium_bot|facebookexternalhit|yeti|RetrevoPageAnalyzer|lb-spider|sogou|lssbot|careerbot|wotbox|wocbot|ichiro|DuckDuckBot|lssrocketcrawler|drupact|webcompanycrawler|acoonbot|openindexspider|gnam gnam spider|web-archive-net.com.bot|backlinkcrawler|coccoc|integromedb|content crawler spider|toplistbot|seokicks-robot|it2media-domain-crawler|ip-web-crawler.com|siteexplorer.info|elisabot|proximic|changedetection|blexbot|arabot|WeSEE:Search|niki-bot|CrystalSemanticsBot|rogerbot|360Spider|psbot|InterfaxScanBot|Lipperhey SEO Service|CC Metadata Scaper|g00g1e.net|GrapeshotCrawler|urlappendbot|brainobot|fr-crawler|binlar|SimpleCrawler|Livelapbot|Twitterbot|cXensebot|smtbot|bnf.fr_bot|A6-Indexer|ADmantX|Facebot|Twitterbot|OrangeBot|memorybot|AdvBot|MegaIndex|SemanticScholarBot|ltx71|nerdybot|xovibot|BUbiNG|Qwantify|archive.org_bot|Applebot|TweetmemeBot|crawler4j|findxbot|SemrushBot|yoozBot|lipperhey|y!j-asr|Domain Re-Animator Bot|AddThis)";
    var re = new RegExp(botPattern, 'i');
    var userAgent = navigator.userAgent;
    if (!re.test(userAgent)) {
      document.getElementById("crawler content").remove();
      var script = document.createElement('script');
      script.setAttribute('src',"load.js");
      document.head.appendChild(script);
    }
    document.getElementById("crawler checker").remove();
</script>
</body>`;
  return html;
}

export async function interactivelyFreezePart(part, requester = false) {
  /*
    Function prompts the user for a name to publish the part under.
    Data is uploaded to directory and then returns a link to the folder. 
  */ 
  let userName = $world.getCurrentUser().name;
  let frozenPartsDir = await resource(System.baseURL).join('users').join(userName).join('published/').ensureExistance();
  let publicAlias = await $world.prompt('Please enter a name for this published part:', { requester });
  if (!publicAlias) return;
  let publicationDir = frozenPartsDir.join(publicAlias + '/');
  while (await publicationDir.exists()) {
    let proceed = await $world.confirm(`A part published as "${publicAlias}" already exists.\nDo you want to overwrite this publication?`, { requester });
    if (proceed) break;
    publicAlias = await $world.prompt('Please enter a different name for this published part:', { requester });
    if (!publicAlias) return;
    publicationDir = frozenPartsDir.join(publicAlias + '/');
  }

  await publicationDir.ensureExistance();

  // freeze the part
  let frozen;
  try {
    frozen = await bundlePart(part, {
      compress: true,
      exclude: [
        'lively.ast', 'lively.vm', 'lively-system-interface',
        'pouchdb',
        'pouchdb-adapter-mem',
        'lively.halos',
        'lively.ide'
      ]
    });
  } catch(e) {
    throw e;
  }

  let li = LoadingIndicator.open('Writing files...')
  await publicationDir.join('index.html').write(await generateLoadHtml(part));
  await publicationDir.join('load.js').write(frozen.min);
  let dynamicParts = await publicationDir.join('dynamicParts/').ensureExistance();
  for (let [partName, snapshot] of Object.entries(frozen.dynamicParts)) {
    await dynamicParts.join(partName + '.json').writeJson(snapshot);
  }
  li.remove();
}

export async function displayFrozenPartsFor(user = $world.getCurrentUser(), requester) {
  let userName = user.name;
  let frozenPartsDir = resource(System.baseURL).join('users').join(userName).join('published/');
  if (!await frozenPartsDir.exists()) return;
  let publishedItems = (await frozenPartsDir.dirList()).map(dir => [dir.name(), dir.join('index.html').url])
  $world.listPrompt('Published Parts', publishedItems.map(([name, url]) => {
    return {
      isListItem: true,
      autoFit: true,
      morph: morph({
        type: 'text',
        fontSize: 14,
        fontColor: Color.white,
        fill: Color.transparent,
        fixedWidth: true,
        textAndAttributes: [url.replace(System.baseURL, ''), {
          link: url, fontColor: Color.white
        }, name, {
          fontStyle: 'italic', fontWeight: 'bold',
          textStyleClasses: ['annotation', 'truncated-text']
        }]
      })
    } 
  }), { requester });
}
  
function belongsToObjectPackage(moduleId) {
  return Path('config.lively.isObjectPackage').get(module(moduleId).package());
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
          dynamicPartLoads = [];
    
    moduleImports.push(...modImports.map(m => m.id).filter(id => belongsToObjectPackage(id)));

    // extract also modules that are "dependents" and loaded by the SystemJS engine
    let callSite;
    AllNodesVisitor.run(parsedModuleSource, (node, path) => {
      if (node.type === 'CallExpression' &&
          ['loadObjectFromPartsbinFolder', 'loadPart'].includes(node.callee.name)) {
        dynamicPartLoads.push(node.arguments[0].value);
      }
    });

    // try to resolve them
    for (let partName of dynamicPartLoads) {
      let dynamicPart = await MorphicDB.default.fetchSnapshot('part', partName);
      if (dynamicPart) {             
        if (frozenPart) frozenPart.dynamicParts[partName] = dynamicPart;
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

  setup({ excludedModules = [], snapshot }) {
    this.snapshot = snapshot;
    this.dynamicParts = {};
    this.globalModules = {};
    this.resolved = new Set();
    this.excludedModules = [...excludedModules, 'lively.modules', "kld-intersections"];
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
      classHolder: ast.parse(`(System.recorderFor("${this.normalizedId(mod.id)}"))`), 
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
    const conflicts = arr.intersect(this.importedModules.map(id => module(id).package()), this.excludedModules.map(id => module(id).package()));
    if (conflicts.length > 0) {
      throw Error(`Packages ${conflicts} are directly required by part, yet set to be excluded.`);
    }
  }

  async getRootModule() {
     this.importedModules = await getRequiredModulesFromSnapshot(this.snapshot, this, true);
     this.checkIfImportedModuleExcluded();
     return arr.uniq(this.importedModules.map(path => `import "${path}"`)).join('\n')
        + `\nimport { World, MorphicEnv, loadMorphFromSnapshot } from "lively.morphic";
             import { deserialize } from 'lively.serializer2';
             import { resource } from 'lively.resources';
             import { promise } from 'lively.lang';
             import {pt} from "lively.graphics";
             ${await resource(System.baseURL).join('localconfig.js').read()}
             const snapshot = ${ JSON.stringify(this.snapshot) }
             lively.resources = { resource };
             lively.morphic = { loadMorphFromSnapshot }
             if (!MorphicEnv.default().world) {
                let world = window.$world = window.$$world = new World({
                  name: snapshot.name, extent: pt(window.innerWidth, window.innerHeight)
                });
                MorphicEnv.default().setWorldRenderedOn(world, document.body, window.prerenderNode);
             }
             export async function renderFrozenPart() {
                window.$world.dontRecordChangesWhile(() => {
                  let obj = deserialize(snapshot, {
                     reinitializeIds: function(id) { return id }
                  });
                  if (obj.isWorld) {
                    obj.position = pt(0,0);
                    MorphicEnv.default().setWorldRenderedOn(obj, document.body, window.prerenderNode);
                    obj.execCommand("resize to fit window");
                  } else {
                    window.onresize = () => obj.execCommand('resize on client');
                    obj.execCommand('resize on client');
                    obj.openInWorld();
                  }
                });
             }`;
  }
  
  resolveId(id, importer) {
    if (id === '__root_module__') return id;
    if (!importer) return id;
    if (id == 'fs') {
      return { id, external: true }
    }
    let pkg = module(importer).package();
    let mappedId;
    if (pkg && this.excludedModules.includes(pkg.name)) return false;
    if (this.excludedModules.includes(id)) return false;
    if (pkg && pkg.map[id]) {
      mappedId = id;
      id = pkg.map[id];
      if (id['~node']) id = id['~node'];
      importer = pkg.url;
    }
    if (id.startsWith('.')) {
      id = this.resolveRelativeImport(importer, id);
      if (this.excludedModules.includes(id)) return false;
    }
    if (!id.endsWith('.json') && module(id).format() !== 'register') {
      this.globalModules[id] = true;
      return { id, external: true }
    }
    return id;
  }

  async load(id) {
    if (id === '__root_module__') return await this.getRootModule();
    let mod = module(id);
    if (this.excludedModules.includes(mod.package().name) && !mod.id.endsWith('.json')) {
      return '';
    }
    if (id.endsWith('.json')) {
       return this.translateToEsm(mod._source || await mod.source());
    }
    return await mod.source()
  }

  needsScopeToBeCaptured(moduleId) {
    if (this.importedModules.find(id => module(id).package() === module(moduleId).package())) return true;
    return belongsToObjectPackage(moduleId)
  }

  needsClassInstrumentation(moduleId) {
    if (moduleId.includes('lively.morphic') || 
        moduleId.includes('lively.components') ||
        moduleId.includes('lively.ide') ||
        moduleId.includes('lively.halos')) {
      return true;
    }
  }

  needsDynamicLoadTransform(moduleId) {
     return belongsToObjectPackage(moduleId);
  }
  
  transform(source, id) {
    if (id === '__root_module__' || id.endsWith('.json')) {
       return source
    }
    if (this.needsScopeToBeCaptured(id)) {
      source = this.captureScope(source, id);
    } else if (this.needsClassInstrumentation(id)) {
      source = this.instrumentClassDefinitions(source, id);
    }

    if (this.needsDynamicLoadTransform(id)) {
      source = this.instrumentDynamicLoads(source);
    }
    
    return source;
  }

  instrumentDynamicLoads(source) {
    let scopes = ast.query.scopes(ast.parse(source)),
        refs = [];
    refs.push(...ast.query.findReferencesAndDeclsInScope(scopes, 'loadObjectFromPartsbinFolder').refs);
    refs.push(...ast.query.findReferencesAndDeclsInScope(scopes, 'loadPart').refs);

    return ast.transform.replaceNodes(refs.map(target => ({
      target, replacementFunc: () => 'lively.FreezerRuntime.loadObjectFromPartsbinFolder' 
    })), source).source;
  }

  instrumentClassDefinitions(source, id) {
    let importerString = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n'
    let mod = module(id);
    let tfm = compose(classes.classToFunctionTransform, ast.transform.objectSpreadTransform, ast.stringify)
    return tfm(ast.parse(importerString + source), this.getTransformOptions(mod).classToFunction);
  }

  captureScope(source, id) {
    let importerString = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n'
    let recorderString = `const __varRecorder__ = System.recorderFor("${this.normalizedId(id)}");\n`;
    let tfm = compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform);
    let captureObj = {name: `__varRecorder__`, type: 'Identifier'};
    let mod = module(id);
    let parsed = ast.parse(importerString + source);
    return recorderString + ast.stringify(insertCapturesForExportedImports(tfm(parsed, captureObj, this.getTransformOptions(mod)), { captureObj }));
  }
  
  deriveVarName(moduleId) { return string.camelize(arr.last(moduleId.split('/')).replace(/\.js|\.min/g, '').split('.').join('')) }

  wrapStandalone(moduleId) {
    let mod = module(moduleId);
    let globalVarName = this.deriveVarName(moduleId)
    let code;
    if (mod.format() === 'global') {
      code = `var ${globalVarName} = (function() {
         var fetchGlobals = System.prepareGlobal("${mod.id}");
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
             var exec = function(exports, require) { ${mod._source} };
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

  generateGlobals() {
    let code = "var fs = {}; var _missingExportShim, show, System, require, timing, lively, Namespace, localStorage;", globals = {};
    for (let modId in this.globalModules) {
       let { code: newCode, global: newGlobal } = this.wrapStandalone(modId);
       console.log(modId, newCode.length);
       code += newCode;
       globals[modId] = newGlobal;
    }
    for (let id of this.excludedModules) {
      let varName = globals[id] = this.deriveVarName(id);
      code += `var ${varName} = {};\n`;
    }
    return {
      code, globals
    }
  }
  
  async getRuntimeCode() {
    let runtimeCode = await module('lively.freezer/runtime.js').source();
    runtimeCode =`(${runtimeCode.slice(0,-1).replace('export ', '')}})()`;
    return es5Transpilation(runtimeCode);
  }

  async rollup(compressBundle, output) {
    let li = LoadingIndicator.open('Bundling...');

    await li.whenRendered();
    let bundle = await rollup({
      input: '__root_module__',
      shimMissingExports: true,
      plugins: [{
        resolveId: (id, importer) => { return this.resolveId(id, importer) },
        load: async (id) => { return await this.load(id) },
        transform: (source, id) => { return this.transform(source, id)}
      }]
    });
    
    let {code: depsCode, globals} = this.generateGlobals();
    let bundledCode = (await bundle.generate({ format: 'iife', globals, name: 'frozenPart' })).output[0].code;
    li.remove();
    let res = await this.transpileAndCompressOnServer({
      depsCode, bundledCode, output, compressBundle
    });

    res.dynamicParts = this.dynamicParts;

    return res
  }

  async transpileAndCompressOnServer({ depsCode, bundledCode, output, compressBundle }) {
    let li = LoadingIndicator.open('Optimizing...');
    
    let runtimeCode = await this.getRuntimeCode();
    let regeneratorSource = await lively.modules.module('babel-regenerator-runtime').source();
    let polyfills = await module('lively.freezer/deps/pep.min.js').source();
    polyfills += await module('lively.freezer/deps/fetch.umd.js').source();
    
    let swc = System.decanonicalize('@swc/cli/bin/swc.js').replace(System.baseURL, '../');
    let uglify = System.decanonicalize('uglify-es/bin/uglifyjs').replace(System.baseURL, '../');
    let googleClosure = System.decanonicalize('google-closure-compiler-linux/compiler').replace(System.baseURL, '../');
    let code = runtimeCode + polyfills + depsCode + regeneratorSource + bundledCode + '\nfrozenPart.renderFrozenPart();';
    // write file
    let tmp = resource(System.decanonicalize('lively.freezer/tmp.js'));
    let es5 = resource(System.decanonicalize('lively.freezer/tmp.es5.js'));
    let min = resource(System.decanonicalize('lively.freezer/tmp.min.js'));
    await tmp.write(code);
    let cwd = '/home/robin/lively.next/lively.freezer';
    let c, res = {};
    if (output == 'es5') {
      c = await runCommand(`${swc} tmp.js -o tmp.es5.js`, { cwd });
      await promise.waitFor(50000, () => c.status.startsWith('exited'));
      c = await runCommand(`${uglify} tmp.es5.js > tmp.min.js`, { cwd });
      await promise.waitFor(50000, () => c.status.startsWith('exited'));
      res.code = await es5.read();
      await es5.remove();
    } else {
      c = await runCommand(`${googleClosure} tmp.js > tmp.min.js --warning_level=QUIET`, { cwd });
      await promise.waitFor(50000, () => c.status.startsWith('exited'));
      if (c.stderr) throw new Error(c.stderr);
      console.log(c);
      res.code = code;
    }
    res.min = await min.read();
    li.label = 'Compressing...';
    if (compressBundle) res.compressed = await compress(new TextEncoder('utf-8').encode(res.min));
    await Promise.all([tmp, min].map(m => m.remove()));
    li.remove();
    return res;
  }
}

export async function bundlePart(part, { exclude: excludedModules = [], compress, output = 'es2019' }) {
  let snapshot = await createMorphSnapshot(part);
  let bundle = new LivelyRollup({ excludedModules, snapshot });
  let res = await bundle.rollup(compress, output);
  console.log(bundle);
  return res;
}