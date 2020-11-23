import { Window } from 'lively.components';
import { CommentMorph } from './commentMorph.js';
import { VerticalLayout, Label, Morph } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';
import { resource } from 'lively.resources';

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
        layout: new VerticalLayout({
          spacing: 5,
          orderByIndex: true
        }),
        name: 'comment container'
      });
      this.addMorph(this.container);
      this.height = ($world.height - $world.getSubmorphNamed('lively top bar').height) * 0.8;
      this.width = 260;
      this.position = pt($world.width - this.width, $world.getSubmorphNamed('lively top bar').height + 100);
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
    const commentTuples = [];
    $world.withAllSubmorphsDo((morph) => {
      morph.comments.forEach((comment) => {
        commentTuples.push({
          comment: comment,
          morph: morph
        });
      });
    });
    return commentTuples;
  }

  async getCommentMorphs (commentList) {
    const commentMorphs = [];
    let lastMorph;
    await Promise.all(commentList.map(async (commentTuple) => {
      const commentMorph = await resource('part://CommentComponents/comment morph master').read();
      if (lastMorph != commentTuple.morph) {
        const labelHolder = new Morph();
        const morphLabel = new Label();
        morphLabel.textString = commentTuple.morph.name;
        labelHolder.addMorph(morphLabel);
        commentMorphs.push(labelHolder);
        lastMorph = commentTuple.morph;
      }
      commentMorph.initialize(commentTuple.comment, commentTuple.morph);
      commentMorphs.push(commentMorph);
    }));
    console.log(commentMorphs);
    return commentMorphs;
  }

  async updateCommentMorphs () {
    const commentMorphs = await this.getCommentMorphs(this.getCommentsInWorld());
    this.container.submorphs = commentMorphs;
  }

  // to not block respondsToVisibleWindow
  relayoutWindow () {
    this.relayoutWindowControls();
  }
}
