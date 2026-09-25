import { arr, string } from 'lively.lang';
import { parse, stringify, nodes, query } from 'lively.ast';
import module from 'lively.modules/src/module.js';
import { ImportInjector, ImportRemover } from 'lively.modules/src/import-modification.js';

import { undeclaredVariables } from '../js/import-helper.js';
import {
  convertToExpression,
  DEFAULT_SKIPPED_ATTRIBUTES,
  findComponentDef
} from './helpers.js';

function requiredBindingNames (binding) {
  if (typeof binding === 'string') return { exported: binding, local: binding };
  if (binding && typeof binding.exported === 'string') {
    return { exported: binding.exported, local: binding.local || binding.exported };
  }
  throw new Error(`Invalid required binding: ${String(binding)}`);
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
