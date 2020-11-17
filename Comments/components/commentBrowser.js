import { Window } from "lively.components";
import { CommentMorph } from "./commentMorph.js";
import { VerticalLayout, Morph } from "lively.morphic";

export class CommentsBrowser extends Window {

  constructor() {
    super()
    this.ui = {
      container: new Morph({
        layout: new VerticalLayout(),
      }),
    }
    
    this.addMorph(this.ui.container);
    this.updateCommentMorphs();
    this.relayout();
  }

  getCommentsInWorld() {
    let comments = [];
    $world.withAllSubmorphsDo((morph) => {
      comments.push(...morph.comments);
    })
    return comments;
  }

  getCommentMorphs(commentList) {
    let commentMorphs = [];
    commentList.forEach((comment) => {
      commentMorphs.push(new CommentMorph(comment));
    })
    return commentMorphs;
  }

  updateCommentMorphs() {
    let commentMorphs = this.getCommentMorphs(this.getCommentsInWorld());
    this.ui.container.submorphs = commentMorphs;
  }
  

  relayout() {
    this.relayoutWindowControls();
  }
  
}
