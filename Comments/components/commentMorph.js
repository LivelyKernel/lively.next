import { Morph, Label } from "lively.morphic";
import { pt } from "lively.graphics";

export class CommentMorph extends Morph {
  constructor(comment) {
    super({fill: "gray", extent: pt(200,100)})
    let label = new Label({textString: comment.text + "\n" + comment.timestamp});
    this.addMorph(label);
  }
}