import { ProportionalLayout, Icon, TilingLayout, component, part } from 'lively.morphic';
import { pt, Color, rect } from 'lively.graphics';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { DropDownList, DefaultList } from 'lively.components/list.cp.js';
import { SystemList } from './styling/shared.cp.js';
import { CodeSearcher } from './code-search.js';
import { ButtonDefault } from 'lively.components/buttons.cp.js';

const ModeButtonInactive = component(ButtonDefault, {
  extent: pt(27, 27),
  borderStyle: 'none',
  fill: Color.transparent
});

const ModeButtonInactiveHover = component(ModeButtonInactive, {
  fill: Color.gray
});

const ModeButtonActiveClick = ModeButtonInactiveHover;

const ModeButtonInactiveClick = component(ModeButtonInactive, {
  fill: Color.darkGray
});

const ModeButtonActiveHover = ModeButtonInactiveClick;

const ModeButtonActive = component(ModeButtonInactive, {
  fill: Color.darkGray,
  submorphs: [{
    name: 'label',
    fontColor: Color.white
  }]
});

const ModeButtonDisabled = component(ModeButtonInactive, {
  visible: false,
  reactsToPointer: false
});

// part(CodeSearch).openInWorld()
const CodeSearch = component({
  type: CodeSearcher,
  name: 'code search',
  acceptsDrops: false,
  extent: pt(538, 306),
  layout: new ProportionalLayout({
    orderByIndex: true,
    lastExtent: {
      x: 538,
      y: 306
    },
    reactToSubmorphAnimations: false,
    submorphSettings: [
      ['reload', { x: 'fixed', y: 'fixed' }],
      ['input', { x: 'resize', y: 'fixed' }],
      ['holder', { x: 'move', y: 'fixed' }],
      ['list', {
        x: 'resize',
        y: 'resize'
      }], ['searchInUnloadedModulesCheckbox', {
        x: 'move',
        y: 'move'
      }], ['search in parts checkbox', {
        x: 'move',
        y: 'move'
      }], ['search in worlds checkbox', {
        x: 'move',
        y: 'move'
      }], ['search chooser', {
        x: 'move',
        y: 'fixed'
      }]]
  }),
  selectedAction: 'default',
  submorphs: [part(ModeButtonActive, {
    name: 'reload',
    height: 27,
    position: pt(0, 0),
    submorphs: [{
      name: 'label',
      textAndAttributes: Icon.textAttribute('rotate-right')
    }],
    master: { auto: ModeButtonInactive, hover: ModeButtonInactiveHover, click: ModeButtonInactiveClick },
    tooltip: 'Refresh Search Results'
  }),
  part(InputLineDefault, {
    name: 'input',
    borderWidth: 1,
    borderRadius: 6,
    dropShadow: null,
    fontSize: 14,
    extent: pt(243, 27),
    position: pt(27, 0),
    historyId: 'lively.morphic-code searcher',
    placeholder: 'Search Source Files'
  }), {
    name: 'holder',
    extent: pt(207, 27),
    position: pt(300, 0),
    fill: Color.transparent,
    layout: new TilingLayout({
      axisAlign: 'center',
      spacing: 2,
      align: 'center',
      axis: 'column'
    }),
    submorphs: [
      part(ModeButtonInactive, {
        name: 'caseMode',
        height: 22,
        submorphs: [{
          name: 'label',
          textAndAttributes: Icon.textAttribute('circle-h')
        }],
        master: { auto: ModeButtonInactive, hover: ModeButtonInactiveHover, click: ModeButtonInactiveClick },
        tooltip: 'Search Case Sensitive'
      }),
      part(ModeButtonInactive, {
        name: 'regexMode',
        height: 22,
        submorphs: [{
          name: 'label',
          textAndAttributes: Icon.textAttribute('circle-question')
        }],
        master: { auto: ModeButtonInactive, hover: ModeButtonInactiveHover, click: ModeButtonInactiveClick },
        tooltip: 'Search based on regular expressions.\nRegular expression should be given without quotes or literal mode slashes.'
      }),
      part(DropDownList, {
        name: 'search chooser',
        master: { auto: ModeButtonActive, click: ModeButtonInactiveClick },
        layout: new TilingLayout({
            align: 'center',
          axisAlign: 'center',
          orderByIndex: true,
          padding: rect(10, 0, 0, 0),
          wrapSubmorphs: false,
          hugContentsHorizontally: true
        }),
        height: 22,
        borderColor: Color.gray,
        viewModel: {
          openListInWorld: true,
          listMaster: SystemList,
          items: [
            'in loaded modules',
            'in loaded and unloaded modules',
            'in parts',
            'in worlds'
          ]
        },
        submorphs: [{
          name: 'label',
          fontSize: 12
        }]
      })]
  }, part(DefaultList, {
    name: 'list',
    extent: pt(538.7, 279.6),
    fontFamily: 'Monaco, monospace',
    itemPadding: rect(4, 2, 0, 0),
    padding: rect(2, 0, 0, 0),
    position: pt(0, 27)
  })
  ]
})
 ;

export { CodeSearch, ModeButtonActive, ModeButtonInactive, ModeButtonActiveClick, ModeButtonInactiveClick, ModeButtonActiveHover, ModeButtonInactiveHover, ModeButtonDisabled };
