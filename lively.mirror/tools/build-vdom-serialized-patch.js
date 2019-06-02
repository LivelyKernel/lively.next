var exec = require("child_process").execSync
var path = require("path");


var cmd = "browserify "
        + "node_modules/vdom-serialized-patch/index.js "
        + "--standalone vdomSerializedPatch "
        + "-o vdom-serialized-patch-browserified.js";
var out = exec(cmd, {cwd: path.resolve(__dirname, "..")});

console.log(out.toString());

console.log(`[tools/build-vdom-serialized-patch.js] DONE`);
