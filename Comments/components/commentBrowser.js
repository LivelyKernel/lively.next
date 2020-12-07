import { Window } from 'lively.components';
import { VerticalLayout, Label, Morph } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';
import { resource } from 'lively.resources';
import { connect } from 'lively.bindings';
import { CommentMorph, CommentIndicator } from 'Comments';

let instance;

export class CommentBrowser extends Window {
  static close () {
    instance.close();
  }

  static get instance () {
    return instance;
  }

  static isOpen () {
    return instance && $world.get('comment browser');
  }

  static async removeCommentForMorph (updatedComment, morph) {
    await instance.removeCommentForMorph(updatedComment, morph);
  }

  static async addCommentForMorph (comment, morph) {
    await instance.addCommentForMorph(comment, morph);
  }

  static async initializeCommentBrowser () {
    const firstTimeOpened = !instance;
    new CommentBrowser();
    if (firstTimeOpened) {
      await instance.initializeCommentGroupMorphs();
    }
  }

  // Construction and initialization

  constructor () {
    if (!instance) {
      super();
      this.initializeContainers();
      this.initializeExtents();
      this.relayoutWindow();

      instance = this;
      this.name = 'comment browser';
      this.commentGroups = {}; // dict Morph id -> Comment group morph

      this.makeVisible();
    } else {
      this.makeVisible();
    }
    return instance;
  }

  makeVisible () {
    $world.addMorph(instance);
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
    this.layoutContainer = new Morph({
      layout: new VerticalLayout({
        spacing: 5,
        orderByIndex: true
      }),
      name: 'comment container layout'
    });
    this.container.addMorph(this.layoutContainer);
    this.addMorph(this.container);
  }

  close () {
    // super.close();
    const topbar = $world.getSubmorphNamed('lively top bar');
    if (topbar) {
      topbar.uncolorCommentBrowserButton();
    }
    this.remove();
  }

  async initializeCommentGroupMorphs () {
    const commentGroupMorphs = [];
    await Promise.all($world.withAllSubmorphsDo(async (morph) => {
      if (morph.comments.length == 0) {
        return;
      }
      morph.comments.forEach(async (comment) => {
        await this.addCommentForMorph(comment, morph);
      });
    }));
  }

  async addCommentForMorph (comment, morph) {
    if (morph.id in this.commentGroups) {
      await this.commentGroups[morph.id].addCommentMorph(comment);
      this.commentGroups[morph.id].relayout();
    } else {
      const commentGroupMorph = await resource('part://CommentGroupMorphMockup/comment group morph master').read();
      await commentGroupMorph.initialize(morph);
      this.commentGroups[morph.id] = commentGroupMorph;
      await this.commentGroups[morph.id].addCommentMorph(comment);
      this.layoutContainer.addMorph(commentGroupMorph);
    }
  }

  async removeCommentForMorph (comment, morph) {
    const group = this.commentGroups[morph.id];
    await group.removeCommentMorph(comment);
    if (group.getCommentMorphCount() === 0) {
      this.removeCommentGroup(group);
    }
  }

  removeCommentGroup (group) {
    group.hideCommentIndicators();
    delete this.commentGroups[group.referenceMorph.id];
    group.remove();
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
