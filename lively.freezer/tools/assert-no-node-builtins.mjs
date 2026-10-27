/* global process */
import fs from 'node:fs/promises';
import path from 'node:path';
import { builtinModules } from 'node:module';

// Node built-ins, both bare ('fs') and prefixed ('node:fs') forms.
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(m => 'node:' + m)
]);

/**
 * Collect Node built-in specifiers that appear as *static* dependencies of a
 * `System.register([...deps...], ...)` call in a frozen (System-format) chunk.
 *
 * Only bare/`node:` specifiers inside a register dependency array count: those
 * are the ones SystemJS will try to fetch under the page URL at runtime (e.g.
 * `GET /dashboard/path` → 404). Runtime `require('child_process')` strings in
 * guarded Node-only branches are *not* register deps and are correctly ignored.
 *
 * @param { string } code - The chunk source.
 * @returns { string[] } - Sorted, de-duplicated offending specifiers.
 */
function nodeBuiltinRegisterDeps (code) {
  const found = new Set();
  const re = /register\(\s*\[/g;
  let m;
  while ((m = re.exec(code))) {
    // Walk from the opening `[` to its matching `]` to isolate the dep array.
    let depth = 0;
    const start = m.index + m[0].length - 1;
    let i = start;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
    }
    const arr = code.slice(start, i + 1);
    const specRe = /'([^']*)'|"([^"]*)"/g;
    let s;
    while ((s = specRe.exec(arr))) {
      const spec = s[1] ?? s[2];
      if (NODE_BUILTINS.has(spec)) found.add(spec);
    }
    re.lastIndex = i + 1;
  }
  return [...found].sort();
}

/**
 * Scan every top-level `.js` chunk in a freezer output directory and throw if
 * any references a Node built-in as a static module dependency. This turns a
 * silent runtime 404 (server-only code reachable from the browser entry graph)
 * into a loud, immediate build failure.
 *
 * @param { string } dir - The output directory (e.g. 'landing-page').
 */
export async function assertNoNodeBuiltins (dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const offenders = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const code = await fs.readFile(path.join(dir, entry.name), 'utf8');
    const bad = nodeBuiltinRegisterDeps(code);
    if (bad.length) offenders.push({ file: entry.name, builtins: bad });
  }
  if (offenders.length) {
    const detail = offenders.map(o => `       - ${o.file}: ${o.builtins.join(', ')}`).join('\n');
    throw new Error(
      `Node built-in modules leaked into the browser bundle "${dir}":\n${detail}\n` +
      `   These resolve to bare specifiers that SystemJS fetches under the page URL ` +
      `(e.g. GET /dashboard/path) and 404 at runtime, aborting boot.\n` +
      `   Cause: a server-only module (e.g. lively.shell/server-command.js) is statically ` +
      `reachable from the entry graph. Make the offending import dynamic/lazy, or split the ` +
      `Node-only code out of the browser-reachable path.`
    );
  }
}
