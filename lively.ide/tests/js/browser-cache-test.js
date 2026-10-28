/* global System, $world, describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { createFiles, resource } from 'lively.resources';
import { Morph, part } from 'lively.morphic';
import { emit } from 'lively.notifications';
import { MullerColumnView } from 'lively.components/muller-columns.cp.js';
import { BrowserModel, PackageTreeData } from '../../js/browser/index.js';

describe('system browser directory cache', function () {
  this.timeout(30000);
  const baseURL = 'local://browser-directory-cache/';
  const packageURL = baseURL + 'pkg/';
  let browser, columnView, data, counts, observer;

  /** Select a path through the real Muller column expansion flow. */
  async function expand (url) {
    await columnView.setExpandedPath(node => node === data.root || (node.url && url.startsWith(node.url)), data.root, false);
  }

  beforeEach(async () => {
    await createFiles(baseURL, { pkg: {
      'package.json': '{"name":"cache-test"}',
      src: { 'a.js': 'export const first = 1;', 'b.js': 'export const second = 2;' },
      empty: {},
      '.hidden': { 'secret.js': '' }
    } });
    counts = { packages: 0, directories: {}, resources: 0, sources: 0 };
    const pkg = { name: 'cache-test', url: packageURL.slice(0, -1), address: packageURL.slice(0, -1), modules: [] };
    const coreInterface = {
      async resourceDirList (url) {
        counts.directories[url] = (counts.directories[url] || 0) + 1;
        return resource(url).dirList();
      },
      resourceExists: async () => false,
      resourceMkdir: url => resource(url).mkdir(),
      resourceEnsureExistance: (url, content) => resource(url).ensureExistance(content),
      resourceRemove: url => resource(url).remove(),
      getPackage: async () => pkg
    };
    const systemInterface = {
      coreInterface,
      getPackages: async () => { counts.packages++; return [pkg]; },
      getConfig: async () => ({ baseURL }),
      getPackage: async () => pkg,
      resourcesOfPackage: async () => { counts.resources++; return []; },
      moduleRead: async url => { counts.sources++; return resource(url).read(); }
    };
    columnView = part(MullerColumnView);
    browser = { ui: { columnView }, systemInterface, selectedPackage: pkg,
      isModule: BrowserModel.prototype.isModule,
      updateModuleList: (...args) => BrowserModel.prototype.updateModuleList.apply(browser, args),
      refreshTree: () => BrowserModel.prototype.refreshTree.call(browser),
      onPackageChanged: () => BrowserModel.prototype.onPackageChanged.call(browser) };
    data = new PackageTreeData({ browser });
    await columnView.setTreeData(data);
  });

  afterEach(async () => {
    observer?.remove();
    observer = null;
    columnView?.remove();
    await resource(baseURL).remove();
  });

  it('reuses package nodes and module inventories while revalidating directory listings', async () => {
    await expand(packageURL + 'src/a.js');
    const packageNode = data.root.subNodes[0];
    const directory = packageNode.subNodes.find(node => node.name === 'src');
    await expand(packageURL + 'src/b.js');
    await expand(packageURL + 'src/a.js');
    expect(counts.packages).equals(1);
    expect(counts.directories).deep.equals({ [packageURL]: 3, [packageURL + 'src/']: 3 });
    expect(counts.resources).equals(1);
    expect(data.root.subNodes[0]).equals(packageNode);
    expect(packageNode.subNodes.find(node => node.name === 'src')).equals(directory);
  });

  it('shares pending directory reads and revalidates empty directories on reopening', async () => {
    await expand(packageURL);
    const directory = data.root.subNodes[0].subNodes.find(node => node.name === 'empty');
    await Promise.all([data.collapse(directory, false), data.collapse(directory, false)]);
    await data.collapse(directory, true);
    await data.collapse(directory, false);
    expect(directory.subNodes).deep.equals([]);
    expect(counts.directories[directory.url]).equals(2);
  });

  it('retries a failed listing instead of retaining a rejected read', async () => {
    await expand(packageURL);
    const directory = data.root.subNodes[0].subNodes.find(node => node.name === 'src');
    const read = browser.systemInterface.coreInterface.resourceDirList;
    browser.systemInterface.coreInterface.resourceDirList = async () => { throw new Error('temporary listing failure'); };
    let error;
    try { await data.collapse(directory, false); } catch (err) { error = err; }
    expect(error.message).equals('temporary listing failure');
    browser.systemInterface.coreInterface.resourceDirList = read;
    await data.collapse(directory, false);
    expect(directory.subNodes.map(node => node.name)).deep.equals(['a.js', 'b.js']);
  });

  it('discards an in-flight listing invalidated by a file creation', async () => {
    await expand(packageURL);
    const directory = data.root.subNodes[0].subNodes.find(node => node.name === 'src');
    const oldFiles = await resource(directory.url).dirList();
    const firstRead = promise.deferred();
    const read = browser.systemInterface.coreInterface.resourceDirList;
    let reads = 0;
    browser.systemInterface.coreInterface.resourceDirList = url => ++reads === 1 ? firstRead.promise : read(url);
    const pending = data.collapse(directory, false);
    await promise.waitFor(1000, () => reads === 1);
    await resource(directory.url + 'created.js').write('export const created = 3;');
    data.invalidate(directory);
    firstRead.resolve(oldFiles);
    await pending;
    expect(directory.subNodes.map(node => node.name)).includes('created.js');
    expect(reads).equals(2);
  });

  it('refreshes external changes explicitly while preserving the selected path', async () => {
    const selected = packageURL + 'src/a.js';
    await expand(selected);
    await resource(packageURL + 'src/created.js').write('');
    await BrowserModel.prototype.refreshTree.call(browser);
    expect(columnView.getExpandedPath().find(node => node.url === selected)).not.equals(undefined);
    const directory = columnView.getExpandedPath().find(node => node.type === 'directory');
    expect(directory.subNodes.map(node => node.name)).includes('created.js');
    expect(counts.directories[directory.url]).equals(2);
  });

  it('invalidates cached parent listings when creating files and folders', async () => {
    await expand(packageURL + 'src/');
    const directory = columnView.getExpandedPath().find(node => node.type === 'directory');
    const names = ['created', 'new-folder'];
    browser.world = () => ({ prompt: async () => names.shift() });
    const selected = [];
    columnView.selectNode = async node => selected.push(node);
    await BrowserModel.prototype.interactivelyAddNewModule.call(browser, directory.url, 'js');
    expect(directory.subNodes.map(node => node.name)).includes('created.js');
    await BrowserModel.prototype.interactivelyCreateNewFolder.call(browser, directory.url);
    expect(directory.subNodes.map(node => node.name)).includes('new-folder');
    expect(selected.map(node => node.name)).deep.equals(['created.js', 'new-folder']);
    expect(counts.directories[directory.url]).equals(3);
  });

  it('invalidates cached parent listings when removing a directory', async () => {
    await expand(packageURL + 'empty/');
    browser.world = () => ({ confirm: async () => true });
    await BrowserModel.prototype.interactivelyRemoveSelectedItem.call(browser, packageURL);
    expect(data.root.subNodes[0].subNodes.map(node => node.name)).not.includes('empty');
    expect(counts.directories[packageURL]).equals(2);
  });

  it('invalidates package membership after module rename and package changes', async () => {
    await expand(packageURL + 'src/a.js');
    observer = new Morph();
    let invalidations = 0;
    observer.onModuleUnloaded = evt => { invalidations++; BrowserModel.prototype.onModuleUnloaded.call(browser, evt); };
    observer.onPackageChanged = evt => { invalidations++; BrowserModel.prototype.onPackageChanged.call(browser, evt); };
    $world.addMorph(observer);
    await resource(packageURL + 'src/a.js').copyTo(resource(packageURL + 'src/renamed.js'));
    await resource(packageURL + 'src/a.js').remove();
    emit('lively.modules/moduleunloaded', { module: packageURL + 'src/a.js' }, Date.now(), System);
    await expand(packageURL + 'src/renamed.js');
    const directory = columnView.getExpandedPath().find(node => node.type === 'directory');
    expect(directory.subNodes.map(node => node.name)).deep.equals(['b.js', 'renamed.js']);
    for (const type of ['packageregistered', 'packageremoved']) {
      emit('lively.modules/' + type, { package: packageURL }, Date.now(), System);
      await expand(packageURL);
    }
    expect(invalidations).equals(3);
    expect(counts.packages).equals(4);
  });

  it('keeps source outlines fresh without invalidating directory listings', async () => {
    const url = packageURL + 'src/a.js';
    await expand(url);
    await resource(url).write('export const changed = 3;');
    await expand(packageURL + 'src/b.js');
    await expand(url);
    const module = columnView.getExpandedPath().find(node => node.url === url);
    expect(module.subNodes.map(node => node.name)).deep.equals(['changed']);
    expect(counts.directories[packageURL + 'src/']).equals(3);
  });
});
