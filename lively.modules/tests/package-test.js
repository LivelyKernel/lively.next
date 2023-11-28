/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { modifyJSON, noTrailingSlash } from './helpers.js';

import { arr } from 'lively.lang';
import { resource, createFiles } from 'lively.resources';
import module from '../src/module.js';
import { getSystem, removeSystem } from '../src/system.js';
import { getPackage, ensurePackage, applyConfig, getPackageSpecs } from '../src/packages/package.js';
import { PackageRegistry } from '../src/packages/package-registry.js';

let testDir = System.decanonicalize('lively.modules/tests/package-tests-temp/');
let project1aDir = testDir + 'dep1/';
let project1bDir = testDir + 'dep2/';
let project2Dir = testDir + 'project2/';
let project1a = {
  'entry-a.js': "import { y } from './other.js'; var x = y + 1, version = 'a'; export { x, version };",
  'other.js': 'export var y = 1;',
  'package.json': '{"name": "some-project", "main": "entry-a.js", "version": "1.0.0"}'
};
let project1b = {
  'entry-b.js': "var x = 23, version = 'b'; export { x, version };",
  'package.json': '{"name": "some-project", "main": "entry-b.js", "version": "2.0.0"}'
};
let project2 = {
  'index.js': "export { x, version } from 'some-project';",
  'package.json': JSON.stringify({
    name: 'project2',
    dependencies: { 'some-project': '*' },
    lively: { packageMap: { 'some-project': project1bDir } }
  })
};
let testResources = {
  dep1: project1a,
  dep2: project1b,
  project2: project2
};

describe('package loading', function () {
  let S;

  beforeEach(async () => {
    S = getSystem('test', { baseURL: testDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.babelOptions = System.babelOptions;
    S.translate = async (load) => await System.translate.bind(S)(load);
    await createFiles(testDir, testResources);
  });

  afterEach(() => {
    removeSystem('test');
    return resource(testDir).remove();
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  describe('basics', () => {
    it('registers and loads a package', async () => {
      await ensurePackage(S, project1aDir);
      let mod = await S.import('some-project');
      expect(mod).to.have.property('x', 2);
      let p = getPackageSpecs(S);
      expect(p).to.containSubset([{
        address: noTrailingSlash(project1aDir),
        main: 'entry-a.js',
        meta: { 'package.json': { format: 'json' } },
        map: {}
      }]);
    });

    it('tracks package config', async () => {
      let p = await ensurePackage(S, project1aDir);
      expect(p.config).to.deep.equal({
        name: 'some-project',
        main: 'entry-a.js',
        version: '1.0.0'
      });
      applyConfig(S, { lively: { foo: 'bar' } }, 'some-project');
      expect(p.config).to.deep.equal({
        dependencies: {},
        devDependencies: {},
        lively: { foo: 'bar' },
        main: 'entry-a.js',
        name: 'some-project',
        version: '1.0.0'
      });
    });

    it('registers and loads dependent packages', async () => {
      await Promise.all([
        ensurePackage(S, project1bDir),
        ensurePackage(S, project2Dir)]);
      let mod = await S.import('project2');
      expect(mod).to.have.property('x', 23);
    });

    it('enumerates packages', async () => {
      await ensurePackage(S, project1aDir);
      let p2 = await ensurePackage(S, project2Dir);
      await p2.import();

      expect(getPackageSpecs(S)).to.containSubset([
        {
          address: noTrailingSlash(project1aDir),
          name: 'some-project',
          modules: [
            { deps: [`${project1aDir}other.js`], name: `${project1aDir}entry-a.js` },
            { deps: [], name: `${project1aDir}other.js` },
            { deps: [], name: `${project1aDir}package.json` }]
        },
        {
          address: noTrailingSlash(project2Dir),
          name: 'project2',
          modules: [
            { deps: [`${project1aDir}entry-a.js`], name: `${project2Dir}index.js` },
            { deps: [], name: `${project2Dir}package.json` }]
        }
      ]);
    });

    it('doesnt group modules with package name as belonging to package', async () => {
      await (await ensurePackage(S, project1bDir)).import();
      await (await ensurePackage(S, project2Dir)).import();
      S.set(testDir + 'project2.js', S.newModule({}));
      expect(getPackageSpecs(S).map(ea => Object.assign(ea, { System: null }))).to.containSubset([
        {
          address: noTrailingSlash(project2Dir),
          name: 'project2',
          modules: [
            { deps: [`${project1bDir}entry-b.js`], name: `${project2Dir}index.js` },
            { deps: [], name: `${project2Dir}package.json` }]
        },
        {
          address: noTrailingSlash(project1bDir),
          name: 'some-project'
        }]);
    });
  });

  describe('nested packages', () => {
    beforeEach(async () => {
      await createFiles(project1aDir, {
        'my-projects': {
          'sub-project': {
            'package.json': '{"name": "sub-project", "main": "index.js"}',
            'index.js': 'export var state = 99;'
          }
        }
      });
    });

    it('finds loaded modules of registered package', async () => {
      let p = await ensurePackage(S, project1aDir);
      await ensurePackage(S, project2Dir);

      expect(arr.pluck(p.modules(), 'id')).equals([project1aDir + 'package.json'], 'register');
      await p.import();

      expect(arr.pluck(p.modules(), 'id'))
        .equals(['package.json', 'entry-a.js', 'other.js'].map(ea => project1aDir + ea), 'import');

      let innerDir = project1aDir + 'my-projects/sub-project/';
      let p2 = await ensurePackage(S, innerDir);
      await p2.import();
      await p2.tryToLoadPackageConfig();

      expect(arr.pluck(p2.modules(), 'id'))
        .equals(['package.json', 'index.js'].map(ea => innerDir + ea), 'import inner');

      expect(arr.pluck(p.modules(), 'id'))
        .equals(['package.json', 'entry-a.js', 'other.js'].map(ea => project1aDir + ea), 'after sub-project loaded');
    });

    it('finds resources of registered package', async () => {
      let innerDir = project1aDir + 'my-projects/sub-project/';
      await ensurePackage(S, innerDir);
      let p = await ensurePackage(S, project1aDir);
      expect(arr.pluck(await p.resources(), 'url'))
        .equals(['entry-a.js', 'other.js', 'package.json'].map(ea => project1aDir + ea));
    });
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  describe('with pre-loaded dependent packages', function () {
    it('uses existing dependency by default', async () => {
      await ensurePackage(S, project1aDir);
      await ensurePackage(S, project2Dir);
      let m = await S.import('project2');
      expect(m.version).to.equal('a');
    });

    it('uses specified dependency when mapped', async () => {
      await ensurePackage(S, project1bDir);
      await ensurePackage(S, project1aDir);
      await modifyJSON(project2Dir + 'package.json', { systemjs: { map: { 'some-project': project1bDir } } });
      await ensurePackage(S, project2Dir);
      let m = await S.import('project2');
      expect(m.version).to.equal('b');
      expect(S.packages).to.containSubset({
        [noTrailingSlash(project1bDir)]: { main: 'entry-b.js', map: {} },
        [noTrailingSlash(project2Dir)]: { map: { 'some-project': project1bDir } }
      });
    });

    it('uses specified dependency when mapped relative', async () => {
      await ensurePackage(S, project1bDir);
      await ensurePackage(S, project1aDir);
      await modifyJSON(project2Dir + 'package.json', { systemjs: { map: { 'some-project': '../dep2/' } } });
      await ensurePackage(S, project2Dir);
      let m = await S.import('project2');
      expect(m.version).to.equal('b');
      expect(S.packages).to.containSubset({
        [noTrailingSlash(project1bDir)]: { main: 'entry-b.js', map: {} },
        [noTrailingSlash(project2Dir)]: { map: { 'some-project': '../dep2/' } }
      });
    });

    it('Concurrent loading will not load multiple versions', async () => {
      let project2bDir = testDir + 'project2b/';
      let project2b = {
        'index.js': "export { x, version } from 'some-project';",
        'package.json': JSON.stringify({
          name: 'project2',
          dependencies: { 'some-project': '*' },
          lively: { packageMap: { 'some-project': project1aDir } }
        })
      };
      let project5Dir = testDir + 'project5/';
      let project5 = {
        'index.js': "export { version } from 'project2';",
        'package.json': JSON.stringify({
          name: 'project5',
          dependencies: { project2: '*' },
          lively: { packageMap: { project2: project2bDir } }
        })
      };
      await ensurePackage(S, project2bDir);
      await ensurePackage(S, project1aDir);
      await createFiles(project2bDir, project2b);
      await createFiles(project5Dir, project5);
      await Promise.all([
        ensurePackage(S, project2Dir).then(p => p.import()),
        ensurePackage(S, project5Dir).then(p => p.import())
      ]);
      let packageCounts = arr.groupByKey(getPackageSpecs(S), 'name').count();
      Object.keys(packageCounts).forEach(name =>
        expect(packageCounts[name]).equals(1, `package ${name} loaded multiple times`));
    });
  });

  describe('removal', () => {
    it('of package in devPackageDirs', async () => {
      let registry = PackageRegistry.ofSystem(S);
      let pkg = await ensurePackage(S, project1aDir);
      expect(registry.lookup(pkg.name, pkg.version)).equals(pkg);
      expect(registry.devPackageDirs).containSubset([{ url: project1aDir }]);
      pkg.remove();

      expect(() => getPackage(S, project1aDir)).throws(/not found/);
      expect(registry.lookup(pkg.name, pkg.version)).equals(null);
      expect(registry.packageMap).to.not.have.keys(pkg.name);
      expect(registry.devPackageDirs).equals([]);
      expect(registry.individualPackageDirs).equals([]);
    });
  });

  describe('reload', () => {
    it('of package in devPackageDirs', async () => {
      let registry = PackageRegistry.ofSystem(S);
      let pkg = await ensurePackage(S, project1aDir);
      expect(registry.lookup(pkg.name, pkg.version)).equals(pkg);
      expect(registry.devPackageDirs).containSubset([{ url: project1aDir }]);
      await pkg.reload();
      expect(registry.lookup(pkg.name, pkg.version)).equals(pkg);
      expect(registry.devPackageDirs).containSubset([{ url: project1aDir }]);
    });
  });

  describe('package copying and renaming', () => {
    it('changeAddress renames resources and affects runtime', async () => {
      await ensurePackage(S, project1aDir);
      await S.import('some-project');
      let p = getPackage(S, 'some-project');
      let newURL = testDir + 'some-project-renamed';
      let newP = await p.changeAddress(newURL, null/* name */, true/* delete old */);

      expect(newP).equals(getPackage(S, newURL), 'getPackage not working with renamed package');
      expect(newP.name).equals('some-project');
      expect(await resource(project1aDir).exists()).equals(false, 'original project dir still exists');
      expect(await resource(newURL).exists()).equals(true, 'new project dir does not exist');
      expect(await resource(newURL + '/other.js').exists()).equals(true, 'other.js does not exist');
      expect(await resource(newURL + '/entry-a.js').exists()).equals(true, 'entry-a.js does not exist');
      expect(await resource(newURL + '/package.json').exists()).equals(true, 'package.json does not exist');

      expect(S.get(newURL + '/entry-a.js')).deep.equals({ version: 'a', x: 2 });
      expect(S.get(newURL + '/package.json')).containSubset({ main: 'entry-a.js', name: 'some-project' });
    });

    it('renameTo changes package name and address', async () => {
      await ensurePackage(S, project1aDir);
      await S.import('some-project');
      let p = getPackage(S, 'some-project');
      let newURL = testDir + 'some-project-renamed';
      let newP = await p.rename('some-project-renamed');

      expect(newP).equals(getPackage(S, newURL), 'getPAckage not working with renamed package');
      expect(newP.name).equals('some-project-renamed');
      expect(await resource(project1aDir).exists()).equals(false, 'original project dir still exists');
      expect(await resource(newURL).exists()).equals(true, 'new project dir does not exist');
      expect(await resource(newURL + '/package.json').readJson()).containSubset({ main: 'entry-a.js', name: 'some-project-renamed' });
      expect(S.get(newURL + '/package.json')).containSubset({ main: 'entry-a.js', name: 'some-project-renamed' });
    });

    it('fork creates a new similar package with a changed name', async () => {
      await ensurePackage(S, project1aDir);
      await S.import('some-project');
      let p = getPackage(S, 'some-project');
      let newURL = testDir + 'some-project-copied';
      let newP = await p.fork('some-project-copied');

      expect(newP).equals(getPackage(S, newURL), 'getPAckage not working with renamed package');
      expect(newP.name).equals('some-project-copied');
      expect(await resource(project1aDir).exists()).equals(true, 'original project does not exist anymore');
      expect(await resource(newURL).exists()).equals(true, 'new project dir does not exist');
      expect(await resource(newURL + '/other.js').exists()).equals(true, 'other.js does not exist');
      expect(await resource(newURL + '/entry-a.js').exists()).equals(true, 'entry-a.js does not exist');
      expect(await resource(newURL + '/package.json').exists()).equals(true, 'package.json does not exist');
      expect(JSON.parse(await resource(newURL + '/package.json').read())).containSubset({ main: 'entry-a.js', name: 'some-project-copied' });

      expect(S.get(newURL + '/entry-a.js')).deep.equals({ version: 'a', x: 2 });
      expect(S.get(newURL + '/package.json')).containSubset({ main: 'entry-a.js', name: 'some-project-copied' });
    });
  });
});

describe('package configuration test', () => {
  let S;

  beforeEach(async () => {
    S = getSystem('test', { baseURL: testDir });
    await createFiles(testDir, testResources);
  });

  afterEach(() => {
    removeSystem('test');
    return resource(testDir).remove();
  });

  it('installs hooks', async () => {
    await ensurePackage(S, project1aDir);
    await applyConfig(S, {
      ...await resource(project1aDir).join('package.json').readJson(),
      lively: {
        hooks: [
          {
            target: 'normalize',
            source: '(proceed, name, parent, parentAddress) => ' +
                    'proceed(name + \'x.js\', parent, parentAddress)'
          }
        ]
      }
    }, 'some-project');
    S.defaultJSExtensions = true;
    expect(await S.normalize('foo')).to.match(/foox.js$/);
  });

  it('installs meta data in package', async () => {
    await ensurePackage(S, project1aDir);
    await applyConfig(S, {
      ...await resource(project1aDir).join('package.json').readJson(),
      lively: { meta: { foo: { format: 'global' } } }
    }, 'some-project');
    let pURL = S.decanonicalize('some-project/').replace(/\/$/, '');
    expect(S.getConfig().packages[pURL].meta).containSubset({ foo: { format: 'global' } });
  });

  it('installs absolute addressed meta data in System.meta', async () => {
    await ensurePackage(S, project1aDir);
    let testName = testDir + 'foo';
    await applyConfig(S, {
      ...await resource(project1aDir).join('package.json').readJson(),
      lively: { meta: { [testName]: { format: 'global' } } }
    }, 'some-project');
    expect(S.getConfig().packages).to.not.have.property('some-project');
    expect(S.getConfig().meta).property(testName).deep.equals({ format: 'global' });
  });

  it('can resolve .. in url', async () => {
    expect(S.decanonicalize('..', testDir + 'foo/bar.js')).to.equal(testDir + 'index.js');
    let result = await S.normalize('../index.js', testDir + 'foo/bar.js');
    expect(result).to.equal(testDir + 'index.js');
  });
});

describe('mutual dependent packages', () => {
  let p1Dir = testDir + 'p1/';
  let p2Dir = testDir + 'p2/';
  let p1 = {
    'index.js': "export var x = 3; import { y } from 'p2';",
    'package.json': '{"name": "p1", "lively": {"packageMap": {"p2": "../p2"}}}'
  };
  let p2 = {
    'index.js': "export var y = 2; import { x } from 'p1';",
    'package.json': '{"name": "p2", "lively": {"packageMap": {"p1": "../p1"}}}'
  };
  let testResources = { p1, p2 };

  let S;

  beforeEach(async () => {
    S = getSystem('test', { baseURL: testDir });
    await createFiles(testDir, testResources);
  });

  afterEach(async () => {
    removeSystem('test');
    await resource(testDir).remove();
  });

  it('can be imported', async () => {
    let p = await ensurePackage(S, p1Dir);
    await ensurePackage(S, p2Dir);
    await p.import();
    expect(module(S, `${p1Dir}index.js`).env().recorder).property('y').equals(2);
    expect(module(S, `${p2Dir}index.js`).recorder).property('x').equals(3);
  });
});

let registry;
describe('package registry', () => {
  let S;

  beforeEach(async () => {
    await createFiles(testDir, {
      packages: {
        p1: {
          '0.2.2': {
            'index.js': "export var x = 3 + y; import { y } from 'p2';",
            'package.json': '{"name": "p1", "version": "0.2.2", "dependencies": {"p2": "^1.0"}}'
          },
          '0.1.0': {
            'index.js': "export var x = 2 + y; import { y } from 'p2';",
            'package.json': '{"name": "p1", "version": "0.1.0"}'
          }
        },
        p2: {
          '2.0.0': {
            'index.js': 'export var y = 24;',
            'package.json': '{"name": "p2", "version": "2.0.0"}'
          },
          '1.0.0': {
            'index.js': 'export var y = 23;',
            'package.json': '{"name": "p2", "version": "1.0.0"}'
          }
        }
      }
    });
    S = getSystem('test', { baseURL: testDir });
    registry = PackageRegistry.ofSystem(S);
    registry.packageBaseDirs = [resource(testDir).join('packages/')];
    await registry.update();
  });

  afterEach(() => {
    removeSystem('test');
    return resource(testDir).remove();
  });

  describe('lookup', () => {
    it('from packageBaseDirs', async () => {
      expect(registry.lookup('p1')).containSubset({
        url: testDir + 'packages/p1/0.2.2',
        name: 'p1',
        version: '0.2.2'
      });
      expect(registry.lookup('p1', '^0.2')).containSubset({
        url: testDir + 'packages/p1/0.2.2',
        name: 'p1',
        version: '0.2.2'
      });
      expect(registry.lookup('p1', '^0.1')).containSubset({
        url: testDir + 'packages/p1/0.1.0',
        name: 'p1',
        version: '0.1.0'
      });
      expect(registry.lookup('p1', 'latest')).containSubset({
        url: testDir + 'packages/p1/0.2.2',
        name: 'p1',
        version: '0.2.2'
      });
    });

    it('find dependency of package', async () => {
      expect(registry.findPackageDependency(registry.lookup('p1', '0.1.0'), 'p2'))
        .property('nameAndVersion', 'p2@2.0.0');
      expect(registry.findPackageDependency(registry.lookup('p1', '0.2.2'), 'p2'))
        .property('nameAndVersion', 'p2@1.0.0');
    });

    it('resolve path', async () => {
      expect(registry.resolvePath('p1/index.js')).equals(testDir + 'packages/p1/0.2.2/index.js');
      expect(registry.resolvePath('p1@0.1.0/index.js')).equals(testDir + 'packages/p1/0.1.0/index.js');
      expect(registry.resolvePath('foo/index.js')).equals(null);

      expect(registry.resolvePath('./bar.js', testDir + 'packages/p1/0.2.2/index.js')).equals(testDir + 'packages/p1/0.2.2/bar.js');
      expect(registry.resolvePath('../bar.js', testDir + 'packages/p1/0.2.2/index.js')).equals(testDir + 'packages/p1/bar.js');

      expect(registry.resolvePath('p2/index.js', testDir + 'packages/p1/0.2.2/index.js')).equals(testDir + 'packages/p2/1.0.0/index.js');
      expect(registry.resolvePath('p2', testDir + 'packages/p1/0.2.2/index.js')).equals(testDir + 'packages/p2/1.0.0');
    });
  });

  describe('adding packages', () => {
    it('individually', async () => {
      await createFiles(testDir, {
        additionalPackages: {
          p3: {
            'index.js': 'export var z = 99;',
            'package.json': '{"name": "p3", "version": "2.0.0"}'
          },
          p1: {
            'index.js': "export var x = 4 + y; import { y } from 'p2';",
            'package.json': '{"name": "p1", "version": "0.3.0", "dependencies": {"p2": "^1.0"}}'
          }
        }
      });
      await registry.addPackageAt(testDir + 'additionalPackages/p3', 'individualPackageDirs');
      expect(registry.lookup('p3')).property('url', testDir + 'additionalPackages/p3');
      await registry.addPackageAt(testDir + 'additionalPackages/p1', 'devPackageDirs');
      expect(registry.lookup('p1')).property('url', testDir + 'additionalPackages/p1');
    });
  });

  describe('update', () => {
    it('of package in packageBaseDirs', async () => {
      let dir = resource(testDir + 'packages/p1/0.2.2/');
      let pkg = registry.findPackageWithURL(dir.url);
      pkg.updateConfig({ name: 'p1', version: '0.3.0', dependencies: { p2: '^1.0' } });
      // await dir.join("package.json").writeJson({"name": "p1", "version": "0.3.0", "dependencies": {"p2": "^1.0"}});
      // await registry.updatePackageFromPackageJson(pkg);
      expect(registry.packageMap).containSubset({
        p1: {
          latest: '0.3.0',
          versions: {
            '0.1.0': {
              url: testDir + 'packages/p1/0.1.0',
              version: '0.1.0'
            },
            '0.3.0': {
              url: testDir + 'packages/p1/0.2.2',
              version: '0.3.0'
            }
          }
        }
      });
      expect(registry.packageMap.p1.versions).to.have.keys('0.1.0', '0.3.0');
    });
  });

  describe('removal', () => {
    it('of package with individualPackageDir', async () => {
      await createFiles(testDir, {
        additionalPackages: {
          p3: {
            'index.js': 'export var z = 99;',
            'package.json': '{"name": "p3", "version": "2.0.0"}'
          }
        }
      });

      let p3 = await ensurePackage(registry.System, testDir + 'additionalPackages/p3');
      await registry.removePackage(p3);
      expect(registry.packageMap).to.not.have.key('p3');
      expect(registry.devPackageDirs).equals([]);
      expect(registry.individualPackageDirs).equals([]);
    });
  });

  describe('reload', () => {
    it('of package in packageCollectionDir', async () => {
      let p = registry.lookup('p1', '0.2.2');
      expect(registry.coversDirectory(p.url)).equals('packageCollectionDirs');
      await p.reload();

      expect(registry.coversDirectory(p.url)).equals('packageCollectionDirs');
      expect(registry.devPackageDirs).length(0);
      expect(registry.lookup('p1', '0.2.2')).equals(p);
    });
  });
});
