import { morph, addOrChangeCSSDeclaration } from 'lively.morphic';
import { string, properties, arr, obj } from 'lively.lang';
import { getClassName, allPlugins } from 'lively.serializer2';
import { connect } from 'lively.bindings';
import { adoptObject } from 'lively.classes/runtime.js';

import { deserializeMorph, serializeMorph } from '../serialization.js';
import { sanitizeFont, getClassForName } from '../helpers.js';
import { ComponentPolicy } from './policy.js';

export function purgeBindingConnections (snapshot, ref, pool) {
  let { attributeConnections } = snapshot.props;
  if (attributeConnections) {
    attributeConnections = attributeConnections.value;
    for (let i = attributeConnections.length; i--;) {
      const { id, __ref__ } = attributeConnections[i];
      if (!__ref__) continue;
      if (pool.refForId(id).realObj._isBinding) { arr.removeAt(attributeConnections, i); }
    }
  }
}

/**
 * Defines the core interface for defining and using master components in the system.
 * Components are defined in component files and allow for a file based definition of master components
 * such that collaboration on top of "state of the art" collaboration systems is feasable.
 * Existing systems do only work purely with text, so we are bound to keep up with that
 * as long as we are reliant on the present collaboration plattforms and toolchains.
 * @module lively.morphic/components/core.js
 */

/**
 * A ViewModel allows the user to decouple custom UI code from the composed morphs.
 * This is especially useful when working with large scale applications where
 * we want to keep the behavior separate from the specific UI components.
 * For instance, a team of designers can work on different UIs that vary in structure and appearance
 * without interference of the behavior. They do not have to worry about "accidentally" deleting parts
 * of the morph composition that carry custom behavior. Meanwhile the system allows for the same behavior to be attached
 * to different components and/or composed morphs. It also provides lifecycle callbacks that provide canonical entry points
 * where it is safe to update the UI in response to changes in the data.
 * This allows us to define behavior that is less error prone during (de)serialization.
 */
export class ViewModel {
  static get propertySettings () {
    return {
      defaultGetter (key) { return this.getProperty(key); },
      defaultSetter (key, value) { this.setProperty(key, value); },
      valueStoreProperty: '_viewState'
    };
  }

  toString () {
    return this.view ? `<${getClassName(this)} - ${this.view.name}>` : `<Unattached ${getClassName(this)}>`;
  }

  static get properties () {
    return {
      view: {
        set (v) {
          this.setProperty('view', v);
          if (v) v.viewModel = this;
        }
      },
      bindings: {
        readOnly: true,
        get () {
          return [];
        }
      },
      models: {
        derived: true,
        get () {
          const nameModelMap = {};
          if (lively.FreezerRuntime && this._models) return this._models;
          this.doWithScope(m => {
            // if a morph blocks its scope, ignore!
            if (m.viewModel) { nameModelMap[string.camelize(m.name.split(' ').join('-'))] = m.viewModel; }
          });
          return this._models = nameModelMap;
        }
      },
      ui: {
        derived: true,
        get () {
          const nameMorphMap = {};
          const klassCollectionMap = {};
          if (lively.FreezerRuntime && this._ui) return this._ui;
          this.doWithScope(m => {
            // if a morph blocks its scope, ignore!
            nameMorphMap[string.camelize(m.name.split(' ').join('-'))] = m;
            const name = getClassName(m);
            const categoryName = name.charAt(0).toLowerCase() + name.slice(1) + 's';
            const category = (klassCollectionMap[categoryName] || []);
            category.push(m);
            klassCollectionMap[categoryName] = category;
          });
          return this._ui = { ...nameMorphMap, ...klassCollectionMap };
        }
      }
    };
  }

  constructor (props = {}) {
    this.initializeProperties(props);
  }

  get __only_serialize__ () {
    const defaults = this.defaultProperties;
    const { properties } = this.propertiesAndPropertySettings();
    const propsToSerialize = [];
    if (this.attributeConnections) propsToSerialize.push('attributeConnections');
    for (let key in properties) {
      const descr = properties[key];
      if (
        descr.readOnly ||
        descr.derived ||
        descr.isComponent ||
        (descr.hasOwnProperty('serialize') && !descr.serialize) ||
        obj.equals(this[key], defaults[key])
      ) continue;
      propsToSerialize.push(key);
    }
    return propsToSerialize;
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    const { properties } = this.propertiesAndPropertySettings();
    for (const key in properties) {
      const descr = properties[key];
      if (descr.isComponent && this[key]) {
        const meta = this[key][Symbol.for('lively-module-meta')];
        if (!meta) continue;
        addFn(key, pool.expressionSerializer.exprStringEncode({
          __expr__: meta.export,
          bindings: { [meta.module]: meta.export }
        }));
      }
    }

    // delete all bindings
    purgeBindingConnections(snapshot, ref, pool);
  }

  getProperty (key) {
    return this._viewState[key];
  }

  setProperty (key, value) {
    this._viewState[key] = value;
    if (this._isRefreshing) return;
    // also start a refresh request
    // prevent nested refresh calls from ending in infine loops
    this._isRefreshing = true;
    try {
      if (this.view) this.onRefresh(key);
    } catch (err) {

    }
    this._isRefreshing = false;
  }
  
  /**
   * Returns the world the view currently resides in.
   * @returns { World } The world morph the view resides in.
   */
  world () {
    return this.view.world();
  }

  execCommand (cmdName, opts) {
    return this.view.execCommand(cmdName, opts);
  }
  
  /**
   * Calls `cb` on every morph within the scope of the view model.
   * The scope is essentially every morph in the submorph hierarchy that is
   * not in turn scoped by a different view model.
   * @param { function } cb - The callback to invoke for each morph in the hierarchy.
   */
  doWithScope (cb) {
    return this.view && this.view.withAllSubmorphsDoExcluding(cb, (m) => m.ignoreScope || (m.viewModel && m.viewModel !== this));
  }
  
  /**
   * Detatches the view model from the view. This means all bindings and
   * exposed props are removed, effectively removing all custom behavior from the view.
   */
  onDeactivate () {
    this.getBindingConnections().forEach(conn => conn.disconnect());
    if (!this.view) return;
    for (let prop of (this.expose || [])) {
      if (obj.isArray(prop)) prop = prop[0];
      delete this.view[prop];
    }
  }

  /**
   * Attaches the view model to the view, instantiating all bindings and exposed properties.
   */
  onActivate () {
    if (this.view.viewModel !== this) {
      return;
    }
    this.reifyExposedProps();
    this.reifyBindings();
  }
  
  /**
   * Called once the view is fully loaded and attached.
   */
  viewDidLoad () {
    
  }
  
  /**
   * Default refresh callback to perform updates in the view
   * fixme: Refresh should not get called if view has not been
   * loaded fully or not attached yet
   * maybe rename to onChange() analogous to morphs?
   * @param { object } change - The change object regarding the current property that changed in the view model.
   */
  onRefresh (change) {}
  
  /**
   * Instantiate all the bindings within the view as defined.
   */
  reifyBindings () {
    for (let {
      target, model, signal, handler,
      override = false, converter = false, updater = false
    } of this.bindings) {
      try {
        if (model) target = this.view.getSubmorphNamed(model).viewModel;
        if (!target) target = this.view;
        if (typeof target === 'string') { target = this.view.getSubmorphNamed(target); }
        if (!target) continue;
        if (obj.isFunction(handler)) {
          connect(target, signal, handler)._isBinding = true;
          continue;
        }
        connect(target, signal, this, handler, {
          override,
          converter,
          updater
        })._isBinding = true;
      } catch (err) {
        console.warn('Failed to reify biniding: ', target, model, signal, handler);
      }
    }
  }
  
  /**
   * Install all of the exposed props in the view as defined.
   */
  reifyExposedProps () {
    const { properties: props } = this.propertiesAndPropertySettings();
    const descriptors = properties.allPropertyDescriptors(this);
    for (let prop of this.expose || []) {
      if (obj.isArray(prop)) {
        // expose is a redirect
        const [subProp, { model, target }] = prop;
        let redirected;
        if (model) redirected = this.view.getSubmorphNamed(model).viewModel;
        if (target) redirected = this.view.getSubmorphNamed(target);
        Object.defineProperty(this.view, subProp, {
          configurable: true,
          get: () => { 
            const val = redirected[subProp];
            if (obj.isFunction(val)) return val.bind(redirected);
            return val;
          },
          // if read only prop then an error will be thrown on the viewModel which is a little confusing
          // but fine for now
          set: (v) => { return redirected[subProp] = v; }
        });
        continue;
      }
      
      if (obj.isObject(prop)) {
        const { method, as } = prop;
        this.view[as] = (...args) => {
          return this[method](...args);
        };
        continue;
      }
      
      const descr = descriptors[prop];
      if (props[prop] || descr && (!!descr.get || !!descr.set)) {
        // install getter setter
        Object.defineProperty(this.view, prop, {
          configurable: true,
          get: () => { return this[prop]; },
          // if read only prop then an error will be thrown on the viewModel which is a little confusing
          // but fine for now
          set: (v) => { return this[prop] = v; }
        });
        continue;
      }
      // this is not working when the prop defines a custom setter
      // we need to instead define a custom getter here
      this.view[prop] = (...args) => {
        return this[prop](...args);
      };
    }
  }
  
  /**
   * Invoke the given callback function without the bindings in the view being active.
   * This allows us to perform changes in the view without accidentally triggering any
   * unintended feedback cycles. In case the function is asynchronous, the bindings will
   * be disabled as long as the function needs to terminate.
   * @param { function } cb - The function to invoke while the bindings are disabled.
   */
  withoutBindingsDo (cb) {
    this.onDeactivate();
    let res;
    try {
      res = cb();
    } catch (err) {
      console.error(err.message);
    }
    if (res && res.then) return res.then(() => this.onActivate());
    else this.onActivate();
  }
  
  /**
   * Returns the list of all bindings connections instantiated within the
   * scope of the view model.
   * @return { AttributeConnection[] }
   */
  getBindingConnections () {
    const bindingConnections = [];
    const bindingDefinitions = this.bindings;
    const collect = conns => {
      conns.forEach(conn => {
        if (conn.targetObj === this && !!bindingDefinitions.find(def => {
          if (obj.isFunction(def.handler)) { return conn.targetObj.toString() === def.handler.toString(); }
          return conn.sourceAttrName === def.signal && conn.targetMethodName === def.handler;
        })) {
          bindingConnections.push(conn);
        }
      });
    };
    this.doWithScope(m => {
      if (m.attributeConnections) {
        collect(m.attributeConnections);
      }
      if (m.viewModel && m.viewModel.attributeConnections) {
        collect(m.viewModel.attributeConnections);
      }
    });
    return bindingConnections;
  }
  
  /**
   * Attaches the view model to the given view and initializes all
   * the bindings and exposed props alongside. Also invokes lifycle methods
   * accordingly.
   * @param { Morph } view - The view we are attaching to.
   */
  attach (view) {
    this.view = view;
    this.reifyBindings();
    this.reifyExposedProps();
    view.toString = () => `<${getClassName(view)}[${getClassName(this)}]>`;
    this.onRefresh();
    this.viewDidLoad();
  }
}

function mergeInHierarchy (root, props, iterator, executeCommands = false) {
  iterator(root, props);
  let [commands, nextPropsToApply] = arr.partition([...props.submorphs || []], (prop) => !!prop.COMMAND);
  props = nextPropsToApply.shift();
  for (let submorph of root.submorphs) {
    if (!props) break;
    if (submorph.name === props.name) {
      mergeInHierarchy(submorph, props, iterator, executeCommands);
      props = nextPropsToApply.shift();
    }
  }
  // finally we apply the commands
  if (!root.isMorph || !executeCommands) return;
  for (let cmd of commands) {
    if (cmd.COMMAND === 'remove') {
      const morphToRemove = root.submorphs.find(m => m.name === cmd.target);
      if (morphToRemove) morphToRemove.remove();
    }

    if (cmd.COMMAND === 'add') {
      const beforeMorph = root.submorphs.find(m => m.name === cmd.before);
      root.addMorph(cmd.props, beforeMorph).__wasAddedToDerived__ = true;
    }
  }
}

function mergeInMorphicProps (root, props) {
  const layoutAssignments = [];
  mergeInHierarchy(root, props, (aMorph, props) => {
    if (props.master) {
      aMorph.master = props.master; // assign master before anything else
    }
    Object.assign(aMorph, obj.dissoc(props, ['submorphs', 'viewModel', 'layout', 'master']));
    if (props.layout) layoutAssignments.push([aMorph, props.layout]);
  }, true);
  for (let [aMorph, layout] of layoutAssignments) {
    aMorph.layout = layout; // trigger assignment now after commands have run through
  }
}

function mergeInModelProps (root, props) {
  mergeInHierarchy(root, props, (aMorph, props) => {
    if (aMorph.viewModel && props.viewModel) {
      Object.assign(aMorph.viewModel, props.viewModel);
    }
    if (aMorph.viewModel !== props.viewModel && props.viewModel && props.viewModel instanceof ViewModel) {
      props.viewModel.attach(aMorph);
    }
  });
}

// this needs to work more directly without triggering the submorph traversal

export class PolicyRetargeting {
  // automatically harvest the policy from the root
  constructor (policyContext) {
    this.morphsWithPolicies = {};
    if (policyContext) {
      policyContext.withAllSubmorphsSelect(m => m.master).forEach(m => {
        this.morphsWithPolicies[m.id] = m;
      });
    }
  }

  serializeObject (newObj) {
    if (newObj.master) this.morphsWithPolicies[newObj.id] = newObj;
    return null;
  }

  // gather all morphs with policies also outside of submorph hierarchy (connections)

  // ensure that the master is not deserialized, since we manually retarget it anyways.
  // how? delete the master property will mutate the snapshot...
  propertiesToSerialize (pool, ref, snapshot, keysSoFar) {
    return arr.without(keysSoFar, 'master');
  }
  
  // if this plugin is provided the policies are retargeted to the original inline policies
  additionallyDeserializeAfterProperties (pool, ref, newObj, snapshot, serializedObjMap, path) {
    const policyHolder = this.morphsWithPolicies[ref.id];
    if (policyHolder) {
      newObj.withMetaDo({ metaInteraction: true }, () => {
        // bypass the setter here so that we do not invoke submorph traversal
        // newObj.master = { auto: policyHolder.master };
        newObj.setProperty('master', ComponentPolicy.for(newObj, { auto: policyHolder.master }, false));
      });
    }
  }
}

/**
 * Instantiates a morph based off a master component. This function also allows to further
 * customize the derived instance inline, overridding properties and adding/removing certain
 * submorphs withing the instantiated morph's submorph hierarchy.
 * @param { Morph } masterComponent - The master component that we want the new morph to be derived from.
 * @param { object } overriddenProps - A nested object containing properties that override the original properties of morphs within the submorph hierarchy.
 * @returns { Morph } A new morph derived from the master component.
 */
export function part (masterComponent, overriddenProps = {}, oldParam) {
  if (oldParam) overriddenProps = oldParam;
  let snap = masterComponent._snap;
  let retargetPlugin = masterComponent._retargetPlugin || new PolicyRetargeting();
  if (!snap) {
    snap = serializeMorph(masterComponent, { plugins: [...allPlugins, retargetPlugin] });
    delete snap.snapshot[snap.id].props.master;
    delete snap.snapshot[snap.id].props.isComponent; 
  }
  const p = deserializeMorph(snap, { reinitializeIds: true, migrations: [], plugins: [...allPlugins, retargetPlugin] }); 
 
  // ensure master is initialized before overriding
  // this skips derived morphs that are not reachable via submorphs
  p.withAllSubmorphsDo(m => delete m._parametrizedProps); // we do not need to take into account parametrized props from the deserialization
  p.master = overriddenProps.master || masterComponent;
  // traverse the morphic props via submorphs and apply the props via name + structure
  p.withAllSubmorphsDo(m => {
    if (m.viewModel) m.viewModel.attach(m);
    // this is only needed to detrmine the overriden props.
    // This can also be achieved via proper serialization...
    // This saves us from unnessecary and possibly expensive application cycles
    if (m.master) {
      // clear the local overridden props since they are not needed!
      m.master._overriddenProps = new WeakMap();
      m.master.applyIfNeeded(true);
    }
  });

  mergeInMorphicProps(p, overriddenProps);

  p.withAllSubmorphsDo(m => {
    if (m.master) m.master.applyIfNeeded(true);
  });
  
  const viewModelClass = overriddenProps.viewModelClass || masterComponent.viewModelClass || overriddenProps.defaultViewModel || masterComponent.defaultViewModel;
  if (viewModelClass) {
    p.viewModel = new viewModelClass(overriddenProps.viewModel || {});
    p.viewModel.attach(p);
  }
  mergeInModelProps(p, overriddenProps);
  // now apply viewModel adjustements to submorphs
  return p;
}

/**
 * Defines a morph that serves as a master component for other morphs in the system.
 * @param { Morph|Object } masterComponentOrProps - Either a master component (that this component is to be derived from) or a nested properties structure that fully specs out the submorph hierarchy of the master component to be defined.
 * @param { Object } [overriddenProps] - In case we derive the component from another component in the system, we can further provide overridden props here as the second argument.
 * @returns { Morph } A new morph that serves as a master component in the system.
 */
export function component (masterComponentOrProps, overriddenProps) {
  let c, props, type;
  if (!overriddenProps) {
    props = masterComponentOrProps;
    masterComponentOrProps = null;
  } else {
    props = overriddenProps;
  }

  if (masterComponentOrProps) {
    c = part(masterComponentOrProps, overriddenProps);
    c.defaultViewModel = masterComponentOrProps.defaultViewModel;
    c.viewModelClass = masterComponentOrProps.viewModelClass;
  } else c = morph({ ...props });
  
  if (overriddenProps && (type = overriddenProps.type)) {
    if (obj.isString(type)) {
      type = getClassForName(type);
    }
    adoptObject(c, type);
  }
  
  c.isComponent = true;
  if (props.defaultViewModel) {
    // attach the view model;
    c.defaultViewModel = props.defaultViewModel;
    c.viewModelClass = props.viewModelClass;
  }
  // detect all sub view models and detach them again, since we dont
  // want to have the bahvior interfere with the morph hierarchy
  // also gather all master in the scope so we can wait for them

  c.withAllSubmorphsDo(m => {
    if (m.viewModel) m.viewModel.onDeactivate();
    if (m.master) {
      m.master.applyIfNeeded(!m.master._appliedMaster);
    }
  });
  // this is often not called... especially in cases where we derive from a master
  c.updateDerivedMorphs();
  const retargetPlugin = new PolicyRetargeting();
  c._snap = serializeMorph(c, { plugins: [...allPlugins, retargetPlugin] });
  c._retargetPlugin = retargetPlugin;
  // remove the master ref from the snap of the component
  delete c._snap.snapshot[c._snap.id].props.master;
  delete c._snap.snapshot[c._snap.id].props.isComponent;
  return c;
}

/**
 * Function that will wrap a morph's name and declare
 * that this morph is removed from the submorph array it is located in.
 * This is meant to be used inside overriden props of `part(C, {...})` or `component(C, {...})`
 * calls. It will not make sense on `morph({...})` or `component({...})` calls.
 * @param { string } removedSiblingName - The name of the submorph that is to be removed from the hierarchy.
 */
export function without (removedSiblingName) {
  return {
    COMMAND: 'remove',
    target: removedSiblingName
  };
}

/**
 * Function that will wrap a morph definition and declares
 * that this morph is added to the submorph array it is placed in.
 * This is meant to be used inside overriden props of `part(C, {...})` or `component(C, {...})`
 * calls. It will not make sense on `morph({...})` or `component({...})` calls.
 * If before is specified this will ensure that the morph is added before the morph
 * named as before.
 * @param { object } props - A nested properties object that specs out the submorph hierarchy to be added. (This can also be a `part()` call).
 * @param { string } [before] - An optional parameter that denotes the name of the morph this new one should be placed in front of.
 */
export function add (props, before) {
  return {
    COMMAND: 'add',
    props,
    before
  };
}

function insertFontCSS (name, fontUrl) {
  if (fontUrl.endsWith('.otf')) {
    addOrChangeCSSDeclaration(`${name}`,
         `@font-face {
             font-family: ${name};
             src: url("${fontUrl}") format("opentype");
         }`);
  } else addOrChangeCSSDeclaration(`${name}`, `@import url("${fontUrl}");`);
}

/**
 * Ensures that a set of added fonts is loaded in the system.
 * @params { object } addedFonts - A map of custom fonts that are to be loaded.
 */
export function ensureFont (addedFonts) {
  for (const name in addedFonts) {
    if (!$world.env.fontMetric.isFontSupported(sanitizeFont(name))) {
      insertFontCSS(name, addedFonts[name]);
    }
  }
}
