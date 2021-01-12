import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect, disconnect, disconnectAll } from 'lively.bindings';
import { CommentBrowser } from 'lively.collab';

export class CommentIndicator extends Label {

  get isCommentIndicator () {
    return true;

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
      },
      commentMorph: {
        defaultValue: undefined
      }
    };
  }

  constructor (commentMorph, comment, referenceMorph) {
    super();
    this.referenceMorph = referenceMorph;
    this.commentMorph = commentMorph;
    this.comment = comment;
    this.initStyling();

    this._referenceMorphMoving = false;
    this.alignWithMorph();

    this.connectMorphs();
  }

  initStyling () {
    Icon.setIcon(this, 'comment-alt');
    this.fontSize = 15;
    this.padding = new Rectangle(0, 2, 4, 0);
    this.width = this.fontSize + this.padding.width;
    this.height = this.fontSize + this.padding.y;
    this.isLayoutable = false;
    this.nativeCursor = 'pointer';
    this.fontColor = this.comment.isResolved() ? Color.rgb(174, 214, 241) : Color.rgb(241, 196, 15);
    this.tooltip = this.comment.isResolved() ? 'A comment was placed here and resolved' : 'A comment was placed here';
  }

  connectMorphs () {
    // When the morph that has the comment is a child in a hierarchy, it does not generate 'onChange' Events when the morphs that are higher in the hierarchy are moved.
    // Therefore we need to connect the indication with all morphs higher in the hierarchy.
    let referenceMorph = this.referenceMorph;
    while (referenceMorph && referenceMorph != $world) {
      connect(referenceMorph, 'onChange', this, 'referenceMoving');
      connect(referenceMorph, 'onOwnerChanged', this, 'connectMorphs');
      referenceMorph = referenceMorph.owner;
    }
  }

  onChange (change) {
    super.onChange(change);
    const { prop, value } = change;
    if (!this._referenceMorphMoving && prop === 'position') {
      // Unsolved problem: Don't move the comment's reference point when the referenced morph moves (not a problem for now)
      this.comment.position = this.getRelativePositionInMorph();
    }
  }

  getRelativePositionInMorph () {
    const morphOrigin = this.referenceMorph.globalPosition;
    const ownPosition = this.globalPosition;
    const xRelative = (ownPosition.x - morphOrigin.x) / this.referenceMorph.width;
    const yRelative = (ownPosition.y - morphOrigin.y) / this.referenceMorph.height;
    return pt(xRelative, yRelative);
  }

  abandon () {
    const referenceMorph = this.referenceMorph;
    disconnect(referenceMorph, 'onChange', this, 'referenceMoving');
    disconnect(referenceMorph, 'onOwnerChanged', this, 'connectMorphs');
    super.abandon();
  }

  display () {
    this.connectMorphs();
    this.alignWithMorph();
    $world.addMorph(this);
  }

  canBeCopied () {
    return false;
  }

  referenceMoving () {
    this._referenceMorphMoving = true;
    this.alignWithMorph();
    this._referenceMorphMoving = false;
  }

  alignWithMorph () {
    const morphOrigin = this.referenceMorph.globalPosition;
    const xOffset = this.referenceMorph.width * this.comment.position.x;
    const yOffset = this.referenceMorph.height * this.comment.position.y;
    this.position = morphOrigin.addPt(pt(xOffset, yOffset));
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.commentMorph.show();
  }
}
