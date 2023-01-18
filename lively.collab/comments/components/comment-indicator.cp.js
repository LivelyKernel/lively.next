import { component } from 'lively.morphic/components/core.js';
import { Color, rect } from 'lively.graphics';
import { Icon, Label } from 'lively.morphic';
import { CommentIndicatorModel } from '../comment-indicator.js';

const CommentIndicator = component({
  type: Label,
  defaultViewModel: CommentIndicatorModel,
  name: 'comment indicator',
  fontSize: 15,
  isLayoutable: false,
  nativeCursor: 'pointer',
  padding: rect(0, 2, 4, 0),
  textAndAttributes: Icon.textAttribute('comment-alt'),
  enableHalos: false
});

const ResolvedIndicator = component({
  type: Label,
  tooltip: 'A comment was placed here and resolved',
  fontColor: Color.rgb(174, 214, 241)
});

const UnresolvedIndicator = component({
  type: Label,
  tooltip: 'A comment was placed here',
  fontColor: Color.rgb(241, 196, 15)
});

export { CommentIndicator, ResolvedIndicator, UnresolvedIndicator };
