import { ViewModel, Ellipse, ShadowObject, part, TilingLayout, component } from 'lively.morphic';
import { pt, rect } from 'lively.graphics/geometry-2d.js';
import { Label } from 'lively.morphic/text/label.js';

import { Color, LinearGradient } from 'lively.graphics/color.js';
import { add } from 'lively.morphic/components/core.js';
import { Text } from 'lively.morphic/text/morph.js';
import { num, arr } from 'lively.lang';
import { ConfirmPrompt } from 'lively.components/prompts.cp.js';
import { HeadlineLabel, DarkThemeList, EnumSelector, TextInput, DarkPopupWindow } from './studio/shared.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { SystemButton } from 'lively.components/buttons.cp.js';
import { Image } from 'lively.morphic/morph.js';
import { Button } from 'lively.components';

class LoadButtonModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'pressed' },
            { signal: 'onMouseUp', handler: 'released' }
          ];
        }
      }
    };
  }

  pressed () {
    this.view.fill = Color.blue;
  }

  released () {
    this.view.fill = Color.transparent;
  }
}

const ProjectLoadButton = component({
  name: 'project load button',
  defaultViewModel: LoadButtonModel,
  fill: Color.rgb(213, 0, 0),
  opacity: 0.71,
  borderColor: Color.rgb(111, 25, 25),
  borderRadius: 14,
  borderWidth: 5,
  extent: pt(180.9, 191.9),
  submorphs: [{
    type: Text,
    name: 'moppel text',
    position: pt(57.7, 114.6),
    textAndAttributes: ['Hallo Linus!', null]
  }, {
    name: 'aMorph',
    fill: new LinearGradient({ stops: [{ offset: 0.32709346212896623, color: Color.rgb(188, 99, 210) }, { offset: 0.8121441594165812, color: Color.transparent }], vector: rect(0.8176490387212156, 0.11386648915240777, -0.6352980774424314, 0.7722670216951845) }),
    dropShadow: new ShadowObject({ distance: 18, color: Color.rgba(0, 0, 0, 0.2), blur: 30 }),
    reactsToPointer: false,
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(113.6, 106.4),
    position: pt(35.8, 47.6)
  }]
});

const PlaygroundLoadButton = component(ProjectLoadButton, {
  name: 'playground load button',
  nativeCursor: 'progress',
  extent: pt(245.4, 205.7),
  fill: Color.green
});

const Test = component(PlaygroundLoadButton, {
  extent: pt(329, 213),
  rotation: num.toRadians(-9.7),
  nativeCursor: 'not-allowed',
  scale: 1,
  submorphs: [{
    name: 'clippy morph'
  }, add({
    name: 'troddel',
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(74.8, 44.5),
    fill: Color.rgb(255, 0, 0),
    position: pt(66.9, 118.8)
  }), add({
    type: Label,
    name: 'moppler2',
    fontSize: 17,
    fontWeight: 800,
    position: pt(97.6, 67.6),
    textAndAttributes: ['Hello kasper. How is life?', null]
  }), {
    name: 'aMorph',
    borderColor: Color.rgb(23, 160, 251),
    position: pt(50, 50.8),
    reactsToPointer: false
  }, {
    name: 'anImage',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(83.2, 89.4),
    imageUrl: 'https://i.imgur.com/uGRFZEs.jpg',
    naturalExtent: pt(4059, 3264),
    position: pt(70.9, 39.2)
  }]
});

const Test2 = component(PlaygroundLoadButton, {
  extent: pt(257.3, 186.7),
  borderWidth: 4,
  borderRadius: 10,
  submorphs: [{
    name: 'moppel text',
    extent: pt(128.2, 149.6),
    position: pt(17.6, 31),
    nativeCursor: 'text',
    selectionMode: 'lively',
    textAndAttributes: ['I guess that this delay is quite fine.\n\
 But what \n\
 but what is the thing that I am typing here?about th\n\
e rest. Man \n\
Hello man how is it going?\n\
I sthat gonna solve all the issues?', null]

  }, add({
    type: Text,
    name: 'buba huba',
    fontSize: 16,
    textAndAttributes: ['hello ', null, 'word', {
      fontColor: Color.rgb(255, 109, 0),
      fontWeight: 700
    }, ' morph', {
      fontColor: Color.rgb(155, 81, 81),
      fontWeight: 700
    }],
    borderColor: Color.rgb(95, 155, 194),
    extent: pt(65.9, 89.1),
    borderWidth: 1,
    cursorWidth: 1.5,
    fixedHeight: true,
    fixedWidth: true,
    lineWrapping: true,
    padding: rect(1, 1, 0, 0),
    position: pt(175, 52.7)
  })]
});

const LinusPrompt = component(ConfirmPrompt, {
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(15, 15, 0, 0),
    spacing: 16
  }),
  epiMorph: false,
  submorphs: [
    { name: 'prompt title', textAndAttributes: ['Hallo Linus!\n', { fontWeight: 'bold' }] }
  ]
});

const GoldenPlane = component({
  borderColor: Color.rgb(156, 100, 12),
  borderRadius: {
    bottomLeft: 76,
    bottomRight: 54,
    topLeft: 43,
    topRight: 10
  },
  extent: pt(322.7, 337.4),
  fill: Color.rgb(234, 194, 92),
  position: pt(891.9, 104.2),
  borderWidth: 10,
  rotation: num.toRadians(-24.7)
});

const Prompt = component({
  name: 'prompt',
  fill: Color.white,
  borderRadius: 5,
  borderWidth: 1,
  borderColor: Color.gray,
  extent: pt(300, 150),
  submorphs: [
    {
      type: 'label',
      name: 'prompt message',
      textString: 'Please enter some input:',
      fontSize: 14,
      fontWeight: 'bold',
      fontColor: Color.black,
      position: pt(20, 20)
    },
    {
      type: 'text',
      name: 'user input',
      fontSize: 14,
      fontColor: Color.black,
      extent: pt(260, 25),
      position: pt(20, 50)
    },
    {
      name: 'confirm button',
      label: 'Confirm',
      extent: pt(100, 30),
      position: pt(30, 100)
    },
    {
      name: 'cancel button',
      label: 'Cancel',
      extent: pt(100, 30),
      position: pt(170, 100)
    }
  ]
});

const StylishPrompt = component({
  name: 'stylish prompt',
  fill: Color.lightGray,
  borderRadius: 10,
  borderWidth: 2,
  borderColor: Color.gray,
  extent: pt(350, 180),
  submorphs: [
    { type: 'label', textString: 'anonymous' },
    {
      type: 'label',
      name: 'prompt message',
      textString: 'Please enter some input:',
      fontSize: 16,
      fontWeight: 'bold',
      fontColor: Color.darkGray,
      position: pt(25, 25)
    },
    {
      type: 'text',
      name: 'user input',
      fontSize: 16,
      fontColor: Color.black,
      borderRadius: 5,
      borderColor: Color.gray,
      borderWidth: 1,
      extent: pt(300, 30),
      position: pt(25, 65)
    },
    {
      name: 'confirm button',
      label: 'Confirm',
      extent: pt(120, 40),
      borderRadius: 5,
      borderWidth: 1,
      borderColor: Color.gray,
      position: pt(50, 120)
    },
    {
      name: 'cancel button',
      label: 'Cancel',
      extent: pt(120, 40),
      borderRadius: 5,
      borderWidth: 1,
      borderColor: Color.gray,
      position: pt(180, 120)
    }
  ]
});

const RetroPrompt = component({
  name: 'retro prompt',
  fill: Color.black,
  borderRadius: 10,
  borderWidth: 3,
  borderColor: Color.rgbHex('#00FFFF'), // Cyan border
  extent: pt(350, 180),
  submorphs: [
    part(HeadlineLabel, {
      name: 'prompt message',
      text: 'Please enter some input:',
      fontSize: 16,
      fontWeight: 'bold',
      fontColor: Color.rgbHex('#00FFFF'), // Cyan text
      position: pt(25, 25)
    }),
    part(InputLineDefault, {
      name: 'user input',
      fontSize: 16,
      fontColor: Color.rgbHex('#00FFFF'), // Cyan text
      backgroundColor: Color.black,
      borderColor: Color.rgbHex('#00FFFF'), // Cyan border
      borderWidth: 1,
      borderRadius: 5,
      extent: pt(300, 30),
      position: pt(25, 65),
      submorphs: [{
        name: 'placeholder',
        fontFamily: '"IBM Plex Sans",Sans-Serif',
        fontSize: 16,
        nativeCursor: 'text',
        visible: false
      }]
    }),
    part(SystemButton, {
      name: 'confirm button',
      label: 'Confirm',
      fontColor: Color.black,
      backgroundColor: Color.rgbHex('#00FFFF'), // Cyan background
      borderColor: Color.black,
      borderRadius: 5,
      borderWidth: 1,
      extent: pt(120, 40),
      position: pt(50, 120)
    }),
    part(SystemButton, {
      name: 'cancel button',
      label: 'Cancel',
      fontColor: Color.black,
      backgroundColor: Color.rgbHex('#00FFFF'), // Cyan background
      borderColor: Color.black,
      borderRadius: 5,
      borderWidth: 1,
      extent: pt(120, 40),
      position: pt(180, 120)
    })
  ]
});

const Palette = component({
  borderRadius: 10,
  clipMode: 'hidden',
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.6) }),
  extent: pt(701, 135),
  fill: Color.rgb(60, 60, 60),
  position: pt(915.3, 115.1),
  submorphs: [{
    type: Button,
    name: 'newButton',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 5,
    borderWidth: 1,
    extent: pt(50, 40),
    label: 'New',
    position: pt(15, 24),
    submorphs: [{
      type: Label,
      name: 'label',
      position: pt(12.5, 11.5),
      reactsToPointer: false,
      textAndAttributes: ['New', null]
    }]
  }, {
    type: Button,
    name: 'eraseButton',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 5,
    borderWidth: 1,
    deactivated: true,
    extent: pt(50, 40),
    label: 'Erase',
    nativeCursor: 'not-allowed',
    position: pt(73, 24),
    submorphs: [{
      type: Label,
      name: 'label',
      opacity: 0.3,
      position: pt(9.5, 11.5),
      reactsToPointer: false,
      textAndAttributes: ['Erase', null]
    }]
  }, {
    type: Button,
    name: 'undoButton',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 5,
    borderWidth: 1,
    deactivated: true,
    extent: pt(50, 40),
    label: 'Undo',
    nativeCursor: 'not-allowed',
    position: pt(130, 74),
    submorphs: [{
      type: Label,
      name: 'label',
      opacity: 0.3,
      position: pt(10.5, 11.5),
      reactsToPointer: false,
      textAndAttributes: ['Undo', null]
    }]
  }, {
    type: Button,
    name: 'pickButton',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 5,
    borderWidth: 1,
    deactivated: true,
    extent: pt(50, 40),
    label: 'Pick',
    nativeCursor: 'not-allowed',
    position: pt(130, 24),
    submorphs: [{
      type: Label,
      name: 'label',
      opacity: 0.3,
      position: pt(13.5, 11.5),
      reactsToPointer: false,
      textAndAttributes: ['Pick', null]
    }]
  }, {
    type: Button,
    name: 'cancelButton',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 5,
    borderWidth: 1,
    extent: pt(50, 40),
    label: 'Cancel',
    position: pt(73, 74),
    submorphs: [{
      type: Label,
      name: 'label',
      position: pt(6.5, 11.5),
      reactsToPointer: false,
      textAndAttributes: ['Cancel', null]
    }]
  }, {
    type: Button,
    name: 'okButton',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 5,
    borderWidth: 1,
    extent: pt(50, 40),
    label: 'OK',
    position: pt(15, 74),
    submorphs: [{
      type: Label,
      name: 'label',
      position: pt(16.5, 11.5),
      reactsToPointer: false,
      textAndAttributes: ['OK', null]
    }]
  }, {
    name: 'width0',
    borderRadius: 10,
    dropShadow: new ShadowObject({ inset: true }),
    extent: pt(34, 100),
    position: pt(190, 22),
    submorphs: [{
      name: 'aMorph',
      borderRadius: 2,
      dropShadow: new ShadowObject({}),
      extent: pt(2, 84),
      fill: Color.rgb(0, 0, 0),
      position: pt(16, 8)
    }]
  }, {
    name: 'width1',
    dropShadow: new ShadowObject({ inset: true }),
    extent: pt(40, 100),
    fill: Color.rgb(102, 102, 102),
    position: pt(224, 22),
    submorphs: [{
      name: 'aMorph',
      borderRadius: 8,
      dropShadow: new ShadowObject({}),
      extent: pt(8, 84),
      fill: Color.rgb(212, 69, 3),
      position: pt(16, 8)
    }]
  }, {
    name: 'width2',
    dropShadow: new ShadowObject({ inset: true }),
    extent: pt(48, 100),
    fill: Color.rgb(102, 102, 102),
    position: pt(264, 22),
    submorphs: [{
      name: 'aMorph',
      borderRadius: 16,
      dropShadow: new ShadowObject({}),
      extent: pt(16, 84),
      fill: Color.rgb(236, 168, 31),
      position: pt(16, 8)
    }]
  }, {
    name: 'width3',
    borderRadius: 10,
    dropShadow: new ShadowObject({ inset: true }),
    extent: pt(64, 100),
    fill: Color.rgb(102, 102, 102),
    position: pt(312, 22),
    submorphs: [{
      name: 'aMorph',
      borderRadius: 32,
      dropShadow: new ShadowObject({}),
      extent: pt(32, 84),
      fill: Color.rgb(79, 124, 129),
      position: pt(16, 8)
    }]
  }, {
    type: Ellipse,
    name: 'color0',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(212, 69, 3),
    isEllipse: true,
    position: pt(400, 74)
  }, {
    type: Ellipse,
    name: 'color1',
    borderWidth: 4,
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(0, 0, 0),
    isEllipse: true,
    position: pt(430, 14)
  }, {
    type: Ellipse,
    name: 'color2',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(236, 168, 31),
    isEllipse: true,
    position: pt(460, 74)
  }, {
    type: Ellipse,
    name: 'color3',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(177, 173, 162),
    isEllipse: true,
    position: pt(490, 14)
  }, {
    type: Ellipse,
    name: 'color4',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(79, 124, 129),
    isEllipse: true,
    position: pt(520, 74)
  }, {
    type: Ellipse,
    name: 'color5',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(246, 246, 246),
    isEllipse: true,
    position: pt(550, 14)
  }, {
    type: Ellipse,
    name: 'color6',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(145, 161, 112),
    isEllipse: true,
    position: pt(580, 74)
  }, {
    type: Ellipse,
    name: 'color7',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(171, 127, 88),
    isEllipse: true,
    position: pt(610, 14)
  }, {
    type: Ellipse,
    name: 'color8',
    dropShadow: new ShadowObject({ inset: true, blur: 2 }),
    extent: pt(50, 50),
    fill: Color.rgb(183, 143, 170),
    isEllipse: true,
    position: pt(640, 74)
  }]
});

const FontConfigurationPopup = component(DarkPopupWindow, {
  // viewModelClass: FontConfigurationModel,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['font controls', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  extent: pt(243, 337),
  submorphs: [
    add({
      name: 'font controls',
      fill: Color.rgba(255, 255, 255, 0),
      layout: new TilingLayout({
        axis: 'column',
        orderByIndex: true,
        resizePolicies: [['name control', {
          height: 'fixed',
          width: 'fill'
        }], ['style control', {
          height: 'fixed',
          width: 'fill'
        }], ['weight control', {
          height: 'fixed',
          width: 'fill'
        }], ['unicode range control', {
          height: 'fixed',
          width: 'fill'
        }]]
      }),
      submorphs: [
        {
          name: 'name control',
          layout: new TilingLayout({
            align: 'right',
            axis: 'column',
            hugContentsVertically: true,
            orderByIndex: true,
            padding: rect(15, 10, 0, 0),
            resizePolicies: [['name input', {
              height: 'fixed',
              width: 'fill'
            }]],
            spacing: 5
          }),
          height: 35.6796875,
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'name label',
            nativeCursor: 'pointer',
            opacity: 0.7,
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            position: pt(13.6, 8),
            tooltip: 'Defines the name under which the font is going to be available throughout the project.',
            textAndAttributes: ['Font Name  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          }, part(TextInput, {
            name: 'name input',
            fixedWidth: true,
            height: 25
          })]
        },
        {
          name: 'style control',
          layout: new TilingLayout({
            align: 'right',
            axis: 'column',
            hugContentsVertically: true,
            orderByIndex: true,
            padding: rect(15, 10, 0, 0),
            resizePolicies: [['style selector', {
              height: 'fixed',
              width: 'fill'
            }]],
            spacing: 5
          }),
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'style label',
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(11.6, 1.9),
            tooltip: 'Defines the style this font file covers. For instance different font styles may be partitioned in different font files.',
            textAndAttributes: ['Font Style  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          }, part(EnumSelector, {
            name: 'style selector',
            layout: new TilingLayout({
              align: 'right',
              justifySubmorphs: 'spaced',
              orderByIndex: true,
              padding: rect(5, 0, 10, 0)
            }),
            viewModel: {
              openListInWorld: true,
              listMaster: DarkThemeList,
              items: ['normal', 'italic', 'underline']
            }
          })]
        },
        {
          name: 'weight control',
          layout: new TilingLayout({
            align: 'right',
            hugContentsVertically: true,
            justifySubmorphs: 'spaced',
            orderByIndex: true,
            padding: rect(15, 10, 0, 0),
            spacing: 5,
            wrapSubmorphs: true
          }),
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'weight label',
            extent: pt(210.5, 18),
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(5.4, 28.4),
            fixedWidth: true,
            textAndAttributes: ['Font Weight  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          }, {
            type: Label,
            name: 'min label',
            extent: pt(99, 17),
            fixedWidth: true,
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(-163, 27),
            textAndAttributes: ['Min', null]
          }, {
            type: Label,
            name: 'max label',
            extent: pt(99.8, 16.1),
            fixedWidth: true,
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(-113, 27),
            textAndAttributes: ['Max', null]
          }, part(EnumSelector, {
            name: 'weight selector min',
            extent: pt(100, 23.3),
            viewModel: {
              openListInWorld: true,
              listMaster: DarkThemeList,
              listHeight: 500,
              items: arr.range(1, 9).map(i => i * 100),
              listAlign: 'selection'
            }
          }), part(EnumSelector, {
            name: 'weight selector max',
            extent: pt(100, 23.3),
            viewModel: {
              openListInWorld: true,
              listMaster: DarkThemeList,
              listHeight: 500,
              items: arr.range(1, 9).map(i => i * 100),
              listAlign: 'selection'
            }
          })]
        },
        {
          name: 'unicode range control',
          layout: new TilingLayout({
            align: 'right',
            axis: 'column',
            hugContentsVertically: true,
            orderByIndex: true,
            padding: rect(15, 10, 0, 10),
            resizePolicies: [['unicode range input', {
              height: 'fixed',
              width: 'fill'
            }]],
            spacing: 5
          }),
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'unicode range label',
            extent: pt(213.2, 18),
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(44.6, 31.4),
            textAndAttributes: ['Unicode Range  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          },
          part(TextInput, {
            name: 'unicode range input',
            extent: pt(100, 23)
          })]
        }
      ]
    }), {
      name: 'header menu',
      submorphs: [{
        name: 'title',
        textAndAttributes: ['Font Configuration', null]
      }]
    }
  ]
});

// once a structural update happens,
// anchors are pushed to the end and are getting
// triggered for now reason

export {
  ProjectLoadButton,
  PlaygroundLoadButton,
  GoldenPlane
};
