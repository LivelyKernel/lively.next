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
