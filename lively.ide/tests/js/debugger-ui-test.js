/* global describe, it, System, $world */
import { expect } from 'mocha-es6';
import {
  initialFrameForContinuation,
  lineRangeForFrame,
  locationStringForFrame,
  moduleUrlForFrame,
  readFrameSource,
  sourceSummary,
  sourceUrlForFrame
} from '../../js/debugger/source.js';
import { evaluateInDebuggerScopes } from '../../js/debugger/evaluation.js';

function frame (spec = {}) {
  return {
    functionName: spec.functionName || 'smokeInner',
    source: {
      url: spec.url === undefined ? 'file:///tmp/debugger-smoke.js' : spec.url,
      scriptId: spec.scriptId || 'script-1'
    },
    location: {
      scriptId: spec.scriptId || 'script-1',
      lineNumber: spec.lineNumber === undefined ? 1 : spec.lineNumber,
      columnNumber: spec.columnNumber === undefined ? 3 : spec.columnNumber
    },
    scopes () { return []; }
  };
}

describe('lively debugger ui', function () {
  it('saves the whole module in the debugger and applies future edits to the suspended computation', async function () {
    this.timeout(10000);
    const { resource } = await System.import('lively.resources');
    const { module } = await System.import('lively.modules');
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
    const file = resource('local://debugger-save-test/counter.js');
    const source = 'export class Counter { increment() { let amount = 2; debugger; this.count += amount; return this.count; } other() { return 1; } }';
    await file.write(source);
    const mod = module(file.url);
    let view;
    try {
      const { Counter } = await mod.load();
      const counter = new Counter();
      counter.count = 0;
      view = openForContinuation(run(counter.increment, null, [], {this: counter}), $world);
      const model = view.viewModel, pane = model.ui.sourcePane;
      await model.selectFrame(model.continuation.currentFrame);
      expect(pane.readOnly).equals(false);
      const edited = source.replace('+= amount;', '+= amount * 3;').replace('return 1;', 'return 7;');
      pane.textString = edited;
      await model.stepOver();
      await model.selectFrame(model.continuation.currentFrame);
      expect(pane.textString).equals(edited);
      expect(await pane.execCommand('save debugger module')).equals(true);
      expect(await file.read()).equals(edited);
      expect(counter.other()).equals(7);
      expect(counter.constructor).equals(Counter);
      expect(counter.count).equals(0);
      const external = edited + '\n// saved from another editor';
      await mod.changeSource(external);
      expect((await model.applySavedMethod()).isContinuation).equals(true);
      await model.selectFrame(model.continuation.currentFrame);
      expect(pane.textString).equals(external);
      expect(pane.getLine(pane.selection.range.start.row)).contains('amount * 3');
      expect(await model.proceed()).equals(6);
      expect(counter.count).equals(6);
    } finally {
      if (view) {
        view.viewModel.sourceBuffers?.clear();
        await view.viewModel.closeDebugger();
      }
      await mod.unload();
      await file.remove();
    }
  });

  it('keeps invalid drafts and protects external changes and closing from data loss', async function () {
    this.timeout(10000);
    const { resource } = await System.import('lively.resources');
    const { module } = await System.import('lively.modules');
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
    const file = resource('local://debugger-save-test/guard.js');
    const source = 'export class Guard { task() { debugger; return 1; } }';
    await file.write(source);
    const mod = module(file.url);
    let view;
    const confirm = $world.confirm;
    try {
      const { Guard } = await mod.load();
      view = openForContinuation(run(Guard.prototype.task, null, [], {this: new Guard()}), $world);
      const model = view.viewModel, pane = model.ui.sourcePane;
      await model.selectFrame(model.continuation.currentFrame);
      pane.textString = source + '\nthis is invalid JavaScript';
      expect(await model.saveModule()).equals(false);
      expect(await file.read()).equals(source);
      expect(model.hasUnsavedChanges()).equals(true);
      pane.textString = source.replace('return 1', 'return 2');
      const external = source + '\n// changed outside the debugger';
      await file.write(external);
      let prompts = 0;
      $world.confirm = async () => { prompts++; return false; };
      expect(await model.saveModule()).equals(false);
      expect(await file.read()).equals(external);
      expect(await model.onWindowClose()).equals(false);
      expect(!!model.continuation).equals(true);
      expect(prompts).equals(2);
    } finally {
      $world.confirm = confirm;
      if (view) {
        if (view.viewModel.sourceBuffers) view.viewModel.sourceBuffers.clear();
        await view.viewModel.closeDebugger();
      }
      await mod.unload();
      await file.remove();
    }
  });

  it('uses transparent window controls and grouped browser buttons without a duplicate title', async function () {
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
    const view = openForContinuation(run(function toolbarLayout () { debugger; }), $world);
    try {
      await view.whenRendered();
      view.env.forceUpdate();
      expect(view.fill.a).equals(0);
      expect(view.get('toolbar').fill.a).equals(0);
      expect(view.get('toolbar').submorphs.some(morph => morph.name === 'title')).equals(false);
      const bounds = name => document.getElementById(view.get(name).id).getBoundingClientRect();
      expect(bounds('retry button').left).closeTo(bounds('proceed button').right, 0.5);
      expect(bounds('step into button').left - bounds('retry button').right).at.least(12);
      expect(bounds('step over button').left).closeTo(bounds('step into button').right, 0.5);
      expect(bounds('save module button').left).closeTo(bounds('edit method button').right, 0.5);
      expect(bounds('apply method button').left).closeTo(bounds('save module button').right, 0.5);
      const { pt } = await System.import('lively.graphics');
      expect(!!view.getSubmorphNamed('workspace do button')).equals(false);
      for (const name of ['step over button']) {
        const button = view.get(name), box = bounds(name);
        const position = pt(box.left + box.width / 2, box.top + box.height / 2);
        expect(button.viewModel.considerPress({ positionIn: morph => morph.localize(position) })).equals(true);
      }
    } finally { view.viewModel.closeDebugger(); }
  });

  it('shows the original module with syntax colors and an accurate statement highlight', async function () {
    this.timeout(10000);
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { LiveCounter } = await System.import('lively.ide/js/debugger/examples/live-counter.js');
    const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
    const counter = new LiveCounter();
    const continuation = run(counter.increment, null, [], {this: counter});
    const view = openForContinuation(continuation, $world);
    try {
      const model = view.viewModel, pane = model.ui.sourcePane;
      await model.selectFrame(continuation.currentFrame);
      const { RuntimeSourceDescriptor } = await System.import('lively.classes/source-descriptors.js');
      expect(pane.textString).equals(RuntimeSourceDescriptor.for(LiveCounter).moduleSource);
      expect(pane.textString).contains('export class LiveCounter extends Morph');
      expect(pane.textString).contains('  increment () {');
      expect(pane.textString).not.contains('function LiveCounter_increment_');
      expect(view.getWindow().title).equals('debugger - [lively.ide] js/debugger/examples/live-counter.js');
      expect(!!view.getSubmorphNamed('source header')).equals(false);
      view.env.forceUpdate();
      const bounds = morph => document.getElementById(morph.id).getBoundingClientRect();
      expect(bounds(pane).top).closeTo(bounds(view.get('toolbar')).bottom, 0.5);
      const plugin = pane.pluginFind(p => p.isJSEditorPlugin);
      expect(!!plugin).equals(true);
      for (const fontSize of [13, 16, 22]) {
        pane.fontSize = fontSize;
        await pane.whenFontLoaded();
        model.refreshSelectedLine();
        pane.env.forceUpdate();
        plugin.highlight();
        pane.env.forceUpdate();
        const row = pane.selection.range.start.row;
        expect(pane.getLine(row).trim()).equals('if (this.pause) debugger;');
        const node = pane.env.renderer.getNodeForMorph(pane);
        const line = Array.from(node.querySelectorAll('.newtext-text-layer.actual .line'))
          .find(line => Number(line.dataset.row) === row);
        expect(new Set(Array.from(line.querySelectorAll('span')).map(span => span.style.color)).size).above(1);
        const bounds = line.getBoundingClientRect();
        const selection = pane.renderingState.selectionNodes[0].getBoundingClientRect();
        expect(selection.top).closeTo(bounds.top, 0.5);
        expect(selection.height).closeTo(bounds.height, 0.5);
        const marker = node.querySelector('.newtext-marker-layer').getBoundingClientRect();
        expect(marker.top).closeTo(bounds.top, 0.5);
        expect(marker.height).closeTo(bounds.height, 1);
      }
      const targetRow = pane.textString.split('\n').findIndex(line => line.trim() === 'this.count += amount;');
      pane.selection.range = {start: {row: targetRow, column: 4}, end: {row: targetRow, column: 4}};
      const stopped = await model.runToCursor();
      expect(stopped.isContinuation).equals(true);
      await model.selectFrame(stopped.currentFrame);
      expect(pane.selection.range.start.row).equals(targetRow);
      expect(counter.count).equals(0);
      const capturedFrame = frame({url: 'https://example.org:9012/lively.ide/example.js'});
      capturedFrame.source.sourceText = 'function captured () {\n  debugger;\n}';
      await model.selectFrame(capturedFrame);
      expect(view.getWindow().title).equals('debugger - lively.ide/example.js');
      expect(!!pane.document).equals(true);
      await model.selectFrame(stopped.currentFrame);
      expect(view.getWindow().title).equals('debugger - [lively.ide] js/debugger/examples/live-counter.js');
    } finally { view.viewModel.closeDebugger(); }
  });

  it('keeps original module positions when stepping into a method or nested closure', async function () {
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { stepInspectorContinuation } = await System.import('lively.context/lib/inspector-interpreter.js');
    const { LiveCounter } = await System.import('lively.ide/js/debugger/examples/live-counter.js');
    const { RuntimeSourceDescriptor } = await System.import('lively.classes/source-descriptors.js');
    const counter = new LiveCounter();
    for (const [method, statement, callerStatement] of [
      ['nestedLesson', 'let doubled = value * 2;', 'let amount = this.double(2);'],
      ['scopeLesson', 'read = function () { return amount; };', 'this.count = read();']
    ]) {
      let stopped = run(counter[method], null, [], {this: counter});
      stopped = stepInspectorContinuation(stopped);
      stopped = stepInspectorContinuation(stopped, {action: 'stepInto'});
      expect(stopped.frames()).length(2);
      for (const frame of stopped.frames()) {
        const source = await readFrameSource(frame);
        expect(source).equals(RuntimeSourceDescriptor.for(LiveCounter).moduleSource);
        const row = lineRangeForFrame(frame, source).start.row;
        expect(source.split('\n')[row].trim()).equals(frame === stopped.currentFrame ? statement : callerStatement);
        expect(locationStringForFrame(frame)).contains('/live-counter.js:');
      }
    }
  });

  it('renders a syntax highlighted workspace whose editor commands evaluate in the suspended scope', async function () {
    this.timeout(10000);
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
    const view = openForContinuation(run(function workspaceLayout () {
      var amount = 2;
      debugger;
      return amount;
    }), $world);
    try {
      const model = view.viewModel, input = model.ui.workspaceInput;
      await model.selectFrame(model.continuation.currentFrame);
      expect(!!view.getSubmorphNamed('status')).equals(false);
      expect(!!view.getSubmorphNamed('workspace do button')).equals(false);
      expect(model.isWorkspaceVisible()).equals(false);
      const scopes = view.get('scope/value pane');
      const bounds = morph => document.getElementById(morph.id).getBoundingClientRect();
      const assertWorkspaceLayout = () => {
        view.env.forceUpdate();
        const pane = bounds(input), divider = bounds(model.ui.workspaceResizer);
        const toggle = bounds(model.ui.terminalToggler);
        expect(divider.top).closeTo(bounds(scopes).bottom, 0.5);
        expect(divider.height).closeTo(5, 0.5);
        expect(pane.top).closeTo(divider.bottom, 0.5);
        expect(toggle.top).at.least(pane.top);
        expect(toggle.bottom).at.most(pane.bottom);
        expect(bounds(model.ui.workspaceControls).bottom).closeTo(pane.bottom, 0.5);
        expect(pane.bottom).closeTo(bounds(view).bottom, 0.5);
      };
      const collapsedHeight = scopes.height;
      const windowExtent = view.getWindow().extent;
      await view.execCommand('focus debugger workspace');
      view.env.forceUpdate();
      expect(model.isWorkspaceVisible()).equals(true);
      expect(scopes.height).below(collapsedHeight);
      expect(view.getWindow().extent.equals(windowExtent)).equals(true);
      expect(model.ui.workspaceResizer.visible).equals(true);
      assertWorkspaceLayout();
      input.textString = 'let scratch = amount * 2; scratch';
      await new Promise(resolve => setTimeout(resolve, 100));
      const plugin = input.pluginFind(p => p.isJSEditorPlugin);
      expect(!!plugin).equals(true);
      plugin.highlight();
      input.env.forceUpdate();
      const node = document.getElementById(input.id);
      expect(node.getBoundingClientRect().width).above(100);
      expect(node.getBoundingClientRect().height).above(50);
      expect(node.textContent).contains('amount');
      expect(new Set(Array.from(node.querySelectorAll('.newtext-text-layer.actual span')).map(span => span.style.color)).size).above(1);
      input.selectAll();
      expect((await input.execCommand('doit')).value).equals(4);
      expect(model.workspaceBindings.scratch).equals(4);
      model.adjustWorkspaceProportions({ state: { dragDelta: { y: -20 } } });
      view.env.forceUpdate();
      const workspaceHeight = input.height;
      assertWorkspaceLayout();
      model.toggleWorkspace();
      view.env.forceUpdate();
      expect(model.isWorkspaceVisible()).equals(false);
      expect(scopes.height).closeTo(collapsedHeight, 0.5);
      expect(model.ui.workspaceResizer.visible).equals(false);
      const collapsedToggle = bounds(model.ui.terminalToggler);
      expect(collapsedToggle.top).at.least(bounds(scopes).top);
      expect(collapsedToggle.bottom).at.most(bounds(scopes).bottom);
      expect(bounds(model.ui.workspaceControls).bottom).closeTo(bounds(scopes).bottom, 0.5);
      expect(bounds(scopes).bottom).closeTo(bounds(view).bottom, 0.5);
      model.toggleWorkspace();
      view.env.forceUpdate();
      expect(input.height).closeTo(workspaceHeight, 0.5);
      expect(view.getWindow().extent.equals(windowExtent)).equals(true);
      expect(input.textString).equals('let scratch = amount * 2; scratch');
      expect(model.workspaceBindings.scratch).equals(4);
      assertWorkspaceLayout();
      input.textString = 'amount = scratch - 1';
      input.selectAll();
      expect((await input.execCommand('doit')).value).equals(3);
      expect(model.selectedFrame.getScope().get('amount')).equals(3);
      input.textString = 'false';
      input.selectAll();
      const result = await input.doEval();
      expect(result.isError).equals(false);
      expect(result.value).equals(false);
      input.textString = 'amount';
      expect(await model.evaluateWorkspace()).equals(3);
      input.textString = 'amount';
      input.selectAll();
      await input.execCommand('printit');
      expect(input.textString).contains('3');
      const errors = [];
      view.showError = input.showError = error => errors.push(String(error));
      model.ui.sourcePane.textString += '\n// edited source';
      expect(model.runToCursor()).equals(false);
      expect(errors.pop()).contains('Run to Cursor failed');
      input.textString = 'missingDebuggerWorkspaceValue';
      input.selectAll();
      expect((await input.execCommand('doit')).isError).equals(true);
      expect(errors.pop()).contains('missingDebuggerWorkspaceValue');
      expect(await model.evaluateWorkspace()).equals(false);
      expect(errors.pop()).contains('missingDebuggerWorkspaceValue');
      model.sourceBuffers.clear();
    } finally { view.viewModel.closeDebugger(); }
  });

  it('shows scope bindings directly and keeps object expansion and navigation working', async function () {
    this.timeout(10000);
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
    const receiver = {name: 'receiver'};
    const view = openForContinuation(run(function variableTree () {
      let amount = 2;
      const item = {nested: {answer: 42}, inspectee: 'a real property'};
      debugger;
      return item;
    }, null, [], {this: receiver}), $world);
    try {
      const model = view.viewModel, tree = model.ui.valueTree;
      await model.selectFrame(model.continuation.currentFrame);
      const scope = model.ui.scopeList.items.find(item => item.value.bindingNames().includes('item')).value;
      await model.selectScope(scope);
      view.env.forceUpdate();
      expect(tree.textString).not.contains('inspectee:');
      expect(tree.textString).contains('amount: 2');
      expect(tree.treeData.getContextFor(tree.treeData.root)).equals(scope.bindings);
      const item = tree.treeData.root.children.find(node => node.key === 'item');
      expect(item.value).equals(model.selectedFrame.lookup('item'));
      expect(tree.treeData.parentNode(item)).equals(tree.treeData.root);
      await tree.onNodeCollapseChanged({node: item, isCollapsed: false});
      expect(tree.textString).contains('inspectee:');
      expect(tree.textString).contains('a real property');
      const nested = item.children.find(node => node.key === 'nested');
      await tree.onNodeCollapseChanged({node: nested, isCollapsed: false});
      expect(tree.textString).contains('answer: 42');
      tree.selectedNode = nested;
      await tree.execCommand('goto parent');
      expect(tree.selectedNode).equals(item);
      await tree.onNodeCollapseChanged({node: item, isCollapsed: true});
      expect(tree.textString).not.contains('answer:');
      const receiverScope = model.ui.scopeList.items.find(item => item.value.type === 'receiver').value;
      await model.selectScope(receiverScope);
      expect(tree.textString).not.contains('inspectee:');
      expect(tree.treeData.root.children[0].key).equals('this');
      expect(tree.treeData.root.children[0].value).equals(receiver);
      await model.selectScope(null);
      expect(tree.textString.trim()).equals('');
      expect(tree.selectedNode).equals(null);
    } finally { await view.viewModel.closeDebugger(); }
  });

  it('shows the source and current statement of a rewriter continuation', async function () {
    const originalFrame = {
      func: { getSource: () => 'function increment() {\n  debugger;\n}' },
      getOriginalAst: () => ({ sourceFile: '[runtime]' }),
      getPC: () => ({ loc: { start: { line: 2, column: 2 } } })
    };
    const source = await readFrameSource(originalFrame);
    expect(moduleUrlForFrame(originalFrame)).equals(null);
    expect(source).contains('function increment');
    expect(lineRangeForFrame(originalFrame, source).start.row).equals(1);
  });

  it('loads source text through the captured frame URL', async function () {
    const capturedFrame = frame();
    let requestedUrl;
    const source = await readFrameSource(capturedFrame, async url => {
      requestedUrl = url;
      return 'function smokeInner() {\n  halt();\n}\n';
    });

    expect(sourceUrlForFrame(capturedFrame)).equals('file:///tmp/debugger-smoke.js');
    expect(requestedUrl).equals('file:///tmp/debugger-smoke.js');
    expect(source).contains('halt();');
  });

  it('uses source text captured by the inspector before fetching URLs', async function () {
    const capturedFrame = frame();
    capturedFrame.source.sourceText = 'function captured() {\n  halt();\n}\n';
    const source = await readFrameSource(capturedFrame, async () => {
      throw new Error('should not fetch');
    });

    expect(source).contains('function captured');
    expect(source).contains('halt();');
  });

  it('falls back to a source summary when source cannot be loaded', async function () {
    const capturedFrame = frame({ url: '' });
    const summary = await readFrameSource(capturedFrame);

    expect(summary).equals(sourceSummary(capturedFrame));
    expect(summary).contains('function smokeInner');
    expect(summary).contains('line 2, column 4');
  });

  it('maps captured V8 locations to a source line range', function () {
    const source = 'const first = 1;\nconst stopped = 2;\nconst third = 3;';
    const capturedFrame = frame({ lineNumber: 1, columnNumber: 14 });

    expect(locationStringForFrame(capturedFrame)).equals('file:///tmp/debugger-smoke.js:2:15');
    expect(locationStringForFrame(frame({url: 'https://example.org:9012/lively.ide/example.js', lineNumber: 1, columnNumber: 14})))
      .equals('lively.ide/example.js:2:15');
    expect(lineRangeForFrame(capturedFrame, source)).deep.equals({
      start: { row: 1, column: 0 },
      end: { row: 1, column: 'const stopped = 2;'.length }
    });
  });

  it('opens halt captures on the caller frame instead of the inspector runtime', function () {
    const runtimeFrame = frame({
      functionName: 'halt',
      url: 'http://127.0.0.1:9012/lively.context/lib/inspector-runtime.js',
      lineNumber: 525
    });
    const runtimeFrameWithoutUrl = frame({
      functionName: 'halt',
      url: '',
      lineNumber: 525
    });
    runtimeFrameWithoutUrl.source.sourceText = [
      'const HALT_UNWIND_TAG = "lively.context.inspector.halt";',
      'class InspectorHaltUnwind {}',
      'export function halt() {}'
    ].join('\n');
    const callerFrame = frame({
      functionName: 'smokeInner',
      url: 'http://127.0.0.1:9012/smoke-debugger.js',
      lineNumber: 12
    });

    expect(initialFrameForContinuation({ reason: 'halt' }, [runtimeFrame, callerFrame])).equals(callerFrame);
    expect(initialFrameForContinuation({ reason: 'desktop debugger smoke' }, [runtimeFrameWithoutUrl, callerFrame])).equals(callerFrame);
    expect(initialFrameForContinuation({ reason: 'desktop debugger smoke' }, [runtimeFrame, callerFrame])).equals(callerFrame);
    expect(initialFrameForContinuation({ reason: 'exception' }, [callerFrame, runtimeFrame])).equals(callerFrame);
  });

  it('evaluates workspace code against actual selected scope bindings', function () {
    const marker = { label: 'actual object' };
    const selectedScope = { bindings: { marker, count: 2 } };
    const outerScope = { bindings: { count: 99, outer: 4 } };

    const result = evaluateInDebuggerScopes('marker.count = count + outer, marker', [selectedScope, outerScope]);

    expect(result).equals(marker);
    expect(marker.count).equals(6);
  });

  it('evaluates this against the selected frame receiver', function () {
    const receiver = { count: 3 };
    const scopes = [{ bindings: { this: receiver } }, { bindings: { amount: 2 } }];

    expect(evaluateInDebuggerScopes('this', scopes)).equals(receiver);
    expect(evaluateInDebuggerScopes('this.count += amount', scopes)).equals(5);
    expect(receiver.count).equals(5);
  });

  it('writes workspace assignments back into the selected scope binding', function () {
    const selectedScope = { bindings: { count: 2 } };

    const result = evaluateInDebuggerScopes('count = count + 5', [selectedScope]);

    expect(result).equals(7);
    expect(selectedScope.bindings.count).equals(7);
  });

  it('retains workspace temporaries using the existing Lively evaluation recorder', function () {
    const workspace = {type: 'workspace', bindings: {}};
    const scopes = [workspace, {bindings: {amount: 3}}];
    expect(evaluateInDebuggerScopes('let scratch = amount * 2; scratch', scopes)).equals(6);
    expect(evaluateInDebuggerScopes('scratch += amount', scopes)).equals(9);
    expect(workspace.bindings.scratch).equals(9);
  });

  it('uses a scope setter when evaluating assignments', function () {
    const scope = {bindings: {amount: 3}, setBinding() { throw new TypeError('constant'); }};
    expect(() => evaluateInDebuggerScopes('amount = 4', [scope])).to.throw(TypeError);
  });

  it('highlights a nested function relative to its displayed source', function () {
    const nested = {getOriginalAst: () => ({loc: {start: {line: 5}}}),
      getPC: () => ({loc: {start: {line: 6, column: 2}}})};
    expect(lineRangeForFrame(nested, 'function child() {\n  debugger;\n}').start.row).equals(1);
  });
});
