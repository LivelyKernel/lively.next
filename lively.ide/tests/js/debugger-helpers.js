/* global $world */
import { resource } from 'lively.resources';
import { module } from 'lively.modules';
import { connect } from 'lively.bindings';
import { openForContinuation } from '../../js/debugger/ui.cp.js';

export const fn = source => globalThis.Function('return (' + source + ')')();
export const bounds = morph => document.getElementById(morph.id).getBoundingClientRect();
export const lineNode = (pane, row) => [...pane.env.renderer.getNodeForMorph(pane).querySelectorAll('.newtext-text-layer.actual .line')]
  .find(line => Number(line.dataset.row) === row);

/** The values of every `signalName` signal of `morph` from now on. */
export function signalsOf (morph, signalName) {
  const values = [];
  connect(morph, signalName, { record: value => values.push(value) }, 'record');
  return values;
}

const views = [];

/** Open a debugger on `continuation` with its current frame selected. */
export async function debuggerFor (continuation, callbacks) {
  const view = openForContinuation(continuation, $world, callbacks);
  views.push(view);
  await view.viewModel.selectFrame(view.viewModel.continuation.currentFrame);
  return view.viewModel;
}

/** Discard the drafts of every debugger opened by `debuggerFor` and close it. */
export async function closeDebuggers () {
  for (const view of views.splice(0)) {
    view.viewModel.sourceBuffers.clear();
    await view.viewModel.closeDebugger();
  }
}

/**
 * Load `source` as the local module `name`, after `prepare(module)`, and call
 * `test` with its exports; then close the debuggers and remove the module.
 */
export async function withModule (name, source, test, prepare) {
  const file = resource('local://debugger-test/' + name), mod = module(file.url);
  await file.write(source);
  try {
    await prepare?.(mod);
    return await test(await mod.load(), { mod, file });
  } finally {
    await closeDebuggers();
    await mod.unload();
    await file.remove();
  }
}
