import { serializeSpec, ExpressionSerializer } from 'lively.serializer2';
import { serializeNestedProp } from 'lively.serializer2/plugins/expression-serializer.js';
import { Icons } from 'lively.morphic/text/icons.js';
import { arr, string, num, obj } from 'lively.lang';
import { parse, query } from 'lively.ast';
import { module } from 'lively.modules/index.js';

export const DEFAULT_SKIPPED_ATTRIBUTES = ['metadata', 'styleClasses', 'isComponent', 'viewModel', 'activeMark', 'positionOnCanvas', 'selectionMode', 'acceptsDrops'];
export const COMPONENTS_CORE_MODULE = 'lively.morphic/components/core.js';
const exprSerializer = new ExpressionSerializer();

export async function getComponentDeclsFromScope (modId, scope) {
  const mod = module(modId);
  if (!scope) scope = await mod.scope();
  const componentDecls = [];
  for (let decl of scope.varDecls) {
    const varName = decl.declarations[0]?.id?.name; // better to use a source descriptor??
    if (!varName) continue;
    const val = mod.recorder[varName];
    if (val?.isComponentDescriptor) {
      componentDecls.push([val, decl]);
    }
  }
  return componentDecls;
}

function getScopeMaster (m) {
  if (m.owner?.isWorld) return m;
  do {
    m = m.owner;
  } while (m && !m.master && !m.isComponent);
  return m;
}

export function getEligibleSourceEditorsFor (modId, modSource) {
  const openBrowsers = $world.withAllSubmorphsSelect(browser =>
    browser.isBrowser && browser.selectedModule && browser.selectedModule.url === modId);
  const qualifiedBrowsers = openBrowsers.filter(openBrowser => {
    if (modSource && openBrowser.hasUnsavedChanges(modSource)) {
      return false;
    }
    return true;
  });
  return qualifiedBrowsers.map(browser => browser.viewModel.ui.sourceEditor);
}

export function getPathFromScopeMaster (m) {
  return arr.takeWhile(m.ownerChain(), m => !m.master && !m.isComponent).map(m => m.name);
}

export function getPathFromMorphToMaster (m) {
  const path = [];
  if (!m.isComponent) path.push(m.name);
  path.push(...getPathFromScopeMaster(m));
  return path;
}

/*************************
 * EXPRESSION GENERATION *
 *************************/

export function standardValueTransform (key, val, aMorph) {
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
}

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
    valueTransform: standardValueTransform,
    ...opts
  }) || { __expr__: false };
  if (!expr) return;
  return {
    bindings,
    __expr__: `${expr.match(/^(morph|part)\(([^]*)\)/)?.[2] || expr}`
  };
}

export function getTextAttributesExpr (textMorph) {
  const expr = convertToExpression(textMorph);
  const rootPropNode = getPropertiesNode(parse('(' + expr.__expr__ + ')'));
  let { start, end } = getProp(rootPropNode, 'textAndAttributes').value; // eslint-disable-line no-use-before-define
  if (expr.__expr__[end - 1] === ',') end--;
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
  if (prop === 'imageUrl' && $world.openedProject && value.includes($world.openedProject.name)) {
    value = value.replaceAll('"', '');
    value = `projectAsset('${value.split('/').pop()}')`;
    bindings['lively.project'] = ['projectAsset'];
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

export function getFoldableValueExpr (prop, foldableValue, members, depth) {
  const withoutValueGetter = obj.extract(foldableValue, members);
  if (new Set(obj.values(withoutValueGetter)).size > 1) {
    return getValueExpr(prop, withoutValueGetter, depth);
  }
  return getValueExpr(prop, foldableValue.valueOf());
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
  if (propsNode.type === 'CallExpression') {
    propsNode = propsNode.arguments[0];
  }
  const [propNode] = query.queryNodes(propsNode, `
  / Property [
    /:key Identifier [ @name == '${prop}' ]
   ]
 `);
  return propNode;
}

export function getParentRef (parsedComponent) {
  const [parentNode] = query.queryNodes(parsedComponent, `
   // CallExpression [
         /:callee Identifier [ @name == 'component']
      ]
 `);
  if (parentNode.arguments.length > 1) return parentNode.arguments[0];
}

/**
 * Returns the AST node of the component declarator inside the module;
 * @param { object } parsedContent - The AST of the module the component definition should be retrieved from.
 * @param { string } componentName - The name of the component.
 * @returns { object } The AST node of the component declarator.
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

export function drillDownPath (startNode, path) {
  // directly resolve step by step with a combo of a submorph/name prop resolution
  if (path.length === 0) return startNode;
  path = [...path]; //  copy the path
  let curr = startNode;
  if (curr.type !== 'ArrayExpression') curr = getProp(curr, 'submorphs')?.value;
  while (path.length > 0) {
    const name = path.shift();
    curr = getNodeFromSubmorphs(curr, name);
    if (path.length > 0 && curr) curr = getProp(curr, 'submorphs')?.value;
    else break;
  }
  return curr;
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

export function getWithoutCall (submorphsNode, aMorph) {
  const [withoutCall] = query.queryNodes(submorphsNode, `
    ./  CallExpression [
         /:callee Identifier [ @name == 'without' ]
      && /:arguments "*" [ Literal [ @value == '${aMorph.name}'] ]
     ]
    `);
  return withoutCall;
}

export function getAddCallReferencing (submorphsNode, aMorph) {
  const [addCall] = query.queryNodes(submorphsNode, `
    ./  CallExpression [
         /:callee Identifier [ @name == 'add' ]
      && /:arguments "*" [ Literal [ @value == '${aMorph.name}'] ]
     ]
    `);
  return addCall;
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

export function preserveFormatting (sourceCode, nodeToRemove) {
  if (!nodeToRemove) return nodeToRemove;
  let commaRemoved = false;

  while (sourceCode[nodeToRemove.end].match(/\,/)) {
    commaRemoved = true;
    nodeToRemove.end++;
  }

  while (!sourceCode[nodeToRemove.start].match(/\,|\n/) &&
         !sourceCode[nodeToRemove.start - 1].match(/\[/)) {
    const aboutToRemoveCommaTwice = commaRemoved && sourceCode[nodeToRemove.start - 1].match(/\,/);
    if (aboutToRemoveCommaTwice) break;
    nodeToRemove.start--;
  }
  return nodeToRemove;
}

export function applySourceChanges (sourceCode, changes) {
  for (let change of changes) {
    // apply the change to the module source
    if (change.action === 'remove') {
      change = preserveFormatting(sourceCode, change);
    }
    sourceCode = string.applyChange(sourceCode, change);
  }
  return sourceCode;
}

export function applyChangesToTextMorph (aText, changes) {
  for (let change of changes) {
    switch (change.action) {
      case 'insert':
        aText.insertText(change.lines.join('\n'), aText.indexToPosition(change.start));
        break;
      case 'remove':
        change = preserveFormatting(aText.textString, change);
        aText.replace({
          start: aText.indexToPosition(change.start),
          end: aText.indexToPosition(change.end)
        }, '');
        break;
      case 'replace':
        aText.replace({
          start: aText.indexToPosition(change.start),
          end: aText.indexToPosition(change.end)
        }, change.lines.join('\n'));
        break;
    }
  }
  return aText.textString;
}

export function scanForNamesInGenerator (closure) {
  return query.queryNodes(parse(`(${closure.toString()})`), `
    //  Property [ /:key Identifier [ @name == 'name' ]]
  `).map(hit => hit.value?.value);
}

export function getAnonymousSpecs (parsedComponent) {
  return query.queryNodes(parsedComponent, `
    // ObjectExpression [
       count(/ Property [
        /:key Identifier [ @name == 'name' ]
       ]) == 0
     ]`);
}

export function getAnonymousAddedParts (parsedComponent) {
  return query.queryNodes(parsedComponent, `
    //  CallExpression [
         /:callee Identifier [ @name == 'add' ]
      && /:arguments "*" [
           CallExpression [
             /:callee Identifier [ @name == 'part' ]
          &&
            count(/ ObjectExpression [
               /:properties "*" [
                   Property [
                      /:key Identifier [ @name == 'name' ]
                   ]
                 ]
               ]) == 0
             
           ]
         ]
       ]
    `);
}

export function getAnonymousParts (parsedComponent) {
  return query.queryNodes(parsedComponent, `
     // CallExpression [
         /:callee Identifier [ @name == 'part' ]
      && count(/ ObjectExpression [
         /:properties "*" [
             Property [
                /:key Identifier [ @name == 'name' ]
             ]
           ]
         ]) == 0
       ]
    `);
}

export { getNodeFromSubmorphs };
