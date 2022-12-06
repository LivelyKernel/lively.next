
import { part, easings } from 'lively.morphic';
import { Text } from 'lively.morphic';
import { TextFormattingPopUp } from './text-formatting-popup.cp.js';

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
    this.wantsFormattingPopUp = true;
  }

  onMouseUp () {
    if (this.wantsFormattingPopUp) {
      this.showFormattingPopUp();
      this.wantsFormattingPopUp = false;
    }
  }

  showFormattingPopUp () {
    if (!this.useFormattingPopUp || this.readOnly) return;

    if (!this.selection.isEmpty()) {
      if (this.formattingPopUp) this.formattingPopUp.openInWorldNearHand();
      else this.formattingPopUp = part(TextFormattingPopUp, { viewModel: { targetMorph: this } }).openInWorldNearHand();
    }
  }

  /**
   * @param {boolean} imm - If true, do not animate and instead remove the popup immediately.
   * @returns {type} description
   */
  async removeFormattingPopUp (imm = false) {
    if (!this.formattingPopUp) return;
    const popup = this.formattingPopUp;
    this.formattingPopUp = null;
    if (!imm) {
      await popup.animate({
        duration: 200,
        opacity: 0,
        easing: easings.inOutQuad
      });
    }
    popup.remove();
  }

  remove () {
    this.removeFormattingPopUp(true);
    super.remove();
  }
}
