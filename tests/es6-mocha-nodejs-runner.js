function testPath(path) {
  return __dirname + "/" + path;
}

require("../index-node.js").load()
  .then(vm => {
    System.config({
      transpiler: "babel",
      map: {
        mocha: testPath("../node_modules/mocha/mocha.js"),
        chai: testPath("../node_modules/chai/chai.js"),
        "chai-subset": testPath("../node_modules/chai-subset/lib/chai-subset.js")
      },
      meta: {[testPath("../node_modules/mocha/mocha.js")]: {exports: 'mocha', format: 'global'}}
    });
    return System.import(testPath("es6-mocha-runner.js"));
  })
  .catch(err => console.error(err))
