const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../lively.ide/test-runner.js'), 'utf8');
const start = source.indexOf('  async runTestsInPackage (');
const end = source.indexOf('\n  // -=-', start);

async function run (lively, globalConfig) {
  const pkg = { name: 'non-default', lively };
  const localInterface = { coreInterface: { getPackages: () => [pkg] } };
  let selected;
  const Runner = vm.runInNewContext(`class Runner { ${source.slice(start, end)} }; Runner`, {
    localInterface,
    packagesConfig: async () => globalConfig,
    findTestModulesInPackage: async (backend, name) => {
      assert.equal(backend, selected);
      assert.equal(name, 'non-default');
      return ['test-file'];
    }
  });
  const runner = new Runner();
  runner.updateEvalBackendForPackage = wantsServer => { selected = !!wantsServer; runner.systemInterface = selected; };
  runner.runTestFile = async file => ({ file });
  const result = await runner.runTestsInPackage('non-default');
  assert.equal(result[0].file, 'test-file');
  return selected;
}
(async () => {
  assert.equal(await run({ wantsServerInterface: true }, []), true, 'non-default packages can select server evaluation');
  assert.equal(await run({}, [{ name: 'non-default', wantsServerInterface: true }]), true, 'keep legacy global package defaults');
  assert.equal(await run({ wantsServerInterface: false }, [{ name: 'non-default', wantsServerInterface: true }]), false, 'explicit package false overrides legacy default');
  assert.equal(await run({}, []), false, 'browser evaluation remains the default');
  console.log('Package test backends: external server metadata, legacy defaults and explicit browser override passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
