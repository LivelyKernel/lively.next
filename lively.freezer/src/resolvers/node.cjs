/* global process, require */
const { findPackageConfig } = require('flatn/flatn-cjs.js');
const { flatnResolve } = require('flatn/module-resolver.js');
const path = require('node:path');
const { builtinModules } = require('node:module');

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

function resolveModuleId (moduleName, importer) {
  if (isAlreadyResolved(moduleName) && moduleName.startsWith('/')) return moduleName; // already fully resolved name
  if (moduleName.startsWith('esm://cache/')) return moduleName.replace('esm://cache/', 'https://jspm.dev/'); // for now
  if (moduleName.startsWith('./') || moduleName.startsWith('../'))
    return null; // not our job to resolve relative imports?
  // still this needs to take into account the importer since we are node.js and package.json is IMPORTANT!
  return flatnResolve(moduleName, importer);
}

function detectFormatFromSource (source) {

}

async function normalizeFileName (fileName) {
  // return await System.normalize(fileName);
  if (isAlreadyResolved(fileName)) return fileName;
  return require.resolve(fileName);
}

async function decanonicalizeFileName (fileName) {
  if (isAlreadyResolved(fileName)) return fileName;
  // return await System.decanonicalize(fileName);
  return require.resolve(fileName);
}

function resolvePackage (moduleName) {
  // return module(moduleName).package();
  // extract the package name from a module, maybe via flatn?
  return findPackageConfig(moduleName);
}

function dontTransform (moduleId) {
  // return module(moduleId).dontTransform;
  return [];
}

function pathInPackageFor (moduleId) {
  // return module(moduleId).pathInPackage();
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
  // const cmd = new ServerCommand().spawn({ command, cwd });
  // const c = { status: 'started' };
  // cmd.on('stdout', stdout => c.status = 'exited');
  // return c;
}

async function load(url) {
  const { resource } = await import('lively.resources');
  return await resource(ensureFileFormat(url)).read()
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
  load
};

module.exports = NodeResolver;
