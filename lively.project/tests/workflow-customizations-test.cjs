const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'project.js'), 'utf8');
const start = source.indexOf('  async regeneratePipelines (');
const end = source.indexOf('\n  async fillPipelineTemplate', start);
const custom = (id, content = '') => `      # lively.next:custom start ${id}\n${content}      # lively.next:custom end ${id}\n`;
const template = id => `generated NEW_RUNTIME_PIN\njobs:\n  build:\n    steps:\n${custom(id)}`;
const names = ['ci-tests.yml', 'build-upload-action.yml', 'deploy-pages-action.yml'];
const ids = ['before-tests', 'before-build', 'before-build'];
const files = new Map();
const warnings = [];
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
  console: { warn: () => {} },
  $world: { setStatusMessage: message => warnings.push(message) },
  StatusMessageWarning: 'warning',
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
  const legacyWarnings = warnings.slice();
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
  const loadTemplate = (name, exported) => vm.runInNewContext(
    fs.readFileSync(path.join(projectRoot, 'templates', name), 'utf8').replace('export const ', 'const ') + '\n' + exported);
  const methodEnd = source.indexOf('\n  async generateBuildScripts', start);
  assert(start > 0 && methodEnd > start, 'load the real regeneration and template-filling methods');
  const saveStart = source.indexOf('  async save (');
  const saveEnd = source.indexOf('\n  async ensureDependenciesExist', saveStart);
  assert(saveStart > 0 && saveEnd > saveStart, 'load the real project save method');
  const GeneratedProject = vm.runInNewContext(`class Project { ${source.slice(start, methodEnd)}\n${source.slice(saveStart, saveEnd)} }; Project`, {
    lively: { isInOfflineMode: true },
    join: (...parts) => parts.join('/'),
    workflowDefinition: loadTemplate('test-action.js', 'workflowDefinition'),
    buildRemoteScript: loadTemplate('build-upload-action.js', 'buildRemoteScript'),
    deployScript: loadTemplate('deploy-pages-action.js', 'deployScript'),
    preserveWorkflowCustomizations: merge,
    console: { warn: () => {} },
    $world: { setStatusMessage: message => warnings.push(message) },
    StatusMessageWarning: 'warning',
    isUserLoggedIn: () => true,
    resource: name => ({
      exists: async () => files.has(name),
      read: async () => files.get(name),
      ensureExistance: async function () { return this; },
      write: async content => files.set(name, content)
    })
  });
  const project = new GeneratedProject();
  project.url = runner.url;
  project.fullName = 'me--project';
  let dependencies = [];
  project.generateFlatDependenciesList = async () => dependencies;
  project.increaseVersion = () => {};
  project.saveConfigData = async () => {};
  project.reloadPackage = async () => {};
  project.gitResource = { hasRemote: async () => true, commitRepo: async () => {} };
  project.config = { lively: {} };
  const settings = (pin, onPush) => Object.assign(project.config.lively, {
    boundLivelyVersion: pin, testOnPush: onPush, buildOnPush: onPush,
    deployOnPush: onPush, repositoryIsPrivate: onPush, canUsePages: true
  });
  const remoteDependencies = [
    { name: 'me--public', hasRemote: true, privateRepo: false },
    { name: 'me--private', hasRemote: true, privateRepo: true },
    { name: 'me--local', hasRemote: false }
  ];
  for (const scenario of ['enable', 'disable', 'before-bun', 'before-bun-and-rust', 'before-install-retry']) {
    const initialOnPush = scenario === 'disable';
    files.clear();
    warnings.length = 0;
    dependencies = initialOnPush ? remoteDependencies : [];
    settings('abcdef1234567', initialOnPush);
    await project.regeneratePipelines();
    for (const name of names) {
      // Historical fixtures are unedited generator output with trailing whitespace removed.
      files.set(fileName(name), scenario.startsWith('before-')
        ? fs.readFileSync(path.join(__dirname, 'fixtures/workflows-' + scenario, name), 'utf8')
        : files.get(fileName(name)).replace(/^[ \t]*# lively.next:custom[^\n]*\n?/gm, ''));
    }
    dependencies = remoteDependencies;
    settings('1234567abcdef', !initialOnPush);
    await project.regeneratePipelines();
    for (const name of names) {
      const actual = files.get(fileName(name));
      assert.match(actual, /1234567abcdef/, `${name} updates the runtime pin`);
      assert.doesNotMatch(actual, /abcdef1234567/);
      assert.equal(actual.includes('push:'), !initialOnPush, `${name} applies push-trigger settings in both directions`);
      assert.match(actual, /repository: me\/public/, `${name} updates public dependencies`);
      assert.match(actual, /repository: me\/private/, `${name} updates private dependencies`);
      assert.match(actual, /secrets.me__private/, `${name} updates private checkout credentials`);
      assert.doesNotMatch(actual, /repository: me\/local/, 'local-only dependencies are not checked out');
      assert.equal(actual.includes('  contents: read'), name === 'deploy-pages-action.yml' && !initialOnPush, 'update Pages permission settings');
      assert.match(actual, /lively.next:custom start/, 'migrate to marked templates');
    }
    assert.equal(warnings.length, 0, 'generated workflows with changed settings need no custom-workflow warning');
    dependencies = [];
    await project.regeneratePipelines();
    for (const name of names) assert.doesNotMatch(files.get(fileName(name)), /Checkout Project Dependencies/, 'marked workflows apply dependency removals');
  }
  const privateDependencies = [{ name: 'me--private', hasRemote: true, privateRepo: true }];
  const extraCheckout = '\n      - name: Checkout Project Dependencies\n        uses: actions/checkout@v4\n        with:\n          repository: me/tool\n          path: local_projects/me--tool/\n          ssh-key: ${{ secrets.TOOL_KEY }}\n';
  const edits = [
    ['renamed secret', privateDependencies, text => text.replace('secrets.me__private', 'secrets.MY_DEPLOY_KEY')],
    ['changed checkout path', privateDependencies, text => text.replace('path: local_projects/me--private/', 'path: local_projects/me--private-v2/')],
    ['forked repository', privateDependencies, text => text.replace('repository: me/private', 'repository: myfork/private')],
    ['extra checkout after steps', [], text => text.trimEnd() + extraCheckout],
    ['extra checkout at generator anchor', [], text => text.replace('path: local_projects/me--project', 'path: local_projects/me--project' + extraCheckout.replace('secrets.TOOL_KEY', 'secrets.me__tool').trimEnd())],
    ['custom Lively ref', [], text => text.replace(/(repository: LivelyKernel\/lively.next\n          ref: )\S+/, '$1my-fork')],
    ['custom cache ref', [], text => text.replace(/(cache-name: lively-repo(?:-with-build)?\n          ref: )\S+/, '$1my-cache')],
    ['ambiguous removed dependency', privateDependencies, text => text]
  ];
  for (const [label, initialDependencies, edit] of edits) {
    files.clear(); warnings.length = 0;
    dependencies = initialDependencies;
    settings('abcdef1234567', false);
    await project.regeneratePipelines();
    const file = fileName(names[0]);
    const previous = edit(files.get(file).replace(/^[ \t]*# lively.next:custom[^\n]*\n?/gm, ''));
    files.set(file, previous);
    dependencies = label === 'ambiguous removed dependency' ? [] : initialDependencies;
    settings('1234567abcdef', false);
    await project.regeneratePipelines({ showWarnings: false });
    assert.equal(warnings.length, 0, 'save preparation defers preservation warnings');
    assert.equal(await project.save({ message: 'test', needsPipelines: true }), true, 'custom unmarked workflows do not block project save');
    assert.equal(files.get(file), previous, label + ' must survive byte-for-byte');
    assert.equal(warnings.length, 1, label + ' gets one warning in the save flow');
  }
  assert.equal(legacyWarnings.length, 1, 'show a warning when an unmarked custom workflow cannot be updated');
  assert.match(legacyWarnings[0], /build-upload-action.yml/);
  assert.match(legacyWarnings[0], /runtime, trigger and dependency updates were not applied/);
  assert.match(legacyWarnings[0], /lively.next:custom/);
  console.log('Workflow regeneration preserves custom steps, migrates settings in both directions, warns on custom unmarked files and validates all sections before writes');
})().catch(err => { console.error(err); process.exitCode = 1; });
