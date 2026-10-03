/* global process */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
globalThis.System = require('systemjs');
const [modules, { setupSystem }] = await Promise.all([
  import('lively.modules'),
  import('lively.installer')
]);
globalThis.lively ||= {};

const defaultServerDir = path.dirname(fileURLToPath(import.meta.url));
let livelySystem;

setupSystem(pathToFileURL(`${process.cwd()}${path.sep}`).href)
  .then(system => { livelySystem = system; })
  .then(() => modules.registerPackage(defaultServerDir))

  // This loads the lively system.
  .then(() => livelySystem.import('lively.resources'))
  .then(resources => resources.ensureFetch())
  .then(() => livelySystem.import('lively.storage'))
  .then(() => livelySystem.import('lively.vm'))
  .then(vm => { globalThis.lively.vm = vm; })
  .then(() => livelySystem.import('lively.classes'))
  .then(klass => { globalThis.lively.classes = klass; })
  .then(() => livelySystem.import('lively.modules'))
  .then(loadedModules => {
    loadedModules.changeSystem(livelySystem);
    loadedModules.unwrapModuleResolution();
    loadedModules.wrapModuleResolution();
  })
  .then(() => silenceDuring(
    data => !String(data).includes("DeprecationWarning: 'GLOBAL'"),
    livelySystem.import('lively-system-interface')))
  .then(() => livelySystem.import('lively.2lively'))
  .then(l2l => { globalThis.lively.l2l = l2l; })
  .then(() => console.log('starting headless session'))
  .then(() => livelySystem.import(pathToFileURL(path.join(defaultServerDir, 'server.js')).href))
  .catch(err => {
    console.error(`Error starting server: ${err.stack}`);
    process.exit(1);
  });

async function silenceDuring (filter, promise) {
  const { stdout, stderr } = process;
  const { write: stdoutWrite } = stdout;
  const { write: stderrWrite } = stderr;
  stdout.write = data => filter(data) && stdoutWrite.call(stdout, data);
  stderr.write = data => filter(data) && stderrWrite.call(stderr, data);
  try {
    return await promise;
  } finally {
    stdout.write = stdoutWrite;
    stderr.write = stderrWrite;
  }
}
