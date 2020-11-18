import { Window } from 'lively.components';
import { CommentMorph } from './commentMorph.js';
import { VerticalLayout, Morph } from 'lively.morphic';
import { pt } from 'lively.graphics';

let instance;

export class CommentBrowser extends Window {
  static close () {
    instance.close();
  }

  static isOpen () {
    return instance;
  }

  static get instance () {
    return instance;
  }

  static update () {
    if (CommentBrowser.isOpen()) {
      instance.updateCommentMorphs();
    }
  }

  constructor () {
    if (!instance) {
      super();
      this.container = new Morph({
        layout: new VerticalLayout()
      });
      this.addMorph(this.container);
      this.updateCommentMorphs();
      this.height = ($world.height - $world.getSubmorphNamed('lively top bar').height) * 0.8;
      this.width = 200;
      this.position = pt($world.width - 200, $world.getSubmorphNamed('lively top bar').height + 100);
      this.relayoutWindow();
      $world.addMorph(this);
      instance = this;
    }
    return instance;
  }

  close () {
    super.close();
    const topbar = $world.getSubmorphNamed('lively top bar');
    if (topbar) {
      topbar.uncolorCommentBrowserButton();
    }
    instance = undefined;
  }

  getCommentsInWorld () {
    const comments = [];
    $world.withAllSubmorphsDo((morph) => {
      comments.push(...morph.comments);
    });
    return comments;
  }

  getCommentMorphs (commentList) {
    const commentMorphs = [];
    commentList.forEach((comment) => {
      commentMorphs.push(new CommentMorph(comment));
    });
    return commentMorphs;
  }

  updateCommentMorphs () {
    const commentMorphs = this.getCommentMorphs(this.getCommentsInWorld());
    this.container.submorphs = commentMorphs;
  }

  // to not block respondsToVisibleWindow
  relayoutWindow () {
    this.relayoutWindowControls();
  }
}
