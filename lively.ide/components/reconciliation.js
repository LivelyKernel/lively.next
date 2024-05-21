import { arr, tree, obj, string } from 'lively.lang';
import {
  getNodeFromSubmorphs,
  getAnonymousAddedParts,
  getAnonymousParts,
  getAnonymousSpecs,
  getParentRef,
  getComponentDeclsFromScope,
  getAddCallReferencing,
  getWithoutCall,
  getEligibleSourceEditorsFor,
  applySourceChanges,
  getPathFromMorphToMaster,
  getTextAttributesExpr,
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
import module from 'lively.modules/src/module.js';
import { parse, stringify, nodes, query } from 'lively.ast';
import lint from '../js/linter.js';
import { notYetImplemented } from 'lively.lang/function.js';
import { isFoldableProp, getDefaultValueFor } from 'lively.morphic/helpers.js';
import { resource } from 'lively.resources';
import { ExpressionSerializer } from 'lively.serializer2';
import { PolicyApplicator } from 'lively.morphic/components/policy.js';

export const exprSerializer = new ExpressionSerializer();

function isWithinDerivedComponent (aMorph, includeSelf) {
  // not entirely correct. This will incorrectly return true
  // if there is just an inherited inline policy present
  if (includeSelf && aMorph.master?.parent) return true;
  if (aMorph.__wasAddedToDerived__) return false;
  for (const each of aMorph.ownerChain()) {
    if (each.master?.parent) return true;
    if (each.__wasAddedToDerived__) return false;
  }
  return false;
}

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
    const withinDerived = isWithinDerivedComponent(curr);
    nodeToRemove = withinDerived ? propNode : submorphsNode;
    if (withinDerived && query.queryNodes(propNode, ignoreQuery).length === 0) nodeToRemove = propNode;
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

export function deleteProp (sourceCode, parsedComponent, morphDef, propName, target, eraseIfEmpty) {
  const propNode = getProp(morphDef, propName);
  if (!propNode) {
    return { needsLinting: false, changes: [] };
  }
  if (eraseIfEmpty && morphDef.properties.length < 3) {
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
  const S = mod.System;
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
        moduleId: module(S, importedModuleId).id,
        pathInPackage: module(S, importedModuleId).pathInPackage(),
        packageName: module(S, importedModuleId).package()?.name
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
export async function replaceComponentDefinition (defAsCode, entityName, mod) {
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
export async function insertComponentDefinition (protoMorph, entityName, mod) {
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

export function canBeRenamed (mod, oldName, newName) {
  // if (oldName === newName) return false;
  if (string.camelCaseString(newName) in mod.recorder) return false;
  return true;
}

/**
 * Given a proto morph, rename the corresponding component definition
 * inside of the module it is defined in. In case the component is the
 * top level component that determines the module's name, then we perform
 * a renaming of the module.
 * @param {type} protoMorph - description
 */

export async function renameComponent (protoMorph, newName, system) {
  const meta = protoMorph[Symbol.for('lively-module-meta')];
  if (!meta?.moduleId || !meta?.exportedName) return;
  let mod = module(system, meta.moduleId);
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
      const mod = descr.targetModule;
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
  const morphNode = getMorphNode(parsedComponent, newOwner);
  const propsNode = morphNode && getPropertiesNode(morphNode);
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
      bindings: addedMorphExpr.bindings,
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
      bindings: addedMorphExpr.bindings,
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
  if (!uncollapsedHierarchyExpr) return { changes: [], needsLinting: false, bindings: [] };
  return insertMorphExpression(parsedComponent, sourceCode, nextVisibleParent, uncollapsedHierarchyExpr, nextSibling);
}

export function applyModuleChanges (reconciliation, scope, system, sourceEditor = false) {
  // order each group by module
  // apply bulk to each module
  let { changesByModule, modulesToLint, requiredBindingsByModule } = reconciliation;
  const focusedModuleId = sourceEditor?.editorPlugin?.evalEnvironment.targetModule;
  changesByModule = arr.groupBy(changesByModule, arr.first);
  for (let moduleName in changesByModule) {
    const mod = module(system, moduleName);
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

    let hasUndefinedVariables = false;
    const importedRefs = new Set(scope.importSpecifiers.map(spec => spec.name));
    for (let [_, refs] of requiredBindingsForChanges) {
      if (!refs.every(ref => importedRefs.has(ref))) {
        hasUndefinedVariables = true;
        break;
      }
    }

    if (hasUndefinedVariables) {
    // ensure we fix all undeclared vars, but only if new bindings have been introduced
      ({ changes } = fixUndeclaredVars(updatedSource, requiredBindingsForChanges, mod));
      updatedSource = patchTextMorph && !runLint
        ? applyChangesToTextMorph(sourceEditor, changes)
        : applySourceChanges(updatedSource, changes);
    }

    if (runLint) {
      [updatedSource] = lint(updatedSource);
      if (patchTextMorph) {
        sourceEditor.textString = updatedSource;
      }
    }

    if (patchTextMorph) {
      const browser = sourceEditor.owner;
      if (browser?.isBrowser) browser.resetChangedContentIndicator();
    }
    mod.setSource(updatedSource);
  }
}

/**
 * Abstract class of reconciliation change that happens in response to a direct manipulation by the user.
 * A reconciliation ensures that after it terminates, the component definitions are consistent with the
 * state of the UI. A reconciliation is often covering several definitions and even modules at the same time,
 * since components can be derived various times from different modules.
 */
export class Reconciliation {
  static ensureNamesInSourceCode (componentDescriptor) {
    new EnsureNamesReconciliation(componentDescriptor).reconcile().applyChanges(); // eslint-disable-line no-use-before-define
  }

  static perform (componentDescriptor, change) {
    let klass;

    componentDescriptor.ensureNamesInSourceCode();

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

  get target () { return this.change?.target; }

  get System () { return this.descriptor.System; }

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
    return this.policyToSpecAndSubExpressions?.get(exprSerializer.exprStringEncode(interactiveDescriptor.__serialize__()));
  }

  getDescriptorContext (descr = this.descriptor) {
    if (!this._context) this._context = new Map();
    if (this._context.has(descr)) return this._context.get(descr);
    const modId = System.decanonicalize(descr.moduleName);

    let sourceCode = descr.getModuleSource();
    let openEditors;
    const [openEditor] = openEditors = this.getEligibleSourceEditors(modId, sourceCode);
    if (openEditor) sourceCode = openEditor.textString;

    // FIXME: cache the AST node and transform them with a source mods library that understands how to patch the ast
    // This can be done with: import { print, parse } from 'esm://cache/recast@0.21.5'
    const parsedModule = parse(sourceCode);
    const scope = query.topLevelDeclsAndRefs(parsedModule).scope;
    const parsedComponent = descr.getASTNode(parsedModule);
    const requiredBindings = this.requiredBindingsByModule.get(modId) || [];
    if (!this.requiredBindingsByModule.has(modId)) this.requiredBindingsByModule.set(modId, requiredBindings);
    const ctx = { modId, parsedComponent, sourceCode, requiredBindings, openEditor, openEditors, scope };
    this._context.set(descr, ctx);
    return ctx;
  }

  withinDerivedComponent (aMorph, includeSelf = false) {
    return isWithinDerivedComponent(aMorph, includeSelf);
  }

  addChangesToModule (moduleName, newChanges) {
    this.changesByModule.push([moduleName, newChanges]);
  }

  uncollapseSubmorphHierarchy (hiddenSubmorphExpr = false) {
    const hiddenMorph = this.target;
    const { modId, sourceCode, parsedComponent, requiredBindings } = this.getDescriptorContext();
    const { changes, needsLinting, bindings } = uncollapseSubmorphHierarchy(sourceCode, parsedComponent, hiddenMorph, hiddenSubmorphExpr);
    requiredBindings.push(...Object.entries(bindings));
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
    const { openEditors, scope } = this.getDescriptorContext();

    if (openEditors.length > 0) {
      openEditors.map(ed => applyModuleChanges(this, scope, this.System, ed));
    } else {
      applyModuleChanges(this, scope, this.System);
    } // no open editors

    return this;
  }

  reconcile () {
    notYetImplemented(this.constructor.name + '.reconcile()');
    return this;
  }
}

class EnsureNamesReconciliation extends Reconciliation {
  get spec () {
    return this.descriptor.stylePolicy.spec;
  }

  get target () {
    return this.descriptor._cachedComponent;
  }

  reconcile () {
    const { modId, sourceCode, parsedComponent } = this.getDescriptorContext();
    const anonymousSpecs = getAnonymousSpecs(parsedComponent);
    const anonymousParts = getAnonymousParts(parsedComponent);
    const anonymousAddedParts = getAnonymousAddedParts(parsedComponent);
    const rootNode = getPropertiesNode(parsedComponent);
    // now traverse the specs and the parsed component in tandem
    tree.mapTree([this.spec, rootNode], ([currentSpec, currentNode]) => {
      if (currentNode === rootNode) return;
      const propNode = getPropertiesNode(currentNode);
      const generatedName = currentSpec.props?.name || currentSpec.name;
      if (propNode && anonymousSpecs.includes(propNode) && generatedName) {
        this.addChangesToModule(modId, insertPropChange(
          sourceCode,
          propNode,
          'name',
        `'${generatedName}'`
        ));
        return;
      }
      if (anonymousParts.includes(currentNode)) {
        // insert a name prop object next to the identifier
        this.addChangesToModule(modId, [{
          action: 'insert',
          start: currentNode.arguments[0].end,
          lines: [`, { name: '${generatedName}' }`]
        }]);
      }
      if (anonymousAddedParts.includes(currentNode)) {
        // insert a name prop object
        this.addChangesToModule(modId, [{
          action: 'insert',
          start: currentNode.arguments[0].arguments[0].end,
          lines: [`, { name: '${generatedName}' }`]
        }]);
      }
    }, ([specOrPolicy, node]) => {
      // the node may not be mentioned in the code, when we are in a derived component
      const subNodes = node && getProp(getPropertiesNode(node), 'submorphs')?.value?.elements;
      const subSpecs = [...specOrPolicy.isPolicy
        ? specOrPolicy.spec.submorphs
        : (specOrPolicy.props?.submorphs || specOrPolicy.submorphs)];
      if (subNodes && subSpecs) {
        const specToNodeMapping = new Map();
        for (let spec of subSpecs) {
          // 1.
          // first gather all of the nodes for specs that are inherited
          // if these cant be found in the code, the nodes are declared not present
          if (spec.COMMAND !== 'add' && spec.name) {
            let match = subNodes.find(node => getProp(getPropertiesNode(node), 'name')?.value.value === spec.name);
            if (match) {
              specToNodeMapping.set(spec, match);
              arr.remove(subNodes, match);
              arr.remove(subSpecs, spec);
            }
            // if the spec is in a derived context, then this can be dropped
            if (this.withinDerivedComponent(this.target.getSubmorphNamed(spec.name))) { arr.remove(subSpecs, spec); }
          }
        }

        for (let spec of subSpecs) {
          // 2.
          // now gather all of the specs for specs that were added to derived.
          // these have to be present in the code, if they cant be found this is an error.
          // In case we encounter anonymous added specs, we need to map them by order in the 3rd step.

          // at this point we can assume the all remaing specs are added ones
          if (spec.props?.name) {
            let match = subNodes.find(node => getProp(node, 'name')?.value.value === spec.props.name);
            if (match) {
              specToNodeMapping.set(spec, match);
              arr.remove(subNodes, match);
            }
            arr.remove(subSpecs, spec);
          }
        }
        // 3.
        // we have now mapped all of the specs to nodes via name
        // we are now left with the remaining specs and anonymous nodes, which we map 1 - 1 based on order
        return [...specToNodeMapping.entries(), ...arr.zip(subSpecs, subNodes)];
      }
      return null;
    });
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
  get isDerived () { return this.withinDerivedComponent(this.target, true); }

  /**
   * Reconciles the removal of a morph with the replacement or insertation of a without() call that denotes
   * the structural change in the structure inherited from the parent component.
   * @param { InteractiveDescriptor } interactiveDescriptor - The component descriptor of the definition getting reconciled.
   */
  insertWithoutCall (interactiveDescriptor) {
    const { previousOwner, removedMorph } = this;
    const { modId, sourceCode, parsedComponent, requiredBindings } = this.getDescriptorContext(interactiveDescriptor);

    let closestSubmorphsNode = getProp(getMorphNode(parsedComponent, previousOwner), 'submorphs');
    let nodeToRemove = closestSubmorphsNode && getNodeFromSubmorphs(closestSubmorphsNode.value, removedMorph.name);

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
    let closestSubmorphsNode = getProp(getMorphNode(parsedComponent, previousOwner), 'submorphs');
    let nodeToRemove = closestSubmorphsNode && getNodeFromSubmorphs(closestSubmorphsNode.value, removedMorph.name);

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
        // extract the removed element from the elements
        const [removedSpec] = exprBody.body.expression.elements;
        subExpr = subExpr.slice(removedSpec.start, removedSpec.end);
      }
      if (subExpr.startsWith('add')) {
        // extract the removed element from the elements
        const [removedSpec] = exprBody.expression.arguments;
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

    // the morph was part of the original component, not any derivation
    if (!this.removedMorph.__wasAddedToDerived__) meta.previousOwner = this.previousOwner;

    if (subSpec) meta.subSpec = subSpec;

    if (subExpr) meta.subExpr = subExpr;

    if (!obj.isEmpty(meta)) {
      this.policyToSpecAndSubExpressions.set(
        exprSerializer.exprStringEncode(interactiveDescriptor.__serialize__()),
        meta);
    }

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
    this.fixNameCollisions(descriptor, addedMorph);

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

  adjustNameIfNeeded (aMorph, newName) {
    if (newName !== aMorph.name) {
      aMorph.withMetaDo({ reconcileChanges: false }, () => {
        aMorph.name = newName; // do not reconcile this
      });
    }
  }

  fixNameCollisions (stylePolicyOrDescriptor, rootMorph) {
    rootMorph.withAllSubmorphsDoExcluding(m => {
      // this does not work for inline components
      const safeName = stylePolicyOrDescriptor.ensureNoNameCollisionInDerived(m.name);
      if (m.master && m.master !== stylePolicyOrDescriptor) {
        m.withAllSubmorphsDo(sub => {
          if (sub.__wasAddedToDerived__) {
            this.adjustNameIfNeeded(sub, m.master.ensureNoNameCollisionInDerived(sub.name));
          }
        });
      }
      this.adjustNameIfNeeded(m, safeName);
    }, m => m.master);
  }

  get isDerived () { return this.withinDerivedComponent(this.target, true); }
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
    let closestSubmorphsNode = getProp(getMorphNode(parsedComponent, this.newOwner), 'submorphs');
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
      if (removedSpec?.__wasAddedToDerived__ && previousOwner !== this.newOwner) {
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

    // determine the responsible style policy
    let policyForScope = interactiveDescriptor.stylePolicy.getSubPolicyFor(addedMorph.owner) || interactiveDescriptor.stylePolicy;
    if (addedMorph.owner.master === interactiveDescriptor.stylePolicy) { policyForScope = interactiveDescriptor.stylePolicy; }
    const subSpec = policyForScope.ensureSubSpecFor(addedMorph, this.isDerived);
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

  handleExtentChange (subSpec, specNode) {
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
    subSpec.extent = newValue;
    return this;
  }

  getSubSpecForTarget () {
    const policy = this.descriptor.stylePolicy;
    if (this.target.master === policy || this.target.isComponent) return policy.spec;
    // what if this is a root component? Then it does not have any master.
    // this does not work if the target is not part of the component scope.
    // instead we need to get the path to the target
    const scopePolicy = this.getResponsiblePolicyFor(this.target);
    const spec = scopePolicy.getSubSpecFor(this.target.name);
    if (spec.isPolicy) return spec.spec;
    return spec;
  }

  getNodeForTargetInSource (interactiveDescriptor = this.descriptor) {
    const { parsedComponent } = this.getDescriptorContext(interactiveDescriptor);
    const morphNode = getMorphNode(parsedComponent, this.target);
    return morphNode && getPropertiesNode(morphNode);
  }

  patchPropIn (specNode, prop, valueAsExpr) {
    if (!valueAsExpr) return this;
    const { modId, sourceCode } = this.getDescriptorContext();
    if (valueAsExpr.__expr__) valueAsExpr = valueAsExpr.__expr__;

    const propNode = getProp(specNode, prop);

    if (!propNode) {
      // this is an uncollapse so we need to lint the module
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
    const policy = this.descriptor.stylePolicy.getSubPolicyFor(target) || this.descriptor.stylePolicy;
    if (!policy.isPolicy) return this.descriptor.stylePolicy;
    return policy;
  }

  get propValueDiffersFromParent () {
    let { target, prop } = this.change;
    const policy = this.getResponsiblePolicyFor(target);
    const { parent, targetMorph } = policy;
    let val;
    if (parent) {
      let synthesized = parent.synthesizeSubSpec(target === targetMorph ? null : target.name);
      if (synthesized.isPolicy) synthesized = synthesized.synthesizeSubSpec();
      val = synthesized[prop];
    }
    if (typeof val === 'undefined') {
      const { type } = this.getSubSpecForTarget();
      val = getDefaultValueFor(type, prop);
    }
    return !obj.equals(val, this.newValue);
  }

  getExpressionOfValue (depth = 1) {
    const { target, prop, value } = this.change;
    const { requiredBindings } = this.getDescriptorContext();
    let valueAsExpr, members;
    if (members = isFoldableProp(target.constructor, prop)) {
      valueAsExpr = getFoldableValueExpr(prop, value, members, target.ownerChain().length);
    } else {
      valueAsExpr = getValueExpr(prop, value, depth);
    }
    if (valueAsExpr) { requiredBindings.push(...Object.entries(valueAsExpr.bindings)); }
    return valueAsExpr;
  }

  handleMasterChange (subSpec, specNode, depth) {
    const { target, newValue } = this;
    const responsiblePolicy = this.getResponsiblePolicyFor(target);
    if (!newValue) {
      // clear all of the fields here
      if (subSpec === responsiblePolicy.spec) responsiblePolicy.reset(); // assumes it is a policy
    }
    if (newValue) {
      // then we want to replace the sub spec with a policy (in case the spec is not a policy)
      if (subSpec === responsiblePolicy.spec) {
        // assign masters to the policy
        responsiblePolicy.applyConfiguration(newValue);
      } else {
        // convert spec into policy and replace it
        // we can be sure, that the subSpec *is not* itself a policy
        // because in that case, that other policy would be called to
        // get the enclosing spec...
        let parentSpec = responsiblePolicy.getSubSpecCorrespondingTo(target.owner);
        if (parentSpec.isPolicy) parentSpec = parentSpec.spec;
        parentSpec.submorphs[parentSpec.submorphs.indexOf(subSpec)] = PolicyApplicator.for(target, {
          ...subSpec,
          master: newValue
        });
      }
      if (this.propValueDiffersFromParent) {
        return this.patchPropIn(specNode, 'master', this.getExpressionOfValue(depth));
      }
    }
    return this.deletePropIn(specNode, 'master');
  }

  reconcile () {
    let { prop, target } = this.change;
    const specNode = this.getNodeForTargetInSource();

    if (prop === 'name') {
      throw new Error('Cannot handle renaming in a policy reconciliation, since it consitutes a structural change. Use the RenameReconcilation instead.');
    }

    if (!specNode) {
      // what if we have not yet processed the add call?
      if (!this.isDerived) return this;
      return this.uncollapseSubmorphHierarchy();
    }

    const tabSize = 2;
    const indentDepth = specNode.properties.length > 0 ? (specNode.properties[0].start - specNode.start - 2) / tabSize : 1;
    const subSpec = this.getSubSpecForTarget();

    if (prop === 'master') {
      return this.handleMasterChange(subSpec, specNode, indentDepth);
    }

    if (prop === 'extent') {
      return this.handleExtentChange(subSpec, specNode);
    }

    subSpec[prop] = this.change.value;

    this.propagateChangeAmongActiveEditSessions(this.descriptor);
    // update the source code
    if (this.propValueDiffersFromParent) {
      return this.patchPropIn(specNode, prop, this.getExpressionOfValue(indentDepth));
    }

    delete subSpec[prop];
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

  getSubSpecForTarget (interactiveDescriptor) {
    return interactiveDescriptor.stylePolicy.getSubSpecFor(this.oldName);
  }

  getNodeForTargetInSource (interactiveDescriptor) {
    const { parsedComponent } = this.getDescriptorContext(interactiveDescriptor);
    const affectedPolicy = getMorphNode(parsedComponent, this.target.owner);
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
    this._backups.push(interactiveDescriptor.ensureComponentDefBackup());
    let subSpec = this.getSubSpecForTarget(interactiveDescriptor);
    if (!local) {
      // only proceed to patch the subSpec, if we are really derived!
      if (subSpec?.__wasAddedToDerived__) subSpec = false;
    }

    if (subSpec) {
      subSpec.name = string.decamelize(this.newName); // rename the spec object, since it is present
      const specNode = this.getNodeForTargetInSource(interactiveDescriptor);
      if (specNode) this.patchPropIn(specNode, 'name', this.getExpressionOfValue());
    }

    this.patchOwnerLayoutIfNeeded(interactiveDescriptor);

    // renaming is a structural change and requires propagation of the changes
    interactiveDescriptor.withDerivedComponentsDo(derivedDescr => {
      this.handleRenaming(derivedDescr, false);
    });

    return this;
  }

  patchOwnerLayoutIfNeeded (interactiveDescriptor) {
    const { parsedComponent } = this.getDescriptorContext(interactiveDescriptor);
    const affectedPolicy = getMorphNode(parsedComponent, this.target.owner);
    const parentNode = getPropertiesNode(affectedPolicy, this.target.owner);
    const parentSpec = interactiveDescriptor.stylePolicy.getSubSpecFor(!this.target.owner?.isComponent ? this.owner.name : null);
    if (parentSpec?.layout && parentNode) {
      parentSpec.layout.handleRenamingOf(this.oldName, this.newValue);
      this.patchPropIn(parentNode, 'layout', parentSpec.layout.__serialize__());
    }
  }

  reconcile () {
    this._backups = [];
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
    await Promise.all(this._backups);
    super.applyChanges();
    if (this.renameComponent) {
      const newMorph = await renameComponent(this.renamedMorph, this.newName, this.System);
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
    const styleSpec = this.getSubSpecForTarget();
    styleSpec.textAndAttributes = textMorph.textAndAttributes;
    if (!specNode) {
      this.uncollapseSubmorphHierarchy();
      return this;
    }
    // if textString/value are present, clear them and use textAndAttributes instead
    const textAttrsAsExpr = getTextAttributesExpr(textMorph);
    requiredBindings.push(...Object.entries(textAttrsAsExpr.bindings));
    const textStringProp = getProp(specNode, 'textString');
    const valueProp = getProp(specNode, 'value');
    if (textStringProp || valueProp) this.modulesToLint.add(modId);
    if (textStringProp) this.deletePropIn(specNode, 'textString', false); // do not remove the entire node even if eligible for now
    if (valueProp) this.deletePropIn(specNode, 'value', false);
    this.patchPropIn(specNode, 'textAndAttributes', textAttrsAsExpr);
    return this;
  }

  getAstNodeAndAttributePositionInRange (specNode, pos, textAndAttributes) {
    const textAttrProp = getProp(specNode, 'textAndAttributes');
    if (!textAttrProp) return {};
    if (this.target.textAndAttributes.length !== textAndAttributes.length) return {}; // attributes got added or deleted
    if (this.target.textString.length === 0) return {}; // entire document got deleted
    let attributeStart = 0; let j = 0;
    const startIndex = this.target.positionToIndex(pos);
    while (j < textAndAttributes.length && startIndex > attributeStart + textAndAttributes[j].length) {
      attributeStart += textAndAttributes[j].length;
      j += 2;
    }
    const stringNode = textAttrProp.value.elements[j];
    return { attributeStart, stringNode };
  }

  patchPropIn (specNode, propName, textAttrsAsExpr) {
    const { modId } = this.getDescriptorContext();
    const { args, selector, undo, meta } = this.change;
    const { prevTextAndAttributes } = meta;
    delete meta.prevTextAndAttributes; // delete this huge array in order to save memory
    const defaultPatch = () => {
      this.modulesToLint.add(modId);
      return super.patchPropIn(specNode, propName, textAttrsAsExpr);
    };

    if (!args) return defaultPatch();

    const [changedRange, attrReplacement] = args;

    if (selector === 'replace') {
      const isDeletion = attrReplacement.length === 0 || attrReplacement[0] === '' && attrReplacement[1] === null;
      const isInsertion = !isDeletion && attrReplacement[0].length > 0;
      const { attributeStart, stringNode } = this.getAstNodeAndAttributePositionInRange(specNode, isDeletion ? changedRange.end : changedRange.start, prevTextAndAttributes);

      if (!stringNode) return defaultPatch();

      const manipulationStartIndex = this.target.positionToIndex(changedRange.start);
      if (isDeletion) {
        let deletionIndexInSource = stringNode.start + manipulationStartIndex - attributeStart + 1;
        const deletedTextAndAttrs = undo.args[1];
        if (deletedTextAndAttrs.length > 2) {
          // deletion of multiple text and attributes is too complex to reconcile efficiently
          // perform the default patch instead;
          return defaultPatch();
        }
        // Count numbers of newlines that come **before** the deletion. As those are two characters in the module source (\n),
        // we need to account for each of them with an additional character.
        const lineBreakOffset = (stringNode.value.slice(0, manipulationStartIndex - attributeStart).match(/\n|\"|\'/g) || []).length;
        deletionIndexInSource += lineBreakOffset;
        const deleteCharacters = JSON.stringify(deletedTextAndAttrs[0]).slice(1, -1).replaceAll("'", "\\'").length;
        this.addChangesToModule(modId, [{
          action: 'replace',
          start: deletionIndexInSource,
          end: deletionIndexInSource + deleteCharacters,
          lines: ['']
        }]);
        return this;
      }

      if (isInsertion) {
        let insertionIndexInSource = stringNode.start + manipulationStartIndex - attributeStart + 1;
        // Count numbers of newlines that come **before** the insertion. As those are two characters in the module source (\n),
        // we need to account for each of them with an additional character.
        const lineBreakOffset = (stringNode.value.slice(0, manipulationStartIndex - attributeStart).match(/\n|\"|\'/g) || []).length;
        insertionIndexInSource += lineBreakOffset;
        this.addChangesToModule(modId, [{
          action: 'insert',
          start: insertionIndexInSource,
          lines: [JSON.stringify(attrReplacement[0]).slice(1, -1).replaceAll("'", "\\'")]
        }]);
        return this;
      }
    }

    return defaultPatch();
  }
}
