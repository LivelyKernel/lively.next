/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, TilingLayout, part } from 'lively.morphic';
import { LayoutControl } from '../studio/controls/layout.cp.js';

describe('layout sidebar ordering', () => {
  it('toggles reverseOrder through the checkbox in index mode', () => {
    const target = new Morph({ layout: new TilingLayout({ orderByIndex: true }) });
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
      expect(target.layout.orderByIndex).equals(true, 'reversal preserves index ordering mode');
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

  it('disables reverse ordering in position mode and re-enables it in index mode', () => {
    const layout = new TilingLayout({ orderByIndex: false, reverseOrder: true });
    const target = new Morph({ layout });
    const control = part(LayoutControl);
    try {
      control.viewModel.focusOn(target);
      const checkbox = control.getSubmorphNamed('reverse order checkbox');
      expect(checkbox.active).equals(false, 'reverse-order control is disabled in position mode');
      expect(checkbox.checked).equals(true, 'disabling the control preserves the stored flag');
      checkbox.viewModel.trigger();
      control.viewModel.toggleReverseOrder();
      expect(target.layout).equals(layout, 'disabled interaction does not replace the layout');
      expect(target.layout.reverseOrder).equals(true, 'disabled interaction does not change the stored flag');
      const preview = control.getSubmorphNamed('mini layout preview').getSubmorphNamed('outer border');
      expect(preview.layout.reverseOrder).equals(false, 'position-mode preview does not reverse');

      target.layout = layout.with({ orderByIndex: true });
      control.viewModel.update();
      expect(checkbox.active).equals(true, 'index mode enables the reverse-order control');
      expect(preview.layout.reverseOrder).equals(true, 'index-mode preview uses the stored reversal');
      checkbox.viewModel.trigger();
      expect(target.layout.reverseOrder).equals(false, 're-enabled control can change reversal');
    } finally { control.remove(); }
  });
});
