/* global System,global,process,Buffer */
import { toJsIdentifier } from 'lively.classes/util.js';
import * as classes from 'lively.classes';
import { resource } from 'lively.resources';
import { runCommand } from 'lively.ide/shell/shell-interface.js';
import { arr, promise } from 'lively.lang';

const isNode = typeof System !== 'undefined'
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

export async function gzip (blob, inflate = true) {
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
        let { gzip } = await System.import('lively.freezer/util.js');
        await gzip(${
           JSON.stringify(blob) // JSON.stringify(inflate ? blob : btoa(blob))
        }, ${inflate});`);
      // if (inflate) {
      //   // if we instructed the server to compress, it sends the response in
      //   // base64, which we have to convert to utf8 such that we can
      //   // write it to a file again.
      //   return atob(res);
      // }
    return res;
  }
  let zlib = await System.import('zlib');
  let gzipFunc = (inflate ? zlib.gzipSync : zlib.gunzipSync);
  blob = inflate ? blob : new Buffer(blob, 'base64');
  let compressed = gzipFunc(blob);
  return compressed.toString('utf8');
  // return compressed.toString(inflate ? 'base64' : 'utf8');
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

export async function getConfig () {
  const os = await await evalOnServer('process.platform');
  return {
    os,
    cwd: await evalOnServer('System.baseURL + "lively.freezer/"').then(cwd => cwd.replace('file://', '')),
    tmp: resource(System.decanonicalize('lively.freezer/tmp.js')),
    min: resource(System.decanonicalize('lively.freezer/tmp.min.js')),
    presetPath: await evalOnServer('System.decanonicalize(\'@babel/preset-env\').replace(\'file://\', \'\')'),
    babelPath: await evalOnServer('System.decanonicalize(\'@babel/cli/bin/babel.js\').replace(System.baseURL, \'../\')'),
    babelConfig: resource(System.baseURL).join('lively.freezer/.babelrc'),
    pathToGoogleClosure: System.decanonicalize(`google-closure-compiler-${os === 'darwin' ? 'osx' : 'linux'}/compiler`).replace(System.baseURL, '../')
  };
}

export async function compileOnServer (code, loadingIndicator, fileName = 'data', useTerser) {
  const transpilationSpeed = 100000;
  const compressionSpeed = 150000;
  const { cwd, tmp, min, presetPath, babelPath, babelConfig, pathToGoogleClosure } = await getConfig();
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
  let c; const res = {};
  if (System.get('@system-env').node) {
    const { default: ServerCommand } = await System.import('lively.shell/server-command.js');
    const cmd = new ServerCommand().spawn({
      command: `${pathToGoogleClosure} tmp.js > tmp.min.js --warning_level=QUIET`,
      cwd
    });
    c = { status: 'started' };
    cmd.on('stdout', stdout => c.status = 'exited');
  } else {
    if (useTerser) {
      // Terser fails to convert class definitions into functions, so we need to
      // preprocess with babel transform
      await babelConfig.writeJson({
        presets: [[presetPath, { modules: false }]]
      });
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
      c = await runCommand(`${pathToGoogleClosure} tmp.js > tmp.min.js --warning_level=QUIET`, { cwd });
    }
  }
  loadingIndicator.status = `Compressing ${fileName}...`;
  loadingIndicator.progress = 0.01;
  for (const i of arr.range(0, code.length / compressionSpeed)) {
    await promise.delay(400);
    if (c.status.startsWith('exited')) break;
    loadingIndicator.progress = (i + 1) / (code.length / compressionSpeed);
  }
  await promise.waitFor(100 * 1000, () => c.status.startsWith('exited'));
  if (c.stderr && c.exitCode !== 0) {
    loadingIndicator && loadingIndicator.remove();
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
