console.log("........ in es6-with-cjs/module2.js")

import { val } from '../cjs/module2.js';

console.log("es6-with-cjs/module2.js y: ", val);

export var y = val;