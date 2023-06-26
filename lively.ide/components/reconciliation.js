import { arr, obj, string } from 'lively.lang';
import {
  getNodeFromSubmorphs, getParentRef, getComponentDeclsFromScope,
  getAddCallReferencing,
  getWithoutCall,
  getEligibleSourceEditorsFor,
  applySourceChanges,
  getPathFromMorphToMaster,
  getTextAttributesExpr,
  getComponentScopeFor,
  getValueExpr,
  getFoldableValueExpr,
  standardValueTransform,
  COMPONENTS_CORE_MODULE,
  getMorphNode,
  getPropertiesNode,
  getProp,
  DEFAULT_SKIPPED_ATTRIBUTES,
  convertToExpression,
  findComponentDef,
  applyChangesToTextMorph
} from './helpers.js';
import { undeclaredVariables } from '../js/import-helper.js';
import { ImportInjector, ImportRemover } from 'lively.modules/src/import-modification.js';
import { module } from 'lively.modules/index.js';
import { parse, stringify, nodes, query } from 'lively.ast';
import lint from '../js/linter.js';
import { notYetImplemented } from 'lively.lang/function.js';
import { isFoldableProp, getDefaultValueFor } from 'lively.morphic/helpers.js';
import { resource } from 'lively.resources';

/**
 * The cheap way is just to generate a new spec from a component morph.
 * however:
 *  1. this is most inefficient solution since it involves generating and stringifying a AST. (slow)
 *  2. it does not preserve the original formatting of the user.
 *
 * instead we want to rather patch the source as needed to reconcile changes
 * that happen in direct manipulation. This function should only be used
 * in cases we do NOT have a preexisting definition residing in source.f
 * @param { Morph } aComponent - The component morph we use to create the component definition from.
 * @param { boolean } asExprObject - Wether or not to return an expression object (with binding info) instead of just a string.
 * @returns { string|object } The component definition as stringified expression or expression object.
 */
export function createInitialComponentDefinition (aComponent, asExprObject = false) {
  let { __expr__, bindings } = convertToExpression(aComponent, {
    skipAttributes: [...DEFAULT_SKIPPED_ATTRIBUTES, 'treeData']
  });
  __expr__ = 'component(' + __expr__ + ')'; // remove name attr

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
  const action = { action: 'insert', start: insertPos, lines: [',' + addedMorphExpr] };
  if (nextSibling) {
    const siblingNode = getNodeFromSubmorphs(submorphsArrayNode, nextSibling.name);
    if (!siblingNode) return action;
    action.start = siblingNode.start;
    action.lines = [addedMorphExpr + ','];
  }
  return action;
}

/**
 * Given a morph with a corresponding spec, determine wether it still
 * includes enough properties to bepreserved. If there is no property(s)
 * exceeding the set of ignored props, the spec is determined removable
 * and we escalate the consideration of removal further to the parent.
 * By doing this, we are able to cleanup unnessecary specs that clutter
 * component definitions.
 * @param { object } nodeToRemove - The node of the sopec we initially consider to remove.
 * @param { object } parsedComponent - The node pointing to the entire component definition.
 * @param { Morph } fromMorph - The morph that we traverse the owner chain from in case of escalation.
 * @param { string[] } [ignoredProps= ['name', 'submorphs']] - The set of property names that are not considered enough for the node to be preserved.
 * @returns { object } Returns the final node deemed to be removed.
 */

// FIXME: add toMorph param in order to flexibily stop and support inline policies?

function determineNodeToRemoveSubmorphs (nodeToRemove, parsedComponent, fromMorph, ignoredProps = ['name', 'submorphs']) {
  let curr = fromMorph;
  let propNode = getPropertiesNode(parsedComponent, curr);
  const ignoreQuery = `
  / Property [
    /:key Identifier [ ${ignoredProps.map(prop => `@name != '${prop}'`).join(' && ')} ]
   ]`;
  let submorphsNode = getProp(propNode, 'submorphs');
  while (
    query.queryNodes(propNode, ignoreQuery).length === 0 &&
    (submorphsNode?.value.elements.length || 0) < 2
  ) {
    // if we are wrapped by a part call we should use the submorphs node instead
    if (!curr.owner) break;
    nodeToRemove = curr.__wasAddedToDerived__ ? submorphsNode : propNode;
    if (query.queryNodes(propNode, ignoreQuery).length === 0) nodeToRemove = propNode;
    curr = curr.owner;
    propNode = getPropertiesNode(parsedComponent, curr?.isComponent ? null : curr);
    submorphsNode = getProp(propNode, 'submorphs');
    if (submorphsNode?.value.elements.length < 2) nodeToRemove = submorphsNode;
    if (curr.isWorld) break;
  }
  // ensure formatting is preserved
  return nodeToRemove;
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

export function deleteProp (sourceCode, parsedComponent, morphDef, propName, target, isDerived) {
  const propNode = getProp(morphDef, propName);
  if (!propNode) {
    return { needsLinting: false, changes: [] };
  }
  if (isDerived && morphDef.properties.length < 3) {
    // since we are derived and only have the name prop left,
    // we are eligible for removal
    // since it is derived we only care about removing this morph entirely
    const nodeToRemove = determineNodeToRemoveSubmorphs(morphDef, parsedComponent, target, [
      'name',
      'submorphs',
      propName
    ]);
    return {
      needsLinting: true,
      changes: [{ action: 'remove', ...nodeToRemove }]
    };
  }

  const patchPos = propNode;
  while (sourceCode[patchPos.end].match(/,| |\n/)) patchPos.end++;
  return {
    needsLinting: true,
    changes: [{ action: 'remove', ...patchPos }]
  };
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
      ({ generated, from, newSource: updatedSource } = ImportInjector.run(System, mod.id, mod.package(), updatedSource, {
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
 * This function is only used in response to removing a component definition from a package
 * and therefore does not need to be decoupled from the module + source changes it performs.
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
 * This function is only used in response to resetting a component definition
 * and therefore does not need to be decoupled from the module + source changes it performs.
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
 * This function is only used for initial creation of new components and therefore
 * does not need to be decoupled from the module creation + source code changes it performs.
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

export function canBeRenamed (moduleId, oldName, newName) {
  // if (oldName === newName) return false;
  if (string.camelCaseString(newName) in module(moduleId).recorder) return false;
  return true;
}

/**
 * Given a proto morph, rename the corresponding component definition
 * inside of the module it is defined in. In case the component is the
 * top level component that determines the module's name, then we perform
 * a renaming of the module.
 * @param {type} protoMorph - description
 */

export async function renameComponent (protoMorph, newName) {
  const meta = protoMorph[Symbol.for('lively-module-meta')];
  if (!meta?.moduleId || !meta?.exportedName) return;
  let mod = module(meta.moduleId);
  const exports = await mod.exports();
  const oldName = meta.exportedName;
  const parsedModule = await mod.ast();
  const descr = mod.recorder[oldName];
  const moduleNeedsRename = !descr.stylePolicy.parent; // works only for auto generated component files and this if fine
  const { declarations: [{ id: decl }] } = findComponentDef(parsedModule, meta.exportedName);
  const references = arr.compact((await getComponentDeclsFromScope(mod.id, await mod.scope())).map(ref => {
    return getParentRef(ref[1]);
  }));
  const { local: exportedEntity } = exports.find(exp => exp.local === oldName)?.node || {};

  let newModuleName; let oldModuleName = mod.shortName();
  if (moduleNeedsRename) {
    newModuleName = string.decamelize(newName).split(' ').join('-') + '.cp.js';
    const newId = resource(mod.id).parent().join(newModuleName).url;
    mod = await mod.renameTo(newId, {
      unload: true,
      removeFile: true,
      updateDependants: true // implement this one
    });
  }
  await mod.ensureRecord();
  await mod.changeSourceAction(oldSource => {
    // also replace the export, if exported separately
    if (exportedEntity) {
      oldSource = string.applyChange(oldSource, {
        action: 'replace', ...exportedEntity, lines: [newName]
      });
    }
    // this will brick the module temporarily, which is no good!
    const changes = arr.sortBy([
      { action: 'replace', ...decl, lines: [newName] },
      ...references.map(ref => ({
        action: 'replace', ...ref, lines: [newName]
      }))
    ], action => -action.start);

    return string.applyChanges(oldSource, changes);
  });

  // proceed and rename all of the derived ones
  await mod.recorder[meta.exportedName].withDerivedComponentsDo(async descr => {
    const meta = descr[Symbol.for('lively-module-meta')];
    if (meta.exportedName && meta.moduleId !== oldModuleName) {
      console.log('updating', meta.exportedName);
      const mod = module(meta.moduleId);
      const parsedModule = await mod.ast();
      const imports = await mod.imports();
      const { declarations: [{ init: { arguments: [ref] } }] } = findComponentDef(parsedModule, meta.exportedName);
      const importedEntity = imports.find(imp => imp.imported === oldName)?.node || {};
      await mod.changeSourceAction(oldSource => {
        oldSource = string.applyChange(oldSource, { action: 'replace', ...ref, lines: [newName] });
        if (importedEntity) {
          if (moduleNeedsRename) {
            const { source } = importedEntity;
            oldSource = string.applyChange(oldSource, {
              action: 'replace',
              ...source,
              lines: [`'${source.value.split('/').slice(0, -1).concat(newModuleName).join('/')}'`]
            });
          }
          const imp = importedEntity.specifiers.find(spec => spec.imported.name === oldName);
          oldSource = string.applyChange(oldSource, { action: 'replace', ...imp, lines: [newName] });
        }
        return oldSource;
      });
    }
  });

  return await mod.recorder[newName].edit();
}

export function insertMorphExpression (parsedComponent, sourceCode, newOwner, addedMorphExpr, nextSibling = false) {
  const propsNode = getPropertiesNode(parsedComponent, newOwner);
  // FIXME: replace parsedComponent
  const submorphsArrayNode = propsNode && getProp(propsNode, 'submorphs')?.value;

  if (!submorphsArrayNode) {
    if (!propsNode) {
      // uncollapse till morph expression:
      // inserts a submorph drill down up to the submorphs: [*expression*] is inserted (insert action)
      return uncollapseSubmorphHierarchy( // eslint-disable-line no-use-before-define
        sourceCode,
        parsedComponent,
        newOwner,
        addedMorphExpr
      );
    }
    // just generate an insert action that places the prop in the morph def
    return {
      needsLinting: true, // really?
      changes: insertPropChange(
        sourceCode,
        propsNode,
        'submorphs',
        `[${addedMorphExpr.__expr__}]`
      )
    };
  } else {
    // just generates an insert action that places the morph in the submorph array
    return {
      needsLinting: true, // obviously
      changes: [insertMorphChange(submorphsArrayNode, addedMorphExpr.__expr__, nextSibling)]
    };
  }
}

/**
 * In case the change of a morph needs to be reconciled,
 * but said morph does not appear inside the component def,
 * that means it was not yet mentioned since no overriding changes
 * where applied. In this case we need to uncollapse the morph
 * structure such that the overridden change can be reconciled
 * accordingly.
 * @param { string } sourceCode - The source code of the module affected.
 * @param { object } parsedComponent - The AST of the component definition affected.
 * @param { Morph } hiddenMorph - The morph with the change we need to uncover in the component definition.
 * @returns { string } The transformed source code.
 */
export function uncollapseSubmorphHierarchy (sourceCode, parsedComponent, hiddenMorph, hiddenSubmorphExpr = false) {
  let nextVisibleParent = hiddenMorph;
  const idx = hiddenMorph.owner.submorphs.indexOf(hiddenMorph);
  const nextSibling = idx !== -1 && hiddenMorph.owner.submorphs[idx + 1];
  const ownerChain = [hiddenMorph];
  let propertiesNode, morphToExpand;
  do {
    morphToExpand = nextVisibleParent;
    nextVisibleParent = nextVisibleParent.owner;
    ownerChain.push(nextVisibleParent);
    propertiesNode = getPropertiesNode(parsedComponent, nextVisibleParent);
  } while (!propertiesNode);

  const masterInScope = arr.findAndGet(morphToExpand.ownerChain(), m => m.master);
  const uncollapsedHierarchyExpr = convertToExpression(morphToExpand, {
    onlyInclude: ownerChain,
    exposeMasterRefs: false,
    uncollapseHierarchy: true,
    masterInScope, // ensures no props are listed that are not overridden
    skipAttributes: [...DEFAULT_SKIPPED_ATTRIBUTES, 'master', 'type'],
    valueTransform: (key, val, aMorph) => {
      if (hiddenSubmorphExpr && aMorph === hiddenMorph && key === 'submorphs') {
        return [hiddenSubmorphExpr];
      }
      return standardValueTransform(key, val, aMorph);
    }
  });
    // also support this expression to be customized
  if (!uncollapsedHierarchyExpr) return { changes: [], needsLinting: false };
  return insertMorphExpression(parsedComponent, sourceCode, nextVisibleParent, uncollapsedHierarchyExpr, nextSibling);
}

/**
 * Handle reconciliation in response to the removal of a morph.
 * @param { object } removeChange - The change tracking the morph removal.
 * @param { object } parsedComponent - The AST node of the component definition that needs to be reconciled.
 * @param { srting } sourceCode - The source code to be transformed.
 * @param { object[] } requiredBindings - An array that is populated with dependencies that are introduced as part of the transformation.
 * @returns { object } The changes and the linting flag.
 */
export function handleRemovedMorph (
  removedMorph,
  prevOwner,
  parsedComponent,
  sourceCode,
  requiredBindings,
  isDerived = false) {
  let needsLinting = false;

  let closestSubmorphsNode = getProp(getPropertiesNode(parsedComponent, prevOwner), 'submorphs');
  let nodeToRemove = closestSubmorphsNode && getMorphNode(closestSubmorphsNode.value, removedMorph);

  const changes = [];

  // 1. the morph removed is part of a root component definition. => just remove spec, possibly removing submorphs prop.
  if (!removedMorph.__wasAddedToDerived__ && !isDerived) {
    // add a remove node or a remove submorph props call
    if (closestSubmorphsNode?.value.elements.length < 2) {
      changes.push({ action: 'remove', ...determineNodeToRemoveSubmorphs(closestSubmorphsNode, parsedComponent, prevOwner) });
      needsLinting = true; // really?
    } else if (nodeToRemove) {
      changes.push({
        action: 'remove',
        ...nodeToRemove
      });
    }
  }

  // 2. the morph removed was inherited from a component. => remove (if needed) and replace with without() call.
  if (!removedMorph.__wasAddedToDerived__ && isDerived) {
    // add a replace call
    const removeMorphExpr = {
      __expr__: `without('${removedMorph.name}')`,
      bindings: { [COMPONENTS_CORE_MODULE]: ['without'] }
    };
    requiredBindings.push(...Object.entries(removeMorphExpr.bindings));
    if (nodeToRemove) {
      changes.push({
        action: 'replace',
        ...nodeToRemove,
        lines: [removeMorphExpr.__expr__]
      });
    } else {
      // gather the changes for an uncollapse (one insert)
      // and this insert needs to be instrumented with the removedMorphExpr
      return insertMorphExpression(parsedComponent, sourceCode, prevOwner, removeMorphExpr);
    }
  }

  // 3. the morph removed as added and not inherited from a component. => just remove the add() call, possibly removing submorphs prop
  if (removedMorph.__wasAddedToDerived__ && isDerived) {
    // add a remove node or a remove submorph props call
    if (closestSubmorphsNode?.value.elements.length < 2) {
      changes.push({ action: 'remove', ...determineNodeToRemoveSubmorphs(closestSubmorphsNode, parsedComponent, prevOwner) }); // this in turns needs to bubble up if this causes owners to further get empty
      needsLinting = true;
    } else {
      changes.push({ action: 'remove', ...nodeToRemove });
    }
  }

  return { changes, needsLinting };
}

export function applyModuleChanges (reconciliation, sourceEditor = false) {
  // order each group by module
  // apply bulk to each module
  let { changesByModule, modulesToLint, requiredBindingsByModule } = reconciliation;
  const focusedModuleId = sourceEditor?.editorPlugin?.evalEnvironment.targetModule;
  changesByModule = arr.groupBy(changesByModule, arr.first);
  for (let moduleName in changesByModule) {
    const mod = module(moduleName);
    let { _source: sourceCode, id } = mod;
    if (!sourceCode) continue;
    const requiredBindingsForChanges = requiredBindingsByModule.get(id);
    const runLint = modulesToLint.has(mod.fullName());
    const patchTextMorph = id === focusedModuleId;
    if (patchTextMorph && !runLint) sourceCode = sourceEditor.textString;
    let changes = changesByModule[moduleName].map(l => l[1]).flat();
    changes = arr.sortBy(changes, change => change.start).reverse();
    let updatedSource = patchTextMorph && !runLint
      ? applyChangesToTextMorph(sourceEditor, changes)
      : applySourceChanges(sourceCode, changes);
    // ensure we fix all undeclared vars
    ({ changes } = fixUndeclaredVars(updatedSource, requiredBindingsForChanges, mod));

    updatedSource = patchTextMorph && !runLint
      ? applyChangesToTextMorph(sourceEditor, changes)
      : applySourceChanges(updatedSource, changes);

    if (runLint) {
      [updatedSource] = lint(updatedSource);
      if (patchTextMorph) {
        sourceEditor.textString = updatedSource;
      }
    }

    if (patchTextMorph) {
      const browser = sourceEditor.owner;
      if (browser) browser.resetChangedContentIndicator();
    }
    module(moduleName).setSource(updatedSource);
  }
}

/**
 * Abstract class of reconciliation change that happens in response to a direct manipulation by the user.
 * A reconciliation ensures that after it terminates, the component definitions are consistent with the
 * state of the UI. A reconciliation is often covering several definitions and even modules at the same time,
 * since components can be derived various times from different modules.
 */
export class Reconciliation {
  static perform (componentDescriptor, change) {
    let klass;

    if (change.prop) {
      klass = change.prop === 'name' ? RenameReconciliation : PropChangeReconciliation; // eslint-disable-line no-use-before-define
    }

    if (change.selector === 'addMorphAt') {
      klass = MorphIntroductionReconciliation; // eslint-disable-line no-use-before-define
    }

    if (change.selector === 'removeMorph') {
      klass = MorphRemovalReconciliation; // eslint-disable-line no-use-before-define
    }

    if (change.prop === 'textAndAttributes' ||
        change.selector === 'replace' ||
        change.selector === 'addTextAttribute') {
      klass = TextChangeReconciliation; // eslint-disable-line no-use-before-define
      // handle both things in the same class?
    }

    return new klass(componentDescriptor, change).reconcile().applyChanges();
  }

  constructor (componentDescriptor, change) {
    this.changesByModule = [];
    this.requiredBindingsByModule = new Map(); // for any of the changes the accumulated bindings that are required to fullfill the reconciliation
    this.descriptor = componentDescriptor; // the descriptor of the component definition
    this.modulesToLint = new Set(); // wether or not the changes in the source code require the linter in a final pass
    this.change = change;
  }

  // wether or not we are the definition the change originated from (in case of propagation)
  isOrigin (descriptor) { return this.descriptor === descriptor; }

  get target () { return this.change.target; }

  get isDerived () { return this.withinDerivedComponent(this.target); }

  /**
   * If present, returns the first browser that has unsaved changes and
   * the module openend that the component we are tracking is defined in.
   * @type { Text }
   */
  getEligibleSourceEditors (modId, modSource) {
    return getEligibleSourceEditorsFor(modId, modSource);
  }

  recoverRemovedMorphMetaIn (interactiveDescriptor) {
    return this.policyToSpecAndSubExpressions?.get(interactiveDescriptor.__serialize__());
  }

  getDescriptorContext (descr = this.descriptor) {
    const modId = System.decanonicalize(descr.moduleName);

    let sourceCode = descr.getModuleSource();
    let openEditors;
    const [openEditor] = openEditors = this.getEligibleSourceEditors(modId, sourceCode);
    if (openEditor) sourceCode = openEditor.textString;

    // FIXME: cache the AST node and transform them with a source mods library that understands how to patch the ast
    const parsedComponent = descr.getASTNode(sourceCode);
    const requiredBindings = this.requiredBindingsByModule.get(modId) || [];
    if (!this.requiredBindingsByModule.has(modId)) this.requiredBindingsByModule.set(modId, requiredBindings);
    return { modId, parsedComponent, sourceCode, requiredBindings, openEditor, openEditors };
  }

  withinDerivedComponent (aMorph) {
    for (const each of [aMorph, ...aMorph.ownerChain()]) {
      if (each.master) return true;
    }
    return false;
  }

  addChangesToModule (moduleName, newChanges) {
    this.changesByModule.push([moduleName, newChanges]);
  }

  uncollapseSubmorphHierarchy (hiddenSubmorphExpr = false) {
    const hiddenMorph = this.target;
    const { modId, sourceCode, parsedComponent } = this.getDescriptorContext();
    const { changes, needsLinting } = uncollapseSubmorphHierarchy(sourceCode, parsedComponent, hiddenMorph, hiddenSubmorphExpr);
    if (needsLinting) this.modulesToLint.add(modId);
    this.addChangesToModule(modId, changes);
    return this;
  }

  /**
   * Apply the recorded changes to the source code of the affected modules.
   * @param { Text } [editor] - Text morph that stores the source code of the module, which can be altered instead of talking to the module object.
   * @returns { Reconciliation }
   */
  applyChanges () {
    const { openEditors } = this.getDescriptorContext();

    if (openEditors.length > 0) {
      openEditors.map(ed => applyModuleChanges(this, ed));
    } else {
      applyModuleChanges(this);
    } // no open editors

    return this;
  }

  reconcile () {
    notYetImplemented(this.constructor.name + '.reconcile()');
    return this;
  }
}

/**
 * Reconciliation that handles the case where the a morph is removed from a component definition.
 * This usual entails removing the spec that corresponds to that morph, and also removing the mentions
 * of the morph or any of its submorphs in the derived component definitions.
 */
class MorphRemovalReconciliation extends Reconciliation {
  constructor (componentDescriptor, change) {
    super(componentDescriptor, change);
    this.policyToSpecAndSubExpressions = this.descriptor.previouslyRemovedMorphs?.get(this.removedMorph) || new Map();
  }

  reconcile () {
    this.descriptor.recordRemovedMorph(this.removedMorph, this.policyToSpecAndSubExpressions);
    this.removeSpec(this.descriptor);
    return this;
  }

  get removedMorph () { return this.change.args[0]; }
  get previousOwner () { return this.target; }

  /**
   * Reconciles the removal of a morph with the replacement or insertation of a without() call that denotes
   * the structural change in the structure inherited from the parent component.
   * @param { InteractiveDescriptor } interactiveDescriptor - The component descriptor of the definition getting reconciled.
   */
  insertWithoutCall (interactiveDescriptor) {
    const { previousOwner, removedMorph } = this;
    const { modId, sourceCode, parsedComponent, requiredBindings } = this.getDescriptorContext(interactiveDescriptor);

    let closestSubmorphsNode = getProp(getPropertiesNode(parsedComponent, previousOwner), 'submorphs');
    let nodeToRemove = closestSubmorphsNode && getMorphNode(closestSubmorphsNode.value, removedMorph);

    const removeMorphExpr = {
      __expr__: `without('${ removedMorph.name }')`,
      bindings: { [COMPONENTS_CORE_MODULE]: ['without'] }
    };
    requiredBindings.push(...Object.entries(removeMorphExpr.bindings));
    let changes = [];
    let needsLinting = false;
    if (nodeToRemove) {
      changes.push(Object.assign({ action: 'replace' }, nodeToRemove, { lines: [removeMorphExpr.__expr__] }));
    } else {
      ({ needsLinting, changes } = insertMorphExpression(parsedComponent, sourceCode, previousOwner, removeMorphExpr));
    }

    const addCallToAdjust = closestSubmorphsNode && getAddCallReferencing(closestSubmorphsNode.value, removedMorph);
    if (addCallToAdjust) {
      // remove the before string including the comma
      const nameToRemove = addCallToAdjust.arguments[1];
      let start = nameToRemove.start;
      while (sourceCode[start] !== ',') start--;
      changes.push({ action: 'remove', start, end: nameToRemove.end });
    }

    if (needsLinting) this.modulesToLint.add(modId);

    return changes;
  }

  /**
   * Removes a morph from the 'submorphs' property of a component definition.
   * If there's only one morph left in the 'submorphs' array, the entire 'submorphs' property will be removed.
   * The method updates the changes array with the appropriate
   * removal actions and marks the associated module for linting.
   * @param {type} interactiveDescriptor - The descriptor pointing to the affected component definition.
   */
  dropSpec (interactiveDescriptor) {
    const { previousOwner, removedMorph } = this;
    const { modId, parsedComponent } = this.getDescriptorContext(interactiveDescriptor);

    let closestSubmorphsNode = getProp(getPropertiesNode(parsedComponent, previousOwner), 'submorphs');
    let nodeToRemove = closestSubmorphsNode && getMorphNode(closestSubmorphsNode.value, removedMorph);

    const removedExpr = nodeToRemove && this.getRemovedExpression(nodeToRemove);

    const changes = [];
    if (nodeToRemove && closestSubmorphsNode?.value.elements.length < 2) {
      this.modulesToLint.add(modId);
      changes.push(Object.assign({ action: 'remove' }, determineNodeToRemoveSubmorphs(closestSubmorphsNode, parsedComponent, previousOwner)));
    } else if (nodeToRemove) {
      changes.push(Object.assign({ action: 'remove' }, nodeToRemove));
    }
    return [changes, removedExpr];
  }

  /**
   * Applies the source code transformation to the definition of the component
   * where the change originated from. We need to differentiate between alteration
   * of an interhited structure via `without()` or the simple removal of a spec (add() or part() or {})
   * from the submorphs array in the component definition.
   * @param { InteractiveDescriptor } interactiveDescriptor - The descriptor of the component definition the change originated from.
   */
  applyRemovalToOrigin (interactiveDescriptor) {
    if (this.removedMorphWasInherited) return [this.insertWithoutCall(interactiveDescriptor)];
    else return this.dropSpec(interactiveDescriptor);
  }

  get removedFromOriginalContext () {
    const meta = this.recoverRemovedMorphMetaIn(this.descriptor);
    return meta?.wasInherited && this.previousOwner === meta.previousOwner;
  }

  get removedMorphWasInherited () {
    return this.isDerived && (
      !this.removedMorph.__wasAddedToDerived__ ||
      this.removedFromOriginalContext
    );
  }

  /**
   * Apply the source code transformation to the definition of a component
   * *derived* from the component where the change originated from.
   * @param {type} interactiveDescriptor - description
   */
  applyRemovalToDependant (interactiveDescriptor) {
    // we ALWAYS just drop the spec, regardless of the circumstances
    return this.dropSpec(interactiveDescriptor);
  }

  getRemovedExpression (removeExprChange) {
    let subExpr = this.descriptor.getModuleSource().slice(removeExprChange.start, removeExprChange.end);
    try {
      const [exprBody] = parse(subExpr.startsWith('{') ? `(${subExpr})` : subExpr).body;
      if (exprBody.type === 'LabeledStatement') {
        // extract the one element from the elements
        const [removedSpec] = exprBody.body.expression.elements;
        subExpr = subExpr.slice(removedSpec.start, removedSpec.end);
      }
    } finally {
      return { __expr__: subExpr, bindings: [] };
    }
  }

  removeSpec (interactiveDescriptor) {
    let changes, subExpr;
    const isChangeOrigin = this.isOrigin(interactiveDescriptor);
    const insertWithoutCall = isChangeOrigin && this.removedMorphWasInherited;

    if (isChangeOrigin) [changes, subExpr] = this.applyRemovalToOrigin(interactiveDescriptor);
    else [changes, subExpr] = this.applyRemovalToDependant(interactiveDescriptor);

    const subSpec = interactiveDescriptor.stylePolicy.removeSpecInResponseTo(this.change, insertWithoutCall);
    let activeInstance = interactiveDescriptor._cachedComponent;

    // cache the meta information about the removed morph/spec/expression (the trinity)
    let meta = this.recoverRemovedMorphMetaIn(interactiveDescriptor) || { wasInherited: this.removedMorphWasInherited };

    if (activeInstance) {
      activeInstance.withMetaDo({ reconcileChanges: false }, () => {
        interactiveDescriptor.stylePolicy.withSubmorphsInScopeDo(activeInstance, (m) => {
          if (m.name === this.removedMorph.name) {
            m.remove();
            meta.removedMorph = m;
          }
        });
      });
    }

    if (!this.removedMorph.__wasAddedToDerived__) meta.previousOwner = this.previousOwner;

    if (subSpec) meta.subSpec = subSpec;

    if (subExpr) meta.subExpr = subExpr;

    if (!obj.isEmpty(meta)) this.policyToSpecAndSubExpressions.set(interactiveDescriptor.__serialize__(), meta);

    this.addChangesToModule(interactiveDescriptor.moduleName, changes);

    interactiveDescriptor.withDerivedComponentsDo(derivedDescr => {
      this.removeSpec(derivedDescr);
    });
  }
}

/**
 * Reconciliation that handles the case where a morph is introduced into a component definition.
 * This can be a copletely new morph or one that was previously removed from the component in question
 */
class MorphIntroductionReconciliation extends Reconciliation {
  reconcile () {
    const { descriptor, addedMorph } = this;
    const safeName = descriptor.ensureNoNameCollisionInDerived(addedMorph.name);
    if (safeName !== addedMorph.name) {
      addedMorph.withMetaDo({ reconcileChanges: false }, () => {
        addedMorph.name = safeName; // do not reconcile this
      });
    }

    if (this.isReintroduction(descriptor)) {
      this.reintroduceMorph(descriptor);
    } else {
      this.addNewMorph(descriptor);
      descriptor.withDerivedComponentsDo(derivedDescr => {
        this.updateActiveSessionsFor(derivedDescr);
      });
    }
    return this;
  }

  get addedMorph () { return this.change.args[0]; }
  get newOwner () { return this.target; }
  get nextSibling () { return this.newOwner.submorphs[this.newOwner.submorphs.indexOf(this.addedMorph) + 1]; }

  get policyToSpecAndSubExpressions () {
    return this.descriptor.previouslyRemovedMorphs?.get(this.addedMorph);
  }

  /**
   * Wether or not the morph added to the definition
   * had been there previously.
   */
  isReintroduction (interactiveDescriptor) {
    // store the info of previously removed morphs in a history object?
    if (!this.policyToSpecAndSubExpressions) return false;
    const meta = this.recoverRemovedMorphMetaIn(interactiveDescriptor);
    if (!meta.subExpr) return meta.previousOwner === this.newOwner;
    return true;
  }

  generateAddedMorphExpression (addedMorph, nextSibling, requiredBindings) {
    let expr = convertToExpression(addedMorph, { dropMorphsWithNameOnly: false });

    if (addedMorph.master) {
      const metaInfo = addedMorph.master.parent[Symbol.for('lively-module-meta')];
      expr = convertToExpression(addedMorph, {
        exposeMasterRefs: false,
        skipAttributes: [...DEFAULT_SKIPPED_ATTRIBUTES, 'type']
      });
      expr = {
        // this fails when components are alias imported....
        // we can not insert the model props right now
        // this also serializes way too much
        __expr__: `part(${metaInfo.exportedName}, ${expr.__expr__})`,
        bindings: {
          ...expr.bindings,
          [COMPONENTS_CORE_MODULE]: ['part'],
          [metaInfo.moduleId]: [metaInfo.exportedName]
        }
      };
    }

    if (this.isDerived) {
      addedMorph.__wasAddedToDerived__ = true;
      expr.__expr__ = `add(${expr.__expr__}${nextSibling ? `, "${nextSibling.name}"` : ''})`;
      const b = expr.bindings[COMPONENTS_CORE_MODULE] || [];
      b.push('add');
      expr.bindings[COMPONENTS_CORE_MODULE] = b;
    }

    requiredBindings.push(...Object.entries(expr.bindings));
    return expr;
  }

  reintroduceSpec (interactiveDescriptor, spec) {
    const insertedSpec = interactiveDescriptor.stylePolicy.ensureSubSpecFor(this.addedMorph);
    Object.assign(insertedSpec, spec);
  }

  reintroduceExpression (interactiveDescriptor, expr) {
    this.addNewMorph(interactiveDescriptor, expr); // basically the same as just adding the morph but with a fixed expression
  }

  insertMorphInOpenSession (interactiveDescriptor, morphToAdd) {
    const activeInstance = interactiveDescriptor._cachedComponent;
    if (!activeInstance) return;
    activeInstance.withMetaDo({ reconcileChanges: false }, () => {
      interactiveDescriptor.stylePolicy.withSubmorphsInScopeDo(activeInstance, (m) => {
        if (obj.equals(getPathFromMorphToMaster(m), getPathFromMorphToMaster(this.newOwner))) {
          m.addMorph(morphToAdd, this.nextSibling ? m.getSubmorphNamed(this.nextSibling.name) : null);
        }
      });
    });
  }

  /**
   * If a morph is reintroduced that was previously reified via a
   * without() call in the same owner it was removed from, we need
   * to simply remove the without() call instead of adding the spec
   * to the source code.
   * @param {type} interactiveDescriptor - description
   */
  clearWithoutCallIfNeeded (interactiveDescriptor) {
    const { modId, parsedComponent } = this.getDescriptorContext(interactiveDescriptor);
    let closestSubmorphsNode = getProp(getPropertiesNode(parsedComponent, this.newOwner), 'submorphs');
    let nodeToRemove;
    if (closestSubmorphsNode?.value.elements.length < 2) {
      this.modulesToLint.add(modId);
      nodeToRemove = determineNodeToRemoveSubmorphs(closestSubmorphsNode, parsedComponent, this.newOwner.isComponent ? null : this.newOwner);
    } else {
      nodeToRemove = closestSubmorphsNode && getWithoutCall(closestSubmorphsNode.value, this.addedMorph);
    }

    interactiveDescriptor.stylePolicy.removeWithoutCall(this.addedMorph);
    // we also need to reintroduce the removed spec

    if (nodeToRemove) {
      if (nodeToRemove === getPropertiesNode(parsedComponent)) {
        this.addChangesToModule(modId, Object.assign({ action: 'replace', ...nodeToRemove, lines: ['{}'] }));
      } else {
        this.addChangesToModule(modId, Object.assign({ action: 'remove' }, nodeToRemove));
      }
    }
  }

  reintroduceMorph (interactiveDescriptor) {
    // recover the source code from the removed morph and reinsert it at the new position
    const meta = this.recoverRemovedMorphMetaIn(interactiveDescriptor);
    if (meta) {
      let { subSpec: removedSpec, subExpr: removedExpr, removedMorph, previousOwner, wasInherited } = meta;
      if (removedSpec?.props?.__wasAddedToDerived__ && previousOwner !== this.newOwner) {
        removedExpr = this.generateAddedMorphExpression(this.addedMorph, this.nextSibling, []);
      }

      if (wasInherited && this.newOwner === previousOwner) {
        this.clearWithoutCallIfNeeded(interactiveDescriptor);
      }
      // add the spec that was discarded previously into the policy
      this.reintroduceSpec(interactiveDescriptor, removedSpec);
      // add the expr that was discarded previously into the policy
      if ((previousOwner !== this.newOwner || !wasInherited) && removedExpr) {
        this.reintroduceExpression(interactiveDescriptor, removedExpr);
      }
      if (removedMorph) {
        this.insertMorphInOpenSession(interactiveDescriptor, removedMorph);
      }
    }
    // also propagate among dependants, since that means we reintroduce the old specs alongside their custom code
    interactiveDescriptor.withDerivedComponentsDo(derivedDescr => {
      this.reintroduceMorph(derivedDescr);
    });
  }

  addNewMorph (interactiveDescriptor, addedMorphExpr) {
    const { newOwner, addedMorph, nextSibling } = this;

    const { modId, parsedComponent, sourceCode, requiredBindings } = this.getDescriptorContext(interactiveDescriptor);

    if (!addedMorphExpr) {
      addedMorphExpr = this.generateAddedMorphExpression(addedMorph, nextSibling, requiredBindings);
    }

    const { changes, needsLinting } = insertMorphExpression(parsedComponent, sourceCode, newOwner, addedMorphExpr, nextSibling);
    if (needsLinting) this.modulesToLint.add(modId);

    this.addChangesToModule(modId, changes);

    const subSpec = interactiveDescriptor.stylePolicy.ensureSubSpecFor(addedMorph, this.isDerived);
    if (nextSibling) subSpec.before = nextSibling.name;
  }

  updateActiveSessionsFor (interactiveDescriptor) {
    this.insertMorphInOpenSession(interactiveDescriptor, this.addedMorph.copy());
    interactiveDescriptor.stylePolicy.ensureSubSpecFor(this.addedMorph);
    interactiveDescriptor.withDerivedComponentsDo(derivedDescr => {
      this.updateActiveSessionsFor(derivedDescr);
    });
  }
}

/**
 * Reconciles the code in response to a change in one of the properties
 * in the component definition.
 */
class PropChangeReconciliation extends Reconciliation {
  get newValue () {
    return this.change.value;
  }

  /**
   * Checks if a given morph's height is dictated
   * by a layout. In those cases, reconciling the entire
   * extent is skipped and we resort to reconciling the
   * `width` property if applicable.
   * @param { Morph } aMorph - The morph to check for
   * @returns { boolean }
   */
  isResizedVertically (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    return l && l.resizesMorphVertically(aMorph);
  }

  /**
   * Checks if a given morph's width is dictated
   * by a layout. In those cases, reconciling the entire
   * extent is skipped and we resort to reconciling the
   * `height` property if applicable.
   * @param { Morph } aMorph - The morph to check for
   * @returns { boolean }
   */
  isResizedHorizontally (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    return l && l.resizesMorphHorizontally(aMorph);
  }

  handleExtentChange (specNode) {
    const { newValue, target } = this;
    let changedProp = 'extent';
    let deleteWidth = false;
    let deleteHeight = false;
    let valueExpr = this.getExpressionOfValue();
    if (this.isResizedVertically(target)) {
      changedProp = 'width';
      valueExpr = String(newValue.x);
      deleteHeight = true;
    }
    if (this.isResizedHorizontally(target)) {
      changedProp = 'height';
      valueExpr = String(newValue.y);
      deleteWidth = true;
    }
    if (deleteHeight) {
      this.deletePropIn(specNode, 'height');
    }
    if (deleteWidth) {
      this.deletePropIn(specNode, 'width');
    }
    if (deleteWidth || deleteHeight) {
      this.deletePropIn(specNode, 'extent');
    }
    this.patchPropIn(specNode, changedProp, valueExpr);
    return this;
  }

  getSubSpecForTarget () {
    const policy = this.descriptor.stylePolicy;
    if (this.target.master === policy || this.target.isComponent) return policy.spec;
    // what if this is a root component? Then it does not have any master.
    // this does not work if the target is not part of the component scope.
    // instead we need to get the path to the target
    const spec = this.getResponsiblePolicyFor(this.target).getSubSpecFor(this.target.name);
    if (spec.isPolicy) return spec.spec;
    return spec;
  }

  getNodeForTargetInSource (interactiveDescriptor = this.descriptor) {
    const { parsedComponent } = this.getDescriptorContext(interactiveDescriptor);
    const affectedPolicy = getComponentScopeFor(parsedComponent, this.target);
    return getPropertiesNode(affectedPolicy, this.target);
  }

  patchPropIn (specNode, prop, valueAsExpr) {
    const { modId, sourceCode } = this.getDescriptorContext();
    if (valueAsExpr.__expr__) valueAsExpr = valueAsExpr.__expr__;

    if (prop === 'layout') {
      this.modulesToLint.add(modId);
    }

    const propNode = getProp(specNode, prop);

    if (!propNode) {
      this.modulesToLint.add(modId);
      this.addChangesToModule(modId, insertPropChange(
        sourceCode,
        specNode,
        prop,
        valueAsExpr
      ));
      return this;
    }

    const patchPos = propNode.value;
    this.addChangesToModule(modId, [
      { action: 'replace', ...patchPos, lines: [valueAsExpr] }
    ]);

    return this;
  }

  deletePropIn (subSpec, prop, eraseIfEmpty = this.isDerived) {
    const { modId, sourceCode, parsedComponent } = this.getDescriptorContext();
    const { changes, needsLinting } = deleteProp(sourceCode, parsedComponent, subSpec, prop, this.target, eraseIfEmpty);
    if (needsLinting) this.modulesToLint.add(modId);
    this.addChangesToModule(modId, changes);
    return this;
  }

  getResponsiblePolicyFor (target) {
    const pathToResponsiblePolicy = this.target.ownerChain().filter(m => m.master && !m.isComponent).map(m => m.name);
    return this.descriptor.stylePolicy.getSubSpecAt(pathToResponsiblePolicy);
  }

  get propValueDiffersFromParent () {
    let { target, prop } = this.change;
    // FIXME: extract via path instead of name
    const policy = this.getResponsiblePolicyFor(target);
    const { parent } = policy;
    let val;
    if (parent) {
      let synthesized = parent.synthesizeSubSpec(target.name);
      if (synthesized.isPolicy) synthesized = synthesized.synthesizeSubSpec();
      val = synthesized[prop];
    }
    if (typeof val === 'undefined') {
      const { type } = this.getSubSpecForTarget();
      val = getDefaultValueFor(type, prop);
    }
    return !obj.equals(val, this.newValue);
  }

  getExpressionOfValue () {
    const { target, prop, value } = this.change;
    const { requiredBindings } = this.getDescriptorContext();
    let valueAsExpr, members;
    if (members = isFoldableProp(target.constructor, prop)) {
      valueAsExpr = getFoldableValueExpr(prop, value, members, target.ownerChain().length);
    } else {
      valueAsExpr = getValueExpr(prop, value);
    }
    requiredBindings.push(...Object.entries(valueAsExpr.bindings));
    return valueAsExpr;
  }

  reconcile () {
    let { prop } = this.change;

    const specNode = this.getNodeForTargetInSource();

    if (prop === 'name') {
      throw new Error('Cannot handle renaming in a policy reconciliation, since it consitutes a structural change. Use the RenameReconcilation instead.');
    }

    if (!specNode) {
      // what if we have not yet processed the add call?
      if (!this.isDerived) return this;
      return this.uncollapseSubmorphHierarchy();
    }

    this.getSubSpecForTarget()[prop] = this.change.value;
    this.propagateChangeAmongActiveEditSessions(this.descriptor);

    if (prop === 'extent') {
      return this.handleExtentChange(specNode);
    }

    if (this.propValueDiffersFromParent) {
      return this.patchPropIn(specNode, prop, this.getExpressionOfValue());
    }
    delete this.getSubSpecForTarget()[prop];
    return this.deletePropIn(specNode, prop);
  }

  propagateChangeAmongActiveEditSessions (interactiveDescriptor) {
    let activeInstance;
    interactiveDescriptor.withDerivedComponentsDo(descr => {
      if (activeInstance = descr._cachedComponent) {
        activeInstance.withMetaDo({ reconcileChanges: false }, () => {
          activeInstance.master.applyIfNeeded(true);
        });
      }
      this.propagateChangeAmongActiveEditSessions(descr);
    });
  }
}

/**
 * In case a morph is getting renamed, this constitues a structural change since all of the references
 * in the derived components need to be updated in turn in order to still be consistent.
 * The reconciliation also makes sure, that the new name itself does not collide with other morphs in any of the derived policies.
 */
class RenameReconciliation extends PropChangeReconciliation {
  get oldName () { return this.change.prevValue; }
  get newName () { return string.camelCaseString(this.newValue); }
  get renamedMorph () { return this.change.target; }
  get renameComponent () { return this.target.master === this.descriptor.stylePolicy || this.target.isComponent; }

  withinDerivedComponent (aMorph) {
    if (aMorph.__wasAddedToDerived__) return false;
    for (const each of aMorph.ownerChain()) {
      if (each.__wasAddedToDerived__) return false;
      if (each.master) return true;
    }
    return false;
  }

  getSubSpecForTarget (interactiveDescriptor) {
    return interactiveDescriptor.stylePolicy.getSubSpecFor(this.oldName);
  }

  getNodeForTargetInSource (interactiveDescriptor) {
    const { parsedComponent } = this.getDescriptorContext(interactiveDescriptor);
    const affectedPolicy = getComponentScopeFor(parsedComponent, this.target);
    return getPropertiesNode(affectedPolicy, this.oldName);
  }

  /**
   * Reconciles the definition of a component in response to a renaming of a morph in the visual instance of the component.
   * Renaming derived morphs currently has *no* effect on the source, since it is prohibited by the halo.
   * @param { StylePolicy } affectedPolicy - The affected policy where we need to adjust the spec.
   * @param { Object } subSpec - The spec to adjust.
   * @returns { PropChangeReconciliation } The reconciliator object.
   */
  handleRenaming (interactiveDescriptor, local = true) {
    let subSpec = this.getSubSpecForTarget(interactiveDescriptor);
    if (!local) {
      // only proceed to patch the subSpec, if we are really derived!
      if (subSpec?.__wasAddedToDerived__) subSpec = false;
    }
    if (subSpec) {
      subSpec.name = this.newName; // rename the spec object, since it is present
      const specNode = this.getNodeForTargetInSource(interactiveDescriptor);
      if (specNode) this.patchPropIn(specNode, 'name', this.getExpressionOfValue());
    }

    // renaming is a structural change and requires propagation of the changes
    interactiveDescriptor.withDerivedComponentsDo(derivedDescr => {
      this.handleRenaming(derivedDescr, false);
    });

    return this;
  }

  reconcile () {
    if (this.withinDerivedComponent(this.renamedMorph)) {
      throw new Error('Cannot rename a morph that has not been introduced in this component! Please rename the morph in the component it originated from.');
    }
    if (this.renameComponent) {
      return this;
    }

    this.handleRenaming(this.descriptor);
    return this;
  }

  async applyChanges () {
    super.applyChanges();
    if (this.renameComponent) {
      const newMorph = await renameComponent(this.renamedMorph, this.newName);
      if (!this.renamedMorph.world()) return;
      newMorph.openInWorld();
      newMorph.position = this.renamedMorph.position;
      if ($world.halos().find(h => h.target === this.renamedMorph)) $world.showHaloFor(newMorph);
      this.renamedMorph.remove();

      if (newMorph[Symbol.for('lively-module-meta')]?.moduleId === this.renamedMorph[Symbol.for('lively-module-meta')]?.moduleId) return;
      const { openEditors } = this.getDescriptorContext();
      const newModId = System.decanonicalize(newMorph[Symbol.for('lively-module-meta')]?.moduleId);
      openEditors.forEach(ed => {
        const browser = ed.owner;

        browser.searchForModuleAndSelect(newModId);
      });
    }
  }
}

/**
 * In case the textAndAttributes, textString, value or input property of a text morph
 * changes, this requires a specialized handling, since the text property itself can also
 * include morphs. The text therefore constitutes a structural property, similar to the submorphs property.
 */
class TextChangeReconciliation extends PropChangeReconciliation {
  reconcile () {
    const { target: textMorph } = this.change;
    const { requiredBindings, modId } = this.getDescriptorContext();
    const specNode = this.getNodeForTargetInSource();
    if (!specNode) {
      this.uncollapseSubmorphHierarchy();
      return this;
    }
    // if textString/value are present, clear them and use textAndAttributes instead
    const textAttrsAsExpr = getTextAttributesExpr(textMorph);
    requiredBindings.push(...Object.entries(textAttrsAsExpr.bindings));
    this.modulesToLint.add(modId); // laways lint after text and attributes are added
    const textStringProp = getProp(specNode, 'textString');
    const valueProp = getProp(specNode, 'value');
    if (textStringProp) this.deletePropIn(specNode, 'textString', false); // do not remove the entire node even if eligible for now
    if (valueProp) this.deletePropIn(specNode, 'value', false);
    this.patchPropIn(specNode, 'textAndAttributes', textAttrsAsExpr);
    return this;
  }
}
