import { addOrChangeCSSDeclaration } from 'lively.morphic';
import { string, properties, obj } from 'lively.lang';
import { getClassName, ExpressionSerializer } from 'lively.serializer2';
import { epiConnect } from 'lively.bindings';
import { sanitizeFont, morph } from '../helpers.js';
import { PolicyApplicator, without, add } from './policy.js';

const expressionSerializer = new ExpressionSerializer();

/**
 * By default component() or part() calls return morph instances. However when we evalute top level
 * master component definitions in a component module, we do not want to evaluate to morphs since
 * we prefer a lean internal representation instead. We control this behavior internally with this flag.
 */
let evaluateAsSpec = false;

/**
 * Defines the core interface for defining and using master components in the system.
 * Components are defined in component files and allow for a file based definition of master components
 * such that collaboration on top of "state of the art" collaboration systems is feasable.
 * Existing systems do only work purely with text, so we are bound to keep up with that
 * as long as we are reliant on the present collaboration plattforms and toolchains.
 * @module lively.morphic/components/core.js
 */

/**
 * When we define master components, we do not want them to directly evaluate
 * to morphs themselves. Instead we return this ComponentDescriptor object
 * which contains the following bits of information:
 * 1. The module meta information about where the component's definition is stored. This is inserted via the source transformation.
 * 2. A derivation info, which keeps a list of dependent component descriptors which need to be informed in case the master component's defintion changes.
 * 3. A generator function that returns us a fresh instance of the master component.
 *    This can be used to create new derivations or the actual instance of the master component for direct manipulation.
 */
export class ComponentDescriptor {
  /**
   * Evaluates to an internal spec representation, which avoids any morphic related initialization
   * and object allocations. Allows for fast component definition initalization, derivation
   * and style application.
   */
  static for (generatorFunction, meta, previousDescriptor) {
    return new this(this.extractSpec(generatorFunction), meta);
  }

  get isComponentDescriptor () { return true; }

  __serialize__ () {
    const meta = this[Symbol.for('lively-module-meta')];
    return expressionSerializer.exprStringEncode({
      __expr__: meta.exportedName,
      bindings: { [meta.moduleId]: meta.exportedName }
    });
  }

  /**
   * How do we handle the part calls? These need to be resolved a well.
   * A part call outside of a spec can return a morph, but within a spec it needs to act differently.
   * We therefore toggle the `evaluateAsSpec` flag to enforce spec evaluation in all the subsequent part
   * calls that occur in our generatorFunction()
   */
  static extractSpec (generatorFunction) {
    morph.evaluateAsSpec = evaluateAsSpec = true;
    morph.usedNames = new Set();

    let spec = {};
    try {
      spec = generatorFunction();
      if (!spec.isPolicy) { spec = new PolicyApplicator(spec); } // make part calls return the synthesized spec
    } finally {
      morph.evaluateAsSpec = evaluateAsSpec = false; // always disable this flag after spec initialization is finished
    }
    return spec;
  }

  /**
   * Creates a new component definition.
   * @param { function|object } generatorFunctionOrSpec - Either the generator function (deprecated) or spec object that defines the component's structure.
   * @param { object } meta - Module and sourcecode specific meta information such as code location etc.
   */
  constructor (generatorFunctionOrSpec, meta) {
    this.init(generatorFunctionOrSpec, meta);
  }

  init (generatorFunctionOrInlinePolicy, meta = { moduleId: import.meta.url }) {
    delete this._snap;
    delete this._cachedComponent;
    if (generatorFunctionOrInlinePolicy.isPolicy) {
      this.stylePolicy = generatorFunctionOrInlinePolicy; // is a inline policy object that can return us a spec object which can be used to create instances and components
      this.stylePolicy.addMetaInfo(meta); // also add the meta info to this property, so that we can properly serialize policies
    } else {
      this.generatorFunction = generatorFunctionOrInlinePolicy; // returns old fashioned component object
    }
    this[Symbol.for('lively-module-meta')] = meta;

    return this;
  }

  /**
   * Create a policy that is derived from the current one.
   * @param { object } spec - The overridden properties that "extends" the policy.
   * @returns { PolicyApplicator } The new derived policy.
   */
  extend (spec) {
    return new PolicyApplicator(spec, this);
  }

  /**
   * Creates a morph from the policy.
   * @param { object } props - The overridden properties that apply for this concrete instantiation.
   * @param { boolean } asComponentProxy - Wether or not the created morph should serve as a direct manipulation representation of the policy definition.
   * @returns { Morph } The derived morph.
   */
  derive (props) {
    return this.stylePolicy.instantiate(props);
  }
}

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
        serialize: false,
        set (v) {
          this.setProperty('view', v);
          if (v) v.viewModel = this;
        }
      },
      bindings: {
        serialize: false,
        readOnly: true,
        get () {
          return [];
        }
      },
      models: {
        serialize: false,
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
      expose: {
        serialize: false,
        get () {
          return [];
        }
      },
      styleProperties: {
        group: 'styling',
        derived: true,
        readOnly: true,
        get () {
          const { properties, order } = this.propertiesAndPropertySettings();
          const styleProps = [];
          for (const prop of order) {
            if (properties[prop].isStyleProp || properties[prop].isComponent) { styleProps.push(prop); }
          }
          return styleProps;
        }
      },
      liveStyleClasses: {
        group: 'styling',
        defaultValue: [],
        doc: 'An array of style classes which are applied to `Components` that have the behavior of this `ViewModel` applied.'
      },
      ui: {
        serialize: false,
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
    this.liveStyleClasses.forEach(klass => this.view.removeStyleClass(klass));
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
    this.liveStyleClasses.forEach(klass => this.view.addStyleClass(klass));
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
    delete this._ui;
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
          epiConnect(target, signal, handler);
          continue;
        }
        epiConnect(target, signal, this, handler, {
          override,
          converter,
          updater
        });
      } catch (err) {
        if (System.debug) console.warn('Failed to reify binding: ', target, model, signal, handler);
      }
    }
  }

  /**
   * Install all of the exposed props in the view as defined.
   */
  reifyExposedProps () {
    // fixme: also delete previously exposed props such that they
    //        are no longer exposed!
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
        this.view[as].toString = () => this[method].toString();
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
      if (obj.isFunction(this[prop])) {
        this.view[prop].toString = () => this[prop].toString();
      }
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
    if (res && res.then) { return res.then(() => { this.onActivate(); return res; }); } else this.onActivate();
    return res;
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

  keysForCommand (commandName, pretty = true) {
    const map = this.view.keyCommandMap;
    const rawKey = Object.keys(map).find(key => map[key].name === commandName);
    return rawKey && pretty ? map[rawKey].prettyKeys : rawKey;
  }

  /**
   * Allows to fully disconnect the view model from its view.
   */
  detach () {
    this.onDeactivate();
    this.view = null;
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
export function part (componentDescriptor, overriddenProps = {}) {
  if (evaluateAsSpec) {
    if (!overriddenProps.name && morph.usedNames.has(componentDescriptor.stylePolicy.name)) overriddenProps.name = string.newUUID();
    morph.usedNames.add(componentDescriptor.stylePolicy.name);
    return componentDescriptor.extend(overriddenProps); // creates an abstract inline policy
  }

  if (componentDescriptor.isComponentDescriptor) {
    return componentDescriptor.derive(overriddenProps);
  } else if (componentDescriptor.isPolicy) {
    return componentDescriptor.instantiate(overriddenProps);
  }
}

/**
 * Defines a morph that serves as a master component for other morphs in the system.
 * @param { Morph|Object } masterComponentOrProps - Either a master component (that this component is to be derived from) or a nested properties structure that fully specs out the submorph hierarchy of the master component to be defined.
 * @param { Object } [overriddenProps] - In case we derive the component from another component in the system, we can further provide overridden props here as the second argument.
 * @returns { Morph } A new morph that serves as a master component in the system.
 */
export function component (masterComponentOrProps, overriddenProps) {
  let props;
  if (!overriddenProps) {
    props = masterComponentOrProps;
    masterComponentOrProps = null;
  } else {
    props = overriddenProps;
  }

  if (masterComponentOrProps) {
    return new PolicyApplicator(props, masterComponentOrProps);
  } else {
    return props;
  }
}

if (!component.DescriptorClass) component.DescriptorClass = ComponentDescriptor;
component.for = (generator, meta, prev) => component.DescriptorClass.for(generator, { moduleId: meta.module, exportedName: meta.export, range: meta.range }, prev);

export { add, without };

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
  if (typeof $world === 'undefined') {
    // defer loading of fonts until world has been loaded
    setTimeout(() => ensureFont(addedFonts), 100);
    return;
  }
  for (const name in addedFonts) {
    if (!$world.env.fontMetric.isFontSupported(sanitizeFont(name))) {
      insertFontCSS(name, addedFonts[name]);
    }
  }
}
