import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeEsmCachePath } from '../lively.resources/src/esm-cache-path.js';
import { clearImportMapFetchCache, generateImportMapForPackage } from '../lively.server/plugins/lib-lookup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { workspaces } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const directories = process.argv.slice(2).length ? process.argv.slice(2) : workspaces;

async function collectRequests (refresh = new Set()) {
  const requests = new Map(), owners = new Map();
  for (const directory of directories) {
    const map = await generateImportMapForPackage(path.resolve(root, directory), { update: refresh.has(directory) });
    if (!Array.isArray(map._modules)) throw new Error(`Missing browser module closure: ${directory}; regenerate its browser import map`);
    for (const url of map._modules) {
      if (!url.startsWith('https://')) throw new Error(`Unexpected browser dependency URL: ${url}`);
      const integrity = map.integrity?.[url.replace(/^https:/, 'esm:')] || map.integrity?.[url];
      if (!integrity) throw new Error(`Missing browser integrity: ${url}`);
      if (requests.has(url) && requests.get(url) !== integrity) throw new Error(`Conflicting browser integrity: ${url}`);
      requests.set(url, integrity);
      owners.set(url, [...owners.get(url) || [], directory]);
    }
  }
  return { requests, owners };
}

function matches(bytes, integrity) {
  return integrity.split(/\s+/).some(value => {
    const match = /^(sha256|sha384|sha512)-(.+)$/.exec(value);
    return match && createHash(match[1]).update(bytes).digest('base64') === match[2];
  });
}

async function download (requests) {
  const changed = [];
  const queue = [...requests];
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < queue.length) {
      const [url, integrity] = queue[next++];
      const destination = path.resolve(root, 'esm_cache', ...normalizeEsmCachePath(url.replace(/^https:/, 'esm:')));
      if (!destination.startsWith(path.join(root, 'esm_cache') + path.sep)) throw new Error(`Invalid cache path: ${url}`);
      let cached;
      try { cached = await fs.readFile(destination); } catch (err) { if (err.code !== 'ENOENT') throw err; }
      if (cached && matches(cached, integrity)) continue;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Browser dependency ${url}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!matches(bytes, integrity)) { changed.push(url); continue; }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const temporary = `${destination}.${process.pid}.tmp`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, destination);
    }
  }));
  return changed;
}

let { requests, owners } = await collectRequests(); // eslint-disable-line prefer-const
let changed = await download(requests);
if (changed.length) {
  // Maps generated from a stale generator cache pin outdated integrity; regenerate them once.
  console.warn(`Regenerating browser import maps for ${changed.length} changed module(s), e.g. ${changed[0]}`);
  await clearImportMapFetchCache();
  ({ requests } = await collectRequests(new Set(changed.flatMap(url => owners.get(url)))));
  changed = await download(requests);
}
if (changed.length) throw new Error(`Browser dependency content changed: ${changed[0]}; regenerate its browser import map`);
console.log(`Verified ${requests.size} browser modules in esm_cache.`);
