import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Color, Rectangle } from 'lively.graphics';
import { remove } from 'lively.lang/array.js';
import { connect } from 'lively.bindings';
import { resource } from 'lively.resources';
import { CommentBrowser, CommentIndicator } from 'lively.collab';

export class CommentGroupMorph extends Morph {
  static get properties () {
    return {
      referenceMorph: {
        defaultValue: undefined,
        set (referenceMorph) {
          this.setProperty('referenceMorph', referenceMorph);
        }
      },
      isExpanded: {
        defaultValue: true,
        set (expand) {
          this.setProperty('isExpanded', expand);
        }
      },
      commentMorphs: {
        defaultValue: []
      }
    };
  }

  async initialize (referenceMorph) {
    this.referenceMorph = referenceMorph;
    await this.initializeUI();
    this.commentIndicators = [];
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

  async addCommentMorph (comment) {
    // TODO this has to be changed when package position changed
    const commentMorph = await resource('part://CommentComponents/comment morph master').read();
    commentMorph.initialize(comment, this.referenceMorph);
    this.commentMorphs.push(commentMorph);
    this.updateCommentContainerSubmorphs();
    this.updateCommentCountLabel();
  }

  onOwnerChanged () {
    // called when comment groups enter or exit the screen
    super.onOwnerChanged();
    if (CommentBrowser.isOpen()) {
      this.showCommentIndicators();
    } else {
      this.hideCommentIndicators();
    }
  }

  updateCommentCountLabel () {
    this.ui.commentCountLabel.textString = this.getCommentCount();
  }

  getCommentCount () {
    return this.commentMorphs.length;
  }

  getUnresolvedCommentCount () {
    return this.commentMorphs.filter((commentMorph) => !commentMorph.comment.isResolved()).length;
  }

  async removeCommentMorphFor (comment) {
    this.commentMorphs.forEach((commentMorph) => {
      if (commentMorph.comment.equals(comment)) {
        commentMorph.delete();
        remove(this.commentMorphs, commentMorph);
        this.updateCommentContainerSubmorphs();
        this.updateCommentCountLabel();
      }
    });
  }

  updateCommentContainerSubmorphs () {
    this.ui.commentMorphContainer.submorphs = this.isExpanded ? this.commentMorphs : [];
  }

  applyExpanded () {
    Icon.setIcon(this.ui.collapseIndicator, this.isExpanded ? 'caret-down' : 'caret-right');
    this.updateCommentContainerSubmorphs();
    if (!this.isExpanded) {
      // it should not be necessary to set extent manually, but layout doesn't change it automatically
      this.ui.commentMorphContainer.extent = pt(0, 0);
    }
  }

  toggleExpanded () {
    this.isExpanded = !this.isExpanded;
    this.applyExpanded();
  }

  showCommentIndicators () {
    this.commentMorphs.forEach((commentMorph) => commentMorph.showCommentIndicator());
  }

  hideCommentIndicators () {
    this.commentMorphs.forEach((commentMorph) => commentMorph.hideCommentIndicator());
  }
}

export class CommentMorph extends Morph {
  static get properties () {
    return {
      comment: {
        defaultValue: undefined,
        set (comment) {
          this.setProperty('comment', comment);
        }
      },
      referenceMorph: {
        defaultValue: undefined,
        set (referenceMorph) {
          this.setProperty('referenceMorph', referenceMorph);
        }
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

  initialize (comment, referenceMorph) {
    this.comment = comment;
    this.referenceMorph = referenceMorph;
    this.initializeUI();
    this.initializeCommentIndicator();
    this.setDate();
  }

  reset () {
    this.ui = {
      dateLabel: this.get('date label'),
      commentTextField: this.get('comment text field'),
      deleteButton: this.get('delete button'),
      resolveButton: this.get('resolve button'),
      editSaveButton: this.get('edit save button')
    };
  }

  async onLoad () {
    this.reset();
  }

  initializeUI () {
    this.reset();

    if (this.comment.isResolved()) {
      this.fill = Color.rgb(216, 216, 216);
    }

    this.ui.commentTextField.textString = this.comment.text;
    this.setDefaultUI();
  }

  initializeCommentIndicator () {
    this.commentIndicator = new CommentIndicator(this, this.comment, this.referenceMorph);
    if (CommentBrowser.isOpen()) this.showCommentIndicator();
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
    CommentBrowser.instance.updateCommentCountBadge();
    this.fill = this.comment.isResolved() ? Color.rgb(216, 216, 216) : Color.rgb(240, 243, 244);
    this.ui.commentTextField.fill =
      this.comment.isResolved() ? Color.rgb(216, 216, 216) : Color.rgb(240, 243, 244);
  }

  hideCommentIndicator () {
    this.commentIndicator.delete();
  }

  showCommentIndicator () {
    this.commentIndicator.display();
  }

  delete () {
    this.commentIndicator.delete();
    this.remove();
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
