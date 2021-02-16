import { Morph, HorizontalLayout, Label } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { connect, disconnect } from 'lively.bindings';

export class Badge extends Morph {
  static newWithText (text) {
    return new Badge({ text: text });
  }

  static get properties () {
    return {
      ui: {
        defaultValue: { }
      },
      text: {
        derived: true,
        get () {
          return this.ui.count.textString;
        },

        set (text) {
          if (!this.get('badge label')) {
            this.ui.count = new Label({ name: 'badge label', fontColor: Color.rgb(253, 254, 254), position: pt(0, 0) });
            this.addMorph(this.ui.count);
            this.layout = new HorizontalLayout(
              { spacing: 4 });
          }
          this.ui.count.textString = text;
          if (this.morph) {
            this.alignWithMorph();
          }
        }
      },
      isLayoutable: {
        defaultValue: false
      },
      borderRadius: {
        defaultValue: 12
      },
      fill: {
        defaultValue: Color.rgb(149, 165, 166)
      },
      morph: {}
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interacting with morph
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  alignWithMorph () {
    this.position = this.morph.extent.addPt(pt(-this.extent.x, -this.extent.y));
  }

  addToMorph (morph) {
    this.morph = morph;
    morph.addMorph(this);
    this.alignWithMorph();
    connect(morph, 'onChange', this, 'alignWithMorph');
  }

  removeFromMorph () {
    disconnect(this.morph, 'onChange', this, 'alignWithMorph');
    this.morph = undefined;
  }

  abandon () {
    if (this.morph) {
      this.removeFromMorph();
    }
    super.abandon();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // counter
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  incrementCounter (value = 1) {
    const newValue = Number.parseInt(this.text) + value;
    this.text = newValue;
  }

  decrementCounter (value = 1) {
    this.incrementCounter(-value);
  }
}
