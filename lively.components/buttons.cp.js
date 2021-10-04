import { component } from 'lively.morphic/components/core.js';
import { HorizontalLayout, ShadowObject, TilingLayout, VerticalLayout, Label } from 'lively.morphic';
import { Color, LinearGradient, pt } from 'lively.graphics';
import { ButtonModel } from './buttons.js';

const ButtonDefault = component({
  name: 'default button',
  defaultViewModel: ButtonModel,
  borderColor: Color.rgb(112, 123, 124),
  borderWidth: 1,
  borderRadius: 5,
  extent: pt(70, 25),
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.white },
      { offset: 1, color: Color.rgb(236, 240, 241) }
    ],
    vector: 0
  }),
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    wrapSubmorphs: false
  }),
  submorphs: [{
    type: Label,
    name: 'label',
    extent: pt(53, 18),
    fontColor: Color.rgb(60, 60, 60),
    fontSize: 14,
    reactsToPointer: false,
    textAndAttributes: ['a button', null]
  }]
});

export { ButtonDefault };
