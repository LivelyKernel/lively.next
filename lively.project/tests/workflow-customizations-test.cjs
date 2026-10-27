const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'project.js'), 'utf8');
const start = source.indexOf('  async regeneratePipelines ()');
const end = source.indexOf('\n  async fillPipelineTemplate', start);
const custom = (id, content = '') => `      # lively.next:custom start ${id}\n${content}      # lively.next:custom end ${id}\n`;
const template = id => `generated NEW_RUNTIME_PIN\njobs:\n  build:\n    steps:\n${custom(id)}`;
const names = ['ci-tests.yml', 'build-upload-action.yml', 'deploy-pages-action.yml'];
const ids = ['before-tests', 'before-build', 'before-build'];
const files = new Map();
let merge = (_, generated) => generated;
const helper = path.join(projectRoot, 'templates/workflow-customizations.js');
if (fs.existsSync(helper)) {
  merge = vm.runInNewContext(fs.readFileSync(helper, 'utf8').replace('export function preserveWorkflowCustomizations', 'function preserveWorkflowCustomizations') + '\npreserveWorkflowCustomizations');
}
const Runner = vm.runInNewContext(`class Project { ${source.slice(start, end)} }; Project`, {
  lively: { isInOfflineMode: true },
  join: (...parts) => parts.join('/'),
  workflowDefinition: template(ids[0]), buildRemoteScript: template(ids[1]), deployScript: template(ids[2]),
  preserveWorkflowCustomizations: merge,
  resource (name) {
    return {
      exists: async () => files.has(name),
      read: async () => files.get(name),
      ensureExistance: async function () { return this; },
      write: async content => files.set(name, content)
    };
  }
});
const runner = new Runner();
runner.url = '/project';
runner.config = { lively: {} };
runner.fillPipelineTemplate = async definition => definition;
const fileName = name => `/project/.github/workflows/${name}`;
(async () => {
  names.forEach((name, index) => files.set(fileName(name), template(ids[index])
    .replace('NEW_RUNTIME_PIN', 'OLD_RUNTIME_PIN')
    .replace(custom(ids[index]), custom(ids[index], `      - name: Custom ${index}\n        run: echo project-specific\n`))));
  await runner.regeneratePipelines();
  for (const [index, name] of names.entries()) {
    assert.match(files.get(fileName(name)), new RegExp(`Custom ${index}`), 'keep user steps');
    assert.match(files.get(fileName(name)), /NEW_RUNTIME_PIN/, 'update generated runtime pin');
    assert.doesNotMatch(files.get(fileName(name)), /OLD_RUNTIME_PIN/);
  }
  const previous = files.get(fileName(names[2]));
  files.set(fileName(names[2]), previous.replace('custom end before-build', 'custom end different'));
  const beforeInvalid = new Map(files);
  await assert.rejects(() => runner.regeneratePipelines(), /custom.*section|section.*custom/i);
  assert.deepEqual(files, beforeInvalid, 'validate all workflows before overwriting any file');
  files.set(fileName(names[2]), previous);
  files.set(fileName(names[1]), 'name: Build Project\njobs:\n  build:\n    steps:\n      - run: echo legacy-custom-step\n');
  const beforeLegacy = new Map(files);
  await runner.regeneratePipelines();
  assert.equal(files.get(fileName(names[1])), beforeLegacy.get(fileName(names[1])), 'keep unmarked custom workflows without blocking project save or upgrade');
  assert.throws(() => merge(custom('removed', 'keep me\n'), template('before-tests')), /custom.*section|section.*custom/i);
  assert.throws(() => merge(custom('before-tests') + custom('before-tests'), template('before-tests')), /custom.*section|section.*custom/i);
  assert.throws(() => merge('      # lively.next:custom start before-tests\nkeep me\n', template('before-tests')), /custom.*section|section.*custom/i);
  assert.equal(merge('', template('before-tests')), template('before-tests'), 'new workflows use defaults');
  for (const [name, exported] of [
    ['test-action.js', 'workflowDefinition'], ['build-upload-action.js', 'buildRemoteScript'], ['deploy-pages-action.js', 'deployScript']
  ]) {
    const templateSource = fs.readFileSync(path.join(projectRoot, 'templates', name), 'utf8');
    const actual = vm.runInNewContext(templateSource.replace('export const ', 'const ') + '\n' + exported);
    const id = name === 'test-action.js' ? 'before-tests' : 'before-build';
    const customized = actual.replace(custom(id).trimEnd(), custom(id, '      - run: echo keep-custom-step\n').trimEnd());
    assert.match(merge(customized, actual.replaceAll('%LIVELY_VERSION%', 'fresh-runtime')), /keep-custom-step/);
    assert.equal(merge(actual, actual), actual, name + ' sections are valid');
    const legacy = actual.replace(/^[ \t]*# lively.next:custom[^\n]*\n?/gm, '').trimEnd();
    assert.equal(merge(legacy.replaceAll('%LIVELY_VERSION%', 'abcdef1234567'), actual.replaceAll('%LIVELY_VERSION%', '1234567abcdef')),
      actual.replaceAll('%LIVELY_VERSION%', '1234567abcdef'), name + ' unchanged legacy workflows migrate with runtime updates');
    const customizedLegacy = legacy + '\n      - run: echo legacy-custom-step\n';
    assert.equal(merge(customizedLegacy, actual), customizedLegacy, 'keep unmarked custom workflows verbatim');
    const olderGenerated = legacy.replace('actions/checkout@v4', 'actions/checkout@v3')
      .replace('node-version: \'24.20.0\'', 'node-version: \'20\'');
    assert.equal(merge(olderGenerated, actual), olderGenerated, 'historical generated workflows do not block an upgrade');
  }
  console.log('Workflow regeneration preserves custom steps, updates pins and leaves all files intact on invalid sections');
})().catch(err => { console.error(err); process.exitCode = 1; });
