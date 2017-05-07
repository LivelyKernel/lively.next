import { graph } from "./deps/lively.lang.min.js"

export {
  buildStages,
  depGraph,
  graphvizDeps
}

function buildStages(packageSpec, packageMap) {
console.log(packageMap.lookup)
  let {config: {name, version}} = packageSpec,
      {deps, packages: packageDeps, resolvedVersions} = depGraph(packageSpec, packageMap);

  for (let dep in deps)
    for (let i = 0; i < deps[dep].length; i++)
      if (!deps[deps[dep][i]]) deps[dep][i] = resolvedVersions[deps[dep][i]];

  return lively.lang.graph.sortByReference(deps, `${name}@${version}`);
}

function depGraph(packageSpec, packageMap) {
  // console.log(lively.lang.string.indent(pNameAndVersion, " ", depth));
  // let packages = getInstalledPackages(centralPackageDir);

  let pNameAndVersion = `${packageSpec.config.name}@${packageSpec.config.version}`,
      queue = [pNameAndVersion],
      resolvedVersions = {},
      deps = {}, packages = {};

  while (queue.length) {
    let nameAndVersion = queue.shift();
    if (nameAndVersion in resolvedVersions) continue;

    let [name, version] = nameAndVersion.split("@"),
        pSpec = packageMap.lookup(name, version);
    if (!pSpec) throw new Error(`Cannot resolve package ${nameAndVersion}`);
    let {config} = pSpec,
        resolvedNameAndVersion = `${config.name}@${config.version}`;

    resolvedVersions[nameAndVersion] = resolvedNameAndVersion;

    if (!packages[config.name]) packages[config.name] = [];
    if (!packages[config.name].includes(resolvedNameAndVersion))
      packages[config.name].push(resolvedNameAndVersion);

    if (!deps[resolvedNameAndVersion]) {
      deps[resolvedNameAndVersion] = Object.keys(config.dependencies || {}).map(name => {
        let fullName = name + "@" + config.dependencies[name];
        queue.push(fullName);
        return fullName;
      });
    }
  }

  return {deps, packages, resolvedVersions};
}

function graphvizDeps({deps, packages, resolvedVersions}) {
  let graph = `digraph {\n`
            + `compound=true;\n`
            + `node [shape=record fontsize=10 fontname="Verdana"];\n`;

  Object.keys(packages).forEach(pName => {
    graph += `subgraph "cluster_${pName}" {\n`
           + `style=filled;\ncolor=lightgrey;\n`
           + packages[pName].map(nameAndVersion => `"${nameAndVersion}";`).join("\n")
           + `\n}\n`;
  });

  graph += Object.keys(deps).map(nameAndVersion =>
              deps[nameAndVersion].map(depVersion =>
                `"${nameAndVersion}" -> "${resolvedVersions[depVersion]}";`).join("\n")).join("\n") + "\n"

  graph += "\n}\n";
  return graph;
}
