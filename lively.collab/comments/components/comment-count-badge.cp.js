import { component } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics';
import { TilingLayout, Ellipse, Label } from 'lively.morphic';
import { CommentCountBadgeModel } from '../comment-count-badge.js';

// part(CommentCountBadge).openInWorld();
const CommentCountBadge = component({
  name: 'comment count badge',
  type: Ellipse,
  defaultViewModel: CommentCountBadgeModel,
  fill: Color.rgb(255, 23, 68),
  layout: new TilingLayout({
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    wrapSubmorphs: false,
    padding: 4
  }),
  submorphs: [{
    type: Label,
    name: 'badge label',
    fontColor: Color.rgb(255, 255, 255),
    textAndAttributes: [10, null]
  }],
  tooltip: '10 unresolved comment',
  epiMorph: true
});

export { CommentCountBadge };
