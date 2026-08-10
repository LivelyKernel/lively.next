import { resource } from 'lively.resources';

export const CURRENT_LINE_MARKER_ID = 'lively-debugger-current-line';

export function sourceSummary (frame) {
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

export function sourceUrlForFrame (frame) {
  const source = frame && frame.source || {};
  return source.url || '';
}

export function isInspectorRuntimeFrame (frame) {
  const url = sourceUrlForFrame(frame);
  const sourceText = frame && frame.source && frame.source.sourceText || '';
  return url.includes('/lively.context/lib/inspector-runtime.js') ||
    url.endsWith('/lively.context/lib/inspector-runtime.js') ||
    (frame && frame.functionName === 'halt' &&
      sourceText.includes('HALT_UNWIND_TAG') &&
      sourceText.includes('InspectorHaltUnwind'));
}

export function initialFrameForContinuation (continuation, frames = continuation ? continuation.frames() : []) {
  if (!frames.length) return null;
  if (isInspectorRuntimeFrame(frames[0])) {
    return frames.find(frame => !isInspectorRuntimeFrame(frame)) || frames[0];
  }
  if ((continuation && continuation.reason) !== 'halt') return frames[0];
  return frames.find(frame => !isInspectorRuntimeFrame(frame)) || frames[0];
}

export function locationStringForFrame (frame) {
  if (!frame) return '';
  const source = frame.source || {};
  const location = frame.location || {};
  const url = source.url || source.scriptId || '(no source url)';
  if (!Number.isFinite(location.lineNumber)) return url;
  return url + ':' + (location.lineNumber + 1) + ':' + ((location.columnNumber || 0) + 1);
}

export function lineRangeForFrame (frame, sourceText = '') {
  const location = frame && frame.location || {};
  if (!Number.isFinite(location.lineNumber)) return null;
  const lines = String(sourceText || '').split('\n');
  if (!lines.length) return null;
  const row = Math.max(0, Math.min(location.lineNumber, lines.length - 1));
  return {
    start: { row, column: 0 },
    end: { row, column: lines[row].length }
  };
}

export async function readFrameSource (frame, read = url => resource(url).read()) {
  if (!frame) return '';
  const capturedSource = frame.source && frame.source.sourceText;
  if (capturedSource) return String(capturedSource);
  const url = sourceUrlForFrame(frame);
  if (!url) return sourceSummary(frame);
  try {
    const source = await read(url);
    return source == null ? sourceSummary(frame) : String(source);
  } catch (err) {
    const message = err && err.message || String(err);
    return sourceSummary(frame) + '\n\nUnable to load source: ' + message;
  }
}
