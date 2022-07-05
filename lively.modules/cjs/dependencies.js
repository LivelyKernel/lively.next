import { obj } from 'lively.lang';
import { resource } from 'lively.resources';

export async function buildPackageMap (
  dir, options = { maxDepth: 0, excludes: [] },
  map = {}, // internal
  depth = 0 // internal
) {
  // fetches the package.json config of dir and stores version and dependencies
  // into package map. Recursively searches in node_modules either until
  // maxDepth is reached or all packages have been visited. Since the
  // name@version is used for testing if package was seen, can deal with cyclic
  // symlinks.
  // Return value looks like
  //    { 'lively.server@0.1.0': 
  //       { url: 'file:///Users/robert/Lively/lively-dev/lively.server',
  //         name: 'lively.server',
  //         version: '0.1.0',
  //         dependencies: 
  //          { 'lively.modules': '*',
  //            'socket.io': '^1.5.1' },
  //         devDependencies: { 'mocha-es6': '*' },
  //         main: undefined } }

  let { maxDepth, excludes } = options;

  if (maxDepth > 0 && depth > maxDepth) return map;

  try {
    let config = JSON.parse(await resource(dir).join('package.json').read());
    let key = `${config.name}@${config.version}`;

    if (map[key] || excludes.includes(config.name)) { return map; }

    map[key] = {
      url: dir,
      ...obj.select(config, ['name', 'version', 'dependencies', 'devDependencies', 'main'])
    };
  } catch (e) { return map; }
  let node_modules;
  try {
    node_modules = await resource(dir).join('node_modules').dirList(1);
  } catch (e) { return map; }

  for (let { url } of node_modules) { map = await buildPackageMap(url, options, map, depth + 1); }

  return map;
}

export function resolvePackageDependencies (pkg, packageMap) {
  // util.inspect(resolvePackageDependencies(packageMap["socket.io@1.5.1"], packageMap))
  // =>
  // "{ debug: 'debug@2.2.0',
  //   'engine.io': 'engine.io@1.7.2', ...}

  let deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.keys(deps).reduce((depMap, depName) => {
    let depVersion = deps[depName];
    let { name, version } = obj.values(packageMap).find(({ name, version }) =>
      name === depName && lively.modules.semver.satisfies(version, depVersion)) || {};
    depMap[depName] = name ? `${name}@${version}` : undefined;
    return depMap;
  }, {});
}

export function dependencyGraph (packageMap) {
  // builds dependency graph of package-name@version tuples:
  // {'lively.server@0.1.0':  ['lively.modules@0.5.41', ...],
  //  'lively.modules@0.5.41': [...]}

  let packages = obj.values(packageMap);
  let cachedVersionQueries = {};

  return Object.keys(packageMap).reduce((depMap, name) => {
    let pkg = packageMap[name];
    let deps = { ...pkg.dependencies, ...pkg.devDependencies };
    depMap[name] = Object.keys(deps)
      .map(depName => findAvailablePackage(depName, deps[depName])) // eslint-disable-line no-use-before-define
      .filter(ea => !!ea);
    return depMap;
  }, {});

  function findAvailablePackage (depName, depVersionRange) {
    let cacheKey = `${depName}@${depVersionRange}`;
    if (cacheKey in cachedVersionQueries) return cachedVersionQueries[cacheKey];
    let { name, version } = packages.find(({ name, version }) =>
      name === depName && lively.modules.semver.satisfies(version, depVersionRange)) || {};
    return cachedVersionQueries[cacheKey] = name ? `${name}@${version}` : undefined;
  }
}
