import { GridLayout, TilingLayout, ViewModel, component, part, Label, Text, Icon, config } from 'lively.morphic';
import { Color, pt, rect } from 'lively.graphics';
import { DarkButton } from 'lively.components/buttons.cp.js';
import { DarkList } from 'lively.components/list.cp.js';
import { signal } from 'lively.bindings';
import { InspectionTree, PropertyTree, printValue } from '../inspector/context.js';

function frameLabel (frame, index) {
  const name = frame.functionName || '<anonymous>';
  const location = frame.location || {};
  const line = Number.isFinite(location.lineNumber) ? ':' + (location.lineNumber + 1) : '';
  return '#' + index + '  ' + name + line;
}

function sourceSummary (frame) {
  if (!frame) return '';
  const source = frame.source || {};
  const location = frame.location || {};
  const lines = [
    frame.functionName ? 'function ' + frame.functionName : '<anonymous frame>',
    source.url || source.scriptId || '(no source url)',
    Number.isFinite(location.lineNumber)
      ? 'line ' + (location.lineNumber + 1) + ', column ' + ((location.columnNumber || 0) + 1)
      : ''
  ].filter(Boolean);
  return lines.join('\n');
}

function scopeLabel (scope) {
  const names = scope.bindingNames();
  const suffix = names.length ? ' (' + names.length + ')' : '';
  return (scope.name || scope.type || 'scope') + suffix;
}

function valueTreeObjectForScope (scope) {
  const bindings = scope && scope.bindings;
  return bindings || {};
}

export class LivelyDebuggerModel extends ViewModel {
  static get properties () {
    return {
      continuation: {},
      selectedFrame: {},
      selectedScope: {},

      expose: {
        get () { return ['continuation', 'onWindowClose', 'closeDebugger']; }
      },

      bindings: {
        get () {
          return [
            { target: 'stack list', signal: 'selection', handler: 'selectFrame' },
            { target: 'scope list', signal: 'selection', handler: 'selectScope' },
            { target: 'close button', signal: 'fire', handler: 'closeDebugger' },
            { target: 'proceed button', signal: 'fire', handler: 'disabledAction' },
            { target: 'retry button', signal: 'fire', handler: 'disabledAction' },
            { target: 'step into button', signal: 'fire', handler: 'disabledAction' },
            { target: 'step over button', signal: 'fire', handler: 'disabledAction' },
            { target: 'step out button', signal: 'fire', handler: 'disabledAction' },
            { target: 'restart frame button', signal: 'fire', handler: 'disabledAction' }
          ];
        }
      }
    };
  }

  viewDidLoad () {
    this.refreshFromContinuation();
  }

  renderDraggableTreeLabel (args) {
    return args.value;
  }

  renderPropertyControl ({ keyString, valueString }) {
    return keyString + ': ' + valueString;
  }

  refreshSelectedLine () {}

  refreshFromContinuation () {
    const frames = this.continuation ? this.continuation.frames() : [];
    this.ui.stackList.items = frames.map((frame, index) => ({
      isListItem: true,
      string: frameLabel(frame, index),
      value: frame
    }));
    this.ui.stackList.selection = frames[0] || null;
    this.selectFrame(frames[0] || null);
    this.updateStatus();
    this.disableFutureButtons();
  }

  updateStatus () {
    const reason = this.continuation && this.continuation.reason || 'debugger';
    const exception = this.continuation && this.continuation.exception;
    const exceptionText = exception ? '  ' + printValue(exception) : '';
    this.ui.status.textString = reason + exceptionText;
  }

  disableFutureButtons () {
    for (const name of [
      'proceed button',
      'retry button',
      'step into button',
      'step over button',
      'step out button',
      'restart frame button'
    ]) {
      const button = this.ui[name];
      if (button && button.viewModel) button.viewModel.disable();
    }
  }

  selectFrame (frame) {
    this.selectedFrame = frame;
    this.ui.sourcePane.textString = sourceSummary(frame);
    const scopes = frame ? frame.scopes() : [];
    this.ui.scopeList.items = scopes.map(scope => ({
      isListItem: true,
      string: scopeLabel(scope),
      value: scope
    }));
    this.ui.scopeList.selection = scopes[0] || null;
    this.selectScope(scopes[0] || null);
  }

  async selectScope (scope) {
    this.selectedScope = scope;
    const tree = this.ui.valueTree;
    const treeData = InspectionTree.forObject(valueTreeObjectForScope(scope), this);
    await treeData.collapse(treeData.root, false);
    if (treeData.root.children && treeData.root.children[0]) {
      await treeData.collapse(treeData.root.children[0], false);
    }
    tree.treeData = treeData;
    if (tree.treeData.root.isCollapsed) {
      await tree.onNodeCollapseChanged({ node: treeData.root, isCollapsed: false });
      tree.selectedIndex = 1;
    }
  }

  disabledAction () {
    signal(this.view, 'debuggerActionUnavailable', this.selectedFrame);
  }

  onWindowClose () {
    if (this.continuation && this.continuation.release) this.continuation.release();
    this.continuation = null;
  }

  closeDebugger () {
    this.onWindowClose();
    const win = this.view.getWindow && this.view.getWindow();
    if (win) win.close(false);
    else this.view.remove();
  }
}

const ToolbarButton = component(DarkButton, {
  extent: pt(30, 24),
  padding: rect(4, 4, 0, 0),
  submorphs: [{
    name: 'label',
    fontSize: 13
  }]
});

export const LivelyDebugger = component({
  name: 'lively debugger',
  defaultViewModel: LivelyDebuggerModel,
  extent: pt(900, 560),
  fill: Color.rgb(247, 248, 248),
  borderRadius: 4,
  layout: new GridLayout({
    autoAssign: false,
    grid: [
      ['toolbar', 'toolbar'],
      ['stack list', 'main pane'],
      ['status', 'status']
    ],
    groups: {
      toolbar: { align: 'topLeft', resize: true },
      'stack list': { align: 'topLeft', resize: true },
      'main pane': { align: 'topLeft', resize: true },
      status: { align: 'topLeft', resize: true }
    },
    columns: [
      0, { fixed: 260, paddingRight: 6 },
      1, { width: 1 }
    ],
    rows: [
      0, { fixed: 36 },
      1, { height: 1 },
      2, { fixed: 26 }
    ]
  }),
  submorphs: [{
    name: 'toolbar',
    fill: Color.rgb(52, 73, 94),
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(6, 6, 6, 6),
      spacing: 5,
      resizePolicies: [['title', { width: 'fill', height: 'fixed' }]]
    }),
    submorphs: [
      part(ToolbarButton, {
        name: 'close button',
        tooltip: 'Close',
        viewModel: { label: { value: Icon.textAttribute('times') } }
      }),
      part(ToolbarButton, {
        name: 'proceed button',
        tooltip: 'Proceed',
        viewModel: { label: { value: Icon.textAttribute('play-circle') } }
      }),
      part(ToolbarButton, {
        name: 'retry button',
        tooltip: 'Retry',
        viewModel: { label: { value: Icon.textAttribute('redo') } }
      }),
      part(ToolbarButton, {
        name: 'step into button',
        tooltip: 'Step Into',
        viewModel: { label: { value: Icon.textAttribute('arrow-down') } }
      }),
      part(ToolbarButton, {
        name: 'step over button',
        tooltip: 'Step Over',
        viewModel: { label: { value: Icon.textAttribute('arrow-right') } }
      }),
      part(ToolbarButton, {
        name: 'step out button',
        tooltip: 'Step Out',
        viewModel: { label: { value: Icon.textAttribute('arrow-up') } }
      }),
      part(ToolbarButton, {
        name: 'restart frame button',
        tooltip: 'Restart Frame',
        viewModel: { label: { value: Icon.textAttribute('rotate-left') } }
      }),
      {
        type: Label,
        name: 'title',
        value: 'Lively Debugger',
        fontColor: Color.white,
        fontSize: 14,
        fontWeight: 'bold',
        reactsToPointer: false
      }
    ]
  },
  part(DarkList, {
    name: 'stack list',
    fill: Color.rgb(43, 50, 55),
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    itemHeight: 24,
    manualItemHeight: true,
    padding: rect(4, 4, 4, 4)
  }),
  {
    name: 'main pane',
    fill: Color.transparent,
    layout: new GridLayout({
      autoAssign: false,
      grid: [
        ['source pane'],
        ['scope/value pane']
      ],
      groups: {
        'source pane': { align: 'topLeft', resize: true },
        'scope/value pane': { align: 'topLeft', resize: true }
      },
      rows: [
        0, { fixed: 160, paddingBottom: 6 },
        1, { height: 1 }
      ]
    }),
    submorphs: [{
      type: Text,
      name: 'source pane',
      readOnly: true,
      fixedWidth: true,
      fixedHeight: true,
      lineWrapping: 'by-words',
      padding: rect(8, 8, 0, 0),
      borderColor: Color.rgb(189, 195, 199),
      borderWidth: 1,
      fill: Color.rgb(253, 253, 253),
      ...config.codeEditor.defaultStyle,
      fontSize: 13,
      textString: ''
    }, {
      name: 'scope/value pane',
      fill: Color.transparent,
      layout: new GridLayout({
        autoAssign: false,
        grid: [['scope list', 'value tree']],
        groups: {
          'scope list': { align: 'topLeft', resize: true },
          'value tree': { align: 'topLeft', resize: true }
        },
        columns: [
          0, { fixed: 190, paddingRight: 6 },
          1, { width: 1 }
        ]
      }),
      submorphs: [
        part(DarkList, {
          name: 'scope list',
          fill: Color.rgb(56, 64, 71),
          fontFamily: 'IBM Plex Mono',
          fontSize: 12,
          itemHeight: 22,
          manualItemHeight: true,
          padding: rect(4, 4, 4, 4)
        }),
        {
          type: PropertyTree,
          name: 'value tree',
          fill: Color.white,
          borderColor: Color.rgb(189, 195, 199),
          borderWidth: 1,
          clipMode: 'hidden',
          fontFamily: 'IBM Plex Mono',
          fontSize: 13,
          treeData: {}
        }]
    }]
  }, {
    type: Label,
    name: 'status',
    value: '',
    fill: Color.rgb(236, 240, 241),
    fontColor: Color.rgb(44, 62, 80),
    fontFamily: 'IBM Plex Sans',
    fontSize: 12,
    padding: rect(6, 4, 0, 0)
  }]
});

export function openForContinuation (continuation, world = null) {
  const debuggerMorph = part(LivelyDebugger, { viewModel: { continuation } });
  const targetWorld = world || (typeof $world !== 'undefined' && $world);
  const win = debuggerMorph.openInWindow({ title: 'Lively Debugger', world: targetWorld });
  if (win && win.activate) win.activate();
  return debuggerMorph;
}
