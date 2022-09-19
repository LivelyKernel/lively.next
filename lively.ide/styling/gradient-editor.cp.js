import { Color, rect, LinearGradient, pt } from 'lively.graphics';
import { ShadowObject, component, part } from 'lively.morphic';
import { GradientHaloModel, GradientControlModel } from './gradient-editor.js';
import { CheckerPattern } from './shared.cp.js';

const GradientHalo = component({
  defaultViewModel: GradientHaloModel,
  name: 'gradient halo',
  borderColor: Color.rgb(23, 160, 251),
  dropShadow: new ShadowObject({
    rotation: 34, color: Color.rgba(0, 0, 0, 0.5), blur: 12, fast: false
  }),
  extent: pt(113.5, 70),
  fill: Color.rgba(0, 0, 0, 0),
  hasFixedPosition: true,
  origin: pt(0, 35),
  submorphs: [{
    name: 'color stop wrapper',
    position: pt(56.5, 0.2),
    dropShadow: false,
    extent: pt(113.5, 35.1),
    fill: Color.rgba(0, 0, 0, 0),
    origin: pt(56.7, 17.5),
    tilted: 1
  }, {
    name: 'origin handle',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 5,
    draggable: true,
    extent: pt(10, 10),
    nativeCursor: 'all-scroll'
  }, {
    name: 'direction handle',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 10,
    draggable: true,
    extent: pt(10, 10),
    nativeCursor: 'all-scroll'
  }, {
    name: 'orthogonal handle',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 10,
    draggable: true,
    extent: pt(10, 10),
    nativeCursor: 'all-scroll'
  }]
});

const GradientControl = component({
  viewModelClass: GradientControlModel,
  viewModel: { gradientHalo: part(GradientHalo) },
  name: 'gradient control',
  borderWidth: 0,
  borderColor: Color.rgb(215, 219, 221),
  extent: pt(241, 74.3),
  fill: Color.rgba(0, 0, 0, 0),
  isDisabled: true,
  isLayoutable: false,
  submorphs: [{
    name: 'gradient preview',
    position: pt(24.1, 42.9),
    borderWidth: 0,
    borderColor: Color.rgb(127, 140, 141),
    borderRadius: 3,
    clipMode: 'hidden',
    extent: pt(195.4, 15),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(CheckerPattern, {
      name: 'checkerboard pattern gradient',
      extent: pt(218.4, 38.8)
    }), {
      name: 'gradient',
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(196.3, 37),
      fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(71, 181, 65, 0.9877472914564251) }, { offset: 1, color: Color.transparent }], vector: rect(0, 0, 0, 0) }),
      reactsToPointer: false
    }]
  }]
});

export { GradientHalo, GradientControl };
