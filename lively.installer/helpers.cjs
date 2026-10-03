/* global require */

function join () {
  let args = Array.prototype.slice.call(arguments);
  return args.reduce(function (path, ea) {
    return typeof ea === 'string' ? path.replace(/\/*$/, '') + '/' + ea.replace(/^\/*/, '') : path;
  });
}

function normalizeProjectSpec (spec) {
  return Object.assign({}, spec, {
    dir: spec.dir || join(spec.parentDir, spec.name)
  });
}

function getPackageSpec () {
  return require.resolve('lively.installer/packages-config.json');
}

async function readPackageSpec (pkgSpec) {
  if (pkgSpec.startsWith('/')) pkgSpec = 'file://' + pkgSpec;
  const { resource } = await import('lively.resources');
  return JSON.parse(await resource(pkgSpec).read());
}

function discoverPackageRootPaths (baseURL) {
  const fs = require('node:fs');
  const path = require('node:path');
  const roots = [];
  const seen = new Set();
  const add = directory => {
    directory = path.resolve(directory);
    if (!fs.existsSync(path.join(directory, 'package.json'))) return;
    let canonical;
    try { canonical = fs.realpathSync(directory); } catch (_) { return; }
    if (seen.has(canonical)) return;
    seen.add(canonical);
    roots.push(directory);
  };
  try {
    const root = require('node:url').fileURLToPath(baseURL);
    const { workspaces = [] } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const workspace of workspaces) add(path.join(root, workspace));
    const projects = path.join(root, 'local_projects');
    if (fs.existsSync(projects)) {
      for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
        if (entry.isDirectory()) add(path.join(projects, entry.name));
      }
    }
  } catch (_) {}
  return roots;
}

module.exports = { join, normalizeProjectSpec, getPackageSpec, readPackageSpec, discoverPackageRootPaths }
