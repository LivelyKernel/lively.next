#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestName = '.lively-package-links.json';

function pathIsInside (root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function directoryLinks (root) {
  const links = [];
  function walk (directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(filename);
        if (!pathIsInside(root, target)) throw new Error(`Package link escapes app root: ${filename} -> ${target}`);
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
          links.push({
            link: path.relative(root, filename),
            target: path.relative(root, target)
          });
        } else if (stat.isFile()) {
          fs.rmSync(filename, { force: true });
          fs.copyFileSync(target, filename);
          fs.chmodSync(filename, stat.mode & 0o777);
        } else throw new Error(`Unsupported package link target: ${filename} -> ${target}`);
      } else if (entry.isDirectory()) walk(filename);
    }
  }
  walk(root);
  return links.sort((a, b) => a.link.localeCompare(b.link));
}

function assertNoLinks (root) {
  const links = [];
  function walk (directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) links.push(filename);
      else if (entry.isDirectory()) walk(filename);
    }
  }
  walk(root);
  if (links.length) throw new Error(`Archive staging still contains package links:\n${links.join('\n')}`);
}

export function stripPackageLinks (root) {
  root = fs.realpathSync(root);
  const manifestFile = path.join(root, manifestName);
  const links = directoryLinks(root);
  let manifest = links;
  if (!links.length && fs.existsSync(manifestFile)) {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  }
  if (!Array.isArray(manifest) || !manifest.length) throw new Error('No package links found to stage');
  for (const entry of links) fs.rmSync(path.join(root, entry.link), { recursive: true, force: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  assertNoLinks(root);
  return manifest;
}

export function restorePackageLinks (root) {
  root = fs.realpathSync(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestName), 'utf8'));
  for (const entry of manifest) {
    const link = path.resolve(root, entry.link);
    const target = path.resolve(root, entry.target);
    if (!pathIsInside(root, link) || !pathIsInside(root, target) || !fs.statSync(target).isDirectory()) {
      throw new Error(`Invalid packaged dependency link: ${entry.link} -> ${entry.target}`);
    }
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  }
  return manifest;
}

function parseArgs () {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    return [match[1], match[2] ?? true];
  }));
  return { root: path.resolve(String(args.app || process.cwd())), restore: args.restore === true };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const { root, restore } = parseArgs();
  const links = restore ? restorePackageLinks(root) : stripPackageLinks(root);
  console.log(`${restore ? 'Restored' : 'Staged'} ${links.length} target-native package links.`);
}
