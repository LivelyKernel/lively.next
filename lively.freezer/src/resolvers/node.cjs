/* global process, require, module */
const { findPackageConfig } = require('flatn/flatn-cjs.js');
const babel = require('@babel/core');
const { flatnResolve, findPackagePathForModule } = require('flatn/module-resolver.js');
const path = require('node:path');
const { builtinModules } = require('node:module');
const child_process = require("node:child_process");


// Problem: Just defering to rollup seems to bypass the flatn resolution mechanism
// flatn 

function isAlreadyResolved(url) {
  if (url.startsWith('file://') ||
      url.startsWith('https://') ||
      url.includes('jspm.dev') ||
      url.startsWith('node:')) return true;
}

function ensureFileFormat(url) {
  return url && url.startsWith('/') ? 'file://' + url : url;
}

// fixme: if we are bundling from a node.js script but targeting the browser, we need to properly resolve /npm- urls
function resolveModuleId (moduleName, importer, context = 'node') {
  if (moduleName.startsWith('esm://cache/')) return moduleName.replace('esm://cache/', 'https://jspm.dev/'); // for now
  if (importer && importer.startsWith('https://jspm.dev/')) {
    if (moduleName.startsWith('/')) 'https://jspm.dev' + moduleName;
    if (moduleName.startsWith('https://jspm.dev')) return moduleName;
  }
  if (isAlreadyResolved(moduleName) || moduleName.startsWith('/')) return moduleName; // already fully resolved name
  if (moduleName.startsWith('./') || moduleName.startsWith('../'))
    return null; // not our job to resolve relative imports?
  // still this needs to take into account the importer since we are node.js and package.json is IMPORTANT!
  return flatnResolve(moduleName, importer, context);
}

function detectFormatFromSource (source) {

}

async function normalizeFileName (fileName) {
  // return await System.normalize(fileName);
  if (isAlreadyResolved(fileName)) return fileName;
  return require.resolve(fileName);
}

function decanonicalizeFileName (fileName) {
  if (isAlreadyResolved(fileName)) return fileName;
  // return await System.decanonicalize(fileName);
  let url = require.resolve(fileName);
  if (fileName.endsWith('.js') &&
      !fileName.endsWith('index.js') &&
      url.endsWith('index.js')) {
    return url.replace('index.js', fileName.split('/').slice(-1)[0])
  }
  return url;
}

function resolvePackage (moduleName) {
  // return module(moduleName).package();
  // extract the package name from a module, maybe via flatn?
  return findPackageConfig(moduleName);
}

function dontTransform (moduleId, knownGlobals) {
  return knownGlobals;
}

function pathInPackageFor (moduleId) {
  const pkgPath = findPackagePathForModule(moduleId);
  return moduleId.replace(pkgPath, '.');
}

function detectFormat (moduleId) {
  // return module(moduleId).format();
}

function setStatus ({ status, progress, label }) {

}

function finish () {

}

function whenReady () {

}

function spawn ({ command, cwd }) {
  // handle this natively...
  const c = child_process.exec(command, { cwd });
  const res = { status: 'running' };
  c.on('close', () => {
    res.status = 'exited'
  });
  return res;
}

async function load(url) {
  if (url === '@empty') return '';
  const { resource } = await import('lively.resources');
  // also transpile the source code if this is a js file...
  // in the future we should restrict it to cp.js or some
  // more general lv.js files...
  const code = await resource(ensureFileFormat(url)).read();
  if (url.endsWith('.js') || url.endsWith('.cjs'))
    return babel.transform(code, {
      plugins: [
        require('@babel/plugin-proposal-class-properties')
      ]
      // systemjs transform is not really needed
    }).code;
  return code;
}

const NodeResolver = {
  resolveModuleId,
  normalizeFileName,
  decanonicalizeFileName,
  resolvePackage,
  dontTransform,
  pathInPackageFor,
  detectFormat,
  detectFormatFromSource,
  setStatus,
  finish,
  whenReady,
  spawn,
  builtinModules,
  ensureFileFormat,
  load
};

module.exports = NodeResolver;
