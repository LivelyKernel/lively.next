/* global process, require, module */
const { findPackageConfig } = require('flatn/flatn-cjs.js');
const babel = require('@babel/core');
const { flatnResolve, findPackagePathForModule, findPackageConfig: findPackageConfigBrowser } = require('flatn/module-resolver.js');
const path = require('node:path');
const fs = require('node:fs');
const { builtinModules } = require('node:module');
const child_process = require("node:child_process");
const commonjs = require('@rollup/plugin-commonjs');
const amdtoes6 = require('@buxlabs/amd-to-es6');
const es6tocjs = require('@babel/plugin-transform-modules-commonjs');
const nodePolyfills = require('rollup-plugin-polyfill-node');
const chalk = require('chalk');
const readline = require('readline');
const css = require('css');

async function availableFonts(fontCSSFile) {
  const _fonts = await import('lively.morphic/rendering/fonts.js');
  
  const projectFonts = {};
  css.parse(fontCSSFile).stylesheet?.rules.forEach(rule => {
    const fontDecl = rule.declarations?.find(decl => decl.property === 'font-family');
    let fontName = fontDecl?.value;
    if (fontName?.match(/^\"|\'/)) fontName = fontName.slice(1, -1);
    if (fontName && !projectFonts[fontDecl.value]) {
      projectFonts[fontName] = new Set();
    }
    const fontWeight = rule.declarations?.find(decl => decl.property === 'font-weight');
    if (fontName && fontWeight) {
      projectFonts[fontName].add(...fontWeight.value.split(' ').map(w => Number.parseInt(w)))
    }
  })
  return [
    ..._fonts.availableFonts(),
    // since we do not have project available here, we need to parse
    // the custom fonts from the css
    ...Object.entries(projectFonts).map(([name, weights]) => {
      return {
        name, supportedWeights: [...weights]
      }
    })
  ]
}

function isCdnImport(url) {
   return  url.includes('jspm.dev') ||
   url.includes('esm://');
}

function isAlreadyResolved(url) {
  if (url.startsWith('file://') ||
      url.startsWith('https://') ||
      isCdnImport(url) ||
      url.startsWith('node:')) return true;
}

function ensureFileFormat(url) {
  return url && url.startsWith('/') ? 'file://' + url : url;
}

function resolveModuleId (moduleName, importer, context = 'systemjs-node') {
  if (moduleName.startsWith('esm://')) {
    return moduleName;
  }
  if (isAlreadyResolved(moduleName) || moduleName.startsWith('/')) return moduleName; // already fully resolved name
  if (moduleName.startsWith('./') || moduleName.startsWith('../'))
    return null; // relative imports are handled by rollup itself
  return flatnResolve(moduleName, importer, context);
}

function detectFormatFromSource (source) {

}

function normalizeFileName (fileName) {
  if (isAlreadyResolved(fileName)) return fileName;
  return require.resolve(fileName);
}

function decanonicalizeFileName (fileName) {
  if (isAlreadyResolved(fileName)) return fileName;
  let url = require.resolve(fileName);
  if (fileName.endsWith('.js') &&
      !fileName.endsWith('index.js') &&
      url.endsWith('index.js')) {
    return url.replace('index.js', fileName.split('/').slice(-1)[0])
  }
  return url;
}

function resolvePackage (moduleName, context) {
  // if the moduleName is from a ESM cdn, we cannot determine the
  // package based on the module path
  if (isCdnImport(moduleName)) return;
  return context === 'systemjs-browser' ? findPackageConfigBrowser(moduleName) : findPackageConfig(moduleName);
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

const spinner = {
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  idx: 0,
  timer: null,
  text: '',
  active: false,
  _origLog: console.log,
  _origWarn: console.warn,
  _origError: console.error,

  start (text) {
    if (this.text === text && this.active) return; // deduplicate
    if (this.active) this._completeLine();
    this.text = text;
    this.idx = 0;
    this.active = true;
    this._hookConsole();
    if (!process.stdout.isTTY) {
      this._origLog.call(console, `   ${text}`);
      return;
    }
    this.render();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.render(), 80);
  },

  render () {
    const frame = this.frames[this.idx++ % this.frames.length];
    process.stdout.write(`\r   ${frame} ${this.text}\x1b[K`);
  },

  _completeLine () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (process.stdout.isTTY && this.text) {
      process.stdout.write(`\r   \x1b[32m✓\x1b[0m ${this.text}\x1b[K\n`);
    }
  },

  // While spinner is active, intercept console methods so they
  // clear the spinner line first, print, then re-render the spinner.
  _hookConsole () {
    if (console.log === this._wrappedLog) return; // already hooked
    const self = this;
    this._wrappedLog = function (...args) {
      if (self.active && process.stdout.isTTY) process.stdout.write('\r\x1b[K');
      self._origLog.apply(console, args);
      if (self.active && process.stdout.isTTY) self.render();
    };
    this._wrappedWarn = function (...args) {
      if (self.active && process.stdout.isTTY) process.stdout.write('\r\x1b[K');
      self._origWarn.apply(console, args);
      if (self.active && process.stdout.isTTY) self.render();
    };
    this._wrappedError = function (...args) {
      if (self.active && process.stdout.isTTY) process.stdout.write('\r\x1b[K');
      self._origError.apply(console, args);
      if (self.active && process.stdout.isTTY) self.render();
    };
    console.log = this._wrappedLog;
    console.warn = this._wrappedWarn;
    console.error = this._wrappedError;
  },

  _unhookConsole () {
    console.log = this._origLog;
    console.warn = this._origWarn;
    console.error = this._origError;
  },

  stop () {
    this._completeLine();
    this._unhookConsole();
    this.text = '';
    this.active = false;
  }
};

function setStatus ({ status = '', progress, label }) {
  const msg = progress
    ? `${status} ${(progress * 100).toFixed()}%`
    : status || label || '';
  if (msg) spinner.start(msg);
}

function finish () {
  spinner.stop();
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

async function fetchFile (url) {  
  const { resource } = await import('lively.resources');
  let attempt = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      return await resource(ensureFileFormat(url)).read();
    } catch (err) {
      attempt++;
      if (attempt < maxAttempts) {
        setStatus({ status: `Error fetching ${url}. Retrying...`});
        continue;
      }
      throw err;
    }
  }
}

async function load(url) {
  if (url === '@empty') return '';
  if (url.endsWith('?commonjs-entry')) return null;
  return  await fetchFile(url); 
}

function supportingPlugins(context = 'node', self) {
  return [
    context == 'node' && {
      name: 'system-require-handler',
      transform: (code, id) => {
  	       return code.replaceAll(/\s(System|this)._nodeRequire\(/g, ' require(');
      }
    },
    context == 'node' && {
      // source-map and related packages are written in AMD format
      // we transform this here to ESM in order to be properly consumed by rollup. 
      name: 'source-map-handler',
      transform: (code, id) => {
        if (id.includes('source-map') && code.includes('define')) {
          return babel.transform(amdtoes6(code), { plugins: [es6tocjs], babelrc: false }).code;
        }
        return null;
      }
    },
    context == 'node' && {
      // hack that allows us to incorporate all of astq into the bundle
      // by adjusting the code of some of the files directly
      // this is not needed, if we bundle with the browser as the target
      // platform
      name: 'astq-handler',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'astq-query-parse.pegjs',
          source: fs.readFileSync(resolveModuleId('astq/src/astq-query-parse.pegjs'))
        })
      },
      transform: (code, id) => {
        if (id.includes('astq.js')) {
          return code.replace('module.exports = ASTQ', 'export default ASTQ'); 
        }
        if (id.includes('astq-version.js')) {
          return code.replace(/\$major/g, 2)
            .replace( /\$minor/g, 7)
            .replace( /\$micro/g, 5)
            .replace( /\$date/g, 20210107);
        }
      }
    },
    {
       name: 'lively-resolve',
       resolveId: (id, importer) => self.resolveId(id, importer)
    }, // but only do resolutions so that polyfills does not screw us up
    context == 'browser' && nodePolyfills(), // only if we bundle for the browser
    commonjs({
      sourceMap: false,
      defaultIsModuleExports: true,
      transformMixedEsModules: true,
      dynamicRequireRoot: process.env.lv_next_dir,
      exclude: ['../**/base/0.11.1/utils.js', '../**/use/2.0.0/utils.js', /lively./],
      dynamicRequireTargets: [
         resolveModuleId('babel-plugin-transform-es2015-modules-systemjs')
      ]
    }),
    self,
  ].filter(Boolean);
}

const NodeResolver = {
  availableFonts,
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
  load,
  fetchFile,
  supportingPlugins
};

module.exports = NodeResolver;
