import { morph } from 'lively.morphic';
import { string, arr, obj } from 'lively.lang';
import { getClassName } from 'lively.serializer2';
import { connect } from 'lively.bindings';

// varargs, viewModelProps can be skipped
export function part (masterComponent, viewModelProps = {}, morphicProps = {}) {
  const p = masterComponent.copy();
  p.isComponent = false;
  p.master = masterComponent;
  // ensure master is initialized before overriding
  delete p._parametrizedProps;
  p.withAllSubmorphsDoExcluding(m => {
    if (m != p && !m.master) { delete m._parametrizedProps; }
  }, m => m != p && m.master);
  p.withAllSubmorphsDo(m => {
    if (m.viewModel) m.viewModel.attach(m);
    if (m.master) m.master.applyIfNeeded(true);
  });
  // traverse the morphic props via submorphs and apply the props via name + structure
  mergeInMorphicProps(p, morphicProps);
  if (masterComponent.defaultViewModel) {
    p.viewModel = new masterComponent.defaultViewModel(viewModelProps);
    p.viewModel.attach(p);
  }
  mergeInModelProps(p, morphicProps);
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
    c = part(masterComponentOrProps, {}, overriddenProps);
    c.defaultViewModel = masterComponentOrProps.defaultViewModel;
  } else c = morph({ ...props });
  c.isComponent = true;
  if (props.defaultViewModel) {
    // attach the view model;
    c.defaultViewModel = props.defaultViewModel;
  }
  // detect all sub view models and detach them again, since we dont
  // want to have the bahvior interfere with the morph hierarchy
  c.withAllSubmorphsDo(m => {
    if (m.viewModel) m.viewModel.onDeactivate();
  });
  // also attach the component change monitor here? no because we do not want IDE capabilities in morphic.
  // instead perform the injection from the system browser
  setTimeout(() => c.updateDerivedMorphs());
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

export class ViewModel {
  static get propertySettings () {
    return {
      defaultGetter (key) { return this.getProperty(key); },
      defaultSetter (key, value) { this.setProperty(key, value); },
      valueStoreProperty: '_viewState'
    };
  }

  toString () {
    return `<${getClassName(this)} - ${this.view.name}>`;
  }

  static get properties () {
    return {
      view: {
        // the root morph of the hierarchy that we are responsible for
        set (v) {
          this.setProperty('view', v);
          v.viewModel = this;
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

  world () {
    return this.view.world();
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
    // retrieve all binding connections and enable them
    this.reifyBindings();
  }

  onRefresh () {
    // default refresh callback to perform updates in the view
  }

  getProperty (key) {
    return this._viewState[key];
  }

  setProperty (key, value) {
    this._viewState[key] = value;
  }

  reifyBindings () {
    for (let { target, model, signal, handler } of this.bindings) {
      if (model) target = this.view.getSubmorphNamed(model).viewModel;
      if (typeof target === 'string') { target = this.view.getSubmorphNamed(target); }
      if (!target) target = this.view;

      connect(target, signal, this, handler, {
        override: true
      });
    }
  }

  reifyExposedProps () {
    const { properties } = this.propertiesAndPropertySettings();
    for (let prop of this.expose || []) {
      if (properties[prop]) {
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
      this.view[prop] = (...args) => {
        this[prop](...args);
      };
    }
  }

  getBindingConnections () {
    const bindingConnections = [];
    const bindingDefinitions = this.bindings;
    this.doWithScope(m => {
      if (m.attributeConnections) {
        m.attributeConnections.forEach(conn => {
          if (conn.targetObj == this && !!bindingDefinitions.find(def => {
            return conn.sourceAttrName == def.signal && conn.targetMethodName == def.handler;
          })) {
            bindingConnections.push(conn);
          }
        });
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
  }
}

function mergeInHierarchy (root, props, iterator, executeCommands = false) {
  iterator(root, props);
  let [commands, nextPropsToApply] = arr.partition([...props.submorphs || []], (prop) => !!prop.COMMAND);
  props = nextPropsToApply.shift();
  for (let submorph of root.submorphs) {
    if (!props) break;
    if (submorph.name == props.name) {
      mergeInHierarchy(submorph, props, iterator);
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
      root.addMorph(cmd.props, beforeMorph);
    }
  }
}

function mergeInMorphicProps (root, props) {
  mergeInHierarchy(root, props, (aMorph, props) => {
    Object.assign(aMorph, obj.dissoc(props, ['submorphs', 'viewModel']));
  }, true);
}

function mergeInModelProps (root, props) {
  mergeInHierarchy(root, props, (aMorph, props) => {
    if (aMorph.viewModel && props.viewModel) {
      Object.assign(aMorph.viewModel, props.viewModel);
    }
  });
}
