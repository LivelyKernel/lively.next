import { component } from 'lively.morphic/components/core.js';
import { Color, Rectangle } from 'lively.graphics';
import { TilingLayout, ShadowObject, Ellipse, Label, part } from 'lively.morphic';
import { CommentCountBadgeModel } from '../comment-count-badge.js';

const CommentCountBadge = component({
  name: 'comment count badge',
  defaultViewModel: CommentCountBadgeModel,
  fill: Color.rgb(255, 23, 68),
  borderRadius: 50,
  hasFixedPosition: true,
  layout: new TilingLayout({
    hugContentsVertically: true,
    hugContentsHorizontally: true,
    padding: Rectangle.inset(5, 0, 5, 0)
  }),
  dropShadow: new ShadowObject({ distance: 0, blur: 2 }),
  submorphs: [{
    type: Label,
    name: 'badge label',
    fontColor: Color.rgb(255, 255, 255),
    textAndAttributes: ['10', null]
  }],
  tooltip: '10 unresolved comment',
  epiMorph: true
});

export { CommentCountBadge };
