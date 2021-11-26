import { component } from 'lively.morphic/components/core.js';
import { HorizontalLayout, ShadowObject, TilingLayout, VerticalLayout, Label } from 'lively.morphic';
import { Color, LinearGradient, pt } from 'lively.graphics';
import { ButtonModel, Button } from './buttons.js';
import { rect } from 'lively.graphics/geometry-2d.js';

const ButtonDefault = component({
  // do buttons really need their own viewModel? By themselves their behavior does not disupt
  // the designer's workflow (button cannot be closed, adjust their size dynamically or alter
  // an area of their submorph hierarchy that is subject to custom styling)
  // defaultViewModel: ButtonModel,
  // type: Button,
  defaultViewModel: ButtonModel, // remove this once transition is done
  name: 'default button',
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

// ButtonDark.openInWorld()
const ButtonDark = component(ButtonDefault, {
  name: 'button dark',
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(149, 165, 166) }, { offset: 1, color: Color.rgb(127, 140, 141) }], vector: rect(0, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(255,255,255),
    fontSize: 14,
    reactsToPointer: false,
    textAndAttributes: ['a button', null]
  }]
});

export { ButtonDefault, ButtonDark };
