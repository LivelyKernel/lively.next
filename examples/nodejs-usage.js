require("../../lively.modules/node_modules/systemjs")
// require("../../lively.modules/dist/lively.modules.js")
require("../dist/lively.storage.js")

let Database = lively.storage;
let db = Database.ensureDB("test-db", {adapter: 'memory'});
console.log(db.pouchdb.adapter)
