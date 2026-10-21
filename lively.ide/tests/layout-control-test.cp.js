/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, TilingLayout, part } from 'lively.morphic';
import { LayoutControl } from '../studio/controls/layout.cp.js';

describe('layout sidebar ordering', () => {
  it('toggles reverseOrder through the checkbox without changing the order mode', () => {
    const target = new Morph({ layout: new TilingLayout({ orderByIndex: false }) });
    const control = part(LayoutControl);
    try {
      const checkbox = control.getSubmorphNamed('reverse order checkbox');
      expect(checkbox).not.equals(null, 'sidebar exposes a reverse-order checkbox');
      control.viewModel.focusOn(target);
      const metadata = [];
      const withMetaDo = target.withMetaDo;
      target.withMetaDo = function (meta, fn) {
        metadata.push(meta);
        return withMetaDo.call(this, meta, fn);
      };
      checkbox.viewModel.trigger();
      expect(target.layout.reverseOrder).equals(true, 'checking the control enables reversal');
      expect(target.layout.orderByIndex).equals(false, 'reversal preserves spatial ordering mode');
      expect(metadata.some(meta => meta.reconcileChanges === true)).equals(true, 'sidebar changes retain reconciliation metadata');
      checkbox.viewModel.trigger();
      expect(target.layout.reverseOrder).equals(false, 'unchecking the control disables reversal');
    } finally { control.remove(); }
  });

  it('reflects the focused layout in the checkbox and preview', () => {
    const target = new Morph({ layout: new TilingLayout({ reverseOrder: true }) });
    const control = part(LayoutControl);
    try {
      const checkbox = control.getSubmorphNamed('reverse order checkbox');
      expect(checkbox).not.equals(null, 'sidebar exposes a reverse-order checkbox');
      control.viewModel.focusOn(target);
      expect(checkbox.checked).equals(true, 'focus reflects the stored reversal');
      const preview = control.getSubmorphNamed('mini layout preview').getSubmorphNamed('outer border');
      expect(preview.layout.reverseOrder).equals(true, 'the layout preview reflects direction');
    } finally { control.remove(); }
  });
});
