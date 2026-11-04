/* global System, describe, it, afterEach */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { localInterface } from 'lively-system-interface';
import { browse } from '../../js/browser/ui.cp.js';

describe('system browser markdown saving', function () {
  this.timeout(120000);
  let browser, directory, preview;
  afterEach(async () => {
    preview?.getWindow()?.remove();
    preview?.remove();
    browser?.view.getWindow().remove();
    if (directory) {
      await localInterface.removePackage(directory.asFile().url);
      await directory.remove();
    }
  });

  it('saves with a never opened, open, closed or fully detached preview', async () => {
    const name = 'browser-markdown-fixture-' + Date.now();
    directory = resource(System.baseURL).join('.' + name).asDirectory();
    await localInterface.coreInterface.resourceCreateFiles(directory.url, {
      'package.json': JSON.stringify({ name, version: '1.0.0', main: 'index.js' }),
      'index.js': 'export const answer = 42;\n',
      'README.md': '# Original\n'
    });
    await localInterface.registerPackage(directory.asFile().url);
    browser = (await browse({ packageName: name, moduleName: 'README.md' })).viewModel;
    const editor = browser.ui.sourceEditor;
    const save = async label => {
      editor.textString = `# Saved ${label}\n`;
      await browser.save();
      expect(await directory.join('README.md').read(), label).equals(editor.textString);
      expect(browser.hasUnsavedChanges(), label).equals(false);
    };
    expect(editor._mdPreviewMorph).equals(undefined);
    await save('without preview');
    await editor.execCommand('[markdown] convert to html');
    preview = editor._mdPreviewMorph;
    expect(preview.world()).equals(browser.world());
    await save('with open preview');
    preview.getWindow().remove();
    expect(preview.world()).equals(null);
    await save('with closed preview window');
    preview.remove();
    expect(preview.owner).equals(null);
    await save('with detached preview');
    browser.view.getWindow().remove();
    browser = (await browse({ packageName: name, moduleName: 'README.md' })).viewModel;
    expect(browser.ui.sourceEditor.textString).equals('# Saved with detached preview\n');
  });
});
