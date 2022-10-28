/* global System, it, describe, xdescribe, beforeEach */
import { Text } from '../../text/morph.js';
import { expect, chai } from 'mocha-es6';

import { pt, Rectangle } from 'lively.graphics';
import { expectSelection } from '../test-helpers.js';
import bowser from 'bowser';

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

describeInBrowser('searching', () => {
  describe('find matching', () => {
    let openPairs = { '{': '}', '[': ']' };
    (() => {
      let closePairs = {};
      Object.keys(openPairs).forEach(left => closePairs[openPairs[left]] = left);
      return closePairs;
    })(); let t;

    beforeEach(() => t = text(' { [{\n }\n  }'));

    it('forward right', () => {
      expect(t.findMatchingForward({ row: 0, column: 1 }, 'right', openPairs)).deep.equals({ row: 2, column: 3 });
      expect(t.findMatchingForward({ row: 0, column: 0 }, 'right', openPairs)).deep.equals(null);
      expect(t.findMatchingForward({ row: 0, column: 3 }, 'right', openPairs)).deep.equals(null);
    });

    it('forward left', () => {
      expect(t.findMatchingForward({ row: 0, column: 2 }, 'left', openPairs)).deep.equals({ row: 2, column: 2 });
      expect(t.findMatchingForward({ row: 0, column: 1 }, 'left', openPairs)).deep.equals(null);
    });
  });

  describe('text search', () => {
    let t; beforeEach(() => t = text('123 Hello\nhello\nworld\n'));

    it('string search forward', () => {
      expect(t.search('He')).deep.equals({ range: range(0, 4, 0, 6), match: 'He' }, '1');
      expect(t.search('He', { start: { row: 0, column: 4 } })).containSubset({ range: range(0, 4, 0, 6) }, '2');
      expect(t.search('He', { start: { row: 0, column: 5 } })).containSubset({ match: 'he' }, '3');
      expect(t.search('He', { start: { row: 0, column: 5 }, caseSensitive: true })).equals(null, '4');
      expect(t.search('o\nhe')).deep.equals({ range: range(0, 8, 1, 2), match: 'o\nhe' }, '3', '5');
    });

    it('re search forward', () => {
      expect(t.search(/He[^\s]+/)).containSubset({ range: range(0, 4, 0, 9), match: 'Hello' }, '1');
      expect(t.search(/He[^\s]+\nhello/)).equals(null, '2');
      expect(t.search(/He[^\s]+\nhello/m)).containSubset({ range: range(0, 4, 1, 5), match: 'Hello\nhello' }, '3');
    });

    it('string search backward', () => {
      expect(t.search('Hello', { backwards: true, start: { row: 2, column: 0 } })).deep.equals({ match: 'hello', range: range(1, 0, 1, 5) }, '1');
      expect(t.search('Hello', { backwards: true, start: { row: 1, column: 5 } })).deep.equals({ match: 'hello', range: range(1, 0, 1, 5) }, '2');
      expect(t.search('Hello\nhello', { backwards: true, start: { row: 2, column: 0 } })).containSubset({ match: 'Hello\nhello' }, '3');
    });

    it('re search backward', () => {
      expect(t.search(/He[^\s]+/, { backwards: true, start: { row: 2, column: 0 } })).containSubset({ range: range(1, 0, 1, 5), match: 'hello' }, '1');
    });

    it('in range', () => {
      expect(t.search('l', { start: { row: 0, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 2, 1, 3) }, '1');
      expect(t.search('l', { start: { row: 1, column: 4 }, inRange: range(1, 0, 1, 5) })).equals(null, '2');
      expect(t.search('l', { backwards: true, start: { row: 1, column: 1 }, inRange: range(1, 0, 1, 5) })).equals(null, '3');
      expect(t.search('l', { backwards: true, start: { row: 3, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 3, 1, 4) }, '4');

      expect(t.search(/l/, { start: { row: 0, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 2, 1, 3) }, '5');
      expect(t.search(/l/, { start: { row: 1, column: 4 }, inRange: range(1, 0, 1, 5) })).equals(null, '6');
      expect(t.search(/l/, { backwards: true, start: { row: 3, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 3, 1, 4) }, '7');
      expect(t.search(/l/, { backwards: true, start: { row: 1, column: 1 }, inRange: range(1, 0, 1, 5) })).equals(null, '8');
    });
  });
});

describeInBrowser('iy', () => {
  let meta = bowser.mac ? 'Meta' : 'Ctrl'; let t;
  beforeEach(() => t = text('1 2 3 4\n 1 2 3 4'));

  it('jumps forward', async () => {
    await t.simulateKeys(meta + '-. input-3');
    expect(t.selection).selectionEquals('Selection(0/5 -> 0/5)');
    await t.simulateKeys('input-3');
    expect(t.selection).selectionEquals('Selection(1/6 -> 1/6)');
    await t.simulateKeys(meta + '-, input-2 input-2');
    expect(t.selection).selectionEquals('Selection(0/3 -> 0/3)');
    // deactivate by pressing another key and allowing it to do its normal thing
    await t.simulateKeys('x');
    expect(t.textString).equals('1 2x 3 4\n 1 2 3 4');
  });
});
