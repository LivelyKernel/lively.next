/* global System, describe, it, afterEach */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { browse } from '../../js/browser/ui.cp.js';

describe('system browser tabs', function () {
  this.timeout(120000);
  let browser;
  afterEach(() => browser?.view.getWindow().remove());

  function selectTab (tab) {
    const finished = promise.deferred();
    const change = browser.browsedTabChanged;
    browser.browsedTabChanged = async function (tabs) {
      try { await change.call(this, tabs); finished.resolve(); }
      catch (err) { finished.reject(err); }
      finally { this.browsedTabChanged = change; }
    };
    tab.selected = true;
    return finished.promise;
  }

  it('keeps existing tabs, selection and edits when a tab switch is cancelled', async () => {
    browser = (await browse({ packageName: 'lively.lang', moduleName: 'index.js' })).viewModel;
    const tabs = browser.ui.tabs;
    const first = tabs.selectedTab;
    const second = tabs.addTab('Second', {
      config: { packageName: 'lively.lang', moduleName: 'array.js' },
      history: { left: [], right: [], navigationInProgress: null }
    }, false);
    const history = browser.state.history;
    const source = browser.ui.sourceEditor.textString + '\n// unsaved changes\n';
    browser.ui.sourceEditor.textString = source;
    let confirmations = 0;
    browser.warnForUnsavedChanges = async () => { confirmations++; return false; };
    for (let attempt = 1; attempt <= 2; attempt++) {
      await selectTab(second);
      expect(confirmations).equals(attempt);
      expect(tabs.tabs).deep.equals([first, second]);
      expect(tabs.selectedTab).equals(first);
      expect(second.selected).equals(false);
      expect(browser.ui.sourceEditor.textString).equals(source);
      expect(browser.state.history).equals(history);
      expect(browser.selectedModule.nameInPackage).equals('index.js');
    }
    browser.warnForUnsavedChanges = async () => true;
    await selectTab(second);
    expect(tabs.selectedTab).equals(second);
    expect(browser.selectedModule.nameInPackage).equals('array.js');
  });

  it('removes only an empty provisional tab when its creation is cancelled', async () => {
    browser = (await browse({ packageName: 'lively.lang', moduleName: 'index.js' })).viewModel;
    const tabs = browser.ui.tabs;
    const first = tabs.selectedTab;
    browser.ui.sourceEditor.textString += '\n// unsaved changes\n';
    browser.warnForUnsavedChanges = async () => false;
    const provisional = tabs.addTab('New Browser Tab', undefined, false);
    await selectTab(provisional);
    expect(tabs.tabs).deep.equals([first]);
    expect(tabs.selectedTab).equals(first);
    expect(first.closeable).equals(false);
    expect(browser.hasUnsavedChanges()).equals(true);
  });

  it('restores CSS file selection and source after a tab round trip', async () => {
    browser = (await browse({ packageName: 'lively.ide', moduleName: 'md/github-markdown.css' })).viewModel;
    const tabs = browser.ui.tabs;
    const cssTab = tabs.selectedTab;
    const source = browser.ui.sourceEditor.textString;
    expect(browser.browseSnippetForSelection()).includes('moduleName: "md/github-markdown.css"');
    const javascriptTab = tabs.addTab('JavaScript', {
      config: { packageName: 'lively.ide', moduleName: 'js/browser/tree.js' },
      history: { left: [], right: [], navigationInProgress: null }
    }, false);
    await selectTab(javascriptTab);
    expect(browser.selectedModule.nameInPackage).equals('js/browser/tree.js');
    await selectTab(cssTab);
    expect(browser.selectedPackage.name).equals('lively.ide');
    expect(browser.selectedModule.nameInPackage).equals('md/github-markdown.css');
    expect(browser.ui.sourceEditor.textString).equals(source);
    expect(browser.editorPlugin.isCSSEditorPlugin).equals(true);
  });

  it('does not re-list unchanged directories when switching between loaded modules', async () => {
    browser = (await browse({ packageName: 'lively.lang', moduleName: 'index.js' })).viewModel;
    const tabs = browser.ui.tabs;
    const first = tabs.selectedTab;
    const second = tabs.addTab('Array', {
      config: { packageName: 'lively.lang', moduleName: 'array.js' },
      history: { left: [], right: [], navigationInProgress: null }
    }, false);
    const system = browser.systemInterface;
    const core = system.coreInterface;
    const list = core.resourceDirList;
    const resources = system.resourcesOfPackage;
    let listings = 0, packageResources = 0;
    core.resourceDirList = function (...args) { listings++; return list.apply(this, args); };
    system.resourcesOfPackage = function (...args) { packageResources++; return resources.apply(this, args); };
    try {
      await selectTab(second);
      await selectTab(first);
      await selectTab(second);
      expect(browser.selectedModule.nameInPackage).equals('array.js');
      expect(listings).equals(0);
      expect(packageResources).equals(0);
    } finally {
      core.resourceDirList = list;
      system.resourcesOfPackage = resources;
    }
  });
});
