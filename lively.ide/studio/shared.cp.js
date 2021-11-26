import { component, ensureFont, without, ViewModel, part, add } from 'lively.morphic/components/core.js';
import { Label, Morph, InputLine, TilingLayout } from 'lively.morphic';
import { Color, Rectangle, pt, rect } from 'lively.graphics';
import { DarkNumberWidget } from '../value-widgets.cp.js';
import { ColorCell } from '../styling/color-stops.cp.js';
import { NumberWidget } from '../value-widgets.js';
import { DarkDropDownList, DarkList } from 'lively.components/list.cp.js';
import { signal } from 'lively.bindings';
import { CloseButton, PopupWindow, CloseButtonHovered } from '../styling/shared.cp.js';

ensureFont({
  'Material Icons': 'https://fonts.googleapis.com/icon?family=Material+Icons'
});

// DarkThemeList.openInWorld()
const DarkThemeList = component(DarkList, {
  name: 'sidebar list',
  selectionColor: Color.rgb(178, 235, 242),
  fill: Color.black.withA(0.8),
  submorphs: [
    { name: 'scroller', submorphs: [{ name: 'scrollbar', opacity: 0 }] }
  ]
});

// PropertyLabel.openInWorld()
const PropertyLabel = component({
  type: Label,
  name: 'property label',
  borderRadius: 3,
  fill: Color.rgba(229, 231, 233, 0),
  fontColor: Color.rgb(255, 255, 255),
  fontFamily: 'Material Icons',
  nativeCursor: 'pointer',
  padding: rect(6, 6, 0, 0),
  position: pt(0.8, 3.7),
  textAndAttributes: ['', {
    fontSize: 18,
    textStyleClasses: ['material-icons']
  }]
});

// PropertyLabelHovered.openInWorld()
const PropertyLabelHovered = component(PropertyLabel, {
  name: 'property label hovered',
  fill: Color.rgb(66, 73, 73)
});

// PropertyLabelActive.openInWorld()
const PropertyLabelActive = component(PropertyLabel, {
  name: 'property label active',
  fill: Color.rgb(178, 235, 242),
  fontColor: Color.rgb(65, 65, 65)
});
// this.env.fontMetric.reset()
// AddButton.openInWorld()
const AddButton = component({
  type: Label,
  name: 'add button',
  borderRadius: 3,
  fill: Color.rgba(229, 231, 233, 0),
  fontColor: Color.rgb(255, 255, 255),
  fontFamily: 'Material Icons',
  nativeCursor: 'pointer',
  padding: rect(6, 6, 0, 0),
  textAndAttributes: ['', {
    fontSize: 18,
    textStyleClasses: ['material-icons']
  }]
});

// RemoveButton.openInWorld()
const RemoveButton = component(AddButton, {
  name: 'remove button',
  textAndAttributes: ['\ue15b', {
    fontSize: 18,
    textStyleClasses: ['material-icons']
  }]
});

const EnumSelector = component(DarkDropDownList, {
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    justifySubmorphs: 'spaced',
    padding: Rectangle.inset(5, 0, 10),
    wrapSubmorphs: false
  }),
  fill: Color.rgb(66, 73, 73),
  borderWidth: 0,
  borderRadius: 2,
  extent: pt(145.7, 23.3),
  nativeCursor: 'pointer'
});

// HeadlineLabel.openInWorld()
const HeadlineLabel = component({
  type: Label,
  name: 'headline label',
  padding: rect(10, 0, -10, 0),
  fontColor: Color.rgb(255, 255, 255),
  fontWeight: 'bold',
  textAndAttributes: ['A Headling Label', null]
});

// PropLabel.openInWorld()
const PropLabel = component(HeadlineLabel, {
  name: 'prop label',
  textAndAttributes: ['Property', null],
  fontWeight: 'normal'
});

// NumberInput.openInWorld()
const NumberInput = component(DarkNumberWidget, {
  name: 'number input',
  borderRadius: 2,
  dropShadow: false,
  extent: pt(72, 22),
  floatingPoint: false,
  submorphs: [{
    name: 'value',
    fontSize: 14,
    cursorColor: Color.rgba(178, 235, 242, 0.5)
  }, {
    name: 'up',
    visible: false
  }, {
    name: 'down',
    visible: false
  }, add({
    type: Label,
    name: 'interactive label',
    padding: rect(6, 0, -6, 0),
    borderRadius: 3,
    fill: Color.rgba(229, 231, 233, 0),
    fontColor: Color.rgba(178, 235, 242, 0.4965358231707328),
    fontFamily: 'Material Icons',
    nativeCursor: 'ew-resize',
    textAndAttributes: ['\ueaab', {
      textStyleClasses: ['material-icons'],
      fontSize: 16
    }]
  }, 'value')]
});

// TextInput.openInWorld()
const TextInput = component({
  name: 'text input',
  type: InputLine,
  borderRadius: 2,
  fill: Color.rgb(66, 73, 73),
  fontColor: Color.rgb(178, 235, 242),
  fontFamily: '"IBM Plex Sans",Sans-Serif'
});

export class LabeledCheckboxMorph extends Morph {
  onMouseDown (evt) {
    super.onMouseDown(evt);
    if (evt.targetMorph.name == 'checkbox') signal(this, 'clicked');
  }

  setChecked (active) {
    const checkbox = this.getSubmorphNamed('checkbox');
    const f = checkbox.fill;
    checkbox.borderColor = active ? Color.transparent : Color.white;
    checkbox.fill = active ? f.withA(1) : f.withA(0);
    checkbox.fontColor = active ? Color.rgb(65, 65, 65) : Color.transparent;
  }
}

const LabeledCheckbox = component({
  type: LabeledCheckboxMorph,
  name: 'labeled checkbox',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(202, 31),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axisAlign: 'center',
    justifySubmorphs: 'packed',
    padding: Rectangle.inset(20, 0, 0),
    orderByIndex: true,
    wrapSubmorphs: false
  }),
  submorphs: [part(AddButton, {
    name: 'checkbox',
    borderWidth: 1,
    borderColor: Color.transparent,
    fill: Color.rgb(178, 235, 242),
    fontColor: Color.rgb(65, 65, 65),
    padding: rect(0),
    textAndAttributes: ['', {
      fontSize: 13,
      textStyleClasses: ['material-icons']
    }]
  }), part(PropLabel, {
    type: Label,
    name: 'prop label',
    textAndAttributes: ['Some label...', null]
  })]
});

const DarkCloseButton = component(CloseButton, {
  name: 'dark close button',
  fontColor: Color.rgb(255, 255, 255)
});

const DarkCloseButtonHovered = component(CloseButtonHovered, {
  name: 'dark close button hovered',
  fontColor: Color.rgb(255, 255, 255),
  fill: Color.gray.withA(0.2)
});

const BoundsContainerInactive = component({
  fill: Color.transparent,
  extent: pt(33.7, 22.7),
  borderColor: Color.transparent,
  borderWidth: 1
});

const BoundsContainerHovered = component({
  fill: Color.transparent,
  extent: pt(33.7, 22.7),
  borderColor: Color.rgb(66, 73, 73),
  borderWidth: 1,
  borderRadius: 2,
  clipMode: 'hidden'
});

// DarkPopupWindow.openInWorld()
const DarkPopupWindow = component(PopupWindow, {
  name: 'dark popup window',
  borderColor: Color.rgba(112, 123, 124, 1),
  fill: Color.rgb(66, 73, 73),
  hasFixedPosition: true,
  submorphs: [{
    name: 'header menu',
    borderColor: Color.rgbHex('616A6B'),
    reactsToPointer: false,
    submorphs: [{
      name: 'title',
      fontColor: Color.rgb(255, 255, 255)
    }, {
      name: 'close button',
      master: { auto: DarkCloseButton, hover: DarkCloseButtonHovered },
      fontColor: Color.rgb(255, 255, 255)
    }]
  }]
});

const DarkFlap = component(DarkPopupWindow, {
  name: 'dark flap',
  submorphs: [
    without('header menu')
  ]
});

export { AddButton, RemoveButton, HeadlineLabel, PropLabel, NumberInput, TextInput, EnumSelector, PropertyLabel, PropertyLabelHovered, PropertyLabelActive, DarkThemeList, LabeledCheckbox, DarkFlap, DarkPopupWindow, DarkCloseButton, DarkCloseButtonHovered, BoundsContainerInactive, BoundsContainerHovered };
