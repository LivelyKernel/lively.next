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

  initialize (comment, referenceMorph) {
    this.comment = comment;
    this.referenceMorph = referenceMorph;
    const [date, time] = new Date(this.comment.timestamp).toLocaleString('de-DE', { hour12: false }).split(', ');
    this.get('dateLabel').textString = ' ' + date + ' ' + time;
    this.get('commentTextField').textString = this.comment.text;
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.referenceMorph.show();
  }
}
