/* global describe, it */
import { expect } from 'mocha-es6';
import { TilingLayout } from 'lively.morphic';
import { DropDownSelector } from '../widgets.js';

describe('legacy dropdown selector', () => {
  it('uses the current row layout when constructed', () => {
    const selector = new DropDownSelector({ padding: 5, values: ['first', 'second'] });
    try {
      expect(selector.layout).instanceOf(TilingLayout);
      expect(selector.layout.axis).equals('row');
      expect(selector.layout.spacing).equals(5);
    } finally { selector.remove(); }
  });
});
