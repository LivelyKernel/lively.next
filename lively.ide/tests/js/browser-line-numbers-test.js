/* global describe, it, afterEach */
import { expect } from 'mocha-es6';
import { browse } from '../../js/browser/ui.cp.js';

describe('system browser line numbers', function () {
  this.timeout(120000);
  let browser;
  afterEach(() => browser?.view.getWindow().remove());

  it('enables the gutter by default and keeps its menu choice when switching modules', async () => {
    browser = (await browse({ packageName: 'lively.lang', moduleName: 'array.js' })).viewModel;
    const editor = browser.ui.sourceEditor;
    editor.env.forceUpdate();
    expect(editor.showLineNumbers).equals(true);
    const node = editor.env.renderer.getNodeForMorph(editor);
    expect(!!node.querySelector('.newtext-line-number-layer')).equals(true);
    const menuItem = browser.menuItems().find(item => Array.isArray(item[0]) &&
      item[0].some(value => typeof value === 'string' && value.includes('Display Line Numbers')));
    expect(!!menuItem).equals(true);
    menuItem[1]();
    await browser.selectModuleNamed('index.js', false);
    editor.env.forceUpdate();
    expect(editor.showLineNumbers).equals(false);
    expect(node.querySelector('.newtext-line-number-layer')).equals(null);
    editor.execCommand('toggle line numbers');
    editor.env.forceUpdate();
    expect(!!node.querySelector('.newtext-line-number-layer')).equals(true);
  });
});
