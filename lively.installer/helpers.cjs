/* global require */
const { resource } = require('lively.resources');

function join () {
  let args = Array.prototype.slice.call(arguments);
  return args.reduce(function (path, ea) {
    return typeof ea === 'string' ? path.replace(/\/*$/, '') + '/' + ea.replace(/^\/*/, '') : path;
  });
}

function normalizeProjectSpec (spec) {
  return Object.assign({}, spec, {
    dir: spec.dir || join(spec.parentDir, spec.name)
  });
}

function getPackageSpec () {
  return require.resolve('lively.installer/packages-config.json');
}

async function readPackageSpec (pkgSpec) {
  if (pkgSpec.startsWith('/')) pkgSpec = 'file://' + pkgSpec;
  return JSON.parse(await resource(pkgSpec).read());
}

module.exports = { join, normalizeProjectSpec, getPackageSpec, readPackageSpec }
