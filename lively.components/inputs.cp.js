import { Text, TilingLayout, InputLine, Icon, ShadowObject, Label, component } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { LabeledCheckBoxModel, CheckBoxMorph, SearchFieldModel } from './inputs.js';

// InputLineDefault.openInWorld()
const InputLineDefault = component({
  type: InputLine,
  name: 'input line light',
  highlightWhenFocused: true,
  borderColor: Color.rgb(204, 204, 204),
  borderRadius: 4,
  dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
  haloShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
  extent: pt(318.1, 34.3),
  fontFamily: 'IBM Plex Sans',
  fontSize: 20,
  padding: rect(10, 3, 0, 0),
  placeholder: 'Name',
  fill: Color.white,
  submorphs: [{
    type: Label,
    name: 'placeholder',
    fontColor: Color.rgb(204, 204, 204),
    fontFamily: 'IBM Plex Sans',
    fontSize: 20,
    padding: rect(10, 3, 0, 0),
    reactsToPointer: false,
    textAndAttributes: ['Name', null]
  }]
});

// InputLineDark.openInWorld()
const InputLineDark = component(InputLineDefault, {
  name: 'input line dark',
  fill: Color.rgb(229, 231, 233)
});

const LabeledCheckBox = component({
  defaultViewModel: LabeledCheckBoxModel,
  name: 'labeled check box',
  extent: pt(66, 21),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axis: 'row',
    wrapSubmorphs: false,
    align: 'top',
    direction: 'leftToRight'
  }),
  submorphs: [{
    type: CheckBoxMorph,
    name: 'checkbox'
  }, {
    type: Label,
    name: 'label',
    extent: pt(51, 21),
    nativeCursor: 'pointer',
    padding: rect(10, 3, -5, 0),
    value: 'a label'
  }]
});
// part(SearchField).openInWorld()
const SearchField = component({
  defaultViewModel: SearchFieldModel,
  name: 'search field container',
  extent: pt(188, 21),
  fixedHeight: true,
  fontColor: Color.rgb(204, 204, 204),
  layout: new TilingLayout({
    axis: 'column',
    align: 'right',
    axisAlign: 'right',
    orderByIndex: true,
    reactToSubmorphAnimations: false
  }),
  fill: Color.transparent,
  reactsToPointer: false,
  submorphs: [
    {
      type: Text,
      readOnly: false,
      fill: Color.white,
      name: 'search field',
      fontFamily: 'IBM Plex Sans',
      styleClasses: ['idle'],
      borderRadius: 15,
      borderWidth: 1,
      clipMode: 'hidden',
      dropShadow: new ShadowObject({ distance: 0, color: Color.rgb(52, 152, 219), blur: 0 }),
      extent: pt(188, 21),
      fixedHeight: true,
      fontColor: Color.rgb(204, 204, 204),
      padding: rect(6, 3, 0, 0),
      submorphs: [
        {
          type: Label,
          name: 'placeholder',
          visible: true,
          opacity: 0.3,
          padding: rect(6, 4, 0, 0),
          reactsToPointer: false,
          textAndAttributes: ['Search', null]
        }
      ]
    }, {
      type: Label,
      name: 'placeholder icon',
      autofit: false,
      padding: 2,
      position: pt(165, 0),
      fontColor: Color.rgb(204, 204, 204),
      fontSize: 14,
      nativeCursor: 'pointer',
      textAndAttributes: Icon.textAttribute('times-circle'),
      visible: false
    }
  ]
});

export { LabeledCheckBox, SearchField, InputLineDefault, InputLineDark };
