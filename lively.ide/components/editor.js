import { ComponentDescriptor, morph } from 'lively.morphic';
import { ExpressionSerializer } from 'lively.serializer2';
import { string, obj } from 'lively.lang';
import { module } from 'lively.modules/index.js';
import { withAllViewModelsDo } from 'lively.morphic/components/policy.js';
import lint from '../js/linter.js';
import { ComponentChangeTracker } from './change-tracker.js';
import { findComponentDef, getComponentNode, scanForNamesInGenerator } from './helpers.js';
import { replaceComponentDefinition, Reconciliation, createInitialComponentDefinition } from './reconciliation.js';
import { parse } from 'lively.ast';
import { once } from 'lively.bindings';

const metaSymbol = Symbol.for('lively-module-meta');
const exprSerializer = new ExpressionSerializer();

/**
 * We implement our editor by means of a relatively simple
 * ComponentDescriptor subclass. This InteractiveComponentDescriptor
 * allows us to open and close direct manipulation editing sessions
 * and handles all the bookkeeping in the background.
 */
export class InteractiveComponentDescriptor extends ComponentDescriptor {
  get moduleName () { return this[metaSymbol].moduleId; }

  get componentName () { return this[metaSymbol].exportedName; }

  get isInteractive () { return true; }

  get isScoped () { return !!this[metaSymbol].path; }

  static prepareUsedNamesSet (generatorFunction) {
    const usedNames = new Set(scanForNamesInGenerator(generatorFunction));
    usedNames.initialSize = usedNames.size;
    return usedNames;
  }

  static for (generatorFunction, meta, recorder, declaredName) {
    const newDescr = super.for(generatorFunction, meta);
    const prev = !recorder?.__revived__ && recorder?.[declaredName];
    if (prev) {
      if (prev.constructor !== this) { obj.adoptObject(prev, this); }
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
      prev.checkForGeneratedNames();
      return prev;
    }
    return newDescr;
  }

  init (generatorFunctionOrInlinePolicy, meta = { moduleId: import.meta.url }) {
    super.init(generatorFunctionOrInlinePolicy, meta);
    this.subscribeToParent();
    this.refreshDependants();
    this.previouslyRemovedMorphs = new WeakMap();
    this.checkForGeneratedNames();
    return this;
  }

  ensureNamesInSourceCode () {
    if (this._hasGeneratedNames) {
      this._hasGeneratedNames = false;
      Reconciliation.ensureNamesInSourceCode(this);
    }
  }

  checkForGeneratedNames () {
    this._hasGeneratedNames = morph.usedNames?.size > morph.usedNames?.initialSize;
  }

  getModuleSource () {
    return module(this.moduleName)._source;
  }

  getASTNode (sourceCode = this.moduleSource) {
    return getComponentNode(parse(sourceCode), this.componentName);
  }

  recordRemovedMorph (removedMorph, meta) {
    this.previouslyRemovedMorphs.set(removedMorph, meta);

    once(removedMorph, 'removeMorph', () => {
      this.previouslyRemovedMorphs.delete(removedMorph);
    });
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
      c[metaSymbol] = this[metaSymbol],
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
    const { moduleId, exportedName } = this[metaSymbol];
    const source = await module(moduleId).source();
    const { start, end } = findComponentDef(await module(moduleId).ast(), exportedName);
    this._backupComponentDef = source.slice(start, end);
  }

  /**
   * Revert the component definition back to when we started the edit session.
   */
  async reset () {
    await replaceComponentDefinition(this._backupComponentDef, this.componentName, this.moduleName);
    this._dirty = false;
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

  stopEditSession () {
    this._backupComponentDef = null;
    this._cachedComponent = null;
  }

  /**
   * Subscribe to any changes that happen to the parent policy if present.
   */
  subscribeToParent () {
    const { parent } = this.stylePolicy;
    if (parent) {
      const dependants = parent._dependants || new Set();
      dependants.add(exprSerializer.exprStringEncode(this.stylePolicy.__serialize__({ expressionSerializer: exprSerializer })));
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
      const descr = exprSerializer.deserializeExpr(expr);
      if (descr) cb(InteractiveComponentDescriptor.ensureInteractive(descr));
    });
  }

  /**
   * This method recursively checks if there are any name conflicts
   * within the component scope or any of the scopes in any of the
   * derived components. If there is a conflict, the default resolution
   * is to adjust the addedMorph's name in such a way that it no longer
   * causes a name collision.
   * Note, that it does not matter wether or not the `addedMorph` is a entirely
   * new morph or one that was reintroduced. At all times the renaming is applied
   * to the `addedMorph`. This also means that derived adjustments will have to
   * alter the name that they reference `addedMorph` by, if they are part
   * of a **reintroduction**. This concerns cases in which we remove a morph 'bob' from a component,
   * rename another morph in the component to 'bob' and then reintroduce the removed 'bob' once again.
   */
  ensureNoNameCollisionInDerived (nameCandidate, skip = false) {
    return this.stylePolicy.ensureNoNameCollisionInDerived(nameCandidate, this, skip);
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
    if (!this._descriptorCache) { this._descriptorCache = new WeakMap(); }
    if (descr.isPolicy) {
      return this._descriptorCache.get(descr) ||
        this._descriptorCache
          .set(descr, new InteractiveComponentDescriptor(descr, descr[metaSymbol]))
          .get(descr);
    }
    obj.adoptObject(descr, InteractiveComponentDescriptor);
    if (!descr.previouslyRemovedMorphs) descr.previouslyRemovedMorphs = new WeakMap();
    return descr;
  }
}
