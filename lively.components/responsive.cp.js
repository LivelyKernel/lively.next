import { component, without } from 'lively.morphic/components/core.js';
import { ResponsiveLayoutMorphHalo, BreakpointSlider, Arrow } from './responsive.js';
import { Color, rect, pt } from 'lively.graphics';
import { Icon, part, ShadowObject, TilingLayout, Label } from 'lively.morphic';
import { num } from 'lively.lang';

const BreakpointHorizontal = component({
  rotation: num.toRadians(0.0),
  breakPointIndex: 0,
  draggable: true,
  extent: pt(73.9, 110.2),
  fill: Color.rgba(46, 75, 223, 0),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 7
  }),
  nativeCursor: 'grab',
  orientation: 'vertical',
  position: pt(-86.5, 387.2),
  submorphs: [{
    type: Label,
    name: 'user agent icon',
    fontSize: 30.108,

    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('mobile')
  }, {
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
    textAndAttributes: ['320 px', null]
  }, {
    name: 'pin wrapper',
    fill: Color.rgba(255, 255, 255, 0),
    borderStyle: 'none',
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(30.2, 20.7),
    position: pt(-8, 27),
    reactsToPointer: false,
    submorphs: [{
      type: Arrow,
      name: 'breakpoint pin',
      borderColor: Color.rgb(0, 0, 0),
      borderWidth: 2,
      extent: pt(16.9, 16.6),
      fill: Color.transparent,
      position: pt(15.3, 5.2),
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
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(16.9, 16.6), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }]
  }]
});

const BreakpointVertical = component(BreakpointHorizontal, {
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 7
  }),
  extent: pt(135, 40),
  submorphs: [{
    name: 'pixel view',
    padding: rect(10, 0, 0, 0)
  }, {
    name: 'pin wrapper',
    extent: pt(31.9, 30.1),
    rotation: num.toRadians(-90.0),
    submorphs: [{
      name: 'breakpoint pin',
      position: pt(16.7, 6),
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(16.9, 16.6), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }]
  }]
});

const BreakpointRange = component({
  clipMode: 'hidden',
  extent: pt(200, 20),
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(2, 2, 0, 0),
    spacing: 2
  }),
  submorphs: [{
    type: Label,
    name: 'remove breakpoint',
    nativeCursor: 'pointer',
    fontSize: 17,
    textAndAttributes: Icon.textAttribute('times'),
    tooltip: 'remove breakpoint'
  }]
});

const BreakpointControl = component({
  name: 'breakpoint control',
  clipMode: 'hidden',
  borderRadius: 5,
  extent: pt(545, 20),
  fill: Color.rgba(81, 90, 90, 0),
  layout: new TilingLayout({
    align: 'top',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true
  }),
  position: pt(34.4, 1.2),
  submorphs: [
    part(BreakpointRange, {
      name: 'base breakpoint',
      extent: pt(345.4, 20),
      fill: Color.rgb(244, 67, 54),
      opacity: 0.5,
      submorphs: [without('remove breakpoint')]
    }), part(BreakpointRange, { name: 'next breakpoint', fill: Color.rgb(255, 152, 0) })]
});

const ResponsiveLayoutHalo = component({
  type: ResponsiveLayoutMorphHalo,
  name: 'responsive layout halo',
  borderColor: Color.rgb(230, 126, 34),
  draggable: true,
  extent: pt(35.1, 35),
  fill: Color.rgba(46, 75, 223, 0),
  grabbable: true,
  position: pt(1272.9, 345.2),
  submorphs: [part(BreakpointVertical, {
    name: 'vertical slider',
    position: pt(-134.5, 355.1)
  }), part(BreakpointHorizontal, {
    name: 'horizontal slider',
    position: pt(334.5,-107.2)
  }), {
    name: 'horizontal control wrapper',
    borderStyle: 'none',
    fill: Color.rgba(255, 255, 255, 0),
    layout: new TilingLayout({
      axisAlign: 'center',
      hugContentsHorizontally: true,
      hugContentsVertically: true,
      orderByIndex: true,
      spacing: 7
    }),
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(605.9, 38.7),
    position: pt(26.8, -8.2),
    submorphs: [part(BreakpointControl, {
      name: 'horizontal breakpoint control',
      position: pt(9.2, 14.7),
      reactsToPointer: false
    }), {
      type: Label,
      name: 'add horizontal breakpoint',
      reactsToPointer: false,
      fontSize: 30.108,
      nativeCursor: 'pointer',
      position: pt(565.2, 11.2),
      textAndAttributes: Icon.textAttribute('plus-circle'),
      tooltip: 'Add horizontal breakpoint'
    }]
  }, {
    name: 'vertical control wrapper',
    borderStyle: 'none',
    fill: Color.rgba(255, 255, 255, 0),
    layout: new TilingLayout({
      axis: 'column',
      axisAlign: 'center',
      hugContentsHorizontally: true,
      hugContentsVertically: true,
      orderByIndex: true
    }),
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(137.2, 537.8),
    position: pt(-2.6, 32.8),
    submorphs: [part(BreakpointControl, {
      name: 'vertical breakpoint control',
      extent: pt(548, 20),
      position: pt(78.8, 5.3),
      rotation: 1.570796326794897,
      submorphs: [{
        name: 'base breakpoint',
        extent: pt(331.2, 20),
        fill: Color.rgb(76, 175, 80)
      }, {
        name: 'next breakpoint',
        extent: pt(194.9, 20),
        fill: Color.rgb(156, 39, 176),
        opacity: 0.5
      }]
    }), {
      type: Label,
      name: 'add vertical breakpoint',
      reactsToPointer: false,
      fontSize: 30.108,
      nativeCursor: 'pointer',
      position: pt(-3.2, 527.4),
      textAndAttributes: Icon.textAttribute('plus-circle'),
      tooltip: 'Add vertical breakpoint'
    }]
  }]
});

export { ResponsiveLayoutMorphHalo };
