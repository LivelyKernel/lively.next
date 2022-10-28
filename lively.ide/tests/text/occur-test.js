/* global System, it, describe, xdescribe, beforeEach */

import { expect, chai } from 'mocha-es6';
import { Occur, occurStartCommand } from '../../text/occur.js';
import { expectSelection } from 'lively.morphic/tests/test-helpers.js';
import { Text } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';
import { arr } from 'lively.lang';

let describeInBrowser = System.get('@system-env').browser
  ? describe
  : (title, fn) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xdescribe(title, fn); };

expectSelection(chai);

function text (string, props) {
  return new Text({
    name: 'text',
    textString: string,
    fontFamily: 'Monaco, monosonpace',
    fontSize: 10,
    extent: pt(100, 100),
    padding: Rectangle.inset(2),
    ...props
  });
}

function range (startRow, startCol, endRow, endCol) {
  return { start: { row: startRow, column: startCol }, end: { row: endRow, column: endCol } };
}

describeInBrowser('occur', () => {
  let t; beforeEach(() => t = text('abc\ndef\nxyz\nbcxbc'));

  it('find lines matching', function () {
    let opts = { needle: 'bc' };
    expect(new Occur({ textMorph: t }).matchingLines(opts)).deep.equals([
      { row: 0, ranges: [range(0, 1, 0, 3)], line: 'abc' },
      { row: 3, ranges: [range(3, 0, 3, 2), range(3, 3, 3, 5)], line: 'bcxbc' }]);
  });

  it('display occurrences', function () {
    let o = new Occur({ textMorph: t }); let orig = t.textString;
    o.displayOccurContent({ needle: 'bc' });
    expect(t.textString).equals('abc\nbcxbc');
    o.displayOriginalContent(t);
    expect(t.textString).equals(orig);
  });

  it('original position from occur doc', function () {
    let o = new Occur({ textMorph: t });
    o.displayOccurContent({ needle: 'bc' });
    expect(t.textString).equals('abc\nbcxbc');
    expect(o.occurToOriginalPosition({ row: 1, column: 2 })).deep.equals({ row: 3, column: 2 });
  });

  it('occur command', function () {
    let orig = t.textString = 'hel\nlo\n\nwo\nrld\n';
    t.addCommands([occurStartCommand]);

    // run occur for lines including 'o'
    t.execCommand('occur', { needle: 'o' });
    expect(t.textString).equals('lo\nwo');
    // command install OK?
    expect().assert(arr.last(t.keyhandlers).isOccurHandler, 'no occur handler installed');
    expect().assert(t.commands.find(ea => ea.name === 'occur exit'), 'no exitoccur command installed');

    // occur exit
    t.execCommand('occur exit');
    expect(t.textString).equals(orig);

    // editor state cleaned up?
    expect().assert(!arr.last(t.keyhandlers).isOccurHandler, 'occur handler installed after detach');
    expect().assert(!t.commands.find(ea => ea.name === 'occur exit'), 'exitoccur installed after exiting occur');
  });

  it('occur navigation', function () {
    t.addCommands([occurStartCommand]);
    t.cursorPosition = { row: 1, column: 1 };

    // run occur for lines including 'o'
    t.execCommand('occur', { needle: 'o' });
    expect(t.textString).equals('lo\nwo');
    expect(t.cursorPosition).deep.equals({ row: 0, column: 1 }, 'original -> occur pos');

    // move to second line and accept
    t.cursorPosition = { row: 1, column: 1 };
    t.execCommand('occur accept');
    expect(t.cursorPosition).deep.equals({ row: 3, column: 1 }, 'occur -> original pos');
  });

  it('recursive occur', function () {
    // setup

    let orig = t.textString = 'x\nabc1\nx\nabc2\n';
    t.addCommands([occurStartCommand]);

    // orig -> occur1
    t.execCommand('occur', { needle: 'abc' });
    expect(t.textString).equals('abc1\nabc2', 'orig -> occur1');

    // occur1 -> occur2
    t.execCommand('occur', { needle: '2' });
    expect(t.textString).equals('abc2', 'occur1 -> occur2');

    // occur2 -> occur1
    t.execCommand('occur exit');
    expect(t.textString).equals('abc1\nabc2', 'occur2 -> occur1');

    // occur1 -> orig
    t.execCommand('occur exit');
    expect(t.textString).equals(orig, 'occur1 -> orig');
  });
});
