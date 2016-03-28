/*global System*/

import { existsSync, readdirSync, readFileSync, lstatSync, unlinkSync, rmdirSync, writeFileSync, mkdirSync } from "fs";
import fetch from "fetch";

var isNode = System.get("@system-env").node;

// FIXME: __rec__.fetch(...) doesnt work, arg..>!
var f = !isNode && fetch.bind(System.global);


function createFilesWeb(baseDir, fileSpec) {
  return f(baseDir, {method: "MKCOL"})
    .then(arg =>
      Promise.all(Object.keys(fileSpec).map(fileName =>
        typeof fileSpec[fileName] === "object" ?
          createFilesWeb(baseDir + "/" + fileName, fileSpec[fileName]) :
          f(baseDir + "/" + fileName, {method: "PUT", body: String(fileSpec[fileName])}))));
}

function createFilesNode(baseDir, fileSpec) {
  baseDir = baseDir.replace(/^[^\/]+:\/\//, "");
  return new Promise((resolve, reject) => {
    if (!existsSync(baseDir)) mkdirSync(baseDir);
    Object.keys(fileSpec).map(fileName =>
      typeof fileSpec[fileName] === "object" ?
      createFilesNode(baseDir + "/" + fileName, fileSpec[fileName]) :
      writeFileSync(baseDir + "/" + fileName, String(fileSpec[fileName])))
    resolve();
  })
}

var createFiles = isNode ? createFilesNode : createFilesWeb;


function removeDirWeb(dir) { return f(dir, {method: "DELETE"}); }

function removeDirNode(path) {
  if (!existsSync(path)) return Promise.resolve();
  readdirSync(path).forEach(function(file,index){
    var curPath = path + "/" + file;
    if(lstatSync(curPath).isDirectory()) removeDirNode(curPath);
    else unlinkSync(curPath);
  });
  rmdirSync(path);
  return Promise.resolve();
};

var removeDir = isNode ? removeDirNode : removeDirWeb;

function modifyFileWeb(file, modifyFunc) {
  return f(file, {method: "GET"})
    .then(res => res.text())
    .then(content => modifyFunc(content))
    .then(modified => f(file, {method: "PUT", body: String(modified)}));
}

function modifyFileNode(file, modifyFunc) {
  file = file.replace(/^[^\/]+:\/\//, "");
  return new Promise((resolve, reject) => {
    writeFileSync(file, modifyFunc(readFileSync(file).toString()));
    resolve();
  });
}

var modifyFile = isNode ? modifyFileNode : modifyFileWeb;

export { createFiles, removeDir, modifyFile }
