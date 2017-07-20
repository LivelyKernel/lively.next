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
