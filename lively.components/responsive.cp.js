import { component } from 'lively.morphic/components/core.js';
import { ResponsiveLayoutMorphHalo, BreakpointSlider, Arrow } from './responsive.js';
import { Color, rect, pt } from 'lively.graphics';
import { Icon, part, TilingLayout, Label } from 'lively.morphic';

const ResponsiveLayoutHalo = component({
  type: ResponsiveLayoutMorphHalo,
  name: 'responsive layout halo',
  borderColor: Color.rgb(230, 126, 34),
  draggable: true,
  extent: pt(35.1, 35),
  fill: Color.rgba(46, 75, 223, 0),
  grabbable: true,
  position: pt(1272.9, 345.2),
  sliderProto: {
    type: BreakpointSlider,
    name: 'vertical breakpoint slider',
    breakPointIndex: 0,
    draggable: true,
    extent: pt(63.7, 80),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new TilingLayout({
      align: 'center',
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false
    }),
    nativeCursor: 'grab',
    orientation: 'vertical',
    position: pt(-86.5, 387.2),
    rotation: -1.5707963267948966,
    submorphs: [{
      type: Label,
      name: 'pixel view',
      draggable: true,
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      grabbable: true,

      nativeCursor: 'pointer',
      padding: rect(10, 0, 3, 0),
      reactsToPointer: false,
      rotation: 1.5707963267948966,
      textAndAttributes: ['320 px', null]
    }, {
      type: Label,
      name: 'user agent icon',
      fontSize: 30.108,

      reactsToPointer: false,
      rotation: 1.5707963267948966,
      textAndAttributes: Icon.textAttribute('mobile')
    }, {
      type: Arrow,
      name: 'breakpoint pin',
      borderColor: Color.rgb(0, 0, 0),
      borderWidth: 2,
      extent: pt(16.9, 16.6),
      fill: Color.transparent,

      reactsToPointer: false,
      rotation: 0.7853981633974483,
      startMarker: {
        children: [{
          d: 'M0,0 L10,5 L0,10 z',
          tagName: 'path'
        }],
        id: null,
        markerHeight: '5',
        markerWidth: '5',
        orient: 'auto',
        refX: '5',
        refY: '5',
        tagName: 'marker',
        viewBox: '0 0 10 10'
      },
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(16.894463049589064, 16.64704706326576), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }]
  },
  submorphs: [{
    type: Label,
    name: 'add horizontal breakpoint',
    fontSize: 30.108,
    nativeCursor: 'pointer',
    position: pt(589.4, -4.1),
    textAndAttributes: Icon.textAttribute('plus-circle'),
    tooltip: 'Add horizontal breakpoint'
  }, {
    type: Label,
    name: 'add vertical breakpoint',
    fontSize: 30.108,
    nativeCursor: 'pointer',
    position: pt(-0.2, 736),
    textAndAttributes: Icon.textAttribute('plus-circle'),
    tooltip: 'Add vertical breakpoint'
  }, {
    name: 'vertical breakpoint control',
    clipMode: 'hidden',
    borderRadius: 5,
    dropShadow: false,
    extent: pt(691, 20),
    fill: Color.rgba(81, 90, 90, 0),
    layout: new TilingLayout({
      align: 'top',
      direction: 'leftToRight',
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 0,
        y: 0
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 0
    }),
    position: pt(22.2, 35),
    reactsToPointer: false,
    rotation: 1.570796326794897,
    submorphs: [{
      name: 'v0',
      clipMode: 'hidden',
      extent: pt(295.6, 20),
      fill: Color.rgb(76, 175, 80),
      opacity: 0.5
    }, {
      name: 'v1',
      clipMode: 'hidden',
      extent: pt(194.9, 20),
      fill: Color.rgb(156, 39, 176),
      layout: new TilingLayout({
        align: 'center',
        direction: 'rightToLeft',
        orderByIndex: true,
        padding: {
          height: 0,
          width: 0,
          x: 2,
          y: 2
        },
        reactToSubmorphAnimations: false,
        renderViaCSS: true,
        resizeSubmorphs: false,
        spacing: 2
      }),
      opacity: 0.5,
      submorphs: [{
        type: Label,
        name: 'remove breakpoint',
        fontSize: 17,
        textAndAttributes: Icon.textAttribute('times'),
        tooltip: 'remove breakpoint'
      }]
    }]
  }, {
    name: 'horizontal breakpoint control',
    clipMode: 'hidden',
    borderRadius: 5,
    extent: pt(545, 20),
    fill: Color.rgba(81, 90, 90, 0),
    layout: new TilingLayout({
      align: 'top',
      direction: 'leftToRight',
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 0,
        y: 0
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 0
    }),
    position: pt(34.4, 1.2),
    submorphs: [{
      name: 'h0',
      clipMode: 'hidden',
      extent: pt(345.4, 20),
      fill: Color.rgb(244, 67, 54),
      opacity: 0.5
    }, {
      name: 'h1',
      clipMode: 'hidden',
      extent: pt(200, 20),
      fill: Color.rgb(255, 152, 0),
      layout: new TilingLayout({
        align: 'center',
        direction: 'rightToLeft',
        orderByIndex: true,
        padding: {
          height: 0,
          width: 0,
          x: 2,
          y: 2
        },
        reactToSubmorphAnimations: false,
        renderViaCSS: true,
        resizeSubmorphs: false,
        spacing: 2
      }),
      submorphs: [{
        type: Label,
        name: 'remove breakpoint',
        fontSize: 17,
        textAndAttributes: Icon.textAttribute('times'),
        tooltip: 'remove breakpoint'
      }]
    }]
  }, {
    type: BreakpointSlider,
    name: 'vertical breakpoint slider',
    breakPointIndex: 0,
    draggable: true,
    extent: pt(63.7, 80),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new TilingLayout({
      align: 'center',
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false
    }),
    nativeCursor: 'grab',
    orientation: 'vertical',
    position: pt(-93.7, 362.4),
    rotation: -1.5707963267948966,
    submorphs: [{
      type: Label,
      name: 'pixel view',
      draggable: true,
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      grabbable: true,
      nativeCursor: 'pointer',
      padding: rect(10, 0, 3, 0),
      reactsToPointer: false,
      rotation: 1.5707963267948966,
      textAndAttributes: ['296 px', null]
    }, {
      type: Label,
      name: 'user agent icon',
      fontSize: 30.108,
      reactsToPointer: false,
      rotation: 1.5707963267948966,
      textAndAttributes: Icon.textAttribute('mobile')
    }, {
      type: Arrow,
      name: 'breakpoint pin',
      borderColor: Color.rgb(0, 0, 0),
      borderWidth: 2,
      extent: pt(16.9, 16.6),
      fill: Color.transparent,
      reactsToPointer: false,
      rotation: 0.7853981633974483,
      startMarker: {
        children: [{
          d: 'M0,0 L10,5 L0,10 z',
          tagName: 'path'
        }],
        id: 'start-marker',
        markerHeight: '5',
        markerWidth: '5',
        orient: 'auto',
        refX: '5',
        refY: '5',
        tagName: 'marker',
        viewBox: '0 0 10 10'
      },
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(16.894463049589064, 16.64704706326576), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }]
  }, {
    type: BreakpointSlider,
    name: 'vertical breakpoint slider',
    breakPointIndex: 0,
    draggable: true,
    extent: pt(63.7, 60),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new TilingLayout({
      align: 'center',
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false
    }),
    nativeCursor: 'grab',
    orientation: 'horizontal',
    position: pt(347.9, -60.7),
    submorphs: [{
      type: Label,
      name: 'pixel view',
      draggable: true,
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      grabbable: true,
      nativeCursor: 'pointer',
      padding: rect(0, 0, 0, 9),
      reactsToPointer: false,
      textAndAttributes: ['345 px', null]
    }, {
      type: Label,
      name: 'user agent icon',
      fontSize: 30.108,
      reactsToPointer: false,
      textAndAttributes: Icon.textAttribute('mobile')
    }, {
      type: Arrow,
      name: 'breakpoint pin',
      borderColor: Color.rgb(0, 0, 0),
      borderWidth: 2,
      extent: pt(16.9, 16.6),
      fill: Color.transparent,
      reactsToPointer: false,
      rotation: 0.7853981633974483,
      startMarker: {
        children: [{
          d: 'M0,0 L10,5 L0,10 z',
          tagName: 'path'
        }],
        id: 'start-marker',
        markerHeight: '5',
        markerWidth: '5',
        orient: 'auto',
        refX: '5',
        refY: '5',
        tagName: 'marker',
        viewBox: '0 0 10 10'
      },
      vertices: [
        { position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } },
        { position: pt(16.894463049589064, 16.64704706326576), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }
      ]
    }]
  }]
});

export { ResponsiveLayoutMorphHalo };
