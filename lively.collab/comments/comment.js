import { ViewModel, part } from 'lively.morphic/components/core.js';
import { CommentView, commentButtonDisabled, commentButtonEnabled } from './components/comment.cp.js';
import { remove } from 'lively.lang/array.js';
import { Icon } from 'lively.morphic';
import { Color } from 'lively.graphics';
import { CommentIndicator } from './components/comment-indicator.cp.js';

export class CommentModel extends ViewModel {
  // TODO: clicking a comment should highlight the morph it belongs to
  static get properties () {
    return {
      comment: { },
      referenceMorph: { },
      commentIndicator: {},
      isInEditMode: {
        defaultValue: false
      },
      bindings: {
        get () {
          return [
            { target: 'delete button', signal: 'onMouseDown', handler: 'removeComment' },
            { target: 'resolve button', signal: 'onMouseDown', handler: 'toggleResolveStatus' },
            { target: 'edit save button', signal: 'onMouseDown', handler: 'toggleEditMode' }
          ];
        }
      }
    };
  }

  saveComment () {
    this.comment.text = this.ui.commentTextField.textString;
    this.setDefaultUI();
  }
  
  abortCommentEdit () {
    this.ui.commentTextField.textString = this.comment.text;
    this.setDefaultUI();
  }

  toggleEditMode () {
    this.isInEditMode ? this.saveComment() : this.setEditUI();
  }

  setEditUI () {
    Icon.setIcon(this.ui.editSaveButton, 'save');

    this.isInEditMode = true;

    this.disabledButtonAppearance();
    this.ui.editSaveButton.tooltip = 'Save Comment';

    this.ui.commentTextField.readOnly = false;
    this.ui.commentTextField.fill = Color.white;
    this.ui.commentTextField.borderStyle = 'solid';
    this.ui.commentTextField.focus();
  }

  setDefaultUI () {
    Icon.setIcon(this.ui.editSaveButton, 'pencil-alt');

    this.isInEditMode = false;

    this.enabledButtonAppearance();
    this.ui.editSaveButton.tooltip = 'Edit Comment';

    this.ui.commentTextField.readOnly = true;
    this.ui.commentTextField.fill = Color.rgb(251, 252, 252);
    this.ui.commentTextField.borderStyle = 'none';
  }

  enabledButtonAppearance () {
    this.ui.resolveButton.master = commentButtonEnabled;
    this.ui.resolveButton.tooltip = this.comment.isResolved() ? 'Unresolve Comment' : 'Resolve Comment';
    this.ui.resolveButton.textAndAttributes = Icon.textAttribute(this.comment.isResolved() ? 'undo-alt' : 'check'); 
    
    this.ui.deleteButton.master = commentButtonEnabled;
    this.ui.deleteButton.tooltip = 'Delete Comment';
  }
  
  disabledButtonAppearance () {
    this.ui.resolveButton.master = commentButtonDisabled;
    this.ui.resolveButton.tooltip = 'Save comment to be able to resolve it';

    this.ui.deleteButton.master = commentButtonDisabled;
    this.ui.deleteButton.tooltip = 'Save comment to be able to delete it';
  }

  toggleResolveStatus () {
    this.abortCommentEdit();
    this.comment.toggleResolveStatus();
    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    commentBrowser.viewModel.removeCommentForMorph(this.comment, this.referenceMorph);
  }

  removeComment () {
    this.referenceMorph.removeComment(this.comment);
  }
  
  viewDidLoad () {
    this.enabledButtonAppearance();
    this.ui.commentTextField.textString = this.comment.text;
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
    this.ui.userNameLabel.textString = username;
  }
  
  showCommentIndicator () {
    this.commentIndicator = part(CommentIndicator, {
      viewModel: { 
        referenceMorph: this.referenceMorph, 
        commentMorph: this,
        comment: this.comment,
        _referenceMorphMoving: false
      }
    });
    $world.addMorph(this.commentIndicator);
  }

  removeCommentIndicator () {
    if (!this.commentIndicator) return;
    this.commentIndicator.abandon();
    this.commentIndicator = null;
  }
}

export class CommentGroupModel extends ViewModel {
  static get properties () {
    return {
      referenceMorph: {
        set (referenceMorph) {
          this.setProperty('referenceMorph', referenceMorph);
        }
      },
      // TODO: this should be saved somewhere, to make the collapse state persistent across sessions
      // a possible solution would be to mirror this into the state of the CommentData objects 
      isExpanded: {
        defaultValue: true
      },
      commentMorphs: {
        defaultValue: []
      },
      commentIndicators: {
        defaultValue: []
      },
      bindings: {
        get () {
          return [
            { target: 'collapse indicator', signal: 'onMouseDown', handler: 'toggleExpanded' }
          ];
        }
      }
    };
  }

  viewDidLoad () {
    this.updateName();
  }

  updateName () {
    this.ui.groupNameLabel.textString = this.referenceMorph.name;
  }

  addCommentMorph (comment) {
    const commentMorph = part(CommentView, { viewModel: { comment: comment, referenceMorph: this.referenceMorph } });
    this.commentMorphs.push(commentMorph);
    this.updateCommentContainerSubmorphs();
    this.updateCommentCountLabel();
    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    if (commentBrowser) {
      commentBrowser.viewModel.removeAllCommentIndicators();
      commentBrowser.viewModel.showAllCommentIndicators();
    }
  }

  removeCommentMorphFor (comment) {
    this.removeCommentIndicators();
    this.commentMorphs.forEach(commentMorph => {
      if (commentMorph.viewModel.comment.equals(comment)) {
        commentMorph.abandon();
        remove(this.commentMorphs, commentMorph);
      }
    });
    this.updateCommentContainerSubmorphs();
    this.updateCommentCountLabel();
    this.showCommentIndicators();
  }

  applyExpanded () {
    Icon.setIcon(this.ui.collapseIndicator, this.isExpanded ? 'caret-down' : 'caret-right');
    this.updateCommentContainerSubmorphs();
    if (!this.isExpanded) {
      // it should not be necessary to set extent manually, but layout doesn't change it automatically
      this.ui.commentContainer.visible = false;
      this.view.height = 48;
    } else {
      this.ui.commentContainer.visible = true;
      this.view.height = 80;
    }
  }

  toggleExpanded () {
    this.isExpanded = !this.isExpanded;
    this.applyExpanded();
  }

  updateCommentContainerSubmorphs () {
    this.ui.commentContainer.submorphs = this.isExpanded ? this.commentMorphs : [];
  }

  updateCommentCountLabel () {
    this.ui.commentCountLabel.textString = this.getCommentCount();
  }

  getCommentCount () {
    return this.commentMorphs.length;
  }

  showCommentIndicators () {
    this.commentMorphs.forEach((commentMorph) => commentMorph.viewModel.showCommentIndicator());
  }

  removeCommentIndicators () {
    this.commentMorphs.forEach((commentMorph) => commentMorph.viewModel.removeCommentIndicator());
  }
}
