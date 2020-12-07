import { Morph, HorizontalLayout, Label } from 'lively.morphic';
import { Rectangle, Color } from 'lively.graphics';

export class Badge extends Morph {
  static newWithText (text) {
    return new Badge({ textString: text });
  }

  constructor (props = {}) {
    super();
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

    this.ui.count.fontColor = Color.rgb(253, 254, 254);
  }

  setCount (count) {
    this.ui.count.textString = count;
  }
}
