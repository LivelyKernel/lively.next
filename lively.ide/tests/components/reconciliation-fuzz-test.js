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
  const normalizedPathVertices = morph => {
    const width = morph.width || 1;
    const height = morph.height || 1;
    const normalized = value => Math.round(value * 1000000) / 1000000;
    return morph.vertices.map(({ position }) => ({
      x: normalized(position.x / width),
      y: normalized(position.y / height)
    }));
  };
  const snapshotMorph = (morph, isRoot = false, path = []) => {
    const semanticSubmorphs = morph.isText
      ? morph.textAndAttributes.filter(value => value?.isMorph)
      : morph.submorphs;
    const submorphs = semanticSubmorphs
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
      // A parent layout may resize a path during cold instantiation while the
      // detached editable instance has not rendered. Path shape is semantic;
      // layout-controlled absolute geometry is not, so compare its normalized
      // vertices and let the layout snapshot cover the resizing policy.
      vertices: morph.isPath ? normalizedPathVertices(morph) : null,
      style: Object.fromEntries([...comparedStyleProperties]
        .map(property => [property, snapshotStyleValue(morph[property])])),
      layout: morph.layout
        ? {
            type: morph.layout.constructor.name,
            axis: morph.layout.axis,
            align: morph.layout.align,
            axisAlign: morph.layout.axisAlign,
            justifySubmorphs: morph.layout.justifySubmorphs,
            padding: morph.layout.padding?.toString(),
            spacing: morph.layout.spacing,
            orderByIndex: morph.layout.orderByIndex,
            wrapSubmorphs: morph.layout.wrapSubmorphs,
            columnCount: morph.layout.columnCount,
            rowCount: morph.layout.rowCount,
            resizePolicies: morph.layout.resizePolicies
              ?.map(([name, policy]) => [name, snapshotStyleValue(policy)])
          }
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

function duplicateWithoutTargets (source) {
  const duplicates = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ArrayExpression') {
      const targets = node.elements.map(element => {
        if (element?.type !== 'CallExpression' ||
            element.callee?.type !== 'Identifier' ||
            element.callee.name !== 'without' ||
            element.arguments.length !== 1) return null;
        const [argument] = element.arguments;
        return argument?.type === 'Literal' && typeof argument.value === 'string'
          ? argument.value
          : null;
      }).filter(Boolean);
      const seen = new Set();
      for (const target of targets) {
        if (seen.has(target)) duplicates.push(target);
        seen.add(target);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'sourceFile'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(parse(source));
  return duplicates;
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
      expect(
        duplicateWithoutTargets(source),
        'without() markers must be unique within each submorph scope'
      ).to.eql([]);
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
        const recentBatches = difference
          ? component._changeTracker.shadowCommandBatches.slice(-30)
            .filter(batch => batch.commands.some(command =>
              command.kind === 'rename-node' || command.property === 'layout'
            ))
            .slice(-6)
            .map(batch => ({
              commands: batch.commands.map(command => ({
                kind: command.kind,
                property: command.property,
                previousName: command.previousName,
                name: command.name
              })),
              committed: !!batch.projectionalCommit,
              commitDiagnostic: batch.commitDiagnostic?.message,
              policyCache: batch.policyCacheProjection && {
                kind: batch.policyCacheProjection.kind,
                layoutChanges: batch.policyCacheProjection.changes
                  ?.filter(change => change.property === 'layout')
                  .map(change => ({
                    before: change.beforeValue?.getSpec?.(),
                    after: change.afterValue?.getSpec?.()
                  }))
              },
              runtimeLayouts: batch.shadowProjection?.steps?.flatMap(step =>
                step.runtimeProjection?.changeSet?.operations
                  ?.filter(operation => operation.property === 'layout')
                  .map(operation => ({
                    before: operation.before?.getSpec?.(),
                    after: operation.after?.getSpec?.()
                  })) || []
              ),
              shadowSupported: batch.shadowProjection?.supported,
              shadowDiagnostics: batch.shadowProjection?.diagnostics?.map(
                diagnostic => diagnostic.message
              ),
              shadowHasNewName: action.newName
                ? batch.shadowProjection?.sourceAfter?.includes(action.newName)
                : undefined
            }))
          : [];
        expect(
          validatedSnapshot,
          difference && `first cold/editable mismatch: ${JSON.stringify(difference)}; recent batches: ${JSON.stringify(recentBatches)}`
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
      const editableText = fuzzer.component.get('fuzz text');
      expect(editableText.readOnly).to.be.false;
      expect(editableText.selectable).to.be.true;
      expect(editableText.reactsToPointer).to.be.true;
      let result;
      try {
        result = await fuzzer.run(steps);
      } catch (error) {
        throw new Error(JSON.stringify({
          message: error.message,
          cause: error.cause?.message || String(error.cause),
          causeStack: error.cause?.stack,
          causeChange: error.cause?.change && {
            prop: error.cause.change.prop,
            selector: error.cause.change.selector,
            target: error.cause.change.target?.name,
            meta: error.cause.change.meta
          },
          causeBatch: error.cause?.batch && {
            commands: error.cause.batch.commands?.map(command => ({
              kind: command.kind,
              property: command.property
            })),
            diagnostics: error.cause.batch.diagnostics?.map(
              ({ kind, message }) => ({ kind, message })
            ),
            shadowSupported: error.cause.batch.shadowProjection?.supported,
            shadowDiagnostics: error.cause.batch.shadowProjection?.diagnostics?.map(
              ({ kind, message }) => ({ kind, message })
            ),
            commitDiagnostic: error.cause.batch.commitDiagnostic
          },
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
      for (const action of result.actions) coveredOperations.add(action.operation);
    }

    for (const operation of DEFAULT_RECONCILIATION_FUZZ_OPERATIONS) {
      expect(coveredOperations.has(operation), `expected fuzz operation ${operation} to run`).to.be.true;
    }
  });
});
