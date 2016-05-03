/*global require*/

module.exports = Promise.all([
  require("./build-doc.js"),
  require("./build-source-bundle.js")
]).catch(err => { console.error(err.stack || err); throw err; })
