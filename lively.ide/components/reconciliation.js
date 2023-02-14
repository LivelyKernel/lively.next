import { arr, string } from 'lively.lang';
import {
  getNodeFromSubmorphs, DEFAULT_SKIPPED_ATTRIBUTES,
  convertToExpression, findComponentDef, applyChangesToTextMorph
} from './helpers.js';
import { undeclaredVariables } from '../js/import-helper.js';
import { ImportInjector, ImportRemover } from 'lively.modules/src/import-modification.js';
import { module } from 'lively.modules/index.js';
import { parse, stringify, nodes, query } from 'lively.ast';
import lint from '../js/linter.js';

/**
 * The cheap way is just to generate a new spec from a component morph.
 * however:
 *  1. this is most inefficient solution since it involves generating and stringifying a AST. (slow)
 *  2. it does not preserve the original formatting of the user.
 *
 * instead we want to rather patch the source as needed to reconcile changes
 * that happen in direct manipulation. This function should only be used
 * in cases we do NOT have a preexisting definition residing in source.
 * @param { Morph } aComponent - The component morph we use to create the component definition from.
 * @param { boolean } asExprObject - Wether or not to return an expression object (with binding info) instead of just a string.
 * @returns { string|object } The component definition as stringified expression or expression object.
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
    return {
      __expr__, bindings
    };
  }

  return __expr__;
}

export function insertMorphChange (submorphsArrayNode, addedMorphExpr, nextSibling = false) {
  let insertPos = arr.last(submorphsArrayNode.elements).end;
  if (nextSibling) {
    const siblingNode = getNodeFromSubmorphs(submorphsArrayNode, nextSibling.name);
    insertPos = siblingNode.start;
    addedMorphExpr += ',';
  } else {
    addedMorphExpr = ',' + addedMorphExpr;
  }
  return { action: 'insert', start: insertPos, lines: [addedMorphExpr] };
}

/**
 * Insert the morph into the submorphs array, operating on a source code string. By default, we append
 * the morph to the submorphs array. If a sibling morph is provided we insert the morph before the corresponding expression.
 * @param { string } sourceCode - The source code to patch.
 * @param { object } submorphsArrayNode - The AST node the points to a submorphs array in the component definition.
 * @param { string } addedMorphExpr - The expression that is supposed to be placed into the component definition. i.e. part(), add() or just plain {...}
 * @param { Text } [sourceEditor] - An optional source code editor that serves as the store of the source code.
  * @param { Morph } [nextSibling] - The morph we want to be inserted in front of instead of appending to the end.
 * @returns { string } The transformed source code.
 */
export function insertMorph (sourceCode, submorphsArrayNode, addedMorphExpr, sourceEditor = false, nextSibling = false) {
  let change = insertMorphChange(submorphsArrayNode, addedMorphExpr, nextSibling);

  if (sourceEditor) {
    return applyChangesToTextMorph(sourceEditor, [change]);
  }
  return string.applyChanges(sourceCode, [change]);
}

/**
 * Inserts a new property into a properties node of a component definition
 * located in a source string.
 * @param { string } sourceCode - The source code to adjust.
 * @param { object } propertiesNode - The AST node pointing to the properties object to adjust.
 * @param { string } key - The property name.
 * @param { object } valueExpr - The expression object of the value of the property.
 * @param { Text } [sourceEditor = false] - An optional source code editor that serves as the store of the source code.
 * @returns { string } The transformed source code.
 */
export function insertPropChange (sourceCode, propertiesNode, key, valueExpr) {
  const nameProp = propertiesNode.properties.findIndex(prop => prop.key.name === 'name');
  const typeProp = propertiesNode.properties.findIndex(prop => prop.key.name === 'type');
  const submorphsProp = propertiesNode.properties.findIndex(prop => prop.key.name === 'submorphs');
  const modelProp = propertiesNode.properties.findIndex(prop => prop.key.name?.match(/viewModelClass|defaultViewModel/));
  const isVeryFirst = propertiesNode.properties.length === 0;
  let afterPropNode = propertiesNode.properties[Math.max(typeProp, nameProp, modelProp)];
  let keyValueExpr = '\n' + key + ': ' + valueExpr;
  let insertationPoint;
  if (!afterPropNode || key === 'submorphs') {
    if (isVeryFirst) insertationPoint = propertiesNode.start + 1;
    else afterPropNode = arr.last(propertiesNode.properties);
  }
  if (submorphsProp > -1) {
    // ensure that we are inserted before
    const ia = afterPropNode ? propertiesNode.properties.indexOf(afterPropNode) : 0;
    afterPropNode = propertiesNode.properties[Math.min(ia, submorphsProp - 1)];
    if (!afterPropNode) {
      insertationPoint = propertiesNode.start + 1;
      keyValueExpr = keyValueExpr + ','; // but still need to ensure the comma
    }
  }
  if (afterPropNode) {
    keyValueExpr = ',' + keyValueExpr;
  }
  if (afterPropNode && !insertationPoint) {
    insertationPoint = afterPropNode.end;
  }

  // in this is the very first property we insert at all,
  // we need to make sure no superflous newlines are kept around...
  let changes = [];
  if (isVeryFirst) {
    keyValueExpr = `{${keyValueExpr}\n}`;
    changes = [
      { action: 'replace', ...propertiesNode, lines: [keyValueExpr] }
    ];
  } else {
    changes = [
      { action: 'insert', start: insertationPoint, lines: [keyValueExpr] }
    ];
  }

  return changes;
}

export function insertProp (sourceCode, propertiesNode, key, valueExpr, sourceEditor = false) {
  const changes = insertPropChange(sourceCode, propertiesNode, key, valueExpr);
  if (sourceEditor) return applyChangesToTextMorph(sourceEditor, changes);
  return string.applyChanges(sourceCode, changes);
}

/**
 * Transforms a given source code string such that undefined required bindings are
 * resolved by imports.
 * @param { string } sourceCode - The source code to adjust the imports for.
 * @param { object[] } requiredBindings - A list of required bindings for the source code.
 * @param { Module } mod - The module the source code belongs to.
 * @returns { string } The updated source code.
 */
export function fixUndeclaredVars (sourceCode, requiredBindings, mod) {
  const knownGlobals = mod.dontTransform;
  const undeclared = undeclaredVariables(sourceCode, knownGlobals).map(n => n.name);
  let updatedSource = sourceCode;
  const changes = [];
  if (undeclared.length === 0) return { updatedSource: sourceCode, changes };
  for (let [importedModuleId, exportedIds] of requiredBindings) {
    for (let exportedId of exportedIds) {
      // check if binding already present and continue if that is the case
      if (!undeclared.includes(exportedId)) continue;
      arr.remove(undeclared, exportedId);
      // any way to avoid the string modification?
      let generated, from;
      ({ generated, from, updatedSource } = ImportInjector.run(System, mod.id, mod.package(), updatedSource, {
        exported: exportedId,
        moduleId: importedModuleId
      }));
      changes.push({ action: 'insert', start: from, lines: [generated] });
    }
  }
  return { updatedSource, changes };
}

/*****************
 * MODULE UPDATE *
 *****************/

/**
 * Removes a component definition together with its export(s) from a module.
 * @param { string } entityName - The name of the component definition to remove.
 * @param { string } modId - The name of the module to remove the component definition from.
 */
export async function removeComponentDefinition (entityName, modId) {
  const mod = module(modId);
  await mod.changeSourceAction(oldSource => {
    const parsed = parse(oldSource);
    const exportSpecs = query.queryNodes(
      parsed,
     `// ExportSpecifier [
         /:local Identifier [@name == "${entityName}"]
       ],
      // ExportDefaultDeclaration [
         /:declaration Identifier [@name == "${entityName}"]
       ]
      `);
    let rangesToRemove = [];
    for (let exportSpec of exportSpecs) {
      while (oldSource[exportSpec.start - 1].match(/ /)) exportSpec.start--;
      while (oldSource[exportSpec.end].match(/\,|\n/)) exportSpec.end++;
      rangesToRemove.push({ action: 'remove', ...exportSpec });
    }
    const componentDef = findComponentDef(parsed, entityName);
    while (oldSource[componentDef.end].match(/\,|\n/)) componentDef.end++;
    rangesToRemove.push({ action: 'remove', ...componentDef });

    return ImportRemover.removeUnusedImports(
      string.applyChanges(oldSource, arr.sortBy(rangesToRemove, range => -range.start))
    ).source;
  });
}

/**
 * Replaces a component definition within a module.
 * @param { string } defAsCode - The code snippet of the updated component definition.
 * @param { string } entityName - The name of the const referencing the component definition.
 * @param { string } modId - The id of the module to be updated.
 */
export async function replaceComponentDefinition (defAsCode, entityName, modId) {
  const mod = module(modId);
  await mod.changeSourceAction(oldSource => {
    const { start, end } = findComponentDef(parse(oldSource), entityName);
    return ImportRemover.removeUnusedImports(string.applyChanges(oldSource, [
      { start, end, action: 'replace', lines: [defAsCode] }
    ])).source;
  });
}

/**
 * Inserts a new component definition into a module based on a morph that
 * will be used to generate the definition.
 * @param { Morph } protoMorph - The morph to be used to generate a component definition from.
 * @param { string } variableName - The name of the variable that should reference the component definition.
 * @param { string } modId - The id of the module to be changed.
 */
export async function insertComponentDefinition (protoMorph, entityName, modId) {
  const mod = module(modId);
  const scope = await mod.scope();
  await mod.changeSourceAction(oldSource => {
    // insert the initial component definition into the back end of the module
    const { __expr__: compCall, bindings: requiredBindings } = createInitialComponentDefinition(protoMorph, true);
    const decl = `\n\const ${entityName} = ${compCall};\n\n`;

    // if there is a bulk export, insert the export into that batch, and also do not put
    // the declaration after these bulk exports.
    const finalExports = arr.last(scope.exportDecls);
    if (!finalExports) {
      return fixUndeclaredVars(oldSource + decl, Object.entries(requiredBindings), mod).updatedSource +
      `\n\nexport { ${entityName} }`;
    }
    // insert before the exports
    const updatedExports = {
      ...finalExports,
      specifiers: [...finalExports.specifiers, nodes.id(entityName)]
    };

    return lint(fixUndeclaredVars(
      string.applyChanges(oldSource, [
        { action: 'replace', ...finalExports, lines: [decl, stringify(updatedExports)] }
      ]),
      Object.entries(requiredBindings),
      mod).updatedSource)[0];
  });
}

export function applyModuleChanges (changesByModule) {
  // order each group by module
  // apply bulk to each module
}
