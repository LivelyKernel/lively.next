/*global module, require, __dirname, process*/

// even though acorn comes as es6 package there are certain issues with the
// module structures such as importing directories, not properly exporting which
// doesn't work with most es6 module systems. To make things easier for us we
// create one acorn bundle here that will "export" the lib into global.acorn

var path = require("path"),
    fs = require("fs"),
    execSync = require("child_process").execSync,
    astDir = path.join(__dirname, ".."),
    _ = global.lively = {lang: require("lively.lang")},
    ast = require("../dist/lively.ast.js"),
    escodegenRepo = "https://github.com/LivelyKernel/escodegen",
    escodegenVersion = "master",
    targetFile1 = "dist/escodegen.browser.js",
    targetFile2 = "dist/escodegen.js"; // also works in node.js

module.exports =
  installEscodegen()
  .then(source => { fs.writeFileSync(targetFile1, source); return source; })
  .then(globalizeFreeRefsAndThis)
  .then(flexibleGlobal)
  .then(source => fs.writeFileSync(targetFile2, source))
  .then(() => console.log(`escodegen bundled into ${process.cwd()}/${targetFile1} and ${process.cwd()}/${targetFile2}`))
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
  source = refsToReplace.reduceRight((source, ref) =>
    source.slice(0, ref.start)
      + (ref.type === "ThisExpression" ?
        'GLOBAL' + source.slice(ref.end) :
        'GLOBAL.' + source.slice(ref.start)), source);

  source = source.replace(/GLOBAL.define/g, "define");

  return source;
}

function flexibleGlobal(source) {
    return `;(function(GLOBAL) {
  ${source}
})(typeof window !== "undefined" ? window :
    typeof global!=="undefined" ? global :
      typeof self!=="undefined" ? self : this);
`;
}

function installEscodegen() {
  var buildDir = path.join(astDir, "escodegen-build");

  return new Promise((resolve, reject) => {
    // 1. clone + build

    try {
  
      if (fs.existsSync(buildDir)) execSync("rm -rf " + buildDir);
      
      var commands = [
        {cmd: `git clone --branch ${escodegenVersion} ${escodegenRepo} ${buildDir}`, opts: {cwd: astDir, stdio: null}},
        {cmd: "npm install", opts: {cwd: buildDir, stdio: null}},
        {cmd: "npm run-script build", opts: {cwd: buildDir, stdio: null}}
      ]
  
      commands.forEach((ea) => {
        console.log(`Running command ${ea.cmd}...`)
        execSync(ea.cmd, ea.opts);
        console.log(`... ${ea.cmd} done`)
      });
  
      var source = fs.readFileSync(path.join(buildDir, "escodegen.browser.js"));
      execSync("rm -rf " + buildDir);
      resolve(String(source));

    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}