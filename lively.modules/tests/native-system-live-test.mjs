import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = process.cwd();
const require = createRequire(new URL('../../lively.installer/install.js', import.meta.url));
globalThis.System = require('systemjs');
const { setupSystem } = await import('../../lively.installer/install.js');
const modules = await import('lively.modules');
const originalLog = console.log;
console.log('native SystemJS: discovering installed packages');
console.log = () => {};
const system = await setupSystem(pathToFileURL(`${root}/`).href);
console.log = originalLog;

console.log('native SystemJS: importing instrumented loader');
const instrumentedModules = await system.import('lively.modules');
console.log('native SystemJS: checking registry and mappings');
const chaiEntry = system.nativeResolve('chai', pathToFileURL(join(root, 'mocha-es6/index.js')).href);
const chaiIndex = system.nativeResolve('./index.js', chaiEntry);
assert.equal(await system.normalize('./index.js', chaiEntry), chaiIndex);
assert.equal(system.decanonicalize('./index.js', chaiEntry), chaiIndex);
instrumentedModules.changeSystem(system, true);
instrumentedModules.unwrapModuleResolution(system);
instrumentedModules.wrapModuleResolution(system);
const registry = system.get('@lively-env').packageRegistry;
const serialized = registry.toJSON();
assert.equal(serialized.schema, 2);
assert.ok(Object.values(serialized.packageMap).some(entry => Object.keys(entry.instances || {}).length > Object.keys(entry.versions).length));
const roundTripped = new instrumentedModules.PackageRegistry(system).fromJSON(serialized);
assert.equal(roundTripped.allPackages().length, registry.allPackages().length);
const duplicated = Object.values(roundTripped.packageMap).find(entry =>
  Object.values(entry.versions).some(pkg => Object.values(entry.instances)
    .filter(instance => instance.version === pkg.version).length > 1));
const [duplicateVersion, primary] = Object.entries(duplicated.versions).find(([, pkg]) =>
  Object.values(duplicated.instances).filter(instance => instance.version === pkg.version).length > 1);
roundTripped.removePackage(primary);
const replacement = Object.values(duplicated.instances).find(instance => instance.version === duplicateVersion);
assert.equal(duplicated.versions[duplicateVersion], replacement);

const relocatedJSON = {
  schema: 2,
  packageMap: {
    demo: {
      latest: '1.0.0',
      versions: { '1.0.0': { url: 'relocated/demo', _name: 'demo', version: '1.0.0' } },
      instances: { 'file:///stale/absolute/location': { url: 'relocated/demo', _name: 'demo', version: '1.0.0' } }
    }
  },
  individualPackageDirs: [], devPackageDirs: [], packageBaseDirs: [], nodeModulesDirs: []
};
const relocated = new instrumentedModules.PackageRegistry(system).fromJSON(relocatedJSON);
const relocatedEntry = relocated.packageMap.demo;
const relocatedPkg = relocatedEntry.versions['1.0.0'];
assert.ok(Object.values(relocatedEntry.instances).includes(relocatedPkg));
assert.equal(Object.hasOwn(relocatedEntry.instances, 'file:///stale/absolute/location'), false);
const merged = new instrumentedModules.PackageRegistry(system).fromJSON(relocatedJSON);
merged.updateFromJSON(relocatedJSON);
assert.ok(Object.values(merged.packageMap.demo.instances).includes(merged.packageMap.demo.versions['1.0.0']));
const mergedPackage = merged.packageMap.demo.versions['1.0.0'];
const changedLocationJSON = structuredClone(relocatedJSON);
changedLocationJSON.packageMap.demo.versions['1.0.0'].dependencies = { replacement: '^2.0.0' };
changedLocationJSON.packageMap.demo.versions['1.0.0'].systemjs = { importMap: { imports: { replacement: './replacement.js' } } };
changedLocationJSON.packageMap.demo.instances = {};
merged.updateFromJSON(changedLocationJSON);
assert.equal(merged.packageMap.demo.versions['1.0.0'], mergedPackage);
assert.deepEqual(mergedPackage.dependencies, { replacement: '^2.0.0' });
assert.deepEqual(mergedPackage.systemjs.importMap.imports, { replacement: './replacement.js' });
relocatedPkg.name = 'demo-renamed';
relocatedPkg.version = '2.0.0';
relocated.updateNameAndVersionOf(relocatedPkg, 'demo', '1.0.0', 'demo-renamed', '2.0.0');
assert.equal(relocated.packageMap.demo, undefined);
assert.equal(relocated.packageMap['demo-renamed'].versions['2.0.0'], relocatedPkg);
assert.ok(Object.values(relocated.packageMap['demo-renamed'].instances).includes(relocatedPkg));

const transportedMapJSON = {
  schema: 2,
  packageMap: {
    'lively.ide': {
      latest: '1.0.0',
      versions: {
        '1.0.0': {
          url: 'lively.ide', _name: 'lively.ide', version: '1.0.0',
          systemjs: { importMap: { imports: {}, _mapUrl: 'lively.ide/.cachedImportMap.json' } }
        }
      },
      instances: {}
    }
  },
  individualPackageDirs: [], devPackageDirs: [], packageBaseDirs: [], nodeModulesDirs: []
};
const transported = new instrumentedModules.PackageRegistry(system).fromJSON(transportedMapJSON);
assert.equal(
  transported.packageMap['lively.ide'].versions['1.0.0'].systemjs.importMap._mapUrl,
  new URL('lively.ide/.cachedImportMap.json', system.baseURL).href);
assert.equal(
  transported.toJSON().packageMap['lively.ide'].versions['1.0.0'].systemjs.importMap._mapUrl,
  'lively.ide/.cachedImportMap.json');

const browserParent = 'http://localhost:9021/mocha-es6/index.js';
const browserTarget = 'http://localhost:9021/node_modules/.bun/mocha@10.8.2/node_modules/mocha/index.js';
const oldBrowserEnv = system.get('@system-env');
const oldMochaMapping = system.map.mocha;
const oldFindPackageHavingURL = registry.findPackageHavingURL;
registry.findPackageHavingURL = url => url === browserParent
  ? {
      url: 'http://localhost:9021/mocha-es6/',
      map: { retained: 'http://localhost:9021/package-map/index.js' }, config: {},
      systemjs: { importMap: { imports: { mocha: browserTarget, retained: 'http://localhost:9021/import-map/index.js' }, _mapUrl: 'http://localhost:9021/mocha-es6/.cachedImportMap.json' } }
    }
  : oldFindPackageHavingURL.call(registry, url);
system.config({ map: { mocha: 'http://localhost:9021/node_modules/.bun/mocha@2.5.3/node_modules/mocha/index.js', retained: 'http://localhost:9021/generated-map/index.js' } });
try {
  system.set('@system-env', system.newModule({ ...oldBrowserEnv, browser: true, node: false }));
  assert.match(system.decanonicalize('mocha', browserParent), /node_modules\/.bun\/mocha@10\.8\.2\//);
  assert.match(system.decanonicalize('retained', browserParent), /package-map\//);
} finally {
  registry.findPackageHavingURL = oldFindPackageHavingURL;
  if (oldMochaMapping !== undefined) system.config({ map: { mocha: oldMochaMapping } });
  system.set('@system-env', oldBrowserEnv);
}

console.log('native SystemJS: checking native exports and live edits');
const tempDir = await mkdtemp(join(root, 'lively.modules/tests/.native-system-'));
try {
  const conditionalDir = join(tempDir, 'node_modules', 'conditional');
  const cjsImporter = pathToFileURL(join(tempDir, 'consumer.cjs')).href;
  await mkdir(conditionalDir, { recursive: true });
  await writeFile(join(conditionalDir, 'package.json'), JSON.stringify({
    name: 'conditional', exports: { import: './import.mjs', require: './require.cjs' }
  }));
  await writeFile(join(conditionalDir, 'import.mjs'), 'export default "import";\n');
  await writeFile(join(conditionalDir, 'require.cjs'), 'module.exports = "require";\n');
  await writeFile(new URL(cjsImporter), '');
  assert.match(system.normalizeSync('conditional', `${cjsImporter}!cjs`), /require\.cjs$/);
  assert.match(await system.normalize('conditional', `${cjsImporter}!cjs`), /require\.cjs$/);

  const esmDir = join(tempDir, 'node_modules', 'async-esm');
  await mkdir(esmDir, { recursive: true });
  await writeFile(join(esmDir, 'package.json'), JSON.stringify({ name: 'async-esm', type: 'module', exports: './index.js' }));
  await writeFile(join(esmDir, 'index.js'), 'await Promise.resolve(); export default function () { return 42; } export const named = 23;\n');
  const esm = await system.import(system.nativeResolve('async-esm', cjsImporter));
  assert.equal(esm.default(), 42);
  assert.equal(esm.named, 23);
  const remoteESM = await runInNewContext('System.nativeImport(url)', { System: system, url: system.nativeResolve('async-esm', cjsImporter) });
  assert.equal(remoteESM.default(), 42);
  const syncESMDir = join(tempDir, 'node_modules', 'sync-esm');
  await mkdir(syncESMDir, { recursive: true });
  await writeFile(join(syncESMDir, 'package.json'), JSON.stringify({ name: 'sync-esm', type: 'module', exports: './index.js' }));
  await writeFile(join(syncESMDir, 'index.js'), 'export default function () { return 17; } export const named = 19;\n');
  const syncESM = await system.import(system.nativeResolve('sync-esm', cjsImporter));
  assert.equal(syncESM.default(), 17);
  assert.equal(syncESM.named, 19);

  const customMainDir = join(tempDir, 'custom-main');
  await mkdir(customMainDir);
  await writeFile(join(customMainDir, 'package.json'), JSON.stringify({ name: 'custom-main', main: 'entry.js' }));
  await writeFile(join(customMainDir, 'entry.js'), 'export const value = 3;\n');
  const customMainURL = pathToFileURL(customMainDir).href;
  await instrumentedModules.registerPackage(customMainURL);
  assert.equal(system.decanonicalize(customMainURL + '/'), customMainURL + '/');
  assert.equal(instrumentedModules.getPackage(customMainURL + '/').url, customMainURL);
  system.config({ map: { 'explicit-test-override': customMainURL + '/entry.js' } });
  assert.equal(await system.normalize('explicit-test-override', cjsImporter), customMainURL + '/entry.js');
  system.config({ map: { 'explicit-relative-override': './' + (customMainURL + '/entry.js').slice(system.baseURL.length) } });
  assert.equal(await system.normalize('explicit-relative-override', cjsImporter), customMainURL + '/entry.js');

  console.log('native SystemJS: checking client/server module boundaries');
  const environmentDir = join(tempDir, 'environments');
  await mkdir(environmentDir);
  await writeFile(join(environmentDir, 'package.json'), JSON.stringify({
    name: 'environment-fixture', main: 'client.js',
    lively: {
      environments: ['client'],
      meta: {
        'shared*.js': { environments: ['client', 'server'] },
        'shared-client.js': { environments: ['client'] },
        'server.js': { environments: ['server'] }
      }
    }
  }));
  const clientSource = 'globalThis.environmentFixtureExecuted = true; export const client = true;\n';
  await writeFile(join(environmentDir, 'client.js'), clientSource);
  await writeFile(join(environmentDir, 'shared.js'), 'export const answer = 42;\n');
  await writeFile(join(environmentDir, 'shared-client.js'), clientSource);
  await writeFile(join(environmentDir, 'server.js'), 'export const server = true;\n');
  await writeFile(join(environmentDir, 'consumer.js'), "import './client.js'; export const value = 1;\n");
  const environmentURL = pathToFileURL(environmentDir).href;
  await instrumentedModules.registerPackage(environmentURL);
  const clientModule = instrumentedModules.module(environmentURL + '/client.js');
  assert.deepEqual(clientModule.environment().environments, ['client']);
  assert.equal(clientModule.environment().supported, false);
  assert.equal(await clientModule.source(), clientSource);
  await assert.rejects(system.import(clientModule.id), /client only.*server environment/);
  assert.equal(system.global.environmentFixtureExecuted, undefined);
  await assert.rejects(system.import(environmentURL + '/shared-client.js'), /client only/);
  const sharedModule = instrumentedModules.module(environmentURL + '/shared.js');
  assert.equal((await sharedModule.load()).answer, 42);
  const systemVM = await system.import('lively.vm');
  assert.equal((await systemVM.runEval('answer + 1', { targetModule: sharedModule.id })).value, 43);
  assert.throws(() => systemVM.runEval('1 + 1', { targetModule: clientModule.id }), /client only/);
  assert.throws(() => clientModule.changeSource('export const client = false;'), /client only/);
  assert.equal(await system.resource(clientModule.id).read(), clientSource);
  const packageConfig = instrumentedModules.getPackage(environmentURL).runtimeConfig;
  packageConfig.lively.meta['consumer.js'] = { environments: ['client', 'server'] };
  instrumentedModules.applyPackageConfig(packageConfig, environmentURL);
  await assert.rejects(system.import(environmentURL + '/consumer.js'), /client only/);
  const serverModule = instrumentedModules.module(environmentURL + '/server.js');
  assert.equal((await serverModule.load()).server, true);
  const serverEnv = system.get('@system-env');
  try {
    system.set('@system-env', system.newModule({ ...serverEnv, node: false, browser: true, nw: true }));
    assert.equal(clientModule.environment().current, 'client');
    assert.equal(clientModule.environment().supported, true);
    await assert.rejects(serverModule.load(), /server only.*client environment/);
    await assert.rejects(system.import(serverModule.id), /server only.*client environment/);
    assert.throws(() => systemVM.runEval('1', { targetModule: serverModule.id }), /server only/);
  } finally {
    system.set('@system-env', serverEnv);
    delete system.global.environmentFixtureExecuted;
  }
  const systemInterface = (await system.import('lively-system-interface')).localInterface;
  assert.equal(systemInterface.getPackage('lively.lang').version, '1.0.25');
  assert.equal(systemInterface.getPackage('lively.lang').url, new URL('lively.lang', system.baseURL).href);
  assert.equal(systemInterface.moduleEnvironment(clientModule.id).supported, false);
  assert.equal(await systemInterface.doesModuleExist(clientModule.id, true), true);
  assert.equal(await systemInterface.doesModuleExist(environmentURL + '/missing.js', true), false);

  console.log('native SystemJS: updating environment declarations without merging old access');
  const manifestURL = environmentURL + '/package.json';
  const savedConfig = JSON.parse(await system.resource(manifestURL).read());
  savedConfig.lively.meta['shared.js'] = { environments: ['client', 'server'], custom: 'preserved' };
  await systemInterface.packageConfChange(JSON.stringify(savedConfig), manifestURL);
  assert.deepEqual(sharedModule.environment().environments, ['client', 'server']);
  savedConfig.lively.meta['shared.js'].environments = ['client'];
  await systemInterface.packageConfChange(JSON.stringify(savedConfig), manifestURL);
  assert.deepEqual(sharedModule.environment().environments, ['client']);
  assert.equal(sharedModule.environment().supported, false);
  await assert.rejects(sharedModule.load(), /client only/);
  assert.throws(() => systemVM.runEval('answer', { targetModule: sharedModule.id }), /client only/);
  assert.equal(JSON.parse(await system.resource(manifestURL).read()).lively.meta['shared.js'].custom, 'preserved');
  savedConfig.lively.meta['shared.js'].environments = ['server'];
  savedConfig.lively.environments = ['client', 'server'];
  await system.resource(manifestURL).write(JSON.stringify(savedConfig));
  const manifestSource = await system.resource(manifestURL).read();
  await systemInterface.packageConfChange(manifestSource, manifestURL, { doSave: false });
  assert.deepEqual(sharedModule.environment().environments, ['server']);
  assert.equal(sharedModule.environment().supported, true);
  assert.deepEqual(clientModule.environment().environments, ['client', 'server']);
  assert.equal(await system.resource(manifestURL).read(), manifestSource);
  savedConfig.lively.environments = ['client'];
  await systemInterface.packageConfChange(JSON.stringify(savedConfig), manifestURL);
  assert.deepEqual(clientModule.environment().environments, ['client']);

  console.log('native SystemJS: checking cloned loader');
  const clone = instrumentedModules.getSystem('native-cloned-loader', { baseURL: pathToFileURL(tempDir).href + '/' });
  clone.set(system.transpiler, system.get(system.transpiler));
  clone.config({ transpiler: system.transpiler });
  clone.translate = system.translate.bind(clone);
  const clonedModuleURL = pathToFileURL(join(tempDir, 'cloned-live.js')).href;
  await writeFile(new URL(clonedModuleURL), 'export default class Live { answer() { return 1; } }\n');
  const clonedModule = instrumentedModules.scripting.module(clone, clonedModuleURL);
  await clonedModule.load();
  await clonedModule.changeSource('export default class Live { answer() { return 2; } }\n', { doSave: false });
  assert.equal(new (clone.get(clonedModuleURL).default)().answer(), 2);
  instrumentedModules.removeSystem('native-cloned-loader');

  console.log('native SystemJS: checking relocated packages and linked live edits');
  const sourcePackageDir = join(tempDir, 'desktop-source', 'desktop-linked-pkg');
  const runtimeRoot = join(tempDir, 'desktop-runtime');
  const runtimePackageDir = join(runtimeRoot, 'node_modules', 'desktop-linked-pkg');
  const runtimeImporter = pathToFileURL(join(runtimeRoot, 'lively.server', 'index.js')).href;
  await mkdir(join(runtimeRoot, 'lively.server'), { recursive: true });
  await mkdir(sourcePackageDir, { recursive: true });
  await writeFile(join(sourcePackageDir, 'package.json'), JSON.stringify({ name: 'desktop-linked-pkg', version: '1.0.0' }));
  await writeFile(join(sourcePackageDir, 'index.js'), 'export const source = "desktop";\n');
  await writeFile(new URL(runtimeImporter), '');
  await mkdir(join(runtimeRoot, 'node_modules'), { recursive: true });
  await symlink(sourcePackageDir, runtimePackageDir, 'dir');
  const runtimePackageURL = pathToFileURL(runtimePackageDir).href;
  const desktopSeed = {
    schema: 2,
    packageMap: {
      'desktop-linked-pkg': {
        latest: '1.0.0',
        versions: { '1.0.0': { url: runtimePackageURL, _name: 'desktop-linked-pkg', version: '1.0.0' } },
        instances: { [runtimePackageURL]: { url: runtimePackageURL, _name: 'desktop-linked-pkg', version: '1.0.0' } }
      }
    },
    individualPackageDirs: [], devPackageDirs: [], packageBaseDirs: [], nodeModulesDirs: []
  };
  const desktopRegistry = new instrumentedModules.PackageRegistry(system).fromJSON(desktopSeed);
  const canonicalDesktopModule = system.normalizeSync('desktop-linked-pkg', runtimeImporter);
  assert.equal(canonicalDesktopModule, pathToFileURL(join(sourcePackageDir, 'index.js')).href);
  assert.equal(desktopRegistry.findPackageHavingURL(canonicalDesktopModule).url, runtimePackageURL);

  console.log('native SystemJS: scanning dependencies through a desktop runtime mount');
  const scanSystem = instrumentedModules.getSystem('desktop-registry-scan', { baseURL: pathToFileURL(runtimeRoot).href + '/' });
  scanSystem.set(system.transpiler, system.get(system.transpiler));
  scanSystem.config({ transpiler: system.transpiler });
  scanSystem.translate = system.translate.bind(scanSystem);
  const scannedRegistry = new instrumentedModules.PackageRegistry(scanSystem);
  scannedRegistry.nodeModulesDirs = [scanSystem.resource(scanSystem.baseURL).join('node_modules/')];
  await scannedRegistry.update();
  const scannedPackage = scannedRegistry.lookup('desktop-linked-pkg');
  assert.equal(scannedPackage.url, runtimePackageURL);
  assert.equal(scannedRegistry.findPackageHavingURL(canonicalDesktopModule), scannedPackage);
  const browserSystem = instrumentedModules.getSystem('desktop-registry-browser', { baseURL: 'http://localhost:9021/' });
  const browserRegistry = new instrumentedModules.PackageRegistry(browserSystem).fromJSON(scannedRegistry.toJSON());
  assert.equal(browserRegistry.lookup('desktop-linked-pkg').url, 'http://localhost:9021/node_modules/desktop-linked-pkg');
  // Desktop keeps mutable package directories writable, linking their files
  // individually. Dependencies still point at the packaged source directory.
  const overlaySource = join(tempDir, 'desktop-source', 'desktop-overlay-pkg');
  const overlayRuntime = join(runtimeRoot, 'desktop-overlay-pkg');
  await mkdir(overlaySource);
  await mkdir(overlayRuntime);
  await writeFile(join(overlaySource, 'package.json'), JSON.stringify({
    name: 'desktop-overlay-pkg', version: '1.0.0',
    lively: { environments: ['client'], meta: { 'index.js': { environments: ['client', 'server'] } } }
  }));
  await writeFile(join(overlaySource, 'index.js'), 'export const source = "overlay";\n');
  for (const file of ['package.json', 'index.js']) await symlink(join(overlaySource, file), join(overlayRuntime, file), 'file');
  await mkdir(join(sourcePackageDir, 'node_modules'));
  await symlink(overlaySource, join(sourcePackageDir, 'node_modules', 'desktop-overlay-pkg'), 'dir');
  scannedRegistry.devPackageDirs = [scanSystem.resource(pathToFileURL(overlayRuntime).href)];
  await scannedRegistry.update();
  const overlayPackage = scannedRegistry.lookup('desktop-overlay-pkg');
  assert.equal(overlayPackage.url, pathToFileURL(overlayRuntime).href);
  assert.equal(Object.keys(scannedRegistry.packageMap['desktop-overlay-pkg'].instances).length, 1);
  assert.equal(scannedRegistry.findPackageHavingURL(pathToFileURL(join(overlaySource, 'index.js')).href), overlayPackage);
  scanSystem['__lively.modules__packageRegistry'] = scannedRegistry;
  scanSystem.nativeResolve = system.nativeResolve;
  const overlayModule = instrumentedModules.scripting.module(scanSystem, pathToFileURL(join(overlaySource, 'index.js')).href);
  assert.equal(overlayModule.environment().supported, true);
  assert.deepEqual(overlayModule.environment().environments, ['client', 'server']);
  assert.equal(instrumentedModules.scripting.module(scanSystem, pathToFileURL(join(overlaySource, 'client.js')).href).environment().supported, false);
  browserRegistry.fromJSON(scannedRegistry.toJSON());
  assert.equal(browserRegistry.lookup('desktop-overlay-pkg').url, 'http://localhost:9021/desktop-overlay-pkg');
  assert.equal(browserSystem.decanonicalize('desktop-overlay-pkg'), 'http://localhost:9021/desktop-overlay-pkg/index.js');
  instrumentedModules.removeSystem('desktop-registry-browser');
  instrumentedModules.removeSystem('desktop-registry-scan');

  const packageDir = join(tempDir, 'package');
  const linkedPackageDir = join(tempDir, 'package-link');
  const moduleURL = pathToFileURL(join(packageDir, 'live.js')).href;
  const entryURL = pathToFileURL(join(packageDir, 'entry.js')).href;
  const linkedEntryURL = pathToFileURL(join(linkedPackageDir, 'entry.js')).href;
  await mkdir(packageDir);
  await writeFile(new URL(moduleURL), 'export var value = 1;\n');
  await writeFile(new URL(entryURL), "export { value } from './live.js';\n");
  await symlink(packageDir, linkedPackageDir, 'dir');

  const canonicalLiveURL = await system.normalize('./live.js', entryURL);
  const linkedLiveURL = await system.normalize('./live.js', linkedEntryURL);
  assert.equal(canonicalLiveURL, moduleURL);
  assert.equal(linkedLiveURL, moduleURL);
  const before = await system.import(canonicalLiveURL);
  const viaLink = await system.import(linkedLiveURL);
  assert.equal(before, viaLink);
  const liveModule = instrumentedModules.module(canonicalLiveURL);
  assert.equal(liveModule, instrumentedModules.module(linkedLiveURL));
  await system.import(entryURL);
  await system.import(linkedEntryURL);
  await liveModule.changeSource('export var value = 2;\n', { doEval: true });
  const after = await system.import(canonicalLiveURL);
  assert.equal(after.value, 2);
  assert.equal((await system.import(entryURL)).value, 2);
  assert.equal((await system.import(linkedEntryURL)).value, 2);
  console.log('native SystemJS live fixture passed');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
