import { GridLayout, config, morph, Text, Icon, Label, component, part } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { DarkButton, SystemButton } from 'lively.components/buttons.cp.js';
import { SearchField } from 'lively.components/inputs.cp.js';
import { Inspector } from './index.js';
import { DropDownListModel } from 'lively.components/list.js';
import { DarkList } from 'lively.components/list.cp.js';
import { PropertyTree } from './context.js';
import { LabeledCheckboxLight } from 'lively.components';

const InstructionWidget = component({
  type: Text,
  fixedWidth: true,
  fixedHeight: true,
  lineWrapping: 'by-words',
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

const SmallList = component(DarkList, {
  fontSize: 10
});

const DarkDropDownList = component(DarkButton, {
  defaultViewModel: DropDownListModel,
  name: 'dark drop down list',
  submorphs: [{ name: 'label', fontSize: 12 }]
});

const SystemInspector = component({
  defaultViewModel: Inspector,
  name: 'system inspector',
  extent: pt(365.9, 502.7),
  fill: Color.transparent,
  layout: new GridLayout({
    autoAssign: false,
    grid: [['search bar'], ['property tree'], ['resizer'], ['code editor']],
    groups: {
      'search bar': {
        align: 'topLeft',
        resize: true
      },
      'property tree': {
        align: 'topLeft',
        resize: true
      },
      resizer: {
        align: 'topLeft',
        resize: true
      },
      'code editor': {
        align: 'topLeft',
        resize: true
      }
    },
    rows: [0, {
      fixed: 30
    }, 1, {
      height: 375
    }, 2, {
      fixed: 0
    }, 3, {
      fixed: 0
    }]
  }),
  submorphs: [{
    name: 'search bar',
    fill: Color.rgba(0, 0, 0, 0),
    layout: new GridLayout({
      autoAssign: false,
      grid: [['search field', 'target picker', 'internals', 'unknowns']],
      groups: {
        'search field': {
          align: 'topLeft',
          resize: true
        },
        'target picker': {
          align: 'topLeft',
          resize: true
        },
        internals: {
          align: 'topLeft',
          resize: true
        },
        unknowns: {
          align: 'topLeft',
          resize: true
        }
      },
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
      part(SystemButton, {
        viewModel: {
          label: { value: Icon.textAttribute('crosshairs') }
        },
        name: 'target picker',
        borderRadius: 20,
        padding: rect(2, 2, 0, 0),
        tooltip: 'Change Inspection Target'
      }),
      part(LabeledCheckboxLight, {
        viewModel: { label: 'internals', align: 'center' },
        name: 'internals'
      }),
      part(LabeledCheckboxLight, {
        viewModel: { label: 'unknowns', align: 'center' },
        name: 'unknowns'
      })]
  }, {
    type: PropertyTree,
    name: 'property tree',
    fill: Color.white,
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
    master: DarkButton,
    name: 'terminal toggler',
    position: pt(7.3, 572.6),
    isLayoutable: false,
    extent: pt(27, 19),
    fontColor: Color.white,
    nativeCursor: 'pointer',
    lineHeight: 1,
    fontSize: 15,
    padding: rect(4, 2, 0, 0),
    textAndAttributes: Icon.textAttribute('keyboard')
  }, {
    name: 'resizer',
    draggable: true,
    fill: Color.rgb(230, 230, 230),
    nativeCursor: 'ns-resize'
  }, {
    type: Text,
    name: 'code editor',
    readOnly: false,
    borderRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 6,
      bottomLeft: 6
    },
    lineWrapping: 'by-chars',
    padding: rect(4, 2, 0, 0),
    ...config.codeEditor.defaultStyle
  }, part(DarkButton, {
    viewModel: {
      label: { value: 'fix undeclared vars', fontSize: 12 }
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
    extent: pt(120, 22),
    isLayoutable: false,
    visible: false
  })]
});

function openInWindow (modelAttributes) {
  const inspector = part(SystemInspector, { viewModel: modelAttributes });
  const w = inspector.openInWindow();
  inspector.env.forceUpdate();
  inspector.viewModel.relayout();
  w.title = `Inspector for ${inspector.targetObject.name}`;
  return inspector;
}

export { DarkButton, DarkDropDownList, SystemInspector, InstructionWidget, openInWindow };
