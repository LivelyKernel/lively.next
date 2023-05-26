import { Label, ViewModel, HTMLMorph, Morph, TilingLayout, component, without, part, add } from 'lively.morphic';
import { DarkDropDownList, DarkList } from 'lively.components/list.cp.js';
import { signal } from 'lively.bindings';
import { Color, Rectangle, pt, rect } from 'lively.graphics';
import { DarkNumberWidget, NumberWidgetModel } from '../value-widgets.cp.js';
import { CloseButton, PopupWindow, CloseButtonHovered } from '../styling/shared.cp.js';
import { InputLine } from 'lively.components/inputs.js';

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
  padding: {
    value: rect(6, 6, 0, 0),
    onlyAtInstantiation: true
  },
  textAndAttributes: ['', {
    fontSize: 18,
    fontFamily: 'Material Icons'
  }]
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
  borderRadius: 2,
  dropShadow: false,
  extent: pt(72, 22),
  floatingPoint: false,
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
  fontFamily: "IBM Plex Sans"
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

class SpinnerModel extends ViewModel {
  static get properties () {
    return {
      color: {
        defaultValue: 'white',
        type: 'Enum',
        values: ['white', 'black']
      }
    };
  }

  viewDidLoad () {
    const node = this.view.domNode.querySelector('.spinner');
    if (this.color === 'black') node.classList.add('black-spinner');
  }
}

// part(Spinner, {viewModel: { color: 'black'}}).openInWorld();
const Spinner = component({
  type: HTMLMorph,
  defaultViewModel: SpinnerModel,
  name: 'spinner',
  extent: pt(86.2, 70.2),
  fill: Color.rgba(255, 255, 255, 0),
  html: '<div class="spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>',
  scale: 0.3244543390629232
});

export { AddButton, RemoveButton, HeadlineLabel, PropLabel, DarkNumberIconWidget, TextInput, EnumSelector, PropertyLabel, PropertyLabelLight, PropertyLabelHovered, PropertyLabelHoveredLight, PropertyLabelActive, PropertyLabelActiveLight, DarkThemeList, DarkFlap, DarkPopupWindow, DarkCloseButton, DarkCloseButtonHovered, BoundsContainerInactive, BoundsContainerHovered, Spinner };
