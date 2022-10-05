import { ComponentDescriptor, morph } from 'lively.morphic';
import { ExpressionSerializer } from 'lively.serializer2';
import { string } from 'lively.lang';
import { module } from 'lively.modules/index.js';
import lint from '../js/linter.js';
import { replaceComponentDefinition, createInitialComponentDefinition, findComponentDef } from './helpers.js';
import { ComponentChangeTracker } from './change-tracker.js';

const exprSerializer = new ExpressionSerializer();

/**
 * We implement our editor by means of a relatively simple
 * ComponentDescriptor subclass. This InteractiveComponentDescriptor
 * alloqs us to open and close direct manipulation editing sessions
 * and handles all the bookkeeping in the background.
 */
export class InteractiveComponentDescriptor extends ComponentDescriptor {
  static get properties () {
    return {
      moduleName: {
        get () {
          return this[Symbol.for('lively-module-meta')].moduleId;
        }
      },
      componentName: {
        get () {
          return this[Symbol.for('lively-module-meta')].exportedName;
        }
      }
    };
  }

  static for (generatorFunction, meta, prev) {
    const c = prev?._cachedComponent;
    const newDescr = super.for(generatorFunction, meta);
    if (c) {
      newDescr.ensureComponentMorphUpToDate(c);
    }
    return newDescr;
  }

  init (generatorFunctionOrInlinePolicy, meta = { moduleId: import.meta.url }) {
    super.init(generatorFunctionOrInlinePolicy, meta);
    this.subscribeToParent();
    this.refreshDependants();
    return this;
  }

  /**
   * Returns (and initializes) a morph that represents the component definition
   * and can be directly manipulated via Halo and other tools in order
   * to adjust the component definition.
   * @returns { Morph } The component morph.
   */
  getComponentMorph () {
    let c = this._cachedComponent;
    return c || (
      c = morph(this.stylePolicy.asBuildSpec()),
      c[Symbol.for('lively-module-meta')] = this[Symbol.for('lively-module-meta')],
      c.isComponent = true,
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
      const pos = c.globalPosition;
      const updatedComponentMorph = this.getComponentMorph().openInWorld(pos);
      if (!updatedComponentMorph._changeTracker) { new ComponentChangeTracker(updatedComponentMorph, this); }
      c.remove();
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
  async edit () {
    const c = this.getComponentMorph();
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

  /**
   * Traverses the world and manually applys each morph which is styled
   * via a policy derived from this one.
   */
  refreshDependants () {
    $world.withAllSubmorphsDo(m => {
      if (m.master?.uses(this.stylePolicy)) {
        m.master.applyIfNeeded(true);
      }
    });
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
}
