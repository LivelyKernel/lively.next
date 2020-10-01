import 'lively.modules/systemjs-init.js';
import * as modules from 'lively.modules';

(lively || global.lively).FreezerRuntime = null; // exposing this variable should be removed from the freezer
(lively || global.lively).modules = modules;

if (typeof module !== "undefined" && typeof require === "function") module.exports = modules;