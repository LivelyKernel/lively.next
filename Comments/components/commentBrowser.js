import { Window } from 'lively.components';
import { VerticalLayout, Label, Morph } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';
import { resource } from 'lively.resources';
import { connect } from 'lively.bindings';
import { CommentMorph, CommentIndicator } from 'Comments';

let instance;

// Store for each morph if its corresponding comment group is expanded
const commentGroupExpandedState = {};
const commentGroups = {}; // dict Morph -> Comment group morph

export class CommentBrowser extends Window {
  static toggleCommentGroupMorphExpandedFor (morph) {
    commentGroupExpandedState[morph.id] = !commentGroupExpandedState[morph.id];
  }

  static close () {
    instance.close();
  }

  // static get instance () {
  //  return instance;
  // }

  static isOpen () {
    return instance && instance.visible;
  }

  static async updateCommentForMorph (updatedComment, morph) {
    await instance.updateCommentForMorph(updatedComment, morph);
  }

  static async addCommentForMorph (comment, morph) {
    await instance.addCommentForMorph(comment, morph);
  }

  // Construction and initialization

  constructor () {
    if (!instance) {
      super();
      this.initializeContainers();
      this.initializeExtents();
      this.relayoutWindow();

      this.initializeCommentGroupMorphs();
      $world.addMorph(this);
      instance = this;
    } else {
      instance.visible = true;
    }
    return instance;
  }

  initializeExtents () {
    this.height = ($world.height - $world.getSubmorphNamed('lively top bar').height);
    this.width = 280; // perhaps use width of comment morph?

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
    // super.close();
    const topbar = $world.getSubmorphNamed('lively top bar');
    if (topbar) {
      topbar.uncolorCommentBrowserButton();
    }
    this.removeCommentIndicators();
    instance.visible = false;
  }

  async initializeCommentGroupMorphs () {
    const commentGroupMorphs = [];
    await Promise.all($world.withAllSubmorphsDo(async (morph) => {
      if (morph.comments.length == 0) {
        return;
      }
      const commentGroupMorph = await resource('part://CommentGroupMorphMockup/comment group morph master').read();
      await commentGroupMorph.initialize(morph);
      if (morph.id in commentGroupExpandedState) {
        commentGroupMorph.isExpanded = commentGroupExpandedState[morph.id];
        commentGroupMorph.applyExpanded();
      } else {
        commentGroupExpandedState[morph.id] = true;
      }
      commentGroupMorphs.push(commentGroupMorph);
      commentGroups[morph] = commentGroupMorph;
    }));
    this.containerLayout.submorphs = commentGroupMorphs;
  }

  updateCommentForMorph (updatedComment, morph) {

  }

  async addCommentForMorph (comment, morph) {
    if (morph in commentGroups) {
      await commentGroups[morph].addCommentMorph(comment);
      commentGroups[morph].relayout();
    } else {
      const commentGroupMorph = await resource('part://CommentGroupMorphMockup/comment group morph master').read();
      await commentGroupMorph.initialize(morph);
      commentGroupExpandedState[morph.id] = true;
      commentGroups[morph] = commentGroupMorph;
      this.containerLayout.addMorph(commentGroupMorph);
    }
  }

  removeCommentIndicators () {
    // comment indicators are referenced in comment groups
    this.containerLayout.submorphs.forEach((commentGroup) => commentGroup.removeCommentIndicators());
  }

  getCommentMorphForComment (comment, referencedMorph) {
    this.withAllSubmorphsDo((submorph) => {
      if (submorph.comment && submorph.referenceMorph) {
        if (submorph.comment.equals(comment)) {
          return submorph;
        }
      }
    });
  }

  // named relayoutWindows instead of relayout() to not block respondsToVisibleWindow() implementation
  relayoutWindow () {
    this.relayoutWindowControls();
  }
}
