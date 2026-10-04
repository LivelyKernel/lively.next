import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { init, parse } from 'es-module-lexer';
import { linkLocalDependencies } from '../lively.installer/helpers.cjs';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const pending = new Map();
const supportedBunVersion = '1.4.2';
const validatedBunCommands = new Map();

async function readConfig(directory) {
  return JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
}

async function runtimeRoot() {
  return fs.realpath(path.resolve(process.env.lv_next_dir || sourceRoot));
}

async function workspaceEntries(root) {
  const { workspaces = [] } = await readConfig(root);
  return Promise.all(workspaces.map(async relative => {
    const directory = path.join(root, relative);
    return { directory, realDirectory: await fs.realpath(directory) };
  }));
}

async function resolveInstallContext(directory) {
  const root = await runtimeRoot();
  const realDirectory = await fs.realpath(directory);
  const projectRootPath = path.join(root, 'local_projects');
  await fs.mkdir(projectRootPath, { recursive: true });
  const projectRoot = await fs.realpath(projectRootPath);
  const relativeProjectPath = path.relative(projectRoot, realDirectory);
  const isProject = relativeProjectPath !== '' && !relativeProjectPath.startsWith(`..${path.sep}`) && relativeProjectPath !== '..' && !path.isAbsolute(relativeProjectPath);
  const workspaces = await workspaceEntries(root);
  const workspace = workspaces.find(entry => entry.realDirectory === realDirectory);
  if (!isProject && !workspace) throw new Error('Package installation requires a registered workspace or local project.');
  return {
    root,
    directory: workspace ? workspace.directory : realDirectory,
    realDirectory,
    isProject,
    isWorkspace: Boolean(workspace),
    workspaces
  };
}

async function bunExecutable() {
  const command = process.env.BUN_PATH || 'bun';
  if (!validatedBunCommands.has(command)) {
    validatedBunCommands.set(command, new Promise((resolve, reject) => {
      const child = spawn(command, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', reject);
      child.on('close', code => {
        const version = stdout.trim();
        const found = version ? `found ${version}` : stderr.trim() || `exit ${code}`;
        if (code === 0 && version === supportedBunVersion) resolve(command);
        else reject(new Error(`Bun ${supportedBunVersion} is required (${found}); set BUN_PATH to the supported executable`));
      });
    }));
  }
  return validatedBunCommands.get(command);
}

async function runBun(command, directory, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: directory, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Bun failed in ${directory} (${signal || code})`)));
  });
}

async function localPackages(root, workspaces) {
  const directories = workspaces.map(({ directory }) => directory);
  const projects = path.join(root, 'local_projects');
  for (const entry of await fs.readdir(projects, { withFileTypes: true })) {
    if (entry.isDirectory()) directories.push(path.join(projects, entry.name));
  }
  const packages = new Map();
  for (const directory of directories) {
    try {
      const config = await readConfig(directory);
      if (packages.has(config.name)) throw new Error(`Ambiguous local package: ${config.name}`);
      packages.set(config.name, directory);
    } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  return packages;
}

async function importedPackages(directory, names = new Set()) {
  await init;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'build', 'dist', '.module_cache'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await importedPackages(filename, names);
    else if (/\.(m?js|cjs)$/.test(entry.name)) {
      const [imports] = parse(await fs.readFile(filename, 'utf8'), filename);
      for (const { n: specifier } of imports) {
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes(':')) continue;
        names.add(specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/'));
      }
    }
  }
  return names;
}

async function install(context, { update = false, dependency } = {}) {
  const { root, directory, isProject, workspaces } = context;
  if (dependency) {
    const { name, version } = dependency;
    if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name) || typeof version !== 'string' || !version || version.includes('\0')) throw new Error('Invalid package specification');
  }
  const bun = await bunExecutable();
  const config = await readConfig(directory);
  const manifest = path.join(directory, 'package.json');
  if (!update) {
    await fs.access(path.join(isProject ? directory : root, 'bun.lock')).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      if (!isProject) throw new Error('Missing workspace bun.lock; restore the repository lockfile before installing.');
      // Legacy projects have no Bun lock yet. Migrate once, then keep frozen installs.
      update = true;
    });
  }
  if (update && isProject) {
    const candidates = await localPackages(root, workspaces);
    const imports = await importedPackages(directory);
    for (const name of Object.keys(config.dependencies || {})) imports.add(name);
    const links = { ...config.lively?.localDependencies };
    for (const name of imports) {
      const target = candidates.get(name);
      if (!target || await fs.realpath(target) === context.realDirectory) continue;
      links[name] = path.relative(directory, target).split(path.sep).join('/');
      // Local source is linked explicitly; Bun locks the external dependency graph.
      if (config.dependencies) delete config.dependencies[name];
    }
    config.lively = { ...config.lively, localDependencies: links };
    await fs.writeFile(manifest, JSON.stringify(config, null, 2) + '\n');
  }
  if (dependency) {
    const { name, version } = dependency;
    await runBun(bun, directory, ['add', `${name}@${version}`]);
  } else {
    await runBun(bun, directory, ['install', ...(update ? [] : ['--frozen-lockfile'])]);
  }
  const localLinks = { ...config.lively?.localDependencies, ...(isProject ? { [config.name]: '.' } : {}) };
  linkLocalDependencies(directory, localLinks);
  const { generateImportMapForPackage } = await import('../lively.server/plugins/lib-lookup.js');
  await generateImportMapForPackage(directory, { update: update || Boolean(dependency) });
  return directory;
}

export async function installProjectDependencies(directory, options) {
  const context = await resolveInstallContext(directory);
  const key = context.isWorkspace ? context.root : context.realDirectory;
  const operation = (pending.get(key) || Promise.resolve()).catch(() => {}).then(() => install(context, options));
  pending.set(key, operation);
  operation.finally(() => { if (pending.get(key) === operation) pending.delete(key); }).catch(() => {});
  return operation;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node lively.project/package-install.mjs local_projects/name [--update]');
  await installProjectDependencies(path.resolve(process.argv[2]), { update: process.argv.includes('--update') });
}
