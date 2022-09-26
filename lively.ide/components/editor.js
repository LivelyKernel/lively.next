import { serializeSpec, ExpressionSerializer } from 'lively.serializer2';
import { Icons } from 'lively.morphic/text/icons.js';
import { arr, obj, fun, promise, string } from 'lively.lang';
import ASTQ from 'esm://cache/astq@2.7.5';
import { parse, stringify } from 'lively.ast';
import { Range } from 'lively.morphic/text/range.js';
import { module } from 'lively.modules/index.js';
import { connect, signal } from 'lively.bindings';
import lint from '../js/linter.js';
import { ImportInjector } from 'lively.modules/src/import-modification.js';
import { undeclaredVariables } from '../js/import-helper.js';
import { serializeNestedProp } from 'lively.serializer2/plugins/expression-serializer.js';
import { ComponentDescriptor, morph } from 'lively.morphic';
import { id } from 'lively.ast/lib/nodes.js';
import * as Browser from '../js/browser/ui.cp.js';

const astq = new ASTQ();
astq.adapter('mozast');
const exprSerializer = new ExpressionSerializer();

const DEFAULT_SKIPPED_ATTRIBUTES = ['metadata', 'styleClasses', 'isComponent', 'viewModel', 'activeMark'];
const COMPONENTS_CORE_MODULE = 'lively.morphic/components/core.js';

function convertToSpec (aMorph, opts = {}) {
  const { __expr__: expr, bindings } = serializeSpec(aMorph, {
    asExpression: true,
    keepFunctions: true,
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
// expr = await convertToSpec(this.get('default message morph'))
// expr = await convertToSpec(that)

export function createInitialComponentDefinition (aComponent, asExprObject = false) {
  let { __expr__, bindings } = convertToSpec(aComponent, {
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

// the cheap way is just to generate a new spec
// however:
//  1. this is most inefficient solution (slow)
//  2. it is hard to preserve custom formatting of the programmer's code
//
// instead we want to rather patch the source as needed to reconcile changes
// that happen in direct manipulation

/******************
 * NODE RETRIEVAL *
 ******************/

function getComponentNode (parsedContent, componentName) {
  const [parsedComponent] = astq.query(parsedContent, `
  // VariableDeclarator [
        /:id Identifier [ @name == '${componentName}' ]
  ]`);
  return parsedComponent;
}

function getPropertiesNode (parsedComponent, aMorph) {
  // fixme: This does not take into account the name unique name path
  //        and often incorrectly resolves the source code location

  if (aMorph.isComponent) {
    // then the name is more or less irrelevant
    return astq.query(parsedComponent, `
  .//  ObjectExpression [
         /:properties "*"
       ]
  `)[0];
  }

  const morphDefs = astq.query(parsedComponent, `
  .//  ObjectExpression [
         /:properties "*" [
           Property [
              /:key Identifier [ @name == 'name' ]
           && /:value Literal [ @value == '${aMorph.name}']
           ]
         ]
       ]
  `);
  if (morphDefs.length > 1) throw new Error('ambigous name reference: ' + aMorph.name);
  return morphDefs[0];
}

function getMorphNode (parsedComponent, aMorph) {
  // often that is just the properties node itself
  // but when the morph is derived from another master component
  // it is wrapped inside the part() call, which then needs to be returned
  // if (!aMorph.isComponent && aMorph.master) {
  // parsedComponent = parse(`part(Troller, { name: 'troller'});`)
  const [partRef] = astq.query(parsedComponent, `
    //  CallExpression [
         /:arguments "*" [
           ObjectExpression [
             /:properties "*" [
               Property [
                  /:key Identifier [ @name == 'name' ]
               && /:value Literal [ @value == '${aMorph.name}']
               ]
             ]
           ]
         ]
       ]
    `);
  if (partRef) { return partRef; } // covers part() and add() cases
  // }
  // also catch the case where we are wrapped inside an add call
  return getPropertiesNode(parsedComponent, aMorph);
}

function getProp (morphDef, prop) {
  // morphName itself can be ambiguous... work with relative paths instead?
  // the tooling should prevent users from adding morphs with the same name
  // like force a different name if a conflicting one is added to the hierarchy
  const [propNode] = astq.query(morphDef, `
  / Property [
    /:key Identifier [ @name == '${prop}' ]
   ]
 `);
  return propNode;
}

function getSubmorphsArrayNode (parsedComponent, ownerMorph) {
  const morphDef = getPropertiesNode(parsedComponent, ownerMorph);
  if (!morphDef) {
    // in this case the owner wasn't event declaredin the component def
    // if that is the case the morph definition was omitted because it is
    // already defined in another master component definition.
    // Consequently we need to
    return;
  }
  const submorphsPropNode = getProp(morphDef, 'submorphs');
  if (submorphsPropNode) {
    return submorphsPropNode.value;
  }
}

function getComponentScopeFor (parsedComponent, morphInScope) {
  let m = morphInScope;
  // there are multiple scenarios we can ancounter
  while (!m.master && !m.isComponent) {
    m = m.owner;
    // 1. there are no scope confilcts since no part references exist
    if (!m) return parsedComponent;
  }
  // 2. all duplicates are scoped by masters properly:
  //      - if all code present, just return that scope
  //      - if code missing do not return that scope, instead return the original scope. The uncollapse will
  //        be handled by other code thereby correclty inserting the morph into the code.
  try {
    return getPropertiesNode(parsedComponent, m) || parsedComponent;
  } catch (err) {

  }
  // 3. the master component itself was ambigous. Now we recursively call the function for the next scope
  //    and then repeat the query on the recursive result
  const nestedComponentScope = getComponentScopeFor(parsedComponent, m);
  return getPropertiesNode(nestedComponentScope, m);
}

function getValueExpr (prop, value) {
  let valueAsExpr;
  if (value && value.isPoint) value = value.roundTo(0.1);
  if (value && !value.isMorph && value.__serialize__) {
    return value.__serialize__();
  } else if (['borderColor', 'borderWidth', 'borderStyle', 'borderRadius'].includes(prop)) {
    const n = {};
    value = serializeNestedProp(prop, value, {
      exprSerializer, nestedExpressions: n, asExpression: true
    }, prop === 'borderRadius' ? ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] : ['top', 'left', 'right', 'bottom']);
  }
  valueAsExpr = {
    __expr__: JSON.stringify(value),
    bindings: {}
  };

  return valueAsExpr;
}

/************************
 * SOURCE CODE PATCHING *
 ************************/

// what to do if no sourceEditor present?
// There could be an interface for editing master components that is devoid of
// any source code (editor). This would be particulary useful for designers. In those cases
// we would just utilize the source string and the ast nodes to create updated versions
// of the component definitions. When this is too slow it is enought to just debounce the updates
// since immediate reflection of the changes in source code is not important to the designer.
//   [direct manipulation] ---- eventually --> [module change]
//            \===== immediate =====> [derived morphs change]
// when a programmer wants to see the changes reflect immediately, it makes sense to tie a code editor
// to the directly manipulated master component. How should that look like? Is such a connection needed?
// At any rate, in those cases we want to ensure fast and immediate updates in the source code when a
// component is manipulated. While the module source itself can be debounced the source code needs to be
// changed as quickly and efficiently as possible to ensure responsiveness.
//  [ direct manipulation] === immediate ===> [editor change] ---- eventually ---> [module change]
//              \===== immediate =====> [derived morphs change]

function insertMorph (sourceCode, submorphsArrayNode, addedMorphExpr, sourceEditor = false) {
  // insert the morph at the end of the submorphs array
  const insertPos = arr.last(submorphsArrayNode.elements).end;
  // Fixem: handle different insertation points... right now we always handle addMorph to end
  addedMorphExpr = ',' + addedMorphExpr;
  if (sourceEditor) {
    sourceEditor.insertText(addedMorphExpr, sourceEditor.indexToPosition(insertPos));
    return sourceEditor.textString;
  }

  return string.applyChanges(sourceCode, [
    { action: 'insert', start: insertPos, lines: [addedMorphExpr] }
  ]);
}

function fixUndeclaredVars (updatedSource, requiredBindings, mod) {
  const knownGlobals = mod.dontTransform;
  const undeclared = undeclaredVariables(updatedSource, knownGlobals).map(n => n.name);
  if (undeclared.length === 0) return updatedSource;
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

export async function insertComponentDefinition (protoMorph, variableName, modId) {
  const mod = module(modId);
  const scope = await mod.scope();
  // in case there is already a component definition with such a name, raise an error
  mod.changeSourceAction(oldSource => {
    // insert the initial component definition into the back end of the module
    const { __expr__: compCall, bindings: requiredBindings } = createInitialComponentDefinition(protoMorph, true);
    const decl = `\n\const ${variableName} = ${compCall}`;

    // if there is a bulk export, insert the export into that batch, and also do not put
    // the declaration after these bulk exports.
    const finalExports = arr.last(scope.exportDecls);
    if (!finalExports) {
      return fixUndeclaredVars(oldSource + decl, Object.entries(requiredBindings), mod) +
      `\n\nexport { ${variableName} }`;
    }
    // insert before the exports
    const updatedExports = {
      ...finalExports,
      specifiers: [...finalExports.specifiers, id(variableName)]
    };

    return lint(oldSource.slice(0, finalExports.start) + decl + stringify(updatedExports) + oldSource.slice(finalExports.end))[0];
  });

  const browser = Browser.browserForFile(modId) || $world.execCommand('open browser', null);
  browser.getWindow().activate();
  await browser.searchForModuleAndSelect(modId);
}

function insertProp (sourceCode, propertiesNode, key, valueExpr, sourceEditor = false) {
  // determine where to insert the new property
  // after name and type and before submorphs if present
  // fixme: ensure to be inserted after both type and name
  const nameProp = propertiesNode.properties.findIndex(prop => prop.key.name === 'name');
  const typeProp = propertiesNode.properties.findIndex(prop => prop.key.name === 'type');
  const afterProp = propertiesNode.properties[Math.max(typeProp, nameProp)];
  const keyValueExpr = ',\n' + key + ': ' + valueExpr;
  let insertationPoint;
  if (!afterProp || key === 'submorphs') {
    insertationPoint = arr.last(propertiesNode.properties).end;
  }
  if (afterProp && !insertationPoint) {
    insertationPoint = afterProp.end;
  }

  if (sourceEditor) {
    // ensure that this does not count as unsaved change...
    sourceEditor.insertText(keyValueExpr, sourceEditor.indexToPosition(insertationPoint));
    return sourceEditor.textString;
  }
  return string.applyChanges(sourceCode, [
    { action: 'insert', start: insertationPoint, lines: [keyValueExpr] }
  ]);
}

// m = morph()
// tracker = new ComponentChangeTracker
// connect(m, 'onSubmorphChange', tracker, 'update', { garbageCollect: true })
// m2 = m.copy()
// m2.attributeConnections

// these change trackers also listen for evals of the componet module
// and then make sure the new master components replace the currently
// visible ones seamlessly so direct manipulation does not happen on
// abandoned master components any more.

export class ComponentChangeTracker {
  static async injectComponentTrackers (componentModuleId) {
    const mod = module(componentModuleId);
    if (mod.id.endsWith('.cp.js')) {
      const moduleExports = await mod.exports();
      // also for non exported components!
      moduleExports
        .map(exp => mod.recorder[exp.local])
        .filter(m => m.isComponent)
        .forEach(c => {
          if (!c._changeTracker) { new ComponentChangeTracker(c); }
        });
    }
  }

  constructor (aComponent, descriptor, oldName = aComponent.name) {
    this.trackedComponent = aComponent;
    this.componentModuleId = aComponent[Symbol.for('lively-module-meta')].moduleId;
    this.componentModule = module(this.componentModuleId);
    this.componentDescriptor = descriptor;
    connect(aComponent, 'onSubmorphChange', this, 'processChangeInComponent', { garbageCollect: true });
    connect(aComponent, 'onChange', this, 'processChangeInComponent', { garbageCollect: true });
    aComponent._changeTracker = this;
    this.replaceAbandonedComponent(oldName);
  }

  get componentPolicy () { return this.componentDescriptor.stylePolicy; }

  whenReady () {
    return !!this.componentModule.source(); // ready once the source is fetched
  }

  equals (otherTracker, componentName) {
    return this.componentModuleId === otherTracker.componentModuleId &&
           otherTracker.trackedComponent.name === componentName;
  }

  highlightMorphInSource (aSubmorph) {
    // based on the master scope of the morph,
    // we determine if an open system browser
    // exists that allows us to highlight the
    // definition of this morph inside the source
  }

  get sourceEditor () {
    // find the first system browser that has no unsaved changes
    // and displays the current module
    const openBrowsers = $world.withAllSubmorphsSelect(browser =>
      browser.isBrowser && browser.selectedModule && browser.selectedModule.url.replace(System.baseURL, '') === this.componentModuleId);
    const qualifiedBrowser = openBrowsers.find(openBrowser => {
      if (this.currentModuleSource && openBrowser.hasUnsavedChanges(this.currentModuleSource)) {
        return false;
      }
      return true;
    });
    if (qualifiedBrowser) return qualifiedBrowser.viewModel.ui.sourceEditor;
  }

  get currentModuleSource () {
    return this.componentModule._source;
  }

  get componentName () {
    return this.componentPolicy[Symbol.for('lively-module-meta')].exportedName;
  }

  withinDerivedComponent (aMorph) {
    // that is not enough. If we are wrapped by an add call that does not
    // contain part() we are not within a derived component
    for (const each of [aMorph, ...aMorph.ownerChain()]) {
      if (each.master) return true;
      if (each.__wasAddedToDerived__) return false;
    }
    return false;
  }

  replaceAbandonedComponent (componentName) {
    const abandonedComponent = $world.withAllSubmorphsDetect(m => {
      if (m.isComponent && m._changeTracker) {
        return this.equals(m._changeTracker, componentName);
      }
    });
    if (abandonedComponent) {
      const pos = abandonedComponent.position;
      const owner = abandonedComponent.owner;
      const idx = owner.submorphs.indexOf(abandonedComponent);
      abandonedComponent.remove();
      owner.addMorphAt(this.trackedComponent, idx);
      this.trackedComponent.position = pos;
      // refresh the scene graph if present!
      $world.sceneGraph?.reset($world);
    }
  }

  uncollapseSubmorphHierarchy (sourceCode, parsedComponent, hiddenMorph, sourceEditor = false) {
    this.needsLinting = true;
    // completely serialize the component and replace the properties obj
    let nextVisibleParent = hiddenMorph;
    const ownerChain = [hiddenMorph];
    let propertiesNode;
    do {
      hiddenMorph = nextVisibleParent;
      nextVisibleParent = nextVisibleParent.owner;
      ownerChain.push(nextVisibleParent);
      propertiesNode = getPropertiesNode(parsedComponent, nextVisibleParent);
    } while (!propertiesNode);
    const masterInScope = arr.findAndGet(hiddenMorph.ownerChain(), m => m.master);
    const uncollapsedHierarchyExpr = convertToSpec(hiddenMorph, {
      onlyInclude: ownerChain,
      exposeMasterRefs: false,
      masterInScope,
      skipAttributes: [...DEFAULT_SKIPPED_ATTRIBUTES, 'master', 'type']
    });
    if (!uncollapsedHierarchyExpr) return sourceCode;
    // insert at the right position
    return this.addMorph(parsedComponent, sourceCode, nextVisibleParent, uncollapsedHierarchyExpr, sourceEditor);
  }

  addMorph (parsedComponent, sourceCode, newOwner, addedMorphExpr, sourceEditor) {
    const submorphsArrayNode = getSubmorphsArrayNode(parsedComponent, newOwner);
    this.needsLinting = true;
    // check if the component is derived or not
    if (!submorphsArrayNode) {
      // this may also because the morph def is simply not present
      // because we altered a submorph derived from a different component
      // in those cases we are inside part() call that allows to
      // skip certain submorphs or a derived component(masterComponent, {})
      // where the same holds. In those situations we need to uncollapse
      let propertiesNode = getPropertiesNode(parsedComponent, newOwner);
      if (!propertiesNode) {
        sourceCode = this.uncollapseSubmorphHierarchy(
          sourceCode,
          parsedComponent,
          newOwner,
          sourceEditor);
        parsedComponent = getComponentScopeFor(parse(sourceCode), newOwner);
        propertiesNode = getPropertiesNode(parsedComponent, newOwner);
      }
      return insertProp(
        sourceCode,
        propertiesNode,
        'submorphs',
          `[${addedMorphExpr.__expr__}]`,
          sourceEditor);
    } else {
      return insertMorph(sourceCode, submorphsArrayNode, addedMorphExpr.__expr__, sourceEditor);
    }
  }

  patchProp (sourceCode, morphDef, propName, valueExpr, sourceEditor = false) {
    const propNode = getProp(morphDef, propName);
    if (!propNode) {
    // the property did not exist and needs to be added to the properties
      this.needsLinting = true;
      return insertProp(
        sourceCode,
        morphDef,
        propName,
        valueExpr,
        sourceEditor
      );
    }

    const patchPos = propNode.value;

    if (sourceEditor) {
      const patchableRange = Range.fromPositions(
        sourceEditor.indexToPosition(patchPos.start),
        sourceEditor.indexToPosition(patchPos.end)
      );
      sourceEditor.replace(patchableRange, valueExpr);
      return sourceEditor.textString;
    }

    if (!sourceEditor) {
      return string.applyChanges(sourceCode, [
        { action: 'remove', ...patchPos },
        { action: 'insert', start: patchPos.start, lines: [valueExpr] }
      ]);
    }
  }

  deleteProp (sourceCode, morphDef, propName, sourceEditor = false) {
    const propNode = getProp(morphDef, propName);
    if (!propNode) {
      // no prop node nothing needs to be done
      return sourceCode;
    }

    const patchPos = propNode;
    if (sourceCode[patchPos.end] === ',') patchPos.end++;
    this.needsLinting = true;

    if (sourceEditor) {
      const patchableRange = Range.fromPositions(
        sourceEditor.indexToPosition(patchPos.start),
        sourceEditor.indexToPosition(patchPos.end)
      );
      sourceEditor.replace(patchableRange, '');
      return sourceEditor.textString;
    }

    if (!sourceEditor) {
      return string.applyChanges(sourceCode, [
        { action: 'remove', ...patchPos }
      ]);
    }
  }

  onceChangesProcessed () {
    return this._finishPromise ? this._finishPromise.promise : Promise.resolve(true);
  }

  isPositionedByLayout (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    return l && l.layoutableSubmorphs.includes(aMorph);
  }

  isResizedVertically (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    return l && l.resizesMorphVertically(aMorph);
  }

  isResizedHorizontally (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    return l && l.resizesMorphHorizontally(aMorph);
  }

  ignoreChange (change) {
    if (change.meta && change.meta.skipReconciliation) return true;
    if (change.prop === 'position' && (change.target === this.trackedComponent || this.isPositionedByLayout(change.target))) return true;
    if (change.prop && change.prop !== 'textAndAttributes' && !change.target.styleProperties.includes(change.prop)) return true;
    if (change.target.epiMorph) return true;
    if (['addMorphAt', 'removeMorph'].includes(change.selector) &&
        change.args.some(m => m.epiMorph)) return true;
    if (change.selector !== 'addMorphAt' && change.meta && (change.meta.metaInteraction || change.meta.isLayoutAction)) return true;
    const { changeManager } = change.target.env;
    // fixme: maybe ignoring grouped changes alltogether can cause issues with reconciliation...
    if (change.selector !== 'addMorphAt' && changeManager.changeGroupStack.length > 0) {
      return true;
    }
    if (!change.selector && obj.equals(change.prevValue, change.value)) return true;
    return false;
  }

  async processChangeInComponent (change) {
    if (this.ignoreChange(change)) return;
    this.processChangeInComponentPolicy(change);
    await this.processChangeInComponentSource(change);
  }

  processChangeInComponentPolicy (change) {
    this._lastChange = change;
    if (change.prop) {
      const policy = this.componentPolicy || change.target.master;
      if (!policy) return;
      const subSpec = policy.ensureSubSpecFor(change.target);
      subSpec[change.prop] = change.value;
    }
    this.refreshDependants();
  }

  refreshDependants () {
    this.componentDescriptor?.refreshDependants();
  }

  processChangeInComponentSource (change) {
    const { componentModule: mod, componentName, sourceEditor } = this;

    if (!mod) return;

    // if morph is amanged by tiling layout and the prop is extent, check if
    // that is actually already defined by layout
    // if resize policy is set to fixed for either width or height replace
    // extent property by width or height (clear the extent entirely if needed)
    // prefer this.intermediateSource instead for fast consecutive changes
    let sourceCode = (sourceEditor ? sourceEditor.textString : mod._source);
    if (!sourceCode) {
      mod.source();
      return;
    }
    const parsedContent = parse(sourceCode);
    const parsedComponent = getComponentNode(parsedContent, componentName);
    let updatedSource = sourceCode;
    let requiredBindings = [];

    // handle a prop change
    if (change.prop) {
      const valueAsExpr = getValueExpr(change.prop, change.value);
      requiredBindings.push(...Object.entries(valueAsExpr.bindings));
      let responsibleComponent = getComponentScopeFor(parsedComponent, change.target);
      const morphDef = getPropertiesNode(responsibleComponent, change.target);
      if (change.prop === 'layout') {
        this.needsLinting = true;
      }
      if (!morphDef) {
        // the entire morph does not exist and needs to be added to the definition!
        updatedSource = this.uncollapseSubmorphHierarchy(
          sourceCode,
          responsibleComponent,
          change.target,
          sourceEditor);
      } else {
        // this little dance should be refactored
        let deleteProp = false; let skipPatch = false;
        if (change.prop === 'extent') {
          if (this.isResizedVertically(change.target)) {
            change = { ...change, prop: 'width' };
            valueAsExpr.__expr__ = String(change.value.x);
            deleteProp = true;
            updatedSource = this.deleteProp(sourceCode, morphDef, 'extent', sourceEditor);
          }
          if (this.isResizedVertically(change.target)) {
            change = { ...change, prop: 'height' };
            valueAsExpr.__expr__ = String(change.value.y);
            skipPatch = deleteProp;
            if (!deleteProp) {
              updatedSource = this.deleteProp(sourceCode, morphDef, 'extent', sourceEditor);
            }
          }
        }
        if (!skipPatch) {
          updatedSource = this.patchProp(
            sourceCode,
            morphDef,
            change.prop,
            valueAsExpr.__expr__,
            sourceEditor);
        }
      }
    }

    // handle a morph added
    // if this happens inside overridden props, we need to use the command instead
    if (change.selector === 'addMorphAt') {
      const newOwner = change.target;
      const [addedMorph] = change.args;
      let addedMorphExpr = convertToSpec(addedMorph, { dropMorphsWithNameOnly: false });
      requiredBindings.push(...Object.entries(addedMorphExpr.bindings));
      if (addedMorph.master) {
        const metaInfo = addedMorph.master.parent[Symbol.for('lively-module-meta')];
        addedMorphExpr = convertToSpec(addedMorph, {
          exposeMasterRefs: false,
          skipAttributes: [...DEFAULT_SKIPPED_ATTRIBUTES, 'type']
        });
        addedMorphExpr = {
          // this fails when components are alias imported....
          // we can not insert the model props right now
          // this also serializes way too much
          __expr__: `part(${metaInfo.exportedName}, ${addedMorphExpr.__expr__})`,
          bindings: {
            ...addedMorphExpr.bindings,
            [COMPONENTS_CORE_MODULE]: ['part'],
            [metaInfo.moduleId]: [metaInfo.exportedName]
          }
        };
      }
      if (this.withinDerivedComponent(newOwner)) {
        addedMorphExpr.__expr__ = `add(${addedMorphExpr.__expr__})`;
        const b = addedMorphExpr.bindings[COMPONENTS_CORE_MODULE] || [];
        b.push('add');
        addedMorphExpr.bindings[COMPONENTS_CORE_MODULE] = b;
      }
      requiredBindings.push(...Object.entries(addedMorphExpr.bindings));
      updatedSource = this.addMorph(parsedComponent, sourceCode, newOwner, addedMorphExpr, sourceEditor);
    }

    // handle a morph removal
    if (change.selector === 'removeMorph') {
      // maybe also cleanup unneeded imports here...
      const [removedMorph] = change.args;
      let nodeToRemove = getMorphNode(parsedComponent, removedMorph);
      let insertedRemove = false;
      if (this.withinDerivedComponent(change.target)) {
        // insert a without("removed morph name") into the submorphs if it is not declared already
        // if there is a add() which we remove again, it suffices to just remove that add command
        // if it is declared already then replace the declared node but this is then done by the call
        // after that normaly removes the declared expression
        const removeMorphExpr = {
          __expr__: `without('${removedMorph.name}')`,
          bindings: { [COMPONENTS_CORE_MODULE]: ['without'] }
        };
        requiredBindings.push(...Object.entries(removeMorphExpr.bindings));
        // also update the source code if the following code leaps in
        updatedSource = this.addMorph(parsedComponent, sourceCode, change.target, removeMorphExpr, sourceEditor);
        insertedRemove = true;
      }
      if (nodeToRemove && (change.target.submorphs.length > 0 || insertedRemove)) {
        if (insertedRemove) sourceCode = updatedSource;
        if (sourceCode[nodeToRemove.end] === ',') nodeToRemove.end++;
        if (sourceEditor) {
          const morphRange = Range.fromPositions(
            sourceEditor.indexToPosition(nodeToRemove.start),
            sourceEditor.indexToPosition(nodeToRemove.end)
          );
          sourceEditor.replace(morphRange, '');
          updatedSource = sourceEditor.textString;
        } else {
          updatedSource = string.applyChanges(sourceCode, [
            { action: 'remove', ...nodeToRemove }
          ]);
        }
      }

      if (!insertedRemove && change.target.submorphs.length === 0) {
        // remove the submorphs prop entirely
        const ownerNode = getPropertiesNode(parsedComponent, change.target);
        nodeToRemove = getProp(ownerNode, 'submorphs');
        while (!sourceCode[nodeToRemove.start].match(/\,|\n|\{/)) {
          nodeToRemove.start--;
        }
        this.needsLinting = true; // not enough to clear the blank space...
      }
      // does not need linting, surprisingly
    }
    // update the bindings that come from the property
    updatedSource = fixUndeclaredVars(updatedSource, requiredBindings, mod);

    // this is asynchronous and does take some time
    // it will cause troble when many successive updates to the module are triggered
    // in those cases we need to debounce, but we still need to keep the source somewhere
    // so the successive updates are still based on the proper source
    if (this.needsLinting) {
      this.needsLinting = false;
      [updatedSource] = lint(updatedSource);
      if (sourceEditor) sourceEditor.textString = updatedSource;
    }
    if (sourceEditor) {
      const browser = sourceEditor.owner;
      if (browser) {
        browser.viewModel.state.sourceHash = string.hashCode(updatedSource);
        browser.viewModel.indicateNoUnsavedChanges();
      }
    }
    mod.setSource(updatedSource);

    // runs once immediately and then waits until the cascade has subseded
    // for a final call with the latest source
    this._finishPromise = promise.deferred();
    fun.debounceNamed('update-source-for-' + mod.id, 5, async () => {
      // we also need to forward the linting to the sourceEditor if present...
      // however we do not want to mess up the update mechanism
      await mod.changeSource(mod._source, { doSave: true, doEval: false });
      if (this._finishPromise) {
        await mod.source();
        this._finishPromise.resolve(true);
      }
      delete this._finishPromise;
    })();
  }
}

export class InteractiveComponentDescriptor extends ComponentDescriptor {
  getComponentMorph () {
    let c = this._cachedComponent;
    const componentName = string.decamelize(this[Symbol.for('lively-module-meta')].exportedName);
    return c || (
      c = morph(this.stylePolicy.asBuildSpec()),
      c[Symbol.for('lively-module-meta')] = this[Symbol.for('lively-module-meta')],
      c.isComponent = true,
      c.name = componentName,
      this._cachedComponent = c
    );
  }

  async edit () {
    const c = this.getComponentMorph();
    if (!c._changeTracker) { new ComponentChangeTracker(c, this); }
    return await c._changeTracker.whenReady() && c;
  }

  init (generatorFunctionOrInlinePolicy, meta = { moduleId: import.meta.url }) {
    const descr = super.init(generatorFunctionOrInlinePolicy, meta);
    this.notifyDependents(); // get the derived components to notice!
    return descr;
  }

  getSourceCode () {
    this._cachedComponent = null; // ensure to recreate the component morph
    return lint(createInitialComponentDefinition(this.getComponentMorph()))[0];
  }

  notifyDependents () {
    signal(this, 'changed');
  }

  refreshDependants () {
    $world.withAllSubmorphsDo(m => {
      if (m.master?.uses(this.stylePolicy)) {
        m.master.applyIfNeeded(true);
      }
    });
  }
}
