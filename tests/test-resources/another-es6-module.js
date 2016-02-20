var foo = 23;

console.log("running another-es6-module");

import { x } from "./some-es6-module.js";

export var y = x + 2;
