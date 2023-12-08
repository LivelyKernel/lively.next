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
    readOnly: false,
    textString: string,
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    extent: pt(100, 100),
    padding: Rectangle.inset(2),
    cursorPosition: { row: 0, column: 0 },
    ...props
  });
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
