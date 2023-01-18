import { pt } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { ViewModel } from 'lively.morphic/components/core.js';
import { UnresolvedIndicator, ResolvedIndicator } from './components/comment-indicator.cp.js';

export class CommentIndicatorModel extends ViewModel {
  static get properties () {
    return {
      comment: { },
      referenceMorph: { },
      commentMorph: { },
      bindings: {
        get () {
          return [
            {
              signal: 'onMouseDown',
              handler: 'onMouseDown'
            },
            {
              signal: 'onChange', handler: 'onChange'
            },
            { signal: 'abandon', handler: 'abandon' }];
        }
      },
      isEpiMorph: { get () { return true; } },
      expose: {
        get () {
          return ['isCommentIndicator', 'isEpiMorph'];
        }
      }
    };
  }

  get isCommentIndicator () {
    return true;
  }

  viewDidLoad () {
    this.view.master = this.comment.isResolved() ? ResolvedIndicator : UnresolvedIndicator;
    this.connectMorphs();
    this.alignWithMorph();
  }

  /**
   * Comment indicators should move together with the morphs they have been made on, as they have a position relative to the morph but are not implemented as submorphs.
   */
  connectMorphs () {
    // When the morph that has the comment is a child in a hierarchy, it does not generate 'onChange' Events when the morphs that are higher in the hierarchy are moved.
    // Therefore we need to connect the indication with all morphs higher in the hierarchy.
    let referenceMorph = this.referenceMorph;
    while (referenceMorph && referenceMorph !== $world) {
      connect(referenceMorph, 'onChange', this, 'referenceMoving', { garbageCollect: true });
      connect(referenceMorph, 'onOwnerChanged', this, 'connectMorphs', { garbageCollect: true });
      referenceMorph = referenceMorph.owner;
    }
  }

  /**
   * @see `lively.morphic/morph.js`
   * When the indicator itself is being moved, we update the relative position of the comment it represents.
   */
  onChange (change) {
    const { prop } = change;
    if (this.referenceMorph && !this._referenceMorphMoving && prop === 'position') {
      // Unsolved problem: Don't move the comment's reference point when the referenced morph moves (not a problem for now)
      this.comment.position = this.getRelativePositionInMorph();
    }
  }

  getRelativePositionInMorph () {
    const morphOrigin = this.referenceMorph.globalPosition;
    const ownPosition = this.view.globalPosition;
    const xRelative = (ownPosition.x - morphOrigin.x) / this.referenceMorph.width;
    const yRelative = (ownPosition.y - morphOrigin.y) / this.referenceMorph.height;
    return pt(xRelative, yRelative);
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
    this.view.position = morphOrigin.addPt(pt(xOffset, yOffset));
    // fixme (lh 2022-01-14): this is a dirty trick to bring the indicator back into visibility when changing the morph hierarchy
    // there ought to be a nicer solution to this
    this.view.bringToFront();
  }

  abandon () {
    let referenceMorph = this.referenceMorph;
    while (referenceMorph && referenceMorph !== $world) {
      referenceMorph.attributeConnections.forEach(connection => {
        if (connection.targetObj === this) {
          connection.disconnect();
        }
      });
      referenceMorph = referenceMorph.owner;
    }
    this.view.remove();
  }

  canBeCopied () {
    return false;
  }

  onMouseDown () {
    this.commentMorph.view.show();
  }
}
