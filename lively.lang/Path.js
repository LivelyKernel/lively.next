// -=-=-=-=-=-=-=-=-=-=-=-=-=-
// js object path accessor
// -=-=-=-=-=-=-=-=-=-=-=-=-=-

// show-in-doc
// A `Path` is an objectified chain of property names (kind of a "complex"
// getter and setter). Path objects can make access and writes into deeply nested
// structures more convenient. `Path` provide "safe" get and set operations and
// can be used for debugging by providing a hook that allows users to find out
// when get/set operations happen.

import { inspect } from './object.js';

export default function Path (p, splitter) {
  if (p instanceof Path) return p;
  if (!(this instanceof Path)) return new Path(p, splitter);
  this.setSplitter(splitter || '.');
  this.fromPath(p);
}

Object.assign(Path.prototype, {

  get isPathAccessor () { return true; },

  fromPath (path) {
    // ignore-in-doc
    if (typeof path === 'string' && path !== '' && path !== this.splitter) {
      this._parts = path.split(this.splitter);
      this._path = path;
    } else if (Array.isArray(path)) {
      this._parts = [].concat(path);
      this._path = path.join(this.splitter);
    } else {
      this._parts = [];
      this._path = '';
    }
    return this;
  },

  setSplitter (splitter) {
    // ignore-in-doc
    if (splitter) this.splitter = splitter;
    return this;
  },

  map (fn) {
    this._mapper = fn;
    return this;
  },

  parts () { /* key names as array */ return this._parts; },

  size () { /* show-in-doc */ return this._parts.length; },

  slice (n, m) { /* show-in-doc */ return Path(this.parts().slice(n, m)); },

  normalizePath () {
    // ignore-in-doc
    // FIXME: define normalization
    return this._path;
  },

  isRoot (obj) { return this._parts.length === 0; },

  isIn (obj) {
    // Does the Path resolve to a value when applied to `obj`?
    if (this.isRoot()) return true;
    const parent = this.get(obj, -1);
    return parent && Object.hasOwn(parent, this._parts[this._parts.length - 1]);
  },

  equals (obj) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path(["foo", 1, "bar", "baz"]);
    // // Path's can be both created via strings or pre-parsed with keys in a list.
    // p1.equals(p2) // => true
    return obj && obj.isPathAccessor && this.parts().equals(obj.parts());
  },

  isParentPathOf (otherPath) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1.bar");
    // p2.isParentPathOf(p1) // => true
    // p1.isParentPathOf(p2) // => false
    otherPath = otherPath && otherPath.isPathAccessor
      ? otherPath
      : Path(otherPath);
    const parts = this.parts();
    const otherParts = otherPath.parts();
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] != otherParts[i]) return false;
    }
    return true;
  },

  relativePathTo (otherPath) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1");
    // p2.relativePathTo(p1) // => Path(["bar","baz"])
    // p1.relativePathTo(p2) // => undefined
    otherPath = Path(otherPath);
    return this.isParentPathOf(otherPath)
      ? otherPath.slice(this.size(), otherPath.size())
      : undefined;
  },

  del (obj) {
    if (this.isRoot()) return false;
    let parent = obj;
    for (let i = 0; i < this._parts.length - 1; i++) {
      const part = this._parts[i];
      if (Object.hasOwn(parent, part)) {
        parent = parent[part];
      } else return false;
    }
    return delete parent[this._parts[this._parts.length - 1]];
  },

  withParentAndKeyDo (obj, ensure, doFunc) {
    // Deeply resolve path in `obj`, not fully, however, only to the parent
    // element of the last part of path. Take the parent, the key (the last
    // part of path) and pass it to `doFunc`. When `ensure` is true, create
    // objects along path it path does not resolve
    if (this.isRoot()) return doFunc(null, null);
    let parent = obj;
    for (let i = 0; i < this._parts.length - 1; i++) {
      const part = this._parts[i];
      if (Object.hasOwn(parent, part) && (typeof parent[part] === 'object' || typeof parent[part] === 'function')) {
        parent = parent[part];
      } else if (ensure) {
        parent = parent[part] = {};
      } else {
        return doFunc(null, part);
      }
    }
    return doFunc(parent, this._parts[this._parts.length - 1]);
  },

  set (obj, val, ensure) {
    // Deeply resolve path in `obj` and set the resulting property to `val`. If
    // `ensure` is true, create nested structure in between as necessary.
    // Example:
    // var o1 = {foo: {bar: {baz: 42}}};
    // var path = Path("foo.bar.baz");
    // path.set(o1, 43)
    // o1 // => {foo: {bar: {baz: 43}}}
    // var o2 = {foo: {}};
    // path.set(o2, 43, true)
    // o2 // => {foo: {bar: {baz: 43}}}
    return this.withParentAndKeyDo(obj, ensure,
      function (parent, key) { return parent ? parent[key] = val : undefined; });
  },

  defineProperty (obj, propertySpec, ensure) {
    // like `Path>>set`, however uses Objeect.defineProperty
    return this.withParentAndKeyDo(obj, ensure,
      function (parent, key) {
        return parent
          ? Object.defineProperty(parent, key, propertySpec)
          : undefined;
      });
  },

  get (obj, n) {
    // show-in-doc
    const parts = n ? this._parts.slice(0, n) : this._parts;
    const self = this;
    return parts.reduce(function (current, pathPart) {
      return current ? (self._mapper ? self._mapper(pathPart, current[pathPart]) : current[pathPart]) : current;
    }, obj);
  },

  concat (p, splitter) {
    // show-in-doc
    return Path(this.parts().concat(Path(p, splitter).parts()));
  },

  toString () { return this.normalizePath(); },

  serializeExpr () {
    // ignore-in-doc
    return 'lively.lang.Path(' + inspect(this.parts()) + ')';
  },

  watch (options) {
    // React or be notified on reads or writes to a path in a `target`. Options:
    // ```js
    // {
    //   target: OBJECT,
    //   uninstall: BOOLEAN,
    //   onGet: FUNCTION,
    //   onSet: FUNCTION,
    //   haltWhenChanged: BOOLEAN,
    //   verbose: BOOLEAN
    // }
    // ```
    // Example:
    // // Quite useful for debugging to find out what call-sites change an object.
    // var o = {foo: {bar: 23}};
    // Path("foo.bar").watch({target: o, verbose: true});
    // o.foo.bar = 24; // => You should see: "[object Object].bar changed: 23 -> 24"
    if (!options || this.isRoot()) return;
    const target = options.target;
    const parent = this.get(target, -1);
    const propName = this.parts().slice(-1)[0];
    const newPropName = 'propertyWatcher$' + propName;
    const watcherIsInstalled = parent && Object.hasOwn(parent, newPropName);
    const uninstall = options.uninstall;
    const haltWhenChanged = options.haltWhenChanged;
    const showStack = options.showStack;
    const getter = parent.__lookupGetter__(propName);
    const setter = parent.__lookupSetter__(propName);
    if (!target || !propName || !parent) return;
    if (uninstall) {
      if (!watcherIsInstalled) return;
      delete parent[propName];
      parent[propName] = parent[newPropName];
      delete parent[newPropName];
      var msg = 'Watcher for ' + parent + '.' + propName + ' uninstalled';
      return;
    }
    if (watcherIsInstalled) {
      var msg = 'Watcher for ' + parent + '.' + propName + ' already installed';
      return;
    }
    if (getter || setter) {
      var msg = parent + '["' + propName + '"] is a getter/setter, watching not support';
      console.log(msg);
      return;
    }
    // observe slots, for debugging
    parent[newPropName] = parent[propName];
    parent.__defineSetter__(propName, function (v) {
      const oldValue = parent[newPropName];
      if (options.onSet) options.onSet(v, oldValue);
      let msg = parent + '.' + propName + ' changed: ' + oldValue + ' -> ' + v;
      if (showStack) {
        msg += '\n' + (typeof lively !== 'undefined'
          ? lively.printStack()
          : console.trace());
      }
      if (options.verbose) {
        console.log(msg);
      }
      if (haltWhenChanged) debugger;
      return parent[newPropName] = v;
    });
    parent.__defineGetter__(propName, function () {
      if (options.onGet) options.onGet(parent[newPropName]);
      return parent[newPropName];
    });
    var msg = 'Watcher for ' + parent + '.' + propName + ' installed';
    console.log(msg);
  },

  debugFunctionWrapper (options) {
    // ignore-in-doc
    // options = {target, [haltWhenChanged, showStack, verbose, uninstall]}
    const target = options.target;
    const parent = this.get(target, -1);
    const funcName = this.parts().slice(-1)[0];
    const uninstall = options.uninstall;
    const haltWhenChanged = options.haltWhenChanged === undefined ? true : options.haltWhenChanged;
    const showStack = options.showStack;
    const func = parent && funcName && parent[funcName];
    const debuggerInstalled = func && func.isDebugFunctionWrapper;
    if (!target || !funcName || !func || !parent) return;
    if (uninstall) {
      if (!debuggerInstalled) return;
      parent[funcName] = parent[funcName].debugTargetFunction;
      var msg = 'Uninstalled debugFunctionWrapper for ' + parent + '.' + funcName;
      console.log(msg);
      return;
    }
    if (debuggerInstalled) {
      var msg = 'debugFunctionWrapper for ' + parent + '.' + funcName + ' already installed';
      console.log(msg);
      return;
    }
    const debugFunc = parent[funcName] = func.wrap(function (proceed) {
      const args = Array.from(arguments);
      if (haltWhenChanged) debugger;
      return args.shift().apply(parent, args);
    });
    debugFunc.isDebugFunctionWrapper = true;
    debugFunc.debugTargetFunction = func;
    var msg = 'debugFunctionWrapper for ' + parent + '.' + funcName + ' installed';
    console.log(msg);
  }

});
