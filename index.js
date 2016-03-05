import * as completions from "./lib/completions.js";
import * as cjs from "./lib/commonjs-interface.js";
import * as es6 from "./lib/es6-interface.js";

var load, configure, bootstrap;
function setLoadFunction(f) { load = f; }
function setConfigureFunction(f) { configure = f; }
function setBootstrapFunction(f) { bootstrap = f; }

export * from "./lib/evaluator.js";
export {
  completions, cjs, es6,
  bootstrap, load, configure,
  setBootstrapFunction, setLoadFunction, setConfigureFunction
}
