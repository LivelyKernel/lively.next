import { serializeSpec, ExpressionSerializer } from 'lively.serializer2';
import { serializeNestedProp } from 'lively.serializer2/plugins/expression-serializer.js';
import { Icons } from 'lively.morphic/text/icons.js';
import { arr, num, obj, string } from 'lively.lang';
import { parse, query, stringify, nodes } from 'lively.ast';
import { module } from 'lively.modules/index.js';
import { ImportInjector, ImportRemover } from 'lively.modules/src/import-modification.js';

import lint from '../js/linter.js';
import { undeclaredVariables } from '../js/import-helper.js';

export const DEFAULT_SKIPPED_ATTRIBUTES = ['metadata', 'styleClasses', 'isComponent', 'viewModel', 'activeMark'];
const exprSerializer = new ExpressionSerializer();

function getScopeMaster (m) {
  while (m && !m.master && !m.isComponent) {
    m = m.owner;
  }
  return m;
}

function getPathFromScopeMaster (m) {
  return arr.takeWhile(m.ownerChain(), m => !m.master && !m.isComponent).map(m => m.name);
}

/*************************
 * EXPRESSION GENERATION *
 *************************/

/**
 * Converts a given morph to an expression object that preserves
 * the component definition.
 * @param { Morph } aMorph - The morph to convert to a expression.
 * @param { object } opts - Custom options passed to the serialization. For more info, see `serlializeSpec()`.
 * @returns { object } An expression object.
 */
export function convertToExpression (aMorph, opts = {}) {
  const { __expr__: expr, bindings } = serializeSpec(aMorph, {
    asExpression: true,
    keepFunctions: false,
    exposeMasterRefs: true,
    dropMorphsWithNameOnly: true,
    skipUnchangedFromDefault: true,
    skipUnchangedFromMaster: true,
    skipAttributes: DEFAULT_SKIPPED_ATTRIBUTES,
    valueTransform: (key, val) => {
      if (val && val.isPoint) return val.roundTo(0.1);
      if (key === 'label' || key === 'textAndAttributes') {
        let hit;
        if (Array.isArray(val) && (hit = Object.entries(Icons).find(([iconName, iconValue]) => iconValue.code === val[0]))) {
          return {
            __serialize__ () {
              return {
                __expr__: `Icon.textAttribute("${hit[0]}")`,
                bindings: {
                  'lively.morphic/text/icons.js': ['Icon']
                }
              };
            }
          };
        }
      }
      return val;
    },
    ...opts
  }) || { __expr__: false };
  if (!expr) return;
  return {
    bindings,
    __expr__: `${expr.match(/^(morph|part)\(([^]*)\)/)[2] || ''}`
  };
}

export function getTextAttributesExpr (textMorph) {
  const expr = convertToExpression(textMorph);
  const rootPropNode = parse('(' + expr.__expr__ + ')').body[0].expression;
  const { start, end } = getProp(rootPropNode, 'textAndAttributes').value; // eslint-disable-line no-use-before-define
  expr.__expr__ = expr.__expr__.slice(start - 1, end);
  return expr;
}

/**
 * Converts a certain value to a serializable expression. Requires a name of the property
 * it belongs to, in order to properly convert nested properties.
 * @param { string } prop - The name of the property.
 * @param { * } value - The value of the property to serialize.
 * @returns { object } Converted version of the property value as expression object.
 */
export function getValueExpr (prop, value, depth = 0) {
  let valueAsExpr; let bindings = {};
  if (value && value.isPoint) value = value.roundTo(0.1);
  if (obj.isString(value) || obj.isBoolean(value)) value = JSON.stringify(value);
  if (prop === 'rotation') {
    value = `num.toRadians(${num.toDegrees(value).toFixed(1)})`;
    bindings['lively.lang'] = ['num'];
  }
  if (value && !value.isMorph && value.__serialize__) {
    return value.__serialize__();
  } else if (['borderColor', 'borderWidth', 'borderStyle', 'borderRadius'].includes(prop)) {
    const nested = {};
    value = serializeNestedProp(prop, value, {
      exprSerializer, nestedExpressions: nested, asExpression: true
    }, prop === 'borderRadius' ? ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] : ['top', 'left', 'right', 'bottom']);
    value = obj.inspect(value, {}, depth);
    for (let uuid in nested) {
      const subExpr = nested[uuid];
      value = value.replace(JSON.stringify(uuid), subExpr.__expr__);
      Object.assign(bindings, subExpr.bindings);
    }
  }
  valueAsExpr = {
    __expr__: value,
    bindings
  };

  return valueAsExpr;
}

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

/******************
 * NODE RETRIEVAL *
 ******************/

/**
 * Retrieve a property declaration from a properties nodes.
 * @param { object } propsNode - The AST node of the properties object (spec) for a particular morph in a component definition.
 * @param { string } prop - The name of the prop to retrieve.
 * @returns { object|null } If present, the node the prop def.
 */
export function getProp (propsNode, prop) {
  if (!propsNode) return null;
  const [propNode] = query.queryNodes(propsNode, `
  / Property [
    /:key Identifier [ @name == '${prop}' ]
   ]
 `);
  return propNode;
}

function drillDownPath (startNode, path) {
  // directly resolve step by step with a combo of a submorph/name prop resolution
  let curr = startNode;
  while (path.length > 0) {
    const name = path.shift();
    curr = getNodeFromSubmorphs(curr, name);
    if (path.length > 0 && curr) curr = getProp(curr, 'submorphs')?.value;
    else break;
  }
  return curr;
}

/**
 * Returns the AST node of the component declarator inside the module;
 * @param { object } parsedContent - The AST of the module the component definition should be retrieved from.
 * @param { string } componentName - The name of the component.
 * @returns { object } The AST node of the component declarator*.
 */
export function getComponentNode (parsedModuleContent, componentName) {
  const [parsedComponent] = query.queryNodes(parsedModuleContent, `
  // VariableDeclarator [
        /:id Identifier [ @name == '${componentName}' ]
  ]`);
  return parsedComponent;
}

/**
 * Slight variation to `getComponentNode()`. Here we retrieve the component declaration,
 * which means we include the declarator `component()` as well as the `const` variable
 * the component is assigned to.
 * @param { object } parsedModuleContent - The AST of the entire module where we look for the component definition.
 * @param { string } componentName - The name of the component.
 * @returns { object } The AST node of the component declaration
 */
export function findComponentDef (parsedModuleContent, componentName) {
  return query.queryNodes(parsedModuleContent, `// VariableDeclaration [
          @kind == "const"
          && /:declarations '*' [
            VariableDeclarator [
              /:id Identifier [ @name == "${componentName}"]
            ]
         ]
      ]`)[0];
}

/**
 * Returns the AST node that containts the property attributes of a morph spec within a component definition.
 * @param { object } parsedComponent - The parsed component.
 * @param { Morph|string } aMorphOrName - A morph or name referencing the spec.
 * @returns { object|null } The AST node of the parsed props object.
 */
export function getPropertiesNode (parsedComponent, aMorphOrName) {
  // FIXME: use a name path instead of just the name, since a name alone ignore master scopes
  //        and can therefore easily resolve incorrectly
  let name, aMorph;
  if (!aMorphOrName || aMorphOrName.isComponent) {
    return query.queryNodes(parsedComponent, `
  .//  ObjectExpression
  `)[0];
  }

  if (obj.isString(aMorphOrName)) name = aMorphOrName;
  else {
    aMorph = aMorphOrName;
    name = aMorph.name;
  }

  const morphDefs = query.queryNodes(parsedComponent, `
  .//  ObjectExpression [
         /:properties "*" [
           Property [
              /:key Identifier [ @name == 'name' ]
           && /:value Literal [ @value == '${name}']
           ]
         ]
       ]
  `);
  // always pick the one closest
  // if (morphDefs.length > 1) throw new Error('ambigous name reference: ' + name);
  return morphDefs[0];
}

function getNodeFromSubmorphs (submorphsNode, morphName) {
  const [partOrAddRef] = query.queryNodes(submorphsNode, `
    ./  CallExpression [
         /:callee Identifier [ @name == 'part' || @name == 'add' ]
      && /:arguments "*" [
           CallExpression [
             /:callee Identifier [ @name == 'part' ]
          && /:arguments "*" [
            ObjectExpression [
               /:properties "*" [
                   Property [
                      /:key Identifier [ @name == 'name' ]
                   && /:value Literal [ @value == '${morphName}']
                   ]
                 ]
               ]
             ]
           ]
           || ObjectExpression [
               /:properties "*" [
                 Property [
                    /:key Identifier [ @name == 'name' ]
                 && /:value Literal [ @value == '${morphName}']
                 ]
               ]
             ]
           ]
         ]
    `);
  if (partOrAddRef) return partOrAddRef; // FIXME: how can we express this in a single query?
  const [propNode] = query.queryNodes(submorphsNode, `
  ./  ObjectExpression [
         /:properties "*" [
           Property [
              /:key Identifier [ @name == 'name' ]
           && /:value Literal [ @value == '${morphName}']
           ]
         ]
       ]
  `);
  return propNode;
}

/**
 * Slight variation of getPropertiesNode().
 * In cases where a derived morph is added to a component definition
 * this function will retreive the AST node that *includes* the `part()` or `add()`
 * call. This is useful when we want to remove this node entirely from a definition.
 * (Just removing the node returned by getPropertiesNode() will result in empty `part()` or `add()`
 * left over in the code).
 * @param { object } parsedComponent - The parsed component definition wherein we look for the morph node.
 * @param { Morph } aMorph - A morph object we use the name of to find the properties node in the definition.
 * @returns { object|null } The AST node comprising the `part()`/`add()` call, if nessecary.
 */
export function getMorphNode (componentScope, aMorph) {
  // often the morph node is just the properties node itself
  // but when the morph is derived from another master component
  // it is wrapped inside the part() call, which then needs to be returned
  const path = getPathFromScopeMaster(aMorph).reverse();
  const ownerNode = drillDownPath(componentScope, path);
  if (!ownerNode) return null;
  let submorphsNode;
  if (ownerNode.type === 'ArrayExpression') submorphsNode = ownerNode;
  else submorphsNode = getProp(ownerNode, 'submorphs')?.value;
  if (!submorphsNode) return null;
  return getNodeFromSubmorphs(submorphsNode, aMorph.name);
}

/**
 * Given the AST of a component definition and a morph that appears somewhere
 * in the structure generated by the component definition, returns the properties node
 * of the morph that belongs to a policy that manages the morph in question.
 * E.g: Given a component definition:
 *  component({
 *     ....
 *     submorphs: [
 *        ...
 *        part(X, {
 *           name: 'bob',
 *           ....
 *           submorphs: [ ... { submorphs: [{ name: 'alice'}] ....]
 *        })
 *     ]
 *  })
 * This method will return the properties node of bob if given a morph generated by 'alice'.
 * @param { object } parsedComponent - The AST of the entire component definition.
 * @param { Morph } morphInScope - The morph that was generated from the component.
 * @returns { object } The properties node of the morph
 */
export function getComponentScopeFor (parsedComponent, morphInScope) {
  let m = getScopeMaster(morphInScope);
  if (!m) return parsedComponent;
  try {
    return getPropertiesNode(parsedComponent, m) || parsedComponent;
  } catch (err) {

  }
  const nestedComponentScope = getComponentScopeFor(parsedComponent, m.owner);
  return getPropertiesNode(nestedComponentScope, m);
}

/************************
 * SOURCE CODE PATCHING *
 ************************/

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
  let insertPos = arr.last(submorphsArrayNode.elements).end;
  if (nextSibling) {
    const siblingNode = getNodeFromSubmorphs(submorphsArrayNode, nextSibling.name);
    insertPos = siblingNode.start;
    addedMorphExpr += ',';
  } else {
    addedMorphExpr = ',' + addedMorphExpr;
  }
  if (sourceEditor) {
    sourceEditor.insertText(addedMorphExpr, sourceEditor.indexToPosition(insertPos));
    return sourceEditor.textString;
  }

  return string.applyChanges(sourceCode, [
    { action: 'insert', start: insertPos, lines: [addedMorphExpr] }
  ]);
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
export function insertProp (sourceCode, propertiesNode, key, valueExpr, sourceEditor = false) {
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
  if (isVeryFirst) {
    keyValueExpr = `{${keyValueExpr}\n}`;
    if (sourceEditor) {
      sourceEditor.replace({
        start: sourceEditor.indexToPosition(propertiesNode.start),
        end: sourceEditor.indexToPosition(propertiesNode.end)
      }, keyValueExpr);
      return sourceEditor.textString;
    }
    return string.applyChanges(sourceCode, [
      { action: 'remove', ...propertiesNode },
      { action: 'insert', start: insertationPoint, lines: [keyValueExpr] }
    ]);
  }

  if (sourceEditor) {
    sourceEditor.insertText(keyValueExpr, sourceEditor.indexToPosition(insertationPoint));
    return sourceEditor.textString;
  }
  return string.applyChanges(sourceCode, [
    { action: 'insert', start: insertationPoint, lines: [keyValueExpr] }
  ]);
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
  if (undeclared.length === 0) return sourceCode;
  let updatedSource = sourceCode;
  for (let [importedModuleId, exportedIds] of requiredBindings) {
    for (let exportedId of exportedIds) {
      // check if binding already present and continue if that is the case
      if (!undeclared.includes(exportedId)) continue;
      arr.remove(undeclared, exportedId);
      updatedSource = ImportInjector.run(System, mod.id, mod.package(), updatedSource, {
        exported: exportedId,
        moduleId: importedModuleId
      }).newSource;
    }
  }
  return updatedSource;
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
      { start, end, action: 'remove' },
      { start, action: 'insert', lines: [defAsCode] }
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
      return fixUndeclaredVars(oldSource + decl, Object.entries(requiredBindings), mod) +
      `\n\nexport { ${entityName} }`;
    }
    // insert before the exports
    const updatedExports = {
      ...finalExports,
      specifiers: [...finalExports.specifiers, nodes.id(entityName)]
    };

    return lint(fixUndeclaredVars(
      string.applyChanges(oldSource, [
        { action: 'remove', ...finalExports },
        { action: 'insert', start: finalExports.start, lines: [decl, stringify(updatedExports)] }
      ]),
      Object.entries(requiredBindings),
      mod))[0];
  });
}
