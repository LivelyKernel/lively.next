/* global System, it, describe, beforeEach, afterEach */
import { promise } from 'lively.lang';
import { Text } from 'lively.morphic';
import { pt } from 'lively.graphics';
import { CompletionController, WordCompleter } from '../text/completion.js';
import { DynamicJavaScriptCompleter } from '../js/completers.js';
import { expect } from 'mocha-es6';
import { joinPath } from 'lively.lang/string.js';

let text;

describe('completion controller', () => {
  beforeEach(() =>
    text = new Text({ textString: 'abc\nafg\n', readOnly: false })
  );

  it('computes word completions', async () => {
    text.cursorPosition = { row: 2, column: 0 };
    let controller = new CompletionController(text, [new WordCompleter()]);
    let { items } = await controller.completionListSpec();
    expect(items).containSubset([{ value: { completion: 'afg' } }, { value: { completion: 'abc' } }]);
  });

  ('computes dynamic JS completions', async () => {
    if (!System.get(System.decanonicalize('lively.vm/index.js'))) return;
    if (!System.get(System.decanonicalize('lively-system-interface'))) return;
    let { default: JavaScriptEditorPlugin } = await System.import('lively.ide/js/editor-plugin.js');
    text.plugins = [new JavaScriptEditorPlugin()];
    text.textString = 'this.';
    text.gotoDocumentEnd();
    let controller = new CompletionController(text, [new DynamicJavaScriptCompleter()]);
    let { items } = await controller.completionListSpec();
    expect(items).containSubset([{ value: { completion: 'textString' } }]);
  });
});

describe('completion widget', () => {
  beforeEach(() => {
    text = new Text({ readOnly: false, textString: 'abc\nafg\n', extent: pt(400, 300), editorModeName: joinPath(System.baseURL, 'lively.ide/editor-plugin.js') }).openInWorld();
  });

  afterEach(async () => {
    await promise.delay(30);
    let complMenu = text.world().get('text completion menu');
    complMenu && complMenu.remove();
    text.remove();
  });

  it('opens', async () => {
    await text.whenRendered();
    text.cursorPosition = text.documentEndPosition;

    await text.execCommand('text completion');
    let menu = await promise.waitFor(1000, () => text.world().get('text completion menu'));
    expect(menu.get('list').items.map(({ value: { completion } }) => completion).slice(0, 2)).deep.equals(['afg', 'abc']);
  });

  it('is correct aligned', async () => {
    await text.whenRendered();
    text.cursorDown(2);
    text.insertText('a');
    await text.execCommand('text completion');
    await promise.delay(0);
    let menu = text.world().get('text completion menu');
    expect(menu.get('input').textString).equals('a', "input line content doesn't show prefix");
    let pos = text.charBoundsFromTextPosition(text.cursorPosition).topLeft();
    pos = text.worldPoint(pos);
    expect(menu.position.x).closeTo(pos.x, 50, 'menu position x');
    expect(menu.position.y).closeTo(pos.y, 50, 'menu position y');
  });
});
