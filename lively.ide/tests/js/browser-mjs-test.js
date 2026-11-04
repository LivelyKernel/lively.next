/* global System, describe, it, afterEach */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { localInterface, serverInterfaceFor } from 'lively-system-interface';
import { browse } from '../../js/browser/ui.cp.js';

describe('system browser mjs modules', function () {
  this.timeout(180000);
  let browser, directory, remoteDirectory, remote;
  afterEach(async () => {
    browser?.view.getWindow().remove();
    if (directory) {
      await localInterface.removePackage(directory.asFile().url);
      if (remoteDirectory) await remote.removePackage(remoteDirectory.asFile().url);
      await directory.remove();
    }
    browser = directory = remoteDirectory = remote = null;
  });

  for (const backend of ['client', 'server']) {
    it(`loads, evaluates, outlines and saves an mjs module on the ${backend}`, async () => {
      const name = 'browser-mjs-fixture-' + backend + '-' + Date.now();
      directory = resource(System.baseURL).join('.' + name).asDirectory();
      const imports = backend === 'server' ? "import path from 'node:path';\n" : '';
      const body = backend === 'server' ? "return path.join('hello', name);" : "return 'hello ' + name;";
      const source = `${imports}export const answer = 42;\nexport function greet(name) { ${body} }\n`;
      await localInterface.coreInterface.resourceCreateFiles(directory.url, {
        'package.json': JSON.stringify({ name, version: '1.0.0', main: 'index.mjs', lively: { environments: [backend] } }),
        'index.mjs': source
      });
      await localInterface.registerPackage(directory.asFile().url);
      let systemInterface = localInterface;
      if (backend === 'server') {
        remote = serverInterfaceFor(new URL('eval', System.baseURL).href);
        remoteDirectory = resource((await remote.getConfig()).baseURL).join('.' + name).asDirectory();
        await remote.registerPackage(remoteDirectory.asFile().url);
        systemInterface = remote;
      }
      browser = (await browse({ packageName: name, moduleName: 'index.mjs', systemInterface })).viewModel;
      expect(browser.selectedModule.nameInPackage).equals('index.mjs');
      expect(browser.editorPlugin.isJSEditorPlugin).equals(true);
      expect(browser.ui.sourceEditor.textString).equals(source);
      expect(browser.ui.sourceEditor.readOnly).equals(false);
      let result = await browser.editorPlugin.runEval('answer');
      expect(result.isError).equals(false, String(result.value));
      expect(result.value).equals(42);
      const tree = browser.ui.columnView.treeData;
      expect(tree.isLeaf(browser.selectedModule)).equals(false);
      const definitions = tree.getChildren(browser.selectedModule);
      expect(definitions.map(def => def.name)).includes('greet');
      const greet = definitions.find(def => def.name === 'greet');
      browser.ui.sourceEditor.cursorPosition = { row: 0, column: 0 };
      await browser.onCodeEntitySelected(greet);
      expect(browser.ui.sourceEditor.cursorPosition.row).equals(backend === 'server' ? 2 : 1);
      browser.ui.sourceEditor.textString = source.replace('42', '43');
      await browser.save();
      result = await browser.editorPlugin.runEval('answer');
      expect(result.isError).equals(false, String(result.value));
      expect(result.value).equals(43);
      expect(await directory.join('index.mjs').read()).includes('answer = 43');
      expect(browser.hasUnsavedChanges()).equals(false);
      browser.view.getWindow().remove();
      browser = (await browse({ packageName: name, moduleName: 'index.mjs', systemInterface })).viewModel;
      expect(browser.ui.sourceEditor.textString).includes('answer = 43');
      expect((await browser.editorPlugin.runEval('answer')).value).equals(43);
      if (backend === 'server') {
        await browser.setEvalBackend('local');
        expect(browser.state.moduleEnvironmentError).includes('server only');
        expect(browser.ui.sourceEditor.readOnly).equals(true);
      }
    });
  }
});
