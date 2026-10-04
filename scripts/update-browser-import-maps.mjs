import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImportMapForPackage } from '../lively.server/plugins/lib-lookup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { workspaces } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const requested = process.argv.slice(2);
const packages = requested.length ? requested : workspaces;
for (const name of packages) {
  const directory = path.resolve(root, name);
  console.log(`Regenerating browser import map: ${name}`);
  await generateImportMapForPackage(directory, { update: true });
}
