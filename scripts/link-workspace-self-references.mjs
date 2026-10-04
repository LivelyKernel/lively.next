import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { workspaces } = JSON.parse(await fs.readFile(path.join(root, 'package.json')));

for (const workspace of workspaces) {
  const directory = path.join(root, workspace);
  const { name } = JSON.parse(await fs.readFile(path.join(directory, 'package.json')));
  const link = path.join(directory, 'node_modules', ...name.split('/'));
  await fs.mkdir(path.dirname(link), { recursive: true });
  try {
    const existing = await fs.readlink(link);
    if (path.resolve(path.dirname(link), existing) !== directory) throw new Error(`Refusing to replace ${link}`);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EINVAL') throw err;
    await fs.symlink(process.platform === 'win32' ? directory : path.relative(path.dirname(link), directory), link, process.platform === 'win32' ? 'junction' : 'dir');
  }
}
