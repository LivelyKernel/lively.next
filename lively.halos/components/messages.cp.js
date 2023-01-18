import { TilingLayout, Label, Icon, Text, ShadowObject, component, part } from 'lively.morphic';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { Color, LinearGradient, rect, pt } from 'lively.graphics';
import { StatusMessage } from './messages.js';

const MessageButton = component(ButtonDefault, {
  viewModel: {
    label: {
      value: Icon.textAttribute('times'),
      fontColor: Color.rgb(66, 73, 73),
      fontSize: 20,
      padding: rect(1, 1, 0, 0)
    }
  },
  name: 'message button',
  borderColor: Color.rgb(149, 165, 166),
  borderRadius: 25,
  borderWidth: 0,
  extent: pt(25, 25),
  halosEnabled: false,
  fill: Color.rgba(255, 255, 255, 0)
});

const MessageButtonHover = component(MessageButton, {
  name: 'message button/hover',
  fill: Color.black.withA(.1)
});

const MessageButtonClick = component(MessageButton, {
  name: 'message button/click',
  fill: Color.black.withA(.2)
});

const StatusMessageDefault = component({
  name: 'status message default',
  defaultViewModel: StatusMessage,
  borderRadius: 5,
  clipMode: 'hidden',
  dropShadow: new ShadowObject({
    distance: 8,
    rotation: 90,
    color: Color.rgba(0, 0, 0, 0.3),
    blur: 25
  }),
  extent: pt(669, 128),
  fill: Color.rgba(209, 209, 209, 0.9),
  layout: new TilingLayout({
    axis: 'column',
    orderByIndex: true,
    hugContentsVertically: true,
    renderViaCSS: false,
    reactToSubmorphAnimations: true,
    resizePolicies: [
      ['horizontal float', { height: 'fixed', width: 'fill' }],
      ['message text', { height: 'fixed', width: 'fill' }]
    ]
  }),
  submorphs: [{
    name: 'horizontal float',
    extent: pt(669, 40),
    fill: Color.rgba(0, 0, 0, 0),
    reactsToPointer: false,
    halosEnabled: false,
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(10, 5, -5, 0),
      renderViaCSS: false,
      reactToSubmorphAnimations: true,
      resizePolicies: [
        ['message title', { height: 'fill', width: 'fill' }],
        ['close button', { height: 'fill', width: 'fixed' }]
      ]
    }),
    submorphs: [{
      type: Label,
      name: 'message icon',
      extent: pt(22, 23),
      fontColor: Color.rgb(66, 73, 73),
      fontSize: 20,
      padding: rect(1, 1, 0, 0),
      reactsToPointer: false,
      halosEnabled: false,
      textAndAttributes: Icon.textAttribute('info-circle')
    }, {
      type: 'text',
      needsDocument: true,
      name: 'message title',
      extent: pt(597, 37),
      fill: Color.rgba(0, 0, 0, 0),
      fixedWidth: true,
      fixedHeight: true,
      readOnly: true,
      fontColor: Color.rgb(66, 73, 73),
      fontFamily: '"IBM Plex Sans",Sans-Serif',
      fontSize: 15,
      fontWeight: 'bold',
      lineWrapping: true,
      padding: rect(8, 5, 0, 3),
      reactsToPointer: false,
      halosEnabled: false,
      textAndAttributes: ['Something to think about...', null]
    },
    part(
      ButtonDefault,
      {
        master: {
          auto: MessageButton,
          click: MessageButtonClick,
          hover: MessageButtonHover
        },
        viewModel: {
          label: {
            value: Icon.textAttribute('times'),
            fontColor: Color.rgb(66, 73, 73),
            fontSize: 20,
            padding: rect(1, 1, 0, 0)
          }
        },
        name: 'close button',
        position: pt(465.2, 0.2),
        width: 30,
        tooltip: 'Close this status message.',
        halosEnabled: false
      })]
  }, {
    type: Text,
    needsDocument: true,
    name: 'message text',
    selectionMode: 'native',
    clipMode: 'auto',
    extent: pt(669, 87.5),
    fill: Color.rgba(0, 0, 0, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(66, 73, 73),
    fontFamily: '"IBM Plex Sans",Sans-Serif',
    fontSize: 15,
    lineWrapping: true,
    padding: rect(10, 10, 0, 0),
    halosEnabled: false,
    textAndAttributes: ['The module "lively.morphic/morph.js" you are viewing is frozen. You are not able to make changes to this module unless you reload the world with dynamic load enabled for the package "lively.morphic".', null]
  }]
});

const StatusMessageConfirm = component(StatusMessageDefault, {
  extent: pt(669, 128),
  name: 'status message confirm',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(46, 204, 113) },
      { offset: 1, color: Color.rgb(39, 174, 96) }],
    vector: rect(0, 0, 0, 1)
  }),
  submorphs: [{
    name: 'horizontal float',
    submorphs: [
      {
        type: Label,
        name: 'message icon',
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        textAndAttributes: Icon.textAttribute('check-circle')
      },
      {
        type: Text,
        name: 'message title',
        fontColor: Color.white,
        textAndAttributes: ['Saved file...', null]
      },
      {
        name: 'close button',
        viewModel: { label: { fontColor: Color.white } }
      }
    ]
  }, {
    name: 'message text',
    fontColor: Color.white

  }]
});

const StatusMessageError = component(StatusMessageDefault, {
  name: 'status message error',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(231, 76, 60) },
      { offset: 1, color: Color.rgb(192, 57, 43) }],
    vector: rect(0, 0, 0, 1)
  }),
  submorphs: [
    {
      name: 'horizontal float',
      submorphs: [
        {
          name: 'message icon',
          fontColor: Color.rgb(255, 255, 255),
          fontSize: 20,
          textAndAttributes: Icon.textAttribute('times-circle')
        },
        {
          name: 'message title',
          fontColor: Color.white,
          textAndAttributes: ['An error occured', null]
        },
        {
          name: 'close button',
          viewModel: { label: { fontColor: Color.white } }
        }
      ]
    },
    {
      name: 'message text',
      fontColor: Color.white
    }
  ]
});

const StatusMessageWarning = component(StatusMessageDefault, {
  name: 'status message warning',
  borderColor: Color.rgbHex('DA9819'),
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(249, 213, 68) },
      { offset: 1, color: Color.rgb(219, 162, 18) }
    ],
    vector: rect(0.5, 1, 0, 1)
  })
});

export { StatusMessageDefault, StatusMessageConfirm, StatusMessageError, StatusMessageWarning };
