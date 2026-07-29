/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { Color, pt, rect } from 'lively.graphics';
import { morph } from 'lively.morphic';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';

const testDir = 'local://projectional-direct-manipulation-test/';
const moduleId = `${testDir}project/component.cp.js`;
const inheritedMoveBaseModuleId = `${testDir}project/inherited-move-base.cp.js`;
const inheritedMoveModuleId = `${testDir}project/inherited-move.cp.js`;
const initialSource = `
"format esm";
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt, rect } from 'lively.graphics';
import { morph, Text, TilingLayout } from 'lively.morphic';

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
  }, {
    name: 'date array',
    layout: new TilingLayout({
      orderByIndex: true,
      padding: rect(3, 0, 0, 0),
      spacing: 2
    }),
    submorphs: [1, 2].map(i => ({ name: 'day ' + i }))
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { Example };
`;

describe('projectional component direct manipulation', function () {
  let descriptor;
  let editable;
  let componentModule;
  let inheritedMoveBaseModule;
  let inheritedMoveModule;
  let inheritedMoveEditable;

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
    inheritedMoveEditable?._changeTracker?.dispose();
    await inheritedMoveModule?.unload();
    await inheritedMoveBaseModule?.unload();
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
      .deep.equals(['label', 'container', 'date array', 'nested']);
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
      .deep.equals(['label', 'container', 'date array', 'nested']);
  });

  it('restyles a materialized inherited part after move undo and redo', async () => {
    await resource(inheritedMoveBaseModuleId).write(`
      "format esm";
      import { component, ComponentDescriptor, part } from 'lively.morphic/components/core.js';
      import { Color } from 'lively.graphics';

      component.DescriptorClass = ComponentDescriptor;

      const Leaf = component({
        name: 'Leaf',
        fill: Color.purple,
        submorphs: [{ name: 'leaf child', fill: Color.orange }]
      });
      const Base = component({
        name: 'Base',
        submorphs: [part(Leaf, { name: 'movable leaf' })]
      });

      export { Base, Leaf };
    `);
    await resource(inheritedMoveModuleId).write(`
      "format esm";
      import {
        add, component, ComponentDescriptor
      } from 'lively.morphic/components/core.js';
      import {
        InteractiveComponentDescriptor
      } from 'lively.ide/components/editor.js';
      import { Base, Leaf } from '${inheritedMoveBaseModuleId}';

      component.DescriptorClass = InteractiveComponentDescriptor;

      const Subject = component(Base, {
        name: 'Subject',
        submorphs: [{
          name: 'movable leaf',
          submorphs: [{
            name: 'leaf child',
            borderWidth: 2
          }]
        }, add({ name: 'destination' })]
      });

      component.DescriptorClass = ComponentDescriptor;

      export { Subject };
    `);
    inheritedMoveBaseModule = module(System, inheritedMoveBaseModuleId);
    await inheritedMoveBaseModule.load();
    inheritedMoveModule = module(System, inheritedMoveModuleId);
    const { Subject } = await inheritedMoveModule.load();
    inheritedMoveEditable = await Subject.edit();
    const destination = inheritedMoveEditable.get('destination');
    const movableLeaf = inheritedMoveEditable.get('movable leaf');
    const tracker = inheritedMoveEditable._changeTracker;

    inheritedMoveEditable.undoStart('reparent inherited component part');
    try {
      inheritedMoveEditable.withMetaDo({ reconcileChanges: true }, () => {
        destination.addMorph(movableLeaf);
      });
      await tracker.onceChangesProcessed();
    } finally {
      inheritedMoveEditable.undoStop();
    }

    expect(movableLeaf.owner).equals(destination);
    expect(movableLeaf.fill).equals(Color.purple);
    expect(inheritedMoveModule._source).matches(/without\(["']movable leaf["']\)/);
    expect(inheritedMoveModule._source).includes('destination');

    inheritedMoveEditable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(movableLeaf.owner).equals(inheritedMoveEditable);
    expect(movableLeaf.fill).equals(Color.purple);

    inheritedMoveEditable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(movableLeaf.owner).equals(destination);
    expect(movableLeaf.fill).equals(Color.purple);
    expect(Subject.derive().get('movable leaf').fill).equals(Color.purple);

    const leafChild = movableLeaf.get('leaf child');
    inheritedMoveEditable.undoStart('materialize nested inherited override');
    try {
      inheritedMoveEditable.withMetaDo({ reconcileChanges: true }, () => {
        inheritedMoveEditable.addMorph(leafChild);
      });
      await tracker.onceChangesProcessed();
    } finally {
      inheritedMoveEditable.undoStop();
    }

    expect(leafChild.owner).equals(inheritedMoveEditable);
    expect(leafChild.borderWidth.top).equals(2);

    inheritedMoveEditable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(leafChild.owner).equals(movableLeaf);
    expect(leafChild.borderWidth.top).equals(2);

    inheritedMoveEditable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(leafChild.owner).equals(inheritedMoveEditable);
    expect(leafChild.borderWidth.top).equals(2);
    expect(Subject.derive().get('leaf child').borderWidth.top).equals(2);
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
    expect(descriptor.derive().get('replacement badge').fill).equals(Color.orange);

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

  it('reconciles an interactive text replacement through its native undo group', async () => {
    const label = editable.get('label');

    label.withMetaDo({ reconcileChanges: true }, () => {
      label.replace({
        start: { row: 0, column: 1 },
        end: { row: 0, column: 5 }
      }, ['interactive', { fontWeight: 'bold' }]);
    });
    await finishDirectManipulation();

    expect(label.textString.startsWith('binteractive')).to.be.true;
    expect(componentModule._source).matches(/["']interactive["']/);
    expect(componentModule._source).includes('fontWeight');

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(label.textString.startsWith('before')).to.be.true;

    await redo();
    expect(label.textString.startsWith('binteractive')).to.be.true;
    expect(componentModule._source).matches(/["']interactive["']/);
  });

  it('renames a nested introduction that collides across component scopes', async () => {
    const container = editable.get('container');
    const introduced = morph({
      name: 'label',
      fill: Color.orange
    });

    editable.undoStart('introduce nested component morph');
    container.withMetaDo({ reconcileChanges: true }, () => {
      container.addMorph(introduced);
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(introduced.name).equals('label_1');
    expect(componentModule._source).matches(/name:\s*["']label_1["']/);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(introduced.owner).equals(null);

    await redo();
    expect(introduced.owner).equals(container);
    expect(introduced.name).equals('label_1');
    expect(componentModule._source).matches(/name:\s*["']label_1["']/);

    const validationModuleId = `${testDir}project/validation.cp.js`;
    const validationResource = resource(validationModuleId);
    const validationModule = module(System, validationModuleId);
    await validationResource.write(componentModule._source);
    const { Example: validationDescriptor } = await validationModule.load();
    const cold = validationDescriptor.derive();
    expect(cold.get('label').fill).equals(Color.yellow);
    expect(cold.get('container').get('label_1').fill).equals(Color.orange);
    await validationModule.unload();
    await validationResource.remove();
  });

  it('reconciles changes to a nested tiling layout through undo and redo', async () => {
    const container = editable.get('date array');

    editable.undoStart('change component tiling layout');
    container.withMetaDo({ reconcileChanges: true }, () => {
      container.layout = container.layout.with({
        spacing: 7,
        padding: rect(8, 4, 6, 2),
        wrapSubmorphs: true
      });
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(container.layout.spacing).equals(7);
    expect(container.layout.padding).equals(rect(8, 4, 6, 2));
    expect(container.layout.wrapSubmorphs).to.be.true;
    expect(componentModule._source).matches(/spacing:\s*7/);
    expect(componentModule._source).matches(/padding:\s*rect\(8,\s*4,\s*6,\s*2\)/);
    expect(componentModule._source).matches(/wrapSubmorphs:\s*true/);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(container.layout.spacing).equals(2);
    expect(container.layout.padding).equals(rect(3, 0, 0, 0));
    expect(container.layout.wrapSubmorphs).to.be.false;

    await redo();
    expect(container.layout.spacing).equals(7);
    expect(container.layout.padding).equals(rect(8, 4, 6, 2));
    expect(container.layout.wrapSubmorphs).to.be.true;
  });
});
