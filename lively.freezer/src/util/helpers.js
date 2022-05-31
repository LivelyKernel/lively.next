/* global System,global,process,Buffer,require */
import * as classes from 'lively.classes';
import { toJsIdentifier } from 'lively.classes/util.js';
import { resource } from 'lively.resources';
import { arr, Path, fun, promise } from 'lively.lang';
import { es5Transpilation, stringifyFunctionWithoutToplevelRecorder } from 'lively.source-transform';

export const ROOT_ID = '\0__rootModule__';

export const isNode = typeof System !== 'undefined'
  ? System.get('@system-env').node
  : (typeof global !== 'undefined' && typeof process !== 'undefined');

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function incName (name) {
  return name.replace(/(?:_([0-9]*))?$/, (match, n) => match ? `_${Number(n) + 1}` : '_1');
}

export function findUniqJsName (name, boundNames = []) {
  name = toJsIdentifier(name, true);
  while (boundNames.includes(name)) name = incName(name);
  return name;
}

// await gzip(await gzip('hello'), false)

// problem: when we encode the compressed string in utf8 it gets fucked up during transmission
// solution: when compressed string is sent between client and server translate to base64

export async function gzip (blob, inflate = true, useBrotli = false) {
  // if this is not node, perform a remote eval instead
  // blob is a string in utf8 format, convert it to base64 for safe transmission
  if (!isNode) {
    let { default: EvalBackendChooser } = await System.import('lively.ide/js/eval-backend-ui.js');
    let { RemoteCoreInterface } = await System.import('lively-system-interface/interfaces/interface.js');
    // fetch next available nodejs env
    let remoteInterface = (await EvalBackendChooser.default.allEvalBackends())
      .map(backend => backend.coreInterface)
      .find(coreInterface => coreInterface instanceof RemoteCoreInterface);
    let res = await remoteInterface.runEvalAndStringify(`
        let { gzip } = await System.import('lively.freezer/src/util/helpers.js');
        await gzip(${
           JSON.stringify(blob) // JSON.stringify(inflate ? blob : btoa(blob))
        }, ${inflate}, ${useBrotli});`);
      // if (inflate) {
      //   // if we instructed the server to compress, it sends the response in
      //   // base64, which we have to convert to utf8 such that we can
      //   // write it to a file again.
      //   return atob(res);
      // }
    return res;
  }
  if (!isNode) return;
  let zlib = require('zlib');
  let compressionFn = useBrotli
    ? (inflate ? zlib.brotliCompressSync : zlib.brotliDecompressSync)
    : (inflate ? zlib.gzipSync : zlib.gunzipSync);
  blob = inflate ? blob : new Buffer(blob, 'base64');
  let compressed = compressionFn(blob);
  // return compressed.toString('utf8');
  return compressed.toString(inflate ? 'base64' : 'utf8');
}

// await brotli(await brotli('hello'), false)
export async function brotli (blob, inflate = true) {
  return await gzip(blob, inflate, true);
}

/**
 * In order to ensure that our connections are initialized in a lively.vm/lively.ast free environment
 * without Babel support, we need to transpile these source strings in advance.
 * @param { object } snap - The snapshot to convert the connection objects for.
 */
export function transpileAttributeConnections (snap) {
  const transpile = fun.compose((c) => `(${c})`, es5Transpilation, stringifyFunctionWithoutToplevelRecorder);
  Object.values(snap.snapshot).filter(m => Path(['lively.serializer-class-info', 'className']).get(m) === 'AttributeConnection').forEach(m => {
    if (m.props.converterString) {
      return m.props.converterString.value = transpile(m.props.converterString.value);
    }
    if (m.props.updaterString) {
      return m.props.updaterString.value = transpile(m.props.updaterString.value);
    }
  });
}

/**
 * rms 27.9.20
 * Given that Google Closure is at the core of what anything that drives this company's revenue,
 * it is surprising how often it can be crashed by certain kinds of syntax trees.
 * This method checks for known issues with certain modules, and attempts to fix the source accordingly.
 */
export function fixSourceForBugsInGoogleClosure (id, source) {
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

export async function evalOnServer (code) {
  if (isNode) {
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

export async function getConfig () {
  const os = await await evalOnServer('process.platform');
  return {
    os,
    cwd: await evalOnServer('System.baseURL + "lively.freezer/"').then(cwd => cwd.replace('file://', '')),
    tmp: resource(System.decanonicalize('lively.freezer/tmp.js')),
    min: resource(System.decanonicalize('lively.freezer/tmp.min.js')),
    presetPath: await evalOnServer('System.decanonicalize(\'@babel/preset-env\').replace(\'file://\', \'\')'),
    babelPath: await evalOnServer('System.decanonicalize(\'@babel/cli/bin/babel.js\').replace(System.baseURL, \'../\')'),
    babelConfig: System.normalizeSync('lively.freezer/.babelrc'),
    pathToGoogleClosure: System.decanonicalize(`google-closure-compiler-${os === 'darwin' ? 'osx' : 'linux'}/compiler`).replace(System.baseURL, '../')
  };
}

export async function compileOnServer (code, resolver, useTerser) {
  const transpilationSpeed = 100000;
  const compressionSpeed = 150000;
  const { cwd, tmp, min, presetPath, babelPath, babelConfig, pathToGoogleClosure } = await getConfig();
  tmp.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    resolver.setStatus({ progress: p, status: 'Sending code to Google Closure: ' + (100 * p).toFixed() + '%' });
  };
  min.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    resolver.setStatus({ progress: p, status: 'Retrieving compiled code...' + (100 * p).toFixed() + '%' });
  };
  await tmp.write(code); // write the file to the filesystem for working in the shell
  let c; const res = {};
  if (useTerser) {
    // Terser fails to convert class definitions into functions, so we need to
    // preprocess with babel transform
    await babelConfig.writeJson({
      presets: [[presetPath, { modules: false }]]
    });
    c = await resolver.spawn({ command: `${babelPath} -o tmp.es5.js tmp.js`, cwd });
    resolver.setStatus({ status: 'Transpiling source...', progress: 0.01 });
    for (const i of arr.range(0, code.length / transpilationSpeed)) {
      await promise.delay(400);
      if (c.status.startsWith('exited')) break;
      resolver.setStatus({ progress: (i + 1) / (code.length / transpilationSpeed) });
    }
    await promise.waitFor(100 * 1000, () => c.status.startsWith('exited'));
    c = await resolver.spawn({ command: 'terser --compress --mangle --comments false --ecma 5 --output tmp.min.js -- tmp.es5.js', cwd });
  } else {
    c = await resolver.spawn({
      command: `${pathToGoogleClosure} tmp.js > tmp.min.js --warning_level=QUIET`,
      cwd
    });
  }
  resolver.setStatus({ status: 'Compressing source files...', progress: 0.01 });
  for (const i of arr.range(0, code.length / compressionSpeed)) {
    await promise.delay(400);
    if (c.status.startsWith('exited')) break;
    resolver.setStatus({ progress: (i + 1) / (code.length / compressionSpeed) });
  }
  await promise.waitFor(100 * 1000, () => c.status.startsWith('exited'));
  if (c.stderr && c.exitCode !== 0) {
    resolver.finish();
    throw new Error(c.stderr);
  }
  res.code = code;

  res.min = await min.read();
  await Promise.all([tmp, min].map(m => m.remove()));
  return res;
}

/**
 * This converts a json string into a module source code that
 * can be bundled by rollup. The lively.modules system supports
 * importing json files out of the box, rollup needs a little bit
 * more help.
 * @param { string } jsonString - The content of the json file.
 */
export function translateToEsm (jsonString) {
  let source = '';
  if (jsonString.match(/\nexport/)) return jsonString;
  for (const [key, value] of Object.entries(JSON.parse(jsonString))) {
    source += `export var ${key} = ${JSON.stringify(value)};\n`;
  }
  return source;
}

export function instrumentStaticSystemJS (system) {
  const _origGet = system.get ? system.get.bind(system) : () => {};
  system.get = (id, recorder = true) => (lively.FreezerRuntime && lively.FreezerRuntime.get(id, recorder)) || _origGet(id);
  const _origDecanonicalize = system.decanonicalize ? system.decanonicalize.bind(system) : (id) => id;
  system.decanonicalize = (id) =>
    lively.FreezerRuntime ? lively.FreezerRuntime.decanonicalize(id) : _origDecanonicalize(id);
  window._missingExportShim = () => {};
  const _originalRegister = system.register.bind(system);
  system.register = (name, deps, def) => {
    if (typeof name !== 'string') {
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
    });
  };

  if (!system.config) system.config = () => {}; // no need for config anyways...

  if (!system.global) system.global = window;

  // map fs as global
  if (system.set && system.newModule) {
    // handle this via import-map instead
    system.set('stub-transpiler', system.newModule({
      translate: (load) => {
        return load.source;
      }
    }));
  }

  if (!system.newModule) system.newModule = (exports) => exports;
  system.config({
    transpiler: 'stub-transpiler' // this is tp be revised when we migrate the entire system to the new systemjs
  });
  system.get('@lively-env').loadedModules = lively.FreezerRuntime.registry;
  system.baseURL = lively.FreezerRuntime.baseURL;
  system.trace = false;
}

/**
 * Generates the html file that will serve as the index.html for loading the
 * frozen morph. Note that this convenience method only works when we freeze
 * instantiated morphs, it does not yet work when we bundle a library that
 * auto executes.
 * @param { Morph } part - The morph that is supposed to be frozen.
 * @returns { string } The html code of the index.html.
 */
export async function generateLoadHtml (htmlConfig, importMap, resolver, modules) {
  const htmlTemplate = await resource(await resolver.decanonicalizeFileName('lively.freezer/src/util/load-template.html')).read();
  // fixme: what to do when we receive a module?
  const loadCode = `
    window.frozenPart = {
      renderFrozenPart: (domNode, baseURL) => {
        if (baseURL) System.config( { baseURL });
        if (!baseURL) baseURL = './';
        System.config({
          meta: {
           ${
            modules.map(snippet =>
              `[baseURL + '${snippet.fileName}']: {format: "system"}`
            ).join(',\n') // makes sure that compressed modules are still recognized as such
            }
          }
        });
        System.import("./${ROOT_ID}").then(m => { System.trace = false; m.renderFrozenPart(domNode); });
      }
    }
  `;
  let title = htmlConfig.title || 'lively.next app';
  let head = htmlConfig.head || '';
  let load = htmlConfig.load || '';
  let crawler = htmlConfig.crawler || '';
  // extract stuff from the source code
  if (importMap) {
    head += importMap;
  }
  head += '<script>' + loadCode + '</script>';
  return htmlTemplate
    .replace('__TITLE_TAG__', title)
    .replace('__HEAD_HTML__', head)
    .replace('__LOADING_HTML__', load)
    .replace('__CRAWLER_HTML__', crawler);
}

/**
 * Handles the writing of all the files of a finished frozen bundle.
 * @param { object } frozen - A finished build.
 * @param { LoadingIndicator } li - Indicator to visualize the progress of writing the files.
 * @param { object } handles - Resource handles that will be utilized to write to the proper directory.
 * @param { HTTPResource } handles.dir - A http resource handle.
 * @param { ShellResource } handles.shell - A shell resource handle for sending shell commands to the server in order to compress files.
 */
export async function writeFiles (frozen, li, { dir, shell, resolver }) {
  const target = frozen.part || frozen.rootModule;
  let currentFile = '';
  dir.onProgress = (evt) => {
    // set progress of loading indicator
    const p = evt.loaded / evt.total;
    li.progress = p;
    li.status = 'Writing file ' + currentFile + ' ' + (100 * p).toFixed() + '%';
  };

  for (let file of frozen.output) {
    let handle = dir.join(file.fileName);
    if (await handle.exists()) await handle.remove();
    await handle.ensureExistance(file.code || file.source);
  }

  li.remove();
  const { StatusMessageConfirm } = await System.import('lively.halos/components/messages.cp.js');
  $world.setStatusMessage(['Published. Click ', null, 'here', {
    textDecoration: 'underline',
    fontWeight: 'bold',
    doit: { code: `window.open("${dir.join('index.html').url}")` }
  }, ' to view.'], StatusMessageConfirm, false);
}
