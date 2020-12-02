import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Color, Rectangle } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { resource } from 'lively.resources';
import { CommentBrowser } from './commentBrowser.js';
import { CommentIndicator } from './commentIndicator.js';

export class CommentGroupMorph extends Morph {
  async initialize (referenceMorph) {
    this.referenceMorph = referenceMorph;
    await this.initializeUI();
    this.commentIndicators = [];
    await this.refreshCommentMorphs();
    this.isExpanded = true;
  }

  async initializeUI () {
    this.ui = {
      groupNameLabel: this.get('group name label'),
      commentMorphContainer: this.get('comment morph container'),
      header: this.get('header'),
      collapseIndicator: this.get('collapse indicator'),
      commentCountLabel: this.get('comment count label')
    };
    connect(this.ui.header, 'onMouseDown', this, 'toggleExpanded');
    this.ui.groupNameLabel.textString = this.referenceMorph.name;
  }

  async getCommentMorphs (comments) {
    const commentMorphs = [];
    await Promise.all(comments.map(async (comment) => {
      const commentMorph = await resource('part://CommentComponents/comment morph master').read();
      this.commentIndicators.push(CommentIndicator.for(this.referenceMorph, comment));
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
      // it should not be necessary to set extent manually, but layout doesn't change it automatically
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

  removeCommentIndicators () {
    this.commentIndicators.forEach((commentIndicator) => commentIndicator.remove());
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
    this.isInEditMode = false;
  }

  setDate () {
    const [date, time] = new Date(this.comment.timestamp).toLocaleString('de-DE', { hour12: false }).split(', ');
    this.ui.dateLabel.textString = date + ' ' + time;
  }

  initializeUI () {
    this.ui = {
      dateLabel: this.get('date label'),
      commentTextField: this.get('comment text field'),
      deleteButton: this.get('delete button'),
      resolveButton: this.get('resolve button'),
      editSaveButton: this.get('edit save button')
    };

    if (this.comment.isResolved()) {
      this.fill = Color.rgb(216, 216, 216);
    }

    this.ui.commentTextField.textString = this.comment.text;
    this.setDefaultUI();
  }

  initialize (comment, referenceMorph) {
    this.comment = comment;
    this.referenceMorph = referenceMorph;
    this.initializeUI();

    this.setDate();
  }

  saveComment () {
    this.comment.text = this.ui.commentTextField.textString;
    this.setDefaultUI();
  }

  abortCommentEdit () {
    this.ui.commentTextField.textString = this.comment.text;
    this.setDefaultUI();
  }

  setDefaultUI () {
    Icon.setIcon(this.ui.editSaveButton, 'pencil-alt');

    // Edit/Save Icon widths are off by one, revert the additional padding from setEditUI
    if (this.isInEditMode) this.ui.editSaveButton.padding.width -= 1;

    this.isInEditMode = false;

    this.ui.commentTextField.readOnly = true;
    this.ui.commentTextField.fill =
      this.comment.isResolved() ? Color.rgb(216, 216, 216) : Color.rgb(240, 243, 244);
    this.ui.commentTextField.borderStyle = 'none';
  }

  setEditUI () {
    Icon.setIcon(this.ui.editSaveButton, 'save');

    // Edit/Save Icon widths are off by one, will be reverted in setDefaultUI
    if (!this.isInEditMode) this.ui.editSaveButton.padding.width += 1;

    this.isInEditMode = true;

    this.ui.commentTextField.readOnly = false;
    this.ui.commentTextField.fill = Color.white;
    this.ui.commentTextField.borderStyle = 'solid';
    this.ui.commentTextField.focus();
  }

  toggleEditMode () {
    this.isInEditMode ? this.saveComment() : this.setEditUI();
  }

  toggleResolveStatus () {
    this.abortCommentEdit();
    this.comment.toggleResolveStatus();
    this.fill = this.comment.isResolved() ? Color.rgb(216, 216, 216) : Color.rgb(240, 243, 244);
    this.ui.commentTextField.fill =
      this.comment.isResolved() ? Color.rgb(216, 216, 216) : Color.rgb(240, 243, 244);
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);

    if (evt.targetMorph === this.ui.deleteButton) {
      this.referenceMorph.removeComment(this.comment);
    } else if (evt.targetMorph === this.ui.editSaveButton) {
      this.toggleEditMode();
    } else if (evt.targetMorph === this.ui.resolveButton) {
      this.toggleResolveStatus();
    } else if (this.referenceMorph && !this.isInEditMode) {
      this.referenceMorph.show();
    }
  }
}
