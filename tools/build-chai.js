var fs = require("fs");
var path = require("path");

module.exports = new Promise((resolve, reject) => {
  var chaiCode = fs.readFileSync(require.resolve("chai/chai.js"))
  var chaiSubsetCode = fs.readFileSync(require.resolve("chai-subset"))
  var code = `
    (function() {
      var GLOBAL = typeof window !== "undefined" ? window :
        typeof global!=="undefined" ? global :
          typeof self!=="undefined" ? self : this;
      (function() {
        var module = undefined, exports = undefined; // no cjs require should be used!
        ${chaiCode}
      }).call(GLOBAL);
      
      if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.chai;
      (function() {
        var module = {exports: {}}
        ${chaiSubsetCode}
        GLOBAL.chai.use(module.exports); // install then forget
      }).call(GLOBAL);
    })();
  `
  
  fs.writeFileSync("dist/chai.js", code);
  resolve();
});
