import { Window } from 'lively.components';
import { CommentMorph } from './commentMorph.js';
import { VerticalLayout, Label, Morph } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';
import { resource } from 'lively.resources';
import { connect } from 'lively.bindings';
import { CommentIndicator } from './commentIndicator.js';

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

  // Construction and initialization

  constructor () {
    if (!instance) {
      super();
      this.initializeContainers();
      this.initializeExtents();
      this.relayoutWindow();
      $world.addMorph(this);
      this.commentIndicators = [];
      instance = this;
    }
    return instance;
  }

  initializeExtents () {
    this.height = ($world.height - $world.getSubmorphNamed('lively top bar').height);
    this.width = 275; // perhaps use width of comment morph?

    this.position = pt($world.width - this.width, $world.getSubmorphNamed('lively top bar').height);

    // when styling palette is opened, position comment browser to the left of it. TODO: move it back when palette is closed
    if ($world.get('lively top bar') && $world.get('lively top bar').activeSideBars.includes('Styling Palette')) {
      this.position = this.position.addPt(pt(-$world.get('lively top bar').stylingPalette.width, 0));
    }
  }

  initializeContainers () {
    this.container = new Morph({
      clipMode: 'auto',
      name: 'comment container'
    });
    this.containerLayout = new Morph({
      layout: new VerticalLayout({
        spacing: 5,
        orderByIndex: true
      }),
      name: 'comment container layout'
    });
    this.container.addMorph(this.containerLayout);
    this.addMorph(this.container);
  }

  close () {
    super.close();
    const topbar = $world.getSubmorphNamed('lively top bar');
    if (topbar) {
      topbar.uncolorCommentBrowserButton();
    }
    this.removeCommentIndicators();
    instance = undefined;
  }

  getCommentsInWorld () {
    const commentTuples = [];
    $world.withAllSubmorphsDo((morph) => {
      morph.comments.forEach((comment) =>
        commentTuples.push({
          comment: comment,
          morph: morph
        })
      );
    });
    return commentTuples;
  }

  getHeadingMorph (referenceMorph) {
    const labelHolder = new Morph();
    const morphLabel = new Label();
    morphLabel.textString = referenceMorph.name;
    morphLabel.fontWeight = 'bolder';
    labelHolder.addMorph(morphLabel);
    return labelHolder;
  }

  async generateCommentMorphs (commentList) {
    const commentMorphs = [];
    let lastMorph;
    await Promise.all(commentList.map(async (commentTuple) => {
      const commentMorph = await resource('part://CommentComponents/comment morph master').read();
      if (lastMorph != commentTuple.morph) {
        commentMorphs.push(this.getHeadingMorph(commentTuple.morph));
        lastMorph = commentTuple.morph;
      }
      commentMorph.initialize(commentTuple.comment, commentTuple.morph);
      this.commentIndicators.push(CommentIndicator.for(commentTuple.morph, commentTuple.comment));
      commentMorphs.push(commentMorph);
    }));
    return commentMorphs;
  }

  removeCommentIndicators () {
    // Comment Indicators (little icons and morphs that show that they have comments) are created by the CommentBrowser. They have to be removed by the CommentBrowser as well.
    this.commentIndicators.forEach((commentIndicator) => commentIndicator.remove());
  }

  async updateCommentMorphs () {
    const commentMorphs = await this.generateCommentMorphs(this.getCommentsInWorld());
    this.containerLayout.submorphs = commentMorphs;
  }

  getCommentMorphForComment (comment, referencedMorph) {
    // currently comments are referenced by timestamp and morph. We assume that no two comments have the same timestamp and morph.
    // This may be changed to a id
    let result;
    this.withAllSubmorphsDo((submorph) => {
      if (submorph.comment && submorph.referenceMorph) {
        if (submorph.comment.timestamp === comment.timestamp &&
          submorph.referenceMorph === referencedMorph) {
          result = submorph;
          return 0; // Return to break execution
        }
      }
    });
    return result;
  }

  // named relayoutWindows instead of relayout() to not block respondsToVisibleWindow() implementation
  relayoutWindow () {
    this.relayoutWindowControls();
  }
}
