import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeEsmCachePath } from '../lively.resources/src/esm-cache-path.js';
import { generateImportMapForPackage } from '../lively.server/plugins/lib-lookup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { workspaces } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const requests = new Map();
for (const directory of process.argv.slice(2).length ? process.argv.slice(2) : workspaces) {
  const map = await generateImportMapForPackage(path.resolve(root, directory));
  if (!Array.isArray(map._modules)) throw new Error(`Missing browser module closure: ${directory}; regenerate its browser import map`);
  for (const url of map._modules) {
    if (!url.startsWith('https://')) throw new Error(`Unexpected browser dependency URL: ${url}`);
    const integrity = map.integrity?.[url.replace(/^https:/, 'esm:')] || map.integrity?.[url];
    if (!integrity) throw new Error(`Missing browser integrity: ${url}`);
    if (requests.has(url) && requests.get(url) !== integrity) throw new Error(`Conflicting browser integrity: ${url}`);
    requests.set(url, integrity);
  }
}

function matches(bytes, integrity) {
  return integrity.split(/\s+/).some(value => {
    const match = /^(sha256|sha384|sha512)-(.+)$/.exec(value);
    return match && createHash(match[1]).update(bytes).digest('base64') === match[2];
  });
}

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
    if (!matches(bytes, integrity)) throw new Error(`Browser dependency content changed: ${url}; regenerate its browser import map`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, destination);
  }
}));
console.log(`Verified ${requests.size} browser modules in esm_cache.`);
