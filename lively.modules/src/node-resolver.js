import { realpathSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

function canonicalURL (resolved) {
  if (!resolved.startsWith('file:')) return resolved;
  try { return pathToFileURL(realpathSync(fileURLToPath(resolved))).href; } catch (_) { return resolved; }
}

let parentResolutionSupport;
function assertParentResolutionSupport () {
  if (parentResolutionSupport === true) return;
  if (parentResolutionSupport instanceof Error) throw parentResolutionSupport;
  const parent = new URL('./__lively_resolver__/', import.meta.url).href;
  const expected = new URL('./probe', parent).href;
  try {
    const actual = import.meta.resolve('./probe', parent);
    if (actual !== expected) throw new Error(`resolved ${actual}`);
    parentResolutionSupport = true;
  } catch (cause) {
    parentResolutionSupport = new Error(
      'Native ESM resolution requires Node support for import.meta.resolve(specifier, parentURL). Run Node with --experimental-import-meta-resolve.',
      { cause });
    throw parentResolutionSupport;
  }
}

// Keep Node's resolver authoritative for exports, imports, aliases, and peers.
export function nativeResolve (specifier, parentURL, mode = 'import') {
  const parent = new URL(parentURL).href;
  if (mode === 'require') {
    const resolved = createRequire(parent).resolve(specifier);
    return isBuiltin(resolved) ? `node:${resolved.replace(/^node:/, '')}` : canonicalURL(pathToFileURL(resolved).href);
  }
  assertParentResolutionSupport();
  return canonicalURL(import.meta.resolve(specifier, parent));
}

// Keep asynchronous third-party ESM graphs in Node's native loader as well.
export function nativeImport (url) { return import(url); }
