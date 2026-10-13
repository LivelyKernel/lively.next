import { Label, ViewModel, HTMLMorph, Morph, TilingLayout, component, without, part, add, ShadowObject } from 'lively.morphic';
import { DarkDropDownList, DarkList } from 'lively.components/list.cp.js';
import { signal } from 'lively.bindings';
import { Color, Rectangle, pt, rect, LinearGradient } from 'lively.graphics';
import { DarkNumberWidget, NumberWidgetModel } from '../value-widgets.cp.js';
import { CloseButton, PopupWindow, CloseButtonHovered } from '../styling/shared.cp.js';
import { InputLine } from 'lively.components/inputs.js';
import { Spinner } from 'lively.components/loading-indicator.cp.js';
import { ButtonDefault } from 'lively.components/buttons.cp.js';

const DarkThemeList = component(DarkList, {
  name: 'sidebar list',
  selectionColor: Color.rgb(178, 235, 242),
  fill: Color.black.withA(0.8),
  submorphs: [
    { name: 'scroller', submorphs: [{ name: 'scrollbar', opacity: 0 }] }
  ]
});

const PropertyLabel = component({
  type: Label,
  name: 'property label',
  borderRadius: 3,
  fill: Color.rgba(229, 231, 233, 0),
  fontColor: Color.rgb(255, 255, 255),
  fontFamily: 'Material Icons',
  nativeCursor: 'pointer',
  padding: rect(6, 6, 0, 0),
  textAndAttributes: ['', {
    fontSize: 18,
    fontFamily: 'Material Icons'
  }]
});

export const PropertyLabelDisabled = component(PropertyLabel, {
  nativeCursor: 'not-allowed',
  opacity: 0.5
});

const PropertyLabelLight = component(PropertyLabel, {
  fontColor: Color.darkGray
});

const PropertyLabelHovered = component(PropertyLabel, {
  name: 'property label hovered',
  fill: Color.rgb(66, 73, 73)
});

const PropertyLabelHoveredLight = component(PropertyLabel, {
  name: 'property label hovered',
  fill: Color.rgba(192, 192, 192, 0.7829)
});

const PropertyLabelActive = component(PropertyLabel, {
  name: 'property label active',
  fill: Color.rgb(178, 235, 242),
  fontColor: Color.rgb(65, 65, 65)
});

const PropertyLabelActiveLight = component(PropertyLabel, {
  fontColor: Color.white,
  fill: Color.rgb(3, 169, 244)
});

const AddButtonAuto = component({
  type: Label,
  name: 'add button',
  borderRadius: 3,
  fill: Color.rgba(229, 231, 233, 0),
  fontColor: Color.rgb(255, 255, 255),
  fontFamily: 'Material Icons',
  nativeCursor: 'pointer',
  padding: rect(6, 6, 0, 0),
  lineHeight: 1,
  textAndAttributes: ['', {
    fontSize: 18,
    fontFamily: 'Material Icons'
  }]
});

const AddButtonHovered = component(AddButtonAuto, {
  fill: Color.rgba(229, 231, 233, 0.35)
});

const AddButton = component(AddButtonAuto, {
  master: { hover: AddButtonHovered }
});

const RemoveButton = component(AddButton, {
  name: 'remove button',
  textAndAttributes: ['\ue15b', {
    fontSize: 18,
    fontFamily: 'Material Icons'
  }]
});

const EnumSelectorDefault = component(DarkDropDownList, {
  name: 'enum selector/default',
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    justifySubmorphs: 'spaced',
    padding: Rectangle.inset(5, 0, 10)
  }),
  fill: Color.rgb(66, 73, 73),
  borderWidth: 0,
  borderRadius: 2,
  extent: pt(145.7, 23.3),
  nativeCursor: 'pointer'
});

const EnumSelectorClicked = component(EnumSelectorDefault, {
  name: 'enum selector/clicked',
  fill: Color.rgba(54, 61, 61, 1)
});

const EnumSelector = component(EnumSelectorDefault, {
  name: 'enum selector',
  master: { click: EnumSelectorClicked }
});

const HeadlineLabel = component({
  type: Label,
  name: 'headline label',
  padding: rect(10, 0, -10, 0),
  fontColor: Color.rgb(255, 255, 255),
  fontWeight: 'bold',
  textAndAttributes: ['A Headling Label', null]
});

const PropLabel = component(HeadlineLabel, {
  name: 'prop label',
  textAndAttributes: ['Property', null],
  fontWeight: 'normal'
});

class DarkNumberIconWidgetModel extends NumberWidgetModel {
  static get properties () {
    return {
      spaceToDisplay: {
        get () {
          return this.view.width - (this.ui.interactiveLabel?.right || 0);
        }
      }
    };
  }

  get expose () {
    return ['enable', 'disable'].concat(super.expose);
  }

  disable () {
    this.view.nativeCursor = 'not-allowed';

    this.ui.value.reactsToPointer = false;
    this.ui.interactiveLabel.reactsToPointer = false;

    this.ui.value.opacity = 0.3;
  }

  enable () {
    this.view.nativeCursor = 'auto';

    this.ui.value.reactsToPointer = true;
    this.ui.interactiveLabel.reactsToPointer = true;

    this.ui.value.opacity = 1;
  }
}

const DarkNumberIconWidget = component(DarkNumberWidget, {
  name: 'number input',
  defaultViewModel: DarkNumberIconWidgetModel,
  layout: new TilingLayout({
    align: 'right',
    axisAlign: 'center',
    justifySubmorphs: 'spaced',
    padding: rect(0, 0, 5, 0)
  }),
  borderRadius: 2,
  dropShadow: false,
  extent: pt(72, 22),
  viewModel: {
    floatingPoint: false
  },
  submorphs: [add({
    type: Label,
    name: 'interactive label',
    padding: rect(6, 0, -6, 0),
    borderRadius: 3,
    fill: Color.rgba(229, 231, 233, 0),
    fontColor: Color.rgba(178, 235, 242, 0.4965358231707328),
    fontFamily: 'Material Icons',
    nativeCursor: 'ew-resize',
    textAndAttributes: ['\ueaab', {
      fontFamily: 'Material Icons',
      fontSize: 16
    }]
  }, 'value'), without('button holder')]
});

const TextInput = component({
  name: 'text input',
  type: InputLine,
  borderRadius: 2,
  fill: Color.rgb(66, 73, 73),
  fontColor: Color.rgb(178, 235, 242),
  fontFamily: 'IBM Plex Sans'
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
  borderColor: Color.transparent,
  borderWidth: 1
});

const BoundsContainerHovered = component({
  fill: Color.transparent,
  borderColor: Color.rgb(66, 73, 73),
  borderWidth: 1,
  borderRadius: 2,
  clipMode: 'hidden'
});

const DarkPopupWindow = component(PopupWindow, {
  name: 'dark popup window',
  borderColor: Color.rgba(112, 123, 124, 1),
  fill: Color.rgb(32, 32, 32),
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
      master: { auto: DarkCloseButton, hover: DarkCloseButtonHovered }
    }]
  }]
});

const DarkFlap = component(DarkPopupWindow, {
  name: 'dark flap',
  submorphs: [
    without('header menu')
  ]
});

export { AddButton, RemoveButton, HeadlineLabel, PropLabel, DarkNumberIconWidget, TextInput, EnumSelector, PropertyLabel, PropertyLabelLight, PropertyLabelHovered, PropertyLabelHoveredLight, PropertyLabelActive, PropertyLabelActiveLight, DarkThemeList, DarkFlap, DarkPopupWindow, DarkCloseButton, DarkCloseButtonHovered, BoundsContainerInactive, BoundsContainerHovered, Spinner };

export const FileStatusDefault = component({
  name: 'file status default',
  borderColor: Color.rgb(44, 62, 80),
  borderRadius: 5,
  borderWidth: 1,
  dropShadow: new ShadowObject({ distance: 0, color: Color.rgba(0, 0, 0, 0.5) }),
  extent: pt(176.3, 35.3),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(44, 62, 80, 0.9) }, { offset: 1, color: Color.rgba(33, 47, 60, 0.9) }], vector: rect(0.5, 0, 0, 1) })
});

export const FileStatusError = component(FileStatusDefault, {
  name: 'file status error',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(231, 76, 60) },
      { offset: 1, color: Color.rgb(192, 57, 43) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

export const FileStatusSaved = component(FileStatusDefault, {
  name: 'file status saved',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(46, 204, 113) },
      { offset: 1, color: Color.rgb(39, 174, 96) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

export const FileStatusInactive = component(FileStatusDefault, {
  name: 'file status inactive',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(128, 139, 150) },
      { offset: 1, color: Color.rgb(93, 109, 126) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

export const FileStatusWarning = component(FileStatusDefault, {
  name: 'file status warning',
  borderColor: Color.rgbHex('DA9819'),
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(249, 213, 68) },
      { offset: 1, color: Color.rgb(219, 162, 18) }
    ],
    vector: rect(0.5, 1, 0, 1)
  })
});

export const BackendButtonDefault = component(ButtonDefault, {
  name: 'backend button default',
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    padding: rect(5, 0, 0, 0)
  }),
  borderColor: Color.rgb(44, 62, 80),
  extent: pt(130.3, 26.1),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(44, 62, 80, 0.9) }, { offset: 1, color: Color.rgba(33, 47, 60, 0.9) }], vector: rect(0.5, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(163, 228, 215),
    fontFamily: '"IBM Plex Mono"',
    fontSize: 14
  }]
});

export const BackendButtonClicked = component(BackendButtonDefault, {
  name: 'backend button clicked',
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(33, 48, 63) }, { offset: 1, color: Color.rgb(33, 47, 60) }], vector: rect(0.5, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(63, 110, 101),
    fontFamily: '"IBM Plex Mono"',
    fontSize: 14
  }]
});
