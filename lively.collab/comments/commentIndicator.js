import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect, disconnect, disconnectAll } from 'lively.bindings';
import { CommentBrowser } from 'lively.collab';

export class CommentIndicator extends Label {
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
    this.fontColor = Color.rgbHex('#f1c40f');
    this.nativeCursor = 'pointer';
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

  delete () {
    const referenceMorph = this.referenceMorph;
    disconnect(referenceMorph, 'onChange', this, 'referenceMoving');
    disconnect(referenceMorph, 'onOwnerChanged', this, 'connectMorphs');
    this.remove();
  }

  display () {
    $world.addMorph(this);
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
    if (this.commentMorph.owner) this.commentMorph.show();
  }
}
