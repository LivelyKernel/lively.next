/* global System, fetch */

import {
  existsSync as node_existsSync,
  readdirSync as node_readdirSync,
  readFileSync as node_readFileSync,
  lstatSync as node_lstatSync,
  unlinkSync as node_unlinkSync,
  unlink as node_unlink,
  rmdirSync as node_rmdirSync,
  writeFile as node_writeFile,
  writeFileSync as node_writeFileSync,
  mkdirSync as node_mkdirSync
} from 'fs';
import { getSystem } from '../index.js';

import { obj } from 'lively.lang';

let isNode = System.get('@system-env').node;

function createFilesWeb (baseDir, fileSpec) {
  return fetch(baseDir, { method: 'MKCOL' })
    .then(arg =>
      Promise.all(Object.keys(fileSpec).map(fileName =>
        typeof fileSpec[fileName] === 'object'
          ? createFilesWeb(baseDir + '/' + fileName, fileSpec[fileName])
          : fetch(baseDir + '/' + fileName, { method: 'PUT', body: String(fileSpec[fileName]) }))));
}

function createFilesNode (baseDir, fileSpec) {
  baseDir = baseDir.replace(/^[^\/]+:\/\//, '');
  return new Promise((resolve, reject) => {
    if (!node_existsSync(baseDir)) node_mkdirSync(baseDir);
    Object.keys(fileSpec).map(fileName =>
      typeof fileSpec[fileName] === 'object'
        ? createFilesNode(baseDir + '/' + fileName, fileSpec[fileName])
        : node_writeFileSync(baseDir + '/' + fileName, String(fileSpec[fileName])));
    resolve();
  });
}

let createFiles = isNode ? createFilesNode : createFilesWeb;

function readFileWeb (file) {
  return fetch(file, { method: 'GET' })
    .then(res => res.text());
}

function readFileNode (file) {
  file = file.replace(/^[^\/]+:\/\//, '');
  return Promise.resolve().then(() => node_readFileSync(file).toString());
}

let readFile = isNode ? readFileNode : readFileWeb;

function removeDirWeb (dir) { return fetch(dir, { method: 'DELETE' }); }

function removeDirNode (path) {
  if (!node_existsSync(path)) return Promise.resolve();
  node_readdirSync(path).forEach(function (file, index) {
    let curPath = path + '/' + file;
    if (node_lstatSync(curPath).isDirectory()) removeDirNode(curPath);
    else node_unlinkSync(curPath);
  });
  node_rmdirSync(path);
  return Promise.resolve();
}

let removeDir = isNode ? removeDirNode : removeDirWeb;

function removeFileNode (file) {
  file = file.replace(/^[^\/]+:\/\//, '');
  return new Promise((resolve, reject) => node_unlink(file, (err) => err ? reject(err) : resolve()));
}

let removeFile = isNode ? removeFileNode : removeDirWeb;

function modifyFileWeb (file, modifyFunc) {
  return readFileWeb(file)
    .then(content => modifyFunc(content))
    .then(modified => fetch(file, { method: 'PUT', body: String(modified) }));
}

function modifyFileNode (file, modifyFunc) {
  file = file.replace(/^[^\/]+:\/\//, '');
  return new Promise((resolve, reject) => {
    node_writeFileSync(file, modifyFunc(node_readFileSync(file).toString()));
    resolve();
  });
}

let modifyFile = isNode ? modifyFileNode : modifyFileWeb;

function writeFileWeb (file, content) {
  return fetch(file, { method: 'PUT', body: String(content) });
}

function writeFileNode (file, content) {
  file = file.replace(/^[^\/]+:\/\//, '');
  return new Promise((resolve, reject) =>
    node_writeFile(file, String(content), err => err ? reject(err) : resolve()));
}

let writeFile = isNode ? writeFileNode : writeFileWeb;

function modifyJSON (file, changeObj) {
  return modifyFile(file,
    content => JSON.stringify(obj.deepMerge(JSON.parse(content), changeObj)));
}

function noTrailingSlash (path) { return path.replace(/\/$/, ''); }

let inspect = !isNode && typeof lively !== 'undefined' && lively.morphic && lively.morphic.inspect
  ? lively.morphic.inspect
  : console.log.bind(console);

function runInIframe (id, func) {
  let iframe;
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { return reject(new Error(`iframe with id ${id} already exists`)); }
    iframe = document.createElement('iframe');
    iframe.id = id;
    document.body.appendChild(iframe);
    let GLOBAL = iframe.contentWindow;
    return resolve(GLOBAL['eval'](String(func)).call(GLOBAL));
  })
    .then(result => { iframe && iframe.parentNode.removeChild(iframe); return result; })
    .catch(err => { iframe && iframe.parentNode.removeChild(iframe); throw err; });
}

function prepareSystem (name, testProjectDir) {
  const S = getSystem(name, { baseURL: testProjectDir });
  S.set('lively.transpiler.babel', System.get('lively.transpiler.babel'));
  S.config({ transpiler: 'lively.transpiler.babel' });
  S.translate = async (load, opts) => await System.translate.bind(S)(load, opts);
  S.useModuleTranslationCache = false;
  S.babelOptions = System.babelOptions;
  return S;
}

export {
  createFiles, removeDir,
  modifyFile, modifyJSON, readFile, writeFile, removeFile,
  noTrailingSlash,
  inspect,
  runInIframe,
  prepareSystem
};
