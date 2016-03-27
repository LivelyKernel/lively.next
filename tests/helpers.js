/*global System*/

import { existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync, writeFileSync, mkdirSync } from "fs";
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
  console.log(baseDir)
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
  return new Promise((resolve, reject) => {
    if (!existsSync(path)) return resolve();
    readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(lstatSync(curPath).isDirectory()) { // recurse
        removeDirNode(curPath);
      } else { // delete file
        unlinkSync(curPath);
      }
    });
    rmdirSync(path);
    resolve();
  });
};

var removeDir = isNode ? removeDirNode : removeDirWeb;


export { createFiles, removeDir }
