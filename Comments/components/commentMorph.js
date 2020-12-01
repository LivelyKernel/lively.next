import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Rectangle } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { resource } from 'lively.resources';
import { CommentBrowser } from './commentBrowser.js';
import { CommentIndicator } from './commentIndicator.js';

export class CommentGroupMorph extends Morph {
  async initialize (referenceMorph) {
    this.ui = {
      groupNameLabel: this.get('group name label'),
      commentMorphContainer: this.get('comment morph container'),
      header: this.get('header'),
      collapseIndicator: this.get('collapse indicator')
    };
    connect(this.ui.header, 'onMouseDown', this, 'toggleExpanded');
    this.referenceMorph = referenceMorph;
    await this.refreshCommentMorphs();
    this.ui.groupNameLabel.textString = this.referenceMorph.name;
    this.isExpanded = true;
  }

  async getCommentMorphs (comments) {
    const commentMorphs = [];
    await Promise.all(comments.map(async (comment) => {
      const commentMorph = await resource('part://CommentComponents/comment morph master').read();
      CommentBrowser.instance.commentIndicators.push(CommentIndicator.for(this.referenceMorph, comment));
      commentMorph.initialize(comment, this.referenceMorph);
      commentMorphs.push(commentMorph);
    }));
    return commentMorphs;
  }

  async refreshCommentMorphs () {
    const commentMorphs = await this.getCommentMorphs(this.referenceMorph.comments);
    this.ui.commentMorphContainer.submorphs = commentMorphs;
  }

  applyExpanded () {
    Icon.setIcon(this.ui.collapseIndicator, this.isExpanded ? 'caret-down' : 'caret-right');
    if (!this.isExpanded) {
      this.ui.commentMorphContainer.submorphs = [];
      // should not be necessary to set extent manually, but layout doesn't change it automatically
      this.ui.commentMorphContainer.extent = pt(0, 0);
    } else {
      this.refreshCommentMorphs();
    }
  }

  toggleExpanded () {
    CommentBrowser.toggleCommentGroupMorphExpandedFor(this.referenceMorph);
    this.isExpanded = !this.isExpanded;
    this.applyExpanded();
  }
}

export class CommentMorph extends Morph {
  static get properties () {
    return {
      comment: {
      },
      referenceMorph: {
      }
    };
  }

  constructor () {
    super();
    this.ui = {
      dateLabel: this.get('date label'),
      commentTextLabel: this.get('comment text field'),
      deleteButton: this.get('delete button')
    };
  }

  initialize (comment, referenceMorph) {
    this.comment = comment;
    this.referenceMorph = referenceMorph;
    const [date, time] = new Date(this.comment.timestamp).toLocaleString('de-DE', { hour12: false }).split(', ');
    this.get('date label').textString = date + ' ' + time;
    this.get('comment text field').textString = this.comment.text;
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);

    if (evt.targetMorph === this.get('delete button')) {
      this.referenceMorph.removeComment(this.comment);
    } else if (this.referenceMorph) {
      this.referenceMorph.show();
    }
  }
}
