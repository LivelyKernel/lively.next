import { obj } from 'lively.lang';
import { module } from 'lively.modules/index.js';
import { connect } from 'lively.bindings';
import { Reconciliation } from './reconciliation.js';

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
   * The current source of the module object that manages
   * the source code this component is defined in.
   * @type { string }
   */
  get currentModuleSource () {
    return this.componentModule._source;
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
   * Filter function that allows us to check if we need
   * to reconcile a particular change or not.
   * ChangeTrackers work on a whitelisting policy. That is, for a
   * change to even be considered, it needs have set the meta property
   * `reconcileChanges` to `true`.
   * @param { object } change - The change object to check
   * @returns { boolean }
   */
  ignoreChange (change) {
    if (!change.meta?.reconcileChanges) return true;
    if (change.prop === 'name') return false;
    if (change.prop === 'position' && (change.target === this.trackedComponent || this.isPositionedByLayout(change.target))) return true;
    if (change.prop &&
        change.prop !== 'textAndAttributes' &&
        !change.target.styleProperties.includes(change.prop)) return true;
    if (change.target.epiMorph) return true;
    if (['addMorphAt', 'removeMorph'].includes(change.selector) &&
        change.args.some(m => m.epiMorph)) return true;
    if (!['addMorphAt', 'removeMorph'].includes(change.selector) && change.meta && change.meta.isLayoutAction) return true;
    if (change.selector === 'addMorphAt' && change.target.textAndAttributes?.includes(change.args[0])) return true;
    if (!change.selector &&
        change.prop !== 'layout' &&
        obj.equals(change.prevValue, change.value)) return true;
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
  // FIXME: should be investigated again when we look at performance optimizations!
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
    Reconciliation.perform(this.componentDescriptor, change);
    this.componentDescriptor.makeDirty();
  }
}
