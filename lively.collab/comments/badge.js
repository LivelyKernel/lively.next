import { Morph, HorizontalLayout, Label } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
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
            this.ui.count = new Label({ name: 'badge label' });
            this.addMorph(this.ui.count);
            this.layout = new HorizontalLayout(
              { spacing: 2 });
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
      morph: {},
      master: {
        initialize () {
          this.master = 'styleguide://CommentComponents/comment count badge master';
        }
      }
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interacting with morph
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  alignWithMorph () {
    this.position = this.morph.innerBounds().topRight().addPt(pt(-this.width / 2, 0));
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
