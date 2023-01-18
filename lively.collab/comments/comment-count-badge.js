import { pt } from 'lively.graphics';
import { connect, disconnect } from 'lively.bindings';
import { ViewModel } from 'lively.morphic/components/core.js';

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
      isEpiMorph: { get () { return true; } },
      expose: {
        get () {
          return ['text', 'addToMorph', 'isEpiMorph'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'abandon', handler: 'abandon' }];
        }
      }
    };
  }

  alignWithMorph () {
    this.view.position = this.morph.globalPosition.addXY(this.morph.width, 0).addXY(-5, 5);
  }

  addToMorph (morph) {
    this.morph = morph;
    $world.addMorph(this.view);
    this.alignWithMorph();
  }

  removeFromMorph () {
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
