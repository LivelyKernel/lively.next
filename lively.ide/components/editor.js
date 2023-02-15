import { ComponentDescriptor, morph } from 'lively.morphic';
import { ExpressionSerializer } from 'lively.serializer2';
import { string, arr, obj } from 'lively.lang';
import { module } from 'lively.modules/index.js';
import { withAllViewModelsDo } from 'lively.morphic/components/policy.js';
import lint from '../js/linter.js';
import { ComponentChangeTracker } from './change-tracker.js';
import { findComponentDef, getComponentNode } from './helpers.js';
import { replaceComponentDefinition, handleRemovedMorph, applyModuleChanges, createInitialComponentDefinition } from './reconciliation.js';
import { parse } from 'lively.ast';

const exprSerializer = new ExpressionSerializer();

/**
 * We implement our editor by means of a relatively simple
 * ComponentDescriptor subclass. This InteractiveComponentDescriptor
 * alloqs us to open and close direct manipulation editing sessions
 * and handles all the bookkeeping in the background.
 */
export class InteractiveComponentDescriptor extends ComponentDescriptor {
  get moduleName () { return this[Symbol.for('lively-module-meta')].moduleId; }

  get componentName () { return this[Symbol.for('lively-module-meta')].exportedName; }

  get isInteractive () { return true; }

  static for (generatorFunction, meta, prev) {
    const newDescr = super.for(generatorFunction, meta);
    if (prev) {
      const dependants = prev.getDependants(true);
      prev.stylePolicy = newDescr.stylePolicy;
      let c;
      if (c = prev._cachedComponent) {
        delete prev._cachedComponent;
        prev.ensureComponentMorphUpToDate(c);
      }
      dependants.forEach(m => {
        m.master._parent = newDescr.stylePolicy;
      });
      newDescr.refreshDependants(dependants);
      return prev;
    }
    return newDescr;
  }

  init (generatorFunctionOrInlinePolicy, meta = { moduleId: import.meta.url }) {
    super.init(generatorFunctionOrInlinePolicy, meta);
    this.subscribeToParent();
    this.refreshDependants();
    this.previouslyRemovedMorphs = new WeakMap();
    return this;
  }

  /**
   * Returns (and initializes) a morph that represents the component definition
   * and can be directly manipulated via Halo and other tools in order
   * to adjust the component definition.
   * @returns { Morph } The component morph.
   */
  getComponentMorph (alive = false) {
    let c = this._cachedComponent;
    return c || (
      c = morph(this.stylePolicy.asBuildSpec()),
      c.hasFixedPosition = false, // always ensure components are not rendered fixed (this fucks up the halo interface)
      c[Symbol.for('lively-module-meta')] = this[Symbol.for('lively-module-meta')],
      c.isComponent = true,
      c._context = $world,
      alive && withAllViewModelsDo(c, m => m.viewModel.attach(m)),
      c.name = string.decamelize(this.componentName),
      this._cachedComponent = c
    );
  }

  /**
   * Replace an existing component morph with a version that is ensured
   * to by consistent with the policy wrapped by the descriptor.
   * @param { Morph } [c] - The component morph.
   */
  ensureComponentMorphUpToDate (c) {
    if (c?.world()) {
      const sceneGraph = c.world().sceneGraph;
      const pos = c.globalPosition;
      c.remove();
      if (sceneGraph) sceneGraph.refresh();
      const updatedComponentMorph = this.getComponentMorph().openInWorld(pos);
      if (!updatedComponentMorph._changeTracker) {
        new ComponentChangeTracker(updatedComponentMorph, this);
      }
    }
  }

  /**
   * In order to reliably reset any unintended changes that happen due to
   * direct manipulation this method allows to take a snapshot of the current
   * component definition as code.
   */
  async ensureComponentDefBackup () {
    if (this._backupComponentDef) return;
    const { moduleId, exportedName } = this[Symbol.for('lively-module-meta')];
    const source = await module(moduleId).source();
    const { start, end } = findComponentDef(await module(moduleId).ast(), exportedName);
    this._backupComponentDef = source.slice(start, end);
  }

  /**
   * Revert the component definition back to when we started the edit session.
   */
  async reset () {
    await replaceComponentDefinition(this._backupComponentDef, this.componentName, this.moduleName);
  }

  /**
   * Initiates a direct manipulation editing session of the component definition.
   * @returns { Promise<Morph> } The component morph.
   */
  async edit (alive = false) {
    const c = this.getComponentMorph(alive);
    this.ensureComponentDefBackup();
    if (!c._changeTracker) { new ComponentChangeTracker(c, this); }
    return await c._changeTracker.whenReady() && c;
  }

  /**
   * Subscribe to any changes that happen to the parent policy if present.
   */
  subscribeToParent () {
    const { parent } = this.stylePolicy;
    if (parent) {
      const dependants = parent._dependants || new Set();
      dependants.add(this.stylePolicy.__serialize__({ expressionSerializer: exprSerializer }));
      parent._dependants = dependants;
    }
  }

  getDependants (immediate = false) {
    return $world.withAllSubmorphsSelect(m =>
      m.master?.uses(this.stylePolicy, immediate)
    );
  }

  /**
   * Traverses the world and manually applys each morph which is styled
   * via a policy derived from this one.
   */
  refreshDependants (dependants = this.getDependants()) {
    dependants.forEach(m => m.master.applyIfNeeded(true));
  }

  withDerivedComponentsDo (cb) {
    if (!this.stylePolicy._dependants) return;
    [...this.stylePolicy._dependants.values()].forEach(expr => {
      cb(InteractiveComponentDescriptor.ensureInteractive(exprSerializer.deserializeExpr(expr)));
    });
  }

  /**
   * This method recursively checks if there are any name conflicts
   * within the component scope or any of the scopes in any of the
   * derived components. If there is a conflict, the default resolution
   * is to adjust the addedMorph's name in such a way that it no longer
   * causes a name collision.
   * Note that it does not matter wether or not the `addedMorph` is a entirely
   * new morph or one that was reintroduced. At all times the renaming is applied
   * to the `addedMorph`. This also means that derived adjustments will have to
   * alter the name that they reference the `addedMorph` by if they are part
   * of a reintroduction.
   */
  ensureNoNameCollisionInDerived (addedMorph) {
    return addedMorph.name;
  }

  propagateChangeAmongDependants (change) {
    // FIXME: move the logic below into the component descriptor?
    //        that would simplify the recursive propagation of changes, since
    //        the tracker literally only exists for active editing sessions.

    if (change.selector === 'addMorphAt') {
      // propagate addMorph among dependants (only crucial for reintroduction of previously removed)
      const [addedMorph] = change.args;
      const policyToSpecAndSubExpression = this.previouslyRemovedMorphs.get(addedMorph);
      // FIXME: if the previously added morph was tinkered with structurally
      //        the reintroduction of cached expressions needs to be reconsidered
      if (policyToSpecAndSubExpression) {
        this.reintroduceSpec(addedMorph, policyToSpecAndSubExpression);
      }
      const safeName = this.ensureNoNameCollisionInDerived(addedMorph);
      if (safeName !== addedMorph.name) {
        addedMorph.withMetaDo({ reconcileChanges: true }, () => {
          addedMorph.name = safeName; // reconcile this too
        });
      }
    }

    if (change.selector === 'removeMorph') {
      this.removeSpec(change);
    }

    if (change.prop === 'name') {
      // propagate rename among dependants
      const safeName = this.ensureNoNameCollisionInDerived(change.value);
      if (safeName !== change.value) return; // do not perform an adjustment to the rename
      this.renameDerivedSpecs(change.prevValue, safeName);
    }
  }

  getSourceCode () {
    this._cachedComponent = null; // ensure to recreate the component morph
    return lint(createInitialComponentDefinition(this.getComponentMorph()))[0];
  }

  makeDirty () {
    this.ensureComponentDefBackup();
    this._dirty = true;
  }

  isDirty () {
    return this._dirty;
  }

  static ensureInteractive (descr) {
    obj.adoptObject(descr, InteractiveComponentDescriptor);
    if (!descr.previouslyRemovedMorphs) descr.previouslyRemovedMorphs = new WeakMap();
    return descr;
  }

  /**
   * description
   * @param {type} removedMorph - The morph that is being removed from the policy.
   * @param {type} policyToSpecAndSubExpression - Mapping from policies to cached specs and subexpressions.
   * @returns { Object[] } The changes that need to be applied to all affected modules.ription
   */
  removeSpec (removeChange, policyToSpecAndSubExpression = new WeakMap(), changes) {
    // remove the sub spec ( spec object )
    const { args: [removedMorph] } = removeChange;
    let applyChanges = false;
    if (!changes) {
      changes = [];
      applyChanges = true;
      this.previouslyRemovedMorphs.set(removedMorph, policyToSpecAndSubExpression);
    }
    const isRoot = applyChanges;

    if (!isRoot) {
      // remove sub spec
      let subSpec = this.stylePolicy.removeSpecInResponseTo(removeChange);
      // remove the sub expression ( source code )
      // TODO:
      // Instead of using a string we get store the sub expression as a AST so that it can be easily adjusted
      // if parts of the removed morph corresponding to this spec have been modified between the reintroduction
      let subExpr;
      // FIXME: move this stuff over to reconciler.js
      const sourceCode = module(this.moduleName)._source; // assuming we already have the source code
      const parsedMod = parse(sourceCode);
      const parsedComponent = getComponentNode(parsedMod, this.componentName);
      const { args: [removedMorph], target: prevOwner } = removeChange;
      const requiredBindings = [];
      const { changes: removeChanges, needsLinting } = handleRemovedMorph(removedMorph, prevOwner, parsedComponent, sourceCode, requiredBindings);
      // basically only replace or insert, remove only applies to root defs which this one is not
      const replaceChange = removeChanges.find(change => change.action === 'replace');
      if (replaceChange) {
        subExpr = sourceCode.slice(replaceChange.start, replaceChange.end); // FIXME: what if this is a submorph prop removal??
      }
      changes.push([this.moduleName, removeChanges]);
      // capture the spec + expression associated with this descr behind the removed Morph
      // FIXME: what if the descriptor also has an active reconciliation session?
      //        in that case, we also need to remember the instantiated submorph?
      //        Maybe its easier just to trigger a hard reset for these sessions. We may loose intermittend changes
      //        but it is a cheap and easy way out.
      if (subSpec && subExpr) {
        policyToSpecAndSubExpression.set(this.__serialize__(), [subExpr, subSpec]);
      }
    }

    this.withDerivedComponentsDo((descr) => {
      descr.removeSpec(removeChange, policyToSpecAndSubExpression, changes);
    });

    if (applyChanges) applyModuleChanges(changes);
  }

  /**
   * For morphs that were previously present inside the component definition,
   * we reintroduce that spec at a certain insertion point.
   * This method collects all the source code changes that need to be applied
   * @param {type} reintroducedMorph - The morph that is reintroduced to the policy.
   * @param { WeakMap } policyToSpecAndSubExpression - Mapping from policies to cached specs and subexpressions.
   * @returns { Object[] } The changes that need to be applied to all affected modules.
   */
  reintroduceSpec (reintroducedMorph, policyToSpecAndSubExpression, changes) {
    // FIXME: reconciliation already has taken place locally, so renaming may fail!
    let applyChanges = false;
    if (!changes) {
      applyChanges = true;
      changes = [];
    }

    this.withDerivedComponentsDo((descr) => {
      // reintroduce the cached specs in each of the derived policies
      descr.reintroduceSpec(reintroducedMorph, policyToSpecAndSubExpression, changes);
    });

    const specAndSubExpression = policyToSpecAndSubExpression.get(this.__serialize__());
    if (specAndSubExpression) {
      const [reintroducedSpec, reintroducedSubExpression] = specAndSubExpression;
      const { moduleName } = this;
      // ensure the spec of the owner
      // this.stylePolicy.ensureSpecFor(reintroducedMorph.owner);
      // add the spec
      // this.stylePolicy.insertSpec(reintroducedMorph, reintroducedSpec);
      // add the sub expression to the source code
      // changes.push([moduleId, insertMorphExpressionChanges(reintroducedMorph, reintroducedSubExpression)]);
      // ops.push()
    }

    // review the way changes are generated, maybe they should already
    // come grouped by module they apply to? That way we do not have
    // to do more weird refactoring in the change tracker,
    // which itself is always bound to a single module anyways
    if (applyChanges) applyModuleChanges(arr.groupBy(changes, ([modId]) => modId));
  }
}
