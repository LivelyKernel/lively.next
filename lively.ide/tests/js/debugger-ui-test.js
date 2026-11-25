/* global describe, it, afterEach, $world */
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { serialize, deserialize } from 'lively.serializer2';
import * as modules from 'lively.modules';
import { serializeMorph, loadMorphFromSnapshot } from 'lively.morphic/serialization.js';
import { RuntimeSourceDescriptor } from 'lively.classes/source-descriptors.js';
import { run, Continuation } from 'lively.context/lib/stackReification.js';
import { Interpreter } from 'lively.context/lib/interpreter.js';
import { installModuleDebugger } from 'lively.context/lib/module-debugger.js';
import { lineRangeForFrame, moduleUrlForFrame, readFrameSource, sourceNameForFrame, sourcePathForFrame } from '../../js/debugger/source.js';
import { evaluateInDebuggerScopes } from '../../js/debugger/evaluation.js';
import { openForContinuation } from '../../js/debugger/ui.cp.js';
import { LiveCounter, openLiveCounter } from '../../js/debugger/examples/live-counter.js';
import { fn, bounds, lineNode, debuggerFor, closeDebuggers, withModule, signalsOf } from './debugger-helpers.js';

/** Replace `$world[name]` with `answer` while `test` runs; returns the requests. */
async function answering (name, answer, test) {
  const original = $world[name], requests = [];
  $world[name] = async (...args) => { requests.push(args[0]); return answer; };
  try { await test(); } finally { $world[name] = original; }
  return requests;
}

describe('lively debugger', function () {
  this.timeout(20000);
  afterEach(closeDebuggers);

  it('names frames after their function, a symbol or a Lively constructor', () => {
    const name = props => sourceNameForFrame({ func: { originalFunction: Object.assign(function initialize () {}, props), name: () => '' } });
    expect(name({ displayName: Symbol.for('custom') })).equals('Symbol(custom)');
    expect(name({ [Symbol.for('lively-debug-constructor')]: { name: 'Example' } })).equals('Example.constructor');
  });

  it('names the window of a frame without module source as soon as it opens', async () => {
    const view = openForContinuation(run(fn('function sourceless () { debugger; }')), $world);
    try { expect(view.getWindow().title).equals('debugger - (no source url)'); }
    finally { await view.getWindow().close(); }
  });

  it('shows grouped toolbar buttons with their tooltips in a transparent window', async () => {
    const model = await debuggerFor(run(fn('function toolbarLayout () { debugger; }'))), view = model.view;
    view.env.forceUpdate();
    await view.whenRendered();
    view.env.forceUpdate();
    expect(view.fill.a).equals(0);
    expect(view.get('toolbar').fill.a).equals(0);
    expect(view.get('toolbar').submorphs.some(morph => morph.name === 'title')).equals(false);
    const tooltips = {
      proceed: 'Proceed', retry: 'Retry', 'step into': 'Step Into', 'step over': 'Step Over', 'step out': 'Step Out',
      'run to cursor': 'Run to the selected source line', 'restart frame': 'Restart Frame', return: 'Return a value from the selected frame',
      'edit method': 'Edit the selected method on its receiver', 'save module': 'Save module (Ctrl-S / Command-S)',
      'apply method': 'Apply saved changes after the current execution position'
    };
    for (const [name, tooltip] of Object.entries(tooltips)) expect(view.get(name + ' button').tooltip).equals(tooltip);
    const box = name => bounds(view.get(name + ' button'));
    for (const group of [['proceed', 'retry'], ['step into', 'step over', 'step out', 'run to cursor'], ['restart frame', 'return'], ['edit method', 'save module', 'apply method']]) {
      group.slice(1).forEach((name, i) => expect(box(name).left).closeTo(box(group[i]).right, 0.5));
    }
    expect(box('step into').left - box('retry').right).at.least(12);
    expect(view.get('save module button').viewModel.deactivated, 'a function without module has no module to save').equals(true);
    expect(view.getWindow().title).equals('debugger - (no source url)');
    const center = pt(box('step over').left + box('step over').width / 2, box('step over').top + box('step over').height / 2);
    expect(view.get('step over button').viewModel.considerPress({ positionIn: morph => morph.localize(center) })).equals(true);
  });

  it('opens the live counter tutorial with its buttons', async () => {
    const counter = openLiveCounter($world);
    try {
      expect(counter).instanceOf(LiveCounter);
      expect(counter.submorphs.map(morph => morph.name)).deep.equals(['title', 'count', 'Increment', 'Reset', 'Edit source', 'Lessons']);
      expect(counter.get('Lessons').position.x).equals(390);
    } finally { await counter.getWindow().close(); }
  });

  it('shows the original module with syntax colors and an accurate statement highlight', async () => {
    const counter = new LiveCounter();
    const model = await debuggerFor(run(counter.increment, null, [], { this: counter }));
    const pane = model.ui.sourcePane, view = model.view;
    expect(pane.textString).equals(RuntimeSourceDescriptor.for(LiveCounter).moduleSource);
    expect(pane.textString).contains('  increment () {').and.not.contains('function LiveCounter_increment_');
    expect(view.getWindow().title).equals('debugger - [lively.ide] js/debugger/examples/live-counter.js');
    expect(model.ui.stackList.items[0].string).equals('#0  increment');
    view.env.forceUpdate();
    expect(bounds(pane).top).closeTo(bounds(view.get('toolbar')).bottom, 0.5);
    const plugin = pane.pluginFind(p => p.isJSEditorPlugin);
    for (const fontSize of [13, 16, 22]) {
      pane.fontSize = fontSize;
      await pane.whenFontLoaded();
      model.refreshSelectedLine();
      pane.env.forceUpdate();
      plugin.highlight();
      pane.env.forceUpdate();
      const row = pane.selection.range.start.row, line = lineNode(pane, row), lineBox = line.getBoundingClientRect();
      expect(pane.getLine(row).trim()).equals('if (this.pause) debugger;');
      expect(new Set([...line.querySelectorAll('span')].map(span => span.style.color)).size).above(1);
      const selection = pane.renderingState.selectionNodes[0].getBoundingClientRect();
      expect(selection.top).closeTo(lineBox.top, 0.5);
      expect(selection.height).closeTo(lineBox.height, 0.5);
      const marker = pane.env.renderer.getNodeForMorph(pane).querySelector('.newtext-marker-layer').getBoundingClientRect();
      expect(marker.top).closeTo(lineBox.top, 0.5);
      expect(marker.height).closeTo(lineBox.height, 1);
    }
    const targetRow = pane.textString.split('\n').findIndex(line => line.trim() === 'this.count += amount;');
    pane.selection.range = { start: { row: targetRow, column: 4 }, end: { row: targetRow, column: 4 } };
    const stopped = await model.runToCursor();
    expect(stopped.isContinuation).equals(true);
    await model.selectFrame(stopped.currentFrame);
    expect(pane.selection.range.start.row).equals(targetRow);
    expect(counter.count).equals(0);
  });

  it('labels the frames of a restored debugger like the frames of the live debugger', async () => {
    const counter = new LiveCounter();
    const model = await debuggerFor(run(counter.increment, null, [], { this: counter }));
    expect(model.ui.stackList.items.map(item => item.string)).deep.equals(['#0  increment']);
    const restoredWindow = await loadMorphFromSnapshot(serializeMorph(model.view.getWindow()), { moduleManager: modules });
    $world.addMorph(restoredWindow);
    const restored = restoredWindow.targetMorph.viewModel;
    try {
      await restored.selectFrame(restored.continuation.currentFrame);
      expect(restored.ui.stackList.items.map(item => item.string)).deep.equals(['#0  increment']);
    } finally { restored.sourceBuffers.clear(); await restored.closeDebugger(); }
  });

  it('keeps original module positions when stepping into a method or nested closure', async () => {
    const counter = new LiveCounter(), moduleSource = RuntimeSourceDescriptor.for(LiveCounter).moduleSource;
    for (const [method, statement, callerStatement] of [
      ['nestedLesson', 'let doubled = value * 2;', 'let amount = this.double(2);'],
      ['scopeLesson', 'read = function () { return amount; };', 'this.count = read();']
    ]) {
      const stopped = run(counter[method], null, [], { this: counter }).stepOver().stepInto();
      expect(stopped.frames()).length(2);
      for (const frame of stopped.frames()) {
        expect(readFrameSource(frame)).equals(moduleSource);
        expect(sourcePathForFrame(frame)).equals('lively.ide/js/debugger/examples/live-counter.js');
        const row = lineRangeForFrame(frame, moduleSource).start.row;
        expect(moduleSource.split('\n')[row].trim()).equals(frame === stopped.currentFrame ? statement : callerStatement);
      }
    }
  });

  it('locates the current line of functions without module source', () => {
    const runtimeFrame = { func: { getSource: () => 'function increment() {\n  debugger;\n}' }, getOriginalAst: () => ({ sourceFile: '[runtime]' }), getPC: () => ({ loc: { start: { line: 2, column: 2 } } }) };
    expect(moduleUrlForFrame(runtimeFrame)).equals(null);
    expect(readFrameSource(runtimeFrame)).contains('function increment');
    expect(lineRangeForFrame(runtimeFrame, readFrameSource(runtimeFrame)).start.row).equals(1);
    const nested = { getOriginalAst: () => ({ loc: { start: { line: 5 } } }), getPC: () => ({ loc: { start: { line: 6, column: 2 } } }) };
    expect(lineRangeForFrame(nested, 'function child() {\n  debugger;\n}').start.row).equals(1);
  });

  it('evaluates workspace code in the scope chain with the frame receiver and workspace temporaries', () => {
    const marker = { label: 'actual object' }, receiver = { count: 3 }, workspace = { type: 'workspace', bindings: {} };
    for (const [source, scopes, expected] of [
      ['marker.count = count + outer, marker', [{ bindings: { marker, count: 2 } }, { bindings: { count: 99, outer: 4 } }], marker],
      ['this', [{ bindings: { this: receiver } }], receiver],
      ['arguments[1]', [{ bindings: { arguments: [4, 5] } }], 5],
      ['this.count += amount', [{ bindings: { this: receiver } }, { bindings: { amount: 2 } }], 5],
      ['let scratch = amount * 2; scratch', [workspace, { bindings: { amount: 3 } }], 6],
      ['scratch += amount', [workspace, { bindings: { amount: 3 } }], 9]
    ]) expect(evaluateInDebuggerScopes(source, scopes)).equals(expected);
    expect(marker.count).equals(6);
    expect(workspace.bindings.scratch).equals(9);
    const local = { bindings: { count: 2 } };
    expect(evaluateInDebuggerScopes('count = count + 5', [local])).equals(7);
    expect(local.bindings.count).equals(7);
    const constant = { bindings: { amount: 3 }, setBinding () { throw new TypeError('constant'); } };
    expect(() => evaluateInDebuggerScopes('amount = 4', [constant])).to.throw(TypeError);
  });

  it('shows, resizes and hides a highlighted workspace whose editor commands evaluate in the frame', async () => {
    const model = await debuggerFor(run(fn('function workspaceLayout () { var amount = 2; debugger; return amount; }')));
    const view = model.view, input = model.ui.workspaceInput, scopes = view.get('scope/value pane');
    expect(!!view.getSubmorphNamed('status') || !!view.getSubmorphNamed('workspace do button')).equals(false);
    expect(model.isWorkspaceVisible()).equals(false);
    const assertLayout = () => {
      view.env.forceUpdate();
      const pane = bounds(input), divider = bounds(model.ui.workspaceResizer), toggle = bounds(model.ui.terminalToggler);
      expect(divider.top).closeTo(bounds(scopes).bottom, 0.5);
      expect(divider.height).closeTo(5, 0.5);
      expect(pane.top).closeTo(divider.bottom, 0.5);
      expect(toggle.top).at.least(pane.top);
      expect(toggle.bottom).at.most(pane.bottom);
      expect(bounds(model.ui.workspaceControls).bottom).closeTo(pane.bottom, 0.5);
      expect(pane.bottom).closeTo(bounds(view).bottom, 0.5);
    };
    const collapsedHeight = scopes.height, windowExtent = view.getWindow().extent;
    await view.execCommand('focus debugger workspace');
    expect(model.isWorkspaceVisible()).equals(true);
    expect(scopes.height).below(collapsedHeight);
    expect(view.getWindow().extent.equals(windowExtent)).equals(true);
    assertLayout();
    input.textString = 'let scratch = amount * 2; scratch';
    input.pluginFind(p => p.isJSEditorPlugin).highlight();
    input.env.forceUpdate();
    const node = document.getElementById(input.id);
    expect(node.getBoundingClientRect().height).above(50);
    expect(new Set([...node.querySelectorAll('.newtext-text-layer.actual span')].map(span => span.style.color)).size).above(1);
    input.selectAll();
    expect((await input.execCommand('doit')).value).equals(4);
    expect(model.workspaceBindings.scratch).equals(4);
    model.adjustWorkspaceProportions({ state: { dragDelta: { y: -20 } } });
    const workspaceHeight = input.height;
    assertLayout();
    model.toggleWorkspace();
    view.env.forceUpdate();
    expect(model.isWorkspaceVisible()).equals(false);
    expect(scopes.height).closeTo(collapsedHeight, 0.5);
    expect(model.ui.workspaceResizer.visible).equals(false);
    expect(bounds(model.ui.workspaceControls).bottom).closeTo(bounds(scopes).bottom, 0.5);
    expect(bounds(scopes).bottom).closeTo(bounds(view).bottom, 0.5);
    model.toggleWorkspace();
    expect(input.height).closeTo(workspaceHeight, 0.5);
    expect(input.textString).equals('let scratch = amount * 2; scratch');
    assertLayout();
    input.textString = 'amount = scratch - 1';
    input.selectAll();
    expect((await input.execCommand('doit')).value).equals(3);
    expect(model.selectedFrame.getScope().get('amount')).equals(3);
    expect(model.workspaceBindings.it).equals(3);
    input.textString = 'false';
    input.selectAll();
    expect(await input.doEval()).deep.include({ isError: false, value: false });
    input.textString = 'amount';
    expect(await model.evaluateWorkspace()).equals(3);
    input.selectAll();
    await input.execCommand('printit');
    expect(input.textString).contains('3');
    const errors = [], failures = signalsOf(view, 'debuggerActionFailed');
    view.showError = input.showError = error => errors.push(String(error));
    input.textString = 'missingDebuggerWorkspaceValue';
    input.selectAll();
    expect((await input.execCommand('doit')).isError).equals(true);
    expect(errors.pop()).contains('missingDebuggerWorkspaceValue');
    expect(await model.evaluateWorkspace()).equals(false);
    expect(errors.pop()).contains('missingDebuggerWorkspaceValue');
    await input.execCommand('printit');
    expect(input.textString, 'Print it shows the error').contains('ReferenceError: missingDebuggerWorkspaceValue is not defined');
    expect(failures.map(failure => failure.actionName)).deep.equals(['Workspace', 'Workspace', 'Workspace']);
  });

  it('lists scope bindings directly and keeps object expansion and navigation working', async () => {
    const receiver = { name: 'receiver' };
    const model = await debuggerFor(run(fn('function variableTree () { let amount = 2; const item = {nested: {answer: 42}, inspectee: "a real property"}; debugger; return item; }'), null, [], { this: receiver }));
    const tree = model.ui.valueTree, labels = model.ui.scopeList.items.map(item => item.string);
    expect(labels[0]).equals('this (1)');
    expect(labels[labels.length - 1]).match(/^global \(\d+\)$/);
    const scope = model.ui.scopeList.items.find(item => item.value.bindingNames().includes('item')).value;
    Object.defineProperty(scope.bindings, Symbol.for('debugger-internal-metadata'), { value: {} });
    model.selectedFrame.lookup('item')[Symbol.for('user-field')] = 23;
    await model.selectScope(scope);
    expect(tree.textString).contains('amount: 2');
    expect(tree.textString).not.contains('inspectee:').and.not.contains('debugger-internal-metadata');
    expect(tree.treeData.getContextFor(tree.treeData.root)).equals(scope.bindings);
    const item = tree.treeData.root.children.find(node => node.key === 'item');
    expect(item.value).equals(model.selectedFrame.lookup('item'));
    expect(tree.treeData.parentNode(item)).equals(tree.treeData.root);
    await tree.onNodeCollapseChanged({ node: item, isCollapsed: false });
    expect(tree.textString).contains('inspectee:').and.contains('a real property').and.contains('Symbol.for("user-field")');
    const nested = item.children.find(node => node.key === 'nested');
    await tree.onNodeCollapseChanged({ node: nested, isCollapsed: false });
    expect(tree.textString).contains('answer: 42');
    tree.selectedNode = nested;
    await tree.execCommand('goto parent');
    expect(tree.selectedNode).equals(item);
    await tree.onNodeCollapseChanged({ node: item, isCollapsed: true });
    expect(tree.textString).not.contains('answer:');
    await model.selectScope(model.ui.scopeList.items.find(item => item.value.type === 'receiver').value);
    expect(tree.treeData.root.children.map(node => [node.key, node.value])).deep.equals([['this', receiver]]);
    await model.selectScope(null);
    expect(tree.textString.trim()).equals('');
    expect(tree.selectedNode).equals(null);
  });

  it('saves the whole module and applies future edits to the suspended computation', () => withModule('counter.js',
    'export class Counter { increment() { let amount = 2; debugger; this.count += amount; return this.count; } other() { return 1; } }',
    async ({ Counter }, { mod, file }) => {
      const counter = Object.assign(new Counter(), { count: 0 }), source = await file.read();
      const model = await debuggerFor(run(counter.increment, null, [], { this: counter })), pane = model.ui.sourcePane;
      expect(pane.readOnly).equals(false);
      const edited = source.replace('+= amount;', '+= amount * 3;').replace('return 1;', 'return 7;');
      pane.textString = edited;
      expect(pane.borderColor.left.equals(Color.red), 'a draft has a red border').equals(true);
      await model.stepOver();
      await model.selectFrame(model.continuation.currentFrame);
      expect(pane.textString, 'the draft survives stepping').equals(edited);
      expect(await pane.execCommand('save debugger module')).equals(true);
      expect(await file.read()).equals(edited);
      expect(pane.borderColor.left.equals(Color.red)).equals(false);
      expect([counter.other(), counter.constructor === Counter, counter.count]).deep.equals([7, true, 0]);
      const external = edited + '\n// saved from another editor';
      await mod.changeSource(external);
      expect((await model.applySavedMethod()).isContinuation).equals(true);
      await model.selectFrame(model.continuation.currentFrame);
      expect(pane.textString).equals(external);
      expect(pane.getLine(pane.selection.range.start.row)).contains('amount * 3');
      expect(await model.proceed()).equals(6);
      expect(counter.count).equals(6);
    }));

  it('keeps the current line visible after a save moves the code', () => withModule('moved.js',
    'export class Counter {\n task() {\n  let value = 2;\n  debugger;\n  return value;\n }\n}',
    async ({ Counter }, { file }) => {
      const model = await debuggerFor(run(Counter.prototype.task, null, [], { this: new Counter() })), pane = model.ui.sourcePane;
      await model.stepOver();
      pane.textString = '// moved by source edit\n'.repeat(250) + (await file.read()).replace('return value;', 'return value * 3;');
      expect(await model.saveModule()).equals(true);
      await model.applySavedMethod();
      await model.selectFrame(model.continuation.currentFrame);
      pane.env.forceUpdate();
      const row = pane.selection.start.row, box = lineNode(pane, row).getBoundingClientRect(), paneBox = bounds(pane);
      expect(pane.getLine(row).trim()).equals('return value * 3;');
      expect(pane.markers.find(marker => marker.id === 'lively-debugger-current-line').range.start.row).equals(row);
      expect(box.top).at.least(paneBox.top);
      expect(box.bottom).at.most(paneBox.bottom);
      expect(await model.proceed()).equals(6);
    }));

  it('keeps invalid drafts and protects external changes and closing from data loss', () => withModule('guard.js',
    'export class Guard { task() { debugger; return 1; } }',
    async ({ Guard }, { file }) => {
      const source = await file.read(), model = await debuggerFor(run(Guard.prototype.task, null, [], { this: new Guard() })), pane = model.ui.sourcePane;
      pane.textString = source + '\nthis is invalid JavaScript';
      expect(await model.saveModule()).equals(false);
      expect(await file.read()).equals(source);
      expect(model.hasUnsavedChanges()).equals(true);
      pane.textString = source.replace('return 1', 'return 2');
      const external = source + '\n// changed outside the debugger';
      await file.write(external);
      const prompts = await answering('confirm', false, async () => {
        expect(await model.saveModule()).equals(false);
        expect(await file.read()).equals(external);
        expect(await model.onWindowClose()).equals(false);
        expect(!!model.continuation).equals(true);
      });
      expect(prompts).deep.equals(['This module changed outside the debugger. Overwrite those changes?', 'Discard unsaved debugger module changes?']);
    }));

  it('reports failed actions with their reason', async () => {
    const model = await debuggerFor(run(fn('function outer () { function inner () {\n  let amount = 1;\n  debugger;\n  return amount;\n } return inner(); }')));
    const pane = model.ui.sourcePane, errors = [], failures = signalsOf(model.view, 'debuggerActionFailed');
    model.view.showError = error => errors.push(String(error));
    const [inner, outer] = model.continuation.frames();
    for (const [frame, act, message] of [
      [inner, () => { pane.selection.range = { start: { row: 4, column: 0 }, end: { row: 4, column: 0 } }; return model.runToCursor(); }, 'Run to Cursor failed: No executable statement on this line.'],
      [outer, () => model.runToCursor(), 'Run to Cursor failed: Select the active frame to run to a source line.'],
      [inner, () => { pane.textString += '\n// edited'; return model.runToCursor(); }, 'Run to Cursor failed: Apply Saved Method or Restart Frame before running to a line in edited source.'],
      [inner, () => model.saveModule(), 'Save Module failed: This frame has no editable module source.']
    ]) {
      await model.selectFrame(frame);
      expect(await act()).equals(false);
      expect(errors.pop()).equals(message);
      const { actionName, frame: failedFrame, error } = failures.pop();
      expect([actionName, failedFrame, String(error.message)]).deep.equals([message.split(' failed')[0], frame, message.split('failed: ')[1]]);
    }
    expect(model.continuation.currentFrame).equals(inner);
  });

  it('asks for a return value and for the result of a saved await', async () => {
    const completed = [];
    const nested = await debuggerFor(run(fn('function outer () { function inner () { return 1; } debugger; return inner() + 1; }')));
    await nested.stepOver();
    await nested.stepInto();
    expect(nested.continuation.frames()).length(2);
    const returnPrompts = await answering('prompt', '7', () => nested.returnFromFrame());
    expect(returnPrompts).deep.equals(['Return this value from the selected frame:']);
    const proceeded = signalsOf(nested.view, 'debuggerProceed'), resumed = nested.continuation;
    expect(await nested.proceed()).equals(8);
    expect(proceeded).deep.equals([resumed]);
    const receiver = { calls: 0, later () { this.calls++; return new Promise(() => {}); } };
    const stopped = run(fn('async function task () { debugger; let value = await this.later(); return value + this.calls; }'), null, [], { this: receiver });
    let pending;
    try { new Interpreter({ captureErrors: true }).runFromPC(stopped.currentFrame); } catch (error) { pending = Continuation.fromUnwindException(error); }
    const restored = await debuggerFor(deserialize(serialize(pending)), { onComplete: value => completed.push(value) });
    let result;
    const awaitPrompts = await answering('prompt', 'this.calls + 4', async () => { result = await restored.proceed(); });
    expect(awaitPrompts).deep.equals(['This await was saved before its operation completed. Supply the awaited result:']);
    expect([result, completed]).deep.equals([6, [6]]);
  });

  it('keeps the native caller pending when its debugger is closed during Proceed', async () => {
    let resolveAwait, model, completed = false;
    const pending = new Promise(resolve => { resolveAwait = resolve; });
    const stopped = run(fn('function task () { debugger; return pending; }'), null, [], { pending });
    const runtime = installModuleDebugger({ get () { return {}; } }, { async open (continuation, callbacks) { model = await debuggerFor(continuation, callbacks); } });
    const caller = runtime.deliver(stopped).then(value => { completed = true; return value; });
    while (!model) await new Promise(resolve => setTimeout(resolve, 10));
    const proceeding = model.proceed();
    try {
      await model.closeDebugger();
      await Promise.resolve(); await Promise.resolve();
      expect(completed, 'closing a running Proceed does not resolve the caller').equals(false);
      resolveAwait(42);
      expect(await proceeding).equals(42);
      expect(await caller, 'the caller receives the result').equals(42);
    } finally { resolveAwait(42); }
  });
});
