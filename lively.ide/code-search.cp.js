import { component, add, part } from 'lively.morphic/components/core.js';
import { ProportionalLayout, TilingLayout } from 'lively.morphic';
import { DropDownList, DefaultList } from 'lively.components/list.cp.js';
import { CodeSearcher } from './code-search.js';
import { pt, Color, rect } from 'lively.graphics';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { connect } from 'lively.bindings';
import { SystemList } from './styling/shared.cp.js';

// CodeSearch.openInWorld()
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
    }, add(part(DropDownList, {
      name: 'search chooser',
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        orderByIndex: true,
        padding: rect(10, 0, 0, 0),
        wrapSubmorphs: false,
        hugContentsHorizontally: true
      }),
      extent: pt(125.7, 21),
      borderColor: Color.gray,
      viewModel: {
        openListInWorld: true,
        listMaster: SystemList
      },
      submorphs: [{
        name: 'label',
        fontSize: 12
      }]
    }))]
  })
  ]
});

// initialize connections
connect(CodeSearch.get('input'), 'inputChanged', CodeSearch, 'updateFilter');
connect(CodeSearch.get('search chooser'), 'selection', CodeSearch, 'searchAgain');
connect(CodeSearch.get('list'), 'selection', CodeSearch, 'selectionChanged');
connect(CodeSearch.get('list'), 'onItemMorphDoubleClicked', CodeSearch, 'acceptInput');

export { CodeSearch };
