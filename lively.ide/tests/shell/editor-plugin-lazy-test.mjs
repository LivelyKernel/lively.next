import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = { calls: 0 };
const key = `shellEditorPluginFixture${process.pid}`;
globalThis[key] = fixture;
const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const dependencies = {
  'lively.lang': 'export const arr = { uniq: values => [...new Set(values)] }; export const string = {};',
  'lively.bindings': 'export function signal() {}',
  '../editor-plugin.js': 'export class CodeMirrorEnabledEditorPlugin {}',
  './shell-interface.js': `export async function defaultDirectory() { globalThis[${JSON.stringify(key)}].calls++; return '/fixture/cwd'; } export function runCommand() {}`,
  './completers.js': 'export const shellCompleters = [];',
  './mode.js': '',
  '../text/snippets.js': 'export class Snippet {}'
};
try {
  let source = await readFile(new URL('../../shell/editor-plugin.js', import.meta.url), 'utf8');
  for (const [specifier, stub] of Object.entries(dependencies)) {
    source = source.replaceAll(`'${specifier}'`, JSON.stringify(dataURL(stub)));
  }
  const { default: ShellEditorPlugin } = await import(dataURL(source));
  assert.equal(fixture.calls, 0, 'merely importing the shell plugin must not connect to a server');
  const plugin = new ShellEditorPlugin();
  const secondPlugin = new ShellEditorPlugin();
  assert.equal(fixture.calls, 0, 'constructing shell editors must stay offline');
  plugin.textMorph = {
    world: () => ({ editListPrompt: async () => ({ status: 'canceled', selections: [] }) }),
    getWindow: () => null
  };
  await plugin.changeCwdInteractively();
  assert.equal(fixture.calls, 1, 'choosing a directory resolves the default on demand');
  assert.equal(plugin.cwd, '/fixture/cwd');
  assert.equal(secondPlugin.cwd, '/fixture/cwd');
  assert.equal(new ShellEditorPlugin().cwd, '/fixture/cwd');
  secondPlugin.textMorph = plugin.textMorph;
  await secondPlugin.changeCwdInteractively();
  assert.equal(fixture.calls, 1, 'later plugins and choosers reuse the resolved default directory');
  console.log('Shell plugin imports and instances stay offline; directory selection resolves and shares its default.');
} finally {
  delete globalThis[key];
}
