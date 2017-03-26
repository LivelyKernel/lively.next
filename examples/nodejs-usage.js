require("../../lively.modules/node_modules/systemjs")
// require("../../lively.modules/dist/lively.modules.js")
require("../dist/lively.storage.js")

var Database = lively.storage,
    db = Database.ensureDB("test-db", {adapter: 'memory'});
console.log(db.pouchdb.adapter);

db.set("test", {name: "some-doc"}).then(function() {
  return db.get("test").then(function(result) {
    console.log("set/get result:", result);
  });
}).catch(function(err) { console.error(err); process.exit(1); })
