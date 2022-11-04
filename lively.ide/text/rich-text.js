
import { part, easings } from 'lively.morphic';
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

  /**
   * description
   * @param {boolean} imm - If true, do not animate and instead remove the popup immediately.
   * @returns {type} description
   */
  async removeFormattingPopUp (imm = false) {
    if (!this.formattingPopUp) return;
    if (!imm) {
      await this.formattingPopUp.animate({
        duration: 2000,
        opacity: 0,
        easing: easings.inOutQuad
      });
    }
    this.formattingPopUp.remove();
    this.formattingPopUp = null;
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    if (!this.formattingPopUp?.bounds().outsetByRect(Rectangle.fromTuple([10, 10, 10, 10])).containsPoint(evt.hand.position)) {
      this.removeFormattingPopUp();
    }
  }
}
