import { ViewModel, add, part, component } from 'lively.morphic/components/core.js';
import { pt, Color, rect } from 'lively.graphics';
import { TilingLayout, HorizontalLayout, VerticalLayout, HTMLMorph, Label, ShadowObject, InputLine, Text } from 'lively.morphic';
import { GreenButton, RedButton, LightPrompt } from 'lively.components/prompts.cp.js';
import { Spinner } from './shared.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { MullerColumnView } from 'lively.components/muller-columns.cp.js';

export class ComponentBrowserModel extends ViewModel {

}

// ComponentPreview.openInWorld()
const ComponentPreview = component({
  name: 'component preview',
  borderColor: Color.rgb(33, 150, 243),
  borderRadius: 5,
  borderWidth: 0,
  extent: pt(129, 135),
  fill: Color.transparent,
  layout: new VerticalLayout({
    align: 'center',
    autoResize: true,
    direction: 'topToBottom',
    orderByIndex: true,
    resizeSubmorphs: false,
    spacing: 6
  }),
  master: false,
  nativeCursor: 'pointer',
  position: pt(1186.4, 654.7),
  submorphs: [{
    name: 'preview container',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(117.3, 99.5),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: false,
      direction: 'centered',
      orderByIndex: true,
      resizeSubmorphs: false
    }),
    reactsToPointer: false,
    submorphs: [{
      name: 'component preview',
      borderColor: Color.rgb(23, 160, 251),
      dropShadow: new ShadowObject({ distance: 5, rotation: 75, color: Color.rgba(0, 0, 0, 0.2), blur: 20, fast: false }),
      extent: pt(105, 45),
      naturalExtent: pt(105, 45),
      reactsToPointer: false
    }]
  }, {
    type: Label,
    name: 'component name',
    fontColor: Color.darkGray,
    fontSize: 14,
    fontWeight: 'bold',
    reactsToPointer: false,
    textAndAttributes: ['Button', null]
  }]
});

// ComponentPreviewSelected.openInWorld()
const ComponentPreviewSelected = component(ComponentPreview, {
  name: 'component preview selected',
  borderColor: Color.rgb(33, 150, 243),
  borderWidth: 2,
  fill: Color.rgba(3, 169, 244, 0.75),
  submorphs: [{
    name: 'component name',
    fontColor: Color.rgb(255, 255, 255)
  }]
});

// ProjectSection.openInWorld()
const ProjectSection = component({
//  type: ProjectEntry,
  name: 'project section',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(488.6, 154.2),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new VerticalLayout({
    autoResize: false,
    direction: 'topToBottom',
    orderByIndex: true,
    resizeSubmorphs: true
  }),
  master: false,
  position: pt(647.1, 628.5),
  renderOnGPU: true,
  submorphs: [{
    type: Label,
    name: 'project title',
    borderColor: Color.rgb(215, 219, 221),
    fontColor: Color.rgb(66, 73, 73),
    borderWidthBottom: 2,
    fontSize: 20,
    fontWeight: 'bold',
    nativeCursor: 'pointer',
    padding: rect(10, 8, -2, 0),
    textAndAttributes: ['Project Name', {
    }, '  ', {
    }, '', {
      fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
      fontWeight: '900',
      nativeCursor: 'pointer',
      paddingTop: '3px',
      textStyleClasses: ['fas']
    }]
  }, {
    name: 'component previews',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(489, 101.2),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      orderByIndex: true,
      padding: rect(10, 10, 0, 0),
      spacing: 10
    })
  }]
});

// ComponentBrowser.openInWorld()
const ComponentBrowser = component(LightPrompt, {
  defaultViewModel: ComponentBrowserModel,
  name: 'component browser',
  epiMorph: false,
  extent: pt(515.1,599.9),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(16, 16, 0, 0),
    resizePolicies: [['search input', {
      height: 'fixed',
      width: 'fill'
    }], ['component files view', {
      height: 'fill',
      width: 'fill'
    }], ['master component list', {
      height: 'fill',
      width: 'fill'
    }], ['button wrapper', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 16,
    wrapSubmorphs: false
  }),
  submorphs: [{
    name: 'prompt title',
    textAndAttributes: ['Browse Components', null]
  }, add(part(InputLineDefault, {
    name: 'search input',
    extent: pt(640, 34.3),
    fontSize: 20,
    padding: rect(6, 4, -4, 0),
    placeholder: 'Search for Components...',
    submorphs: [add(part(Spinner, { name: 'spinner', visible: false })), {
      name: 'placeholder',
      extent: pt(232,34.3),
      padding: rect(6, 4, -4, 0),
      textAndAttributes: ['Search for Components...', null]
    }]
  })), add(part(MullerColumnView, {
    name: 'component files view',
    borderRadius: 5,
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) })
  })), add({
    name: 'master component list',
    borderRadius: 5,
    borderColor: Color.rgb(149, 165, 166),
    clipMode: 'auto',
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
    extent: pt(640, 304),
    layout: new VerticalLayout({
      autoResize: false,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: true
    })
  }), add({
    name: 'button wrapper',
    clipMode: "visible",
    extent: pt(486,52.6),
    fill: Color.rgba(255, 255, 255, 0.01),
    layout: new TilingLayout({
      align: 'right',
      axisAlign: 'center',
      orderByIndex: true,
      spacing: 15
    }),
    submorphs: [part(GreenButton, {
      name: 'import button',
      extent: pt(125.2, 38),
      submorphs: [{
        name: 'label',
        textAndAttributes: ['OPEN MASTER', null]
      }]
    }), part(RedButton, {
      name: 'cancel button'
    })]
  })]
});

export { ComponentBrowser, ComponentPreview, ComponentPreviewSelected };
