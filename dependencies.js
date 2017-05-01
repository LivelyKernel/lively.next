import { getInstalledPackage } from "./package-download.js";

export function buildStages(pNameAndVersion, packageInstallDir) {
  let [name, version] = pNameAndVersion.split("@"),
      {config} = getInstalledPackage(name, version, packageInstallDir),
      resolvedNameAndVersion = `${config.name}@${config.version}`,
      {deps, packages: packageDeps, resolvedVersions} = depGraph(resolvedNameAndVersion, packageInstallDir);
  for (let dep in deps)
    for (let i = 0; i < deps[dep].length; i++)
      if (!deps[deps[dep][i]]) deps[dep][i] = resolvedVersions[deps[dep][i]];

  return lively.lang.graph.sortByReference(deps, resolvedNameAndVersion);
}

export function depGraph(pNameAndVersion, packageInstallDir) {
  // console.log(lively.lang.string.indent(pNameAndVersion, " ", depth));
  // let packages = getInstalledPackages(centralPackageDir);

  let queue = [pNameAndVersion],
      resolvedVersions = {},
      deps = {}, packages = {};

  while (queue.length) {
    let nameAndVersion = queue.shift();
    if (nameAndVersion in resolvedVersions) continue;
    let [name, version] = nameAndVersion.split("@"),
        {config} = getInstalledPackage(name, version, packageInstallDir),
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

  // if (pNameAndVersion in deps) return {deps, packages};
  //
  // let [name, version] = pNameAndVersion.split("@"),
  //     {config} = getInstalledPackage(name, version, packageInstallDir),
  //     resolvedNameAndVersion = `${config.name}@${config.version}`;
  //
  // if (!packages[config.name]) packages[config.name] = [];
  // if (!packages[config.name].includes(pNameAndVersion)) packages[config.name].push(pNameAndVersion)
  // if (!packages[config.name].includes(resolvedNameAndVersion)) packages[config.name].push(resolvedNameAndVersion)
  //
  // if (resolvedNameAndVersion !== pNameAndVersion) {
  //   if (!deps[pNameAndVersion]) deps[pNameAndVersion] = [];
  //   deps[pNameAndVersion].push(resolvedNameAndVersion);
  // }
  //
  // Object.keys(config.dependencies || {}).forEach(name => {
  //   let depNameAndVersion = `${name}@${config.dependencies[name]}`;
  //   if (!deps[resolvedNameAndVersion]) deps[resolvedNameAndVersion] = [];
  //   if (!deps[resolvedNameAndVersion].includes(depNameAndVersion))
  //     deps[resolvedNameAndVersion].push(depNameAndVersion);
  //   // graph[depNameAndVersion] = resolvedNameAndVersion;
  //   depGraph(depNameAndVersion, packageInstallDir, deps, packages, depth + 1);
  // });
  // return {deps, packages};
}

export function graphvizDeps({deps, packages, resolvedVersions}) {
  // depGraph = depGraphDot("pouchdb", centralPackageDir)
  // let depGroups = Object.keys(depGraph).reduce((byName, nameAndVersion) => {
  //   let name = nameAndVersion.split("@")[0];
  //   if (!byName[name]) byName[name] = {};
  //   if (!byName[name][nameAndVersion]) byName[name][nameAndVersion] = [];
  //   byName[name][nameAndVersion].push(...depGraph[nameAndVersion]);
  //   return byName;
  // }, {});

  let graph = `digraph {\n`
            + `compound=true;\n`
            + `node [shape=record fontsize=10 fontname="Verdana"];\n`;

  // groupName="pouchdb"


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
