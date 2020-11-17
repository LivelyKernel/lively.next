import { Window } from "lively.components";
import { CommentMorph } from "./commentMorph.js";
import { VerticalLayout, Morph } from "lively.morphic";
import { pt } from "lively.graphics";

export class CommentsBrowser extends Window {

  constructor() {
    super();
    this.container = new Morph({
        layout: new VerticalLayout(),
      })
    this.addMorph(this.container);
    this.updateCommentMorphs();
    this.height = ($world.height - $world.getSubmorphNamed("lively top bar").height) * 0.8;
    this.width = 200;
    this.position = pt($world.width - 200, $world.getSubmorphNamed("lively top bar").height + 100);
    this.relayoutWindow();
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
    this.container.submorphs = commentMorphs;
  }
  
  // to not block responseToVisibleWindow
  relayoutWindow() {
    this.relayoutWindowControls();
  }
  
}
