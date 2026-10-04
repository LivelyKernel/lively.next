/* global describe, it, System, $world */
import { expect } from 'mocha-es6';
import {
  initialFrameForContinuation,
  lineRangeForFrame,
  locationStringForFrame,
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
      expect(bounds('apply method button').left).closeTo(bounds('edit method button').right, 0.5);
      const { pt } = await System.import('lively.graphics');
      for (const name of ['step over button', 'workspace do button']) {
        const button = view.get(name), box = bounds(name);
        const position = pt(box.left + box.width / 2, box.top + box.height / 2);
        expect(button.viewModel.considerPress({ positionIn: morph => morph.localize(position) })).equals(true);
      }
    } finally { view.viewModel.closeDebugger(); }
  });

  it('shows the original module with syntax colors and an accurate statement highlight', async function () {
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
    } finally { view.viewModel.closeDebugger(); }
  });

  it('keeps original module positions when stepping into a method or nested closure', async function () {
    const { run } = await System.import('lively.context/lib/stackReification.js');
    const { stepInspectorContinuation } = await System.import('lively.context/lib/inspector-interpreter.js');
    const { LiveCounter } = await System.import('lively.ide/js/debugger/examples/live-counter.js');
    const { RuntimeSourceDescriptor } = await System.import('lively.classes/source-descriptors.js');
    const counter = new LiveCounter();
    for (const [method, statement] of [
      ['nestedLesson', 'let doubled = value * 2;'],
      ['scopeLesson', 'read = function () { return amount; };']
    ]) {
      let stopped = run(counter[method], null, [], {this: counter});
      stopped = stepInspectorContinuation(stopped);
      stopped = stepInspectorContinuation(stopped, {action: 'stepInto'});
      expect(stopped.frames()).length(2);
      for (const frame of stopped.frames()) {
        const source = await readFrameSource(frame);
        expect(source).equals(RuntimeSourceDescriptor.for(LiveCounter).moduleSource);
        const row = lineRangeForFrame(frame, source).start.row;
        if (frame === stopped.currentFrame) expect(source.split('\n')[row].trim()).equals(statement);
        expect(locationStringForFrame(frame)).contains('/live-counter.js:');
      }
    }
  });

  it('renders a syntax highlighted workspace whose editor commands evaluate in the suspended scope', async function () {
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
    } finally { view.viewModel.closeDebugger(); }
  });

  it('shows the source and current statement of a rewriter continuation', async function () {
    const originalFrame = {
      func: { getSource: () => 'function increment() {\n  debugger;\n}' },
      getOriginalAst: () => ({ sourceFile: '[runtime]' }),
      getPC: () => ({ loc: { start: { line: 2, column: 2 } } })
    };
    const source = await readFrameSource(originalFrame);
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
