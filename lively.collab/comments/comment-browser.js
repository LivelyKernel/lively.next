import { ViewModel, part } from 'lively.morphic/components/core.js';
import { pt } from 'lively.graphics';
import { defaultPropertiesPanelWidth } from 'lively.ide/studio/properties-panel.cp.js';

import { CommentGroup } from './components/comment.cp.js';
import { CommentCountBadge } from './components/comment-count-badge.cp.js';
/**
 * `commentGroups` -- an Object mapping Morphs in the world to CommentGroups listing their comments, based on their Morph ID
 */
export class CommentBrowserModel extends ViewModel {
  static get properties () {
    return {
      commentGroups: {
        defaultValue: {}
      },
      wasOpenedBefore: {
        defaultValue: false
      },
      showsResolvedComments: {
        defaultValue: false
      },
      expose: {
        get () {
          return ['onWindowClose'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'mode selector', signal: 'selectionChanged', handler: 'toggleArchive' },
            { signal: 'openInWindow', handler: 'openInWindow' }
          ];
        }
      }      
    };
  }

  openInWindow () {
    const topbar = $world.getSubmorphNamed('lively top bar');
    const margin = 25;
    const bounds = $world.visibleBoundsExcludingTopBar().insetBy(margin);
    this.view.owner.right = bounds.right();
    this.view.owner.top = bounds.top();
    // when properties panel is opened, position comment browser to the left of it
    if (topbar && topbar.activeSideBars.includes('properties panel')) {
      this.view.owner.position = this.view.owner.position.addPt(pt(-defaultPropertiesPanelWidth, 0));
    }
    this.buildCommentGroupMorphs();
    this.updateCommentCountBadge();
    this.view.owner.epiMorph = true;
  }

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

  addCommentForMorph (comment, morph) {
    console.log(`Adding a comment ${comment.text} from morph ${morph.name}`);

    if (comment.isResolved() !== this.showsResolvedComments) {
      return;
    }
    if (!this.commentGroups[morph.id]) {
      const commentGroupMorph = part(CommentGroup, { viewModel: { referenceMorph: morph } });
      this.commentGroups[morph.id] = commentGroupMorph.viewModel;
      this.ui.container.addMorph(commentGroupMorph);
    }
    this.commentGroups[morph.id].addCommentMorph(comment);
    this.updateCommentCountBadge();
  }

  /**
   * @param {Comment} - The `Comment` to be deleted
   * @param {Morph} - The `Morph` this comment was made on
   */
  removeCommentForMorph (comment, morph) {
    const groupOfCommentMorph = this.commentGroups[morph.id];
    // This can happen when deleting a morph and thus calling `emptyComments()`
    if (!groupOfCommentMorph) return;
    groupOfCommentMorph.removeCommentMorphFor(comment);
    if (groupOfCommentMorph.getCommentCount() === 0) {
      this.removeCommentGroupFor(morph.id);
    }
    this.updateCommentCountBadge(true);
  }

  removeCommentGroupFor (morphID) {
    this.commentGroups[morphID].view.remove();
    delete this.commentGroups[morphID];
  }
  
  toggleArchive () {
    this.showsResolvedComments = !this.showsResolvedComments;
    this.removeAllCommentIndicators();
    this.ui.container.submorphs = [];
    this.buildCommentGroupMorphs();
    this.updateCommentCountBadge();
  }

  updateName (morph) {
    this.commentGroups[morph.id].updateName();
  }

  getUnresolvedCommentCount () {
    let count = 0;
    $world.withAllSubmorphsDo(m => count += m.comments.filter(c => !c.resolved).length);
    return count;
  }

  /**
   * Needs to return true to indicate that the window should really be closed.
   * TODO: This could fail if a comment gets edited at the time of closing the `CommentBrowser` (lh: 2021-01-12)
   */
  onWindowClose () {
    const topbar = $world.getSubmorphNamed('lively top bar');
    if (topbar) topbar.uncolorCommentBrowserButton();
    let badge = $world.get('comment count badge');
    if (badge) badge.abandon();
    this.removeAllCommentIndicators();
    return true;
  }

  showAllCommentIndicators () {
    this.ui.container.submorphs.forEach((commentGroup) => commentGroup.viewModel.showCommentIndicators());
  }

  removeAllCommentIndicators () {
    this.ui.container.submorphs.forEach((commentGroup) => commentGroup.viewModel.removeCommentIndicators());
  }

  /**
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
      badge.viewModel.addToMorph($world.get('lively top bar').get('comment browser button'));
    }
    if (badge) {
      badge.viewModel.text = count;
      badge.tooltip = count + ' unresolved comment' + (count === 1 ? '' : 's');
    }
  }
}
