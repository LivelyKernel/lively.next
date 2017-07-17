import { graph } from "./deps/lively.lang.min.js"

export {
  buildStages,
  depGraph,
  graphvizDeps
}

function buildStages(packageSpec, packageMap, dependencyFields) {
  let {name, version} = packageSpec,
      {deps, packages: packageDeps, resolvedVersions} = depGraph(packageSpec, packageMap);

  for (let dep in deps)
    for (let i = 0; i < deps[dep].length; i++)
      if (!deps[deps[dep][i]]) deps[dep][i] = resolvedVersions[deps[dep][i]];

  return lively.lang.graph.sortByReference(deps, `${name}@${version}`);
}

function depGraph(packageSpec, packageMap, dependencyFields = ["dependencies"]) {
  // console.log(lively.lang.string.indent(pNameAndVersion, " ", depth));
  // let packages = getInstalledPackages(centralPackageDir);

  let pNameAndVersion = `${packageSpec.name}@${packageSpec.version}`,
      queue = [pNameAndVersion],
      resolvedVersions = {},
      deps = {}, packages = {};

  while (queue.length) {
    let nameAndVersion = queue.shift();
    if (nameAndVersion in resolvedVersions) continue;
    
    let atIndex = nameAndVersion.lastIndexOf("@");
    if (atIndex === -1) atIndex = nameAndVersion.length;
    let name = nameAndVersion.slice(0, atIndex),
        version = nameAndVersion.slice(atIndex+1),
        pSpec = packageMap.lookup(name, version);
    if (!pSpec) throw new Error(`Cannot resolve package ${nameAndVersion}`);

    let resolvedNameAndVersion = `${pSpec.name}@${pSpec.version}`;

    resolvedVersions[nameAndVersion] = resolvedNameAndVersion;

    if (!packages[pSpec.name]) packages[pSpec.name] = [];
    if (!packages[pSpec.name].includes(resolvedNameAndVersion))
      packages[pSpec.name].push(resolvedNameAndVersion);

    if (!deps[resolvedNameAndVersion]) {
      let localDeps = Object.assign({},
          dependencyFields.reduce((map, key) =>
            Object.assign(map, pSpec[key]), {}));

      deps[resolvedNameAndVersion] = Object.keys(localDeps).map(name => {
        let fullName = name + "@" + localDeps[name];
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
