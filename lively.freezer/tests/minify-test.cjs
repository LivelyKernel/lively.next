const assert = require('node:assert/strict');
const vm = require('node:vm');
const minify = require('../src/minify.cjs');
(async () => {
  const source = 'class Answer { value() { return 42; } } globalThis.answer = new Answer().value();';
  const result = await minify(source);
  const context = {};
  vm.runInNewContext(result.min, context);
  assert.equal(context.answer, 42);
  assert.equal(result.code, source);
  console.log('Package-owned Babel/Terser minification passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
