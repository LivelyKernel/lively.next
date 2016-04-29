// even though acorn comes as es6 package there are certain issues with the
// module structures such as importing directories, not properly exporting which
// doesn't work with most es6 module systems. To make things easier for us we
// create one acorn bundle here that will "export" the lib into global.acorn

var fs = require("fs"),
    ast = require("../dist/lively.ast.js"),
    https = require("https"),
    tag = "0e8280aa061a0dbefb32d277a05015baa7f3e7f2",
    url = `https://raw.githubusercontent.com/estools/escodegen/${tag}/escodegen.browser.js`,
    targetFile1 = "dist/escodegen.browser.js",
    targetFile2 = "dist/escodegen.js"; // also works in node.js

module.exports = new Promise((resolve, reject) => https.get(url, resolve))
  .then(res => new Promise((resolve, reject) => {
    var data = "";
    res.on("error", reject);
    res.on("data", d => data += String(d));
    res.on("end", () => resolve(data));
  }))
  .then(source => { fs.writeFileSync(targetFile1, source); return source; })
  .then(globalizeFreeRefsAndThis)
  .then(flexibleGlobal)
  .then(source => fs.writeFileSync(targetFile2, source))
  .then(() => console.log(`acorn bundled into ${process.cwd()}/${targetFile1} and ${process.cwd()}/${targetFile2}`))
  .catch(err => { console.error(err.stack || err); throw err; })

function globalizeFreeRefsAndThis(source) {
  var topLevel = ast.query.topLevelDeclsAndRefs(source),
      unkown = topLevel.undeclaredNames
        .filter(n => ast.query.knownGlobals.indexOf(n) === -1)
        .reduce((all, ea) => all.indexOf(ea) === -1 ? all.concat([ea]) : all, []),
      refsToReplace = topLevel.refs.filter(ref => unkown.indexOf(ref.name) > -1)
                        .concat(topLevel.thisRefs)
                        .sort((a, b) => a.start < b.start ? -1 : a.start === b.start ? 0 : 1);

  // reverse!
  return refsToReplace.reduceRight((source, ref) =>
    source.slice(0, ref.start)
      + (ref.type === "ThisExpression" ?
        'GLOBAL' + source.slice(ref.end) :
        'GLOBAL.' + source.slice(ref.start)), source);
}

function flexibleGlobal(source) {
    return `;(function(GLOBAL) {
  ${source}
})(typeof window !== "undefined" ? window :
    typeof global!=="undefined" ? global :
      typeof self!=="undefined" ? self : this);
`;
}
