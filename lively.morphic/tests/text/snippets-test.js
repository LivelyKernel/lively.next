/* global System, it, describe, xdescribe, beforeEach */
import { Text } from '../../text/morph.js';
import { Snippet } from 'lively.ide/text/snippets.js';
import { expect, chai } from 'mocha-es6';

import { expectSelection } from '../test-helpers.js';

const describeInBrowser = System.get('@system-env').browser
  ? describe
  : (title, fn) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xdescribe(title, fn); };

expectSelection(chai);

let text;
describeInBrowser('text plugins', () => {
  beforeEach(() => text = new Text({ textString: 'Hello\n World', readOnly: false, cursorPosition: { row: 0, column: 0 } }));

  it('simple expansion', () => {
    new Snippet({ expansion: 'foo' }).expandAtCursor(text);
    expect(text.textString).equals('fooHello\n World');
  });

  it('triggered expansion', () => {
    text.textString = 'foobaz';

    text.cursorPosition = { row: 0, column: 6 };
    let triggered = new Snippet({ trigger: 'foo', expansion: 'bar' }).tryTrigger(text);
    expect(triggered).equals(false, 'triggered, no trigger matching');
    expect(text.textString).equals('foobaz');

    text.cursorPosition = { row: 0, column: 3 };
    triggered = new Snippet({ trigger: 'foo', expansion: 'bar' }).tryTrigger(text);
    expect(triggered).equals(true, 'not triggered');
    expect(text.textString).equals('barbaz');
    expect(text.selection).selectionEquals('Selection(0/3 -> 0/3)');
  });

  it('triggered expansion with end position', () => {
    text.textString = 'foobaz';

    text.cursorPosition = { row: 0, column: 3 };
    const snip = new Snippet({ trigger: 'foo', expansion: '$0bar' });
    const triggered = snip.tryTrigger(text);

    expect(triggered).equals(true, 'not triggered');
    expect(text.textString).equals('barbaz');
    expect(text.selection).selectionEquals('Selection(0/0 -> 0/0)');
    expect(snip.isExpanding).equals(false, 'isExpanding');
  });

  it('expansion with prefilled steps', () => {
    text.textString = 'foobaz';

    text.cursorPosition = { row: 0, column: 3 };
    const snip = new Snippet({ trigger: 'foo', expansion: 'bar${0:oi}zork${1:ui}' });
    snip.tryTrigger(text);

    expect(text.textString).equals('baroizorkuibaz');
    expect(text.selection).selectionEquals('Selection(0/3 -> 0/5)');
    expect(snip.isExpanding).equals(true, 'isExpanding');
    text.selection.text = 'xxx';

    snip.nextStep();
    expect(text.textString).equals('barxxxzorkuibaz');
    expect(text.selection).selectionEquals('Selection(0/10 -> 0/12)');
    expect(snip.isExpanding).equals(false, 'isExpanding');
  });

  it('triggered expansion with multiple steps', () => {
    text.textString = 'foobaz';

    text.cursorPosition = { row: 0, column: 3 };
    const snip = new Snippet({ trigger: 'foo', expansion: '$2b$1a$0r' });
    const triggered = snip.tryTrigger(text);

    expect(text.plugins).includes(snip);

    expect(triggered).equals(true, 'not triggered');
    expect(text.textString).equals('barbaz');
    expect(text.selection).selectionEquals('Selection(0/2 -> 0/2)');
    expect(snip.isExpanding).equals(true, 'isExpanding 1');

    snip.nextStep();
    expect(text.textString).equals('barbaz');
    expect(text.selection).selectionEquals('Selection(0/1 -> 0/1)');
    expect(snip.isExpanding).equals(true, 'isExpanding 2');

    snip.nextStep();
    expect(text.textString).equals('barbaz');
    expect(text.selection).selectionEquals('Selection(0/0 -> 0/0)');
    expect(snip.isExpanding).equals(false, 'isExpanding 3');
    expect(text.plugins).not.includes(snip);
  });

  it('snippet steps on tab', () => {
    text.textString = 'foobaz';
    text.cursorPosition = { row: 0, column: 3 };
    new Snippet({ trigger: 'foo', expansion: '$2b$1a$0r' }).tryTrigger(text);
    expect(text.selection).selectionEquals('Selection(0/2 -> 0/2)');
    text.simulateKeys('Tab');
    expect(text.selection).selectionEquals('Selection(0/1 -> 0/1)');
    text.simulateKeys('Tab');
    expect(text.selection).selectionEquals('Selection(0/0 -> 0/0)');

    expect().assert(!text.plugins.some(ea => ea.isTextSnippet), 'snippet still in plugins');
  });

  it('snippet stops on esc', () => {
    text.textString = 'foobaz';
    text.cursorPosition = { row: 0, column: 3 };
    new Snippet({ trigger: 'foo', expansion: '$2b$1a$0r' }).tryTrigger(text);
    expect(text.selection).selectionEquals('Selection(0/2 -> 0/2)');
    text.simulateKeys('Escape');
    expect(text.selection).selectionEquals('Selection(0/2 -> 0/2)');
    expect().assert(!text.plugins.some(ea => ea.isTextSnippet), 'snippet still in plugins');
  });

  it('snippet stops when leaving snippet range', async () => {
    text.textString = 'foobaz';
    text.cursorPosition = { row: 0, column: 3 };
    new Snippet({ trigger: 'foo', expansion: '$2b$1a$0r' }).tryTrigger(text);
    expect(text.selection).selectionEquals('Selection(0/2 -> 0/2)');
    await text.simulateKeys('Right Right');
    expect(text.selection).selectionEquals('Selection(0/4 -> 0/4)');
    expect().assert(!text.plugins.some(ea => ea.isTextSnippet), 'snippet still in plugins');
  });

  it('expands multiple lines with right indentation', async () => {
    text.textString = '  baz';
    text.cursorPosition = { row: 0, column: 5 };
    new Snippet({ trigger: 'baz', expansion: 'a\nb' }).tryTrigger(text);
    expect(text.textString).equals('  a\n  b');
  });
});
