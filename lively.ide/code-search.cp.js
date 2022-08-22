import { ProportionalLayout, Icon, TilingLayout, component, add, part } from 'lively.morphic';
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
    lastExtent: {
      x: 538,
      y: 306
    },
    reactToSubmorphAnimations: false,
    submorphSettings: [['input', {
      x: 'resize',
      y: 'fixed'
    }], ['list', {
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
  submorphs: [part(DefaultList, {
    name: 'list',
    extent: pt(538.7, 279.6),
    fontFamily: 'Monaco, monospace',
    itemPadding: rect(4, 2, 0, 0),
    padding: rect(2, 0, 0, 0),
    position: pt(0, 27)
  }), part(InputLineDefault, {
    name: 'input',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      orderByIndex: true,
      padding: rect(5, 0, 0, 0),
      wrapSubmorphs: false
    }),
    borderWidth: 1,
    dropShadow: null,
    fontSize: 14,
    borderRadius: 0,
    extent: pt(538.7, 27),
    historyId: 'lively.morphic-code searcher',
    placeholder: 'Search Source Files',
    submorphs: [{
      name: 'placeholder',
      extent: pt(133, 27),
      fontSize: 14,
      padding: rect(5, 5, 0, 0),
      textAndAttributes: ['Search Source Files', null]
    }, add({ name: 'buffer', opacity: 0, reactsToPointer: false }),
    add({
      name: 'holder',
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
          extent: pt(125.7, 22),
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
    })]
  })]
})
 ;

export { CodeSearch, ModeButtonActive, ModeButtonInactive, ModeButtonActiveClick, ModeButtonInactiveClick, ModeButtonActiveHover, ModeButtonInactiveHover, ModeButtonDisabled };
