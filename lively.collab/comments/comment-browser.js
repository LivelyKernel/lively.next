import { ViewModel, part } from 'lively.morphic/components/core.js';
import { pt } from 'lively.graphics';
import { defaultPropertiesPanelWidth } from 'lively.ide/studio/properties-panel.cp.js';

import { CommentGroup } from './components/comment.cp.js';
import { CommentCountBadge } from './components/comment-count-badge.cp.js';

export class CommentBrowserModel extends ViewModel {
  static get properties () {
    return {
      commentGroups: {
        defaultValue: {},
        doc: 'An Object mapping Morphs in the world to CommentGroups listing their comments, based on their Morph ID. Use for the grouping in the view.'
      },
      showsResolvedComments: {
        defaultValue: false,
        doc: 'Whether currently the resolved or unresolved comments are displayed.'
      },
      expose: {
        get () {
          return ['onWindowClose', 'addCommentForMorph', 'removeCommentForMorph', 'removeAllCommentIndicators', 'showAllCommentIndicators', 'updateName'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'mode selector', signal: 'selectionChanged', handler: 'toggleArchive' },
            { signal: 'openInWindow', handler: 'openInWindow' }
          ];
        }
      }
    };
  }

  /**
   * Called when the view gets opened inside a Window (via a binding). @see `lively.morphic` for more info on `openInWindow`.
   * This method also takes care of initializing/building the visual representation of the currently existing comments.
   * Thus, this is the only supported way of opening a Comment Browser.
   */
  openInWindow () {
    const margin = 25;
    const bounds = $world.visibleBoundsExcludingTopBar().insetBy(margin);
    const win = this.view.getWindow();
    win.right = bounds.right();
    win.top = bounds.top();
    // when properties panel is opened, position comment browser to the left of it
    if ($world.activeSideBars.includes('properties panel')) {
      win.position = win.position.addPt(pt(-defaultPropertiesPanelWidth, 0));
    }
    this.buildCommentGroupMorphs();
    this.updateCommentCountBadge();
    win.epiMorph = true;
  }

  /**
   * Adds visual representations for all comments on all morphs that currently exist in the world.
   */
  buildCommentGroupMorphs () {
    this.commentGroups = {};
    $world.withAllSubmorphsDo((morph) => {
      if (morph.comments.length === 0) {
        return;
      }
      for (const comment of morph.comments) {
        this.addCommentForMorph(comment, morph);
      }
    });
  }

  /**
   * Adds the visual representation for a specific `comment` on a specific `morph`.
   * This method takes care of the correct per morph grouping of the visual representations.
   * @param {CommentData} comment
   * @param {Morph} morph
   */
  addCommentForMorph (comment, morph) {
    if (comment.isResolved() !== this.showsResolvedComments) {
      return;
    }
    if (!this.commentGroups[morph.id]) {
      const commentGroupMorph = part(CommentGroup, { viewModel: { referenceMorph: morph } });
      this.commentGroups[morph.id] = commentGroupMorph;
      this.ui.container.addMorph(commentGroupMorph);
    }
    this.commentGroups[morph.id].addCommentMorph(comment);
    this.updateCommentCountBadge();
  }

  /**
   * Removes the visual representation of `comment` on `morph`.
   * Takes care of cleaning up empty comment group visualization when necessary.
   * @param {CommentData} - The `Comment` to be deleted
   * @param {Morph} - The `Morph` this comment was made on
   * @param {boolean} forResolve - Whether the comment gets removed due to being resolved or not (thus due to being deleted)
   */
  removeCommentForMorph (comment, morph, forResolve = false) {
    const groupOfCommentMorph = this.commentGroups[morph.id];
    // This can happen when deleting a morph and thus calling `emptyComments()`
    if (!groupOfCommentMorph) return;
    groupOfCommentMorph.removeCommentMorphFor(comment);
    if (groupOfCommentMorph.getCommentCount() === 0) {
      this.removeCommentGroupFor(morph.id);
    }
    this.updateCommentCountBadge(!forResolve);
  }

  /**
   * Removes the CommentGroup that is collecting the comments for a Morph with `morphID`.
   * @param {UUID} morphID
   */
  removeCommentGroupFor (morphID) {
    this.commentGroups[morphID].remove();
    delete this.commentGroups[morphID];
  }

  /**
   * Toggles the browser between showing unresolved and resolved comments.
   */
  toggleArchive () {
    this.showsResolvedComments = !this.showsResolvedComments;
    this.removeAllCommentIndicators();
    this.ui.container.submorphs = [];
    this.buildCommentGroupMorphs();
    this.updateCommentCountBadge();
  }

  /**
   * Can be called to update the name that is displayed in `morph`s comment group when `morph`s name has changed.
   * @param {Morph} morph
   */
  updateName (morph) {
    this.commentGroups[morph.id].updateName();
  }

  /**
   * @returns {Number} The number of currently existing unresolved comments on all morphs in the world.
   */
  getUnresolvedCommentCount () {
    let count = 0;
    for (const commentArray of $world.morphCommentMap.values()) {
      commentArray.forEach(comment => {
        if (!comment.resolved) count++;
      });
    }
    return count;
  }

  /**
   * Checks whether the comment browser can currently be closed (is prohibited when a comment is being edited).
   * If the browser is allowed to be closed, this method takes care of cleaning up comment indicators, etc.
   * @returns {Boolean} Whether or not the window should actually be closed
   */
  onWindowClose () {
    let earlyReturn = false;
    this.view.withAllSubmorphsDo(m => {
      if (m.isComment) {
        earlyReturn = m.prohibitsClosing() || earlyReturn;
      }
    });
    if (earlyReturn) return false;
    let badge = $world.get('comment count badge');
    if (badge) badge.abandon();
    this.removeAllCommentIndicators();
    return true;
  }

  /**
   * Makes comment indicators visible.
   */
  showAllCommentIndicators () {
    this.ui.container.submorphs.forEach((commentGroup) => commentGroup.showCommentIndicators());
  }

  /**
   * Removes all comment indicators from the world.
   */
  removeAllCommentIndicators () {
    this.ui.container.submorphs.forEach((commentGroup) => commentGroup.removeCommentIndicators());
  }

  /**
   * Takes care of displaying the correct number of currently existing unresolved comments in the top bar badge when it changes.
   * @param {boolean} decreasing - Wether or not we call this function while
   * removing a comment. In this case, we need to adjust for the removal of the
   * comment when counting the overall comments, since this method gets called
   * before we can remove the actual comment object on the morph.
   */
  updateCommentCountBadge (decreasing) {
    const count = this.getUnresolvedCommentCount() - (decreasing ? 1 : 0);

    let badge = $world.get('comment count badge');
    const topbar = $world.get('lively top bar');
    if (!topbar) return;
    if (badge) {
      if (count <= 0) {
        badge.abandon();
        return;
      }
    } else if (count > 0) {
      badge = part(CommentCountBadge);
      badge.addToMorph($world.get('lively top bar').get('comment browser button'));
    }
    if (badge) {
      badge.text = count;
      badge.tooltip = count + ' unresolved comment' + (count === 1 ? '' : 's');
    }
  }
}
