import { GridLayout, Morph, TilingLayout, config, morph, Text, Icon, Label, component, part } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { DarkButton, SystemButton } from 'lively.components/buttons.cp.js';
import { SearchField } from 'lively.components/inputs.cp.js';
import { Inspector } from './index.js';
import { DropDownListModel } from 'lively.components/list.js';
import { DarkList } from 'lively.components/list.cp.js';
import { PropertyTree } from './context.js';
import { LabeledCheckboxLight } from 'lively.components';
import { MorphHighlighter } from 'lively.halos';
import { generateReferenceExpression } from './helpers.js';

class DraggedPropMorph extends Morph {
  static get properties () {
    return {
      control: {
        after: ['submorphs'],
        set (control) {
          this.setProperty('control', control);
          if (!control) return this.submorphs = [];
          this.submorphs = [control];
          control.fontSize = 14;
          if (typeof control.relayout === 'function') { control.relayout(); }
        }
      },
      sourceObject: {}
    };
  }

  applyToTarget (evt) {
    const { currentTarget: target, control } = this;
    this.remove();
    MorphHighlighter.removeHighlighters(evt.world);
    if (!target) return;

    if (!target.isText || target.editorModeName !== 'js') {
      // normal apply prop
      if ('propertyValue' in control) { target[control.keyString] = control.propertyValue; }
      return;
    }

    // rk 2017-10-01 FIXME this is a hack to get droppable code in...
    // this needs to go somewhere else and needs a better UI, at least
    const editor = target;
    const toObject = editor.evalEnvironment.context;
    const textPos = editor.textPositionFromPoint(editor.localize(evt.position));
    let expr = generateReferenceExpression(this.sourceObject, { fromMorph: toObject });
    if (control.keyString) expr += '.' + control.keyString;
    editor.insertTextAndSelect(expr, textPos);
    editor.focus();
  }

  update (evt) {
    const handPosition = evt.hand.globalPosition;
    let target = this.morphBeneath(handPosition);
    if (!target) return;
    if (target === this.morphHighlighter) {
      target = target.morphBeneath(handPosition);
    }
    while ([target, ...target.ownerChain()].find(m => !m.visible)) {
      target = target.morphBeneath(handPosition);
    }
    if (target !== this.currentTarget) {
      this.currentTarget = target;
      if (this.morphHighlighter) this.morphHighlighter.deactivate();
      if (target.isWorld) return;
      this.morphHighlighter = MorphHighlighter.for($world, target);
      this.morphHighlighter.show();
    }
    this.position = handPosition;
  }
}

export const DraggedProp = component({
  type: DraggedPropMorph,
  clipMode: 'hidden',
  origin: pt(10, 10),
  extent: pt(151.3, 41.9),
  fill: Color.rgba(255, 255, 251, 0.8),
  borderWidth: 2,
  borderColor: Color.rgb(169, 204, 227),
  borderRadius: 4,
  layout: new TilingLayout({
    align: 'right',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    padding: rect(5, 0, 0, 5)
  }),
  submorphs: [{
    type: Text,
    name: 'some placeholer control',
    dynamicCursorColoring: true,
    fill: Color.rgba(255, 255, 255, 0),
    position: pt(25.3, 12.6),
    textAndAttributes: ['I am a control!', null]
  }]
});

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
  fontFamily: 'IBM Plex Sans',
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
    fixedWidth: true,
    fixedHeight: true,
    lineWrapping: 'by-chars',
    padding: rect(4, 2, 0, 0),
    ...config.codeEditor.defaultStyle
  },
  {
    name: 'editor controls wrapper',
    extent: pt(365.1, 24.9),
    layout: new TilingLayout({
      padding: rect(5, 0, 0, 0),
      resizePolicies: [['filler', {
        height: 'fixed',
        width: 'fill'
      }]],
      spacing: 5
    }),
    reactsToPointer: false,
    fill: Color.transparent,
    submorphs: [
      {
        type: Label,
        master: DarkButton,
        name: 'terminal toggler',
        position: pt(7.3, 572.6),
        extent: pt(27, 19),
        fontColor: Color.white,
        nativeCursor: 'pointer',
        lineHeight: 1,
        fontSize: 15,
        padding: rect(4, 2, 0, 0),
        textAndAttributes: Icon.textAttribute('keyboard')
      },
      {
        name: 'filler',
        reactsToPointer: false,
        fill: Color.rgba(255, 255, 255, 0),
        extent: pt(103.7, 19.1),
        position: pt(569.6, 716.2)
      },
      part(DarkDropDownList, {
        viewModel: {
          listAlign: 'top',
          smartDropDown: false,
          label: 'this -> target',
          openListInWorld: true,
          listMaster: SmallList,
          listOffset: pt(0, -5)
        },
        name: 'this binding selector',
        position: pt(92.2, 571.2),
        extent: pt(120, 22),
        visible: false
      }),
      part(DarkButton, {
        viewModel: {
          label: { value: 'fix undeclared vars', fontSize: 12 }
        },
        name: 'fix import button',
        position: pt(221.4, 570.8),
        extent: pt(136, 22),
        visible: false
      })
    ]
  }]
});

function openInWindow (modelAttributes) {
  const inspector = part(SystemInspector, { viewModel: modelAttributes });
  const w = inspector.openInWindow();
  inspector.env.forceUpdate();
  inspector.relayout();
  w.title = `Inspector for ${inspector.targetObject.name}`;
  return inspector;
}

export { DarkButton, DarkDropDownList, SystemInspector, InstructionWidget, openInWindow };
