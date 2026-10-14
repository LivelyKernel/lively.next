/* global describe, it, afterEach */
import { expect } from 'mocha-es6';
import { Text, part } from 'lively.morphic';
import { Color, Rectangle } from 'lively.graphics';
import { Range } from 'lively.morphic/text/range.js';
import { RichTextControl } from '../../studio/controls/text.cp.js';

describe('text styling controls', function () {
  this.timeout(10000);
  let text, control;
  afterEach(() => {
    control && control.remove();
    text && text.remove();
  });

  it('reads and edits whole-text selection and display properties', async () => {
    text = new Text({ readOnly: true, textString: 'hello', selectionMode: 'native', selectionColor: Color.blue }).openInWorld();
    control = part(RichTextControl, { viewModel: { globalMode: true } }).openInWorld();
    control.viewModel.focusOn(text);
    await control.whenRendered();
    const { selectionModeSelector, selectionColorInput, textOverflowSelector } = control.viewModel.ui;
    expect(selectionModeSelector.selection).equals('native');
    expect(selectionColorInput.viewModel.colorValue).equals(Color.blue);
    selectionModeSelector.selection = 'none';
    expect(text.selectionMode).equals('none');
    selectionColorInput.setColor(Color.red);
    expect(text.selectionColor).equals(Color.red);
    textOverflowSelector.selection = 'ellipsis';
    expect(text.textOverflow).equals('ellipsis');
  });

  it('applies decoration color to the selected text without changing the default', async () => {
    text = new Text({ readOnly: false, textString: 'hello', textDecorationColor: Color.blue, padding: Rectangle.inset(7) }).openInWorld();
    text.selection = Range.create(0, 1, 0, 3);
    control = part(RichTextControl).openInWorld();
    control.viewModel.focusOn(text);
    await control.whenRendered();
    expect(control.viewModel.ui.selectionControls.visible).equals(false);
    expect(control.viewModel.ui.paddingControls.viewModel.ui.paddingAll.number).equals(7);
    control.viewModel.ui.decorationColorInput.setColor(Color.red);
    expect(text.textDecorationColor).equals(Color.blue);
    expect(text.getStyleInRange(Range.create(0, 1, 0, 3)).textDecorationColor).equals(Color.red);
    expect(text.getStyleInRange(Range.create(0, 0, 0, 1), true).textDecorationColor).equals(Color.blue);
  });
});
