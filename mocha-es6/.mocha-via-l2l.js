// rsync --exclude node_modules --exclude .git -la ../lively.modules/ .
// 
// node -e "require('/Users/robert/Dropbox/Projects/js/node-2-lively/examples/nodejs2lively.for-import.js')"


var path = require("path");

global.babel = require("./node_modules/babel-core");
require("./node_modules/systemjs");
require("./dist/lively.modules.js");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var parseArgs = require('mocha-es6/node_modules/minimist');
var glob      = require('mocha-es6/node_modules/glob');
var path      = require("path");
var fs        = require("fs");
var dir       = process.cwd();

// lively.modules.System.config({map: {"lively.ast": `file://${path.join(dir, "node_modules/lively.ast")}`}})
// lively.modules.System.config({map: {"lively.vm": `file://${path.join(dir, "node_modules/lively.vm")}`}})
// lively.modules.System.config({map: {"lively.lang": `file://${path.join(dir, "node_modules/lively.lang")}`}})

// lively.modules.importPackage("file:///Users/robert/Lively/lively-dev/lvm")
//   .then(m => console.log("Imported!"))
//   .catch(err => console.error(err))

// lively.modules.runEval("2**3", {targetModule: "lively.modules/index.js"})
//   .then(r => console.log(r))
//   .catch(err => console.error(err))

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


lively.modules.System.trace = true
// System.debug = true
lively.modules.unwrapModuleLoad();

var mochaEs6;
var testFiles; 
Promise.resolve()
  .then(() => lively.modules.importPackage(path.dirname(require.resolve('mocha-es6'))))
  .then(m => console.log("mocha loaded!") || (mochaEs6 = m))
  .then(() => lively.modules.importPackage("file://" + dir))
  .then(m => console.log("project at %s imported", dir))
  .then(() => findTestFiles(["tests/eval-test.js"]).then(x => testFiles = x))
  .then(m => console.log("%s test files found", testFiles.length))
  .then(() => mochaEs6.runTestFiles(testFiles))
  .then(failures => console.log("%s failures", failures))
  .catch(err => console.error(err))


function findTestFiles(files) {
  return Promise.resolve()
    .then(() => {
      if (!files || !files.length)
        throw new Error("No test files specfied!");
      return Promise.all(files.map(f =>
        new Promise((resolve, reject) =>
          glob(f, {nodir: true, cwd: dir}, (err, files) =>
            err ? reject(err) : resolve(files))))); })
    .then(allFiles => allFiles.reduce((all, files) => all.concat(files)))
    .then(files => files.map(f => "file://" + path.join(dir, f)))
}


// System.import(dir + "/src/eval.js")
//   .then(evaler => console.log("????") || evaler.runEval(System, "1 + z + x", {targetModule: dir + "/index.js"}))
//   .then(r => console.log("???"))
//   .then(r => console.log(r))
//   .catch(err => console.error(err))  
  
// import { evaler.runEval } from "../src/eval.js";
// evaler.runEval(System, "1 + z + x", {targetModule: module1})
//       .then(result => expect(result.value).equals(6))
