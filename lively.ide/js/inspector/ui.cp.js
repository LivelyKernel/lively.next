import { component, part } from 'lively.morphic/components/core.js';
import { GridLayout, morph, Text, Icon, Label } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { LabeledCheckBox, SearchField } from 'lively.components/inputs.cp.js';
import { Inspector } from './index.js';
import { DropDownListModel } from 'lively.components/list.js';
import { DarkList, DefaultList } from 'lively.components/list.cp.js';
import { PropertyTree } from './context.js';
import { Button } from 'lively.components';

// InstructionWidget.openInWorld()
const InstructionWidget = component({
  type: Text,
  fixedWidth: true,
  fixedHeight: true,
  lineWrapping: true,
  name: 'instruction widget',
  fontSize: 13,
  borderRadius: 3,
  padding: rect(10, 10, 0, 0),
  fill: Color.rgba(0, 0, 0, 0.75),
  fontColor: Color.rgb(255, 255, 255),
  fontFamily: '"IBM Plex Sans",Sans-Serif',
  extent: pt(140, 135),
  textAndAttributes: [
    'Select a new morph to inspect by hovering over it and clicking left. You can exit this mode by pressing ',
    {},
    morph({
      type: 'label',
      name: 'escapeKey',
      borderRadius: 5,
      borderWidth: 1,
      padding: rect(5, 0, 0, 2),
      fontWeight: 'bold',
      fontColor: Color.rgb(255, 255, 255),
      position: pt(62.5, 100.9),
      value: 'esc'
    }), {}
  ]
});

const DarkButton = component(ButtonDefault, {
  name: 'dark button',
  borderWidth: 0,
  extent: pt(115, 20),
  fill: Color.rgba(0, 0, 0, 0.5),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(255, 255, 255),
    fontSize: 12,
    reactsToPointer: false,
    textAndAttributes: ['a button', null]
  }]
});

const SmallList = component(DarkList, {
  fontSize: 10
});

// part(SmallList, { items: [1,2,3]}).openInWorld()

// DarkButton.openInWorld()

const DarkDropDownList = component(DarkButton, {
  defaultViewModel: DropDownListModel,
  name: 'dark drop down list'
});

// part(SystemInspector).openInWindow()
// part(DarkDropDownList, { items: [1,2,3], listMaster: DarkList}).openInWorld()
// part(SystemInspector, { viewModel: { targetObject: this } }).openInWindow()
const SystemInspector = component({
  defaultViewModel: Inspector,
  name: 'system inspector',
  extent: pt(365.9, 502.7),
  fill: Color.transparent,
  layout: new GridLayout({
    autoAssign: false,
    grid: [['search bar'], ['property tree'], ['resizer'], ['code editor']],
    rows: [0, {
      fixed: 30
    }, 1, {
      height: 375
    }, 2, {
      fixed: 0
    }, 3, {
      height: 0
    }]
  }),
  submorphs: [{
    name: 'search bar',
    fill: Color.rgba(0, 0, 0, 0),
    layout: new GridLayout({
      autoAssign: false,
      grid: [['search field', 'target picker', 'internals', 'unknowns']],
      columns: [0, {
        paddingLeft: 5,
        paddingRight: 2,
        width: 100
      }, 1, {
        fixed: 22
      }, 2, {
        fixed: 80
      }, 3, {
        fixed: 90,
        paddingRight: 5
      }],
      rows: [0, {
        height: 30,
        paddingBottom: 3,
        paddingTop: 3
      }]
    }),
    submorphs: [
      part(SearchField, {
        viewModel: { placeholder: 'Search' },
        name: 'search field'
      }),
      part(ButtonDefault, {
        viewModel: {
          label: { value: Icon.textAttribute('crosshairs') }
        },
        name: 'target picker',
        borderRadius: 20,
        padding: rect(2, 2, 0, 0),
        tooltip: 'Change Inspection Target'
      }),
      part(LabeledCheckBox, {
        viewModel: { label: 'internals' },
        name: 'internals'
      }),
      part(LabeledCheckBox, {
        viewModel: { label: 'unknowns' },
        name: 'unknowns'
      })]
  }, {
    type: PropertyTree,
    name: 'property tree',
    readOnly: true,
    borderColor: Color.rgb(204, 204, 204),
    borderWidth: 1,
    clipMode: 'hidden',
    draggable: true,
    selectable: true,
    fontFamily: '"IBM Plex Mono"',
    fontSize: 14,
    treeData: {}
  }, {
    type: Label,
    name: 'terminal toggler',
    position: pt(7.3, 572.6),
    isLayoutable: false,
    extent: pt(27, 19),
    borderRadius: 5,
    fill: Color.rgba(0, 0, 0, 0.5),
    fontColor: Color.rgb(255, 255, 255),
    fontSize: 15,
    nativeCursor: 'pointer',
    padding: rect(5, 2, 0, 0),
    textAndAttributes: Icon.textAttribute('keyboard')
  }, {
    name: 'resizer',
    draggable: true,
    fill: Color.rgb(230, 230, 230),
    nativeCursor: 'ns-resize'
  }, {
    type: Text,
    name: 'code editor',
    borderColor: Color.rgb(204, 204, 204),
    borderWidth: 1,
    clipMode: 'auto',
    fixedHeight: true,
    fixedWidth: true,
    fontFamily: 'IBM Plex Mono',
    lineWrapping: 'by-chars',

    padding: rect(4, 2, 0, 0)
  }, part(DarkButton, {
    viewModel: {
      label: { value: 'fix undeclared vars' }
    },
    name: 'fix import button',
    position: pt(221.4, 570.8),
    isLayoutable: false,
    extent: pt(136, 22),
    visible: false
  }), part(DarkDropDownList, {
    viewModel: {
      listAlign: 'top',
      label: 'this -> target',
      listMaster: SmallList,
      listOffset: pt(0, -5)
    },
    name: 'this binding selector',
    position: pt(92.2, 571.2),
    height: 22,
    isLayoutable: false,
    visible: false
  })]
});

function openInWindow (modelAttributes) {
  return part(SystemInspector, { viewModel: modelAttributes }).openInWindow();
}

// SystemInspector.openInWorld()

export { DarkButton, DarkDropDownList, SystemInspector, InstructionWidget, openInWindow };
