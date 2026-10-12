/* global System, describe, it, afterEach */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { promise } from 'lively.lang';
import { localInterface, serverInterfaceFor } from 'lively-system-interface';
import { browse } from '../../js/browser/ui.cp.js';
import { BrowserModel } from '../../js/browser/index.js';

describe('system browser client/server switching', function () {
  // Source-world tree refreshes also list files and render the browser columns.
  this.timeout(240000);
  let browser;
  afterEach(() => browser?.view.getWindow().remove());

  it('keeps the environment control disabled until its selection is refreshed', async () => {
    const environment = promise.deferred();
    const control = {
      deactivated: false,
      enable () { this.deactivated = false; },
      disable () { this.deactivated = true; }
    };
    const state = {};
    const context = { ui: { moduleEnvironment: control }, state,
      systemInterface: { moduleEnvironment: () => environment.promise } };
    const update = BrowserModel.prototype.updateModuleEnvironmentControl.call(context, { url: 'file:///test.js' });
    try {
      expect(control.deactivated).equals(true);
    } finally { environment.resolve({ environments: ['server'] }); }
    await update;
    expect(control.selection).equals('server');
    expect(control.deactivated).equals(false);
    state.isChangingModuleEnvironment = true;
    await BrowserModel.prototype.updateModuleEnvironmentControl.call(context, { url: 'file:///test.js' }, { environments: ['client'] });
    expect(control.deactivated).equals(true);
  });

  it('keeps the source package and module context across backend switches', async () => {
    browser = (await browse({ packageName: 'lively.lang', moduleName: 'index.js' })).viewModel;
    const remote = serverInterfaceFor(new URL('eval', System.baseURL).href);
    const source = await resource(new URL('lively.lang/index.js', System.baseURL).href).read();
    const serverPackage = await remote.getPackage('lively.lang');
    const before = await remote.getPackages();
    for (const backend of [remote, 'local']) {
      await browser.setEvalBackend(backend);
      const expectedURL = backend === 'local'
        ? new URL('lively.lang', System.baseURL).href : serverPackage.url;
      expect(browser.selectedPackage.url).equals(expectedURL);
      expect(browser.selectedModule.url).equals(expectedURL + '/index.js');
      expect(browser.ui.sourceEditor.textString).equals(source);
      const packages = browser.ui.columnView.treeData.root.subNodes.filter(p => p.name === 'lively.lang');
      expect(packages.map(p => p.pkg.url)).deep.equals([expectedURL]);
      let result = await browser.editorPlugin.runEval('arr.range(1, 3)');
      expect(result.isError).equals(false, String(result.value));
      expect(result.value).deep.equals([1, 2, 3]);
      await browser.selectModuleNamed('array.js', false);
      result = await browser.editorPlugin.runEval('range(3, 5)');
      expect(result.isError).equals(false, String(result.value));
      expect(result.value).deep.equals([3, 4, 5]);
      await browser.selectModuleNamed('index.js', false);
      expect(browser.ui.sourceEditor.textString).equals(source);
    }
    const after = await remote.getPackages();
    expect(after.filter(p => p.name === 'lively.lang').map(p => p.url))
      .deep.equals(before.filter(p => p.name === 'lively.lang').map(p => p.url));
    const httpCopies = await remote.coreInterface.runEvalAndStringify(`
      Object.keys(System.get('@lively-env').loadedModules)
        .filter(id => id.startsWith(${JSON.stringify(System.baseURL + 'lively.lang/')}))`);
    expect(httpCopies).deep.equals([]);
  });

  it('edits module environments through the control and preserves package metadata', async () => {
    const remote = serverInterfaceFor(new URL('eval', System.baseURL).href);
    const name = 'browser-environment-fixture-' + Date.now();
    const directory = resource(System.baseURL).join('.' + name).asDirectory();
    const remoteDirectory = resource((await remote.getConfig()).baseURL).join('.' + name).asDirectory();
    const manifest = directory.join('package.json');
    const config = {
      name, version: '1.0.0', main: 'nested/shared.js', description: 'Preserve me',
      lively: {
        environments: ['client'], ide: { exclude: ['assets'] },
        meta: { 'nested/*.js': { environments: ['client'] }, 'nested/shared.js': { custom: 'Preserve me too' } }
      }
    };
    const source = 'export const answer = 42;\n';
    await localInterface.coreInterface.resourceCreateFiles(directory.url, {
      'package.json': JSON.stringify(config, null, 2), nested: { 'shared.js': source }
    });
    try {
      await localInterface.registerPackage(directory.asFile().url);
      await remote.registerPackage(remoteDirectory.asFile().url);
      browser = (await browse({ packageName: name, moduleName: 'nested/shared.js' })).viewModel;
      const control = browser.ui.moduleEnvironment;
      expect(control.owner.name, 'environment control belongs beside the module status icons').equals('clipboard controls');
      expect(control.width <= 120 && control.height <= 30, 'environment dropdown is compact').equals(true);
      expect(browser.view.getSubmorphNamed('module environment controls'), 'no extra environment row above the tabs').equals(null);
      expect(control.viewModel.listMorph.items.map(item => item.value)).deep.equals(['client', 'shared', 'server']);
      expect(browser.selectedModule?.url).equals(directory.join('nested/shared.js').url);
      expect(control.selection, 'initial module environment').equals('client');
      expect(await manifest.readJson(), 'synchronizing the dropdown must not edit package.json').deep.equals(config);
      const choose = async mode => {
        control.selection = mode;
        await promise.waitFor(60000, () => !browser.state.isChangingModuleEnvironment && !control.viewModel.deactivated);
        expect(control.selection).equals(mode);
        expect(control.get('label').textString).includes({client: 'Client-only', shared: 'Shared', server: 'Server-only'}[mode]);
        const saved = await manifest.readJson();
        const environments = { client: ['client'], shared: ['client', 'server'], server: ['server'] }[mode];
        expect(saved.lively.meta['nested/shared.js'].environments).deep.equals(environments);
        expect(saved.description).equals(config.description);
        expect(saved.lively.environments).deep.equals(['client']);
        expect(saved.lively.ide).deep.equals(config.lively.ide);
        expect(saved.lively.meta['nested/*.js']).deep.equals(config.lively.meta['nested/*.js']);
        expect(saved.lively.meta['nested/shared.js'].custom).equals('Preserve me too');
        expect((await browser.systemInterface.moduleEnvironment(browser.selectedModule.url)).environments).deep.equals(environments);
      };
      await choose('shared');
      await choose('client');
      await browser.setEvalBackend(remote);
      expect(control.viewModel.deactivated).equals(false);
      expect(control.selection).equals('client');
      expect(browser.ui.sourceEditor.readOnly).equals(true);
      await choose('shared');
      expect(browser.ui.sourceEditor.readOnly).equals(false);
      expect(browser.ui.sourceEditor.textString).equals(source);
      expect((await browser.editorPlugin.runEval('answer + 1')).value).equals(43);
      await choose('server');
      await browser.setEvalBackend('local');
      expect(control.selection).equals('server');
      expect(browser.ui.sourceEditor.readOnly).equals(true);
      await choose('shared');
      expect(browser.ui.sourceEditor.readOnly).equals(false);
      expect(browser.ui.sourceEditor.textString).equals(source);
      expect((await browser.editorPlugin.runEval('answer + 1')).value).equals(43);
      const unsaved = source + '// unsaved changes\n';
      browser.ui.sourceEditor.textString = unsaved;
      const warn = browser.warnForUnsavedChanges;
      browser.warnForUnsavedChanges = async () => false;
      try {
        await choose('client');
        expect(browser.ui.sourceEditor.textString).equals(unsaved);
        expect(browser.hasUnsavedChanges()).equals(true);
        await choose('shared');
        expect(browser.ui.sourceEditor.textString).equals(unsaved);
        expect(await browser.setModuleEnvironment('server')).equals(false);
        expect(browser.ui.sourceEditor.textString).equals(unsaved);
        expect(control.selection).equals('shared');
        expect((await manifest.readJson()).lively.meta['nested/shared.js'].environments).deep.equals(['client', 'server']);
        let confirmations = 0;
        browser.warnForUnsavedChanges = async () => { confirmations++; return true; };
        expect(await browser.setModuleEnvironment('server')).equals(true);
        expect(confirmations).equals(1);
        expect(browser.ui.sourceEditor.readOnly).equals(true);
        expect(await directory.join('nested/shared.js').read()).equals(source);
      } finally { browser.warnForUnsavedChanges = warn; }
      await choose('shared');
      expect(await browser.setModuleEnvironment('__proto__')).equals(false);
      await browser.selectModuleNamed('package.json', false);
      expect(control.viewModel.deactivated).equals(true);
    } finally {
      browser?.view.getWindow().remove();
      browser = null;
      await localInterface.removePackage(directory.asFile().url);
      await remote.removePackage(remoteDirectory.asFile().url);
      await directory.remove();
    }
  });

  it('blocks frontend modules on the server and server modules on the client', async () => {
    browser = (await browse({ packageName: 'lively.morphic', moduleName: 'world.js' })).viewModel;
    const remote = serverInterfaceFor(new URL('eval', System.baseURL).href);
    await browser.setEvalBackend(remote);
    expect(browser.state.moduleEnvironmentError, 'frontend module on server').includes('client only');
    expect(browser.ui.sourceEditor.readOnly).equals(true);
    const source = await remote.moduleRead(browser.selectedModule.url);
    await browser.save();
    expect(await remote.moduleRead(browser.selectedModule.url)).equals(source);
    let result = await browser.editorPlugin.runEval('globalThis.browserEnvironmentExecuted = true');
    expect(result.isError).equals(true);
    expect(String(result.value)).includes('client only');
    result = await remote.runEval('globalThis.browserEnvironmentExecuted', { targetModule: 'lively://browser-test/environment' });
    expect(result.value).equals(undefined);
    await browser.browse({ packageName: 'lively.server', moduleName: 'server.js' });
    expect(browser.state.moduleEnvironmentError).equals(null);
    expect(browser.selectedModule.url.startsWith('file:')).equals(true);
    await browser.setEvalBackend('local');
    expect(browser.state.moduleEnvironmentError, 'server module after returning to client').includes('server only');
    expect(browser.ui.sourceEditor.readOnly).equals(true);
    let error;
    try { await browser.editorPlugin.runEval('1 + 1'); } catch (err) { error = err; }
    expect(String(error)).includes('server only');
  });
});
