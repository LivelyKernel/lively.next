var System = require('systemjs');
var { resource } = require("../deps/lively.resources");
var { arr } = require("lively.lang");
var { query } = require("../deps/lively.ast");
var { getPackage, importPackage, module } = require("lively.modules");

build();

let files = [
  "util.js",
  "package-map.js",
  "dependencies.js",
  "download.js",
  "build.js",
  "index.js",
]

// await p.reload()
async function build() {
  let pkg = await importPackage(".");
  pkg = getPackage('flatn');
  let bundledSource = await bundleToCjs(pkg, files),
      dist = resource(pkg.url).join(`flatn-cjs.js`);
  await dist.parent().ensureExistance();
  await dist.write(bundledSource);
  process.exit();
}

// let m = module(pkg.url + "/" + files[1])
// toCjsSource(m, await m.imports(), await m.exports(), await m.source(), files.map(ea => module(pkg.url + "/" + ea)))

// let parsed = await m.ast()

async function bundleToCjs(pkg, bundleFiles) {
  let modules = bundleFiles.map(ea => module(pkg.url + "/" + ea)),
      _ = modules.forEach(m => m.reset()),
      moduleImports = await Promise.all(modules.map(ea => ea.imports())),
      moduleExports = await Promise.all(modules.map(ea => ea.exports())),
      moduleSources = await Promise.all(modules.map(ea => ea.source())),
      moduleAsts = await Promise.all(modules.map(ea => ea.ast()));

  return modules
    .map((ea, i) => {
      const moduleMarker = ea.id.slice(System.baseURL.length);
      return (
        `// >>> ${moduleMarker}\n` +
        toCjsSource(
          ea,
          moduleImports[i],
          moduleExports[i],
          moduleSources[i],
          moduleAsts[i],
          modules
        ) +
        `// <<< ${moduleMarker}\n`
      );
    })
    .join("\n");
}

function toCjsSource(module, itsImports, itsExports, itsSource, itsAst, modulesInBundle) {
  console.log(module.id);
  let moduleIds = modulesInBundle.map(ea => ea.id);

  let otherReplacements = query.topLevelDeclsAndRefs(itsAst).varDecls.map(ea => {
    let {kind, start} = ea;
    if (kind === "const") return {start, end: start+"const".length, newSource: "var"}
    if (kind === "let") return {start, end: start+"let".length, newSource: "var"}
  }).filter(Boolean);

  let importReplacements = itsImports.map(ea => {
    let { fromModule, imported, local, node: {start, end} } = ea,
        isLocal = fromModule.startsWith("."),
        fromModuleId = isLocal && resource(module.id).parent().join(ea.fromModule).withRelativePartsResolved().url,
        isInBuild = isLocal && moduleIds.includes(fromModuleId);

    if (isInBuild)
      return {start, end, newSource: ""};

    let newSource;
    if (imported === "default") {
      newSource = `var ${local} = require("${fromModule}");`
    } else {
      let name = imported === local ? imported : `${imported}: ${local}`;
      newSource = `var { ${name} } = require("${fromModule}");`
    }
    return {start, end, newSource};
  });

  let exportReplacements = itsExports.map(ea => {
    let { exported, local, node: {start, end} } = ea;
    return {start, end, newSource: `module.exports.${exported} = ${local};`};
  })
  
  let replacementsByPos = arr.groupBy([...otherReplacements, ...importReplacements, ...exportReplacements], ea => ea.start + ":" + ea.end).toArray(),
      sortedReplacements = arr.sortBy(replacementsByPos, ([tfm]) => tfm.start)
  return sortedReplacements.reduceRight((source, replacement) => {
    let [{start,end}] = replacement,
        newSource = replacement.map(ea => ea.newSource).join("\n")
    return source.slice(0, start) + newSource + source.slice(end)
  }, itsSource);
}
