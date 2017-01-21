/*global require*/

module.exports = Promise.all([
  require("./build-source-bundle.js")
])
.then(() => console.log("DONE"))
.catch(err => { console.error(err.stack || err); throw err; })
