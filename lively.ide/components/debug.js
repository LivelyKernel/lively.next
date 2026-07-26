import { arr, obj } from 'lively.lang';
import { Color, pt } from 'lively.graphics';
import { add, morph, part, TilingLayout } from 'lively.morphic';
import { module } from 'lively.modules/index.js';
import { parse } from 'lively.ast';
import { SeededRandom } from './reconciliation/fuzz-random.js';

export { SeededRandom } from './reconciliation/fuzz-random.js';
export {
  ComponentProjectionFuzzer,
  runComponentProjectionFuzz
} from './reconciliation/component-projection-fuzzer.js';

/**
 * Deterministic stress testing for component-to-source reconciliation.
 *
 * Every operation is applied through the component change tracker and the
 * resulting source is parsed only after the tracker has finished. Failures
 * retain the seed and the complete action trace so they can be replayed.
 */

export const DEFAULT_RECONCILIATION_FUZZ_SEED = 0xC0FFEE;

export const RECONCILIATION_FUZZ_OPERATIONS = [
  'addPlainMorph',
  'addPart',
  'addModelPart',
  'addPartWithNestedAddition',
  'removeMorph',
  'reintroduceMorph',
  'reparentMorph',
  'reparentInheritedMorph',
  'renameMorph',
  'reorderMorph',
  'setProperties',
  'batchPropertyAndStructure',
  'resetProperty',
  'changeText',
  'changeRichText',
  'updateEmbeddedMorph',
  'changeLayout',
  'changeLayoutPolicies',
  'changeMaster',
  'addNameCollision',
  'addScopedNameCollision'
];

export const KNOWN_BROKEN_RECONCILIATION_FUZZ_OPERATIONS = [];

export const DEFAULT_RECONCILIATION_FUZZ_OPERATIONS = RECONCILIATION_FUZZ_OPERATIONS.filter(
  operation => !KNOWN_BROKEN_RECONCILIATION_FUZZ_OPERATIONS.includes(operation)
);

const defaultBaseModuleId = 'local://lively-object-modules/Test/component-reconciliation-fuzz-base.cp.js';
const defaultSubjectModuleId = 'local://lively-object-modules/Test/component-reconciliation-fuzz-subject.cp.js';

export const reconciliationFuzzBaseSource = `
import { component, ComponentDescriptor, part, ViewModel } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
import { Text } from 'lively.morphic';

component.DescriptorClass = ComponentDescriptor;

class FuzzViewModel extends ViewModel {
  static get properties () {
    return { label: { defaultValue: 'base' } };
  }
}

const Leaf = component({
  name: 'Fuzz Leaf',
  fill: Color.purple,
  submorphs: [{
    name: 'leaf child',
    fill: Color.orange
  }]
});

const Base = component({
  name: 'Fuzz Base',
  fill: Color.red,
  extent: pt(180, 120),
  submorphs: [{
    type: Text,
    name: 'fuzz text',
    textString: 'initial text',
    extent: pt(100, 30),
    fixedWidth: true,
    fixedHeight: true
  }, part(Leaf, { name: 'fuzz leaf part' })]
});

const ModelPart = component({
  name: 'Fuzz Model Part',
  defaultViewModel: FuzzViewModel,
  viewModel: { label: 'base' },
  fill: Color.blue
});

export { Base, Leaf, ModelPart };
`;

export function reconciliationFuzzSubjectSource (baseModuleId = defaultBaseModuleId) {
  return `
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color } from 'lively.graphics';
import { Base as AliasedBase, Leaf as AliasedLeaf, ModelPart } from '${baseModuleId}';

component.DescriptorClass = InteractiveComponentDescriptor;

const Subject = component(AliasedBase, {
  name: 'Fuzz Subject',
  submorphs: [{
    name: 'fuzz text',
    fill: Color.green
  }, {
    name: 'fuzz leaf part',
    submorphs: [{
      name: 'leaf child',
      borderWidth: 2
    }]
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { Subject };
`;
}

function componentName (component) {
  return component?.[Symbol.for('lively-module-meta')]?.exportedName || component?.name;
}

function printableValue (value) {
  if (value === null || typeof value !== 'object') return String(value);
  if (value.isPoint || value.isColor) return value.toString();
  if (value.isLayout) return value.constructor.name;
  return value.constructor?.name || 'Object';
}

export class ReconciliationFuzzError extends Error {
  constructor (message, details, cause) {
    const trace = JSON.stringify(details.actions, null, 2);
    const fullMessage = `${message}\nseed: ${details.seed}\nstep: ${details.step}\noperation: ${details.operation}\ntrace: ${trace}`;
    super(fullMessage);
    this.name = 'ReconciliationFuzzError';
    this.message = fullMessage;
    this.cause = cause;
    Object.assign(this, details);
  }
}

export class ReconciliationFuzzer {
  constructor ({
    component,
    componentDescriptor,
    components,
    subjectModule,
    seed = DEFAULT_RECONCILIATION_FUZZ_SEED,
    operations = DEFAULT_RECONCILIATION_FUZZ_OPERATIONS,
    validateSource,
    maxSourceGrowthPerStep = 5000
  }) {
    this.component = component;
    this.componentDescriptor = componentDescriptor;
    this.components = components;
    this.subjectModule = subjectModule;
    this.seed = seed;
    this.random = new SeededRandom(seed);
    this.operations = operations.slice();
    this.operationQueue = [];
    this.validateSource = validateSource;
    this.maxSourceGrowthPerStep = maxSourceGrowthPerStep;
    this.actions = [];
    this.removedMorphs = [];
    this.propertyHistory = [];
    this.nameCounter = 0;
    this.initialSourceLength = null;
  }

  allMorphs () {
    return this.component.withAllSubmorphsDo(morph => morph);
  }

  isEmbeddedTextMorph (morph) {
    let current = morph;
    while (current && current !== this.component) {
      const owner = current.owner;
      if (owner?.isText && owner.textAndAttributes?.includes(current)) return true;
      current = owner;
    }
    return false;
  }

  componentMorphs () {
    return this.allMorphs().filter(morph => !this.isEmbeddedTextMorph(morph));
  }

  isAttached (aMorph) {
    return aMorph === this.component || this.allMorphs().includes(aMorph);
  }

  pathOf (aMorph) {
    if (aMorph === this.component) return [];
    const path = [];
    let current = aMorph;
    while (current && current !== this.component) {
      path.unshift(current.name);
      current = current.owner;
    }
    return path;
  }

  nextName (prefix) {
    const suffix = this.random.pick(['', " 'quoted'", ' "double"', ' \\backslash']);
    return `${prefix} ${++this.nameCounter}${suffix}`;
  }

  randomOwner () {
    return this.random.pick(this.componentMorphs().filter(morph => !morph.isText));
  }

  insertionPointFor (owner) {
    if (!owner.submorphs.length || this.random.boolean()) return null;
    return this.random.pick(owner.submorphs);
  }

  reconcile (callback) {
    return this.component.withMetaDo({ reconcileChanges: true }, callback);
  }

  nextOperation () {
    if (!this.operationQueue.length) this.operationQueue = this.random.shuffle(this.operations);
    return this.operationQueue.shift();
  }

  chooseAndPerformOperation () {
    for (let attempts = 0; attempts < this.operations.length; attempts++) {
      const operation = this.nextOperation();
      const action = this[operation]();
      if (action) return { operation, action };
    }
    throw new Error('No reconciliation fuzz operation is currently applicable');
  }

  addPlainMorph () {
    const owner = this.randomOwner();
    if (!owner) return null;
    const name = this.nextName('plain');
    const submorphs = this.random.boolean(0.4)
      ? [morph({ name: this.nextName('nested'), fill: Color.orange })]
      : [];
    const addedMorph = morph({
      name,
      fill: this.random.pick([Color.cyan, Color.orange, Color.purple]),
      extent: pt(this.random.integer(20, 140), this.random.integer(20, 140)),
      submorphs
    });
    const before = this.insertionPointFor(owner);
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => owner.addMorph(addedMorph, before));
    return { kind: 'addPlainMorph', ownerPath, name, before: before?.name || null, nested: submorphs.length > 0 };
  }

  addPart () {
    const owner = this.component;
    const descriptor = this.random.pick([this.components.base, this.components.nested]);
    if (!owner || !descriptor) return null;
    const name = this.nextName('part');
    const addedPart = part(descriptor, { name });
    const before = this.insertionPointFor(owner);
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => owner.addMorph(addedPart, before));
    return {
      kind: 'addPart',
      ownerPath,
      component: componentName(descriptor),
      name,
      before: before?.name || null
    };
  }

  addModelPart () {
    const owner = this.component;
    const descriptor = this.components.model;
    if (!owner || !descriptor) return null;
    const name = this.nextName('model part');
    const viewModel = {
      label: this.nextName('model'),
      flags: [true, false, this.random.integer(0, 10)],
      nested: { enabled: this.random.boolean() }
    };
    const addedPart = part(descriptor, { name, viewModel });
    const before = this.insertionPointFor(owner);
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => owner.addMorph(addedPart, before));
    return {
      kind: 'addModelPart',
      ownerPath,
      component: componentName(descriptor),
      name,
      before: before?.name || null,
      viewModel
    };
  }

  addPartWithNestedAddition () {
    const owner = this.component;
    const descriptor = this.components.nested;
    if (!owner || !descriptor) return null;
    const name = this.nextName('nested part');
    const nestedName = this.nextName('part addition');
    const addedPart = part(descriptor, {
      name,
      submorphs: [add({ name: nestedName, fill: Color.cyan })]
    });
    const before = this.insertionPointFor(owner);
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => owner.addMorph(addedPart, before));
    return {
      kind: 'addPartWithNestedAddition',
      ownerPath,
      component: componentName(descriptor),
      name,
      nestedName,
      before: before?.name || null
    };
  }

  removeMorph () {
    const candidates = this.componentMorphs()
      .filter(morph => morph !== this.component && !morph.owner?.isText);
    const target = this.random.pick(candidates);
    if (!target) return null;
    const path = this.pathOf(target);
    this.reconcile(() => target.remove());
    this.removedMorphs.push({ morph: target, path });
    return { kind: 'removeMorph', path };
  }

  reintroduceMorph () {
    if (!this.removedMorphs.length) return null;
    const removedIndex = this.random.integer(0, this.removedMorphs.length);
    const [{ morph: removedMorph, path: previousPath }] = this.removedMorphs.splice(removedIndex, 1);
    const owner = this.randomOwner();
    if (!owner) return null;
    if (this.random.boolean()) removedMorph.fill = this.random.pick([Color.green, Color.orange, Color.purple]);
    const before = this.insertionPointFor(owner);
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => owner.addMorph(removedMorph, before));
    return {
      kind: 'reintroduceMorph',
      previousPath,
      ownerPath,
      name: removedMorph.name,
      before: before?.name || null
    };
  }

  reparentMorphMatching (kind, matchesTarget) {
    const morphs = this.componentMorphs();
    const targets = morphs.filter(target =>
      target !== this.component &&
      matchesTarget(target) &&
      !target.owner?.isText
    );
    const target = this.random.pick(targets.filter(candidate => morphs.some(owner => {
      if (owner.isText || owner === candidate.owner) return false;
      for (let current = owner; current; current = current.owner) {
        if (current === candidate) return false;
      }
      return true;
    })));
    if (!target) return null;

    const owners = morphs.filter(owner => {
      if (owner.isText || owner === target.owner) return false;
      for (let current = owner; current; current = current.owner) {
        if (current === target) return false;
      }
      return true;
    });
    const newOwner = this.random.pick(owners);
    if (!newOwner) return null;

    const previousPath = this.pathOf(target);
    const newOwnerPath = this.pathOf(newOwner);
    const before = this.insertionPointFor(newOwner);
    this.reconcile(() => newOwner.addMorph(target, before));
    return {
      kind,
      previousPath,
      newOwnerPath,
      name: target.name,
      before: before?.name || null
    };
  }

  reparentMorph () {
    return this.reparentMorphMatching('reparentMorph', target => target.__wasAddedToDerived__);
  }

  reparentInheritedMorph () {
    return this.reparentMorphMatching('reparentInheritedMorph', target => !target.__wasAddedToDerived__);
  }

  renameMorph () {
    const candidates = this.componentMorphs().filter(morph =>
      morph !== this.component && morph.__wasAddedToDerived__
    );
    const target = this.random.pick(candidates);
    if (!target) return null;
    const path = this.pathOf(target);
    const oldName = target.name;
    const newName = this.nextName('renamed');
    this.reconcile(() => { target.name = newName; });
    return { kind: 'renameMorph', path, oldName, newName };
  }

  reorderMorph () {
    const owners = this.componentMorphs().filter(morph =>
      !morph.isText &&
      morph.submorphs.length > 1 &&
      morph.submorphs.some(submorph => submorph.__wasAddedToDerived__ && !submorph.master)
    );
    const owner = this.random.pick(owners);
    if (!owner) return null;
    const ownerPath = this.pathOf(owner);
    const child = this.random.pick(owner.submorphs.filter(submorph =>
      submorph.__wasAddedToDerived__ && !submorph.master
    ));
    let before = null;
    if (owner.submorphs.indexOf(child) === owner.submorphs.length - 1) {
      before = owner.submorphs[0];
    }
    this.reconcile(() => owner.addMorph(child, before));
    return { kind: 'reorderMorph', ownerPath, name: child.name, before: before?.name || null };
  }

  valueForProperty (property) {
    switch (property) {
      case 'fill': return this.random.pick([Color.red, Color.green, Color.blue, Color.orange, Color.transparent]);
      case 'borderWidth': return this.random.integer(0, 20);
      case 'extent': return pt(this.random.integer(20, 200), this.random.integer(20, 200));
      case 'position': return pt(this.random.integer(-100, 300), this.random.integer(-100, 300));
      case 'scale': return pt(
        this.random.integer(2, 21) / 10,
        this.random.integer(2, 21) / 10
      );
      case 'opacity': return this.random.integer(1, 11) / 10;
      case 'visible': return this.random.boolean();
      case 'rotation': return this.random.integer(-6, 7) / 4;
      case 'tooltip': return this.nextName('tooltip');
    }
  }

  setProperties () {
    const propertyNames = [
      'fill',
      'borderWidth',
      'extent',
      'position',
      'scale',
      'opacity',
      'visible',
      'rotation',
      'tooltip'
    ];
    const propertiesFor = morph => propertyNames.filter(property =>
      morph.styleProperties.includes(property) &&
      !(property === 'position' && (
        morph === this.component ||
        this.component._changeTracker?.isPositionedByLayout(morph)
      ))
    );
    const target = this.random.pick(this.componentMorphs().filter(morph =>
      propertiesFor(morph).length > 0
    ));
    if (!target) return null;
    const selectedProperties = this.random.shuffle(propertiesFor(target))
      .slice(0, this.random.boolean() ? 1 : 2);
    const changes = selectedProperties.map(property => ({
      property,
      previous: target[property],
      value: this.valueForProperty(property)
    }));
    const path = this.pathOf(target);
    this.reconcile(() => {
      for (const change of changes) target[change.property] = change.value;
    });
    this.propertyHistory.push(...changes.map(change => ({ target, ...change })));
    return {
      kind: 'setProperties',
      path,
      changes: changes.map(({ property, value }) => ({ property, value: printableValue(value) }))
    };
  }

  batchPropertyAndStructure () {
    const owner = this.randomOwner();
    if (!owner) return null;
    const name = this.nextName('batched child');
    const addedMorph = morph({
      name,
      fill: this.random.pick([Color.cyan, Color.orange, Color.purple]),
      position: this.valueForProperty('position'),
      extent: this.valueForProperty('extent')
    });
    const property = this.random.pick(['fill', 'opacity', 'rotation']);
    const previous = owner[property];
    const value = this.valueForProperty(property);
    const before = this.insertionPointFor(owner);
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => {
      owner[property] = value;
      owner.addMorph(addedMorph, before);
    });
    this.propertyHistory.push({ target: owner, property, previous, value });
    return {
      kind: 'batchPropertyAndStructure',
      ownerPath,
      name,
      before: before?.name || null,
      property,
      value: printableValue(value)
    };
  }

  resetProperty () {
    const candidates = this.propertyHistory.filter(change =>
      this.isAttached(change.target) && !obj.equals(change.target[change.property], change.previous)
    );
    const change = this.random.pick(candidates);
    if (!change) return null;
    arr.remove(this.propertyHistory, change);
    const path = this.pathOf(change.target);
    this.reconcile(() => { change.target[change.property] = change.previous; });
    return {
      kind: 'resetProperty',
      path,
      property: change.property,
      value: printableValue(change.previous)
    };
  }

  changeText () {
    const target = this.random.pick(this.componentMorphs().filter(morph => morph.isText));
    if (!target) return null;
    const path = this.pathOf(target);
    const text = this.nextName('text');
    this.reconcile(() => { target.textAndAttributes = [text, null]; });
    return { kind: 'changeText', path, text };
  }

  changeRichText () {
    const target = this.random.pick(this.componentMorphs().filter(morph => morph.isText));
    if (!target) return null;
    const path = this.pathOf(target);
    const text = this.nextName('rich text');
    const embeddedName = this.nextName('embedded');
    const embeddedMorph = morph({
      name: embeddedName,
      fill: this.random.pick([Color.cyan, Color.orange, Color.purple]),
      extent: pt(this.random.integer(8, 40), this.random.integer(8, 40))
    });
    const attributes = {
      fontWeight: this.random.pick(['bold', 'normal']),
      textColor: this.random.pick([Color.red, Color.green, Color.blue])
    };
    this.reconcile(() => {
      target.textAndAttributes = [
        `${text} before `, attributes,
        embeddedMorph, null,
        ' after', null
      ];
    });
    return { kind: 'changeRichText', path, text, embeddedName };
  }

  updateEmbeddedMorph () {
    const candidates = this.componentMorphs()
      .filter(morph => morph.isText)
      .flatMap(textMorph => textMorph.textAndAttributes
        .filter(value => value?.isMorph)
        .map(embeddedMorph => ({ textMorph, embeddedMorph })));
    const candidate = this.random.pick(candidates);
    if (!candidate) return null;
    const { textMorph, embeddedMorph } = candidate;
    const path = this.pathOf(textMorph);
    const fill = this.random.pick([Color.red, Color.green, Color.blue, Color.orange]);
    const replacement = morph({
      ...embeddedMorph.spec(),
      name: embeddedMorph.name,
      fill
    });
    this.reconcile(() => {
      textMorph.textAndAttributes = textMorph.textAndAttributes
        .map(value => value === embeddedMorph ? replacement : value);
    });
    return {
      kind: 'updateEmbeddedMorph',
      path,
      name: embeddedMorph.name,
      fill: printableValue(fill)
    };
  }

  changeLayout () {
    const target = this.random.pick(this.componentMorphs().filter(morph =>
      !morph.isText && morph.styleProperties.includes('layout')
    ));
    if (!target) return null;
    const path = this.pathOf(target);
    const spacing = this.random.integer(0, 20);
    const previous = target.layout;
    const layout = new TilingLayout({ spacing, renderViaCSS: false });
    this.reconcile(() => { target.layout = layout; });
    this.propertyHistory.push({ target, property: 'layout', previous, value: layout });
    return { kind: 'changeLayout', path, spacing };
  }

  changeLayoutPolicies () {
    const target = this.random.pick(this.componentMorphs().filter(morph =>
      !morph.isText &&
      morph.styleProperties.includes('layout') &&
      morph.submorphs.length > 0
    ));
    if (!target) return null;
    const path = this.pathOf(target);
    const spacing = this.random.integer(0, 20);
    const resizePolicies = target.submorphs.map(submorph => [
      submorph.name,
      {
        width: this.random.pick(['fixed', 'fill']),
        height: this.random.pick(['fixed', 'fill'])
      }
    ]);
    const previous = target.layout;
    const layout = new TilingLayout({
      spacing,
      resizePolicies,
      orderByIndex: this.random.boolean(),
      wrapSubmorphs: this.random.boolean(),
      renderViaCSS: false
    });
    this.reconcile(() => { target.layout = layout; });
    this.propertyHistory.push({ target, property: 'layout', previous, value: layout });
    return {
      kind: 'changeLayoutPolicies',
      path,
      spacing,
      resizePolicies
    };
  }

  changeMaster () {
    const target = this.random.pick(this.componentMorphs().filter(morph => morph.master));
    const descriptor = this.random.pick(this.components);
    if (!target || !descriptor) return null;
    const path = this.pathOf(target);
    const state = this.random.pick(['hover', 'click']);
    const policy = target.master.copy();
    policy.applyConfiguration({ ...(policy.getConfig() || {}), [state]: descriptor });
    policy.attach(target);
    this.reconcile(() => { target.setProperty('master', policy); });
    return { kind: 'changeMaster', path, state, component: componentName(descriptor) };
  }

  addNameCollision () {
    const owner = this.component;
    if (!owner) return null;
    const requestedName = this.nextName('collision');
    const first = morph({ name: requestedName, fill: Color.cyan });
    const second = morph({ name: requestedName, fill: Color.orange });
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => {
      owner.addMorph(first);
      owner.addMorph(second);
    });
    return { kind: 'addNameCollision', ownerPath, requestedName };
  }

  addScopedNameCollision () {
    const owner = this.component;
    const descriptor = this.components.nested;
    if (!owner || !descriptor) return null;
    const requestedName = this.nextName('scoped collision');
    const firstScopeName = this.nextName('collision scope');
    const secondScopeName = this.nextName('collision scope');
    const firstPart = part(descriptor, {
      name: firstScopeName,
      submorphs: [add({ name: requestedName, fill: Color.cyan })]
    });
    const secondPart = part(descriptor, {
      name: secondScopeName,
      submorphs: [add({ name: requestedName, fill: Color.orange })]
    });
    const ownerPath = this.pathOf(owner);
    this.reconcile(() => {
      owner.addMorph(firstPart);
      owner.addMorph(secondPart);
    });
    return {
      kind: 'addScopedNameCollision',
      ownerPath,
      component: componentName(descriptor),
      requestedName,
      scopeNames: [firstScopeName, secondScopeName]
    };
  }

  fuzzError (error, step, operation, action, sourceBefore, sourceAfter) {
    return new ReconciliationFuzzError(
      `Reconciliation fuzzing failed: ${error.message}`,
      {
        seed: this.seed,
        step,
        operation,
        action,
        actions: [...this.actions, { step, operation, ...action }],
        sourceBefore,
        sourceAfter
      },
      error
    );
  }

  async step () {
    const step = this.actions.length;
    const sourceBefore = await this.subjectModule.source();
    let operation = 'selectOperation';
    let action = {};
    try {
      ({ operation, action } = this.chooseAndPerformOperation());
      await this.component._changeTracker.onceChangesProcessed();
      const sourceAfter = await this.subjectModule.source();
      parse(sourceAfter);
      const sourceLimit = this.initialSourceLength + this.maxSourceGrowthPerStep * (step + 1);
      if (sourceAfter.length > sourceLimit) {
        throw new Error(`Generated source grew to ${sourceAfter.length} characters (limit: ${sourceLimit})`);
      }
      if (this.validateSource) {
        const styleProperties = this.propertyHistory
          .filter(change => change.property !== 'layout' && this.isAttached(change.target))
          .map(change => ({ path: this.pathOf(change.target), property: change.property }));
        await this.validateSource(sourceAfter, {
          seed: this.seed,
          step,
          operation,
          action,
          styleProperties,
          component: this.component,
          componentDescriptor: this.componentDescriptor
        });
      }
      const recordedAction = {
        step,
        operation,
        ...action,
        sourceLengthBefore: sourceBefore.length,
        sourceLengthAfter: sourceAfter.length
      };
      this.actions.push(recordedAction);
      return recordedAction;
    } catch (error) {
      let sourceAfter;
      try { sourceAfter = await this.subjectModule.source(); } catch (sourceError) { sourceAfter = String(sourceError); }
      throw this.fuzzError(error, step, operation, action, sourceBefore, sourceAfter);
    }
  }

  async run (steps = 100) {
    if (!Number.isInteger(steps) || steps < 0) throw new Error(`Invalid reconciliation fuzz step count: ${steps}`);
    this.initialSourceLength = (await this.subjectModule.source()).length;
    while (this.actions.length < steps) await this.step();
    return {
      seed: this.seed,
      steps,
      actions: this.actions.slice(),
      source: await this.subjectModule.source()
    };
  }
}

async function resetModuleSource (targetModule, source) {
  await targetModule.reset();
  if (targetModule.format() === 'global') {
    await targetModule.changeSource('', { moduleId: targetModule.id });
    await targetModule.reload();
    await targetModule.setFormat('register');
    await targetModule.changeSource(source, { moduleId: targetModule.id });
    await targetModule.reload();
  } else {
    await targetModule.changeSource(source, { moduleId: targetModule.id });
  }
}

export async function createReconciliationFuzzer ({
  baseModuleId = defaultBaseModuleId,
  subjectModuleId = defaultSubjectModuleId,
  baseSource = reconciliationFuzzBaseSource,
  subjectSource = reconciliationFuzzSubjectSource(baseModuleId),
  resetSource = true,
  ...options
} = {}) {
  const baseModule = module(baseModuleId);
  const subjectModule = module(subjectModuleId);
  if (resetSource) {
    await resetModuleSource(baseModule, baseSource);
    await resetModuleSource(subjectModule, subjectSource);
  }

  const { Base, Leaf, ModelPart } = await baseModule.load();
  const { Subject } = await subjectModule.load();
  for (const descriptor of [Base, Leaf, ModelPart, Subject]) descriptor.previouslyRemovedMorphs = new WeakMap();
  const component = await Subject.edit();

  return new ReconciliationFuzzer({
    component,
    componentDescriptor: Subject,
    components: Object.assign([Base, Leaf, ModelPart], {
      base: Base,
      nested: Leaf,
      model: ModelPart
    }),
    subjectModule,
    ...options
  });
}

/**
 * Manual entry point for a workspace:
 *   result = await runReconciliationFuzz({ steps: 1000, seed: 'my-seed' })
 */
export async function runReconciliationFuzz ({ steps = 100, ...options } = {}) {
  const fuzzer = await createReconciliationFuzzer(options);
  return fuzzer.run(steps);
}
