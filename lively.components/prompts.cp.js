import { component, add, part } from 'lively.morphic/components/core.js';
import { Button, List, FilterableList, RadioButtonGroup } from 'lively.components';
import { ShadowObject, TilingLayout, InputLine, PasswordInputLine, Ellipse, HorizontalLayout, Text, VerticalLayout, Icon, Label } from 'lively.morphic';
import { Color, rect, pt } from 'lively.graphics';
import { ButtonDefault } from './buttons.cp.js';
import { InputLineDefault } from './inputs.cp.js';

// RedButton.openInWorld()
const RedButton = component(ButtonDefault, {
  name: 'red button',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
  extent: pt(94, 38),
  fill: Color.rgb(231, 76, 60),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    fontWeight: 'bold',
    position: pt(20, 10),
    reactsToPointer: false,
    textAndAttributes: ['CANCEL', null]
  }]
});

const RedButtonClicked = component(RedButton, {
  name: 'red button clicked',
  fill: Color.rgb(177, 57, 44)
});

// GreenButton.openInWorld()
const GreenButton = component(ButtonDefault, {
  name: 'green button',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
  extent: pt(90, 38),
  fill: Color.rgb(62, 207, 142),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    fontWeight: 'bold',
    position: pt(35, 10),
    reactsToPointer: false,
    textAndAttributes: ['OK', null]
  }]
});

const GreenButtonClicked = component(GreenButton, {
  name: 'green button clicked',
  fill: Color.rgb(40, 155, 104)
});

// PlainButton.openInWorld()
const PlainButton = component(ButtonDefault, {
  name: 'plain button',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 1, color: Color.rgba(0, 0, 0, 0.26) }),
  extent: pt(40, 37),
  fill: Color.rgb(202, 207, 210),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    fontFamily: 'Nunito',
    fontSize: 14,
    fontWeight: 'bold',
    position: pt(13.5, 11.5),
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('plus')
  }]
});

const PlainButtonClicked = component(PlainButton, {
  name: 'plain button clicked',
  fill: Color.rgb(127, 140, 141)
});

const ChoiceButtonSelected = component({
  // type: RadioButton,
  name: 'choice button Selected',
  acceptsDrops: false,
  borderColor: Color.rgb(204, 204, 204),
  borderRadius: 4,
  dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
  extent: pt(371.5, 47),
  indicator: null,
  layout: new HorizontalLayout({
    align: 'center',
    autoResize: false,
    direction: 'leftToRight',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 12,
      y: 12
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
    spacing: 12
  }),
  nativeCursor: 'pointer',
  selected: true,
  selectionColor: Color.rgb(52, 152, 219),
  submorphs: [{
    type: Ellipse,
    name: 'indicator',
    borderColor: Color.rgb(204, 204, 204),
    borderWidth: 1,
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
    extent: pt(12, 12),
    fill: Color.rgb(52, 152, 219),
    isEllipse: true,
    nativeCursor: 'pointer',
    origin: pt(6, 6)
  }, {
    type: Label,
    name: 'label',
    fontSize: 15,
    reactsToPointer: false,
    textAndAttributes: [...Icon.textAttribute('external-link-alt'), '  Import existing package']
  }]
});

// ChoiceButtonUnselected.openInWorld()
const ChoiceButtonUnselected = component(ChoiceButtonSelected, {
  name: 'choice button unselected',
  opacity: 0.5,
  submorphs: [{
    name: 'indicator',
    fill: Color.rgb(255, 255, 255)
  }, {
    name: 'label',
    textAndAttributes: [...Icon.textAttribute('cube'), '  Add Package']
  }]
});

// LightPrompt.openInWorld()
const LightPrompt = component({
  name: 'light prompt',
  borderRadius: 8,
  dropShadow: new ShadowObject({ distance: 5, rotation: 75, color: Color.rgba(0, 0, 0, 0.37), blur: 60, fast: false }),
  extent: pt(387, 60),
  fill: Color.rgb(251, 252, 252),
  layout: new VerticalLayout({
    align: 'center',
    autoResize: true,
    direction: 'topToBottom',
    orderByIndex: true,
    resizeSubmorphs: true,
    spacing: 16
  }),
  submorphs: [{
    type: Text,
    name: 'promptTitle',
    extent: pt(355, 28),
    fill: Color.rgba(255, 255, 255, 0),
    fixedWidth: true,
    fontColor: Color.rgb(102, 102, 102),
    fontFamily: '"IBM Plex Sans"',
    fontSize: 20,
    fontWeight: 'bold',
    nativeCursor: 'default',
    padding: rect(20, 0, 0, 0),
    readOnly: true,
    textAlign: 'center',
    textString: 'Hello World!'
  }]
});

// DarkPrompt.openInWorld()
const DarkPrompt = component(LightPrompt, {
  name: 'dark prompt',
  fill: Color.rgba(0, 0, 0, 0.52),
  submorphs: [{
    name: 'promptTitle',
    fontColor: Color.rgb(253, 254, 254)
  }]
});

// InformPrompt.openInWorld()
const InformPrompt = component(LightPrompt, {
  // type: InformPrompt,
  name: 'inform prompt',
  extent: pt(249.3, 114),
  submorphs: [{
    name: 'promptTitle',
    lineWrapping: true,
    textAndAttributes: ['Inform message', null]
  }, add({
    name: 'button wrapper',
    fill: Color.rgba(0, 0, 0, 0),
    layout: new HorizontalLayout({
      align: 'center',
      autoResize: false,
      direction: 'centered',
      orderByIndex: true,
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false
    }),
    submorphs: [part(GreenButton, {
      name: 'ok button',
      extent: pt(90, 38),
      submorphs: [{ name: 'label', textString: 'OK' }]
    })]
  })]
});

// ConfirmPrompt.openInWorld()
const ConfirmPrompt = component(LightPrompt, {
  // type: ConfirmPrompt,
  name: 'confirm prompt',
  submorphs: [{
    name: 'promptTitle',
    lineWrapping: 'by-words',
    textAndAttributes: ['Confirm\n\
', {
      fontWeight: 'bold'
    }, 'An appropriate message for the user that helps them to understand the situation!', {
      fontSize: 17,
      fontWeight: 'normal'
    }]
  }, add({
    name: 'button wrapper',
    extent: pt(331, 48.9),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new HorizontalLayout({
      align: 'center',
      autoResize: false,
      direction: 'centered',
      orderByIndex: true,
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 20
    }),
    submorphs: [part(GreenButton, {
      name: 'ok button',
      submorphs: [{ name: 'label', textString: 'OK' }]
    }), part(RedButton, {
      name: 'cancel button',
      submorphs: [{ name: 'label', textString: 'CANCEL' }]
    })]
  })]
});

// MultipleChoicePrompt.openInWorld()
const MultipleChoicePrompt = component(ConfirmPrompt, {
  // type: MultipleChoicePrompt,
  name: 'multiple choice prompt',
  submorphs: [add({
    type: RadioButtonGroup,
    name: 'choices',
    extent: pt(387, 118),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new VerticalLayout({
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: true,
      spacing: 8
    }),
    submorphs: [
      part(ChoiceButtonUnselected),
      part(ChoiceButtonSelected)
    ]
  }, 'button wrapper')]
});

// TextPrompt.openInWorld()
const TextPrompt = component(ConfirmPrompt, {
  // type: TextPrompt,
  name: 'text prompt',
  submorphs: [add(part(InputLineDefault, { name: 'input' }), 'button wrapper')]
});

// EditPrompt.openInWorld()
const EditPrompt = component(ConfirmPrompt, {
  name: 'edit prompt',
  submorphs: [add({
    name: 'editor',
    type: Text,
    master: InputLineDefault,
    height: 300
  }, 'button wrapper')]
});

// PasswordPrompt.openInWorld()
const PasswordPrompt = component(ConfirmPrompt, {
  name: 'password prompt',
  master: DarkPrompt,
  submorphs: [
    {
      name: 'promptTitle',
      lineWrapping: 'by-words'
    },
    add({
      name: 'password input',
      type: PasswordInputLine,
      placeholder: 'Password',
      dropShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
      master: InputLineDefault
    }, 'button wrapper')
  ]
});

// ListPrompt.openInWorld()
const ListPrompt = component(ConfirmPrompt, {
  name: 'list prompt',
  extent: pt(441.8, 537.2),
  master: DarkPrompt,
  submorphs: [
    {
      name: 'promptTitle',
      lineWrapping: 'by-words'
    },
    add({
      type: FilterableList,
      name: 'prompt list',
      layout: new TilingLayout({
        axis: 'column',
        orderByIndex: true,
        resizePolicies: [['input', {
          height: 'fixed',
          width: 'fill'
        }], ['list', {
          height: 'fixed',
          width: 'fill'
        }]],
        spacing: 5,
        wrapSubmorphs: false
      }),
      borderColor: Color.rgb(204, 204, 204),
      borderWidth: 0,
      extent: pt(442, 385),
      selectedAction: 'default',
      submorphs: [{
        type: InputLine,
        name: 'input',
        borderRadius: 5,
        dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
        extent: pt(355, 26),
        fill: Color.rgba(204, 204, 204, 0.8),
        fixedHeight: false,
        fontColor: Color.rgb(102, 102, 102),
        fontFamily: '"IBM Plex Sans"',
        fontSize: 16,
        padding: rect(10, 2, 0, 0)
      }, {
        type: List,
        name: 'list',
        borderColor: Color.rgb(149, 165, 166),
        borderRadius: 4,
        dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
        extent: pt(410, 354),
        fill: Color.rgba(66, 73, 73, 0.85),
        fontFamily: 'Monaco, monospace',
        itemHeight: 16,
        itemPadding: undefined,
        manualItemHeight: true,
        master: false,
        multiSelect: true,
        nonSelectionFontColor: Color.rgb(204, 204, 204),
        padding: rect(7, 6, -4, -3),
        position: pt(0, 31),
        scroll: pt(2, 0),
        selectedIndex: undefined,
        selectedIndexes: [],
        selectionColor: Color.rgb(230, 230, 230),
        selectionFontColor: Color.rgb(0, 0, 0),
        selections: []
      }],
      theme: 'dark'
    }, 'button wrapper')
  ]
});

// EditListPrompt.openInWorld()
const EditListPrompt = component(ListPrompt, {
  name: 'edit list prompt',
  submorphs: [
    {
      name: 'button wrapper',
      submorphs: [
        add(part(PlainButton, { name: 'add item button' })),
        add(part(PlainButton, {
          name: 'remove item button',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('minus')
          }]
        }))
      ]
    }
  ]
});

export { GreenButton, RedButton, GreenButtonClicked, RedButtonClicked, PlainButton, PlainButtonClicked, LightPrompt, DarkPrompt, InformPrompt, ConfirmPrompt, ChoiceButtonSelected, ChoiceButtonUnselected, MultipleChoicePrompt, TextPrompt, EditPrompt, PasswordPrompt, ListPrompt, EditListPrompt };
