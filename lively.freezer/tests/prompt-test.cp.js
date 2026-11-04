/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { part } from 'lively.morphic';
import { promise } from 'lively.lang';
import { FreezerPrompt } from '../src/ui.cp.js';

describe('freezer prompt controls', function () {
  this.timeout(5000);
  let prompt;

  beforeEach(async () => {
    prompt = part(FreezerPrompt, { viewModel: { autoRemove: false } }).openInWorld();
    prompt.env.forceUpdate();
    await prompt.whenRendered();
  });

  afterEach(() => {
    prompt.remove();
  });

  /** Resolve the prompt through a child button. */
  async function answerWith (buttonName) {
    let settled = false;
    let answer;
    prompt.activate().then(value => { answer = value; settled = true; });
    prompt.get(buttonName).viewModel.trigger();
    await promise.waitFor(1000, () => settled);
    return answer;
  }

  it('offers the current compilers and preserves the selection when focused', () => {
    const selector = prompt.get('compiler selector');
    expect(selector.items.map(item => item.value)).deep.equals(['SWC', 'Terser + Babel', 'None']);
    expect(selector.selection).equals('SWC');
    selector.selection = 'None';
    prompt.viewModel.focus();
    expect(selector.selection).equals('None');
  });

  for (const [compiler, minify, useTerser] of [
    ['SWC', true, false], ['Terser + Babel', true, true], ['None', false, false]
  ]) {
    it(`confirms ${compiler} settings through the OK button`, async () => {
      prompt.directory = '/published/example';
      prompt.excludedPackages = ['lively.ide'];
      prompt.get('compiler selector').selection = compiler;
      expect(await answerWith('ok button')).deep.equals({
        location: '/published/example', minify, useTerser, excludedPackages: ['lively.ide']
      });
    });
  }

  it('cancels through the Cancel button', async () => {
    expect(await answerWith('cancel button')).equals(undefined);
    expect(prompt.owner).equals(null);
  });

  it('adds an exclusion through the package controls', async () => {
    prompt.excludedPackages = [];
    prompt.get('add package button').viewModel.trigger();
    await promise.waitFor(1000, () => prompt.get('package input').visible);
    expect(prompt.get('confirm excluded package').visible).equals(true);
    prompt.get('package input').input = 'lively.ide';
    prompt.get('confirm excluded package').viewModel.trigger();
    await promise.waitFor(1000, () => !prompt.get('package input').visible);
    expect(prompt.excludedPackages).deep.equals(['lively.ide']);
    expect(prompt.get('package input').input).equals('');
    expect(prompt.get('confirm excluded package').visible).equals(false);
  });

  it('enables removal for a selected exclusion and removes it through the button', () => {
    prompt.excludedPackages = ['lively.ide'];
    const removeButton = prompt.get('remove package button');
    expect(removeButton.viewModel.deactivated).equals(true);
    prompt.get('package list').selection = 'lively.ide';
    expect(removeButton.viewModel.deactivated).equals(false);
    removeButton.viewModel.trigger();
    expect(prompt.excludedPackages).deep.equals([]);
    expect(removeButton.viewModel.deactivated).equals(true);
  });
});
