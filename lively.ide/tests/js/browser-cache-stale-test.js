/* global System, describe, it, afterEach */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { localInterface } from 'lively-system-interface';
import { browse } from '../../js/browser/ui.cp.js';

describe('system browser directory revalidation', function () {
  this.timeout(120000);
  let a, b, directory;
  afterEach(async () => {
    await Promise.all([a?.whenModuleUpdated(), b?.whenModuleUpdated()]);
    a?.view.getWindow()?.remove(); b?.view.getWindow()?.remove();
    if (directory) { await localInterface.removePackage(directory.asFile().url); await directory.remove(); }
    a = b = directory = null;
  });

  /** Open two real browsers on a temporary registered package. */
  async function setup () {
    const name = 'review-cache-stale-' + Date.now();
    directory = resource(System.baseURL).join('.' + name).asDirectory();
    await localInterface.coreInterface.resourceCreateFiles(directory.url, {
      'package.json': JSON.stringify({ name, version: '1.0.0', main: 'index.js' }),
      'index.js': 'export const answer = 42;\n'
    });
    await localInterface.registerPackage(directory.asFile().url);
    a = (await browse({ packageName: name, moduleName: 'index.js' })).viewModel;
    b = (await browse({ packageName: name, moduleName: 'index.js' })).viewModel;
    expect(a).not.equals(b);
    return name;
  }
  /** Reopen the package through the column view's actual tree. */
  async function namesSeenBy (browser) {
    const cv = browser.ui.columnView;
    const pkgNode = cv.getExpandedPath().find(n => n.type === 'package');
    await cv.treeData.collapse(pkgNode, false);
    return pkgNode.subNodes.map(n => n.name);
  }

  it('a module created in another browser window shows up when re-expanding the package', async () => {
    await setup();
    const pkgNode = a.ui.columnView.getExpandedPath().find(n => n.type === 'package');
    a.world = () => ({ prompt: async () => 'created' });
    await a.interactivelyAddNewModule(pkgNode.url, 'js');
    await a.whenModuleUpdated();
    expect(await namesSeenBy(a), 'creating window').includes('created.js');
    expect(await namesSeenBy(b), 'other window').includes('created.js');
  });

  it('a file written externally (DAV/other client) shows up when re-expanding the package', async () => {
    await setup();
    await resource(directory.url + 'external.js').write('export const x = 1;\n');
    expect(await namesSeenBy(b), 'other window').includes('external.js');
  });
});
