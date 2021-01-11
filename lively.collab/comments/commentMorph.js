import { Morph, Icon } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
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

  hasCommentMorphForComment (comment) {
    let result = false;
    this.commentMorphs.forEach((commentMorph) => {
      if (commentMorph.comment.equals(comment)) {
        result = true;
      }
    });
    return result;
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
        commentMorph.abandon();
        remove(this.commentMorphs, commentMorph);
      }
    });
    this.updateCommentContainerSubmorphs();
    this.updateCommentCountLabel();
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

  initialize (comment, referenceMorph) {
    this.comment = comment;
    this.referenceMorph = referenceMorph;
    this.initializeUI();
    this.initializeCommentIndicator();
    this.setDate();
    this.setUser();
  }

  setDate () {
    const [date, time] = new Date(this.comment.timestamp).toLocaleString('de-DE', { hour12: false }).split(', ');
    this.ui.dateLabel.textString = date + ' ' + time;
  }

  setUser () {
    let username = this.comment.username;
    if (username.startsWith('guest')) {
      username = 'guest';
    }
    this.ui.usernameLabel.textString = username;
  }

  reset () {
    this.ui = {
      dateLabel: this.get('date label'),
      commentTextField: this.get('comment text field'),
      deleteButton: this.get('delete button'),
      resolveButton: this.get('resolve button'),
      editSaveButton: this.get('edit save button'),
      usernameLabel: this.get('user name label')
    };
  }

  async onLoad () {
    this.reset();
  }

  initializeUI () {
    this.reset();

    this.ui.commentTextField.textString = this.comment.text;
    this.setDefaultUI();
  }

  initializeCommentIndicator () {
    this.commentIndicator = new CommentIndicator(this, this.comment, this.referenceMorph);
    this.commentIndicator.fontColor = this.comment.isResolved() ? Color.rgb(174, 214, 241) : Color.rgb(241, 196, 15);
    if (CommentBrowser.isOpen() && (this.comment.isResolved() == CommentBrowser.showsArchive())) {
      this.showCommentIndicator();
    }
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
    Icon.setIcon(this.ui.resolveButton, this.comment.resolved ? 'undo-alt' : 'check');

    // Edit/Save Icon widths are off by one, revert the additional padding from setEditUI
    if (this.isInEditMode) this.ui.editSaveButton.padding.width -= 1;

    this.isInEditMode = false;

    this.enabledButtonAppearance();
    this.ui.editSaveButton.tooltip = 'Edit Comment';

    this.ui.commentTextField.readOnly = true;
    this.ui.commentTextField.fill = Color.rgb(251, 252, 252);
    this.ui.commentTextField.borderStyle = 'none';
  }

  enabledButtonAppearance () {
    const buttonColor = Color.rgb(127, 140, 141);

    this.ui.resolveButton.fontColor = buttonColor;
    this.ui.resolveButton.nativeCursor = 'pointer';
    this.ui.resolveButton.tooltip = this.comment.isResolved() ? 'Unresolve Comment' : 'Resolve Comment';

    this.ui.deleteButton.fontColor = buttonColor;
    this.ui.deleteButton.nativeCursor = 'pointer';
    this.ui.deleteButton.tooltip = 'Delete Comment';
  }

  disabledButtonAppearance () {
    const deactivatedButtonColor = Color.rgba(127, 140, 141, 0.4);

    this.ui.resolveButton.fontColor = deactivatedButtonColor;
    this.ui.resolveButton.nativeCursor = 'default';
    this.ui.resolveButton.tooltip = 'Save comment to be able to resolve it';

    this.ui.deleteButton.fontColor = deactivatedButtonColor;
    this.ui.deleteButton.nativeCursor = 'default';
    this.ui.deleteButton.tooltip = 'Save comment to be able to delete it';
  }

  setEditUI () {
    Icon.setIcon(this.ui.editSaveButton, 'save');

    // Edit/Save Icon widths are off by one, will be reverted in setDefaultUI
    if (!this.isInEditMode) this.ui.editSaveButton.padding.width += 1;

    this.isInEditMode = true;

    this.disabledButtonAppearance();
    this.ui.editSaveButton.tooltip = 'Save Comment';

    this.ui.commentTextField.readOnly = false;
    this.ui.commentTextField.fill = Color.white;
    this.ui.commentTextField.borderStyle = 'solid';
    this.ui.commentTextField.focus();
  }

  toggleEditMode () {
    this.isInEditMode ? this.saveComment() : this.setEditUI();
  }

  async toggleResolveStatus () {
    this.abortCommentEdit();
    this.comment.toggleResolveStatus();
    await CommentBrowser.instance.applyResolveStatus(this.comment, this.referenceMorph);
  }

  hideCommentIndicator () {
    this.commentIndicator.abandon();
  }

  showCommentIndicator () {
    this.commentIndicator.display();
  }

  abandon () {
    this.commentIndicator.abandon();
    super.abandon();
  }

  performClickAction (action) {
    switch (action) {
      case 'remove':
        if (!this.isInEditMode) {
          this.referenceMorph.removeComment(this.comment);
        }
        break;
      case 'toggle_edit':
        this.toggleEditMode();
        break;
      case 'resolve':
        if (!this.isInEditMode) {
          this.toggleResolveStatus();
        }
        break;
    }
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);

    if (evt.targetMorph === this.ui.deleteButton) {
      this.performClickAction('remove');
    } else if (evt.targetMorph === this.ui.editSaveButton) {
      this.performClickAction('toggle_edit');
    } else if (evt.targetMorph === this.ui.resolveButton) {
      this.performClickAction('resolve');
    } else if (this.referenceMorph && !this.isInEditMode) {
      this.referenceMorph.show();
    }
  }
}
