import { Morph, Label } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';

export class CommentMorph extends Morph {
  static get properties () {
    return {
      comment: {
      },
      referenceMorph: {

      }
    };
  }

  constructor (comment, referenceMorph) {
    super({ fill: '#fff3b6', extent: pt(200, 100) });

    this.comment = comment;
    this.referenceMorph = referenceMorph;

    const label = new Label({
      textString: this.comment.text + '\n' + this.comment.timestamp,
      padding: new Rectangle(5, 5, 5, 5)
    });
    this.addMorph(label);
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.referenceMorph.show();
  }
}
