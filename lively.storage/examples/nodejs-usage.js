require("../dist/lively.storage.js")

var Database = lively.storage.Database,
    db = Database.ensureDB("test-db");
console.log(db.pouchdb.adapter);
console.log(db.pouchdb.name);

db.set("test", {name: "some-doc"}).then(() => 
  db.get("test").then(result => console.log("set/get result:", result)))
    .catch(function(err) { console.error(err); process.exit(1); })

let r = lively.resources.resource("lively.storage://nodejs-test-resource/foo/bar.js");
r.write("some content").then(() => r.read())
  .then(content => console.log("read from resource:" + content))
    .catch(function(err) { console.error(err); process.exit(1); })
