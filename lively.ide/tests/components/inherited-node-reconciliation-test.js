/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { Color } from 'lively.graphics';
import { connect, disconnect } from 'lively.bindings';
import { morph, part, GridLayout, TilingLayout } from 'lively.morphic';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://inherited-node-reconciliation-test/';
const baseModuleId = directory + 'base.cp.js';
const moduleId = directory + 'derived.cp.js';
const baseSource = `
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
import { Text } from 'lively.morphic';
component.DescriptorClass = ComponentDescriptor;
const Base = component({ name: 'base', extent: pt(200, 100), submorphs: [
  { name: 'a', fill: Color.red, submorphs: [{ name: 'inner', fill: Color.green }] },
  { name: 's1' }, { name: 's2', fill: Color.yellow },
  { type: Text, name: 'text', fixedWidth: true, fixedHeight: true,
    extent: pt(100, 30), textAndAttributes: ['before', null] }
] });
const Button = component({ name: 'button', fill: Color.red, submorphs: [
  { type: Text, name: 'label', fixedWidth: true, fixedHeight: true,
    extent: pt(100, 30), textAndAttributes: ['button', null], fontColor: Color.black },
  { name: 'content', submorphs: [{ name: 'icon', fill: Color.green }] }
] });
const Accent = component({ name: 'accent', fill: Color.orange });
const Alternate = component({ name: 'alternate', fill: Color.cyan });
const Mastered = component({ name: 'mastered', submorphs: [{ name: 'a', master: Accent }] });
const Ordered = component({ name: 'ordered', submorphs: [
  { name: 'container', submorphs: [{ name: 'child' }, { name: 'other' }] }
] });
export { Base, Button, Accent, Alternate, Mastered, Ordered };
`;

describe('projectional edits on inherited nodes without source specs', function () {
  releaseComponentEditingState();

  let baseModule, componentModule, descriptor, editable, tracker, initialSource, instances;
  let baseExports;

  beforeEach(async () => {
    instances = [];
    await createFiles(directory, { 'base.cp.js': baseSource });
    baseModule = module(System, baseModuleId);
    baseExports = await baseModule.load();
  });

  afterEach(async () => {
    editable?._changeTracker?.dispose();
    editable?.remove();
    instances.forEach(instance => instance.remove());
    await componentModule?.unload();
    await baseModule?.unload();
    await resource(directory).remove();
    for (const id of [moduleId, baseModuleId]) {
      await System._livelyModulesTranslationCache.deleteCachedData(id);
    }
    editable = componentModule = null;
  });

  /** Open the fixture through the real component editing entry point. */
  async function open (expression = "component(Base, { name: 'derived' })",
    imports = `import { Base, Button, Accent, Alternate, Mastered, Ordered } from '${baseModuleId}';`) {
    initialSource = `
import { component, ComponentDescriptor, part, add, without, replace } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt } from 'lively.graphics';
import { Text, TilingLayout, GridLayout } from 'lively.morphic';
${imports}
component.DescriptorClass = InteractiveComponentDescriptor;
const Derived = ${expression};
component.DescriptorClass = ComponentDescriptor;
export { Derived };
`;
    await resource(moduleId).write(initialSource);
    componentModule = module(System, moduleId);
    ({ Derived: descriptor } = await componentModule.load());
    editable = await descriptor.edit();
    tracker = editable._changeTracker;
    // Apply inherited styles as the first rendering pass would, before recording an edit.
    editable.master.applyIfNeeded(true);
    await processed();
    expect(componentModule._source).equals(initialSource);
  }

  /** Wait for both reconciliation and its source comparison. */
  async function processed () {
    await tracker.onceChangesProcessed();
    await tracker._shadowComparisonPromise;
  }

  it('F7 edits a namespace package parent through the static fallback with exact undo and redo', async () => {
    await open("component(buttons.ButtonDefault, { name: 'derived' })",
      "import * as buttons from 'lively.components/buttons.cp.js';");
    editable.openInWorld();
    expect(tracker.projectionalComponentDocumentResolver()({ expression: 'buttons.ButtonDefault' })).equals(null);
    const before = componentModule._source;
    const beforeOpacity = editable.opacity;
    await edit(editable, 'opacity', 0.4);
    const after = componentModule._source;
    expect(after).not.equals(before);
    expect(cold().opacity).equals(0.4);
    editable.env.undoManager.undo();
    await processed();
    expect(componentModule._source).equals(before);
    expect(editable.opacity).equals(beforeOpacity);
    expect(cold().opacity).equals(beforeOpacity);
    editable.env.undoManager.redo();
    await processed();
    expect(componentModule._source).equals(after);
    expect(editable.opacity).equals(0.4);
    expect(cold().opacity).equals(0.4);
  });

  /** Apply an ordinary edit and require one non-overlapping source change per step. */
  async function edit (target, property, value) {
    editable.undoStart(`edit inherited ${property}`);
    try {
      target.withMetaDo({ reconcileChanges: true }, () => { target[property] = value; });
      await processed();
    } finally { editable.undoStop(); }
    const batch = tracker.lastShadowCommandBatch;
    expect(batch.projectionalCommit).not.equals(undefined);
    expect(batch.shadowProjection.steps).not.to.be.empty;
    for (const step of batch.shadowProjection.steps) {
      expect(step.sourceProjection.changes).has.length(1);
    }
  }

  /** Apply a structural edit through the same undo and reconciliation path as the halo. */
  async function structure (callback) {
    editable.undoStart('edit inherited structure');
    try {
      editable.withMetaDo({ reconcileChanges: true }, callback);
      await processed();
    } finally { editable.undoStop(); }
    const batch = tracker.lastShadowCommandBatch;
    expect(batch.projectionalCommit, batch.commitDiagnostic?.message).not.equals(undefined);
    return componentModule._source;
  }

  /** Compare the editable with a fresh instance of the current cached policy. */
  function checkStructure () {
    const snapshot = node => ({
      name: node.name,
      fill: node.fill.toString(),
      children: node.submorphs.map(snapshot)
    });
    expect(cold().submorphs.map(snapshot)).deep.equals(editable.submorphs.map(snapshot));
  }

  /** Inspect only source-written keys, excluding inherited semantic properties. */
  function ownKeys (...path) {
    const document = tracker.projectionalDocumentForCurrentSource().document;
    let node = document.root;
    for (const name of path) node = node.children.find(child => child.name === name);
    return Object.keys(document.sourceMetadata.propertyLocations[node.id] || {}).sort();
  }

  /** Instantiate from the current policy without an editing session. */
  function cold () {
    const instance = part(descriptor);
    instances.push(instance);
    instance.master.applyIfNeeded(true);
    return instance;
  }

  /** Replay the complete edit sequence and check exact source at each boundary. */
  async function replay (sources, check) {
    for (let index = sources.length - 2; index >= 0; index--) {
      editable.env.undoManager.undo();
      await processed();
      expect(componentModule._source).equals(sources[index]);
      check(index);
    }
    for (let index = 1; index < sources.length; index++) {
      editable.env.undoManager.redo();
      await processed();
      expect(componentModule._source).equals(sources[index]);
      check(index);
    }
    expect(baseModule._source).equals(baseSource);
    expect(await resource(baseModuleId).read()).equals(baseSource);
  }

  it('preserves an initialized non-CSS grid when restoring a saved layout in a part', async () => {
    await open("component({ name: 'derived', submorphs: [part(Button), { name: 'unrelated' }] })");
    const target = editable.get('content');
    const sources = [initialSource];
    const snapshots = [];
    const validationId = directory + 'grid-validation.cp.js';
    const validationModule = module(System, validationId);
    const validationResource = resource(validationId);

    /** Compare current policy and independently evaluated source with the editable. */
    async function check () {
      const snapshot = root => ({
        children: root.submorphs.map(child => child.name),
        layout: root.get('content').layout && {
          type: root.get('content').layout.constructor.name,
          renderViaCSS: root.get('content').layout.renderViaCSS
        }
      });
      const expected = snapshot(editable);
      expect(snapshot(cold()), `cached policy at edit ${sources.length - 1}`).deep.equals(expected);
      try {
        await validationResource.write(componentModule._source);
        const { Derived } = await validationModule.load();
        const instance = part(Derived);
        instances.push(instance);
        instance.master.applyIfNeeded(true);
        expect(snapshot(instance), `evaluated source at edit ${sources.length - 1}`).deep.equals(expected);
      } finally { await validationModule.unload({ forgetDeps: false }); }
      return expected;
    }

    try {
      snapshots.push(await check());
      const grid = new GridLayout({ autoAssign: true, columnCount: 1, rowCount: 1, renderViaCSS: false });
      await structure(() => { target.layout = grid; });
      target.layout.apply();
      expect(grid.grid).to.be.ok;
      sources.push(componentModule._source);
      snapshots.push(await check());
      await structure(() => { target.layout = new TilingLayout({ renderViaCSS: false }); });
      sources.push(componentModule._source);
      snapshots.push(await check());
      await structure(() => { target.layout = grid; });
      sources.push(componentModule._source);
      snapshots.push(await check());
      await structure(() => { editable.get('unrelated').name = 'renamed sibling'; });
      sources.push(componentModule._source);
      snapshots.push(await check());
      for (const indices of [[3, 2, 1, 0], [1, 2, 3, 4]]) {
        for (const index of indices) {
          if (indices[0] === 3) editable.env.undoManager.undo();
          else editable.env.undoManager.redo();
          await processed();
          expect(componentModule._source).equals(sources[index]);
          expect(await check()).deep.equals(snapshots[index]);
        }
      }
      expect(baseModule._source).equals(baseSource);
    } finally {
      await validationResource.remove();
      await System._livelyModulesTranslationCache.deleteCachedData(validationId);
    }
  });

  describe('T10b strict legacy naming and replacement', () => {
    for (const partChild of [false, true]) {
      for (const ownSpec of [false, true]) {
        it(`rejects an inherited rename atomically in ${partChild ? 'a part' : 'a derivation'} ${ownSpec ? 'with' : 'without'} an own spec`, async () => {
          const expression = partChild
            ? `component({ name: 'derived', submorphs: [part(Button${ownSpec ? ", { submorphs: [{ name: 'label', opacity: 0.4 }] }" : ''})] })`
            : `component(Base, { name: 'derived'${ownSpec ? ", layout: new TilingLayout({ resizePolicies: [['a', { width: 'fill', height: 'fixed' }]] }), submorphs: [add({ name: 'before a' }, 'a'), { name: 'a', opacity: 0.4 }]" : ''} })`;
          await open(expression);
          editable.openInWorld();
          await edit(editable, 'tooltip', 'earlier edit');
          const source = componentModule._source;
          const document = tracker._projectionalDocument;
          const policySpec = descriptor.stylePolicy.spec;
          const manager = editable.env.undoManager;
          const undos = manager.undos.slice();
          const redos = manager.redos.slice();
          const name = partChild ? 'label' : 'a';
          const target = editable.get(name);
          const owner = target.owner;
          const siblings = owner.submorphs.slice();
          const layoutSpec = owner.layout?.getSpec();
          const cachedLayoutSpec = policySpec.layout?.getSpec();
          const world = editable.world();
          const showError = world.showError;
          const errors = [];
          world.showError = error => errors.push(String(error?.message || error));
          const notifications = [];
          const observer = { observe: change => {
            if (change.target === target && change.prop === 'name') {
              notifications.push({ value: change.value, current: target.name });
            }
          } };
          connect(target, 'change', observer, 'observe');
          connect(world, 'onSubmorphChange', observer, 'observe');
          try {
            editable.undoStart('rejected inherited rename');
            target.withMetaDo({ reconcileChanges: true }, () => { target.name = 'independent'; });
            const failure = await processed().catch(error => error);
            editable.undoStop();
            expect(failure).instanceof(Error);
            expect(errors).has.length(1);
            expect(errors[0]).includes('Rename this child in its originating component');
            expect(tracker.lastShadowCommandBatch.projectionalCommit).equals(undefined);
            expect(componentModule._source).equals(source);
            expect(tracker._projectionalDocument).equals(document);
            expect(descriptor.stylePolicy.spec).equals(policySpec);
            expect(target.name).equals(name);
            expect(notifications.length).above(0);
            expect(notifications.every(({ value, current }) => value === current)).equals(true);
            expect(owner.submorphs).deep.equals(siblings);
            expect(owner.layout?.getSpec()).deep.equals(layoutSpec);
            expect(policySpec.layout?.getSpec()).deep.equals(cachedLayoutSpec);
            expect(manager.undos).deep.equals(undos);
            expect(manager.redos).deep.equals(redos);
            checkStructure();
            manager.undo();
            await processed();
            expect(componentModule._source).equals(initialSource);
            expect(editable.tooltip).not.equals('earlier edit');
            manager.redo();
            await processed();
            expect(componentModule._source).equals(source);
            expect(editable.tooltip).equals('earlier edit');
            expect(errors).has.length(1);
          } finally {
            disconnect(target, 'change', observer, 'observe');
            disconnect(world, 'onSubmorphChange', observer, 'observe');
            world.showError = showError;
          }
        });
      }
    }

    it('keeps local nodes, part roots and introduced descendants renameable', async () => {
      await open("component({ name: 'derived', submorphs: [{ name: 'local' }, part(Button)] })");
      const local = editable.get('local');
      const button = editable.get('button');
      await edit(local, 'name', 'local renamed');
      const localSource = componentModule._source;
      await edit(button, 'name', 'button renamed');
      const partSource = componentModule._source;
      const introduced = morph({ name: 'introduced', submorphs: [morph({ name: 'introduced child' })] });
      instances.push(introduced);
      await structure(() => editable.addMorph(introduced));
      const introducedSource = componentModule._source;
      await edit(introduced.submorphs[0], 'name', 'child renamed');
      await replay([initialSource, localSource, partSource, introducedSource, componentModule._source], stage => {
        expect(local.name).equals(stage ? 'local renamed' : 'local');
        expect(button.name).equals(stage >= 2 ? 'button renamed' : 'button');
        checkStructure();
      });
    });

    for (const { kind, spec, names, isText } of [
      { kind: 'plain', spec: "{ name: 'different', fill: Color.blue }", names: [], isText: false },
      { kind: 'typed', spec: "{ type: Text, name: 'different', fill: Color.blue, textString: 'fresh' }", names: [], isText: true },
      { kind: 'part', spec: "part(Button, { name: 'different' })", names: ['label', 'content'], isText: false }
    ]) {
      it(`models a fresh ${kind} replacement like the editable and cold instance`, async () => {
        await open(`component(Base, { name: 'derived', submorphs: [replace('text', ${spec})] })`);
        const target = editable.get('text');
        expect(target.name).equals('text');
        expect(!!target.isText).equals(isText);
        expect(target.submorphs.map(child => child.name)).deep.equals(names);
        const parsed = tracker.projectionalDocumentForCurrentSource();
        expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
        const node = parsed.document.root.children.find(child => child.name === 'text');
        expect(node.name).equals('text');
        expect(node.children.map(child => child.name)).deep.equals(names);
        expect(node.properties.textString?.value).equals(isText ? 'fresh' : undefined);
        await edit(target, 'opacity', 0.6);
        await replay([initialSource, componentModule._source], stage => {
          expect(target.opacity).equals(stage ? 0.6 : 1);
          const instance = cold().get('text');
          expect(!!instance.isText).equals(isText);
          expect(instance.textString).equals(isText ? 'fresh' : undefined);
          expect(instance.opacity).equals(target.opacity);
          checkStructure();
        });
      });
    }
  });

  describe('T10a clearing inherited property overrides', () => {
    for (const { name, property, before, effective, expression } of [
      { name: 'a', property: 'fill', before: Color.blue, effective: Color.red, expression: 'Color.blue' },
      { name: 's1', property: 'opacity', before: 0.4, effective: 1, expression: '0.4' }
    ]) {
      it(`clears ${property} with ${property === 'fill' ? 'an inherited value' : 'no inherited value'}`, async () => {
        await open(`component(Base, { name: 'derived', submorphs: [{ name: '${name}', ${property}: ${expression} }] })`);
        const child = editable.get(name);
        const result = tracker.clearPropertyOverride({ target: child, property, effectiveValue: effective });
        expect(result.committed, JSON.stringify(result.diagnostics)).equals(true);
        await processed();
        const source = componentModule._source;
        expect(ownKeys(name)).not.includes(property);
        const check = stage => {
          expect(child[property]).equals(stage ? effective : before);
          expect(cold().get(name)[property]).equals(stage ? effective : before);
          const cached = descriptor.stylePolicy.getSubSpecAt([name]);
          expect(cached[property]).equals(stage ? undefined : before);
        };
        check(1);
        await replay([initialSource, source], check);
      });
    }

    it('clears a master override while keeping the inherited master', async () => {
      await open("component(Mastered, { name: 'derived', submorphs: [{ name: 'a', master: Alternate }] })");
      const child = editable.get('a');
      const inherited = part(baseExports.Mastered);
      instances.push(inherited);
      const effectiveValue = inherited.get('a').master;
      const result = tracker.clearPropertyOverride({ target: child, property: 'master', effectiveValue });
      expect(result.committed, JSON.stringify(result.diagnostics)).equals(true);
      await processed();
      const source = componentModule._source;
      expect(ownKeys('a')).not.includes('master');
      const check = stage => {
        child.master.applyIfNeeded(true);
        expect(child.fill).equals(stage ? Color.orange : Color.cyan);
        expect(cold().get('a').fill).equals(stage ? Color.orange : Color.cyan);
        const cached = descriptor.stylePolicy.getSubSpecAt(['a']);
        if (stage) expect(cached._originalSpec.master).equals(undefined);
        else expect(cached._originalSpec.master).not.equals(undefined);
      };
      check(1);
      await replay([initialSource, source], check);
    });
  });

  it('introduces a RadioButton using its existing package-root import with exact replay', async () => {
    await open("component({ name: 'derived' })", "import { RadioButton } from 'lively.components';");
    const { RadioButton } = componentModule.recorder;
    const button = new RadioButton({ name: 'introduced button', submorphs: [] });
    instances.push(button);
    const source = await structure(() => editable.addMorph(button));
    expect(source.match(/^import .*$/gm)).deep.equals(initialSource.match(/^import .*$/gm));
    expect(source).matches(/type:\s*RadioButton/);
    await replay([initialSource, source], index => {
      expect(editable.submorphs.includes(button)).equals(!!index);
      const children = cold().submorphs;
      expect(children.map(child => child.name)).deep.equals(index ? ['introduced button'] : []);
      if (index) expect(children[0]).instanceof(RadioButton);
    });
  });

  it('materializes only the edited inherited paths and replays their fills exactly', async () => {
    await open();
    const a = editable.get('a');
    const inner = editable.get('inner');
    await edit(a, 'fill', Color.orange);
    const firstSource = componentModule._source;
    expect(ownKeys('a')).deep.equals(['fill', 'name']);
    await edit(inner, 'fill', Color.blue);
    expect(ownKeys('a')).deep.equals(['fill', 'name', 'submorphs']);
    expect(ownKeys('a', 'inner')).deep.equals(['fill', 'name']);
    expect(ownKeys('s1')).deep.equals([]);
    const check = index => {
      expect(a.fill, `runtime a at ${index}`).equals(index ? Color.orange : Color.red);
      expect(inner.fill, `runtime inner at ${index}`).equals(index === 2 ? Color.blue : Color.green);
      const instance = cold();
      expect(instance.get('a').fill, `cold a at ${index}`).equals(a.fill);
      expect(instance.get('inner').fill, `cold inner at ${index}`).equals(inner.fill);
      if (index) expect(descriptor.stylePolicy.getSubSpecAt(['a']).fill).equals(Color.orange);
      if (index === 2) {
        expect(descriptor.stylePolicy.getSubSpecFor('inner').fill).equals(Color.blue);
      }
    };
    check(2);
    await replay([initialSource, firstSource, componentModule._source], check);
  });

  it('creates a missing ancestor override for a deep inherited edit (legacy 330)', async () => {
    await open();
    await edit(editable.get('inner'), 'fill', Color.blue);
    expect(ownKeys('a')).deep.equals(['name', 'submorphs']);
    expect(ownKeys('a', 'inner')).deep.equals(['fill', 'name']);
    await replay([initialSource, componentModule._source], index => {
      expect(editable.get('inner').fill, `runtime inner at ${index}`).equals(index ? Color.blue : Color.green);
      expect(cold().get('inner').fill, `cold inner at ${index}`).equals(editable.get('inner').fill);
      expect(editable.get('a').fill).equals(Color.red);
    });
  });

  it('inserts a new override before the next inherited sibling override (legacy 351)', async () => {
    await open("component(Base, { name: 'derived', submorphs: [{ name: 's2', fill: Color.blue }] })");
    const originalFill = editable.get('s1').fill;
    await edit(editable.get('s1'), 'fill', Color.orange);
    expect(componentModule._source).matches(/name:\s*["']s1["'][\s\S]*name:\s*["']s2["']/);
    expect(ownKeys('s1')).deep.equals(['fill', 'name']);
    await replay([initialSource, componentModule._source], index => {
      expect(cold().get('s1').fill, `cold s1 at ${index}`).equals(editable.get('s1').fill);
      expect(editable.get('s1').fill).equals(index ? Color.orange : originalFill);
      expect(editable.get('s2').fill, `runtime s2 at ${index}`).equals(Color.blue);
    });
  });

  for (const expression of [
    'part(Button)', 'add(part(Button))', "part(Button, { name: 'button' })",
    'part((Button), /* trailing comma */)'
  ]) {
    it(`edits the root and label of ${expression} with exact replay`, async () => {
      await open(`component({ name: 'derived', submorphs: [${expression}] })`);
      const button = editable.get('button');
      const label = editable.get('label');
      await edit(button, 'fill', Color.orange);
      const firstSource = componentModule._source;
      await edit(label, 'fontColor', Color.blue);
      expect(ownKeys('button', 'label')).deep.equals(['fontColor', 'name']);
      expect(componentModule._source).matches(/fill:\s*Color.orange/);
      const check = index => {
        expect(button.fill, `runtime button at ${index}`).equals(index ? Color.orange : Color.red);
        expect(label.fontColor, `runtime label at ${index}`).equals(index === 2 ? Color.blue : Color.black);
        const instance = cold();
        expect(instance.get('button').fill, `cold button at ${index}`).equals(button.fill);
        expect(instance.get('label').fontColor, `cold label at ${index}`).equals(label.fontColor);
      };
      check(2);
      await replay([initialSource, firstSource, componentModule._source], check);
    });
  }

  it('materializes a part spec and its label path together when the label is edited first', async () => {
    await open("component({ name: 'derived', submorphs: [add(part(Button))] })");
    await edit(editable.get('label'), 'fontColor', Color.blue);
    expect(ownKeys('button')).deep.equals(['submorphs']);
    expect(ownKeys('button', 'label')).deep.equals(['fontColor', 'name']);
    await replay([initialSource, componentModule._source], index => {
      expect(editable.get('label').fontColor).equals(index ? Color.blue : Color.black);
      expect(cold().get('label').fontColor).equals(editable.get('label').fontColor);
    });
  });

  it('commits a text edit on a spec-less inherited Text child', async () => {
    await open();
    await edit(editable.get('text'), 'textAndAttributes', ['after', { fontWeight: 'bold' }]);
    expect(ownKeys('text')).deep.equals(['name', 'textAndAttributes']);
    const check = index => {
      expect(editable.get('text').textString).equals(index ? 'after' : 'before');
      expect(cold().get('text').textAndAttributes).deep.equals(editable.get('text').textAndAttributes);
      if (index) {
        expect(descriptor.stylePolicy.getSubSpecAt(['text']).textAndAttributes)
          .deep.equals(['after', { fontWeight: 'bold' }]);
      }
    };
    check(1);
    await replay([initialSource, componentModule._source], check);
  });

  it('commits a master edit on a spec-less inherited child', async () => {
    await open();
    const child = editable.get('s1');
    const originalFill = child.fill;
    expect(child.master).equals(null);
    await edit(child, 'master', baseExports.Accent);
    const operation = tracker.lastShadowCommandBatch.projectionalCommit.transaction
      .runtimeChangeSet.operations.find(operation => operation.property === 'master');
    expect(operation.before).equals(null);
    expect(ownKeys('s1')).deep.equals(['master', 'name']);
    expect(componentModule._source).matches(/master:\s*Accent/);
    const check = index => {
      if (index) {
        child.master.applyIfNeeded(true);
        expect(child.master).equals(descriptor.stylePolicy.getSubSpecAt(['s1']));
        expect(cold().get('s1').fill).equals(Color.orange);
        expect(child.fill).equals(Color.orange);
      } else {
        expect(child.master, 'runtime master after undo').equals(null);
        expect(descriptor.stylePolicy.getSubSpecFor('s1')?.isPolicy).not.equals(true);
        expect(cold().get('s1').fill, 'cold fill after master undo').equals(originalFill);
      }
    };
    check(1);
    await replay([initialSource, componentModule._source], check);
  });

  describe('T9 reducer and bridge ordering', () => {
    it('orders an added child around inherited siblings without source entries', async () => {
      await open(`component(Ordered, { name: 'derived', submorphs: [{ name: 'container', submorphs: [
        add({ name: 'n' })
      ] }] })`);
      const parent = editable.get('container');
      const moved = editable.get('n');
      const first = await structure(() => parent.addMorphAt(moved, 0));
      expect(first).matches(/add\(\{ name: 'n' \}, "child"\)/);
      const middle = await structure(() => parent.addMorphAt(moved, 2));
      expect(middle).matches(/add\(\{ name: 'n' \}, "other"\)/);
      const last = await structure(() => parent.addMorph(moved));
      expect(last).equals(initialSource);
      await replay([initialSource, first, middle, last], stage => {
        expect(parent.submorphs.map(child => child.name)).deep.equals([
          ['child', 'other', 'n'], ['n', 'child', 'other'],
          ['child', 'n', 'other'], ['child', 'other', 'n']
        ][stage]);
        checkStructure();
      });
    });

    it('retargets and reorders added anchors without inherited source entries', async () => {
      await open(`component(Ordered, { name: 'derived', submorphs: [{ name: 'container', submorphs: [
        add({ name: 'x' }, 'n'), /* keep the middle comment */ add({ name: 'n' }, 'child'),
        add({ name: 'tail' })
      ] }] })`);
      const parent = editable.get('container');
      const moved = editable.get('n');
      const last = await structure(() => parent.addMorph(moved));
      expect(last).matches(/add\(\{ name: 'x' \}, "child"\)/);
      expect(last).includes('/* keep the middle comment */');
      const middle = await structure(() => parent.addMorphAt(moved, 1));
      expect(middle).matches(/add\(\{ name: 'n' \}, "child"\)/);
      await replay([initialSource, last, middle], stage => {
        expect(parent.submorphs.map(child => child.name)).deep.equals([
          ['x', 'n', 'child', 'other', 'tail'],
          ['x', 'child', 'other', 'tail', 'n'],
          ['x', 'n', 'child', 'other', 'tail']
        ][stage]);
        checkStructure();
      });
    });

    for (const index of [0, 1]) {
      it(`${index ? 'rejects' : 'accepts'} restoration at runtime index ${index} (P2-5)`, async () => {
        await open("component(Ordered, { name: 'derived' })");
        const parent = editable.get('container');
        const child = editable.get('child');
        const moved = await structure(() => editable.addMorph(child));
        if (index === 1) {
          editable.openInWorld();
          const world = editable.world();
          const showError = world.showError;
          const errors = [];
          world.showError = error => errors.push(error);
          try {
            let rejection;
            try { await structure(() => parent.addMorphAt(child, index)); } catch (error) { rejection = error; }
            expect(rejection?.message).matches(/restored at index 0/);
            expect(errors).has.length(1);
            expect(String(errors[0])).includes('restored at index 0');
            expect(tracker.lastShadowCommandBatch.projectionalCommit).equals(undefined);
            expect(componentModule._source).equals(moved);
            expect(child.owner).equals(editable);
            expect(parent.submorphs.map(child => child.name)).deep.equals(['other']);
            checkStructure();
            await replay([initialSource, moved], stage => {
              expect(child.owner).equals(stage ? editable : parent);
              checkStructure();
            });
          } finally { world.showError = showError; }
          return;
        }
        const restored = await structure(() => parent.addMorphAt(child, index));
        const command = tracker.lastShadowCommandBatch.shadowProjection.steps[0].componentCommand;
        expect(command.inheritanceTransition?.kind).equals('restore-inherited');
        const check = stage => {
          const order = stage === 1 ? ['other'] : ['child', 'other'];
          expect(parent.submorphs.map(child => child.name)).deep.equals(order);
          const document = tracker.projectionalDocumentForCurrentSource().document;
          expect(document.root.children.find(node => node.name === 'container').children
            .filter(node => !node.provenance.suppressed).map(node => node.name)).deep.equals(order);
          checkStructure();
        };
        check(2);
        await replay([initialSource, moved, restored], check);
      });
    }

    it('retargets an added dependant when its anchor moves within the parent (P2-6)', async () => {
      await open(`component(Ordered, { name: 'derived', submorphs: [{ name: 'container', submorphs: [
        add({ name: 'x' }, 'n'), add({ name: 'n' }, 'child'), { name: 'child' }, { name: 'other' }
      ] }] })`);
      const parent = editable.get('container');
      const moved = editable.get('n');
      const source = await structure(() => parent.addMorphAt(moved, parent.submorphs.length));
      expect(source).matches(/add\(\{ name: 'x' \}, "child"\)/);
      const check = stage => {
        expect(parent.submorphs.map(child => child.name)).deep.equals(stage
          ? ['x', 'child', 'other', 'n'] : ['x', 'n', 'child', 'other']);
        checkStructure();
      };
      check(1);
      await replay([initialSource, source], check);
    });

    it('retargets a removed anchor to the next visible sibling', async () => {
      await open(`component(Ordered, { name: 'derived', submorphs: [{ name: 'container', submorphs: [
        add({ name: 'n' }, 'child'), without('child'), add({ name: 'x' }, 'n')
      ] }] })`);
      const parent = editable.get('container');
      const removed = editable.get('n');
      const document = tracker.projectionalDocumentForCurrentSource().document;
      expect(document.root.children[0].children.filter(node => !node.provenance.suppressed)
        .map(node => node.name)).deep.equals(['x', 'n', 'other']);
      expect(parent.submorphs.map(child => child.name)).deep.equals(['x', 'n', 'other']);
      checkStructure();
      const source = await structure(() => removed.remove());
      expect(source).matches(/add\(\{ name: 'x' \}, "other"\)/);
      const check = stage => {
        expect(parent.submorphs.map(child => child.name)).deep.equals(stage
          ? ['x', 'other'] : ['x', 'n', 'other']);
        checkStructure();
      };
      check(1);
      await replay([initialSource, source], check);
    });
  });

  describe('source-text edge cases', () => {
    it('restores an edited inherited child without a sparse array (P2-7a)', async () => {
      await open("component(Base, { name: 'derived', submorphs: [{ name: 'a' }] })");
      const child = editable.get('inner');
      const owner = child.owner;
      const movedSource = await structure(() => editable.addMorph(child));
      expect(movedSource).matches(/without\(["']inner["']\)/);
      await edit(child, 'opacity', 0.4);
      const editedSource = componentModule._source;
      const restoredSource = await structure(() => owner.addMorphAt(child, 0));
      expect(restoredSource).not.matches(/\[\s*,/);
      expect(restoredSource).not.matches(/without\(["']inner["']\)/);
      const check = index => {
        expect(child.owner).equals(index === 1 || index === 2 ? editable : owner);
        expect(child.opacity).equals(index >= 2 ? 0.4 : 1);
        expect(cold().get('inner').opacity).equals(child.opacity);
        checkStructure();
      };
      check(3);
      await replay([initialSource, movedSource, editedSource, restoredSource], check);
    });

    it('introduces after restoring the last suppression (P2-7b sequence)', async () => {
      await open();
      const child = editable.get('inner');
      const owner = child.owner;
      const suppressed = await structure(() => child.remove());
      const restored = await structure(() => owner.addMorph(child));
      expect(restored).equals(initialSource);
      const added = morph({ name: 'introduced', fill: Color.cyan });
      const source = await structure(() => owner.addMorph(added));
      expect(source).not.matches(/\[\s*,/);
      checkStructure();
      await replay([initialSource, suppressed, restored, source], index => {
        expect(child.owner).equals(index === 1 ? null : owner);
        expect(added.owner).equals(index === 3 ? owner : null);
        checkStructure();
      });
    });

    for (const { label, expression, parentName } of [
      {
        label: 'empty derived override',
        expression: "component(Base, { name: 'derived', submorphs: [{ name: 'a', submorphs: [] }] })",
        parentName: 'a'
      }, {
        label: 'empty part override',
        expression: "component({ name: 'derived', submorphs: [part(Button, { submorphs: [] })] })",
        parentName: 'button'
      }, {
        label: 'comment-only part override',
        expression: "component({ name: 'derived', submorphs: [part(Button, { submorphs: [/* keep comment */] })] })",
        parentName: 'button'
      }, {
        label: 'trailing-comma suppression',
        expression: "component(Base, { name: 'derived', submorphs: [{ name: 'a', submorphs: [without('inner'), /* keep comment */] }] })",
        parentName: 'a'
      }
    ]) {
      it(`introduces into ${label} without redundant separators (P2-7b)`, async () => {
        await open(expression);
        const parent = editable.get(parentName);
        const added = morph({ name: 'introduced', fill: Color.cyan });
        const source = await structure(() => parent.addMorph(added));
        expect(source).not.matches(/\[\s*,/);
        if (expression.includes('keep comment')) expect(source).includes('/* keep comment */');
        checkStructure();
        await replay([initialSource, source], index => {
          expect(added.owner).equals(index ? parent : null);
          checkStructure();
        });
      });
    }

    for (const property of ['textString', 'value']) {
      it(`replaces stale ${property} when inserting textAndAttributes (legacy 592)`, async () => {
        await open(`component({ name: 'derived', submorphs: [{ type: Text, name: 'label',
          ${property}: 'before', fixedWidth: true, fixedHeight: true, extent: pt(100, 30) }] })`);
        const label = editable.get('label');
        expect(label.textString).equals('before');
        const source = await structure(() => { label.textAndAttributes = ['after', null]; });
        expect(ownKeys('label')).not.includes(property);
        expect(source).not.matches(new RegExp(`\\b${property}\\s*:`));
        expect(source).matches(/textAndAttributes\s*:/);
        const secondSource = await structure(() => { label.textString += ' twice'; });
        const check = index => {
          expect(label.textString).equals(['before', 'after', 'after twice'][index]);
          expect(cold().get('label').textString).equals(label.textString);
        };
        check(2);
        await replay([initialSource, source, secondSource], check);
      });
    }
  });

  describe('structural inherited edits', () => {
    it('introduces into a deep spec-less inherited parent and replays exactly', async () => {
      await open();
      const added = morph({ name: 'introduced', fill: Color.cyan });
      const source = await structure(() => editable.get('inner').addMorph(added));
      expect(ownKeys('a')).deep.equals(['name', 'submorphs']);
      expect(ownKeys('a', 'inner')).deep.equals(['name', 'submorphs']);
      expect(source).matches(/add\(\{\s*name:\s*["']introduced["']/);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(added.owner).equals(index ? editable.get('inner') : null);
        checkStructure();
      });
    });

    for (const expression of ['part(Button)', 'add(part(Button))']) {
      for (const parentName of ['button', 'content']) {
        it(`introduces into the spec-less ${parentName} of ${expression}`, async () => {
          await open(`component({ name: 'derived', submorphs: [${expression}] })`);
          const parent = editable.get(parentName);
          const added = morph({ name: 'introduced', fill: Color.cyan });
          const source = await structure(() => parent.addMorph(added));
          expect(source).matches(/add\(\{\s*name:\s*["']introduced["']/);
          checkStructure();
          await replay([initialSource, source], index => {
            expect(added.owner).equals(index ? parent : null);
            checkStructure();
          });
        });
      }
    }

    it('moves an added node into a spec-less inherited destination', async () => {
      await open("component(Base, { name: 'derived', submorphs: [add({ name: 'moved', fill: Color.cyan })] })");
      const moved = editable.get('moved');
      const destination = editable.get('inner');
      const source = await structure(() => destination.addMorph(moved));
      expect(ownKeys('a', 'inner')).deep.equals(['name', 'submorphs']);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(moved.owner).equals(index ? destination : editable);
        checkStructure();
      });
    });

    it('materializes an inherited move between two spec-less paths', async () => {
      await open();
      const moved = editable.get('inner');
      const previousOwner = moved.owner;
      const destination = editable.get('s2');
      expect(moved.fill).equals(Color.green);
      const source = await structure(() => destination.addMorph(moved));
      expect(source).matches(/without\(["']inner["']\)/);
      expect(ownKeys('a')).deep.equals(['name', 'submorphs']);
      expect(ownKeys('s2')).deep.equals(['name', 'submorphs']);
      expect(moved.fill).equals(Color.green);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(moved.owner).equals(index ? destination : previousOwner);
        expect(moved.fill).equals(Color.green);
        checkStructure();
      });
    });

    it('keeps inherited part-child styles when materializing a move', async () => {
      await open("component({ name: 'derived', submorphs: [part(Button, { name: 'button', submorphs: [{ name: 'content' }] }), { name: 'destination' }] })");
      const moved = editable.get('icon');
      const previousOwner = moved.owner;
      const destination = editable.get('destination');
      expect(moved.fill).equals(Color.green);
      const source = await structure(() => destination.addMorph(moved));
      expect(moved.fill).equals(Color.green);
      expect(cold().get('icon').fill).equals(Color.green);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(moved.owner).equals(index ? destination : previousOwner);
        expect(moved.fill).equals(Color.green);
        expect(cold().get('icon').fill).equals(Color.green);
        checkStructure();
      });
    });

    it('suppresses a child under a spec-less inherited parent', async () => {
      await open();
      const removed = editable.get('inner');
      const owner = removed.owner;
      const source = await structure(() => removed.remove());
      expect(source).matches(/without\(["']inner["']\)/);
      expect(ownKeys('a')).deep.equals(['name', 'submorphs']);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(removed.owner).equals(index ? null : owner);
        checkStructure();
      });
    });

    it('prunes the suppression path when restoring its inherited child', async () => {
      await open();
      const removed = editable.get('inner');
      const owner = removed.owner;
      const firstSource = await structure(() => removed.remove());
      const source = await structure(() => owner.addMorph(removed));
      expect(source).equals(initialSource);
      expect(ownKeys('a')).deep.equals([]);
      checkStructure();
      await replay([initialSource, firstSource, source], index => {
        expect(removed.owner).equals(index === 1 ? null : owner);
        checkStructure();
      });
    });

    it('prunes the deep override path after add then remove (legacy 469)', async () => {
      await open();
      const added = morph({ name: 'temporary', fill: Color.cyan });
      const firstSource = await structure(() => editable.get('inner').addMorph(added));
      const finalSource = await structure(() => added.remove());
      expect(finalSource, JSON.stringify({ initialSource, finalSource })).equals(initialSource);
      expect(ownKeys('a')).deep.equals([]);
      expect(ownKeys('a', 'inner')).deep.equals([]);
      checkStructure();
      await replay([initialSource, firstSource, finalSource], index => {
        expect(added.owner).equals(index === 1 ? editable.get('inner') : null);
        checkStructure();
      });
    });

    it('drops the submorphs property after removing the last explicit child', async () => {
      await open("component({ name: 'derived', submorphs: [{ name: 'only' }] })");
      const removed = editable.get('only');
      const source = await structure(() => removed.remove());
      expect(source).not.matches(/submorphs\s*:/);
      expect(ownKeys()).deep.equals(['name']);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(removed.owner).equals(index ? null : editable);
        checkStructure();
      });
    });

    it('prunes an emptied override when moving its only addition into the ancestor', async () => {
      await open("component(Base, { name: 'derived', submorphs: [{ name: 'a', submorphs: [{ name: 'inner', submorphs: [add({ name: 'moved' })] }] }] })");
      const moved = editable.get('moved');
      const previousOwner = moved.owner;
      const destination = editable.get('a');
      const source = await structure(() => destination.addMorph(moved));
      expect(ownKeys('a', 'inner')).deep.equals([]);
      checkStructure();
      await replay([initialSource, source], index => {
        expect(moved.owner).equals(index ? destination : previousOwner);
        checkStructure();
      });
    });

    for (const { label, expression, retained } of [
      {
        label: 'own properties',
        expression: "component(Base, { name: 'derived', submorphs: [{ name: 'a', fill: Color.orange, submorphs: [add({ name: 'temporary' })] }] })",
        retained: /name:\s*'a', fill: Color.orange/
      }, {
        label: 'suppression markers',
        expression: "component(Base, { name: 'derived', submorphs: [{ name: 'a', submorphs: [without('inner'), add({ name: 'temporary' })] }] })",
        retained: /without\('inner'\)/
      }, {
        label: 'addition markers',
        expression: "component(Base, { name: 'derived', submorphs: [add({ name: 'kept', submorphs: [{ name: 'temporary' }] })] })",
        retained: /add\(\{ name: 'kept'/
      }, {
        label: 'replacement markers',
        expression: "component(Base, { name: 'derived', submorphs: [replace('a', { name: 'a', submorphs: [add({ name: 'temporary' })] })] })",
        retained: /replace\('a', \{ name: 'a'/
      }, {
        label: 'part specs',
        expression: "component({ name: 'derived', submorphs: [part(Button, { name: 'button', submorphs: [add({ name: 'temporary' })] })] })",
        retained: /part\(Button, \{ name: 'button'/
      }
    ]) {
      it(`keeps ${label} when pruning an empty child list`, async () => {
        await open(expression);
        const source = await structure(() => editable.get('temporary').remove());
        expect(source).matches(retained);
        expect(source).not.matches(/submorphs:\s*\[\s*\]/);
        checkStructure();
        await replay([initialSource, source], checkStructure);
      });
    }
  });
});
