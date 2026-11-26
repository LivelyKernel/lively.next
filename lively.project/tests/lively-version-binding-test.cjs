const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'project.js'), 'utf8');
const sliceOf = (text, from, to) => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  assert(start > 0 && end > start, `load the real methods from ${from.trim()}`);
  return text.slice(start, end);
};
const loadTemplate = (name, exported) => vm.runInNewContext(
  fs.readFileSync(path.join(projectRoot, 'templates', name), 'utf8').replace('export const ', 'const ') + '\n' + exported);
const customizations = vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'templates/workflow-customizations.js'), 'utf8')
  .replace(/^export function /gm, 'function ') + '\n({ preserveWorkflowCustomizations, haveSameCustomSections })');

const BOUND = 'abcdef1234567';
const RUNNING = '1234567abcdef';
const statuses = [];
const informs = [];
const repos = [];
let repo, relation, storedPin;
const Project = vm.runInNewContext(`class Project {
${sliceOf(source, '  static async resetConfigFiles (', '\n  static async pullUpstreamChangesIfRemote')}
${sliceOf(source, '  async bindAgainstCurrentLivelyVersion (', '\n  addRemoteConfig (')}
${sliceOf(source, '  async regeneratePipelines (', '\n  async generateBuildScripts')}
}; Project`, {
  lively: { isInOfflineMode: true },
  join: (...parts) => path.join(...parts),
  workflowDefinition: loadTemplate('test-action.js', 'workflowDefinition'),
  buildRemoteScript: loadTemplate('build-upload-action.js', 'buildRemoteScript'),
  deployScript: loadTemplate('deploy-pages-action.js', 'deployScript'),
  ...customizations,
  VersionChecker: {
    checkVersionRelation: async version => ({ comparison: version === RUNNING ? '0\t0' : relation }),
    parseHashComparison: value => value === '' ? 3 : value === '0\t0' ? 0 : 1,
    currentLivelyVersion: async () => RUNNING
  },
  console: { warn: () => {} },
  $world: {
    confirm: async () => true,
    inform: async label => { informs.push(label); },
    setStatusMessage: (message, type) => statuses.push({ message, type })
  },
  StatusMessageConfirm: 'confirm', StatusMessageWarning: 'warning', StatusMessageError: 'error',
  resource: name => ({
    exists: async () => fs.existsSync(name),
    read: async () => fs.readFileSync(name, 'utf8'),
    ensureExistance: async function () { fs.mkdirSync(path.dirname(name), { recursive: true }); return this; },
    write: async content => fs.writeFileSync(name, content)
  })
});

// How Project.loadProject reacts to the result of the version binding.
const switchStart = source.indexOf('switch (checkLivelyCompatibility)');
const reactToBinding = vm.runInNewContext(`(async checkLivelyCompatibility => {
${source.slice(switchStart, source.indexOf('\n    }\n', switchStart))}
})`, { $world: { inform: async label => { informs.push(label); } } });

// The project's git checkout, driven through the real reset of lively.shell's git resource.
const shellSource = fs.readFileSync(path.join(projectRoot, '../lively.shell/git-client-resource.js'), 'utf8');
const GitResource = vm.runInNewContext(`class GitResource {
${sliceOf(shellSource, '  async resetFile (', '\n  async hasUncommitedChanges')}
}; GitResource`);
GitResource.prototype.runCommand = command => ({
  whenDone: async () => {
    try {
      return { exitCode: 0, stdout: execFileSync('bash', ['-c', command], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (err) {
      return { exitCode: err.status || 1, stdout: err.stdout || '', stderr: err.stderr || '' };
    }
  }
});
const gitResource = new GitResource();
const git = (...args) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', ...args],
  { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ciTests = () => path.join(repo, '.github/workflows/ci-tests.yml');
const workflows = () => Object.fromEntries(['ci-tests.yml', 'build-upload-action.yml', 'deploy-pages-action.yml']
  .map(name => [name, fs.readFileSync(path.join(repo, '.github/workflows', name), 'utf8')]));

function projectBoundTo (version) {
  const project = new Project();
  project.url = repo;
  project.fullName = 'me--project';
  project.name = 'project';
  project.config = { name: 'me--project', lively: { boundLivelyVersion: version, projectDependencies: [] } };
  project.generateFlatDependenciesList = async () => [];
  project.saveConfigData = async function () {
    if (this.config.hasUnsavedChanges) storedPin = this.config.lively.boundLivelyVersion;
    delete this.config.hasUnsavedChanges;
  };
  return project;
}

/** A repository whose committed workflows are generated for BOUND, with `edit` applied to ci-tests.yml. */
async function committedProject (edit = text => text) {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-version-binding-'));
  repos.push(repo);
  informs.length = 0;
  git('init', '-q');
  await projectBoundTo(BOUND).regeneratePipelines();
  const generated = fs.readFileSync(ciTests(), 'utf8');
  fs.writeFileSync(ciTests(), edit(generated));
  git('add', '.');
  git('commit', '-q', '-m', 'workflows');
  storedPin = BOUND;
  statuses.length = 0;
  return generated;
}

/** Opening a project resets its configuration files before binding it to the running version. */
async function open () {
  await Project.resetConfigFiles(gitResource);
  const project = projectBoundTo(storedPin);
  return { project, result: await project.bindAgainstCurrentLivelyVersion(storedPin) };
}

const withCustomStep = text => text.replace(/^([ \t]*)# lively.next:custom end after-tests/m, '$1- run: echo custom-step\n$&');
const withoutEndMarker = text => text.replace(/\n[ \t]*# lively.next:custom end after-tests/, '');

(async () => {
  for (const [label, versionRelation] of [['confirmed version change', '0\t2'], ['overwritten version', '']]) {
    relation = versionRelation;

    // An uncommitted custom step in ci-tests.yml.
    await committedProject();
    fs.writeFileSync(ciTests(), withCustomStep(fs.readFileSync(ciTests(), 'utf8')));
    assert.equal((await open()).result, 'UPDATED', `${label}: bind to the running version`);
    assert.match(fs.readFileSync(ciTests(), 'utf8'), /echo custom-step/, `${label}: opening keeps an uncommitted custom step`);
    assert.equal((await open()).result, 'SUCCESS', `${label}: the next opening finds the running version`);
    assert.match(fs.readFileSync(ciTests(), 'utf8'), /echo custom-step/, `${label}: reopening keeps the uncommitted custom step`);
    assert.match(fs.readFileSync(ciTests(), 'utf8'), new RegExp(RUNNING), `${label}: reopening keeps the regenerated workflow`);

    // A committed custom step whose end marker is missing, as after an unresolved merge.
    const generated = await committedProject(text => withoutEndMarker(withCustomStep(text)));
    const committed = workflows();
    const failed = await open();
    assert.equal(failed.result, 'WORKFLOWS_NOT_UPDATED', `${label}: a broken custom section does not count as an update`);
    assert.equal(storedPin, BOUND, `${label}: keep the stored version so the next opening retries`);
    assert.equal(failed.project.config.lively.boundLivelyVersion, BOUND, `${label}: keep the version for this session`);
    assert.deepEqual(workflows(), committed, `${label}: leave every workflow unchanged`);
    await reactToBinding(failed.result);
    assert.equal(informs.length, 1, `${label}: one dialog, without the version conflict: ${JSON.stringify(informs)}`);
    assert.match(informs[0].text, /ci-tests\.yml: Unclosed custom workflow section: after-tests/, `${label}: name the broken workflow`);
    assert.match(informs[0].text, /open the project again/, `${label}: explain the retry`);
    assert.ok(!statuses.some(({ type }) => type === 'confirm'), `${label}: do not report an update`);
    await assert.rejects(() => failed.project.regeneratePipelines(), /Unclosed custom workflow section/, `${label}: saving still stops on the broken section`);

    // The user repairs the marker without committing and opens the project again.
    fs.writeFileSync(ciTests(), withCustomStep(generated));
    statuses.length = 0; informs.length = 0;
    assert.equal((await open()).result, 'UPDATED', `${label}: the next opening retries with the repaired section`);
    assert.equal(storedPin, RUNNING, `${label}: store the running version`);
    for (const [name, content] of Object.entries(workflows())) {
      assert.match(content, new RegExp(RUNNING), `${name}: use the running version`);
      assert.doesNotMatch(content, new RegExp(BOUND));
    }
    assert.match(fs.readFileSync(ciTests(), 'utf8'), /echo custom-step/, `${label}: keep the repaired custom step`);
    assert.equal(informs.length, 0, `${label}: no dialog after repair`);
  }

  // A regeneration failure outside the custom-section merge, as with a dependency that cannot be listed.
  await committedProject();
  relation = '';
  const project = projectBoundTo(BOUND);
  project.generateFlatDependenciesList = async () => { throw new Error('DEPENDENCY_SENTINEL'); };
  await assert.rejects(() => project.bindAgainstCurrentLivelyVersion(BOUND), /DEPENDENCY_SENTINEL/, 'other failures are not reported as broken workflows');
  assert.equal(storedPin, BOUND, 'other failures keep the stored version');
  assert.equal(project.config.lively.boundLivelyVersion, BOUND, 'other failures keep the version for this session');
  assert.equal(informs.length, 0, 'other failures show no workflow dialog');

  // Saving the project configuration fails after the workflows were generated, as on a GitHub API error.
  await committedProject();
  relation = '';
  const beforeFailure = workflows();
  const unsaved = projectBoundTo(BOUND);
  unsaved.saveConfigData = async () => { throw new Error('CONFIG_SENTINEL'); };
  await assert.rejects(() => unsaved.bindAgainstCurrentLivelyVersion(BOUND), /CONFIG_SENTINEL/, 'configuration failures are thrown');
  assert.equal(storedPin, BOUND, 'a failed configuration save keeps the stored version');
  assert.equal(unsaved.config.lively.boundLivelyVersion, BOUND, 'a failed configuration save keeps the version for this session');
  assert.deepEqual(workflows(), beforeFailure, 'a failed configuration save leaves every workflow unchanged');
  assert.equal(informs.length, 0, 'a failed configuration save shows no workflow dialog');

  // A ci-tests.yml regenerated by an earlier opening, with unchanged custom sections.
  await committedProject(withCustomStep);
  const committed = fs.readFileSync(ciTests(), 'utf8');
  fs.writeFileSync(ciTests(), committed.replaceAll(BOUND, RUNNING));
  await Project.resetConfigFiles(gitResource);
  assert.equal(fs.readFileSync(ciTests(), 'utf8'), committed, 'opening discards uncommitted generated changes before pulling');

  // A committed unmarked workflow, which an earlier opening migrated to empty custom sections for the running version.
  await committedProject(text => text.replace(/^[ \t]*# lively.next:custom[^\n]*\n?/gm, '').trimEnd());
  const unmarked = fs.readFileSync(ciTests(), 'utf8');
  relation = '';
  assert.equal((await open()).result, 'UPDATED', 'an earlier opening binds the unmarked project');
  assert.match(fs.readFileSync(ciTests(), 'utf8'), /lively.next:custom start/, 'the earlier opening migrates ci-tests.yml');
  await Project.resetConfigFiles(gitResource);
  assert.equal(fs.readFileSync(ciTests(), 'utf8'), unmarked, 'the next opening discards the uncommitted migration before pulling');

  // A checkout with core.autocrlf, whose working copy has CRLF line endings, with a pin written by an earlier opening.
  await committedProject(withCustomStep);
  git('config', 'core.autocrlf', 'true');
  fs.rmSync(ciTests());
  git('checkout', '--', '.github/workflows/ci-tests.yml');
  const checkedOut = fs.readFileSync(ciTests(), 'utf8');
  assert.match(checkedOut, /\r\n/, 'the checkout has CRLF line endings');
  fs.writeFileSync(ciTests(), checkedOut.replaceAll(BOUND, RUNNING));
  await Project.resetConfigFiles(gitResource);
  assert.equal(fs.readFileSync(ciTests(), 'utf8'), checkedOut, 'line endings do not keep an uncommitted pin');
  fs.writeFileSync(ciTests(), checkedOut.replace('echo custom-step', 'echo edited-step'));
  await Project.resetConfigFiles(gitResource);
  assert.match(fs.readFileSync(ciTests(), 'utf8'), /echo edited-step/, 'an edited custom step with CRLF line endings is kept');
  console.log('Lively version binding: openings keep uncommitted custom sections, broken sections keep the bound version with a dialog naming them, an uncommitted repair is retried and a failed configuration save changes nothing');
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => {
  for (const dir of repos) fs.rmSync(dir, { recursive: true, force: true });
});
