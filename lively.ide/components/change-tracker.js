import { arr, obj, fun, promise, string } from 'lively.lang';
import { parse, query } from 'lively.ast';

import { module } from 'lively.modules/index.js';
import { connect } from 'lively.bindings';
import lint from '../js/linter.js';
import { getDefaultValueFor, isFoldableProp } from 'lively.morphic/helpers.js';
import { getPropertiesNode, getValueExpr, getFoldableValueExpr, getMorphNode, getTextAttributesExpr, getComponentScopeFor, applyChangesToTextMorph, getComponentNode, getProp, standardValueTransform, DEFAULT_SKIPPED_ATTRIBUTES, convertToExpression } from './helpers.js';
import { insertPropChange, fixUndeclaredVars, insertMorphChange } from './reconciliation.js';

const COMPONENTS_CORE_MODULE = 'lively.morphic/components/core.js';

/**
 * ComponentChangeTrackers listen for evals of the componet module
 * and then make sure the new master components replace the currently
 * visible ones seamlessly so direct manipulation does not happen on
 * abandoned master components any more.
 * They also listen for changes on the component morphs in case they
 * are open and reconcile the corresponding source code to reflect these changes.
 */
export class ComponentChangeTracker {
  constructor (aComponent, descriptor, oldName = aComponent.name) {
    this.trackedComponent = aComponent;
    this.componentModuleId = aComponent[Symbol.for('lively-module-meta')].moduleId;
    this.componentModule = module(this.componentModuleId);
    this.componentDescriptor = descriptor;
    connect(aComponent, 'onSubmorphChange', this, 'processChangeInComponent', { garbageCollect: true });
    connect(aComponent, 'onChange', this, 'processChangeInComponent', { garbageCollect: true });
    aComponent._changeTracker = this;
  }

  /**
   * Returns the policy that is wrapped by the component descriptor.
   * @type { StylePolicy }
   */
  get componentPolicy () { return this.componentDescriptor.stylePolicy; }

  /**
   * If present, returns the first browser that has unsaved changes and
   * the module openend that the component we are tracking is defined in.
   * @type { Text }
   */
  get sourceEditor () {
    if (!this.componentModule) return;
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

  /**
   * The current source of the module object that manages
   * the source code this component is defined in.
   * @type { string }
   */
  get currentModuleSource () {
    return this.componentModule._source;
  }

  /**
   * The name of the component definition as found in the source code of the module.
   * @type { string }
   */
  get componentName () {
    return this.componentPolicy[Symbol.for('lively-module-meta')].exportedName;
  }

  /**
   * Returns a promise that once resolves denotes that the
   * tracker is ready to reconcile changes with the module.
   * @returns { Promise<boolean> }
   */
  whenReady () {
    return !!this.componentModule.source();
  }

  /** .
   * When processing changes have to wait for the module system, since the writing of files
   * to the file system is asynchronous.
   * This method returns a promise that will resolve once all the changes that are being
   * processed by the tracker have been effective.
   * @returns { Promise<boolean> }
   */
  onceChangesProcessed () {
    return this._finishPromise ? this._finishPromise.promise : Promise.resolve(true);
  }

  /**
   * Compares two trackers in order to check if they are equivalent.
   * @param { ComponentChangeTracker } otherTracker
   * @param { string } componentName - Name of the component to track.
   * @returns { boolean }
   */
  equals (otherTracker, componentName) {
    return this.componentModuleId === otherTracker.componentModuleId &&
           otherTracker.trackedComponent.name === componentName;
  }

  /**
   * Checks if a given morph corresponds to a spec inside a
   * policy that was derived from another component.
   * @param { Morph } aMorph - The morph to check.
   * @returns { boolean }
   */
  withinDerivedComponent (aMorph) {
    for (const each of [aMorph, ...aMorph.ownerChain()]) {
      if (each.master) return true;
      if (each.__wasAddedToDerived__) return false;
    }
    return false;
  }

  /**
   * Checks wether a particlar morph is part of the *initial* component definition's structure.
   * What this means is that the morph was not added to a component definition that was derived from another one.
   * @param { Morph } aMorph - The morph to check.
   * @param { Morph } componentOfScope - The component morph of the scope.
   * @returns { boolean }
   */
  belongsToInitialComponentStructure (aMorph) {
    for (const each of aMorph.ownerChain()) {
      if (each.master) return false;
    }
    return true;
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

  _generateChangesFor_uncollapseSubmorphHierarchy (sourceCode, parsedComponent, hiddenMorph, hiddenSubmorphExpr = false) {
    let nextVisibleParent = hiddenMorph;
    const nextSibling = hiddenMorph.owner.submorphs[hiddenMorph.owner.submorphs.indexOf(hiddenMorph) + 1];
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
    if (!uncollapsedHierarchyExpr) return [];
    return this._generateChangesFor_insertMorphExpression(parsedComponent, sourceCode, nextVisibleParent, uncollapsedHierarchyExpr, nextSibling);
  }

  /**
   * Inserts a morph expression into the submorphs array of a spec within a component definition.
   * The expression itself can be quite arbitrary, and there is technically no limitation.
   * However we usualy utilize expressions like `add(...)` or `part(...)` to be inserted with this method.
   * @param { object } parsedComponent - The AST of the component definition we will be modifying.
   * @param { string } sourceCode - The source code we will transform.
   * @param { Morph } newOwner - The morph affected by the insertation of the expression.
   * @param { object } addedMorphExpr - The expression to insert as expression object.
   * @returns { string } The transformed source code.
   */
  _generateChangesFor_insertMorphExpression (parsedComponent, sourceCode, newOwner, addedMorphExpr, nextSibling = false) {
    const propsNode = getPropertiesNode(parsedComponent, newOwner);
    const submorphsArrayNode = propsNode && getProp(propsNode, 'submorphs')?.value;
    this.needsLinting = true;

    if (!submorphsArrayNode) {
      let propertiesNode = getPropertiesNode(parsedComponent, newOwner);
      if (!propertiesNode) {
        // uncollapse till morph expression:
        // inserts a submorph drill down up to the submorphs: [*expression*] is inserted (insert action)
        return this._generateChangesFor_uncollapseSubmorphHierarchy(
          sourceCode,
          parsedComponent,
          newOwner,
          addedMorphExpr
        );
      }
      // just generate an insert action that places the prop in the morph def
      return insertPropChange(
        sourceCode,
        propertiesNode,
        'submorphs',
        `[${addedMorphExpr.__expr__}]`
      );
    } else {
      // just generates an insert action that places the morph in the submorph array
      return [insertMorphChange(submorphsArrayNode, addedMorphExpr.__expr__, nextSibling)];
    }
  }

  /**
   * Allows us to surgically patch a particular property inside a component definition
   * in order to reflect a change in the property value. This will automatically insert
   * the property in case it is not found to be present in the respective spec.
   * @param { string } sourceCode - The source code of the module affected.
   * @param { object } morphDef - The property node where we will insert/change the property.
   * @param { string} propName - The name of the property to be changed/inserted.
   * @param { object } valueExpr - The property value as an expression object.
   * @returns { string } The transformed source code.
   */
  _generateChangesFor_patchProp (sourceCode, morphDef, propName, valueExpr) {
    const propNode = getProp(morphDef, propName);
    if (!propNode) {
      this.needsLinting = true;
      return insertPropChange(
        sourceCode,
        morphDef,
        propName,
        valueExpr
      );
    }

    const patchPos = propNode.value;
    return [
      { action: 'replace', ...patchPos, lines: [valueExpr] }
    ];
  }

  /**
   * Removes a property of a morph spec within a component definition.
   * @param { string } sourceCode - The source code of the module we will be changing.
   * @param { object } morphDef - The AST node of the morph spec where we will delete the property from.
   * @param { string } propName - The name of the property to be delected.
   * @returns { string } The transformed source code.
   */
  _generateChangesFor_deleteProp (sourceCode, morphDef, propName) {
    const propNode = getProp(morphDef, propName);
    if (!propNode) {
      return [];
    }
    const patchPos = propNode;
    while (sourceCode[patchPos.end].match(/,| |\n/)) patchPos.end++;
    this.needsLinting = true;
    return [
      { action: 'remove', ...patchPos }
    ];
  }

  /**
   * Checks if a given morph's position is dictacted
   * by a layout. In those cases reconciling position
   * changes can be skipped.
   * @param { Morph } aMorph - The morph to check for.
   * @returns { boolean }
   */
  isPositionedByLayout (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    if (l?.name?.call() === 'Proportional') return false;
    if (aMorph.owner?.textAndAttributes?.includes(aMorph)) return true;
    return l && l.layoutableSubmorphs.includes(aMorph);
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

  /**
   * Filter function that allows us to check if we need
   * to reconcile a particular change or not.
   * ChangeTrackers work on a whitelisting policy. That is, any
   * change to even be considered needs have set the meta property
   * `reconcileChanges` to `true`.
   * @param { object } change - The change object to check
   * @returns { boolean }
   */
  ignoreChange (change) {
    if (!change.meta?.reconcileChanges) return true;
    if (change.prop === 'name') return false;
    if (change.prop === 'position' && (change.target === this.trackedComponent || this.isPositionedByLayout(change.target))) return true;
    if (change.prop && change.prop !== 'textAndAttributes' && !change.target.styleProperties.includes(change.prop)) return true;
    if (change.target.epiMorph) return true;
    if (['addMorphAt', 'removeMorph'].includes(change.selector) &&
        change.args.some(m => m.epiMorph)) return true;
    if (!['addMorphAt', 'removeMorph'].includes(change.selector) && change.meta && (change.meta.metaInteraction || change.meta.isLayoutAction)) return true;
    if (change.selector === 'addMorphAt' && change.target.textAndAttributes?.includes(change.args[0])) return true;
    if (!change.selector && change.prop !== 'layout' && obj.equals(change.prevValue, change.value)) return true;
    return false;
  }

  /**
   * Given a change, returns wether or not we can delay the reconciliation
   * of that change to a later time. This can be beneficial, since we
   * sometimes want to avoid degrading performance when properties that
   * are expensive to reconcile are changed in quick succession.
   * @param { object } change - The change to check.
   * @returns { boolean }
   */
  adjournChange (change) {
    const isReplaceChange = change.selector === 'replace';
    if (!isReplaceChange) return false;
    const insertsMorph = change.args[1].find(m => m?.isMorph);
    const removesMorph = change.undo.args[1].find(m => m?.isMorph);
    return !insertsMorph && !removesMorph;
  }

  /**
   * Called in response to changes in the component morph in order to reconcile
   * these changes in the source code as well as the currently initialized policy object.
   * @param { object } change - The change to reconcile.
   */
  async processChangeInComponent (change) {
    if (this.ignoreChange(change)) return;
    const isAddChange = change.selector === 'addMorphAt';
    if (isAddChange) { this.processChangeInComponentPolicy(change); }

    if (this.adjournChange(change)) {
      fun.debounceNamed('reconcile later', 200, async () => {
        await this.processChangeInComponentSource(change);
        if (!isAddChange) this.processChangeInComponentPolicy(change);
        this.componentDescriptor.makeDirty();
      })();
      return;
    }
    await this.processChangeInComponentSource(change);
    if (!isAddChange) this.processChangeInComponentPolicy(change);
    this.componentDescriptor.makeDirty();
  }

  /**
   * Reconciles the change in the currently initialized policy object.
   * This is nessecary to reflect changes live in the system before the
   * user has explicitly reloaded affected modules by confirming the changes
   * with a save command.
   * @param { object } change - The change to reconcile.
   */
  processChangeInComponentPolicy (change) {
    this._lastChange = change;
    const policy = this.componentPolicy || change.target.master;
    let isStructuralChange = false;
    if (change.prop) {
      if (!policy) return;
      let subSpec = policy.ensureSubSpecFor(change.target);
      if (subSpec.isPolicyApplicator) subSpec = subSpec.spec;
      subSpec[change.prop] = change.value;
    }

    if (change.selector === 'addMorphAt') {
      if (!policy) return;
      isStructuralChange = true;
      const [addedMorph] = change.args;
      policy.ensureSubSpecFor(addedMorph, true); // wrap this as added
    }

    if (change.selector === 'removeMorph') {
      policy.removeSpecInResponseTo(change);
    }

    // we still need to actually refresh the module to also propage
    // the change across derived components effectively
    if (isStructuralChange) this.refreshDependants(change);
  }

  /**
   * Ask the morphs in the system to reapply their policies in order to reflect
   * the recent changes applied during reconciliation.
   * Also ensures that the structural changes (if present) are propagated among the
   * derived style policies in the system.
   */
  refreshDependants (change) {
    if (this.componentDescriptor) return;
    this.componentDescriptor.propagateChangeAmongDependants(change);
    this.componentDescriptor.refreshDependants();
  }

  /**
   * Reconcile the changes in the source code the component is defined in.
   * Note that source code changes are reflected asynchronously since we
   * have to interface with the file system.
   * We utilize the internal source cache of the module objects or a suitable
   * text morph to temporarily reflect the source code changes synchronously in
   * the system. This is crucial in order to correctly respond to successively
   * incoming changes that may happen faster then the file system can dispatch.
   * This however assumes that we are the only source of change to the modules
   * during the reconciliation, which is reasonable for single user lively setups.
   * @param { object } change - The change object to reconcile.
   */
  processChangeInComponentSource (change) {
    const { componentModule: mod, componentName, sourceEditor } = this;

    if (!mod) return;

    let sourceCode = (sourceEditor ? sourceEditor.textString : mod._source);
    if (!sourceCode) {
      mod.source();
      return;
    }
    const parsedContent = parse(sourceCode);
    const parsedComponent = getComponentNode(parsedContent, componentName);
    let requiredBindings = [];

    let changes;
    if (change.prop) {
      changes = this.handleChangedProp(change, parsedComponent, sourceCode, requiredBindings);
    }

    if (change.selector === 'addMorphAt') {
      changes = this.handleAddedMorph(change, parsedComponent, sourceCode, requiredBindings);
    }

    if (change.selector === 'removeMorph') {
      changes = this.handleRemovedMorph(change, parsedComponent, sourceCode, requiredBindings);
    }

    if (change.selector === 'replace' ||
        change.prop === 'textAndAttributes' ||
        change.selector === 'addTextAttribute') {
      changes = this._generateChangesFor_handleTextAttributes(change, parsedComponent, sourceCode, requiredBindings);
    }

    // NOTE: Since none of our reconciliations apply to the imports on the
    //       top of the module, we do not have to worry about the order of
    //       the import changes.

    let updatedSource;
    const transformString = this.needsLinting || !sourceEditor;
    updatedSource = transformString
      ? string.applyChanges(sourceCode, changes)
      : applyChangesToTextMorph(sourceEditor, changes);

    ({ changes } = fixUndeclaredVars(updatedSource, requiredBindings, mod));
    // inject the imports
    updatedSource = transformString
      ? string.applyChanges(updatedSource, changes)
      : applyChangesToTextMorph(sourceEditor, changes);

    // replace the entire string since we are linting the module
    if (this.needsLinting) {
      this.needsLinting = false;
      [updatedSource] = lint(updatedSource);
      if (sourceEditor) sourceEditor.textString = updatedSource;
    }
    // we also need to ensure that the browsers unsafed changes
    // indicator is working properly.
    if (sourceEditor) {
      const browser = sourceEditor.owner;
      if (browser) {
        browser.viewModel.state.sourceHash = string.hashCode(updatedSource);
        browser.viewModel.indicateNoUnsavedChanges();
      }
    }

    // always updated the module source, but mostly without reloading the module.
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

  /**
   * Handle reconciliations in response to the textAndAttributes being changed.
   * For now we follow simple strategy: just always replace the entire text and attributes
   * regardless of of much was changes in the replace call...
   * if that causes performance degregation, we reconsider
   * @param { object } replaceChange - The replace change of the text morph.
   * @param { object } parsedComponent - The AST for the component definition.
   * @param { string } sourceCode - The source code to reconcile the change with.
   * @param { object[] } requiredBindings - An array that is populated with dependencies that arise as a part of reconciliation.
   * @returns { Object[] } The changes that transform the given source code.
   */
  _generateChangesFor_handleTextAttributes (replaceChange, parsedComponent, sourceCode, requiredBindings) {
    const { target: textMorph } = replaceChange;
    const responsibleComponent = getComponentScopeFor(parsedComponent, textMorph);
    const morphDef = getPropertiesNode(responsibleComponent, textMorph);
    if (!morphDef) {
      return this._generateChangesFor_uncollapseSubmorphHierarchy(sourceCode, responsibleComponent, textMorph);
    }
    const textAttrsAsExpr = getTextAttributesExpr(textMorph);
    requiredBindings.push(...Object.entries(textAttrsAsExpr.bindings));
    this.needsLinting = true;
    return this._generateChangesFor_patchProp(sourceCode, morphDef, 'textAndAttributes', textAttrsAsExpr.__expr__);
  }

  /**
   * Handle reconciliations in response to a morph being added.
   * @param { object } addMorphChange - The add morph change object.
   * @param { object } parsedComponent - The AST for the component definition.
   * @param { string } sourceCode - The source code to reconcile the change with.
   * @param { object[] } requiredBindings - An array that is populated with dependencies that arise as a part of reconciliation.
   * @returns { object[] } The changes that transform the source code accordingly.
   */
  handleAddedMorph (addMorphChange, parsedComponent, sourceCode, requiredBindings) {
    const newOwner = addMorphChange.target;
    const [addedMorph] = addMorphChange.args;
    let addedMorphExpr = convertToExpression(addedMorph, { dropMorphsWithNameOnly: false });
    requiredBindings.push(...Object.entries(addedMorphExpr.bindings));
    if (addedMorph.master) {
      const metaInfo = addedMorph.master.parent[Symbol.for('lively-module-meta')];
      addedMorphExpr = convertToExpression(addedMorph, {
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
    const nextSibling = newOwner.submorphs[newOwner.submorphs.indexOf(addedMorph) + 1];
    if (this.withinDerivedComponent(newOwner)) {
      addedMorph.__wasAddedToDerived__ = true;
      addedMorphExpr.__expr__ = `add(${addedMorphExpr.__expr__}${nextSibling ? `, "${nextSibling.name}"` : ''})`;
      const b = addedMorphExpr.bindings[COMPONENTS_CORE_MODULE] || [];
      b.push('add');
      addedMorphExpr.bindings[COMPONENTS_CORE_MODULE] = b;
    }
    requiredBindings.push(...Object.entries(addedMorphExpr.bindings));
    return this._generateChangesFor_insertMorphExpression(parsedComponent, sourceCode, newOwner, addedMorphExpr, nextSibling);
  }

  /**
   * Handle reconciliation in response to the removal of a morph.
   * @param { object } removeChange - The change tracking the morph removal.
   * @param { object } parsedComponent - The AST node of the component definition that needs to be reconciled.
   * @param { srting } sourceCode - The source code to be transformed.
   * @param { object[] } requiredBindings - An array that is populated with dependencies that are introduced as part of the transformation.
   * @returns { string } The transformed source code.
   */
  handleRemovedMorph (removeChange, parsedComponent, sourceCode, requiredBindings) {
    const { args: [removedMorph], target: prevOwner } = removeChange;

    // let updatedSource = sourceCode;
    // FIXME: This may fetch the incorrect node, if there is a equally named submorph deeper down the spec

    function preserveFormatting (nodeToRemove) {
      if (!nodeToRemove) return nodeToRemove;
      while (!sourceCode[nodeToRemove.start].match(/\,|\n|\{/)) {
        nodeToRemove.start--;
      }
      while (sourceCode[nodeToRemove.end].match(/\,/)) {
        nodeToRemove.end++;
      }
      return nodeToRemove;
    }

    let closestSubmorphsNode = getProp(getPropertiesNode(parsedComponent, prevOwner), 'submorphs');
    let nodeToRemove = closestSubmorphsNode && getMorphNode(closestSubmorphsNode.value, removedMorph);

    const isDerived = this.withinDerivedComponent(prevOwner);
    const changes = [];

    function determineNodeToRemoveSubmorphs (submorphsNode) {
      let nodeToRemove = submorphsNode;
      let curr = prevOwner;
      let propNode = getPropertiesNode(parsedComponent, curr);
      submorphsNode = getProp(propNode, 'submorphs');
      while (
        query.queryNodes(propNode, `
          / Property [
            /:key Identifier [ @name != 'submorphs' && @name != 'name' ]
           ]
         `).length === 0 &&
          submorphsNode?.value.elements.length < 2) {
        // if we are wrapped by a part call we should use the submorphs node instead
        nodeToRemove = curr.__wasAddedToDerived__ ? submorphsNode : propNode;
        curr = curr.owner;
        propNode = getPropertiesNode(parsedComponent, curr);
        submorphsNode = getProp(propNode, 'submorphs');
      }

      // ensure formatting is preserved
      return preserveFormatting(nodeToRemove);
    }

    // 1. the morph removed is part of a root component definition. => just remove spec, possibly removing submorphs prop.
    if (!removedMorph.__wasAddedToDerived__ && !isDerived) {
      // add a remove node or a remove submorph props call
      if (closestSubmorphsNode?.value.elements.length < 2) {
        changes.push({ action: 'remove', ...determineNodeToRemoveSubmorphs(closestSubmorphsNode) });
        this.needsLinting = true; // really?
      } else {
        changes.push({ action: 'remove', ...preserveFormatting(nodeToRemove) });
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
        changes.push({ action: 'replace', ...preserveFormatting(nodeToRemove), lines: [removeMorphExpr.__expr__] });
      } else {
        // gather the changes for an uncollapse (one insert)
        // and this insert needs to be instrumented with the removedMorphExpr
        return this._generateChangesFor_insertMorphExpression(parsedComponent, sourceCode, prevOwner, removeMorphExpr);
      }
    }

    // 3. the morph removed as added and not inherited from a component. => just remove the add() call, possibly removing submorphs prop
    if (removedMorph.__wasAddedToDerived__ && isDerived) {
      // add a remove node or a remove submorph props call
      if (closestSubmorphsNode?.value.elements.length < 2) {
        changes.push({ action: 'remove', ...determineNodeToRemoveSubmorphs(closestSubmorphsNode) }); // this in turns needs to bubble up if this causes owners to further get empty
        this.needsLinting = true;
      } else {
        changes.push({ action: 'remove', ...nodeToRemove });
      }
    }

    return changes;
  }

  /**
   * Reconcile a change of a morph property.
   * @param { object } propChange - The property change object.
   * @param { object } parsedComponent - The AST node of the component definition to be changed.
   * @param { string } sourceCode - The source code of the module we will be transforming.
   * @param { object[] } requiredBindings - An array that is populated with introduced dependencies in response to property changes.
   * @returns { string } The transformed source code.
   */
  handleChangedProp (propChange, parsedComponent, sourceCode, requiredBindings) {
    let { prop, value, target } = propChange; let members;
    if (prop === 'name') { return this.handleRenaming(propChange, parsedComponent, sourceCode); }
    let updatedSource = sourceCode;
    let valueAsExpr;
    if (members = isFoldableProp(target.constructor, prop)) {
      valueAsExpr = getFoldableValueExpr(prop, value, members, target.ownerChain().length);
    } else {
      valueAsExpr = getValueExpr(prop, value);
    }
    requiredBindings.push(...Object.entries(valueAsExpr.bindings));
    let responsibleComponent = getComponentScopeFor(parsedComponent, target);
    const morphDef = getPropertiesNode(responsibleComponent, target);
    if (!morphDef) {
      return this._generateChangesFor_uncollapseSubmorphHierarchy(sourceCode, responsibleComponent, target);
    }
    if (prop === 'layout') {
      this.needsLinting = true;
    }
    if (prop === 'extent') {
      return this._generateChangesFor_handleExtentChange(propChange, morphDef, updatedSource, valueAsExpr.__expr__);
    }
    if (this.differsFromNextLevel(prop, target, value)) {
      return this._generateChangesFor_patchProp(updatedSource, morphDef, prop, valueAsExpr.__expr__);
    }
    return this._generateChangesFor_deleteProp(updatedSource, morphDef, prop);
  }

  differsFromNextLevel (prop, target, newVal) {
    // FIXME: extract via path instead of name
    const policy = this.componentDescriptor.stylePolicy;
    const { parent } = policy;
    let val;
    if (parent) val = parent.synthesizeSubSpec(target.name)[prop];
    else {
      const { type } = policy.getSubSpecFor(this.trackedComponent === target ? null : target.name);
      val = getDefaultValueFor(type, prop);
    }
    return !obj.equals(val, newVal);
  }

  /**
   * Specific handling of an extent change.
   * Changes to the extent are tricky, since often times
   * the extent is controlled by layouts and therefore
   * the plain reconciliation of the extent property does not
   * make sense.
   * @param { object } extentChange - The extent change object.
   * @param { object } morphDef - The AST node of the morph spec where we carry out the extent patching.
   * @param { string } sourceCode - The source code of the module we transform.
   * @param { string } valueExpr - The value of the extent already stringified as an expression.
   * @returns { string } The transformed source code.
   */
  _generateChangesFor_handleExtentChange (extentChange, morphDef, sourceCode, valueExpr) {
    const { target, value } = extentChange;
    let updatedSource = sourceCode;
    let changedProp = 'extent';
    let deleteWidth = false;
    let deleteHeight = false;
    if (this.isResizedVertically(target)) {
      changedProp = 'width';
      valueExpr = String(value.x);
      deleteHeight = true;
    }
    if (this.isResizedHorizontally(target)) {
      changedProp = 'height';
      valueExpr = String(value.y);
      deleteWidth = true;
    }
    const changes = [];
    if (deleteHeight || deleteWidth) {
      changes.push(...this._generateChangesFor_deleteProp(sourceCode, morphDef, 'extent'));
    }
    if (!deleteHeight || !deleteWidth) {
      changes.push(...this._generateChangesFor_patchProp(updatedSource, morphDef, changedProp, valueExpr));
    }
    return changes;
  }

  /**
   * Specific handling of changes to the name property of a morph.
   * Changes to morph names require special care since names are
   * the key mechanism by which styles are correctly resolved and applied.
   * @param { object } nameChange - The name change object.
   * @param { object } parsedComponent - The AST node of the component definition affected by the name change.
   * @param { string } sourceCode - The source code of the affected module we are about to change.
   * @returns { string } The transformed source code.
   */
  handleRenaming (nameChange, parsedComponent, sourceCode) {
    const { target: renamedMorph, value: newName, prevValue: oldName } = nameChange;

    if (!renamedMorph.__wasAddedToDerived__ && !this.belongsToInitialComponentStructure(renamedMorph)) {
      return [];
    }

    const responsibleComponent = getComponentScopeFor(parsedComponent, renamedMorph);
    const morphDef = getPropertiesNode(responsibleComponent, oldName);
    this.componentDescriptor.stylePolicy.getSubSpecFor(oldName).name = newName;
    return this._generateChangesFor_patchProp(sourceCode, morphDef, 'name', `"${newName}"`);
  }
}
