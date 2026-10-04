/* global process, require, module */
const babel = require('@babel/core');
const { create: createResolver } = require('enhanced-resolve');
const { fileURLToPath, pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const livelyRoot = path.resolve(process.env.lv_next_dir || path.join(__dirname, '../../..'));
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
   return url.startsWith('https://jspm.dev/') ||
   url.startsWith('https://ga.jspm.io/') ||
   url.startsWith('https://esm.sh/') ||
   url.startsWith('esm://');
}

function isAlreadyResolved(url) {
  if (url.startsWith('file://') ||
      url.startsWith('https://') ||
      isCdnImport(url) ||
      url.startsWith('node:')) return true;
}

function ensureFileFormat(url) {
  return url && path.isAbsolute(url) ? pathToFileURL(url).href : url;
}

// The freezer calls resolution synchronously, including outside Rollup hooks.
// Delegate package conditions to the maintained resolver rather than parsing exports.
const browserResolve = createResolver.sync({
  conditionNames: ['browser', 'import', 'default'],
  mainFields: ['browser', 'module', 'main'],
  aliasFields: ['browser'],
  extensions: ['.js', '.mjs', '.cjs', '.json', '.node'],
  symlinks: true
});
const nodeResolve = createResolver.sync({
  conditionNames: ['node', 'import', 'default'],
  mainFields: ['main'],
  extensions: ['.js', '.mjs', '.cjs', '.json', '.node'],
  symlinks: true
});

function resolveModuleId (moduleName, importer = __filename, context = 'systemjs-node') {
  if (moduleName.startsWith('file:')) return fileURLToPath(moduleName);
  if (isAlreadyResolved(moduleName) || path.isAbsolute(moduleName) || moduleName === '@empty') return moduleName;
  if (moduleName.startsWith('./') || moduleName.startsWith('../')) return null;
  if (builtinModules.includes(moduleName) || moduleName.startsWith('node:')) return moduleName;
  const parent = importer.startsWith('file:') ? fileURLToPath(importer) : importer;
  const resolve = context === 'systemjs-browser' ? browserResolve : nodeResolve;
  const basedir = path.isAbsolute(parent) ? path.dirname(parent) : process.cwd();
  const resolved = resolve(basedir, moduleName);
  return resolved === false ? '@empty' : resolved;
}

function findPackagePathForModule (moduleName) {
  if (!moduleName || isCdnImport(moduleName) || moduleName.startsWith('node:')) return;
  let location = moduleName.startsWith('file:') ? fileURLToPath(moduleName) : moduleName;
  if (!path.isAbsolute(location)) return;
  let dir = fs.existsSync(location) && fs.statSync(location).isDirectory() ? location : path.dirname(location);
  while (true) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

function detectFormatFromSource (source) {

}

function normalizeFileName (fileName) {
  if (fileName.startsWith('file:')) fileName = fileURLToPath(fileName);
  if (isAlreadyResolved(fileName)) return fileName;
  return require.resolve(fileName);
}

function decanonicalizeFileName (fileName) {
  if (fileName.startsWith('file:')) fileName = fileURLToPath(fileName);
  if (isAlreadyResolved(fileName)) return fileName;
  let url = require.resolve(fileName);
  if (fileName.endsWith('.js') &&
      !fileName.endsWith('index.js') &&
      url.endsWith('index.js')) {
    return url.replace('index.js', fileName.split('/').slice(-1)[0])
  }
  return url;
}

function resolvePackage (moduleName) {
  if (!moduleName || isCdnImport(moduleName) || moduleName.startsWith('node:') || builtinModules.includes(moduleName) || moduleName.startsWith('@empty')) return;
  const packageDir = findPackagePathForModule(moduleName);
  if (!packageDir) return;
  const config = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const mapFile = path.join(packageDir, '.cachedImportMap.json');
  if (fs.existsSync(mapFile)) {
    config.systemjs = { ...config.systemjs, importMap: { ...JSON.parse(fs.readFileSync(mapFile, 'utf8')), _mapUrl: pathToFileURL(mapFile).href } };
  }
  return config;
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
      const source = resource(ensureFileFormat(url));
      if (source.isESMResource) source.getBaseURL = () => pathToFileURL(livelyRoot + path.sep).href;
      return await source.read();
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
  const livelyPackageRoot = livelyRoot
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const livelyPackage = new RegExp(
    `^${livelyPackageRoot}/lively\\.[^/]+/`
  );

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
      dynamicRequireRoot: livelyRoot,
      exclude: ['../**/base/0.11.1/utils.js', '../**/use/2.0.0/utils.js', livelyPackage],
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
