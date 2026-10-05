const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rollup = require('rollup');

// Exercise the legacy build script with a small entry and real Rollup output.
const outputs = new Map();
const dependencies = {
  'lively.lang': {},
  '../../lively.ast': {
    parse: () => ({ body: [{ expression: {} }] }),
    stringify: source => source,
    transform: { objectSpreadTransform: source => source }
  },
  'lively.classes': { classToFunctionTransform: source => source },
  fs: {
    existsSync: () => true,
    readFileSync: file => file === './package.json' ? '{"name":"lively.morphic","version":"0.1.2"}' : '',
    writeFileSync: (file, source) => outputs.set(file, source)
  },
  path,
  rollup: {
    rollup: options => rollup.rollup({
      ...options,
      plugins: [...options.plugins, {
        name: 'fixture',
        resolveId: id => id === 'index.js' ? id : null,
        load: id => id === 'index.js' ? 'export const answer = 42;' : null
      }]
    })
  },
  'uglify-es': { minify: code => ({ code }) },
  'rollup-plugin-babel': () => ({ name: 'fixture-babel' })
};
const requireDependency = name => {
  assert.ok(Object.hasOwn(dependencies, name), name);
  return dependencies[name];
};
requireDependency.resolve = name => name;
const moduleRecord = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tools/build-source-bundle.js'), 'utf8'), {
  require: requireDependency, module: moduleRecord, console
});
moduleRecord.exports.then(() => {
  assert.equal(outputs.size, 4);
  for (const [file, source] of outputs) {
    const context = { lively: {}, System: { global: {} }, module: { exports: {} }, require: requireDependency };
    vm.runInNewContext(source, context, { filename: file });
    assert.equal(context.module.exports.answer, 42);
  }
  console.log('Morphic Rollup build output passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
