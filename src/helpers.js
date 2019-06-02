export function applyExclude(exclude, resources) {
  if (Array.isArray(exclude))
    return exclude.reduce((intersect, exclude) =>
      applyExclude(exclude, intersect), resources);
  if (typeof exclude === "string")
    return resources.filter(ea => ea.path() !== exclude && ea.name() !== exclude)
  if (exclude instanceof RegExp)
    return resources.filter(ea => !exclude.test(ea.path()) && !exclude.test(ea.name()))
  if (typeof exclude === "function")
    return resources.filter(ea => !exclude(ea));
  return resources;
}

/*

applyExclude(["foo", "foo"], [
  {path: () => "foo", name: () => "foo"},
  {path: () => "bar", name: () => "bar"},
  {path: () => "baz", name: () => "baz"}
])

applyExclude(["bar", "foo"], [
  {path: () => "foo", name: () => "foo"},
  {path: () => "bar", name: () => "bar"},
  {path: () => "baz", name: () => "baz"}
])

*/


// parseQuery('?hello=world&x={"foo":{"bar": "baz"}}')
// parseQuery("?db=test-object-db&url=lively.morphic%2Fworlds%2Fdefault.json&type=world&name=default&commitSpec=%7B%22user%22%3A%7B%22name%22%3A%22robert%22%2C%22realm%22%3A%22https%3A%2F%2Fauth.lively-next.org%22%2C%22email%22%3A%22robert%40kra.hn%22%7D%2C%22description%22%3A%22An%20empty%20world.%20A%20place%20to%20start%20from%20scratch.%22%2C%22metadata%22%3A%7B%22belongsToCore%22%3Atrue%7D%7D&purgeHistory=true")

export function parseQuery(url) {
  var url = url,
      [_, search] = url.split("?"),
      query = {};
  if (!search) return query;
  var args = search.split("&");
  if (args) for (var i = 0; i < args.length; i++) {
    var keyAndVal = args[i].split("="),
        key = keyAndVal[0],
        val = true;
    if (keyAndVal.length > 1) {
      val = decodeURIComponent(keyAndVal.slice(1).join("="));
      if (val === "undefined") val = undefined;
      else if (val.match(/^(true|false|null|[0-9"[{].*)$/))
        try { val = JSON.parse(val); } catch(e) {
          if (val[0] === "[") val = val.slice(1,-1).split(","); // handle string arrays
          // if not JSON use string itself
        }
    }
    query[key] = val;
  }
  return query;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const slashEndRe = /\/+$/,
      slashStartRe = /^\/+/,
      protocolRe = /^[a-z0-9-_\.]+:/,
      urlRe = /^([^:\/]+):\/\/([^\/]*)(.*)/,
      slashslashRe = /^\/\/[^\/]+/,
      // for resolve path:
      pathDotRe = /\/\.\//g,
      pathDoubleDotRe = /\/[^\/]+\/\.\./,
      pathDoubleSlashRe = /(^|[^:])[\/]+/g;


export function withRelativePartsResolved(inputPath) {
  let path = inputPath, result = path;

  // /foo/../bar --> /bar
  do {
    path = result;
    result = path.replace(pathDoubleDotRe, '');
  } while (result != path);

  // foo//bar --> foo/bar
  result = result.replace(pathDoubleSlashRe, '$1/');

  // foo/./bar --> foo/bar
  result = result.replace(pathDotRe, '/');

  return result;
}

function _relativePathBetween_checkPathes(path1, path2) {
  if (path1.startsWith("/")) path1 = path1.slice(1);
  if (path2.startsWith("/")) path2 = path2.slice(1);
  var paths1 = path1.split('/'),
      paths2 = path2.split('/');
  for (var i = 0; i < paths2.length; i++)
    if (!paths1[i] || (paths1[i] != paths2[i])) break;
  // now that's some JavaScript FOO
  var result = '../'.repeat(Math.max(0, paths2.length - i - 1))
             + paths1.splice(i, paths1.length).join('/');
  return result;
}

// pathA = "http://foo/bar/"
// pathB = "http://foo/bar/oink/baz.js";

export function relativePathBetween(pathA, pathB) {
  // produces the relative path to get from `pathA` to `pathB`
  // Example:
  //   relativePathBetween("/foo/bar/", "/foo/baz.js"); // => ../baz.js
  let urlMatchA = pathA.match(urlRe),
      urlMatchB = pathB.match(urlRe),
      protocolA, domainA, protocolB, domainB,
      compatible = true;
  if ((urlMatchA && !urlMatchB) || (!urlMatchA && urlMatchB)) compatible = false;
  if (urlMatchA && urlMatchB) {
    protocolA = urlMatchA[1];
    domainA = urlMatchA[2];
    protocolB = urlMatchB[1];
    domainB = urlMatchB[2];
    if (protocolA !== protocolB) compatible = false;
    else if (domainA !== domainB) compatible = false;
    else { pathA = urlMatchA[3]; pathB = urlMatchB[3]; }
  }
  if (!compatible)
    throw new Error(`[relativePathBetween] incompatible paths: ${pathA} vs. ${pathB}`);
  pathA = withRelativePartsResolved(pathA);
  pathB = withRelativePartsResolved(pathB);
  if (pathA == pathB) return '';
  var relPath = _relativePathBetween_checkPathes(pathB, pathA);
  if (!relPath)
    throw new Error('pathname differs in relativePathFrom ' + pathA + ' vs ' + pathB);
  return relPath;
}

export function join(pathA, pathB) {
  return withRelativePartsResolved(pathA.replace(slashEndRe, "") + "/" + pathB.replace(slashStartRe, ""));
}


export function parent(path) {
  if (!path.startsWith("/")) return "";
  return path.replace(slashEndRe, "").split("/").slice(0,-1).join("/") + "/";
}

export function parents(path) {
  var result = [], p = parent(path);
  while (p) { result.unshift(p); p = parent(p); if (p === "/") break; }
  return result;
}
