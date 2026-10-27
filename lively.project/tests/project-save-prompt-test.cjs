const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../prompts.cp.js'), 'utf8');
const classes = source.slice(0, source.indexOf('export const ProjectSettingsPrompt'))
  .replace(/^import .*;\n/gm, '');

function fixture ({ remote = true, regeneration, saveConfigData = async () => {} } = {}) {
  const indicator = { removals: 0, remove () { this.removals++; } };
  const statuses = [];
  const StatusMessageError = class {};
  const Prompt = vm.runInNewContext(`${classes}\nProjectSavePrompt`, {
    AbstractPromptModel: class {}, Color: { lively: 'green' }, StatusMessageError,
    $world: { showLoadingIndicatorFor: () => indicator }
  });
  const model = new Prompt();
  const button = () => ({
    viewModel: { deactivated: false },
    disable () { this.viewModel.deactivated = true; },
    enable () { this.viewModel.deactivated = false; }
  });
  model.ui = {
    promptTitle: {}, branchInput: { deactivate () {} }, dependencyStatusInfo: {},
    okButton: button(), cancelButton: button()
  };
  model.view = { visible: true, setStatusMessage: (message, type) => statuses.push({ message, type }) };
  let regenerations = 0;
  let started;
  const whenRegenerationStarts = new Promise(resolve => { started = resolve; });
  model.project = {
    generateFlatDependenciesList: async () => [],
    gitResource: { branchName: async () => 'main' },
    saveConfigData,
    hasRemoteConfigured: async () => remote,
    regeneratePipelines () { regenerations++; started(); return regeneration || Promise.resolve(); }
  };
  return { model, indicator, statuses, StatusMessageError, whenRegenerationStarts, regenerations: () => regenerations };
}

async function check () {
  let finish;
  const deferred = new Promise(resolve => { finish = resolve; });
  const pending = fixture({ regeneration: deferred });
  let settled = false;
  const setup = pending.model.viewDidLoad().then(() => { settled = true; });
  await pending.whenRegenerationStarts;
  assert.equal(pending.regenerations(), 1);
  assert.equal(pending.model.view.visible, false, 'save dialog must wait for workflow regeneration');
  assert.equal(pending.indicator.removals, 0, 'keep setup indicator while workflows are pending');
  assert.equal(settled, false, 'setup must not resolve before workflow regeneration');
  assert.equal(pending.model.ui.okButton.viewModel.deactivated, true);
  await pending.model.resolve(true);
  finish();
  await setup;
  assert.equal(pending.model.view.visible, true);
  assert.equal(pending.indicator.removals, 1);
  assert.equal(pending.model.ui.okButton.viewModel.deactivated, false);

  let fail;
  const failed = fixture({ regeneration: new Promise((resolve, reject) => { fail = reject; }) });
  const failureSetup = failed.model.viewDidLoad();
  await failed.whenRegenerationStarts;
  fail(new Error('Invalid custom workflow section'));
  await failureSetup;
  assert.equal(failed.model.view.visible, true, 'reveal the failed prompt so the user can cancel');
  assert.equal(failed.indicator.removals, 1, 'remove the indicator after workflow errors');
  assert.equal(failed.model.ui.okButton.viewModel.deactivated, true, 'prevent saving after failed setup');
  assert.equal(failed.model.ui.cancelButton.viewModel.deactivated, false);
  await failed.model.resolve(true);
  assert.match(failed.statuses[0].message, /Invalid custom workflow section/);
  assert.equal(failed.statuses[0].type, failed.StatusMessageError);

  const configFailure = fixture({ saveConfigData: async () => { throw new Error('Cannot write project configuration'); } });
  await configFailure.model.viewDidLoad();
  assert.equal(configFailure.regenerations(), 0);
  assert.equal(configFailure.indicator.removals, 1);
  assert.equal(configFailure.model.view.visible, true);
  assert.equal(configFailure.model.ui.okButton.viewModel.deactivated, true);
  assert.match(configFailure.statuses[0].message, /Cannot write project configuration/);

  const local = fixture({ remote: false });
  await local.model.viewDidLoad();
  assert.equal(local.regenerations(), 0, 'local projects do not generate remote workflows');
  assert.equal(local.model.ui.okButton.viewModel.deactivated, false);
  assert.equal(local.model.view.visible, true);
  assert.equal(local.indicator.removals, 1);
  console.log('Project save prompt: deferred workflows, rejected workflows, configuration failure and local setup pass');
}

check().catch(error => { console.error(error); process.exitCode = 1; });
