import { module } from 'lively.modules/index.js';
import { LoadingIndicator } from 'lively.components';
import { detectModuleFormat } from 'lively.modules/src/module.js';
import { runCommand } from 'lively.ide/shell/shell-interface.js';
import { resource } from 'lively.resources';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { availableFonts } from 'lively.morphic/rendering/fonts.js';

function resolveModuleId (moduleName, importer) {
  return System.decanonicalize(moduleName, importer);
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

function supportingPlugins (self) {
  return [
    self,
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
