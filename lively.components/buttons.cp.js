import { TilingLayout, ShadowObject, Label, component } from 'lively.morphic';
import { Color, LinearGradient, pt } from 'lively.graphics';
import { ButtonModel } from './buttons.js';
import { rect } from 'lively.graphics/geometry-2d.js';

const ButtonDefault = component({
  // do buttons really need their own viewModel? By themselves their behavior does not disupt
  // the designer's workflow (button cannot be closed, adjust their size dynamically or alter
  // an area of their submorph hierarchy that is subject to custom styling)
  // defaultViewModel: ButtonModel,
  // type: Button,
  defaultViewModel: ButtonModel, // remove this once transition is done
  name: 'button/default',
  borderColor: Color.rgb(112, 123, 124),
  nativeCursor: 'pointer',
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
    fontColor: Color.rgb(52, 73, 94),
    fontSize: 14,
    reactsToPointer: false,
    textAndAttributes: ['a button', null]
  }]
});

// ButtonClicked.openInWorld()
const ButtonClicked = component(ButtonDefault, {
  name: 'button/clicked',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 0, rotation: 0, color: Color.rgba(0, 0, 0, 0.39071265243902487), inset: true, blur: 4, spread: 1 }),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(199, 199, 199) }, { offset: 1, color: Color.rgb(152, 152, 152) }], vector: rect(0, 0, 0, 1) })
});

// SystemButton.openInWorld()
const SystemButton = component(ButtonDefault, {
  name: 'system button',
  master: { auto: ButtonDefault, click: ButtonClicked }
});

// ButtonDark.openInWorld()
const ButtonDarkDefault = component(ButtonDefault, {
  name: 'button/dark/default',
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(149, 165, 166) }, { offset: 1, color: Color.rgb(127, 140, 141) }], vector: rect(0, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(255, 255, 255),
    fontSize: 14,
    reactsToPointer: false,
    textAndAttributes: ['a button', null]
  }]
});

// ButtonDarkClicked.openInWorld()
const ButtonDarkClicked = component(ButtonDarkDefault, {
  name: 'button/dark/clicked',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 0, rotation: 0, color: Color.rgba(0, 0, 0, 0.39071265243902487), inset: true, blur: 4, spread: 1 })
});

// SystemButtonDark.openInWorld()
const SystemButtonDark = component(ButtonDarkDefault, {
  name: 'system button/dark',
  master: { auto: ButtonDarkDefault, click: ButtonDarkClicked }
});

const DarkButton = component(ButtonDefault, {
  name: 'dark button',
  borderWidth: 0,
  fill: Color.rgba(0, 0, 0, 0.75),
  submorphs: [{
    name: 'label',
    fontSize: 9,
    fontColor: Color.rgb(255, 255, 255)
  }]
});

export { ButtonDefault, ButtonClicked, SystemButton, ButtonDarkDefault, SystemButtonDark, ButtonDarkClicked, DarkButton };
