import { Morph, HorizontalLayout, Label } from 'lively.morphic';
import { Rectangle, pt, Color } from 'lively.graphics';
import { connect } from 'lively.bindings';

export class Badge extends Morph {
  static newWithText (text) {
    return new Badge({ textString: text });
  }

  constructor (props = {}) {
    super(props);
    this.ui = {};
    this.ui.count = new Label();
    this.addMorph(this.ui.count);
    this.layout = new HorizontalLayout(
      { spacing: 4 });

    this.ui.count.textString = '42';
    if (props.textString) {
      this.ui.count.textString = props.textString;
    }
    this.fill = Color.rgb(149, 165, 166);
    if (props.color) {
      this.fill = props.color;
    }

    this.borderRadius = 12;

    this.isLayoutable = false;

    this.ui.count.fontColor = Color.rgb(253, 254, 254);
  }

  setText (text) {
    this.ui.count.textString = text;
    if (this.morph) {
      this.alignWithMorph();
    }
  }

  alignWithMorph () {
    this.position = this.morph.extent.addPt(pt(-this.extent.x, -this.extent.y));
  }

  addToMorph (morph) {
    this.morph = morph;
    morph.addMorph(this);
    this.alignWithMorph();
    connect(morph, 'onChange', this, 'alignWithMorph');
  }

  incrementCounter (value = 1) {
    const newValue = Number(this.ui.count.textString) + value;
    this.setText(newValue);
  }

  decrementCounter (value = 1) {
    this.incrementCounter(-value);
  }
}
