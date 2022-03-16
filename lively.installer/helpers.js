export function join () {
  let args = Array.prototype.slice.call(arguments);
  return args.reduce(function (path, ea) {
    return typeof ea === 'string' ? path.replace(/\/*$/, '') + '/' + ea.replace(/^\/*/, '') : path;
  });
}

export function normalizeProjectSpec (spec) {
  return Object.assign({}, spec, {
    dir: spec.dir || join(spec.parentDir, spec.name)
  });
}

export function getPackageSpec () {
  return System.decanonicalize('lively.installer/packages-config.json');
}

export async function readPackageSpec (pkgSpec) {
  if (pkgSpec.startsWith('/')) pkgSpec = 'file://' + pkgSpec;
  return JSON.parse(await lively.resources.resource(pkgSpec).read());
}
