const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'project.js'), 'utf8');
const slice = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert(start > 0 && end > start, `load the real project methods from ${from.trim()}`);
  return source.slice(start, end);
};
const loadTemplate = (name, exported) => vm.runInNewContext(
  fs.readFileSync(path.join(projectRoot, 'templates', name), 'utf8').replace('export const ', 'const ') + '\n' + exported);
const merge = vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'templates/workflow-customizations.js'), 'utf8')
  .replace('export function preserveWorkflowCustomizations', 'function preserveWorkflowCustomizations') + '\npreserveWorkflowCustomizations');

const BOUND = 'abcdef1234567';
const RUNNING = '1234567abcdef';
const files = new Map();
const statuses = [];
let comparison;
const Project = vm.runInNewContext(`class Project {
${slice('  async bindAgainstCurrentLivelyVersion (', '\n  addRemoteConfig (')}
${slice('  async regeneratePipelines (', '\n  async generateBuildScripts')}
}; Project`, {
  lively: { isInOfflineMode: true },
  join: (...parts) => parts.join('/'),
  workflowDefinition: loadTemplate('test-action.js', 'workflowDefinition'),
  buildRemoteScript: loadTemplate('build-upload-action.js', 'buildRemoteScript'),
  deployScript: loadTemplate('deploy-pages-action.js', 'deployScript'),
  preserveWorkflowCustomizations: merge,
  VersionChecker: {
    checkVersionRelation: async () => ({ comparison }),
    parseHashComparison: value => value === '' ? 3 : 1,
    currentLivelyVersion: async () => RUNNING
  },
  console: { warn: () => {} },
  $world: { confirm: async () => true, setStatusMessage: (message, type) => statuses.push({ message, type }) },
  StatusMessageConfirm: 'confirm', StatusMessageWarning: 'warning', StatusMessageError: 'error',
  resource: name => ({
    exists: async () => files.has(name),
    read: async () => files.get(name),
    ensureExistance: async function () { return this; },
    write: async content => files.set(name, content)
  })
});

function openedProject () {
  const project = new Project();
  project.url = '/project';
  project.fullName = 'me--project';
  project.name = 'project';
  project.config = { name: 'me--project', lively: { boundLivelyVersion: BOUND, projectDependencies: [] } };
  project.generateFlatDependenciesList = async () => [];
  project.savedPins = [];
  project.saveConfigData = async function () {
    if (this.config.hasUnsavedChanges) this.savedPins.push(this.config.lively.boundLivelyVersion);
    delete this.config.hasUnsavedChanges;
  };
  return project;
}

(async () => {
  const ciTests = '/project/.github/workflows/ci-tests.yml';
  for (const [label, versionRelation] of [['confirmed version change', '0\t2'], ['overwritten version', '']]) {
    comparison = versionRelation;
    files.clear(); statuses.length = 0;
    const project = openedProject();
    await project.regeneratePipelines();
    // A custom step whose end marker is missing, as after an unresolved merge.
    const valid = files.get(ciTests).replace(/^([ \t]*)# lively.next:custom end after-tests/m, '$1- run: echo custom-step\n$&');
    files.set(ciTests, valid.replace(/\n[ \t]*# lively.next:custom end after-tests/, ''));
    const workflows = new Map(files);

    const result = await project.bindAgainstCurrentLivelyVersion(BOUND);
    assert.notEqual(result, 'UPDATED', `${label}: a broken custom section does not count as an update`);
    assert.deepEqual(project.savedPins, [], `${label}: keep the stored version so the next opening retries`);
    assert.equal(project.config.lively.boundLivelyVersion, BOUND, `${label}: keep the version for this session`);
    assert.deepEqual(files, workflows, `${label}: leave every workflow unchanged`);
    const warning = statuses.find(({ type }) => type === 'warning');
    assert.match(warning?.message || '', /ci-tests\.yml: Unclosed custom workflow section: after-tests/, `${label}: name the broken workflow`);
    assert.ok(!statuses.some(({ type }) => type === 'confirm'), `${label}: do not report an update`);
    await assert.rejects(() => project.regeneratePipelines(), /Unclosed custom workflow section/, `${label}: saving still stops on the broken section`);

    files.set(ciTests, valid);
    statuses.length = 0;
    assert.equal(await project.bindAgainstCurrentLivelyVersion(BOUND), 'UPDATED', `${label}: retry once the section is repaired`);
    assert.deepEqual(project.savedPins, [RUNNING], `${label}: store the running version`);
    for (const content of files.values()) {
      assert.match(content, new RegExp(RUNNING), `${label}: workflows use the running version`);
      assert.doesNotMatch(content, new RegExp(BOUND));
    }
    assert.match(files.get(ciTests), /echo custom-step/, `${label}: keep the repaired custom step`);
    assert.ok(!statuses.some(({ message }) => /stays bound/.test(message)), `${label}: no binding warning after repair`);
  }
  console.log('Lively version binding: broken custom sections keep the bound version, warn and retry on the next opening');
})().catch(err => { console.error(err); process.exitCode = 1; });
