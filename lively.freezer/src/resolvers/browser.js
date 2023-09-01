import { module } from 'lively.modules/index.js';
import { LoadingIndicator } from 'lively.components';
import { detectModuleFormat } from 'lively.modules/src/module.js';
import { runCommand } from 'lively.ide/shell/shell-interface.js';
import { resource } from 'lively.resources';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { availableFonts } from 'lively.morphic/rendering/fonts.js';

function resolveModuleId (moduleName, importer) {
  // in the client, we just discard the importer. This works out almost all the time.
  // however what about conflicting version of a package loaded at the same time in the system?
  // resolving acorn for instance will lead to different results down the line depending
  // on what the package.json says. But 99% of the time we do not really use deps
  // in the package.json. Instead we import lively packages (custom resolve and no version conflicts)
  // or we fetch via absolute url from esm cdn in which case we have no conflicts since the
  // version is part of the module name in the first place.
  // fixme: revise module resoluton in client, and unify resolution of modules in the client as well as node.js.
  return module(moduleName).id;
}

function ensureFileFormat (url) { return url; }

async function normalizeFileName (fileName) {
  return await System.normalize(fileName);
}

function decanonicalizeFileName (fileName) {
  return System.decanonicalize(fileName);
}

export function resolvePackage (moduleName) {
  return module(moduleName).package();
}

function dontTransform (moduleId) {
  return module(moduleId).dontTransform;
}

function pathInPackageFor (moduleId) {
  return module(moduleId).pathInPackage();
}

function detectFormatFromSource (source) {
  return detectModuleFormat(source);
}

function detectFormat (moduleId) {
  return module(moduleId).format();
}

let li;

function setStatus ({ status, progress, label }) {
  if (!li) li = LoadingIndicator.open();
  if (!li.world()) li.openInWorld();
  if (status) li.status = status;
  if (label) li.label = label;
  if (typeof progress !== 'undefined') li.progress = progress;
}

function finish () {
  li.remove();
  li = null;
}

function whenReady () {
  return li.whenEnvReady();
}

function spawn ({ command, cwd }) {
  return runCommand(command, { cwd });
}

async function fetchFile (url) {
  while (true) {
    let attempts = 0;
    const maxAttempts = 3;
    try {
      try {
        return await resource(url).read();
      } catch (err) {
        return await resource(url).makeProxied().read();
      }
    } catch (err) {
      attempts++;
      if (attempts < maxAttempts) continue;
      throw err;
    }
  }
}

async function load (url) {
  if (url === '@empty.js') return '';
  return await fetchFile(url);
}

function supportingPlugins () {
  return [
    commonjs({
      sourceMap: false,
      defaultIsModuleExports: true,
      transformMixedEsModules: true,
      dynamicRequireRoot: System.baseURL
    }),
    nodePolyfills()
  ];
}

const builtinModules = [];

const BrowserResolver = {
  availableFonts,
  resolveModuleId,
  isBrowserResolver: true,
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
  load,
  fetchFile,
  builtinModules,
  ensureFileFormat,
  supportingPlugins
};

export default BrowserResolver;
