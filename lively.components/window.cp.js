import { Color, rect, LinearGradient, pt } from 'lively.graphics';
import { ShadowObject, TilingLayout, Icon, Label, component, part } from 'lively.morphic';

const WindowButtonClose = component({
  name: 'window button close',
  borderRadius: 14,
  extent: pt(15, 13),
  fill: Color.rgba(0, 0, 0, 0),
  position: pt(6, 6),
  nativeCursor: 'pointer',
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(255, 96, 82),
    fontSize: 14,
    position: pt(2, 1),
    reactsToPointer: false,
    lineHeight: 1,
    textAndAttributes: Icon.textAttribute('times')
  }],
  tooltip: 'Close window'
});

const WindowButtonCloseHovered = component(WindowButtonClose, {
  name: 'window button close hovered',
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(176, 58, 46)
  }]
});

const WindowButtonInactive = component(WindowButtonClose, {
  name: 'window button inactive',
  submorphs: [{
    name: 'label',
    fontColor: Color.rgbHex('7F8C8D')
  }]
});

const WindowButtonInactiveDark = component(WindowButtonClose, {
  name: 'window button inactive',
  submorphs: [{
    name: 'label',
    fontColor: Color.rgbHex('ECF0F1')
  }]
});

const WindowButtonMenu = component({
  name: 'window button menu',
  borderRadius: 14,
  extent: pt(15, 13),
  fill: Color.rgba(0, 0, 0, 0),
  nativeCursor: 'pointer',
  position: pt(48, 6),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(52, 152, 219),
    fontSize: 14,
    position: pt(2, 1),
    reactsToPointer: false,
    lineHeight: 1,
    textAndAttributes: Icon.textAttribute('angle-down')
  }],
  tooltip: 'Open Window Menu'
});

const WindowButtonMenuHovered = component(WindowButtonMenu, {
  name: 'window button menu hovered',
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(40, 116, 166)
  }]
});

const WindowButtonMinimize = component({
  name: 'window button minimize',
  borderRadius: 14,
  extent: pt(15, 13),
  fill: Color.rgba(0, 0, 0, 0),
  nativeCursor: 'pointer',
  position: pt(27, 6),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(243, 156, 18),
    fontSize: 14,
    position: pt(2, 1),
    lineHeight: 1,
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('minus')
  }],
  tooltip: 'collapse window'
});

const WindowButtonMinimizeHovered = component(WindowButtonMinimize, {
  name: 'window button minimize hovered',
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(175, 96, 26)
  }]
});

const DefaultWindow = component({
  name: 'default window',
  draggable: true,
  fill: Color.transparent,
  dropShadow: new ShadowObject({ distance: 8, rotation: 90, color: Color.rgba(0, 0, 0, 0.3), blur: 35, spread: 5 }),
  extent: pt(345.1, 152.1),
  borderRadius: 6,
  submorphs: [{
    name: 'contents wrapper',
    extent: pt(345.1, 152.1),
    fill: Color.rgb(179, 182, 183),
    borderRadius: 6,
    reactsToPointer: false,
    clipMode: 'hidden',
    submorphs: [{
      name: 'header',
      borderColor: Color.rgba(0, 0, 0, 0),
      extent: pt(345.3, 72),
      fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(208, 211, 212) }, { offset: 1, color: Color.rgb(179, 182, 183) }], vector: rect(0, 0, 0, 1) }),
      position: pt(-0.2, -0.4),
      reactsToPointer: false,
      isLayoutable: false,
      submorphs: [{
        name: 'window controls',
        extent: pt(69, 27),
        fill: Color.rgba(0, 0, 0, 0),
        layout: new TilingLayout({
          autoResize: true,
          orderByIndex: true,
          padding: {
            height: 0,
            width: 0,
            x: 6,
            y: 6
          },
          spacing: 6
        }),
        position: pt(-0.6, -0.3),
        submorphs: [
          part(WindowButtonClose, {
            name: 'close',
            master: {
              auto: WindowButtonClose,
              hover: WindowButtonCloseHovered
            }
          }), part(WindowButtonMinimize, {
            name: 'minimize',
            master: {
              auto: WindowButtonMinimize,
              hover: WindowButtonMinimizeHovered
            }
          }), part(WindowButtonMenu, {
            name: 'menu',
            master: {
              auto: WindowButtonMenu,
              hover: WindowButtonMenuHovered
            }
          })]
      }, {
        type: Label,
        name: 'window title',
        fontColor: Color.rgb(102, 102, 102),
        fontWeight: 'bold',
        isLayoutable: false,
        nativeCursor: 'pointer',
        padding: rect(0, 2, 0, -2),
        position: pt(135.2, 6),
        textAndAttributes: ['Window Title', null]
      }]
    }]
  }]
});

const DefaultWindowInactive = component(DefaultWindow, {
  name: 'default window inactive',
  dropShadow: new ShadowObject({ distance: 8, rotation: 90, color: Color.rgba(0, 0, 0, 0.1), blur: 10 }),
  submorphs: [
    {
      name: 'contents wrapper',
      fill: Color.rgb(208, 211, 212),
      submorphs: [{
        name: 'header',
        fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(244, 246, 247) }, { offset: 1, color: Color.rgb(208, 211, 212) }], vector: rect(0, 0, 0, 1) }),
        submorphs: [
          {
            name: 'window controls',
            submorphs: [
              {
                name: 'close',
                master: WindowButtonInactive
              }, {
                name: 'minimize',
                master: WindowButtonInactive
              }, {
                name: 'menu',
                master: WindowButtonInactive
              }]
          }, {
            name: 'window title',
            fontWeight: 400
          }
        ]
      }]
    }
  ]
});

const DarkWindow = component(DefaultWindow, {
  name: 'dark window',
  dropShadow: new ShadowObject({ distance: 8, rotation: 90, color: Color.rgba(0, 0, 0, 0.1), blur: 10 }),
  submorphs: [{
    name: 'contents wrapper',
    fill: Color.rgb(38, 50, 56),
    submorphs: [
      {
        name: 'header',
        fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(55, 71, 79) }, { offset: 1, color: Color.rgb(38, 50, 56) }], vector: rect(0, 0, 0, 1) }),
        submorphs: [{
          name: 'window title',
          fontColor: Color.rgb(144, 148, 151)
        }]
      }
    ]
  }]
});

const DarkWindowInactive = component(DefaultWindowInactive, {
  name: 'dark window inactive',
  dropShadow: new ShadowObject({ distance: 8, rotation: 90, color: Color.rgba(0, 0, 0, 0.1), blur: 10 }),
  submorphs: [{
    name: 'contents wrapper',
    fill: Color.rgb(128, 139, 150),
    submorphs: [
      {
        name: 'header',
        fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(171, 178, 185) }, { offset: 1, color: Color.rgb(128, 139, 150) }], vector: rect(0, 0, 0, 1) }),
        submorphs: [
          {
            name: 'window controls',
            submorphs: [
              {
                name: 'close',
                master: WindowButtonInactiveDark
              }, {
                name: 'minimize',
                master: WindowButtonInactiveDark
              }, {
                name: 'menu',
                master: WindowButtonInactiveDark
              }]
          }, {
            name: 'window title',
            fontColor: Color.rgb(102, 102, 102)
          }
        ]
      }
    ]
  }]
});

export { DefaultWindow, DarkWindow, DefaultWindowInactive, DarkWindowInactive };
