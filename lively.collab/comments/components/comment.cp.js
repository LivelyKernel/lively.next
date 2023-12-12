import { component } from 'lively.morphic/components/core.js';
import { Color, rect, pt } from 'lively.graphics';
import { TilingLayout, Text, Icon, Label } from 'lively.morphic';
import { ViewModel, part } from 'lively.morphic/components/core.js';
import { remove } from 'lively.lang/array.js';
import { CommentIndicator } from './comment-indicator.cp.js';
import { StatusMessageError } from 'lively.halos/components/messages.cp.js';

export class CommentModel extends ViewModel {
  static get properties () {
    return {
      comment: { },
      referenceMorph: { },
      commentIndicator: {},
      isInEditMode: {
        defaultValue: false
      },
      expose: {
        get () {
          return ['prohibitsClosing', 'isComment', 'comment', 'showCommentIndicator', 'removeCommentIndicator'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'delete button', signal: 'onMouseDown', handler: 'removeComment' },
            { target: 'resolve button', signal: 'onMouseDown', handler: 'toggleResolveStatus' },
            { target: 'edit save button', signal: 'onMouseDown', handler: 'toggleEditMode' },
            { signal: 'onMouseDown', handler: 'onMouseDown' }
          ];
        }
      }
    };
  }

  get isComment () {
    return true;
  }

  onMouseDown (evt) {
    if (!evt.targetMorph.isText && !evt.targetMorph.isLabel) {
      this.commentIndicator.show();
      this.referenceMorph.show();
    }
  }

  prohibitsClosing () {
    if (this.isInEditMode) {
      this.view.show();
      $world.setStatusMessage('A comment is currently being edited.', StatusMessageError);
      return true;
    }
    return false;
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
    commentBrowser.removeCommentForMorph(this.comment, this.referenceMorph, true);
  }

  removeComment () {
    $world.removeCommentFor(this.referenceMorph, this.comment);
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
      isExpanded: {
        defaultValue: true
      },
      commentMorphs: {
        defaultValue: []
      },
      commentIndicators: {
        defaultValue: []
      },
      expose: {
        get () {
          return ['showCommentIndicators', 'removeCommentIndicators', 'isCommentGroup', 'addCommentMorph', 'updateName', 'removeCommentMorphFor', 'getCommentCount'];
        }
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

  get isCommentGroup () {
    return true;
  }

  viewDidLoad () {
    this.updateName();
  }

  updateName () {
    this.ui.groupNameLabel.textString = this.referenceMorph.name;
  }

  /**
   * Adds the visual representation of `comment` to this group.
   * If the comment stores the information that the group has to be collapsed, take care of that.
   * @param {CommentData} comment
   */
  addCommentMorph (comment) {
    const commentMorph = part(CommentView, { viewModel: { comment: comment, referenceMorph: this.referenceMorph } });
    this.commentMorphs.push(commentMorph);
    this.updateCommentContainerSubmorphs();
    this.updateCommentCountLabel();
    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    if (commentBrowser) {
      commentBrowser.removeAllCommentIndicators();
      commentBrowser.showAllCommentIndicators();
    }
    if (comment.viewCollapsed) {
      this.isExpanded = false;
      this.applyExpanded();
    }
  }

  removeCommentMorphFor (comment) {
    this.removeCommentIndicators();
    this.commentMorphs.forEach(commentMorph => {
      if (commentMorph.comment.equals(comment)) {
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

  /**
   * Expands/Collapses this group and updates the displayed comment data object accordingly. 
   * As the view and viewmodels of the comment browser and its submorphs are never stored, we store the information whether a comment group has been collapsed in the comment data itself.   
   */
  toggleExpanded () {
    this.isExpanded = !this.isExpanded;
    this.applyExpanded();
    this.commentMorphs.forEach(commentMorph => {
      commentMorph.comment.viewCollapsed = !this.isExpanded;
    });
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
    this.commentMorphs.forEach((commentMorph) => commentMorph.showCommentIndicator());
  }

  removeCommentIndicators () {
    this.commentMorphs.forEach((commentMorph) => commentMorph.removeCommentIndicator());
  }
}

const CommentGroup = component({
  name: 'comment group',
  defaultViewModel: CommentGroupModel,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    hugContentsVertically: true,
    resizePolicies: [
      ['header', { height: 'fixed', width: 'fill' }],
      ['comment container', { height: 'fill', width: 'fill' }]
    ]
  }),
  fill: Color.rgb(251, 252, 252),
  borderWidth: 1,
  borderColor: Color.rgb(189, 195, 199),
  borderRadius: 5,
  extent: pt(270.0, 80.0),
  submorphs: [
    {
      name: 'header',
      fill: Color.transparent,
      layout: new TilingLayout({
        orderByIndex: true,
        justifySubmorphs: 'spaced',
        resizingPolicies: [
          ['container spacer', { height: 'fill', width: 'fill' }]
        ]
      }),
      height: 32,
      submorphs: [
        {
          name: 'collapse indicator',
          type: Label,
          layout: new TilingLayout({
            orderByIndex: true
          }),
          textAndAttributes: Icon.textAttribute('caret-down'),
          padding: rect(15, 12, -1, -4)
        },
        {
          name: 'group name label',
          type: Label,
          textString: 'aGroupName',
          fontSize: 15,
          padding: rect(0, 10, 0, -4)
        },
        {
          name: 'container spacer',
          fill: Color.transparent
        },
        {
          name: 'comment count label',
          type: Label,
          fontSize: 15,
          textString: '999',
          padding: 10
        }
      ]
    },
    {
      name: 'comment container',
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        orderByIndex: true,
        padding: 5,
        hugContentsVertically: true
      })
    }]

});

const commentButtonEnabled = component({
  type: Label,
  fontColor: Color.rgb(127, 140, 141),
  fontSize: 15,
  nativeCursor: 'pointer',
  halosEnabled: false
});

const commentButtonDisabled = component({
  fontColor: Color.rgba(127, 140, 141, 0.4),
  nativeCursor: 'default'
});

const commentLabel = component({
  type: Label,
  fontColor: Color.rgb(112, 123, 124),
  halosEnabled: false,
  readOnly: true,
  reactsToPointer: false
});

const CommentView = component({
  name: 'comment',
  defaultViewModel: CommentModel,
  fill: Color.transparent,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    padding: 5,
    hugContentsVertically: true,
    resizePolicies: [
      ['header', { height: 'fixed', width: 'fill' }]
    ]
  }),
  extent: pt(265.0, 134.0),
  fill: Color.rgb(251, 252, 252),
  borderWidth: 1,
  borderColor: { top: Color.rgb(189, 195, 199) },
  submorphs: [
    {
      name: 'header',
      height: 40,
      halosEnabled: false,
      layout: new TilingLayout({
        resizePolicies: [
          ['text container', { height: 'fill', width: 'fill' }]
        ]
      }),
      submorphs: [
        // The contents of this `text container` have been autogenerated with convertToSpec from an old master component (lh 2022-01-12)
        // The absolute positioning was the reason why this was necessary
        // Nicer would be to have something along the lines of a GridLayout to position the four Labels 2x2
        {
          name: 'text container',
          extent: pt(177.2, 17),
          fill: Color.rgba(0, 0, 0, 0),
          fixedWidth: true,
          fontColor: Color.rgb(112, 123, 124),
          halosEnabled: false,
          lineWrapping: 'by-words',
          nativeCursor: 'default',
          position: pt(0.4, 13.5),
          readOnly: true,
          submorphs: [
            {
              type: Label,
              name: 'user name label',
              extent: pt(57, 17),
              position: pt(40, 8.4),
              master: commentLabel,
              textString: 'user name'
            },
            {
              type: Label,
              name: 'date label',
              extent: pt(120, 17),
              position: pt(39.6, -7.2),
              master: commentLabel,
              textString: '2022-01-12'
            },
            {
              type: Label,
              name: 'from label',
              extent: pt(28, 17),
              position: pt(3.6, -7.2),
              master: commentLabel,
              textString: 'From'
            },
            {
              type: Label,
              name: 'by label',
              extent: pt(14, 17),
              position: pt(4.4, 7.8),
              master: commentLabel,
              textString: 'By'
            }]
        },
        {
          name: 'button container',
          halosEnbled: false,
          layout: new TilingLayout({
            spacing: 8,
            padding: 8,
            hugContents: true
          }),
          submorphs: [
            {
              type: Label,
              name: 'delete button',
              textAndAttributes: Icon.textAttribute('trash'),
              master: commentButtonEnabled,
              tooltip: 'Delete Comment'
            },
            {
              type: Label,
              name: 'edit save button',
              textAndAttributes: Icon.textAttribute('pencil-alt'),
              master: commentButtonEnabled,
              tooltip: 'Edit Comment'
            },
            {
              type: Label,
              name: 'resolve button',
              textAndAttributes: Icon.textAttribute('check'),
              master: commentButtonEnabled,
              tooltip: 'Resolve Comment'
            }
          ]
        }

      ]
    },
    // TODO: This showcases a layouting bug which is triggered when the `Comment` needs to grow vertically because lines have been added to the text inside of the `comment text field`
    // Hovering in and out of the `Comment` will lead to a short flickering of it, as the Morph figures out of high it should be
    // lh 2021-01-12
    {
      name: 'comment text field',
      type: Text,
      textString: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: Color.rgb(191, 201, 202),
      lineWrapping: 'by-words',
      fixedWidth: true,
      padding: 5,
      halosEnabled: false,
      width: 255,
      readOnly: true,
      fill: Color.rgb(251, 252, 252),
      borderStyle: 'none'
    }]
});

export { CommentGroup, CommentView, commentButtonEnabled, commentButtonDisabled };
