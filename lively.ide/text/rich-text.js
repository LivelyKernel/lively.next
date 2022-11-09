
import { part } from 'lively.morphic';
import { Text } from 'lively.morphic';
import { TextFormattingPopUp } from './text-formatting-popup.cp.js';
import { Rectangle } from 'lively.graphics';

export class RichTextFormattableText extends Text {
  static get properties () {
    return {
      useFormattingPopUp: {
        defaultValue: true
      }
    };
  }

  onMouseMove (evt) {
    if (!evt.leftMouseButtonPressed() || !this.selectable || evt.state.clickedOnMorph !== this) { return; }
    this.selection.lead = this.textPositionFromPoint(this.localize(evt.position));
    this.showFormattingPopUp();
  }

  showFormattingPopUp () {
    if (!this.useFormattingPopUp) return;

    if (!this.selection.isEmpty() && !this.formattingPopUp?.world()) this.formattingPopUp = part(TextFormattingPopUp, { viewModel: { targetMorph: this } }).openInWorldNearHand();
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    if (!this.formattingPopUp?.bounds().outsetByRect(Rectangle.fromTuple([10, 10, 10, 10])).containsPoint(evt.hand.position)) {
      this.formattingPopUp?.remove();
      this.formattingPopUp = null;
    }
  }
}
