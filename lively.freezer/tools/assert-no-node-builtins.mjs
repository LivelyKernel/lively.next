import fs from 'node:fs/promises';
import path from 'node:path';
import { builtinModules } from 'node:module';

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map(name => 'node:' + name)]);

/**
 * Lists the Node built-ins among the dependencies of the `System.register([...], ...)`
 * calls in a SystemJS chunk. SystemJS fetches each dependency, so a built-in there is
 * requested relative to the page (for example GET /dashboard/path) and the boot fails.
 * Built-ins that guarded Node-only code passes to `require()` are not dependencies.
 * @param { string } code - The chunk source.
 * @returns { string[] } The sorted built-in specifiers.
 */
export function nodeBuiltinDependencies (code) {
  const found = new Set();
  for (const [, dependencies] of code.matchAll(/register\(\s*\[([^\]]*)\]/g)) {
    for (const [, single, double] of dependencies.matchAll(/'([^']*)'|"([^"]*)"/g)) {
      const specifier = single ?? double;
      if (NODE_BUILTINS.has(specifier)) found.add(specifier);
    }
  }
  return [...found].sort();
}

/**
 * Throws if a top-level `.js` chunk in a freezer output directory depends on a Node built-in,
 * which happens when a server-only module is statically reachable from a browser entry.
 * @param { string } dir - The output directory, e.g. 'landing-page'.
 */
export async function assertNoNodeBuiltins (dir) {
  const offenders = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const builtins = nodeBuiltinDependencies(await fs.readFile(path.join(dir, entry.name), 'utf8'));
    if (builtins.length) offenders.push(`       - ${entry.name}: ${builtins.join(', ')}`);
  }
  if (!offenders.length) return;
  throw new Error(`Node built-in modules are dependencies of the browser bundle "${dir}":\n${offenders.join('\n')}\n` +
    '   SystemJS requests them relative to the page, where they do not exist. A server-only module is ' +
    'statically reachable from the entry; import it lazily or move the Node-only code out of the browser path.');
}
