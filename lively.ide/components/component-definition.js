import { arr, string } from 'lively.lang';
import { parse, stringify, nodes, query } from 'lively.ast';
import module from 'lively.modules/src/module.js';
import { ImportInjector, ImportRemover } from 'lively.modules/src/import-modification.js';

import { undeclaredVariables } from '../js/import-helper.js';
import {
  convertToExpression,
  DEFAULT_SKIPPED_ATTRIBUTES,
  findComponentDef,
  getComponentNode,
  getProp
} from './helpers.js';

function requiredBindingNames (binding) {
  if (typeof binding === 'string') return { exported: binding, local: binding };
  if (binding && typeof binding.exported === 'string') {
    return { exported: binding.exported, local: binding.local || binding.exported };
  }
  throw new Error(`Invalid required binding: ${String(binding)}`);
}

/** Insert runtime-generated names without requiring inherited ordering anchors in source. */
export function ensureComponentNamesInSource (source, exportName, policySpec, invalidNameRanges, resolveComponentDocument) {
  const componentCall = getComponentNode(parse(source), exportName)?.init;
  if (componentCall?.type !== 'CallExpression') return source;
  const changes = [];
  const propertiesOf = spec => spec?.isPolicy
    ? spec.spec : spec?.COMMAND === 'add' ? propertiesOf(spec.props) : spec?.props || spec;
  const unwrappedCall = node => node?.callee?.name === 'add'
    ? node.arguments[0] : node?.callee?.name === 'replace' ? node.arguments[1] : node;
  const sourceSpec = node => {
    if (node?.type !== 'CallExpression') return node;
    const name = node.callee?.name;
    if (name === 'add') return sourceSpec(node.arguments[0]);
    if (name === 'replace') return sourceSpec(node.arguments[1]);
    return name === 'part' ? node.arguments[1] || node : null;
  };
  const sourceName = child => {
    const explicitName = getProp(sourceSpec(child), 'name')?.value?.value;
    if (explicitName) return explicitName;
    const call = unwrappedCall(child);
    if (call?.callee?.name !== 'part') return null;
    const reference = call.arguments[0];
    return resolveComponentDocument?.({expression: source.slice(reference.start, reference.end)})?.root.name;
  };
  const visit = (rawNode, rawSpec, isRoot = false, inheritedChildren = false) => {
    const node = sourceSpec(rawNode);
    const spec = propertiesOf(rawSpec);
    if (!node || !spec) return;
    const partPolicy = rawSpec?.COMMAND === 'add' ? rawSpec.props : rawSpec;
    const inferredPartName = partPolicy?.isPolicy ? partPolicy.parent?.name : null;
    const generatedPartName = unwrappedCall(rawNode)?.callee?.name === 'part' &&
      typeof inferredPartName === 'string' && spec.name !== inferredPartName;
    if (!isRoot && !getProp(node, 'name') && typeof spec.name === 'string' &&
        (generatedPartName || invalidNameRanges.some(range => range.start === node.start && range.end === node.end))) {
      const name = `name: ${JSON.stringify(spec.name)}`;
      if (node.type === 'ObjectExpression') {
        changes.push({ start: node.start + 1, text: ` ${name}${node.properties.length ? ',' : ''}` });
      } else if (node.callee?.name === 'part') {
        changes.push({ start: node.arguments[0].end, text: `, { ${name} }` });
      }
    }
    const children = getProp(node, 'submorphs')?.value?.elements;
    if (!children) return;
    const available = (spec.submorphs || []).filter(child => child?.COMMAND !== 'remove');
    const matches = new Map();
    const additions = children.filter(child => child?.callee?.name === 'add');
    if (additions.some(child => child.arguments.length === 2)) {
      const runtimeAdds = available.filter(child => child?.COMMAND === 'add');
      if (runtimeAdds.length !== additions.length) return;
      // Policy additions are already ordered; apply the same anchors to source entries before pairing.
      const ordered = available.filter(child => child?.COMMAND !== 'add')
        .map(child => ({name: propertiesOf(child)?.name}));
      let pending = additions;
      while (pending.length) {
        const deferred = [];
        for (const child of pending) {
          const anchor = child.arguments[1]?.value;
          const index = anchor === undefined ? ordered.length : ordered.findIndex(entry => entry.name === anchor);
          if (index < 0) { deferred.push(child); continue; }
          ordered.splice(index, 0, {child, name: sourceName(child)});
        }
        if (deferred.length === pending.length) {
          deferred.forEach(child => {
            const index = ordered.findIndex(entry => entry.name === child.arguments[1]?.value);
            ordered.splice(index < 0 ? ordered.length : index, 0, { child, name: sourceName(child) });
          });
          break;
        }
        pending = deferred;
      }
      ordered.filter(entry => entry.child).forEach(({child}, index) => {
        const candidate = runtimeAdds[index];
        matches.set(child, candidate);
        available.splice(available.indexOf(candidate), 1);
      });
    }
    for (const child of children) {
      if (matches.has(child)) continue;
      const name = getProp(sourceSpec(child), 'name')?.value?.value ||
        (child?.callee?.name === 'replace' ? child.arguments[0]?.value : null);
      const index = available.findIndex(candidate => propertiesOf(candidate)?.name === name);
      if (index >= 0) matches.set(child, available.splice(index, 1)[0]);
    }
    for (const child of children) {
      if (!sourceSpec(child)) continue;
      let childSpec = matches.get(child);
      if (!childSpec) {
        const index = child?.callee?.name === 'add'
          ? available.findIndex(candidate => candidate?.COMMAND === 'add')
          : inheritedChildren ? -1 : 0;
        if (index >= 0) childSpec = available.splice(index, 1)[0];
      }
      const inheritsChildren = unwrappedCall(child)?.callee?.name === 'part' ||
        (inheritedChildren && !['add', 'replace'].includes(child?.callee?.name));
      visit(child, childSpec, false, inheritsChildren);
    }
  };
  visit(componentCall.arguments.at(-1), policySpec, true, componentCall.arguments.length === 2);
  return changes.sort((left, right) => right.start - left.start)
    .reduce((updated, change) => updated.slice(0, change.start) + change.text +
      updated.slice(change.start), source);
}

/**
 * Generates source for a component that does not have a pre-existing source
 * definition yet.
 */
export function createInitialComponentDefinition (aComponent, asExprObject = false) {
  let { __expr__, bindings } = convertToExpression(aComponent, {
    skipAttributes: [...DEFAULT_SKIPPED_ATTRIBUTES, 'treeData']
  });
  __expr__ = 'component(' + __expr__ + ')';

  if (asExprObject) {
    if (bindings['lively.morphic']) {
      arr.pushIfNotIncluded(bindings['lively.morphic'], 'component');
    } else {
      bindings['lively.morphic'] = ['component'];
    }
    return { __expr__, bindings };
  }

  return __expr__;
}

/** Resolves bindings required by generated component source through imports. */
export function fixUndeclaredVars (sourceCode, requiredBindings, mod) {
  const system = mod.System;
  const undeclared = undeclaredVariables(sourceCode, mod.dontTransform).map(node => node.name);
  let updatedSource = sourceCode;
  const changes = [];
  if (undeclared.length === 0) return { updatedSource: sourceCode, changes };

  for (const [importedModuleId, exportedIds] of requiredBindings) {
    for (const requiredBinding of exportedIds) {
      const { exported, local } = requiredBindingNames(requiredBinding);
      if (!undeclared.includes(local)) continue;
      arr.remove(undeclared, local);
      let generated, from;
      ({ generated, from, newSource: updatedSource } = ImportInjector.run(
        system,
        mod.id,
        mod.package(),
        updatedSource,
        {
          exported,
          moduleId: module(system, importedModuleId).id,
          pathInPackage: module(system, importedModuleId).pathInPackage(),
          packageName: module(system, importedModuleId).package()?.name
        },
        local === exported ? undefined : local
      ));
      changes.push({ action: 'insert', start: from, lines: [generated] });
    }
  }
  return { updatedSource, changes };
}

export async function removeComponentDefinition (entityName, mod) {
  await mod.changeSourceAction(oldSource => {
    const parsed = parse(oldSource);
    const exportSpecs = query.queryNodes(
      parsed,
      `// ExportSpecifier [
         /:local Identifier [@name == "${entityName}"]
       ],
      // ExportDefaultDeclaration [
         /:declaration Identifier [@name == "${entityName}"]
       ]`
    );
    const rangesToRemove = [];
    for (const exportSpec of exportSpecs) {
      while (oldSource[exportSpec.start - 1].match(/ /)) exportSpec.start--;
      while (oldSource[exportSpec.end].match(/,|\n/)) exportSpec.end++;
      rangesToRemove.push({ action: 'remove', ...exportSpec });
    }
    const componentDef = findComponentDef(parsed, entityName);
    while (oldSource[componentDef.end].match(/,|\n/)) componentDef.end++;
    rangesToRemove.push({ action: 'remove', ...componentDef });

    return ImportRemover.removeUnusedImports(
      string.applyChanges(oldSource, arr.sortBy(rangesToRemove, range => -range.start))
    ).source;
  });
}

export async function replaceComponentDefinition (defAsCode, entityName, mod) {
  await mod.changeSourceAction(oldSource => {
    const { start, end } = findComponentDef(parse(oldSource), entityName);
    return ImportRemover.removeUnusedImports(string.applyChanges(oldSource, [
      { start, end, action: 'replace', lines: [defAsCode] }
    ])).source;
  });
}

export async function insertComponentDefinition (protoMorph, entityName, mod) {
  const scope = await mod.scope();
  await mod.changeSourceAction(oldSource => {
    const { __expr__: componentCall, bindings } = createInitialComponentDefinition(protoMorph, true);
    const declaration = `\nconst ${entityName} = ${componentCall};\n\n`;
    const finalExports = arr.last(scope.exportDecls);

    if (!finalExports) {
      return fixUndeclaredVars(oldSource + declaration, Object.entries(bindings), mod).updatedSource +
        `\n\nexport { ${entityName} }`;
    }

    const updatedExports = {
      ...finalExports,
      specifiers: [...finalExports.specifiers, nodes.id(entityName)]
    };
    return System.lint(fixUndeclaredVars(
      string.applyChanges(oldSource, [
        { action: 'replace', ...finalExports, lines: [declaration, stringify(updatedExports)] }
      ]),
      Object.entries(bindings),
      mod
    ).updatedSource)[0];
  });
}

export function canBeRenamed (mod, newName) {
  return !(string.camelCaseString(newName) in mod.recorder);
}
