import { component } from './components/core.js';
import { pt, Color } from 'lively.graphics';
import { HorizontalLayout, Label } from 'lively.morphic';

const SystemTooltip = component({
  name: 'system/tooltip',
  borderRadius: 5,
  extent: pt(82, 26),
  fill: Color.rgba(0, 0, 0, 0.68),
  hasFixedPosition: true,
  layout: new HorizontalLayout({
    align: 'top',
    autoResize: true,
    direction: 'leftToRight',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
    spacing: 5
  }),
  position: pt(715, 460),
  reactsToPointer: false,
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    textAndAttributes: ['I am a tooltip', null]
  }]
});

export { SystemTooltip };
