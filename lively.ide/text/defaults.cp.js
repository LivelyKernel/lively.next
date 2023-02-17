import { component, Text } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';

export const BlackOnWhite = component({
  type: Text,
  fixedWidth: true,
  fixedHeight: true,
  extent: pt(415, 300),
  fill: Color.white,
  clipMode: 'auto'
});
