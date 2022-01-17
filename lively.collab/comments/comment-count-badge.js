import { pt } from 'lively.graphics';
import { connect, disconnect } from 'lively.bindings';
import { ViewModel } from 'lively.morphic/components/core.js';

// TODO: This should always count the number of unresolved Comments in the world
// the quick-and-dirty switch to just counting submorphs broke this functionality
// lh 2022-01-17
export class CommentCountBadgeModel extends ViewModel {
  static get properties () {
    return {
      text: {
        derived: true,
        get () {
          return this.ui.badgeLabel.textString;
        },
        set (text) {
          this.ui.badgeLabel.textString = text;
          if (this.morph) {
            this.alignWithMorph();
          }
        }
      },
      morph: {},
      bindings: {
        get () {
          return [
            { signal: 'abandon', handler: 'abandon' }];
        }
      }
    };
  }

  alignWithMorph () {
    // TODO: this looks slightly weird at the moment (lh 2022-01-17)
    this.view.position = this.morph.innerBounds().topRight().addPt(pt(-this.width / 2, 0));
  }

  addToMorph (morph) {
    this.morph = morph;
    morph.addMorph(this.view);
    this.alignWithMorph();
    connect(morph, 'onChange', this, 'alignWithMorph', { garbageCollect: true });
  }

  removeFromMorph () {
    disconnect(this.morph, 'onChange', this, 'alignWithMorph');
    this.morph = undefined;
  }

  abandon () {
    if (this.morph) {
      this.removeFromMorph();
    }
  }

  incrementCounter (value = 1) {
    const newValue = Number.parseInt(this.text) + value;
    this.text = newValue;
  }

  decrementCounter (value = 1) {
    this.incrementCounter(-value);
  }
}
