import { morph, addOrChangeCSSDeclaration } from 'lively.morphic';
import { string, properties, arr, obj } from 'lively.lang';
import { getClassName } from 'lively.serializer2';
import { connect } from 'lively.bindings';
import { deserializeMorph, serializeMorph } from '../serialization.js';
import { sanitizeFont } from '../helpers.js';

// varargs, viewModelProps can be skipped
export function part (masterComponent, overriddenProps = {}, oldParam) {
  if (oldParam) overriddenProps = oldParam;
  const p = masterComponent._snap ? deserializeMorph(masterComponent._snap, { reinitializeIds: true, migrations: [] }) : masterComponent.copy();
  // instead of that deserialize the snapshot without the master itself
  p.isComponent = false;
  // ensure master is initialized before overriding
  delete p._parametrizedProps;
  p.withAllSubmorphsDoExcluding(m => {
    if (m != p && !m.master) { delete m._parametrizedProps; }
  }, m => m != p && m.master);
  // this skips derived morphs that are not reachable via submorphs
  p.master = masterComponent;
  p.withAllSubmorphsDo(m => {
    if (m.viewModel) m.viewModel.attach(m);
    // this is only needed to detrmine the overriden props.
    // This can also be achieved via proper serialization...
    // This saves us from unnessecary and possibly expensive application cycles
    if (m.master) m.master.applyIfNeeded(true);
  });
  // traverse the morphic props via submorphs and apply the props via name + structure
  mergeInMorphicProps(p, overriddenProps);
  const viewModelClass = overriddenProps.defaultViewModel || masterComponent.defaultViewModel;
  if (viewModelClass) {
    p.viewModel = new viewModelClass(overriddenProps.viewModel || {});
    p.viewModel.attach(p);
  }
  mergeInModelProps(p, overriddenProps);
  // now apply viewModel adjustements to submorphs
  return p;
}

// first argument can also be a component!
// the argument after that are then the overridden properties...
export function component (masterComponentOrProps, overriddenProps) {
  let c, props;
  if (!overriddenProps) {
    props = masterComponentOrProps;
    masterComponentOrProps = null;
  } else {
    props = overriddenProps;
  }

  if (masterComponentOrProps) {
    c = part(masterComponentOrProps, overriddenProps);
    c.defaultViewModel = masterComponentOrProps.defaultViewModel;
  } else c = morph({ ...props });
  c.isComponent = true;
  if (props.defaultViewModel) {
    // attach the view model;
    c.defaultViewModel = props.defaultViewModel;
  }
  // detect all sub view models and detach them again, since we dont
  // want to have the bahvior interfere with the morph hierarchy
  // also gather all master in the scope so we can wait for them
  const mastersInScope = arr.compact(c.withAllSubmorphsDo(m => {
    if (m.viewModel) m.viewModel.onDeactivate();
    return m.master;
  }));
  // also attach the component change monitor here? no because we do not want IDE capabilities in morphic.
  // instead perform the injection from the system browser
  Promise.all(mastersInScope.map(m => {
    if (!m._appliedMaster) m.applyIfNeeded(true);
    return m.whenApplied();
  })).then(() => {
    // this is often not called... especially in cases where we derive from a master
    c.updateDerivedMorphs();
    c._snap = serializeMorph(c);
    // remove the master ref from the snap of the component
    delete c._snap.snapshot[c._snap.id].props.master;
    delete c._snap.snapshot[c._snap.id].props.isComponent;
  });
  return c;
}

/**
 * Decorator function that will wrap a morph's name and ensure
 * that this morph is removed from the submorph array it is located in.
 * This is meant to be used inside overriden props of part(C, {...}) or component(C, {...})
 * calls. It will not make sense on morph({...}) or component({...}) calls.
 */
export function without (removedSiblingName) {
  return {
    COMMAND: 'remove',
    target: removedSiblingName
  };
}

/**
 * Decorator function that will wrap a morph definition and ensure
 * that this morph is added to the submorph array it is placed in.
 * This is meant to be used inside overriden props of part() or component(C, {...})
 * calls. It will not make sense on morph({...}) or component({...}) calls.
 * If before is specified this will ensure that the morph is added before the morph
 * named as before
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

export function ensureFont (addedFonts) {
  for (const name in addedFonts) {
    if (!$world.env.fontMetric.isFontSupported(sanitizeFont(name))) {
      insertFontCSS(name, addedFonts[name]);
    }
  }
}

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
        // the root morph of the hierarchy that we are responsible for
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
        (descr.hasOwnProperty('serialize') && !descr.serialize) ||
        obj.equals(this[key], defaults[key])
      ) continue;
      propsToSerialize.push(key);
    }
    return propsToSerialize;
  }

  // __after_deserialize__ (snapshot, ref, pool) {
  //   if (this.view) this.attach(this.view);
  // }

  world () {
    return this.view.world();
  }

  execCommand (cmdName, opts) {
    return this.view.execCommand(cmdName, opts);
  }

  doWithScope (cb) {
    return this.view && this.view.withAllSubmorphsDoExcluding(cb, (m) => m.ignoreScope || (m.viewModel && m.viewModel != this));
  }

  constructor (props = {}) {
    this.initializeProperties(props);
  }

  onDeactivate () {
    // retrieve all binding connections and disable them
    this.getBindingConnections().forEach(conn => conn.disconnect());
  }

  onActivate () {
    if (this.view.viewModel != this) return;
    // retrieve all binding connections and enable them
    this.reifyBindings();
  }

  viewDidLoad () {
    // called once the view is fully loaded and attached
  }

  onRefresh (change) {
    // default refresh callback to perform updates in the view
    // fixme: Refresh should not get called if view has not been
    // loaded fully or not attached yet
    // maybe rename to onChange() analogous to morphs?
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
          connect(target, signal, handler);
          continue;
        }
        connect(target, signal, this, handler, {
          override,
          converter,
          updater
        });
      } catch (err) {
        console.warn('Failed to reify biniding: ', target, model, signal, handler);
      }
    }
  }

  async withoutBindingsDo (cb) {
    this.onDeactivate();
    await cb();
    this.onActivate();
  }

  reifyExposedProps () {
    const { properties: props } = this.propertiesAndPropertySettings();
    const descriptors = properties.allPropertyDescriptors(this);
    for (let prop of this.expose || []) {
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

  getBindingConnections () {
    const bindingConnections = [];
    const bindingDefinitions = this.bindings;
    const collect = conns => {
      conns.forEach(conn => {
        if (conn.targetObj == this && !!bindingDefinitions.find(def => {
          if (obj.isFunction(def.handler)) { return conn.targetObj.toString() === def.handler.toString(); }
          return conn.sourceAttrName == def.signal && conn.targetMethodName == def.handler;
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

  attach (view) {
    // connect the bindings!
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
    if (submorph.name == props.name) {
      mergeInHierarchy(submorph, props, iterator, executeCommands);
      props = nextPropsToApply.shift();
    }
  }
  // finally we apply the commands
  if (!root.isMorph || !executeCommands) return;
  for (let cmd of commands) {
    if (cmd.COMMAND == 'remove') {
      const morphToRemove = root.submorphs.find(m => m.name == cmd.target);
      if (morphToRemove) morphToRemove.remove();
    }

    if (cmd.COMMAND == 'add') {
      const beforeMorph = root.submorphs.find(m => m.name == cmd.before);
      root.addMorph(cmd.props, beforeMorph).__wasAddedToDerived__ = true;
    }
  }
}

function mergeInMorphicProps (root, props) {
  const layoutAssignments = [];
  mergeInHierarchy(root, props, (aMorph, props) => {
    Object.assign(aMorph, obj.dissoc(props, ['submorphs', 'viewModel', 'layout']));
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
    if (!aMorph.viewModel && props.viewModel && props.viewModel instanceof ViewModel) {
      props.viewModel.attach(aMorph);
    }
  });
}
