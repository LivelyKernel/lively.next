import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect, disconnectAll } from 'lively.bindings';
import { CommentBrowser } from './commentBrowser.js';

export class CommentIndicator extends Label {
  static for (morph, comment) {
    const indicator = new this({ morph, comment });
    return indicator;
  }

  constructor (props = {}) {
    super(props);
    this.morph = props.morph;
    this.comment = props.comment;

    $world.addMorph(this);
    this.initStyling();

    this._referenceMorphMoving = false;
    this.alignWithMorph();

    this.connectMorphs();
    // connect(this, 'onMouseDown', CommentBrowser.getInstance(), 'scrollToMorph', { converter: () => commentIndicator.morph, varMapping: { commentIndicator: this } });
  }

  initStyling () {
    Icon.setIcon(this, 'comment-alt');
    this.fontSize = 15;
    this.padding = new Rectangle(0, 2, 4, 0);
    this.width = this.fontSize + this.padding.width;
    this.height = this.fontSize + this.padding.y;
    this.fontColor = Color.rgbHex('#f1c40f');
  }

  connectMorphs () {
    // When the morph that has the comment is a child in a hierarchy, it does not generate 'onChange' Events when the morphs that are higher in the hierarchy are moved.
    // Therefore we need to connect the indication with all morphs higher in the hierarchy.
    // ! These connections will currently not update / be removed when the morph's hierarchy position changes while the indication is active !
    let referenceMorph = this.morph;
    disconnectAll(this);
    while (referenceMorph != $world) {
      connect(referenceMorph, 'onChange', this, 'referenceMoving');
      // line below sounds good, but produces errors when the object is moved
      // connect(referenceMorph, 'onOwnerChanged', this, 'connectMorph');
      referenceMorph = referenceMorph.owner;
    }
  }

  onChange (change) {
    super.onChange(change);
    const { prop, value } = change;
    if (!this._referenceMorphMoving && prop === 'position') {
      // Unsolved problem: Don't move the comment's reference point when the referenced morph moves
      this.comment.position = this.getRelativePositionInMorph();
    }
  }

  getRelativePositionInMorph () {
    const morphOrigin = this.morph.globalPosition;
    const ownPosition = this.globalPosition;
    const xRelative = (ownPosition.x - morphOrigin.x) / this.morph.width;
    const yRelative = (ownPosition.y - morphOrigin.y) / this.morph.height;
    return pt(xRelative, yRelative);
  }

  referenceMoving () {
    this._referenceMorphMoving = true;
    this.alignWithMorph();
    this._referenceMorphMoving = false;
  }

  alignWithMorph () {
    const morphOrigin = this.morph.globalPosition;
    const xOffset = this.morph.width * this.comment.position.x;
    const yOffset = this.morph.height * this.comment.position.y;
    this.position = morphOrigin.addPt(pt(xOffset, yOffset));
  }
}
