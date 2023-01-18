import { HTMLMorph, TilingLayout, Label, ShadowObject, component, ensureFont, part } from 'lively.morphic';
import { Color, LinearGradient, pt, rect } from 'lively.graphics';
import { DefaultList } from 'lively.components/list.cp.js';

ensureFont({
  'Material Icons': 'https://fonts.googleapis.com/icon?family=Material+Icons'
});

// CloseButtonDefault.openInWorld()
const CloseButtonDefault = component({
  type: Label,
  name: 'close button default',
  borderRadius: 3,
  fill: Color.rgba(229, 231, 233, 0),
  fontColor: Color.rgb(66, 73, 73),
  fontFamily: 'Material Icons',
  fontSize: 25,
  nativeCursor: 'pointer',
  padding: rect(4, 4, 0, 0),
  epiMorph: true,
  tooltip: 'Close Window',
  lineHeight: 1,
  textAndAttributes: ['', {
    textStyleClasses: ['material-icons']
  }]
});

const CloseButtonHovered = component(CloseButtonDefault, { name: 'close button hovered', fill: Color.gray });

const CloseButton = component(CloseButtonDefault, {
  name: 'close button',
  master: { hover: CloseButtonHovered }
});

const DarkCloseButtonHovered = component(CloseButtonDefault, {
  name: 'close button hovered',
  fill: Color.rgb(66, 73, 73)
});

const DarkCloseButton = component(CloseButtonDefault, {
  name: 'close button',
  master: { hover: DarkCloseButtonHovered }
});

const CheckerPattern = component({
  type: HTMLMorph,
  name: 'checker pattern',
  borderColor: Color.rgb(203, 203, 203),
  clipMode: 'hidden',
  cssDeclaration: '.checkerboard {\n\
  width: 100%;\n\
  height: 100%;\n\
  background-image: linear-gradient(45deg, #bdc3c7 25%, transparent 25%), linear-gradient(-45deg, #bdc3c7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #bdc3c7 75%), linear-gradient(-45deg, transparent 75%, #bdc3c7 75%);\n\
  background-size: 6px 6px;\n\
  background-position: 0 0, 0 3px, 3px -3px, -3px 0px;\n\
}',

  fill: Color.rgba(0, 0, 0, 0),
  html: '<div class="checkerboard"></div>',
  reactsToPointer: false
});

// PopupWindow.openInWorld()
const PopupWindow = component({
  name: 'popup window',
  borderColor: Color.rgb(149, 165, 166),
  borderRadius: 3,
  borderWidth: 1,
  clipMode: 'hidden',
  draggable: true,
  dropShadow: new ShadowObject({ rotation: 34, color: Color.rgba(0, 0, 0, 0.16), blur: 12 }),
  extent: pt(241, 547),
  fill: Color.white,
  hasFixedPosition: true,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    hugContentsVertically: true,
    hugContentsHorizontally: true
  }),
  nativeCursor: 'grab',
  styleClasses: ['Popups'],
  submorphs: [{
    name: 'header menu',
    epiMorph: true,
    borderWidth: { top: 0, left: 0, right: 0, bottom: 1 },
    borderColor: Color.rgb(215, 219, 221),
    extent: pt(241, 40.5),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      axisAlign: 'center',
      align: 'right',
      orderByIndex: true,
      padding: rect(5, 0, 0, 0),
      justifySubmorphs: 'spaced'
    }),
    reactsToPointer: false,
    submorphs: [
      {
        type: Label,
        name: 'title',
        epiMorph: true,
        padding: rect(10, 0, -10, 0),
        fontWeight: 'bold',
        textString: 'Window title',
        fontColor: { value: Color.black, onlyAtInstantiation: true }
      },
      part(CloseButton, { name: 'close button' })
    ]
  }]
});

const SystemList = component(DefaultList, {
  name: 'system list',
  borderColor: Color.rgb(149, 165, 166),
  borderRadius: 3,
  dropShadow: new ShadowObject({ distance: 1, color: Color.rgba(0, 0, 0, 0.26) }),
  fill: Color.rgba(255, 255, 255, 0.9),
  itemHeight: 20,
  itemPadding: rect(3, 2, -2, -1),
  manualItemHeight: true,
  padding: rect(2, 2, 0, 0),
  position: pt(1811.5, 370.6),
  itemBorderRadius: 2,
  selectionColor: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(66, 165, 245) }, { offset: 1, color: Color.rgb(41, 121, 255) }], vector: rect(0, 0, 0, 1) })
});
// SystemList.openInWorld()
// part(SystemList, { items: [1,2,3]}).openInWorld()

export { CheckerPattern, SystemList, PopupWindow, CloseButton, DarkCloseButton, CloseButtonDefault, CloseButtonHovered };
