/* global process, require, module */
const { findPackageConfig } = require('flatn/flatn-cjs.js');
const babel = require('@babel/core');
const { flatnResolve, findPackagePathForModule } = require('flatn/module-resolver.js');
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
// Problem: Just defering to rollup seems to bypass the flatn resolution mechanism
// flatn 

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
  if (status) console.log(chalk.cyan('[lively.freezer]:'), status);
  if (label) console.log(chalk.cyan('[lively.freezer]:'), label);
  if (progress) {
    if (Boolean(process.stdout.isTTY)) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
    } else {
      readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write((progress * 100).toFixed() + '%');
  }
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
        console.log(`[lively.freezer] Error fetching ${url}. Retrying...`);
        continue;
      }
      throw err;
    }
  }
}

async function load(url) {
  if (url === '@empty') return '';
  return  await fetchFile(url); 
}

function supportingPlugins(context = 'node') {
  return [
    context == 'node' && {
      name: 'system-require-handler',
      transform: (code, id) => {
  	       return code.replaceAll(/\s(System|this)._nodeRequire\(/g, ' require(');
      }
    },
    context == 'browser' && {
       name: 'node-prefix-remover',
       resolveId(id, importer, options) {
         return this.resolve(id.replace('node:', ''), importer, { skipSelf: true, ...options });       
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
    context == 'browser' && nodePolyfills(), // only if we bundle for the browser  
    commonjs({
      sourceMap: false,
      defaultIsModuleExports: true,
      transformMixedEsModules: true,
      dynamicRequireRoot: process.env.lv_next_dir,
      exclude: ['../**/base/0.11.1/utils.js', '../**/use/2.0.0/utils.js'],
      dynamicRequireTargets: [
         resolveModuleId('babel-plugin-transform-es2015-modules-systemjs')
      ]
    })
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
