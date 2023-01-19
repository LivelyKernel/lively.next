import { Color, pt } from 'lively.graphics';
import { Polygon, TilingLayout, Label, Icon, ShadowObject, component } from 'lively.morphic';
import { Button } from 'lively.components';

const PopupLight = component({
  name: 'popup/light',
  borderRadius: 4,
  fill: Color.rgba(0, 0, 0, 0),
  hasFixedPosition: true,
  isLayoutable: false,
  position: pt(204.6, 371.2),
  renderOnGPU: true,
  submorphs: [{
    type: Polygon,
    name: 'arrow',
    borderColor: Color.rgba(0, 0, 0, 0),
    dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.4), blur: 3 }),
    extent: pt(20, 15),
    fill: Color.rgb(230, 230, 230),
    position: pt(-10, 0),
    vertices: [({ position: pt(0, 15), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(10, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(20, 15), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    name: 'body',
    borderRadius: 4,
    clipMode: 'hidden',
    dropShadow: new ShadowObject({ distance: 18, color: Color.rgba(0, 0, 0, 0.2), blur: 30 }),
    extent: pt(153, 95),
    fill: Color.rgb(230, 230, 230),
    layout: new TilingLayout({
      axis: 'column',
      orderByIndex: true,
    }),
    position: pt(-76.5, 15)
  }, {
    type: Button,
    name: 'close button',
    borderColor: Color.rgba(0, 0, 0, 0),
    extent: pt(28, 23),
    fill: null,
    label: Icon.textAttribute('times-circle'),
    position: pt(56.5, 7),
    submorphs: [{
      type: Label,
      name: 'label',
      fontSize: 18,
      position: pt(5, 2),
      reactsToPointer: false,
      textAndAttributes: Icon.textAttribute('times-circle')
    }],
    tooltip: 'close'
  }]
});

export { PopupLight };
