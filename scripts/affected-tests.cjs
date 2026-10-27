const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const packages = readJSON('package.json').workspaces.map(directory => ({
  directory,
  ...readJSON(`${directory}/package.json`)
}));
const changed = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', `origin/${process.env.GITHUB_BASE_REF || 'main'}...`], {
  cwd: root, encoding: 'utf8'
}).split('\0').filter(Boolean);
// Shared runtime, dependency and CI changes can affect every package.
const shared = changed.some(file => /^(scripts\/|\.github\/|[^/]+\.(?:sh|js|mjs|cjs|json|lock|toml)$)/.test(file));
const affected = new Set(packages.filter(pkg => changed.some(file => file.startsWith(`${pkg.directory}/`))).map(pkg => pkg.name));
let added;
do {
  added = false;
  for (const pkg of packages) {
    if (affected.has(pkg.name)) continue;
    const dependencies = Object.keys({
      ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies,
      ...pkg.peerDependencies, ...pkg.lively?.localDependencies
    });
    if (dependencies.some(name => affected.has(name))) {
      affected.add(pkg.name);
      added = true;
    }
  }
} while (added);
const selected = packages.filter(pkg => shared || affected.has(pkg.name)).map(pkg => pkg.name);
console.log(selected.length ? selected.join(' ') : 'none');
