/* global System, it, describe, xdescribe, beforeEach */

import { expect, chai } from 'mocha-es6';

import { TextSearcher } from '../../text/search.js';
import { expectSelection } from 'lively.morphic/tests/test-helpers.js';
import { Text } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';

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
    readOnly: false,
    ...props
  });
}

function range (startRow, startCol, endRow, endCol) {
  return { start: { row: startRow, column: startCol }, end: { row: endRow, column: endCol } };
}

describeInBrowser('searching', () => {
  describe('text search', () => {
    let t, ts; beforeEach(() => {
      t = text('123 Hello\nhello\nworld\n');
      ts = new TextSearcher(t);
    });

    it('string search forward', () => {
      expect(ts.search({ needle: 'He' })).deep.equals({ range: range(0, 4, 0, 6), match: 'He' }, '1');
      expect(ts.search({ needle: 'He', start: { row: 0, column: 4 } })).containSubset({ range: range(0, 4, 0, 6) }, '2');
      expect(ts.search({ needle: 'He', start: { row: 0, column: 5 } })).containSubset({ match: 'he' }, '3');
      expect(ts.search({ needle: 'He', start: { row: 0, column: 5 }, caseSensitive: true })).equals(null, '4');
      expect(ts.search({ needle: 'o\nhe' })).deep.equals({ range: range(0, 8, 1, 2), match: 'o\nhe' }, '3', '5');
    });

    it('re search forward', () => {
      expect(ts.search({ needle: /He[^\s]+/ })).containSubset({ range: range(0, 4, 0, 9), match: 'Hello' }, '1');
      expect(ts.search({ needle: /He[^\s]+\nhello/ })).equals(null, '2');
      expect(ts.search({ needle: /He[^\s]+\nhello/m })).containSubset({ range: range(0, 4, 1, 5), match: 'Hello\nhello' }, '3');
    });

    it('string search backward', () => {
      expect(ts.search({ needle: 'Hello', backwards: true, start: { row: 2, column: 0 } })).deep.equals({ match: 'hello', range: range(1, 0, 1, 5) }, '1');
      expect(ts.search({ needle: 'Hello', backwards: true, start: { row: 1, column: 5 } })).deep.equals({ match: 'hello', range: range(1, 0, 1, 5) }, '2');
      expect(ts.search({ needle: 'Hello\nhello', backwards: true, start: { row: 2, column: 0 } })).containSubset({ match: 'Hello\nhello' }, '3');
    });

    it('re search backward', () => {
      expect(ts.search({ needle: /He[^\s]+/, backwards: true, start: { row: 2, column: 0 } })).containSubset({ range: range(1, 0, 1, 5), match: 'hello' }, '1');
    });

    it('in range', () => {
      expect(ts.search({ needle: 'l', start: { row: 0, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 2, 1, 3) }, '1');
      expect(ts.search({ needle: 'l', start: { row: 1, column: 4 }, inRange: range(1, 0, 1, 5) })).equals(null, '2');
      expect(ts.search({ needle: 'l', backwards: true, start: { row: 1, column: 1 }, inRange: range(1, 0, 1, 5) })).equals(null, '3');
      expect(ts.search({ needle: 'l', backwards: true, start: { row: 3, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 3, 1, 4) }, '4');

      expect(ts.search({ needle: /l/, start: { row: 0, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 2, 1, 3) }, '5');
      expect(ts.search({ needle: /l/, start: { row: 1, column: 4 }, inRange: range(1, 0, 1, 5) })).equals(null, '6');
      expect(ts.search({ needle: /l/, backwards: true, start: { row: 3, column: 0 }, inRange: range(1, 0, 1, 5) })).containSubset({ range: range(1, 3, 1, 4) }, '7');
      expect(ts.search({ needle: /l/, backwards: true, start: { row: 1, column: 1 }, inRange: range(1, 0, 1, 5) })).equals(null, '8');
    });
  });
});
