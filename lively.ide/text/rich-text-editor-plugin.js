
import { part, TilingLayout, Morph, Icon, easings } from 'lively.morphic';
import { TextFormattingPopUp } from './text-formatting-popup.cp.js';
import { Point, Color } from 'lively.graphics';
import EditorPlugin from '../editor-plugin.js';
import { connect, disconnect } from 'lively.bindings';
import { PropertyLabel, PropertyLabelHovered } from '../studio/shared.cp.js';

export class RichTextPlugin extends EditorPlugin {
  get shortName () { return 'richText'; }
  get longName () { return this.shortName; }

  commands () {
    return [
      {
        name: 'clean up rich-text UI',
        exec: (immediate) => {
          this.removeFormattingPopUp(immediate);
          this.removeIconButton();
        }
      },
      {
        name: 'show formatting popup',
        exec: () => this.showFormattingPopUp()
      }
    ];
  }

  attach (editor) {
    this.textMorph = editor;
    connect(this.textMorph, 'onMouseMove', this, 'onMouseMove');
    connect(this.textMorph, 'onMouseUp', this, 'onMouseUp');
  }

  detach (editor) {
    this.textMorph = null;
    disconnect(this.textMorph, 'onMouseMove', this, 'onMouseMove');
    disconnect(this.textMorph, 'onMouseUp', this, 'onMouseUp');
  }

  onMouseMove (evt) {
    if (!evt.leftMouseButtonPressed() || !this.textMorph.selectable || evt.state.clickedOnMorph !== this.textMorph) { return; }
    this.textMorph.selection.lead = this.textMorph.textPositionFromPoint(this.textMorph.localize(evt.position));
    this.textMorph.wantsFormattingPopUp = true;
  }

  onMouseUp () {
    if (this.textMorph.wantsFormattingPopUp) {
      this.showFormattingPopUp();
      this.textMorph.wantsFormattingPopUp = false;
    }
  }

  showIconButton () {
    const iconButton = part(PropertyLabel, {
      tooltip: 'Insert Icon',
      fontSize: 14,
      textAndAttributes: Icon.textAttribute('heart-music-camera-bolt')
    });
    const iconButtonHolder = new Morph({
      fill: Color.rgb(30, 30, 30).withA(0.95),
      borderRadius: 3,
      layout: new TilingLayout({
        hugContentsVertically: true,
        hugContentsHorizontally: true
      }),
      submorphs: [
        iconButton]
    });
    iconButton.master = { auto: PropertyLabel, hover: PropertyLabelHovered };
    this.textMorph.iconButton = iconButton;
    connect(this.textMorph.iconButton, 'onMouseDown', () => this.textMorph.execCommand('add icon at cursor position'));
    iconButtonHolder.openInWorld(this.textMorph.topRight);
  }

  removeIconButton () {
    this.textMorph.iconButton.remove();
  }

  showFormattingPopUp () {
    if (this.textMorph.readOnly) return;

    if (!this.textMorph.selection.isEmpty()) {
      const { start } = this.textMorph.selection;
      const startBounds = this.textMorph.charBoundsFromTextPosition(start);
      const startPoint = this.textMorph.worldPoint({ x: startBounds.x, y: startBounds.y });
      const pointForPopup = new Point(startPoint.x - 125, startPoint.y - 220 - 20);

      if (this.formattingPopUp) this.formattingPopUp.openInWorld(pointForPopup);
      else this.formattingPopUp = part(TextFormattingPopUp, { viewModel: { targetMorph: this.textMorph } }).openInWorld(pointForPopup);
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

  getCommands (otherCommands) { return otherCommands.concat(this.commands()); }
}
