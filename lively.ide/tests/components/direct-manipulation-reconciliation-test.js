/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { Color, pt } from 'lively.graphics';
import { morph } from 'lively.morphic';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';

const testDir = 'local://projectional-direct-manipulation-test/';
const moduleId = `${testDir}project/component.cp.js`;
const initialSource = `
"format esm";
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt } from 'lively.graphics';
import { morph, Text } from 'lively.morphic';

component.DescriptorClass = InteractiveComponentDescriptor;

const Example = component({
  name: 'example',
  extent: pt(100, 100),
  fill: Color.red,
  submorphs: [{
    type: Text,
    name: 'label',
    fill: Color.yellow,
    textAndAttributes: ['before', null, morph({
      name: 'embedded badge',
      fill: Color.blue
    }), null]
  }, {
    name: 'container',
    submorphs: [{
      name: 'nested',
      fill: Color.green
    }]
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { Example };
`;

describe('projectional component direct manipulation', function () {
  let descriptor;
  let editable;
  let componentModule;

  beforeEach(async () => {
    await createFiles(testDir, {
      project: {
        'component.cp.js': initialSource,
        'package.json': '{"name":"projectional-direct-manipulation-test","main":"component.cp.js"}'
      }
    });
    componentModule = module(System, moduleId);
    ({ Example: descriptor } = await componentModule.load());
    editable = await descriptor.edit();
  });

  afterEach(async () => {
    editable?._changeTracker?.dispose();
    await componentModule?.unload();
    await resource(testDir).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
  });

  function detailedReconciliationError (error) {
    const change = error.change;
    const meta = Object.fromEntries(Object.entries(change?.meta || {}).map(
      ([key, value]) => [key, value && typeof value === 'object'
        ? value.constructor?.name || 'object'
        : value]
    ));
    return new Error(`${error.message}; rejected change: ${JSON.stringify({
      prop: change?.prop,
      selector: change?.selector,
      target: change?.target?.name,
      meta
    })}`);
  }

  async function finishDirectManipulation () {
    try {
      await editable._changeTracker.onceChangesProcessed();
    } catch (error) {
      throw detailedReconciliationError(error);
    }
    await editable._changeTracker._shadowComparisonPromise;
  }

  async function undo () {
    try {
      editable.env.undoManager.undo();
      await editable._changeTracker.onceChangesProcessed();
    } catch (error) {
      throw detailedReconciliationError(error);
    }
  }

  async function redo () {
    try {
      editable.env.undoManager.redo();
      await editable._changeTracker.onceChangesProcessed();
    } catch (error) {
      throw detailedReconciliationError(error);
    }
  }

  function currentDocument () {
    const parsed = parseComponentSource({
      source: componentModule._source,
      moduleId,
      exportName: 'Example'
    });
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).to.be.true;
    return parsed.document;
  }

  it('reconciles a real resize and style edit with exact undo and redo', async () => {
    const label = editable.get('label');

    editable.undoStart('resize and style component');
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.extent = pt(160, 120);
      label.fill = Color.orange;
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(componentModule._source).matches(/extent:\s*pt\(160,\s*120\)/);
    expect(componentModule._source).includes('fill: Color.orange');
    expect(editable.extent).equals(pt(160, 120));
    expect(label.fill).equals(Color.orange);
    expect(descriptor.stylePolicy.spec.extent).equals(pt(160, 120));
    expect(descriptor.stylePolicy.getSubSpecFor('label').fill).equals(Color.orange);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(editable.extent).equals(pt(100, 100));
    expect(label.fill).equals(Color.yellow);
    expect(descriptor.stylePolicy.spec.extent).equals(pt(100, 100));
    expect(descriptor.stylePolicy.getSubSpecFor('label').fill).equals(Color.yellow);

    await redo();
    expect(componentModule._source).matches(/extent:\s*pt\(160,\s*120\)/);
    expect(componentModule._source).includes('fill: Color.orange');
    expect(editable.extent).equals(pt(160, 120));
    expect(label.fill).equals(Color.orange);
  });

  it('reconciles a real cross-parent move with exact undo and redo', async () => {
    const container = editable.get('container');
    const nested = editable.get('nested');

    editable.undoStart('reparent component morph');
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.addMorph(nested);
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(nested.owner).equals(editable);
    expect(currentDocument().root.children.map(({ name }) => name))
      .deep.equals(['label', 'container', 'nested']);
    expect(currentDocument().root.children[1].children).deep.equals([]);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(nested.owner).equals(container);
    expect(container.submorphs).includes(nested);

    await redo();
    expect(nested.owner).equals(editable);
    expect(editable.submorphs).includes(nested);
    expect(container.submorphs).not.includes(nested);
    expect(currentDocument().root.children.map(({ name }) => name))
      .deep.equals(['label', 'container', 'nested']);
  });

  it('reconciles rich text with an embedded morph through undo and redo', async () => {
    const label = editable.get('label');
    const replacement = morph({
      name: 'replacement badge',
      fill: Color.orange
    });

    editable.undoStart('replace component rich text');
    label.withMetaDo({ reconcileChanges: true }, () => {
      label.textAndAttributes = [
        'after', { fontWeight: 'bold' },
        replacement, null
      ];
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(label.textString.startsWith('after')).to.be.true;
    expect(label.textAndAttributes).includes(replacement);
    expect(componentModule._source).matches(/["']after["']/);
    expect(componentModule._source).matches(/name:\s*["']replacement badge["']/);
    expect(componentModule._source).includes('fill: Color.orange');

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(label.textString.startsWith('before')).to.be.true;
    expect(label.textAndAttributes.find(value => value?.isMorph)?.name)
      .equals('embedded badge');

    await redo();
    expect(label.textString.startsWith('after')).to.be.true;
    expect(label.textAndAttributes.find(value => value?.isMorph)?.name)
      .equals('replacement badge');
    expect(componentModule._source).matches(/name:\s*["']replacement badge["']/);
  });
});
