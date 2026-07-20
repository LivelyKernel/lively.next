/* global describe, it, afterEach, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { parse } from 'lively.ast';
import {
  createReconciliationFuzzer,
  DEFAULT_RECONCILIATION_FUZZ_OPERATIONS,
  reconciliationFuzzBaseSource,
  reconciliationFuzzSubjectSource,
  SeededRandom
} from '../../components/debug.js';

const testRoot = 'local://component-reconciliation-fuzz-test/';
let loadedModules = [];

function componentStructureSnapshot (component, styleProperties = []) {
  const stylePropertiesByPath = new Map();
  for (const { path, property } of styleProperties) {
    const pathKey = JSON.stringify(path);
    const properties = stylePropertiesByPath.get(pathKey) || new Set();
    properties.add(property);
    stylePropertiesByPath.set(pathKey, properties);
  }
  const snapshotStyleValue = value => {
    if (value?.isColor || value?.isPoint) return value.toString();
    if (Array.isArray(value)) return value.map(snapshotStyleValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value)
        .map(([key, propertyValue]) => [key, snapshotStyleValue(propertyValue)]));
    }
    return value;
  };
  const snapshotMorph = (morph, isRoot = false, path = []) => {
    const submorphs = morph.submorphs
      .map(submorph => snapshotMorph(submorph, false, [...path, submorph.name]));
    const comparedStyleProperties = stylePropertiesByPath.get(JSON.stringify(path)) || [];
    return {
      type: morph.constructor.name,
      // The edit proxy intentionally gives the root a canonical editor name
      // and presentation; parity starts at the component's managed children.
      // Inline master configurations likewise are not exposed consistently on
      // cold instances and are asserted at the source level below.
      name: isRoot ? null : morph.name,
      text: morph.isText ? morph.textString : null,
      style: Object.fromEntries([...comparedStyleProperties]
        .map(property => [property, snapshotStyleValue(morph[property])])),
      layout: morph.layout
        ? { type: morph.layout.constructor.name, spacing: morph.layout.spacing }
        : null,
      viewModel: morph.viewModel ? { label: morph.viewModel.label } : null,
      submorphs
    };
  };
  return snapshotMorph(component, true);
}

function firstSnapshotDifference (coldValue, editableValue, path = []) {
  if (Object.is(coldValue, editableValue)) return null;
  if (!coldValue || !editableValue ||
      typeof coldValue !== 'object' || typeof editableValue !== 'object') {
    return { path, coldValue, editableValue };
  }
  const keys = new Set([...Object.keys(coldValue), ...Object.keys(editableValue)]);
  for (const key of keys) {
    const difference = firstSnapshotDifference(coldValue[key], editableValue[key], [...path, key]);
    if (difference) return difference;
  }
  return null;
}

async function cleanup () {
  for (const loadedModule of loadedModules.reverse()) {
    await loadedModule.unload({ forgetDeps: false });
  }
  loadedModules = [];
  await resource(testRoot).remove();
}

async function prepareFuzzer (seed, steps) {
  const projectName = `seed-${seed}`;
  const projectRoot = `${testRoot}${projectName}/`;
  const baseModuleId = `${projectRoot}base.cp.js`;
  const subjectModuleId = `${projectRoot}subject.cp.js`;
  const subjectSource = reconciliationFuzzSubjectSource(baseModuleId);

  await createFiles(testRoot, {
    [projectName]: {
      'package.json': JSON.stringify({ name: `reconciliation-fuzz-${seed}`, main: 'subject.cp.js' }),
      'base.cp.js': reconciliationFuzzBaseSource,
      'subject.cp.js': subjectSource
    }
  });

  const baseModule = module(System, baseModuleId);
  const subjectModule = module(System, subjectModuleId);
  loadedModules.push(baseModule, subjectModule);

  return createReconciliationFuzzer({
    baseModuleId,
    subjectModuleId,
    resetSource: false,
    seed,
    validateSource: async (source, { step, operation, action, component, styleProperties }) => {
      if (operation === 'changeMaster') {
        expect(source).to.match(new RegExp(`${action.state}:\\s*${action.component}`));
      }
      if ((step + 1) % 7 !== 0 && step !== steps - 1) return;
      parse(source);
      const validationModuleId = `${projectRoot}validation-${step}.cp.js`;
      const validationResource = resource(validationModuleId);
      const validationModule = module(System, validationModuleId);
      try {
        await validationResource.write(source);
        const { Subject } = await validationModule.load();
        if (!Subject?.isComponentDescriptor) throw new Error('Reconciled source did not evaluate to a component descriptor');
        const validatedComponent = Subject.derive();
        const validatedSnapshot = JSON.parse(JSON.stringify(
          componentStructureSnapshot(validatedComponent, styleProperties)));
        const editableSnapshot = JSON.parse(JSON.stringify(
          componentStructureSnapshot(component, styleProperties)));
        const difference = firstSnapshotDifference(validatedSnapshot, editableSnapshot);
        expect(
          validatedSnapshot,
          difference && `first cold/editable mismatch: ${JSON.stringify(difference)}`
        ).to.eql(editableSnapshot);
      } finally {
        await validationModule.unload({ forgetDeps: false });
        await validationResource.remove();
      }
    }
  });
}

describe('component reconciliation fuzzer', function () {
  this.timeout(180000);

  afterEach(async () => {
    await cleanup();
  });

  it('uses deterministic random sequences', () => {
    const first = new SeededRandom('replayable seed');
    const second = new SeededRandom('replayable seed');
    const third = new SeededRandom('different seed');
    const firstSequence = Array.from({ length: 20 }, () => first.next());
    const secondSequence = Array.from({ length: 20 }, () => second.next());
    const thirdSequence = Array.from({ length: 20 }, () => third.next());

    expect(firstSequence).to.eql(secondSequence);
    expect(firstSequence).not.to.eql(thirdSequence);
  });

  it('survives seeded structural and property stress scenarios', async () => {
    const seeds = [0xC0FFEE, 0xBAD5EED, 0xDEC0DE, 0xF00DBABE];
    const steps = 64;
    const coveredOperations = new Set();

    for (const seed of seeds) {
      const fuzzer = await prepareFuzzer(seed, steps);
      let result;
      try {
        result = await fuzzer.run(steps);
      } catch (error) {
        throw new Error(JSON.stringify({
          message: error.message,
          cause: error.cause?.message || String(error.cause),
          causeStack: error.cause?.stack,
          actual: error.cause?.actual,
          expected: error.cause?.expected,
          seed: error.seed,
          step: error.step,
          operation: error.operation,
          action: error.action,
          actions: error.actions,
          sourceBefore: error.sourceBefore,
          sourceAfter: error.sourceAfter
        }, null, 2));
      }
      expect(result.actions).to.have.length(steps);
      parse(result.source);
      expect(result.source).to.include('Base as AliasedBase');
      expect(result.source).to.match(/part\((?:AliasedBase|Base),/);
      if (result.source.includes('Leaf as AliasedLeaf')) {
        expect(result.source).to.match(/part\((?:AliasedLeaf|Leaf),/);
      }
      for (const action of result.actions) coveredOperations.add(action.operation);
    }

    for (const operation of DEFAULT_RECONCILIATION_FUZZ_OPERATIONS) {
      expect(coveredOperations.has(operation), `expected fuzz operation ${operation} to run`).to.be.true;
    }
  });
});
