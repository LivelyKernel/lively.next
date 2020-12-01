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
      collapseIndicator: this.get('collapse indicator'),
      commentCountLabel: this.get('comment count label')
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
    this.ui.commentCountLabel.textString = commentMorphs.length;
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
  }

  initialize (comment, referenceMorph) {
    this.comment = comment;
    this.referenceMorph = referenceMorph;

    this.ui = {
      dateLabel: this.get('date label'),
      commentTextField: this.get('comment text field'),
      deleteButton: this.get('delete button'),
      editSaveButton: this.get('edit save button')
    };

    const [date, time] = new Date(this.comment.timestamp).toLocaleString('de-DE', { hour12: false }).split(', ');
    this.ui.dateLabel.textString = date + ' ' + time;
    this.ui.commentTextField.textString = this.comment.text;
    this.editSaveButtonState = 'edit';
    this.ui.commentTextField.readOnly = true;
  }

  toggleEditSaveButton () {
    if (this.editSaveButtonState === 'edit') {
      Icon.setIcon(this.ui.editSaveButton, 'save');
      this.editSaveButtonState = 'save';
      this.ui.commentTextField.readOnly = false;
      this.ui.editSaveButton.padding.width += 1; // Icon widths are off by one
    } else {
      Icon.setIcon(this.ui.editSaveButton, 'pencil-alt');
      this.editSaveButtonState = 'edit';
      this.ui.commentTextField.readOnly = true;
      this.textChanged();
      this.ui.editSaveButton.padding.width -= 1;
    }
  }

  textChanged () {
    const text = this.ui.commentTextField.textString;
    this.referenceMorph.comments.forEach((comment) => {
      if (comment.timestamp === this.comment.timestamp) {
        comment.text = text;
        return true; // Break
      }
    });
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);

    if (evt.targetMorph === this.ui.deleteButton) {
      this.referenceMorph.removeComment(this.comment);
    } else if (evt.targetMorph === this.ui.editSaveButton) {
      this.toggleEditSaveButton();
    } else if (this.referenceMorph) {
      this.referenceMorph.show();
    }
  }
}
