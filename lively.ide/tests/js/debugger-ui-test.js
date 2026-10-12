/* global describe, it */
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

  it('writes workspace assignments back into the selected scope binding', function () {
    const selectedScope = { bindings: { count: 2 } };

    const result = evaluateInDebuggerScopes('count = count + 5', [selectedScope]);

    expect(result).equals(7);
    expect(selectedScope.bindings.count).equals(7);
  });
});
