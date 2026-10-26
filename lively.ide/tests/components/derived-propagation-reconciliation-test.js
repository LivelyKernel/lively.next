/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { Color } from 'lively.graphics';
import { morph, part } from 'lively.morphic';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://derived-propagation-reconciliation-test/';
const header = `
import { component, ComponentDescriptor, part, add, replace } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color } from 'lively.graphics';
component.DescriptorClass = InteractiveComponentDescriptor;
`;
const footer = '\ncomponent.DescriptorClass = ComponentDescriptor;\n';

describe('atomic projectional derived propagation', function () {
  releaseComponentEditingState();
  let modules, descriptors, editables, instances, notices, errors, world, showError, showStatusMessage;

  beforeEach(() => {
    modules = new Map();
    descriptors = {};
    editables = [];
    instances = [];
    notices = [];
    errors = [];
  });

  afterEach(async () => {
    if (world) {
      world.showError = showError;
      world.showStatusMessage = showStatusMessage;
      world = null;
    }
    for (const editable of editables) {
      editable._changeTracker?.dispose();
      editable.remove();
    }
    instances.forEach(instance => instance.remove());
    for (const componentModule of [...modules.values()].reverse()) {
      await componentModule.unload();
      await System._livelyModulesTranslationCache.deleteCachedData(componentModule.id);
    }
    await resource(directory).remove();
  });

  /** Load real component modules, keeping nested part users optional for isolated regressions. */
  async function setup ({ plain = false, other = false, broken = false, grandchild = false,
    baseSpec = "{ name: 'base', submorphs: [{ name: 'label', fill: Color.red }, { name: 'container' }] }",
    derivedSpec = "{ name: 'derived', submorphs: [{ name: 'label', fill: Color.yellow }] }",
    grandchildSpec = "{ name: 'grandchild', submorphs: [{ name: 'label', opacity: 0.4 }] }"
  } = {}) {
    const files = {
      'base.cp.js': header + `
export const Ref = component({ name: 'ref', submorphs: [{ name: 'deep', fill: Color.red }] });
export const Base = component(${baseSpec});
export const Other = component({ name: 'other', submorphs: [{ name: 'label', fill: Color.green }] });
` + footer,
      'derived.cp.js': header + `
import { Base } from './base.cp.js';
export const Derived = component(Base, ${derivedSpec});
` + footer
    };
    if (plain || other) files['users.cp.js'] = header + `
import { Base, Other } from './base.cp.js';
${plain ? `export const Plain = component({ name: 'plain', submorphs: [part(Base, {
  name: 'embedded', submorphs: [{ name: 'label', fill: Color.blue }, add({ name: 'badge' }, 'label')]
})] });` : ''}
${other ? `export const OtherUser = component(Other, { name: 'other user', submorphs: [
  { name: 'label', fill: Color.green }, add(part(Base, { name: 'embedded' }))
] });` : ''}
` + footer;
    if (broken) files['broken.cp.js'] = header + `
import { Base } from './base.cp.js';
export const Broken = component(Base, { name: 'broken', submorphs: [{ name: 'label', opacity: 0.4 }] });
` + footer;
    if (grandchild) files['grandchild.cp.js'] = header + `
import { Derived } from './derived.cp.js';
export const Grandchild = component(Derived, ${grandchildSpec});
` + footer;
    await createFiles(directory, files);
    for (const file of Object.keys(files)) {
      const componentModule = module(System, directory + file);
      modules.set(file, componentModule);
      Object.assign(descriptors, await componentModule.load());
    }
  }

  /** Open the real editing entry point and capture user-visible diagnostics. */
  async function open (name = 'Base') {
    const editable = await descriptors[name].edit();
    editables.push(editable);
    editable.openInWorld();
    editable.master.applyIfNeeded(true);
    await processed(editable);
    if (!world) {
      world = editable.world();
      showError = world.showError;
      showStatusMessage = world.showStatusMessage;
      world.showError = message => errors.push(message);
      world.showStatusMessage = message => notices.push(message);
    }
    return editable;
  }

  /** Wait for source writes and diagnostic comparison, optionally returning a rejection. */
  async function processed (editable, rejected = false) {
    const result = await editable._changeTracker.onceChangesProcessed().catch(error => {
      if (!rejected) throw error;
      return error;
    });
    await editable._changeTracker._shadowComparisonPromise;
    return result;
  }

  /** Apply the same reconciled undo group used by direct manipulation. */
  async function edit (editable, callback, rejected = false) {
    editable.undoStart('derived propagation regression');
    let result;
    try {
      editable.withMetaDo({ reconcileChanges: true }, callback);
      result = await processed(editable, rejected);
    } finally { editable.undoStop(); }
    return result;
  }

  /** Snapshot all module sources, including untouched part users. */
  function sources () {
    return [...modules].map(([name, componentModule]) => [name, componentModule._source]);
  }

  /** Compare cold instances with the descriptor cache after propagation or replay. */
  function cold (name) {
    const instance = part(descriptors[name]);
    instances.push(instance);
    instance.master.applyIfNeeded(true);
    return instance;
  }

  /** Replay an edit and require exact sources at both boundaries. */
  async function replay (editable, before, after, check) {
    editable.env.undoManager.undo();
    await processed(editable);
    expect(sources()).deep.equals(before);
    check(false);
    editable.env.undoManager.redo();
    await processed(editable);
    expect(sources()).deep.equals(after);
    check(true);
  }

  it('T9 reintroduces an altered part and drops removed derived overrides (legacy 896)', async () => {
    await setup({
      baseSpec: "{ name: 'base', submorphs: [part(Ref, { name: 'some ref' }), { name: 'sibling', fill: Color.yellow }] }",
      derivedSpec: "{ name: 'derived', submorphs: [{ name: 'sibling', fill: Color.green }] }"
    });
    const base = await open();
    const derived = await open('Derived');
    await edit(derived, () => { derived.get('deep').fill = Color.lively; });
    const removed = base.get('some ref');
    await edit(base, () => removed.remove());
    const afterRemove = sources();
    const deep = removed.submorphs[0];
    deep.remove();
    await edit(base, () => base.addMorph(removed));
    const after = sources();
    expect(modules.get('base.cp.js')._source).matches(/without\(["']deep["']\)/);
    expect(modules.get('derived.cp.js')._source).not.includes("name: 'deep'");
    expect(modules.get('derived.cp.js')._source).not.matches(/name:\s*["']some ref["']/);
    const check = () => {
      for (const [name, editable] of [['Base', base], ['Derived', derived]]) {
        const instance = cold(name);
        expect(instance.submorphs.map(child => child.name)).deep.equals(editable.submorphs.map(child => child.name));
        expect(instance.get('some ref').submorphs).has.length(0);
        expect(editable.get('some ref').submorphs).has.length(0);
      }
      expect(cold('Derived').get('sibling').fill).equals(Color.green);
    };
    check();
    await replay(base, afterRemove, after, applied => {
      if (applied) check();
      else expect(base.submorphs.includes(removed)).equals(false);
    });
  });

  it('renames true derivations while visibly skipping a scoped nested part override', async () => {
    await setup({ plain: true });
    // Legacy getSubSpecFor does not cross a nested policy's scope.
    expect(descriptors.Plain.stylePolicy.getSubSpecFor('label')).equals(null);
    const editable = await open();
    const before = sources();
    const usersSource = modules.get('users.cp.js')._source;
    await edit(editable, () => { editable.get('label').name = 'caption'; });
    const batch = editable._changeTracker.lastShadowCommandBatch;
    expect(batch.projectionalCommit, batch.commitDiagnostic?.message).not.equals(undefined);
    expect(batch.derivedPropagation.components.map(entry => entry.exportName)).deep.equals(['Derived']);
    expect(modules.get('users.cp.js')._source).equals(usersSource);
    expect(modules.get('derived.cp.js')._source).matches(/name:\s*["']caption["']/);
    expect(notices).has.length(1);
    expect(notices[0]).includes('Plain');
    expect(notices[0]).includes('not updated');
    expect(errors).deep.equals([]);
    const check = renamed => {
      const name = renamed ? 'caption' : 'label';
      expect(editable.submorphs[0].name).equals(name);
      expect(descriptors.Derived.stylePolicy.spec.submorphs[0].name).equals(name);
      expect(cold('Derived').submorphs[0].name).equals(name);
    };
    check(true);
    await replay(editable, before, sources(), check);
    editable._changeTracker.projectionalDerivedDescriptors(descriptors.Base);
    editable._changeTracker.projectionalDerivedDescriptors(descriptors.Base);
    expect(notices).has.length(1);
  });

  it('leaves another parents label override untouched when it embeds add(part(Base))', async () => {
    await setup({ other: true });
    const editable = await open();
    const before = sources();
    const usersSource = modules.get('users.cp.js')._source;
    const ownLabel = descriptors.OtherUser.stylePolicy.getSubSpecFor('label');
    await edit(editable, () => { editable.get('label').name = 'caption'; });
    expect(modules.get('users.cp.js')._source).equals(usersSource);
    expect(ownLabel.name).equals('label');
    expect(cold('OtherUser').submorphs[0].name).equals('label');
    expect(notices).has.length(1);
    expect(notices[0]).includes('OtherUser');
    await replay(editable, before, sources(), () => {
      expect(ownLabel.name).equals('label');
      expect(cold('OtherUser').submorphs[0].name).equals('label');
    });
  });

  it('rejects a resolvable dependant planning failure with sources runtime caches and history intact', async () => {
    await setup({ broken: true });
    const editable = await open();
    const tracker = editable._changeTracker;
    await edit(editable, () => { editable.fill = Color.red; });
    await edit(editable, () => { editable.fill = Color.orange; });
    const manager = editable.env.undoManager;
    manager.undo();
    await processed(editable);
    expect(manager.undos).not.to.be.empty;
    expect(manager.redos).not.to.be.empty;
    const before = sources();
    const policies = ['Base', 'Derived', 'Broken'].map(name => descriptors[name].stylePolicy.spec);
    const undos = manager.undos.slice();
    const redos = manager.redos.slice();
    const describeComponent = tracker.projectionalDerivedComponentDescription;
    tracker.projectionalDerivedComponentDescription = function (descriptor, source) {
      if (descriptor === descriptors.Broken) throw new Error('injected resolvable dependant failure');
      return describeComponent.call(this, descriptor, source);
    };
    const error = await edit(editable, () => { editable.get('label').name = 'caption'; }, true);
    const batch = tracker.lastShadowCommandBatch;
    expect(batch.projectionalCommit).equals(undefined);
    expect(error.message).includes('injected resolvable dependant failure');
    expect(errors).has.length(1);
    expect(errors[0]).includes('injected resolvable dependant failure');
    expect(batch.derivedPropagation.components).deep.equals([]);
    expect(sources()).deep.equals(before);
    expect(editable.submorphs[0].name).equals('label');
    for (const [index, name] of ['Base', 'Derived', 'Broken'].entries()) {
      expect(descriptors[name].stylePolicy.spec).equals(policies[index]);
      expect(policies[index].submorphs[0].name).equals('label');
      expect(cold(name).submorphs[0].name).equals('label');
    }
    expect(manager.undos).deep.equals(undos);
    expect(manager.redos).deep.equals(redos);
    const rejectedMorph = morph({ name: 'rejected introduction', fill: Color.orange });
    instances.push(rejectedMorph);
    await edit(editable, () => editable.addMorph(rejectedMorph), true);
    expect(tracker.lastShadowCommandBatch.projectionalCommit).equals(undefined);
    expect(rejectedMorph.owner).equals(null);
    expect(editable.submorphs.map(child => child.name)).deep.equals(['label', 'container']);
    expect(sources()).deep.equals(before);
    expect(manager.undos).deep.equals(undos);
    expect(manager.redos).deep.equals(redos);
    expect(errors).has.length(1);
    tracker.projectionalDerivedComponentDescription = describeComponent;
    await edit(editable, () => { editable.get('label').name = 'caption'; });
    expect(tracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    expect(errors).has.length(1);
  });

  it('does not prepare either cache projection from an unsupported propagation plan', async () => {
    await setup();
    const editable = await open();
    await edit(editable, () => { editable.get('label').name = 'caption'; });
    const tracker = editable._changeTracker;
    const batch = tracker.lastShadowCommandBatch;
    const rejected = { ...batch, derivedPropagation: { ...batch.derivedPropagation, supported: false } };
    expect(tracker.prepareProjectionalPolicyCacheRename(rejected)).equals(null);
    expect(tracker.prepareProjectionalPolicyCacheFromSource(rejected)).equals(null);
  });

  it('restores an already applied base edit when derived runtime validation fails', async () => {
    await setup();
    const editable = await open();
    const derived = await open('Derived');
    const tracker = editable._changeTracker;
    const before = sources();
    const manager = editable.env.undoManager;
    const undos = manager.undos.slice();
    const redos = manager.redos.slice();
    const policies = ['Base', 'Derived'].map(name => descriptors[name].stylePolicy.spec);
    const prepare = tracker.prepareProjectionalDerivedRename;
    tracker.prepareProjectionalDerivedRename = function (batch) {
      const plan = prepare.call(this, batch);
      return { ...plan, runtimeRenames: [...(plan.runtimeRenames || []), {
        id: 'injected-validation-conflict',
        beforeName: 'injected stale derived name', afterName: 'caption',
        target: derived.submorphs[0]
      }] };
    };
    const error = await edit(editable, () => { editable.get('label').name = 'caption'; }, true);
    expect(tracker.lastShadowCommandBatch.projectionalCommit).equals(undefined);
    expect(error.message, error.message).includes('changed');
    expect(errors).has.length(1);
    expect(sources()).deep.equals(before);
    expect(editable.submorphs[0].name).equals('label');
    expect(derived.submorphs[0].name).equals('label');
    for (const [index, name] of ['Base', 'Derived'].entries()) {
      expect(descriptors[name].stylePolicy.spec).equals(policies[index]);
      expect(policies[index].submorphs[0].name).equals('label');
    }
    expect(manager.undos).deep.equals(undos);
    expect(manager.redos).deep.equals(redos);
  });

  it('logs an unresolvable dependant once and still commits real derivations', async () => {
    await setup();
    const editable = await open();
    const tracker = editable._changeTracker;
    descriptors.Base.stylePolicy._dependants.add('unresolvable-test-dependant');
    const warnings = [];
    const warn = console.warn;
    console.warn = message => warnings.push(message);
    try {
      await edit(editable, () => { editable.get('label').name = 'caption'; });
      tracker.projectionalDerivedDescriptors(descriptors.Base);
      expect(tracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
      expect(modules.get('derived.cp.js')._source).matches(/name:\s*["']caption["']/);
      expect(warnings).has.length(1);
      expect(warnings[0]).includes('Skipping an unresolvable');
    } finally { console.warn = warn; }
  });

  it('propagates structural edits made in a derived component into its own dependant', async () => {
    await setup({ grandchild: true });
    const editable = await open('Derived');
    const grandchild = await open('Grandchild');
    const before = sources();
    const badge = morph({ name: 'introduced badge', fill: Color.orange });
    instances.push(badge);
    await edit(editable, () => editable.addMorph(badge));
    const batch = editable._changeTracker.lastShadowCommandBatch;
    expect(batch.projectionalCommit).not.equals(undefined);
    expect(batch.derivedPropagation?.supported).equals(true);
    expect(batch.derivedPropagation.components.map(entry => entry.exportName)).deep.equals(['Grandchild']);
    const check = introduced => {
      const names = ['label', 'container', ...(introduced ? ['introduced badge'] : [])];
      expect(editable.submorphs.map(child => child.name)).deep.equals(names);
      expect(grandchild.submorphs.map(child => child.name)).deep.equals(names);
      expect(cold('Grandchild').submorphs.map(child => child.name)).deep.equals(names);
    };
    check(true);
    await replay(editable, before, sources(), check);
    expect(errors).deep.equals([]);
  });
  for (const withAddition of [false, true]) {
    it(`T8 removes derived subtree overrides${withAddition ? ' and nested additions' : ''} with exact cross-module replay`, async () => {
      await setup({
        baseSpec: "{ name: 'base', submorphs: [{ name: 'container', submorphs: [{ name: 'child' }] }, { name: 'other' }] }",
        derivedSpec: `{ name: 'derived', submorphs: [{ name: 'container', fill: Color.yellow, submorphs: [
          { name: 'child', opacity: 0.4 }${withAddition ? ", add({ name: 'local addition', fill: Color.blue })" : ''}
        ] }] }`
      });
      const editable = await open();
      const derived = await open('Derived');
      const before = sources();
      await edit(editable, () => editable.get('container').remove());
      expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
      expect(modules.get('derived.cp.js')._source).not.matches(/submorphs|child|local addition/);
      const check = removed => {
        for (const instance of [derived, cold('Derived')]) {
          expect(instance.submorphs.map(child => child.name)).deep.equals(removed ? ['other'] : ['container', 'other']);
          if (!removed) {
            expect(instance.get('container').fill.equals(Color.yellow)).equals(true);
            expect(instance.get('child').opacity).equals(0.4);
            expect(!!instance.get('container').getSubmorphNamed('local addition')).equals(withAddition);
          }
        }
      };
      check(true);
      await replay(editable, before, sources(), check);
      expect(errors).deep.equals([]);
    });
  }

  for (const ownName of [false, true]) {
    it(`T10b propagates a replace selector rename${ownName ? ' with an ignored own name' : ' without a name property'}`, async () => {
      await setup({
        derivedSpec: `{ name: 'derived', submorphs: [replace('label', { ${ownName ? "name: 'other', " : ''}fill: Color.blue })] }`,
        grandchild: ownName,
        grandchildSpec: "{ name: 'grandchild' }"
      });
      const editable = await open();
      const derived = ownName ? await open('Derived') : null;
      const before = sources();
      await edit(editable, () => { editable.get('label').name = 'caption'; });
      expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
      expect(modules.get('derived.cp.js')._source).matches(/replace\(["']caption["']/);
      const check = renamed => {
        const expected = renamed ? 'caption' : 'label';
        const instance = cold('Derived');
        expect(instance.submorphs[0].name).equals(expected);
        expect(instance.submorphs[0].fill.equals(Color.blue)).equals(true);
        if (derived) {
          expect(derived.submorphs[0].name).equals(expected);
          expect(cold('Grandchild').submorphs[0].name).equals(expected);
        }
      };
      check(true);
      await replay(editable, before, sources(), check);
      expect(errors).deep.equals([]);
    });
  }

  it('T10b keeps a stale D2 override dormant while unrelated edits commit exactly', async () => {
    await setup({
      derivedSpec: "{ name: 'derived', submorphs: [replace('label', { name: 'ignored', fill: Color.blue })] }",
      grandchild: true,
      grandchildSpec: "{ name: 'grandchild', submorphs: [{ name: 'ignored', fill: Color.red }] }"
    });
    const editable = await open('Grandchild');
    const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
    expect(parsed.diagnostics.some(entry => entry.severity === 'warning' && entry.targetName === 'ignored')).equals(true);
    const stale = parsed.document.root.children.filter(child => child.name === 'ignored');
    expect(stale).has.length(1);
    expect(stale[0].provenance.suppressed).equals(true);
    const before = sources();
    const originalFill = editable.fill;
    await edit(editable, () => { editable.fill = Color.orange; });
    expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    expect(modules.get('grandchild.cp.js')._source).includes("{ name: 'ignored', fill: Color.red }");
    const check = changed => {
      for (const instance of [editable, cold('Grandchild')]) {
        expect(instance.submorphs.map(child => child.name)).deep.equals(['label', 'container']);
        expect(instance.get('label').fill.equals(Color.blue)).equals(true);
        expect(instance.fill.equals(changed ? Color.orange : originalFill)).equals(true);
      }
    };
    check(true);
    await replay(editable, before, sources(), check);
    expect(errors).deep.equals([]);
  });

  for (const derivedOpen of [true, false]) {
    it(`F8b adopts a handwritten dormant override with the derived editor ${derivedOpen ? 'open' : 'closed'}`, async () => {
      await setup({ derivedSpec: "{ name: 'derived', submorphs: [{ name: 'future', fill: Color.blue }] }" });
      const base = await open();
      let derived = derivedOpen ? await open('Derived') : null;
      if (derived) {
        const parsed = derived._changeTracker.projectionalDocumentForCurrentSource();
        expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
        expect(parsed.document.root.children.find(child => child.name === 'future').provenance.suppressed).equals(true);
      }
      const before = sources();
      await edit(base, () => base.addMorph(morph({ name: 'future', fill: Color.green })));
      expect(base._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
      expect(modules.get('derived.cp.js')._source).equals(before.find(([name]) => name === 'derived.cp.js')[1]);
      const check = added => {
        for (const instance of [base, cold('Base'), cold('Derived'), derived].filter(Boolean)) {
          expect(instance.submorphs.map(child => child.name)).deep.equals(added ? ['label', 'container', 'future'] : ['label', 'container']);
        }
        if (added) {
          expect(base.get('future').fill.equals(Color.green)).equals(true);
          expect(cold('Derived').get('future').fill.equals(Color.blue)).equals(true);
          if (derived) expect(derived.get('future').fill.equals(Color.blue)).equals(true);
        }
      };
      check(true);
      await replay(base, before, sources(), check);
      const detached = derived;
      if (derived) {
        descriptors.Derived.stopEditSession();
        derived.remove();
      }
      derived = await open('Derived');
      expect(derived.get('future').fill.equals(Color.blue)).equals(true);
      await replay(base, before, sources(), added => {
        check(added);
        if (detached) {
          expect(detached.submorphs.map(child => child.name)).deep.equals(['label', 'container', 'future']);
          expect(detached.get('future').fill.equals(Color.blue)).equals(true);
        }
      });
      expect(errors).deep.equals([]);
    });
  }

  it('F8b synthesizes nested local additions and overrides through further open derivations', async () => {
    await setup({
      derivedSpec: "{ name: 'derived', submorphs: [{ name: 'future', fill: Color.blue, submorphs: [{ name: 'detail', opacity: 0.4 }, add({ name: 'local child', fill: Color.red }, 'detail')] }] }",
      grandchild: true,
      grandchildSpec: "{ name: 'grandchild', submorphs: [{ name: 'future', fill: Color.yellow }] }"
    });
    const base = await open();
    const derived = await open('Derived');
    const grandchild = await open('Grandchild');
    const before = sources();
    await edit(base, () => base.addMorph(morph({ name: 'future', fill: Color.green, submorphs: [
      { name: 'detail', fill: Color.orange, opacity: 0.9 }
    ] })));
    expect(base._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    expect(sources().slice(1)).deep.equals(before.slice(1));
    const check = added => {
      for (const [name, editable, fill] of [['Derived', derived, Color.blue], ['Grandchild', grandchild, Color.yellow]]) {
        for (const instance of [editable, cold(name)]) {
          expect(instance.submorphs.map(child => child.name)).deep.equals(added ? ['label', 'container', 'future'] : ['label', 'container']);
          if (!added) continue;
          const future = instance.get('future');
          expect(future.fill.equals(fill)).equals(true);
          expect(future.submorphs.map(child => child.name)).deep.equals(['local child', 'detail']);
          expect(future.get('detail').opacity).equals(0.4);
          expect(future.get('detail').fill.equals(Color.orange)).equals(true);
          expect(future.get('local child').fill.equals(Color.red)).equals(true);
        }
      }
    };
    check(true);
    await replay(base, before, sources(), check);
    expect(errors).deep.equals([]);
  });

  it('F8b activates a dormant part override and keeps later edits connected', async () => {
    await setup({ derivedSpec: "{ name: 'derived', submorphs: [{ name: 'future', fill: Color.blue, submorphs: [{ name: 'deep', opacity: 0.4 }] }] }" });
    const base = await open();
    const derived = await open('Derived');
    const before = sources();
    await edit(base, () => base.addMorph(part(descriptors.Ref, { name: 'future' })));
    const check = added => {
      for (const instance of [derived, cold('Derived')]) {
        expect(instance.submorphs.map(child => child.name)).deep.equals(added ? ['label', 'container', 'future'] : ['label', 'container']);
        if (!added) continue;
        instance.master.applyIfNeeded(true);
        expect(instance.get('future').fill.equals(Color.blue)).equals(true);
        expect(instance.get('future').get('deep').opacity).equals(0.4);
        expect(instance.get('future').get('deep').fill.equals(Color.red)).equals(true);
      }
    };
    check(true);
    await replay(base, before, sources(), check);
    const afterIntroduction = sources();
    await edit(derived, () => { derived.get('future').get('deep').opacity = 0.6; });
    const checkLocal = changed => {
      for (const instance of [derived, cold('Derived')]) {
        instance.master.applyIfNeeded(true);
        expect(instance.get('future').get('deep').opacity).equals(changed ? 0.6 : 0.4);
      }
    };
    checkLocal(true);
    await replay(derived, afterIntroduction, sources(), checkLocal);
    expect(errors).deep.equals([]);
  });

  it('F8b compensates a synthesis failure without changing source, caches or prior history', async () => {
    await setup({ derivedSpec: "{ name: 'derived', submorphs: [{ name: 'future', fill: Color.blue }] }" });
    const base = await open();
    const derived = await open('Derived');
    const initial = sources();
    await edit(base, () => { base.fill = Color.orange; });
    const before = sources();
    const manager = base.env.undoManager;
    const undos = manager.undos.slice();
    const policies = ['Base', 'Derived'].map(name => descriptors[name].stylePolicy.spec);
    const tracker = base._changeTracker;
    const evaluate = tracker.evaluateProjectionalPolicy;
    tracker.evaluateProjectionalPolicy = function (entry, ...args) {
      if (entry.descriptor === descriptors.Derived) throw new Error('injected dormant synthesis failure');
      return evaluate.call(this, entry, ...args);
    };
    const introduced = morph({ name: 'future', fill: Color.green });
    instances.push(introduced);
    let rejection;
    try { rejection = await edit(base, () => base.addMorph(introduced), true); }
    finally { tracker.evaluateProjectionalPolicy = evaluate; }
    expect(rejection.message).includes('injected dormant synthesis failure');
    expect(errors).has.length(1);
    expect(errors[0]).includes('injected dormant synthesis failure');
    expect(sources()).deep.equals(before);
    expect(introduced.owner).equals(null);
    expect(manager.undos).deep.equals(undos);
    expect(manager.undoInProgress).equals(null);
    for (const [index, name] of ['Base', 'Derived'].entries()) {
      expect(descriptors[name].stylePolicy.spec).equals(policies[index]);
      expect(cold(name).submorphs.map(child => child.name)).deep.equals(['label', 'container']);
    }
    expect(derived.submorphs.map(child => child.name)).deep.equals(['label', 'container']);
    manager.undo();
    await processed(base);
    expect(sources()).deep.equals(initial);
    manager.redo();
    await processed(base);
    expect(sources()).deep.equals(before);
  });

  it('T10b applies a D2 override to the effective replacement name without duplicates', async () => {
    await setup({
      derivedSpec: "{ name: 'derived', submorphs: [replace('label', { name: 'ignored', fill: Color.blue })] }",
      grandchild: true
    });
    const editable = await open('Grandchild');
    expect(editable.submorphs.map(child => child.name)).deep.equals(['label', 'container']);
    expect(editable.get('label').fill.equals(Color.blue)).equals(true);
    const before = sources();
    await edit(editable, () => { editable.get('label').opacity = 0.6; });
    expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    const check = changed => {
      for (const instance of [editable, cold('Grandchild')]) {
        expect(instance.submorphs.map(child => child.name)).deep.equals(['label', 'container']);
        expect(instance.get('label').opacity).equals(changed ? 0.6 : 0.4);
        expect(instance.get('label').fill.equals(Color.blue)).equals(true);
      }
      const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
      expect(parsed.supported).equals(true);
      expect(parsed.document.root.children.some(child => child.provenance.suppressed)).equals(false);
    };
    check(true);
    await replay(editable, before, sources(), check);
    expect(errors).deep.equals([]);
  });

  it('T8 carries a derived override and its additions across a base move', async () => {
    await setup({
      baseSpec: "{ name: 'base', submorphs: [{ name: 'container', submorphs: [{ name: 'child' }] }, { name: 'other' }] }",
      derivedSpec: "{ name: 'derived', submorphs: [{ name: 'container', submorphs: [{ name: 'child', fill: Color.red, submorphs: [add({ name: 'local addition' })] }] }] }"
    });
    const editable = await open();
    const derived = await open('Derived');
    const before = sources();
    await edit(editable, () => editable.get('other').addMorph(editable.get('child')));
    expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    expect(modules.get('derived.cp.js')._source).not.matches(/name:\s*["']container["']/);
    const check = moved => {
      for (const instance of [derived, cold('Derived')]) {
        const child = instance.get('child');
        expect(child.owner.name).equals(moved ? 'other' : 'container');
        expect(child.fill.equals(Color.red)).equals(true);
        expect(child.submorphs.map(m => m.name)).deep.equals(['local addition']);
      }
    };
    check(true);
    await replay(editable, before, sources(), check);
    expect(errors).deep.equals([]);
  });

  for (const kind of ['introduce', 'remove', 'move', 'rename']) {
    it(`T8 replays ${kind} into a reopened derived editable and skips closed sessions`, async () => {
      await setup();
      const editable = await open();
      const detached = await open('Derived');
      const before = sources();
      await edit(editable, () => {
        if (kind === 'introduce') editable.addMorph(morph({ name: 'badge' }));
        if (kind === 'remove') editable.get('label').remove();
        if (kind === 'move') editable.get('container').addMorph(editable.get('label'));
        if (kind === 'rename') editable.get('label').name = 'caption';
      });
      const after = sources();
      expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
      const detachedNames = [];
      detached.withAllSubmorphsDo(m => detachedNames.push([m, m.name, m.owner]));
      descriptors.Derived.stopEditSession();
      detached.remove();
      const reopened = await open('Derived');
      const check = changed => {
        const instance = cold('Derived');
        expect(reopened.submorphs.map(m => m.name)).deep.equals(instance.submorphs.map(m => m.name));
        expect(reopened.get('container').submorphs.map(m => m.name)).deep.equals(instance.get('container').submorphs.map(m => m.name));
        if (kind === 'rename') expect(reopened.submorphs[0].name).equals(changed ? 'caption' : 'label');
        if (kind === 'remove') expect(reopened.submorphs.map(m => m.name)).deep.equals(changed ? ['container'] : ['label', 'container']);
        if (kind === 'introduce') expect(reopened.submorphs.map(m => m.name)).deep.equals(changed ? ['label', 'container', 'badge'] : ['label', 'container']);
        if (kind === 'move') expect(reopened.get('label').owner).equals(changed ? reopened.get('container') : reopened);
        for (const [m, name, owner] of detachedNames) {
          expect(m.name).equals(name);
          if (m !== detached) expect(m.owner).equals(owner);
        }
      };
      await replay(editable, before, after, check);
      descriptors.Derived.stopEditSession();
      reopened.remove();
      await replay(editable, before, after, () => {});
      expect(errors).deep.equals([]);
    });
  }

  it('T8 removes grandchild overrides when a derived parent suppresses an inherited node', async () => {
    await setup({ grandchild: true });
    const editable = await open('Derived');
    const grandchild = await open('Grandchild');
    const before = sources();
    await edit(editable, () => editable.get('label').remove());
    expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    expect(modules.get('grandchild.cp.js')._source).not.includes('submorphs');
    const check = removed => {
      for (const instance of [grandchild, cold('Grandchild')]) {
        expect(instance.submorphs.map(child => child.name)).deep.equals(removed ? ['container'] : ['label', 'container']);
        if (!removed) expect(instance.get('label').opacity).equals(0.4);
      }
      expect(modules.get('base.cp.js')._source).equals(before.find(([name]) => name === 'base.cp.js')[1]);
    };
    check(true);
    await replay(editable, before, sources(), check);
    expect(errors).deep.equals([]);
  });

  it('T8 legacy 775 allocates a base introduction name around derived additions', async () => {
    await setup({ derivedSpec: "{ name: 'derived', submorphs: [add({ name: 'linus', fill: Color.blue }), add({ name: 'linus_1' })] }" });
    const editable = await open();
    const derived = await open('Derived');
    const before = sources();
    const introduced = morph({ name: 'linus', fill: Color.green });
    await edit(editable, () => editable.addMorph(introduced));
    expect(editable._changeTracker.lastShadowCommandBatch.projectionalCommit).not.equals(undefined);
    expect(introduced.name).equals('linus_2');
    const check = added => {
      expect(editable.submorphs.map(m => m.name)).deep.equals(['label', 'container', ...(added ? ['linus_2'] : [])]);
      for (const instance of [derived, cold('Derived')]) {
        expect(instance.get('linus').fill.equals(Color.blue)).equals(true);
        expect(!!instance.getSubmorphNamed('linus_2')).equals(added);
      }
    };
    check(true);
    await replay(editable, before, sources(), check);
  });

});
