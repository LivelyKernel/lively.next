import { DarkPrompt, RedButton, GreenButton } from 'lively.components/prompts.cp.js';
import { DarkDropDownList } from 'lively.components/list.cp.js';
import { component, add, part } from 'lively.morphic/components/core.js';
import { pt, rect, Color } from 'lively.graphics';
import { ProportionalLayout, HorizontalLayout, ShadowObject, Text, Label } from 'lively.morphic';
import { InputLineDark } from 'lively.components/inputs.cp.js';
import { Button } from 'lively.components';

// SaveWorldDialog.openInWorld()
const SaveWorldDialog = component(DarkPrompt, {
  type: SaveWorldDialog,
  name: 'save world dialog',
  extent: pt(469.5, 316.3),
  // replace with grid layout ?
  layout: new ProportionalLayout({
    lastExtent: {
      x: 469.4921875,
      y: 316.2890625
    },
    reactToSubmorphAnimations: false,
    submorphSettings: [['cancelButton', {
      x: 'scale',
      y: 'move'
    }], ['okButton', {
      x: 'scale',
      y: 'move'
    }], ['save-dialog-label', {
      x: 'scale',
      y: 'fixed'
    }], ['name input', {
      x: 'resize',
      y: 'fixed'
    }], ['tag input', {
      x: 'resize',
      y: 'fixed'
    }], ['description', {
      x: 'resize',
      y: 'fixed'
    }], ['name label', {
      x: 'fixed',
      y: 'fixed'
    }], ['name label copy', {
      x: 'fixed',
      y: 'fixed'
    }], ['destination chooser label', {
      x: 'fixed',
      y: 'fixed'
    }], ['choose DB button', {
      x: 'move',
      y: 'fixed'
    }], ['promptTitle', {
      x: 'scale',
      y: 'fixed'
    }]]
  }),
  submorphs: [{
    name: 'prompt title',
    textString: 'Save world'
  }, add({
    type: Label,
    name: 'name label',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(255, 255, 255),
    fontFamily: 'IBM Plex Sans',
    fontSize: 15,
    nativeCursor: 'pointer',
    position: pt(20, 79.1),
    textAndAttributes: ['save as: ', {}]
  }), add({
    type: Label,
    name: 'destination chooser label',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(255, 255, 255),
    fontFamily: 'Nunito',
    fontSize: 15,
    nativeCursor: 'pointer',
    position: pt(20, 155),
    textAndAttributes: ['description:', null]
  }), add(part(InputLineDark, {
    name: 'name input',
    extent: pt(336.5, 24.6),
    historyId: 'lively.morphic-save-world-names',
    position: pt(116, 77.4),
    submorphs: [{
      name: 'placeholder',
      extent: pt(74, 24.6),
      visible: true
    }]
  })), add({
    type: Text,
    name: 'description',
    borderRadius: 5,
    clipMode: 'auto',
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
    extent: pt(336.5, 89.9),
    fill: Color.rgb(229, 231, 233),
    fixedHeight: true,
    fixedWidth: true,
    fontFamily: 'Nunito',
    fontSize: 15,
    haloShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
    highlightWhenFocused: true,
    lineWrapping: true,
    nativeCursor: 'auto',
    padding: rect(4, 4, 0, 0),
    position: pt(116, 154)
  }), add(part(InputLineDark, {
    name: 'tag input',
    extent: pt(336.5, 24.5),
    highlightWhenFocused: true,
    historyId: 'lively.morphic-save-world-names',
    nativeCursor: undefined,
    padding: rect(4, 4, 0, 0),
    position: pt(116, 115),
    scroll: pt(0, 1)
  })), add({
    type: Label,
    name: 'name label copy',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(255, 255, 255),
    fontFamily: 'IBM Plex Sans',
    fontSize: 15,
    nativeCursor: 'pointer',
    position: pt(20, 118.8),
    textAndAttributes: ['tags:', null]
  }), add({
    type: Button,
    name: 'choose DB button',
    borderColor: Color.rgb(123, 125, 125),
    borderWidth: 0,
    extent: pt(116, 24),
    fill: Color.rgba(0, 0, 0, 0),
    label: ['Change DB  ', {
      fontFamily: 'IBM Plex Sans, Sans-Serif'
    }, '', {
      fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
      paddingTop: '2px',
      textStyleClasses: ['fa']
    }],
    padding: rect(10, 0, 0, 0),
    position: pt(231.8, 40.8),
    submorphs: [{
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(204, 204, 204),
      fontSize: 15,
      fontStyle: 'bold',
      nativeCursor: 'pointer',
      padding: rect(0, 3, 0, -1),
      position: pt(10, 0),
      reactsToPointer: false,
      textAndAttributes: ['Change DB  ', {
        fontFamily: 'IBM Plex Sans, Sans-Serif'
      }, '', {
        fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
        paddingTop: '2px',
        textStyleClasses: ['fa']
      }]
    }]
  }), add({
    name: 'button wrapper',
    extent: pt(470.3, 61.1),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new HorizontalLayout({
      align: 'center',
      autoResize: false,
      direction: 'centered',
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
    position: pt(-0.5, 251),
    submorphs: [part(GreenButton, {
      name: 'okButton',
      extent: pt(90, 38),
      label: 'OK'
    }), part(RedButton, {
      name: 'cancelButton',
      extent: pt(94, 38),
      label: 'CANCEL'
    })]
  }), add({
    type: Label,
    name: 'storage type',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(255, 255, 255),
    fontFamily: 'IBM Plex Sans',
    fontSize: 15,
    nativeCursor: 'pointer',
    position: pt(20.4, 42.4),
    textAndAttributes: ['store as:', null]
  }), add(part(DarkDropDownList, {
    name: 'storage type selector',
    extent: pt(105.1, 23),
    position: pt(115, 42),
    viewModel: {
      openListInWorld: true,
      items: ['JSON', 'Morphic DB']
    }
  })), add(part(InputLineDark, {
    name: 'file path input',
    position: pt(230.2, 39.5),
    extent: pt(221.3, 24.6),
    viewModel: {
      highlightWhenFocused: true,
      historyId: 'lively.morphic-save-world-names',
      placeholder: './path/to/snapshot.json'
    },
    visible: false
  }))]
});

export { SaveWorldDialog };
