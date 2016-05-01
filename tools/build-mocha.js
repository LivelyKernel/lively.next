var fs = require("fs");
var path = require("path");

// just copy it over

fs.writeFileSync("dist/mocha.js", fs.readFileSync(require.resolve("mocha/mocha.js")))
module.exports = Promise.resolve();
