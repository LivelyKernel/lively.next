
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  (function() {
    this.lively = this.lively || {};
(function (exports) {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get$1 = function get$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

















var set$1 = function set$1(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set$1(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();













var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

// A `Closure` is a representation of a JavaScript function that controls what
// values are bound to out-of-scope variables. By default JavaScript has no
// reflection capabilities over closed values in functions. When needing to
// serialize execution or when behavior should become part of the state of a
// system it is often necessary to have first-class control over this language
// aspect.
//
// Typically closures aren't created directly but with the help of [`asScriptOf`](#)
//
// Example:
// function func(a) { return a + b; }
// var closureFunc = Closure.fromFunction(func, {b: 3}).recreateFunc();
// closureFunc(4) // => 7
// var closure = closureFunc.livelyClosure // => {
// //   varMapping: { b: 3 },
// //   originalFunc: function func(a) {/*...*/}
// // }
// closure.lookup("b") // => 3
// closure.getFuncSource() // => "function func(a) { return a + b; }"

var parameterRegex = /function[^\(]*\(([^\)]*)\)|\(?([^\)=]*)\)?\s*=>/;

var Closure = function () {
  createClass(Closure, null, [{
    key: "fromFunction",
    value: function fromFunction(func, varMapping) {
      /*show-in-doc*/
      return new this(func, varMapping || {});
    }
  }, {
    key: "fromSource",
    value: function fromSource(source, varMapping) {
      /*show-in-doc*/
      return new this(null, varMapping || {}, source);
    }
  }]);

  function Closure(func, varMapping, source, funcProperties) {
    classCallCheck(this, Closure);

    this.originalFunc = func;
    this.varMapping = varMapping || {};
    this.setFuncSource(source || func);
    this.setFuncProperties(func || funcProperties);
  }

  createClass(Closure, [{
    key: "setFuncSource",


    // accessing
    value: function setFuncSource(src) {
      /*show-in-doc*/
      src = typeof lively !== "undefined" && lively.sourceTransform && typeof lively.sourceTransform.stringifyFunctionWithoutToplevelRecorder === "function" ? lively.sourceTransform.stringifyFunctionWithoutToplevelRecorder(src) : String(src);
      return this.source = src;
    }
  }, {
    key: "getFuncSource",
    value: function getFuncSource() {
      /*show-in-doc*/
      return this.source || this.setFuncSource(this.originalFunc);
    }
  }, {
    key: "hasFuncSource",
    value: function hasFuncSource() {
      /*show-in-doc*/
      return this.source && true;
    }
  }, {
    key: "getFunc",
    value: function getFunc() {
      /*show-in-doc*/
      return this.originalFunc || this.recreateFunc();
    }
  }, {
    key: "getFuncProperties",
    value: function getFuncProperties() {
      // ignore-in-doc
      // a function may have state attached
      return this.funcProperties || (this.funcProperties = {});
    }
  }, {
    key: "setFuncProperties",
    value: function setFuncProperties(obj) {
      // ignore-in-doc
      var props = this.getFuncProperties();
      for (var name in obj) {
        // The AST implementation assumes that Function objects are some
        // kind of value object. When their identity changes cached state
        // should not be carried over to new function instances. This is a
        // pretty intransparent way to invalidate attributes that are used
        // for caches.
        // @cschuster, can you please fix this by making invalidation more
        // explicit?
        if (obj.hasOwnProperty(name)) props[name] = obj[name];
      }
    }
  }, {
    key: "lookup",
    value: function lookup(name) {
      /*show-in-doc*/
      return this.varMapping[name];
    }
  }, {
    key: "parameterNames",
    value: function parameterNames(methodString) {
      // ignore-in-doc

      if (typeof lively !== "undefined" && lively.ast) {
        return (lively.ast.parseFunction(methodString).params || []).map(function (ea) {
          if (ea.type === "Identifier") return ea.name;
          if (ea.left && ea.left.type === "Identifier") return ea.left.name;
          return null;
        }).filter(Boolean);
      }

      var paramsMatch = parameterRegex.exec(methodString);
      if (!paramsMatch) return [];
      var paramsString = paramsMatch[1] || paramsMatch[2] || "";
      return paramsString.split(",").map(function (ea) {
        return ea.trim();
      });
    }
  }, {
    key: "firstParameter",
    value: function firstParameter(src) {
      // ignore-in-doc
      return this.parameterNames(src)[0] || null;
    }

    // -=-=-=-=-=-=-=-=-=-
    // function creation
    // -=-=-=-=-=-=-=-=-=-

  }, {
    key: "recreateFunc",
    value: function recreateFunc() {
      // Creates a real function object
      return this.recreateFuncFromSource(this.getFuncSource(), this.originalFunc);
    }
  }, {
    key: "recreateFuncFromSource",
    value: function recreateFuncFromSource(funcSource, optFunc) {
      // ignore-in-doc
      // what about objects that are copied by value, e.g. numbers?
      // when those are modified after the originalFunc we captured
      // varMapping then we will have divergent state
      var closureVars = [],
          thisFound = false,
          specificSuperHandling = this.firstParameter(funcSource) === '$super';
      for (var name in this.varMapping) {
        if (!this.varMapping.hasOwnProperty(name)) continue;
        if (name == 'this') {
          thisFound = true;continue;
        }
        // closureVars.push(`var ${name} = this.varMapping.${name};\n`);
        closureVars.push("var " + name + " = this.varMapping." + name + ";\n");
      }

      var src = "";
      if (closureVars.length > 0) src += closureVars.join("\n");
      if (specificSuperHandling) src += '(function superWrapperForClosure() { return ';
      src += "(" + funcSource + ")";
      if (specificSuperHandling) src += '.apply(this, [$super.bind(this)]' + '.concat(Array.from(arguments))) })';
      try {
        var func = evalJS.call(this, src) || this.couldNotCreateFunc(src);
        this.addFuncProperties(func);
        this.originalFunc = func;
        return func;
      } catch (e) {
        // var msg = `Cannot create function ${e} src: ${src}`;
        var msg = "Cannot create function " + e + " src: " + src;
        console.error(msg);
        throw new Error(msg);
      }
    }
  }, {
    key: "addFuncProperties",
    value: function addFuncProperties(func) {
      // ignore-in-doc
      var props = this.getFuncProperties();
      for (var name in props) {
        if (props.hasOwnProperty(name)) func[name] = props[name];
      }this.addClosureInformation(func);
    }
  }, {
    key: "couldNotCreateFunc",
    value: function couldNotCreateFunc(src) {
      // ignore-in-doc
      var msg = 'Could not recreate closure from source: \n' + src;
      console.error(msg);
      return function () {
        throw new Error(msg);
      };
    }

    // -=-=-=-=-=-
    // conversion
    // -=-=-=-=-=-

  }, {
    key: "asFunction",
    value: function asFunction() {
      /*ignore-in-doc*/
      return this.recreateFunc();
    }

    // -=-=-=-=-=-=-=-=-=-=-=-
    // function modification
    // -=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "addClosureInformation",
    value: function addClosureInformation(f) {
      /*ignore-in-doc-in-doc*/
      f.hasLivelyClosure = true;
      f.livelyClosure = this;
      return f;
    }
  }, {
    key: "isLivelyClosure",
    get: function get() {
      return true;
    }

    // serialization

  }, {
    key: "doNotSerialize",
    get: function get() {
      return ['originalFunc'];
    }
  }]);
  return Closure;
}();

/*global clearTimeout, setTimeout*/

/*
 * Abstractions around first class functions like augmenting and inspecting
 * functions as well as to control function calls like dealing with asynchronous
 * control flows.
 */

// -=-=-=-=-=-=-=-=-
// static functions
// -=-=-=-=-=-=-=-=-

function Empty() {
  /*`function() {}`*/return function () {};
}
function K() {
  /*`function(arg) { return arg; }`*/return function (arg) {
    return arg;
  };
}
function Null() {
  /*`function() { return null; }`*/return function () {
    return null;
  };
}
function False() {
  /*`function() { return false; }`*/return function () {
    return false;
  };
}
function True() {
  /*`function() { return true; }`*/return function () {
    return true;
  };
}
function notYetImplemented() {
  return function () {
    throw new Error('Not yet implemented');
  };
}

// -=-=-=-=-=-
// accessing
// -=-=-=-=-=-
function all(object) {
  // Returns all property names of `object` that reference a function.
  // Example:
  // var obj = {foo: 23, bar: function() { return 42; }};
  // all(obj) // => ["bar"]
  var a = [];
  for (var name in object) {
    if (!object.__lookupGetter__(name) && typeof object[name] === 'function') a.push(name);
  }
  return a;
}

function own(object) {
  // Returns all local (non-prototype) property names of `object` that
  // reference a function.
  // Example:
  // var obj1 = {foo: 23, bar: function() { return 42; }};
  // var obj2 = {baz: function() { return 43; }};
  // obj2.__proto__ = obj1
  // own(obj2) // => ["baz"]
  // /*vs.*/ all(obj2) // => ["baz","bar"]
  var a = [];
  for (var name in object) {
    if (!object.__lookupGetter__(name) && object.hasOwnProperty(name) && typeof object[name] === 'function') a.push(name);
  }
  return a;
}

// -=-=-=-=-=-
// inspection
// -=-=-=-=-=-

function argumentNames(f) {
  // Example:
  // argumentNames(function(arg1, arg2) {}) // => ["arg1","arg2"]
  // argumentNames(function(/*var args*/) {}) // => []
  if (f.superclass) return []; // it's a class...
  var src = f.toString(),
      names = "",
      arrowMatch = src.match(/(?:\(([^\)]*)\)|([^\(\)-+!]+))\s*=>/);
  if (arrowMatch) names = arrowMatch[1] || arrowMatch[2] || "";else {
    var headerMatch = src.match(/^[\s\(]*function[^(]*\(([^)]*)\)/);
    if (headerMatch && headerMatch[1]) names = headerMatch[1];
  }
  return names.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '').replace(/\s+/g, '').split(',').map(function (ea) {
    return ea.trim();
  }).filter(function (name) {
    return !!name;
  });
}

function qualifiedMethodName(f) {
  // ignore-in-doc
  var objString = "";
  if (f.declaredClass) {
    objString += f.declaredClass + '>>';
  } else if (f.declaredObject) {
    objString += f.declaredObject + '.';
  }
  return objString + (f.methodName || f.displayName || f.name || "anonymous");
}

function extractBody(func) {

  // superflous indent. Useful when you have to stringify code but not want
  // to construct strings by hand.
  // Example:
  // extractBody(function(arg) {
  //   var x = 34;
  //   alert(2 + arg);
  // }) => "var x = 34;\nalert(2 + arg);"
  var codeString = String(func).replace(/^function[^\{]+\{\s*/, '').replace(/\}$/, '').trim(),
      lines = codeString.split(/\n|\r/),
      indent = undefined;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^(\s+)[^\s]/);
    if (m && (indent === undefined || m[1].length < indent.length)) indent = m[1];
  }
  return indent ? codeString.replace(new RegExp("^" + indent, 'gm'), '') : codeString;
}

// -=-=-=-
// timing
// -=-=-=-

function timeToRun(func) {
  // returns synchronous runtime of calling `func` in ms
  // Example:
  // timeToRun(function() { new WebResource("http://google.de").beSync().get() });
  // // => 278 (or something else...)
  var startTime = Date.now();
  func();
  return Date.now() - startTime;
}

function timeToRunN$1(func, n) {
  // Like `timeToRun` but calls function `n` times instead of once. Returns
  // the average runtime of a call in ms.
  var startTime = Date.now();
  for (var i = 0; i < n; i++) {
    func();
  }return (Date.now() - startTime) / n;
}

function delay(func, timeout /*, arg1...argN*/) {
  // Delays calling `func` for `timeout` seconds(!).
  // Example:
  // (function() { alert("Run in the future!"); }).delay(1);
  var args = Array.prototype.slice.call(arguments),
      __method = args.shift(),
      timeout = args.shift() * 1000;
  return setTimeout(function delayed() {
    return __method.apply(__method, args);
  }, timeout);
}

// these last two methods are Underscore.js 1.3.3 and are slightly adapted
// Underscore.js license:
// (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is distributed under the MIT license.

function throttle(func, wait) {
  // Exec func at most once every wait ms even when called more often
  // useful to calm down eagerly running updaters and such.
  // Example:
  // var i = 0;
  // var throttled = throttle(function() { alert(++i + '-' + Date.now()) }, 500);
  // Array.range(0,100).forEach(function(n) { throttled() });
  var context,
      args,
      timeout,
      throttling,
      more,
      result,
      whenDone = debounce(wait, function () {
    more = throttling = false;
  });
  return function () {
    context = this;args = arguments;
    var later = function later() {
      timeout = null;
      if (more) func.apply(context, args);
      whenDone();
    };
    if (!timeout) timeout = setTimeout(later, wait);
    if (throttling) {
      more = true;
    } else {
      result = func.apply(context, args);
    }
    whenDone();
    throttling = true;
    return result;
  };
}

function debounce(wait, func, immediate) {
  // Call `func` after `wait` milliseconds elapsed since the last invocation.
  // Unlike `throttle` an invocation will restart the wait period. This is
  // useful if you have a stream of events that you want to wait for to finish
  // and run a subsequent function afterwards. When you pass arguments to the
  // debounced functions then the arguments from the last call will be use for
  // the invocation.
  //
  // With `immediate` set to true, immediately call `func` but when called again during `wait` before
  // wait ms are done nothing happens. E.g. to not exec a user invoked
  // action twice accidentally.
  // Example:
  // var start = Date.now();
  // var f = debounce(200, function(arg1) {
  //   alert("running after " + (Date.now()-start) + "ms with arg " + arg1);
  // });
  // f("call1");
  // delay(f.curry("call2"), 0.1);
  // delay(f.curry("call3"), 0.15);
  // // => Will eventually output: "running after 352ms with arg call3"
  var timeout;
  return function () {
    var context = this,
        args = arguments;
    var later = function later() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    if (immediate && !timeout) func.apply(context, args);
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

var _throttledByName = {};
function throttleNamed(name, wait, func) {
  // Like `throttle` but remembers the throttled function once created and
  // repeated calls to `throttleNamed` with the identical name will use the same
  // throttled function. This allows to throttle functions in a central place
  // that might be called various times in different contexts without having to
  // manually store the throttled function.
  var store = _throttledByName;
  if (store[name]) return store[name];
  function throttleNamedWrapper() {
    // ignore-in-doc, cleaning up
    debounceNamed(name, wait, function () {
      delete store[name];
    })();
    func.apply(this, arguments);
  }
  return store[name] = throttle(throttleNamedWrapper, wait);
}

var _debouncedByName = {};
function debounceNamed(name, wait, func, immediate) {
  // Like `debounce` but remembers the debounced function once created and
  // repeated calls to `debounceNamed` with the identical name will use the same
  // debounced function. This allows to debounce functions in a central place
  // that might be called various times in different contexts without having to
  // manually store the debounced function.
  var store = _debouncedByName;
  if (store[name]) return store[name];
  function debounceNamedWrapper() {
    // ignore-in-doc, cleaning up
    delete store[name];
    func.apply(this, arguments);
  }
  return store[name] = debounce(wait, debounceNamedWrapper, immediate);
}

var _queues = {};
function createQueue(id, workerFunc) {
  // A simple queue with an attached asynchronous `workerFunc` to process
  // queued tasks. Calling `createQueue` will return an object with the
  // following interface:
  // ```js
  // {
  //   push: function(task) {/**/},
  //   pushAll: function(tasks) {/**/},
  //   handleError: function(err) {}, // Overwrite to handle errors
  //   dran: function() {}, // Overwrite to react when the queue empties
  // }
  // Example:
  // var sum = 0;
  // var q = createQueue("example-queue", function(arg, thenDo) { sum += arg; thenDo(); });
  // q.pushAll([1,2,3]);
  // queues will be remembered by their name
  // createQueue("example-queue").push(4);
  // sum // => 6

  var store = _queues;

  var queue = store[id] || (store[id] = {
    _workerActive: false,
    worker: workerFunc, tasks: [],
    drain: null, // can be overwritten by a function
    push: function push(task) {
      queue.tasks.push(task);
      queue.activateWorker();
    },
    pushAll: function pushAll(tasks) {
      tasks.forEach(function (ea) {
        queue.tasks.push(ea);
      });
      queue.activateWorker();
    },
    pushNoActivate: function pushNoActivate(task) {
      queue.tasks.push(task);
    },
    handleError: function handleError(err) {
      // can be overwritten
      err && console.error('Error in queue: ' + err);
    },
    activateWorker: function activateWorker() {
      function callback(err) {
        queue.handleError(err);queue.activateWorker();
      }
      var tasks = queue.tasks,
          active = queue._workerActive;
      if (tasks.length === 0) {
        if (active) {
          queue._workerActive = false;
          if (typeof queue.drain === 'function') queue.drain();
        }
        delete store[id];
      } else {
        if (!active) queue._workerActive = true;
        try {
          queue.worker(tasks.shift(), callback);
        } catch (err) {
          callback(err);
        }
      }
    }
  });

  return queue;
}

var _queueUntilCallbacks = {};
function workerWithCallbackQueue(id, workerFunc, optTimeout) {
  // This functions helps when you have a long running computation that
  // multiple call sites (independent from each other) depend on. This
  // function does the housekeeping to start the long running computation
  // just once and returns an object that allows to schedule callbacks
  // once the workerFunc is done.
  // Example:
  // var worker = workerWithCallbackQueue("example",
  //   function slowFunction(thenDo) {
  //     var theAnswer = 42;
  //     setTimeout(function() { thenDo(null, theAnswer); });
  //   });
  // // all "call sites" depend on `slowFunction` but don't have to know about
  // // each other
  // worker.whenDone(function callsite1(err, theAnswer) { alert("callback1: " + theAnswer); })
  // worker.whenDone(function callsite2(err, theAnswer) { alert("callback2: " + theAnswer); })
  // workerWithCallbackQueue("example").whenDone(function callsite3(err, theAnswer) { alert("callback3: " + theAnswer); })
  // // => Will eventually show: callback1: 42, callback2: 42 and callback3: 42


  // ignore-in-doc
  // This is how it works:
  // If `id` does not exist, workerFunc is called, otherwise ignored.
  // workerFunc is expected to call thenDoFunc with arguments: error, arg1, ..., argN
  // if called subsequently before workerFunc is done, the other thenDoFunc
  // will "pile up" and called with the same arguments as the first
  // thenDoFunc once workerFunc is done
  var store = _queueUntilCallbacks,
      queueCallbacks = store[id],
      isRunning = !!queueCallbacks;

  if (isRunning) return queueCallbacks;

  var callbacksRun = false,
      canceled = false;

  function cleanup() {
    if (timeoutProc) clearTimeout(timeoutProc);
    callbacksRun = true;
    delete store[id];
  }

  function runCallbacks(args) {
    if (callbacksRun) return;
    cleanup();
    queueCallbacks.callbacks.forEach(function (cb) {
      try {
        cb.apply(null, args);
      } catch (e) {
        console.error("Error when invoking callbacks in queueUntil [" + id + "]:\n" + String(e.stack || e));
      }
    });
  }

  // timeout
  if (optTimeout) {
    var timeoutProc = setTimeout(function () {
      if (callbacksRun) return;
      runCallbacks([new Error("timeout")]);
    }, optTimeout);
  }

  // init the store
  queueCallbacks = store[id] = {
    callbacks: [],
    cancel: function cancel() {
      canceled = true;
      cleanup();
    },
    whenDone: function whenDone(cb) {
      queueCallbacks.callbacks.push(cb);
      return queueCallbacks;
    }
  };

  // call worker, but delay so we can immediately return
  setTimeout(function () {
    if (canceled) return;
    try {
      workerFunc(function () /*args*/{
        runCallbacks(arguments);
      });
    } catch (e) {
      runCallbacks([e]);
    }
  }, 0);

  return queueCallbacks;
}

function _composeAsyncDefaultEndCallback(err, arg1 /*err + args*/) {
  if (err) console.error("lively.lang.composeAsync error", err);
}

function composeAsync() /*functions*/{
  // Composes functions that are asynchronous and expecting continuations to
  // be called in node.js callback style (error is first argument, real
  // arguments follow).
  // A call like `composeAsync(f,g,h)(arg1, arg2)` has a flow of control like:
  //  `f(arg1, arg2, thenDo1)` -> `thenDo1(err, fResult)`
  // -> `g(fResult, thenDo2)` -> `thenDo2(err, gResult)` ->
  // -> `h(fResult, thenDo3)` -> `thenDo2(err, hResult)`
  // Example:
  // composeAsync(
  //   function(a,b, thenDo) { thenDo(null, a+b); },
  //   function(x, thenDo) { thenDo(x*4); }
  //  )(3,2, function(err, result) { alert(result); });

  var toArray$$1 = Array.prototype.slice,
      functions = toArray$$1.call(arguments),
      defaultEndCb = _composeAsyncDefaultEndCallback,
      endCallback = defaultEndCb,
      endSuccess,
      endFailure,
      endPromise = new Promise(function (resolve, reject) {
    endSuccess = resolve;endFailure = reject;
  });

  return functions.reverse().reduce(function (prevFunc, funcOrPromise, i) {

    var nextActivated = false;
    return function () {
      var args = toArray$$1.call(arguments);

      // ignore-in-doc
      // the last arg needs to be function, discard all non-args
      // following it. This allows to have an optional callback func that can
      // even be `undefined`, e.g. when calling this func from a callsite
      // using var args;
      if (endCallback === defaultEndCb && i === functions.length - 1 /*first function*/) {
          while (args.length && typeof args[args.length - 1] !== 'function') {
            args.pop();
          }if (typeof args[args.length - 1] === 'function') endCallback = args.pop();
        }

      function next() /*err and args*/{
        nextActivated = true;
        var args = toArray$$1.call(arguments),
            err = args.shift();
        if (err) {
          endCallback(err);endFailure(err);
        } else prevFunc.apply(null, args);
      }

      if (typeof funcOrPromise === "function") {
        try {
          var result = funcOrPromise.apply(this, args.concat([next]));
          if (result && typeof result.then === "function" && typeof result.catch === "function") {
            result.then(function (value) {
              return next(null, value);
            }).catch(function (err) {
              return next(err);
            });
          }
        } catch (e) {
          console.error('composeAsync: ', e.stack || e);
          if (!nextActivated) {
            endCallback(e);endFailure(e);
          }
        }
      } else if (funcOrPromise && typeof funcOrPromise.then === "function" && typeof funcOrPromise.catch === "function") {
        funcOrPromise.then(function (value) {
          next(null, value);
        }).catch(function (err) {
          next(err);
        });
      } else {
        var err = new Error("Invalid argument to composeAsync: " + funcOrPromise);
        endCallback(err);
        endFailure(err);
      }

      return endPromise;
    };
  }, function () {
    var args = toArray$$1.call(arguments);
    endCallback.apply(null, [null].concat(args));
    endSuccess(args[0]);
  });
}

function compose() /*functions*/{
  // Composes synchronousefunctions:
  // `compose(f,g,h)(arg1, arg2)` = `h(g(f(arg1, arg2)))`
  // Example:
  // compose(
  //   function(a,b) { return a+b; },
  //   function(x) {return x*4}
  // )(3,2) // => 20

  var functions = Array.prototype.slice.call(arguments);
  return functions.reverse().reduce(function (prevFunc, func) {
    return function () {
      return prevFunc(func.apply(this, arguments));
    };
  }, function (x) {
    return x;
  });
}

function flip(f) {
  // Swaps the first two args
  // Example:
  // flip(function(a, b, c) {
  //   return a + b + c; })(' World', 'Hello', '!') // => "Hello World!"
  return function flipped() /*args*/{
    var args = Array.prototype.slice.call(arguments),
        flippedArgs = [args[1], args[0]].concat(args.slice(2));
    return f.apply(null, flippedArgs);
  };
}

function withNull(func) {
  // returns a modified version of func that will have `null` always curried
  // as first arg. Usful e.g. to make a nodejs-style callback work with a
  // then-able:
  // Example:
  // promise.then(withNull(cb)).catch(cb);
  func = func || function () {};
  return function () /*args*/{
    var args = lively.lang.arr.from(arguments);
    func.apply(null, [null].concat(args));
  };
}

function waitFor(timeoutMs, waitTesterFunc, thenDo) {
  // Wait for waitTesterFunc to return true, then run thenDo, passing
  // failure/timout err as first parameter. A timout occurs after
  // timeoutMs. During the wait period waitTesterFunc might be called
  // multiple times.
  var start = Date.now();
  var timeStep = 50;
  if (!thenDo) {
    thenDo = waitTesterFunc;
    waitTesterFunc = timeoutMs;
    timeoutMs = undefined;
  }
  (function test() {
    if (waitTesterFunc()) return thenDo();
    if (timeoutMs) {
      var duration = Date.now() - start,
          timeLeft = timeoutMs - duration;
      if (timeLeft <= 0) return thenDo(new Error('timeout'));
      if (timeLeft < timeStep) timeStep = timeLeft;
    }
    setTimeout(test, timeStep);
  })();
}

function waitForAll(options, funcs, thenDo) {
  // Wait for multiple asynchronous functions. Once all have called the
  // continuation, call `thenDo`.
  // options can be: `{timeout: NUMBER}` (how long to wait in milliseconds).

  if (!thenDo) {
    thenDo = funcs;funcs = options;options = null;
  }
  options = options || {};

  var results = funcs.map(function () {
    return null;
  });
  if (!funcs.length) {
    thenDo(null, results);return;
  }

  var leftFuncs = Array.prototype.slice.call(funcs);

  funcs.forEach(function (f, i) {
    try {
      f(function () /*err and args*/{
        var args = Array.prototype.slice.call(arguments);
        var err = args.shift();
        markAsDone(f, i, err, args);
      });
    } catch (e) {
      markAsDone(f, i, e, null);
    }
  });

  if (options.timeout) {
    setTimeout(function () {
      if (!leftFuncs.length) return;
      var missing = results.map(function (ea, i) {
        return ea === null && i;
      }).filter(function (ea) {
        return typeof ea === 'number';
      }).join(', ');
      var err = new Error("waitForAll timed out, functions at " + missing + " not done");
      markAsDone(null, null, err, null);
    }, options.timeout);
  }

  function markAsDone(f, i, err, result) {
    if (!leftFuncs.length) return;

    var waitForAllErr = null;
    var fidx = leftFuncs.indexOf(f);
    fidx > -1 && leftFuncs.splice(fidx, 1);
    if (err) {
      leftFuncs.length = 0;
      waitForAllErr = new Error("in waitForAll at" + (typeof i === 'number' ? " " + i : "") + ": \n" + (err.stack || String(err)));
    } else if (result) results[i] = result;
    if (!leftFuncs.length) setTimeout(function () {
      thenDo(waitForAllErr, results);
    }, 0);
  }
}

// -=-=-=-=-
// wrapping
// -=-=-=-=-

function curry(func, arg1, arg2, argN /*func and curry args*/) {
  // Return a version of `func` with args applied.
  // Example:
  // var add1 = (function(a, b) { return a + b; }).curry(1);
  // add1(3) // => 4

  if (arguments.length <= 1) return arguments[0];
  var args = Array.prototype.slice.call(arguments),
      func = args.shift();
  function wrappedFunc() {
    return func.apply(this, args.concat(Array.prototype.slice.call(arguments)));
  }
  wrappedFunc.isWrapper = true;
  wrappedFunc.originalFunction = func;
  return wrappedFunc;
}

function wrap(func, wrapper) {
  // A `wrapper` is another function that is being called with the arguments
  // of `func` and a proceed function that, when called, runs the originally
  // wrapped function.
  // Example:
  // function original(a, b) { return a+b }
  // var wrapped = wrap(original, function logWrapper(proceed, a, b) {
  //   alert("original called with " + a + "and " + b);
  //   return proceed(a, b);
  // })
  // wrapped(3,4) // => 7 and a message will pop up
  var __method = func;
  var wrappedFunc = function wrapped() {
    var args = Array.prototype.slice.call(arguments);
    var wrapperArgs = wrapper.isWrapper ? args : [__method.bind(this)].concat(args);
    return wrapper.apply(this, wrapperArgs);
  };
  wrappedFunc.isWrapper = true;
  wrappedFunc.originalFunction = __method;
  return wrappedFunc;
}

function getOriginal(func) {
  // Get the original function that was augmented by `wrap`. `getOriginal`
  // will traversed as many wrappers as necessary.
  while (func.originalFunction) {
    func = func.originalFunction;
  }return func;
}

function wrapperChain(method) {
  // Function wrappers used for wrapping, cop, and other method
  // manipulations attach a property "originalFunction" to the wrapper. By
  // convention this property references the wrapped method like wrapper
  // -> cop wrapper -> real method.
  // tThis method gives access to the linked list starting with the outmost
  // wrapper.
  var result = [];
  do {
    result.push(method);
    method = method.originalFunction;
  } while (method);
  return result;
}

function replaceMethodForOneCall(obj, methodName, replacement) {
  // Change an objects method for a single invocation.
  // Example:
  // var obj = {foo: function() { return "foo"}};
  // lively.lang.replaceMethodForOneCall(obj, "foo", function() { return "bar"; });
  // obj.foo(); // => "bar"
  // obj.foo(); // => "foo"
  replacement.originalFunction = obj[methodName];
  var reinstall = obj.hasOwnProperty(methodName);
  obj[methodName] = function () {
    if (reinstall) obj[methodName] = replacement.originalFunction;else delete obj[methodName];
    return replacement.apply(this, arguments);
  };
  return obj;
}

function once(func) {
  // Ensure that `func` is only executed once. Multiple calls will not call
  // `func` again but will return the original result.
  if (!func) return undefined;
  if (typeof func !== 'function') throw new Error("once() expecting a function");
  var invoked = false,
      result;
  return function () {
    if (invoked) return result;
    invoked = true;
    return result = func.apply(this, arguments);
  };
}

function either() /*funcs*/{
  // Accepts multiple functions and returns an array of wrapped
  // functions. Those wrapped functions ensure that only one of the original
  // function is run (the first on to be invoked).
  //
  // This is useful if you have multiple asynchronous choices of how the
  // control flow might continue but want to ensure that a continuation
  // is  only triggered once, like in a timeout situation:
  //
  // ```js
  // function outerFunction(callback) {
  //   function timeoutAction() { callback(new Error('timeout!')); }
  //   function otherAction() { callback(null, "All OK"); }
  //   setTimeout(timeoutAction, 200);
  //   doSomethingAsync(otherAction);
  // }
  // ```
  //
  // To ensure that `callback` only runs once you would normally have to write boilerplate like this:
  //
  // ```js
  // var ran = false;
  // function timeoutAction() { if (ran) return; ran = true; callback(new Error('timeout!')); }
  // function otherAction() { if (ran) return; ran = true; callback(null, "All OK"); }
  // ```
  //
  // Since this can get tedious an error prone, especially if more than two choices are involved, `either` can be used like this:
  // Example:
  // function outerFunction(callback) {
  //   var actions = either(
  //     function() { callback(new Error('timeout!')); },
  //     function() { callback(null, "All OK"); });
  //   setTimeout(actions[0], 200);
  //   doSomethingAsync(actions[1]);
  // }
  var funcs = Array.prototype.slice.call(arguments),
      wasCalled = false;
  return funcs.map(function (func) {
    return function () {
      if (wasCalled) return undefined;
      wasCalled = true;
      return func.apply(this, arguments);
    };
  });
}

var _eitherNameRegistry = {};
function eitherNamed(name, func) {
  // Works like [`either`](#) but usage does not require to wrap all
  // functions at once:
  // Example:
  // var log = "", name = "either-example-" + Date.now();
  // function a() { log += "aRun"; };
  // function b() { log += "bRun"; };
  // function c() { log += "cRun"; };
  // setTimeout(eitherNamed(name, a), 100);
  // setTimeout(eitherNamed(name, b), 40);
  // setTimeout(eitherNamed(name, c), 80);
  // setTimeout(function() { alert(log); /* => "bRun" */ }, 150);
  var funcs = Array.prototype.slice.call(arguments);
  var registry = _eitherNameRegistry;
  var name = funcs.shift();
  var eitherCall = registry[name] || (registry[name] = { wasCalled: false, callsLeft: 0 });
  eitherCall.callsLeft++;
  return function () {
    eitherCall.callsLeft--;
    // cleanup the storage if all registered functions fired
    if (eitherCall.callsLeft <= 0) delete registry[name];
    if (eitherCall.wasCalled) return undefined;
    eitherCall.wasCalled = true;
    return func.apply(this, arguments);
  };
}

// -=-=-=-=-
// creation
// -=-=-=-=-
function evalJS(src) {
  return eval(src);
}

function fromString(funcOrString) {
  // Example:
  // fromString("function() { return 3; }")() // => 3
  return evalJS('(' + funcOrString.toString() + ');');
}

function asScript(func, optVarMapping) {
  // Lifts `func` to become a `Closure`, that is that free variables referenced
  // in `func` will be bound to the values of an object that can be passed in as
  // the second parameter. Keys of this object are mapped to the free variables.
  //
  // Please see [`Closure`](#) for a more detailed explanation and examples.
  return Closure.fromFunction(func, optVarMapping).recreateFunc();
}

function asScriptOf(f, obj, optName, optMapping) {
  // Like `asScript` but makes `f` a method of `obj` as `optName` or the name
  // of the function.
  var name = optName || f.name;
  if (!name) {
    throw Error("Function that wants to be a script needs a name: " + this);
  }
  var proto = Object.getPrototypeOf(obj),
      mapping = { "this": obj };
  if (optMapping) mapping = merge([mapping, optMapping]);
  if (proto && proto[name]) {
    var superFunc = function superFunc() {
      try {
        // FIXME super is supposed to be static
        return Object.getPrototypeOf(obj)[name].apply(obj, arguments);
      } catch (e) {
        if ((typeof $world === "undefined" ? "undefined" : _typeof($world)) !== undefined) $world.logError(e, 'Error in $super call');else console.error('Error in $super call: ' + e + '\n' + e.stack);
        return null;
      }
    };
    mapping["$super"] = Closure.fromFunction(superFunc, { obj: obj, name: name }).recreateFunc();
  }
  return addToObject(asScript(f, mapping), obj, name);
}

// -=-=-=-=-=-=-=-=-
// closure related
// -=-=-=-=-=-=-=-=-
function addToObject(f, obj, name) {
  // ignore-in-doc
  f.displayName = name;

  var methodConnections = obj.attributeConnections ? obj.attributeConnections.filter(function (con) {
    return con.getSourceAttrName() === 'update';
  }) : [];

  if (methodConnections) methodConnections.forEach(function (ea) {
    ea.disconnect();
  });

  obj[name] = f;

  if (typeof obj === "undefined" ? "undefined" : _typeof(obj)) f.declaredObject = safeToString(obj);

  // suppport for tracing
  if (typeof lively !== "undefined" && obj && lively.Tracing && lively.Tracing.stackTracingEnabled) {
    lively.Tracing.instrumentMethod(obj, name, {
      declaredObject: safeToString(obj)
    });
  }

  if (methodConnections) methodConnections.forEach(function (ea) {
    ea.connect();
  });

  return f;
}

function binds(f, varMapping) {
  // ignore-in-doc
  // convenience function
  return Closure.fromFunction(f, varMapping || {}).recreateFunc();
}

function setLocalVarValue(f, name, value) {
  // ignore-in-doc
  if (f.hasLivelyClosure) f.livelyClosure.funcProperties[name] = value;
}

function getVarMapping(f) {
  // ignore-in-doc
  if (f.hasLivelyClosure) return f.livelyClosure.varMapping;
  if (f.isWrapper) return f.originalFunction.varMapping;
  if (f.varMapping) return f.varMapping;
  return {};
}

function setProperty(func, name, value) {
  func[name] = value;
  if (func.hasLivelyClosure) func.livelyClosure.funcProperties[name] = value;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-
// class-related functions
// -=-=-=-=-=-=-=-=-=-=-=-=-
function functionNames(klass) {
  // Treats passed function as class (constructor).
  // Example:
  // var Klass1 = function() {}
  // Klass1.prototype.foo = function(a, b) { return a + b; };
  // Klass1.prototype.bar = function(a) { return this.foo(a, 3); };
  // Klass1.prototype.baz = 23;
  // functionNames(Klass1); // => ["bar","foo"]

  var result = [],
      lookupObj = klass.prototype;
  while (lookupObj) {
    result = Object.keys(lookupObj).reduce(function (result, name) {
      if (typeof lookupObj[name] === 'function' && result.indexOf(name) === -1) result.push(name);
      return result;
    }, result);
    lookupObj = Object.getPrototypeOf(lookupObj);
  }
  return result;
}

function localFunctionNames(func) {
  return Object.keys(func.prototype).filter(function (name) {
    return typeof func.prototype[name] === 'function';
  });
}

// -=-=-=-=-=-=-=-=-=-=-
// tracing and logging
// -=-=-=-=-=-=-=-=-=-=-

function logErrors(func, prefix) {
  var advice = function logErrorsAdvice(proceed /*,args*/) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    try {
      return proceed.apply(func, args);
    } catch (er) {
      if (typeof lively !== "undefined" && lively.morphic && lively.morphic.World && lively.morphic.World.current()) {
        lively.morphic.World.current().logError(er);
        throw er;
      }

      if (prefix) console.warn("ERROR: %s.%s(%s): err: %s %s", func, prefix, args, er, er.stack || "");else console.warn("ERROR: %s %s", er, er.stack || "");
      throw er;
    }
  };

  advice.methodName = "$logErrorsAdvice";
  var result = wrap(func, advice);
  result.originalFunction = func;
  result.methodName = "$logErrorsWrapper";
  return result;
}

function logCompletion(func, module) {
  var advice = function logCompletionAdvice(proceed) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    try {
      var result = proceed.apply(func, args);
    } catch (er) {
      console.warn('failed to load ' + module + ': ' + er);
      if (typeof lively !== 'undefined' && lively.lang.Execution) lively.lang.Execution.showStack();
      throw er;
    }
    console.log('completed ' + module);
    return result;
  };

  advice.methodName = "$logCompletionAdvice::" + module;

  var result = wrap(func, advice);
  result.methodName = "$logCompletionWrapper::" + module;
  result.originalFunction = func;
  return result;
}

function logCalls(func, isUrgent) {
  var original = func,
      advice = function logCallsAdvice(proceed) {
    var args = Array.prototype.slice.call(arguments);
    args.shift(), result = proceed.apply(func, args);
    if (isUrgent) {
      console.warn('%s(%s) -> %s', qualifiedMethodName(original), args, result);
    } else {
      console.log('%s(%s) -> %s', qualifiedMethodName(original), args, result);
    }
    return result;
  };

  advice.methodName = "$logCallsAdvice::" + qualifiedMethodName(func);

  var result = wrap(func, advice);
  result.originalFunction = func;
  result.methodName = "$logCallsWrapper::" + qualifiedMethodName(func);
  return result;
}

function traceCalls(func, stack) {
  var advice = function traceCallsAdvice(proceed) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    stack.push(args);
    var result = proceed.apply(func, args);
    stack.pop();
    return result;
  };
  return wrap(func, advice);
}

function webkitStack() {
  // this won't work in every browser
  try {
    throw new Error();
  } catch (e) {
    // remove "Error" and this function from stack, rewrite it nicely
    return String(e.stack).split(/\n/).slice(2).map(function (line) {
      return line.replace(/^\s*at\s*([^\s]+).*/, '$1');
    }).join('\n');
  }
}



var fun = Object.freeze({
	Empty: Empty,
	K: K,
	Null: Null,
	False: False,
	True: True,
	notYetImplemented: notYetImplemented,
	withNull: withNull,
	all: all,
	own: own,
	argumentNames: argumentNames,
	qualifiedMethodName: qualifiedMethodName,
	extractBody: extractBody,
	timeToRun: timeToRun,
	timeToRunN: timeToRunN$1,
	delay: delay,
	throttle: throttle,
	debounce: debounce,
	throttleNamed: throttleNamed,
	debounceNamed: debounceNamed,
	createQueue: createQueue,
	workerWithCallbackQueue: workerWithCallbackQueue,
	composeAsync: composeAsync,
	compose: compose,
	waitFor: waitFor,
	waitForAll: waitForAll,
	flip: flip,
	curry: curry,
	wrap: wrap,
	binds: binds,
	getOriginal: getOriginal,
	wrapperChain: wrapperChain,
	replaceMethodForOneCall: replaceMethodForOneCall,
	once: once,
	either: either,
	eitherNamed: eitherNamed,
	evalJS: evalJS,
	fromString: fromString,
	asScript: asScript,
	asScriptOf: asScriptOf,
	addToObject: addToObject,
	setLocalVarValue: setLocalVarValue,
	getVarMapping: getVarMapping,
	setProperty: setProperty,
	functionNames: functionNames,
	localFunctionNames: localFunctionNames,
	logErrors: logErrors,
	logCompletion: logCompletion,
	logCalls: logCalls,
	traceCalls: traceCalls,
	webkitStack: webkitStack
});

// show-in-doc
// A Grouping is created by arr.groupBy and maps keys to Arrays.

var Group = function () {
  function Group() {
    classCallCheck(this, Group);
  }

  createClass(Group, [{
    key: "toArray",
    value: function toArray() {
      // Example:
      // var group = arr.groupBy([1,2,3,4,5], function(n) { return n % 2; })
      // group.toArray(); // => [[2,4],[1,3,5]]
      return this.reduceGroups(function (all$$1, _, group) {
        return all$$1.concat([group]);
      }, []);
    }
  }, {
    key: "forEach",
    value: function forEach(iterator, context) {
      // Iteration for each item in each group, called like `iterator(groupKey, groupItem)`
      var groups = this;
      Object.keys(groups).forEach(function (groupName) {
        groups[groupName].forEach(iterator.bind(context, groupName));
      });
      return groups;
    }
  }, {
    key: "forEachGroup",
    value: function forEachGroup(iterator, context) {
      // Iteration for each group, called like `iterator(groupKey, group)`
      var groups = this;
      Object.keys(groups).forEach(function (groupName) {
        iterator.call(context, groupName, groups[groupName]);
      });
      return groups;
    }
  }, {
    key: "map",
    value: function map(iterator, context) {
      // Map for each item in each group, called like `iterator(groupKey, group)`
      var result = new Group();
      this.forEachGroup(function (groupName, group) {
        result[groupName] = group.map(iterator.bind(context, groupName));
      });
      return result;
    }
  }, {
    key: "mapGroups",
    value: function mapGroups(iterator, context) {
      // Map for each group, called like `iterator(groupKey, group)`
      var result = new Group();
      this.forEachGroup(function (groupName, group) {
        result[groupName] = iterator.call(context, groupName, group);
      });
      return result;
    }
  }, {
    key: "keys",
    value: function keys() {
      // show-in-docs
      return Object.keys(this);
    }
  }, {
    key: "reduceGroups",
    value: function reduceGroups(iterator, carryOver, context) {
      // Reduce/fold for each group, called like `iterator(carryOver, groupKey, group)`
      this.forEachGroup(function (groupName, group) {
        carryOver = iterator.call(context, carryOver, groupName, group);
      });
      return carryOver;
    }
  }, {
    key: "count",
    value: function count() {
      // counts the elements of each group
      return this.reduceGroups(function (groupCount, groupName, group) {
        groupCount[groupName] = group.length;
        return groupCount;
      }, {});
    }
  }], [{
    key: "fromArray",
    value: function fromArray(array, hashFunc, context) {
      // Example:
      // Group.fromArray([1,2,3,4,5,6], function(n) { return n % 2; })
      // // => {"0": [2,4,6], "1": [1,3,5]}
      var grouping = new Group();
      for (var i = 0, len = array.length; i < len; i++) {
        var hash = hashFunc.call(context, array[i], i);
        if (!grouping[hash]) grouping[hash] = [];
        grouping[hash].push(array[i]);
      }
      return grouping;
    }
  }, {
    key: "by",
    get: function get() {
      return groupBy;
    }
  }]);
  return Group;
}();

/*global System, global*/

/*
 * Methods to make working with arrays more convenient and collection-like
 * abstractions for groups, intervals, grids.
 */

var GLOBAL$1 = typeof System !== "undefined" ? System.global : typeof window !== 'undefined' ? window : global;

var features$1 = {
  from: !!Array.from,
  filter: !!Array.prototype.filter,
  find: !!Array.prototype.find,
  findIndex: !!Array.prototype.findIndex,
  includes: !!Array.prototype.includes

  // variety of functions for Arrays


  // -=-=-=-=-=-=-=-
  // array creations
  // -=-=-=-=-=-=-=-

};function range(begin, end, step) {
  // Examples:
  //   arr.range(0,5) // => [0,1,2,3,4,5]
  //   arr.range(0,10,2) // => [0,2,4,6,8,10]
  step = step || 0;
  var result = [];
  if (begin <= end) {
    if (step <= 0) step = -step || 1;
    for (var i = begin; i <= end; i += step) {
      result.push(i);
    }
  } else {
    if (step >= 0) step = -step || -1;
    for (var i = begin; i >= end; i += step) {
      result.push(i);
    }
  }
  return result;
}

var from = features$1.from ? Array.from : function (iterable) {
  // Makes JS arrays out of array like objects like `arguments` or DOM `childNodes`
  if (!iterable) return [];
  if (Array.isArray(iterable)) return iterable;
  if (iterable.toArray) return iterable.toArray();
  var length = iterable.length,
      results = new Array(length);
  while (length--) {
    results[length] = iterable[length];
  }return results;
};

function withN(n, obj) {
  // Example:
  //   arr.withN(3, "Hello") // => ["Hello","Hello","Hello"]
  var result = new Array(n);
  while (n > 0) {
    result[--n] = obj;
  }return result;
}

function genN(n, generator) {
  // Number -> Function -> Array
  // Takes a generator function that is called for each `n`.
  // Example:
  //   arr.genN(3, num.random) // => [46,77,95]
  var result = new Array(n);
  while (n > 0) {
    result[--n] = generator(n);
  }return result;
}

// -=-=-=-=-
// filtering
// -=-=-=-=-

function filter(array, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> [a]
  // Calls `iterator` for each element in `array` and returns a subset of it
  // including the elements for which `iterator` returned a truthy value.
  // Like `Array.prototype.filter`.
  return array.filter(iterator, context);
}

var detect = features$1.find ? function (arr, iterator, context) {
  return arr.find(iterator, context);
} : function (arr, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> a
  // returns the first occurrence of an element in `arr` for which iterator
  // returns a truthy value
  for (var value, i = 0, len = arr.length; i < len; i++) {
    value = arr[i];
    if (iterator.call(context, value, i)) return value;
  }
  return undefined;
};

var findIndex = features$1.findIndex ? function (arr, iterator, context) {
  return arr.findIndex(iterator, context);
} : function (arr, iterator, context) {
  var i = -1;
  return arr.find(function (ea, j) {
    i = j;return iterator.call(ea, context);
  }) ? i : -1;
};

function findAndGet(arr, iterator) {
  // find the first occurence for which `iterator` returns a truthy value and
  // return *this* value, i.e. unlike find the iterator result and not the
  // element of the list is returned
  var result;
  arr.find(function (ea, i) {
    return result = iterator(ea, i);
  });
  return result;
}

function filterByKey(arr, key) {
  // [a] -> String -> [a]
  // Example:
  //   var objects = [{x: 3}, {y: 4}, {x:5}]
  //   arr.filterByKey(objects, "x") // => [{x: 3},{x: 5}]
  return arr.filter(function (ea) {
    return !!ea[key];
  });
}

function grep(arr, filter, context) {
  // [a] -> String|RegExp -> [a]
  // `filter` can be a String or RegExp. Will stringify each element in
  // Example:
  // ["Hello", "World", "Lively", "User"].grep("l") // => ["Hello","World","Lively"]
  if (typeof filter === 'string') filter = new RegExp(filter, 'i');
  return arr.filter(filter.test.bind(filter));
}

function mask(array, mask) {
  // select every element in array for which array's element is truthy
  // Example: [1,2,3].mask([false, true, false]) => [2]
  return array.filter(function (_, i) {
    return !!mask[i];
  });
}

function reject(array, func, context) {
  // show-in-doc
  function iterator(val, i) {
    return !func.call(context, val, i);
  }
  return array.filter(iterator);
}

function rejectByKey(array, key) {
  // show-in-doc
  return array.filter(function (ea) {
    return !ea[key];
  });
}

function without(array, elem) {
  // non-mutating
  // Example:
  // arr.without([1,2,3,4,5,6], 3) // => [1,2,4,5,6]
  return array.filter(function (val) {
    return val !== elem;
  });
}

function withoutAll(array, otherArr) {
  // non-mutating
  // Example:
  // arr.withoutAll([1,2,3,4,5,6], [3,4]) // => [1,2,5,6]
  return array.filter(function (val) {
    return otherArr.indexOf(val) === -1;
  });
}

function uniq(array, sorted) {
  // non-mutating
  // Removes duplicates from array.
  // if sorted == true then assume array is sorted which allows uniq to be more
  // efficient
  // uniq([3,5,6,2,3,4,2,6,4])
  if (!array.length) return array;

  var result = [array[0]];
  if (sorted) {
    for (var i = 1; i < array.length; i++) {
      var val = array[i];
      if (val !== result[result.length]) result.push(val);
    }
  } else {
    for (var _i = 1; _i < array.length; _i++) {
      var _val = array[_i];
      if (result.indexOf(_val) === -1) result.push(_val);
    }
  }
  return result;
}

function uniqBy(array, comparator, context) {
  // like `arr.uniq` but with custom equality: `comparator(a,b)` returns
  // BOOL. True if a and be should be regarded equal, false otherwise.
  var result = array.slice();
  for (var i = result.length; i--;) {
    var item = array[i];
    for (var j = i + 1; j < result.length; j++) {
      if (comparator.call(context, item, result[j])) result.splice(j--, 1);
    }
  }
  return result;
}

function uniqByKey(array, key) {
  // like `arr.uniq` but with equality based on item[key]
  var seen = {},
      result = [];
  for (var i = 0; i < array.length; i++) {
    var item = array[i];
    if (!seen[item[key]]) {
      seen[item[key]] = true;
      result.push(item);
    }
  }
  return result;
}

function compact(array) {
  // removes falsy values
  // Example:
  // arr.compact([1,2,undefined,4,0]) // => [1,2,4]
  return array.filter(Boolean);
}

function mutableCompact(array) {
  // fix gaps that were created with 'delete'
  var i = 0,
      j = 0,
      len = array.length;
  while (i < len) {
    if (array.hasOwnProperty(i)) array[j++] = array[i];
    i++;
  }
  while (j++ < len) {
    array.pop();
  }return array;
}

// -=-=-=-=-
// iteration
// -=-=-=-=-

function forEach$1(array, iterator, context) {
  // [a] -> (a -> Undefined) -> c? -> Undefined
  // `iterator` is called on each element in `array` for side effects. Like
  // `Array.prototype.forEach`.
  return array.forEach(iterator, context);
}

function zip() /*arr, arr2, arr3*/{
  // Takes any number of lists as arguments. Combines them elment-wise.
  // Example:
  // arr.zip([1,2,3], ["a", "b", "c"], ["A", "B"])
  // // => [[1,"a","A"],[2,"b","B"],[3,"c",undefined]]
  var args = Array.from(arguments),
      array = args.shift(),
      iterator = typeof last(args) === 'function' ? args.pop() : function (x) {
    return x;
  },
      collections = [array].concat(args).map(function (ea) {
    return Array.from(ea);
  });
  return array.map(function (value, index) {
    return iterator(pluck(collections, index), index);
  });
}

function flatten(array, optDepth) {
  // Turns a nested collection into a flat one.
  // Example:
  // arr.flatten([1, [2, [3,4,5], [6]], 7,8])
  // // => [1,2,3,4,5,6,7,8]
  if (typeof optDepth === "number") {
    if (optDepth <= 0) return array;
    optDepth--;
  }
  return array.reduce(function (flattened, value) {
    return flattened.concat(Array.isArray(value) ? flatten(value, optDepth) : [value]);
  }, []);
}

function flatmap(array, it, ctx) {
  // the simple version
  // Array.prototype.concat.apply([], array.map(it, ctx));
  // causes stack overflows with really big arrays
  var results = [];
  for (var i = 0; i < array.length; i++) {
    results.push.apply(results, it.call(ctx, array[i], i));
  }
  return results;
}

function interpose(array, delim) {
  // Injects delim between elements of array
  // Example:
  // lively.lang.arr.interpose(["test", "abc", 444], "aha"));
  // // => ["test","aha","abc","aha",444]
  return array.reduce(function (xs, x) {
    if (xs.length > 0) xs.push(delim);
    xs.push(x);return xs;
  }, []);
}

function delimWith(array, delim) {
  // ignore-in-doc
  // previously used, use interpose now!
  return interpose(array, delim);
}

// -=-=-=-=-
// mapping
// -=-=-=-=-

function map$1(array, iterator, context) {
  // [a] -> (a -> b) -> c? -> [b]
  // Applies `iterator` to each element of `array` and returns a new Array
  // with the results of those calls. Like `Array.prototype.some`.
  return array.map(iterator, context);
}

function invoke(array, method, arg1, arg2, arg3, arg4, arg5, arg6) {
  // Calls `method` on each element in `array`, passing all arguments. Often
  // a handy way to avoid verbose `map` calls.
  // Example: arr.invoke(["hello", "world"], "toUpperCase") // => ["HELLO","WORLD"]
  return array.map(function (ea) {
    return ea[method](arg1, arg2, arg3, arg4, arg5, arg6);
  });
}

function pluck(array, property) {
  // Returns `property` or undefined from each element of array. For quick
  // `map`s and similar to `invoke`.
  // Example: arr.pluck(["hello", "world"], 0) // => ["h","w"]
  return array.map(function (ea) {
    return ea[property];
  });
}

// -=-=-=-=-
// folding
// -=-=-=-=-

function reduce(array, iterator, memo, context) {
  // Array -> Function -> Object? -> Object? -> Object?
  // Applies `iterator` to each element of `array` and returns a new Array
  // with the results of those calls. Like `Array.prototype.some`.
  return array.reduce(iterator, memo, context);
}

function reduceRight(array, iterator, memo, context) {
  // show-in-doc
  return array.reduceRight(iterator, memo, context);
}

// -=-=-=-=-
// testing
// -=-=-=-=-

var isArray$1 = Array.isArray;

var includes$1 = features$1.includes ? function (array, object) {
  return array.includes(object);
} : function (array, object) {
  // Example: arr.include([1,2,3], 2) // => true
  return array.indexOf(object) !== -1;
};

var include$1 = includes$1;

function some(array, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> Boolean
  // Returns true if there is at least one abject in `array` for which
  // `iterator` returns a truthy result. Like `Array.prototype.some`.
  return array.some(iterator, context);
}

function every(array, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> Boolean
  // Returns true if for all abjects in `array` `iterator` returns a truthy
  // result. Like `Array.prototype.every`.
  return array.every(iterator, context);
}

function equals$2(array, otherArray) {
  // Returns true iff each element in `array` is equal (`==`) to its
  // corresponding element in `otherArray`
  var len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (var i = 0; i < len; i++) {
    if (array[i] && otherArray[i] && array[i].equals && otherArray[i].equals) {
      if (!array[i].equals(otherArray[i])) {
        return false;
      } else {
        continue;
      }
    }
    if (array[i] != otherArray[i]) return false;
  }
  return true;
}

function deepEquals(array, otherArray) {
  // Returns true iff each element in `array` is structurally equal
  // (`lang.obj.equals`) to its corresponding element in `otherArray`
  var len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (var i = 0; i < len; i++) {
    if (!equals$1(array[i], otherArray[i])) return false;
  }
  return true;
}

// -=-=-=-=-
// sorting
// -=-=-=-=-

function isSorted(array, descending) {
  if (descending) {
    for (var i = 1; i < array.length; i++) {
      if (array[i - 1] < array[i]) return false;
    }
  } else {
    for (var i = 1; i < array.length; i++) {
      if (array[i - 1] > array[i]) return false;
    }
  }
  return true;
}

function sort(array, sortFunc) {
  // [a] -> (a -> Number)? -> [a]
  // Just `Array.prototype.sort`
  return array.sort(sortFunc);
}

function sortBy(array, iterator, context) {
  // Example:
  // arr.sortBy(["Hello", "Lively", "User"], function(ea) {
  //   return ea.charCodeAt(ea.length-1); }) // => ["Hello","User","Lively"]
  return pluck(array.map(function (value, index) {
    return { value: value, criteria: iterator.call(context, value, index) };
  }).sort(function (left, right) {
    var a = left.criteria,
        b = right.criteria;
    return a < b ? -1 : a > b ? 1 : 0;
  }), 'value');
}

function sortByKey(array, key) {
  // Example:
  // lively.lang.arr.sortByKey([{x: 3}, {x: 2}, {x: 8}], "x")
  // // => [{x: 2},{x: 3},{x: 8}]
  return sortBy(array, function (ea) {
    return ea[key];
  });
}

function reverse(array) {
  return array.reverse();
}

function reversed(array) {
  return array.slice().reverse();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-
// RegExp / String matching
// -=-=-=-=-=-=-=-=-=-=-=-=-

function reMatches$1(arr, re, stringifier) {
  // result might include null items if re did not match (usful for masking)
  // Example:
  //   var morphs = $world.withAllSubmorphsDo(function(x) { return x; ;
  //   morphs.mask(morphs.reMatches(/code/i))
  stringifier = stringifier || String;
  return arr.map(function (ea) {
    return stringifier(ea).match(re);
  });
}

// -=-=-=-=-=-
// accessors
// -=-=-=-=-=-

function first(array) {
  return array[0];
}

function last(array) {
  return array[array.length - 1];
}

// -=-=-=-=-=-=-=-
// Set operations
// -=-=-=-=-=-=-=-

function intersect(array1, array2) {
  // set-like intersection
  return uniq(array1).filter(function (item) {
    return array2.indexOf(item) > -1;
  });
}

function union(array1, array2) {
  // set-like union
  var result = array1.slice();
  for (var i = 0; i < array2.length; i++) {
    var item = array2[i];
    if (result.indexOf(item) === -1) result.push(item);
  }
  return result;
}

function pushAt(array, item, index) {
  // inserts `item` at `index`, mutating
  array.splice(index, 0, item);
}

function removeAt(array, index) {
  // inserts item at `index`, mutating
  array.splice(index, 1);
}

function remove(array, item) {
  // removes first occurrence of item in `array`, mutating
  var index = array.indexOf(item);
  if (index >= 0) removeAt(array, index);
  return item;
}

function pushAll$1(array, items) {
  // appends all `items`, mutating
  array.push.apply(array, items);
  return array;
}

function pushAllAt(array, items, idx) {
  // inserts all `items` at `idx`, mutating
  array.splice.apply(array, [idx, 0].concat(items));
}

function pushIfNotIncluded(array, item) {
  // only appends `item` if its not already in `array`, mutating
  if (!array.includes(item)) array.push(item);
}

function replaceAt(array, item, index) {
  // mutating
  array.splice(index, 1, item);
}

function clear(array) {
  // removes all items, mutating
  array.length = 0;return array;
}

function isSubset(list1, list2) {
  // are all elements in list1 in list2?
  for (var i = 0; i < list1.length; i++) {
    if (!list2.includes(list1[i])) return false;
  }return true;
}

// -=-=-=-=-=-=-=-=-=-=-=-
// asynchronous iteration
// -=-=-=-=-=-=-=-=-=-=-=-
function doAndContinue(array, iterator, endFunc, context) {
  // Iterates over array but instead of consecutively calling iterator,
  // iterator gets passed in the invocation for the next iteration step
  // as a function as first parameter. This allows to wait arbitrarily
  // between operation steps, great for managing dependencies between tasks.
  // Related is [`fun.composeAsync`]().
  // Example:
  // arr.doAndContinue([1,2,3,4], function(next, n) {
  //   alert("At " + n);
  //   setTimeout(next, 100);
  // }, function() { alert("Done"); })
  // // If the elements are functions you can leave out the iterator:
  // arr.doAndContinue([
  //   function(next) { alert("At " + 1); next(); },
  //   function(next) { alert("At " + 2); next(); }
  // ], null, function() { alert("Done"); });
  endFunc = endFunc || Null;
  context = context || GLOBAL$1;
  iterator = iterator || function (next, ea, idx) {
    ea.call(context, next, idx);
  };
  return array.reduceRight(function (nextFunc, ea, idx) {
    return function () {
      iterator.call(context, nextFunc, ea, idx);
    };
  }, endFunc)();
}

function nestedDelay(array, iterator, waitSecs, endFunc, context, optSynchronChunks) {
  // Calls `iterator` for every element in `array` and waits between iterator
  // calls `waitSecs`. Eventually `endFunc` is called. When passing a number n
  // as `optSynchronChunks`, only every nth iteration is delayed.
  endFunc = endFunc || function () {};
  return array.clone().reverse().reduce(function (nextFunc, ea, idx) {
    return function () {
      iterator.call(context || GLOBAL$1, ea, idx);
      // only really delay every n'th call optionally
      if (optSynchronChunks && idx % optSynchronChunks !== 0) {
        nextFunc();
      } else {
        nextFunc.delay(waitSecs);
      }
    };
  }, endFunc)();
}

function forEachShowingProgress() /*array, progressBar, iterator, labelFunc, whenDoneFunc, context or spec*/{
  // ignore-in-doc
  var args = Array.from(arguments),
      array = args.shift(),
      steps = array.length,
      progressBar,
      iterator,
      labelFunc,
      whenDoneFunc,
      context,
      progressBarAdded = false;

  // init args
  if (args.length === 1) {
    progressBar = args[0].progressBar;
    iterator = args[0].iterator;
    labelFunc = args[0].labelFunction;
    whenDoneFunc = args[0].whenDone;
    context = args[0].context;
  } else {
    progressBar = args[0];
    iterator = args[1];
    labelFunc = args[2];
    whenDoneFunc = args[3];
    context = args[4];
  }
  if (!context) context = typeof window !== 'undefined' ? window : global;
  if (!labelFunc) labelFunc = function labelFunc(x) {
    return x;
  };

  // init progressbar
  if (!progressBar) {
    progressBarAdded = true;
    var Global = typeof window !== 'undefined' ? window : global;
    var world = Global.lively && lively.morphic && lively.morphic.World.current();
    progressBar = world ? world.addProgressBar() : {
      setValue: function setValue(val) {},
      setLabel: function setLabel() {},
      remove: function remove() {}
    };
  }
  progressBar.setValue(0);

  // nest functions so that the iterator calls the next after a delay
  array.reduceRight(function (nextFunc, item, idx) {
    return function () {
      try {
        progressBar.setValue(idx / steps);
        if (labelFunc) progressBar.setLabel(labelFunc.call(context, item, idx));
        iterator.call(context, item, idx);
      } catch (e) {
        console.error('Error in forEachShowingProgress at %s (%s)\n%s\n%s', idx, item, e, e.stack);
      }
      nextFunc.delay(0);
    };
  }, function () {
    progressBar.setValue(1);
    if (progressBarAdded) (function () {
      progressBar.remove();
    }).delay(0);
    if (whenDoneFunc) whenDoneFunc.call(context);
  })();

  return array;
}

function swap(array, index1, index2) {
  // mutating
  // Example:
  // var a = [1,2,3,4];
  // arr.swap(a, 3, 1);
  // a // => [1,4,3,2]
  if (index1 < 0) index1 = array.length + index1;
  if (index2 < 0) index2 = array.length + index2;
  var temp = array[index1];
  array[index1] = array[index2];
  array[index2] = temp;
  return array;
}

function rotate(array, times) {
  // non-mutating
  // Example:
  // arr.rotate([1,2,3]) // => [2,3,1]
  times = times || 1;
  return array.slice(times).concat(array.slice(0, times));
}

// -=-=-=-=-
// grouping
// -=-=-=-=-

function groupBy(array, iterator, context) {
  // Applies `iterator` to each element in `array`, and puts the return value
  // into a collection (the group) associated to it's stringified representation
  // (the "hash").
  // See [`Group.prototype`] for available operations on groups.
  // Example:
  // Example 1: Groups characters by how often they occur in a string:
  // var chars = arr.from("Hello World");
  // arr.groupBy(arr.uniq(chars), function(c) {
  //   return arr.count(chars, c); })
  // // => {
  // //   "1": ["H","e"," ","W","r","d"],
  // //   "2": ["o"],
  // //   "3": ["l"]
  // // }
  // // Example 2: Group numbers by a custom qualifier:
  // arr.groupBy([3,4,1,7,4,3,8,4], function(n) {
  //   if (n <= 3) return "small";
  //   if (n <= 7) return "medium";
  //   return "large";
  // });
  // // => {
  // //   large: [8],
  // //   medium: [4,7,4,4],
  // //   small: [3,1,3]
  // // }
  return Group.fromArray(array, iterator, context);
}

function groupByKey(array, key) {
  // var objects = [{x: }]
  // arr.groupBy(arr.uniq(chars), function(c) {
  //   return arr.count(chars, c); })
  // // => {
  // //   "1": ["H","e"," ","W","r","d"],
  // //   "2": ["o"],
  // //   "3": ["l"]
  // // }
  return groupBy(array, function (ea) {
    return ea[key];
  });
}

function partition(array, iterator, context) {
  // Example:
  // var array = [1,2,3,4,5,6];
  // arr.partition(array, function(ea) { return ea > 3; })
  // // => [[1,2,3,4],[5,6]]
  iterator = iterator || function (x) {
    return x;
  };
  var trues = [],
      falses = [];
  array.forEach(function (value, index) {
    (iterator.call(context, value, index) ? trues : falses).push(value);
  });
  return [trues, falses];
}

function batchify(array, constrainedFunc, context) {
  // Takes elements and fits them into subarrays (= batches) so that for
  // each batch constrainedFunc returns true. Note that contrained func
  // should at least produce 1-length batches, otherwise an error is raised
  // Example:
  // // Assume you have list of things that have different sizes and you want to
  // // create sub-arrays of these things, with each sub-array having if possible
  // // less than a `batchMaxSize` of combined things in it:
  // var sizes = [
  //   Math.pow(2, 15), // 32KB
  //   Math.pow(2, 29), // 512MB
  //   Math.pow(2, 29), // 512MB
  //   Math.pow(2, 27), // 128MB
  //   Math.pow(2, 26), // 64MB
  //   Math.pow(2, 26), // 64MB
  //   Math.pow(2, 24), // 16MB
  //   Math.pow(2, 26)] // 64MB
  // var batchMaxSize = Math.pow(2, 28)/*256MB*/;
  // function batchConstrained(batch) {
  //   return batch.length == 1 || batch.sum() < batchMaxSize;
  // }
  // var batches = sizes.batchify(batchConstrained);
  // batches.pluck('length') // => [4,1,1,2]
  // batches.map(arr.sum).map(num.humanReadableByteSize) // => ["208.03MB","512MB","512MB","128MB"]

  return findBatches([], array);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function extractBatch(batch, sizes) {
    // ignore-in-doc
    // Array -> Array -> Array[Array,Array]
    // case 1: no sizes to distribute, we are done
    if (!sizes.length) return [batch, []];
    var first = sizes[0],
        rest = sizes.slice(1);
    // if batch is empty we have to take at least one
    // if batch and first still fits, add first
    var candidate = batch.concat([first]);
    if (constrainedFunc.call(context, candidate)) return extractBatch(candidate, rest);
    // otherwise leave first out for now
    var batchAndSizes = extractBatch(batch, rest);
    return [batchAndSizes[0], [first].concat(batchAndSizes[1])];
  }

  function findBatches(batches, sizes) {
    if (!sizes.length) return batches;
    var extracted = extractBatch([], sizes);
    if (!extracted[0].length) throw new Error('Batchify constrained does not ensure consumption ' + 'of at least one item per batch!');
    return findBatches(batches.concat([extracted[0]]), extracted[1]);
  }
}

function toTuples(array, tupleLength) {
  // Creates sub-arrays with length `tupleLength`
  // Example:
  // arr.toTuples(["H","e","l","l","o"," ","W","o","r","l","d"], 4)
  // // => [["H","e","l","l"],["o"," ","W","o"],["r","l","d"]]
  tupleLength = tupleLength || 1;
  return range(0, Math.ceil(array.length / tupleLength) - 1).map(function (n) {
    return array.slice(n * tupleLength, n * tupleLength + tupleLength);
  }, array);
}

var permutations = function () {
  function computePermutations(restArray, values$$1) {
    return !restArray.length ? [values$$1] : flatmap(restArray, function (ea, i) {
      return computePermutations(restArray.slice(0, i).concat(restArray.slice(i + 1)), values$$1.concat([ea]));
    });
  }
  return function (array) {
    return computePermutations(array, []);
  };
}();

function combinationsPick(listOfListsOfValues, pickIndices) {
  // Given a "listOfListsOfValues" in the form of an array of arrays and
  // `pickIndices` list with the size of the number of arrays which indicates what
  // values to pick from each of the arrays, return a list with two values:
  // 1. values picked from each of the arrays, 2. the next pickIndices or null if at end
  // Example:
  //  var searchSpace = [["a", "b", "c"], [1,2]];
  //  arr.combinationsPick(searchSpace, [0,1]);
  //    // => [["a",2], [1,0]]
  //  arr.combinationsPick(searchSpace, [1,0]);
  //    // => [["b",1], [1,1]]
  var values$$1 = listOfListsOfValues.map(function (subspace, i) {
    return subspace[pickIndices[i]];
  }),
      nextState = pickIndices.slice();
  for (var i = listOfListsOfValues.length; i--; i >= 0) {
    var subspace = listOfListsOfValues[i],
        nextIndex = nextState[i] + 1;
    if (subspace[nextIndex]) {
      nextState[i] = nextIndex;break;
    } else if (i === 0) {
      nextState = undefined;break;
    } else {
      nextState[i] = 0;
    }
  }
  return [values$$1, nextState];
}

function combinations(listOfListsOfValues) {
  // Given a "listOfListsOfValues" in the form of an array of arrays,
  // retrieve all the combinations by picking one item from each array.
  // This basically creates a search tree, traverses it and gathers all node
  // values whenever a leaf node is reached.
  // Example:
  //   lively.lang.arr.combinations([['a', 'b', 'c'], [1, 2]])
  //    // => [["a", 1], ["a", 2], ["b", 1], ["b", 2], ["c", 1], ["c", 2]]
  var size = listOfListsOfValues.reduce(function (prod, space) {
    return prod * space.length;
  }, 1),
      searchState = listOfListsOfValues.map(function (_) {
    return 0;
  }),
      results = new Array(size);
  for (var i = 0; i < size; i++) {
    var result = combinationsPick(listOfListsOfValues, searchState);
    results[i] = result[0];
    searchState = result[1];
  }
  return results;
}

function take(arr, n) {
  return arr.slice(0, n);
}

function drop(arr, n) {
  return arr.slice(n);
}

function takeWhile(arr, fun, context) {
  var i = 0;
  for (; i < arr.length; i++) {
    if (!fun.call(context, arr[i], i)) break;
  }return arr.slice(0, i);
}

function dropWhile(arr, fun, context) {
  var i = 0;
  for (; i < arr.length; i++) {
    if (!fun.call(context, arr[i], i)) break;
  }return arr.slice(i);
}

// -=-=-=-=-=-
// randomness
// -=-=-=-=-=-

function shuffle(array) {
  // Ramdomize the order of elements of array. Does not mutate array.
  // Example:
  // shuffle([1,2,3,4,5]) // => [3,1,2,5,4]
  var unusedIndexes = range(0, array.length - 1),
      shuffled = Array(array.length);
  for (var i = 0; i < array.length; i++) {
    var shuffledIndex = unusedIndexes.splice(Math.round(Math.random() * (unusedIndexes.length - 1)), 1);
    shuffled[shuffledIndex] = array[i];
  }
  return shuffled;
}

// -=-=-=-=-=-=-=-
// Number related
// -=-=-=-=-=-=-=-

function max(array, iterator, context) {
  // Example:
  //   var array = [{x:3,y:2}, {x:5,y:1}, {x:1,y:5}];
  //   arr.max(array, function(ea) { return ea.x; }) // => {x: 5, y: 1}
  iterator = iterator || function (x) {
    return x;
  };
  var result;
  array.reduce(function (max, ea, i) {
    var val = iterator.call(context, ea, i);
    if (typeof val !== "number" || val <= max) return max;
    result = ea;return val;
  }, -Infinity);
  return result;
}

function min(array, iterator, context) {
  // Similar to `arr.max`.
  iterator = iterator || function (x) {
    return x;
  };
  return max(array, function (ea, i) {
    return -iterator.call(context, ea, i);
  });
}

function sum(array) {
  // show-in-doc
  var sum = 0;
  for (var i = 0; i < array.length; i++) {
    sum += array[i];
  }return sum;
}

function count$1(array, item) {
  return array.reduce(function (count, ea) {
    return ea === item ? count + 1 : count;
  }, 0);
}

function size$1(array) {
  return array.length;
}

function histogram(data, binSpec) {
  // ignore-in-doc
  // Without a `binSpec` argument partition the data
  // var numbers = arr.genN(10, num.random);
  // var numbers = arr.withN(10, "a");
  // => [65,73,34,94,92,31,27,55,95,48]
  // => [[65,73],[34,94],[92,31],[27,55],[95,48]]
  // => [[82,50,16],[25,43,77],[40,64,31],[51,39,13],[17,34,87],[51,33,30]]
  if (typeof binSpec === 'undefined' || typeof binSpec === 'number') {
    var binNumber = binSpec || function sturge() {
      return Math.ceil(Math.log(data.length) / Math.log(2) + 1);
    }(data);
    var binSize = Math.ceil(Math.round(data.length / binNumber));
    return range(0, binNumber - 1).map(function (i) {
      return data.slice(i * binSize, (i + 1) * binSize);
    });
  } else if (binSpec instanceof Array) {
    // ignore-in-doc
    // bins specifies n threshold values that will create n-1 bins.
    // Each data value d is placed inside a bin i if:
    // threshold[i] >= d && threshold[i+1] < d
    var thresholds = binSpec;
    return data.reduce(function (bins, d) {
      if (d < thresholds[1]) {
        bins[0].push(d);return bins;
      }
      for (var i = 1; i < thresholds.length; i++) {
        if (d >= thresholds[i] && (!thresholds[i + 1] || d <= thresholds[i + 1])) {
          bins[i].push(d);return bins;
        }
      }
      throw new Error("Histogram creation: Cannot group data " + d + " into thresholds " + thresholds);
    }, range(1, thresholds.length).map(function () {
      return [];
    }));
  }
}

// -=-=-=-=-
// Copying
// -=-=-=-=-

function clone$1(array) {
  // shallow copy
  return [].concat(array);
}

// -=-=-=-=-=-
// conversion
// -=-=-=-=-=-

function toArray$3(array) {
  return from(array);
}

// -=-=-=-=-=-
// DEPRECATED
// -=-=-=-=-=-

function each(arr, iterator, context) {
  return arr.forEach(iterator, context);
}

function all$1(arr, iterator, context) {
  return arr.every(iterator, context);
}

function any(arr, iterator, context) {
  return arr.some(iterator, context);
}

function collect(arr, iterator, context) {
  return arr.map(iterator, context);
}

function findAll(arr, iterator, context) {
  return arr.filter(iterator, context);
}

function inject(array, memo, iterator, context) {
  if (context) iterator = iterator.bind(context);
  return array.reduce(iterator, memo);
}

// asynch methods
function mapAsyncSeries(array, iterator, callback) {
  // Apply `iterator` over `array`. Unlike `mapAsync` the invocation of
  // the iterator happens step by step in the order of the items of the array
  // and not concurrently.

  // ignore-in-doc
  // Could simply be:
  // return exports.arr.mapAsync(array, {parallel: 1}, iterator, callback);
  // but the version below is 2x faster

  var result = [],
      callbackTriggered = false;
  return array.reduceRight(function (nextFunc, ea, idx) {
    if (callbackTriggered) return;
    return function (err, eaResult) {
      if (err) return maybeDone(err);
      if (idx > 0) result.push(eaResult);
      try {
        iterator(ea, idx, once(nextFunc));
      } catch (e) {
        maybeDone(e);
      }
    };
  }, function (err, eaResult) {
    result.push(eaResult);
    maybeDone(err, true);
  })();

  function maybeDone(err, finalCall) {
    if (callbackTriggered || !err && !finalCall) return;
    callbackTriggered = true;
    try {
      callback(err, result);
    } catch (e) {
      console.error("Error in mapAsyncSeries - callback invocation error:\n" + (e.stack || e));
    }
  }
}

function mapAsync(array, options, iterator, callback) {
  // Apply `iterator` over `array`. In each iterator gets a callback as third
  // argument that should be called when the iteration is done. After all
  // iterators have called their callbacks, the main `callback` function is
  // invoked with the result array.
  // Example:
  // lively.lang.arr.mapAsync([1,2,3,4],
  //   function(n, i, next) { setTimeout(function() { next(null, n + i); }, 20); },
  //   function(err, result) { /* result => [1,3,5,7] */ });

  if (typeof options === "function") {
    callback = iterator;
    iterator = options;
    options = null;
  }
  options = options || {};

  if (!array.length) return callback && callback(null, []);

  if (!options.parallel) options.parallel = Infinity;

  var results = [],
      completed = [],
      callbackTriggered = false,
      lastIteratorIndex = 0,
      nActive = 0;

  var iterators = array.map(function (item, i) {
    return function () {
      nActive++;
      try {
        iterator(item, i, once(function (err, result) {
          results[i] = err || result;
          maybeDone(i, err);
        }));
      } catch (e) {
        maybeDone(i, e);
      }
    };
  });

  return activate();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function activate() {
    while (nActive < options.parallel && lastIteratorIndex < array.length) {
      iterators[lastIteratorIndex++]();
    }
  }

  function maybeDone(idx, err) {
    if (completed.indexOf(idx) > -1) return;
    completed.push(idx);
    nActive--;
    if (callbackTriggered) return;
    if (!err && completed.length < array.length) {
      activate();return;
    }
    callbackTriggered = true;
    try {
      callback && callback(err, results);
    } catch (e) {
      console.error("Error in mapAsync - main callback invocation error:\n" + (e.stack || e));
    }
  }
}

// poly-filling...
if (!features$1.from) Array.from = from;
if (!features$1.filter) Array.prototype.filter = function (it, ctx) {
  return filter(this, it, ctx);
};
if (!features$1.find) Array.prototype.find = function (it, ctx) {
  return detect(this, it, ctx);
};
if (!features$1.findIndex) Array.prototype.findIndex = function (it, ctx) {
  return findIndex(this, it, ctx);
};
if (!features$1.includes) Array.prototype.includes = function (x) {
  return includes$1(this, x);
};



var arr = Object.freeze({
	range: range,
	from: from,
	withN: withN,
	genN: genN,
	filter: filter,
	detect: detect,
	findIndex: findIndex,
	findAndGet: findAndGet,
	filterByKey: filterByKey,
	grep: grep,
	mask: mask,
	reject: reject,
	rejectByKey: rejectByKey,
	without: without,
	withoutAll: withoutAll,
	uniq: uniq,
	uniqBy: uniqBy,
	uniqByKey: uniqByKey,
	compact: compact,
	mutableCompact: mutableCompact,
	forEach: forEach$1,
	zip: zip,
	flatten: flatten,
	flatmap: flatmap,
	interpose: interpose,
	delimWith: delimWith,
	map: map$1,
	invoke: invoke,
	pluck: pluck,
	reduce: reduce,
	reduceRight: reduceRight,
	isArray: isArray$1,
	includes: includes$1,
	include: include$1,
	some: some,
	every: every,
	equals: equals$2,
	deepEquals: deepEquals,
	isSorted: isSorted,
	sort: sort,
	sortBy: sortBy,
	sortByKey: sortByKey,
	reverse: reverse,
	reversed: reversed,
	reMatches: reMatches$1,
	first: first,
	last: last,
	intersect: intersect,
	union: union,
	pushAt: pushAt,
	removeAt: removeAt,
	remove: remove,
	pushAll: pushAll$1,
	pushAllAt: pushAllAt,
	pushIfNotIncluded: pushIfNotIncluded,
	replaceAt: replaceAt,
	clear: clear,
	isSubset: isSubset,
	doAndContinue: doAndContinue,
	nestedDelay: nestedDelay,
	forEachShowingProgress: forEachShowingProgress,
	swap: swap,
	rotate: rotate,
	groupBy: groupBy,
	groupByKey: groupByKey,
	partition: partition,
	batchify: batchify,
	toTuples: toTuples,
	permutations: permutations,
	combinationsPick: combinationsPick,
	combinations: combinations,
	take: take,
	drop: drop,
	takeWhile: takeWhile,
	dropWhile: dropWhile,
	shuffle: shuffle,
	max: max,
	min: min,
	sum: sum,
	count: count$1,
	size: size$1,
	histogram: histogram,
	clone: clone$1,
	toArray: toArray$3,
	each: each,
	all: all$1,
	any: any,
	collect: collect,
	findAll: findAll,
	inject: inject,
	mapAsyncSeries: mapAsyncSeries,
	mapAsync: mapAsync
});

/*
 * Utility functions that help to inspect, enumerate, and create JS objects
 */

// -=-=-=-=-=-=-=-=-
// internal helper
// -=-=-=-=-=-=-=-=-

// serveral methods in lib/object.js are inspired or derived from
// Prototype JavaScript framework, version 1.6.0_rc1
// (c) 2005-2007 Sam Stephenson
// Prototype is freely distributable under the terms of an MIT-style license.
// For details, see the Prototype web site: http://www.prototypejs.org/

function print$1(object) {
  if (object && Array.isArray(object)) {
    return '[' + object.map(print$1) + ']';
  }
  if (typeof object !== "string") {
    return String(object);
  }
  var result = String(object);
  result = result.replace(/\n/g, '\\n\\\n');
  result = result.replace(/(")/g, '\\$1');
  result = '\"' + result + '\"';
  return result;
}

function indent$1(str, indentString, depth) {
  if (!depth || depth <= 0) return str;
  while (depth > 0) {
    depth--;str = indentString + str;
  }
  return str;
}

var getOwnPropertyDescriptors = typeof Object.prototype.getOwnPropertyDescriptors === "function" ? Object.prototype.getOwnPropertyDescriptors : function getOwnPropertyDescriptors(object) {
  var descriptors = {};
  for (var name in object) {
    if (!Object.prototype.hasOwnProperty.call(object, name)) continue;
    Object.defineProperty(descriptors, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: Object.getOwnPropertyDescriptor(object, name)
    });
  }
  return descriptors;
};

// show-in-doc

// -=-=-=-=-
// testing
// -=-=-=-=-

function isArray$$1(obj) {
  /*show-in-doc*/return Array.isArray(obj);
}

function isElement(object) {
  /*show-in-doc*/return object && object.nodeType == 1;
}

function isFunction(object) {
  /*show-in-doc*/return object instanceof Function;
}

function isBoolean(object) {
  /*show-in-doc*/return typeof object == "boolean";
}

function isString(object) {
  /*show-in-doc*/return typeof object == "string";
}

function isNumber(object) {
  /*show-in-doc*/return typeof object == "number";
}

function isUndefined(object) {
  /*show-in-doc*/return typeof object == "undefined";
}

function isRegExp(object) {
  /*show-in-doc*/return object instanceof RegExp;
}

function isObject(object) {
  /*show-in-doc*/return (typeof object === "undefined" ? "undefined" : _typeof(object)) == "object";
}

function isPrimitive(obj) {
  // show-in-doc
  if (!obj) return true;
  switch (typeof obj === "undefined" ? "undefined" : _typeof(obj)) {
    case "string":
    case "number":
    case "boolean":
      return true;
  }
  return false;
}

function isEmpty(object) {
  /*show-in-doc*/
  for (var key in object) {
    if (object.hasOwnProperty(key)) return false;
  }return true;
}

function equals$1(a, b) {
  // Is object `a` structurally equivalent to object `b`? Deep comparison.
  if (a === b) return true;
  if (!a || !b) return a == b;
  if (Array.isArray(a)) return deepEquals(a, b);
  switch (a.constructor) {
    case String:
    case Date:
    case Boolean:
    case Number:
      return a == b;
  }
  if (typeof a.isEqualNode === "function") return a.isEqualNode(b);
  if (typeof a.equals === "function") return a.equals(b);
  var seenInA = [];
  for (var name in a) {
    seenInA.push(name);
    if (typeof a[name] === "function") continue;
    if (!equals$1(a[name], b[name])) return false;
  }
  for (var name in b) {
    if (seenInA.indexOf(name) !== -1) continue;
    if (typeof b[name] === "function") continue;
    if (!equals$1(b[name], a[name])) return false;
  }
  return true;
}

// -=-=-=-=-=-
// accessing
// -=-=-=-=-=-

var keys$1 = Object.keys;

function values(object) {
  // Example:
  // var obj1 = {x: 22}, obj2 = {x: 23, y: {z: 3}};
  // obj2.__proto__ = obj1;
  // obj.values(obj1) // => [22]
  // obj.values(obj2) // => [23,{z: 3}]
  return object ? Object.keys(object).map(function (k) {
    return object[k];
  }) : [];
}

function select(obj, keys) {
  // return a new object that copies all properties with `keys` from `obj`
  var selected = {};
  for (var i = 0; i < keys.length; i++) {
    selected[keys[i]] = obj[keys[i]];
  }return selected;
}

function dissoc(object, keys) {
  object = object || {};
  var descriptors = getOwnPropertyDescriptors(object);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] in descriptors) delete descriptors[keys[i]];
  }
  return Object.defineProperties({}, descriptors);
}

function addScript(object, funcOrString, optName, optMapping) {
  var func = fromString(funcOrString);
  return asScriptOf(func, object, optName, optMapping);
}

// -=-=-=-=-
// mutation
// -=-=-=-=-
function extend(destination, source) {
  // Add all properties of `source` to `destination`.
  // Example:
  // var dest = {x: 22}, src = {x: 23, y: 24}
  // obj.extend(dest, src);
  // dest // => {x: 23,y: 24}

  var currentCategoryNames = null;
  for (var i = 1; i < arguments.length; i++) {
    if (typeof arguments[i] == "string") {
      var catName = arguments[i];
      if (!destination.categories) destination.categories = {};
      if (!destination.categories[catName]) destination.categories[catName] = [];
      currentCategoryNames = destination.categories[catName];
      continue;
    }

    var source = arguments[i];
    for (var property in source) {
      var getter = source.__lookupGetter__(property),
          setter = source.__lookupSetter__(property);
      if (getter) destination.__defineGetter__(property, getter);
      if (setter) destination.__defineSetter__(property, setter);
      if (getter || setter) continue;
      var sourceObj = source[property];
      destination[property] = sourceObj;
      if (currentCategoryNames) currentCategoryNames.push(property);
      if (typeof sourceObj === "function") {
        if (!sourceObj.displayName) sourceObj.displayName = property;
        // remember the module that contains the definition
        if (typeof lively !== "undefined" && lively.Module && lively.Module.current) sourceObj.sourceModule = lively.Module.current();
      }
    }
  }

  return destination;
}

// -=-=-=-=-
// clone
// -=-=-=-=-

function clone$$1(object) {
  // Shallow copy
  if (isPrimitive(object)) return object;
  if (Array.isArray(object)) return Array.prototype.slice.call(object);
  var clone$$1 = {};
  for (var key in object) {
    if (object.hasOwnProperty(key)) clone$$1[key] = object[key];
  }
  return clone$$1;
}

function extract(object, properties, mapFunc) {
  // Takes a list of properties and returns a new object with those
  // properties shallow-copied from object
  var copied = {};
  for (var i = 0; i < properties.length; i++) {
    if (properties[i] in object) copied[properties[i]] = mapFunc ? mapFunc(properties[i], object[properties[i]]) : object[properties[i]];
  }
  return copied;
}

// -=-=-=-=-=-
// inspection
// -=-=-=-=-=-
function inspect(object, options, depth) {
  // Prints a human-readable representation of `obj`. The printed
  // representation will be syntactically correct JavaScript but will not
  // necessarily evaluate to a structurally identical object. `inspect` is
  // meant to be used while interactivively exploring JavaScript programs and
  // state.
  //
  // `options` can be {
  //   printFunctionSource: BOOLEAN,
  //   escapeKeys: BOOLEAN,
  //   maxDepth: NUMBER,
  //   customPrinter: FUNCTION
  // }
  options = options || {};
  depth = depth || 0;

  if (options.customPrinter) {
    var ignoreSignal = options._ignoreSignal || (options._ignoreSignal = {}),
        continueInspectFn = function continueInspectFn(obj) {
      return inspect(obj, options, depth + 1);
    },
        customInspected = options.customPrinter(object, ignoreSignal, continueInspectFn);
    if (customInspected !== ignoreSignal) return customInspected;
  }
  if (!object) return print$1(object);

  // print function
  if (typeof object === 'function') {
    return options.printFunctionSource ? String(object) : 'function' + (object.name ? ' ' + object.name : '') + '(' + argumentNames(object).join(',') + ') {/*...*/}';
  }

  // print "primitive"
  switch (object.constructor) {
    case String:
    case Boolean:
    case RegExp:
    case Number:
      return print$1(object);
  }

  if (typeof object.serializeExpr === 'function') return object.serializeExpr();

  var isArray$$1 = object && Array.isArray(object),
      openBr = isArray$$1 ? '[' : '{',
      closeBr = isArray$$1 ? ']' : '}';
  if (options.maxDepth && depth >= options.maxDepth) return openBr + '/*...*/' + closeBr;

  var printedProps = [];
  if (isArray$$1) {
    printedProps = object.map(function (ea) {
      return inspect(ea, options, depth + 1);
    });
  } else {
    printedProps = Object.keys(object).sort(function (a, b) {
      var aIsFunc = typeof object[a] === 'function',
          bIsFunc = typeof object[b] === 'function';
      if (aIsFunc === bIsFunc) {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      }
      return aIsFunc ? 1 : -1;
    }).map(function (key, i) {
      if (isArray$$1) inspect(object[key], options, depth + 1);
      var printedVal = inspect(object[key], options, depth + 1);
      return options.escapeKeys ? JSON.stringify(key) : key + ": " + printedVal;
    });
  }

  if (printedProps.length === 0) {
    return openBr + closeBr;
  }

  var printedPropsJoined = printedProps.join(', '),
      useNewLines = (!isArray$$1 || options.newLineInArrays) && (!options.minLengthForNewLine || printedPropsJoined.length >= options.minLengthForNewLine),
      ind = indent$1('', options.indent || '  ', depth),
      propIndent = indent$1('', options.indent || '  ', depth + 1),
      startBreak = useNewLines && !isArray$$1 ? '\n' + propIndent : '',
      eachBreak = useNewLines ? '\n' + propIndent : '',
      endBreak = useNewLines && !isArray$$1 ? '\n' + ind : '';
  if (useNewLines) printedPropsJoined = printedProps.join(',' + eachBreak);
  return openBr + startBreak + printedPropsJoined + endBreak + closeBr;
}

// -=-=-=-=-
// merging
// -=-=-=-=-
function merge(objs) {
  // `objs` can be a list of objects. The return value will be a new object,
  // containing all properties of all objects. If the same property exist in
  // multiple objects, the right-most property takes precedence.
  //
  // Like `extend` but will not mutate objects in `objs`.

  // if objs are arrays just concat them
  // if objs are real objs then merge propertdies
  if (arguments.length > 1) {
    return merge(Array.prototype.slice.call(arguments));
  }

  if (Array.isArray(objs[0])) {
    // test for all?
    return Array.prototype.concat.apply([], objs);
  }

  return objs.reduce(function (merged, ea) {
    for (var name in ea) {
      if (ea.hasOwnProperty(name)) merged[name] = ea[name];
    }return merged;
  }, {});
}

function deepMerge(objA, objB) {
  // `objs` can be a list of objects. The return value will be a new object,
  // containing all properties of all objects. If the same property exist in
  // multiple objects, the right-most property takes precedence.
  //
  // Like `extend` but will not mutate objects in `objs`.

  // if objs are arrays just concat them
  // if objs are real objs then merge propertdies

  if (!objA) return objB;
  if (!objB) return objA;

  if (Array.isArray(objA)) {
    if (!Array.isArray(objB)) return objB;
    var merged = objA.map(function (ea, i) {
      return deepMerge(ea, objB[i]);
    });
    if (objB.length > objA.length) merged = merged.concat(objB.slice(objA.length));
    return merged;
  }

  if ((typeof objA === "undefined" ? "undefined" : _typeof(objA)) !== "object" || (typeof objB === "undefined" ? "undefined" : _typeof(objB)) !== "object") return objB;

  return Object.keys(objA).concat(Object.keys(objB)).reduce(function (merged, name) {
    if (!objA[name]) merged[name] = objB[name];else if (!objB[name]) merged[name] = objA[name];else if (_typeof(objA[name]) !== "object" || _typeof(objB[name]) !== "object") merged[name] = objB[name];else merged[name] = deepMerge(objA[name], objB[name]);
    return merged;
  }, {});
}

function sortKeysWithBeforeAndAfterConstraints(properties) {
  var throwErrorOnMissing = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  // Expects `properties` to be a map of keys to objects having optional
  // before/after attributes that, if present, should be lists of other property
  // keys. `sortProperties` will return an ordered list of property keys so
  // that the before / after requirements are fullfilled. If a cyclic
  // dependency is encountered an error will be thrown.
  // Example:
  // ```
  // sortProperties({foo: {}, bar: {after: ["foo"], before: ["baz"]}, "baz": {after: ["foo"]}})
  // // => ["foo","bar","baz"]
  // ```

  // ignore-in-doc
  // 1. convert "before" requirement into "after" and check if all properties
  // mentioned in after/before are actually there
  var keys = [],
      props = [],
      remaining = [];
  for (var key in properties) {
    var prop = properties[key],
        before = prop.hasOwnProperty("before") ? prop.before : prop.before = [],
        after = prop.hasOwnProperty("after") ? prop.after : prop.after = [];

    keys.push(key);
    props.push(prop);

    for (var i = before.length; i--;) {
      var beforePropName = before[i];
      var beforeProp = properties[beforePropName];
      if (!beforeProp) {
        console.warn("[initializeProperties] " + this + " sortProperties: " + ("Property " + key + " requires to be initialized before " + beforePropName + " ") + "but that property cannot be found.");
        before.splice(i, 1);
        continue;
      }
      if (!beforeProp.hasOwnProperty("after")) beforeProp.after = [];
      beforeProp.after.push(key);
    }

    for (var _i = after.length; _i--;) {
      var afterPropName = after[_i];
      var afterProp = properties[afterPropName];
      if (!afterProp) {
        console.warn("[initializeProperties] " + this + " sortProperties: " + ("Property " + key + " requires to be initialized after " + afterPropName + " ") + "but that property cannot be found.");
        after.splice(_i, 1);
      }
    }

    remaining.push(key);
  }

  // ignore-in-doc
  // compute order
  var resolvedGroups = [],
      resolvedKeys = [],
      lastLength = remaining.length + 1;

  while (remaining.length) {
    if (lastLength === remaining.length) throw new Error("Circular dependencies in handler order, could not resolve properties " + remaining.map(function (key) {
      var before = properties[key].before,
          after = properties[key].after;
      if ((!before || !before.length) && (!after || !after.length)) return "";
      var report = key + "\n";
      if (before && before.length) report += "  - before " + before.join(",") + "\n";
      if (after && after.length) report += "  - after " + after.join(",") + "\n";
      return report;
    }).join(""));
    lastLength = remaining.length;
    var resolvedGroup = [];
    for (var _i2 = remaining.length; _i2--;) {
      var _key = remaining[_i2];
      if (isSubset(properties[_key].after, resolvedKeys)) {
        remaining.splice(_i2, 1);
        resolvedKeys.push(_key);
        resolvedGroup.push(_key);
      }
    }
    resolvedGroups.push(resolvedGroup);
  }

  return flatten(resolvedGroups, 1);
}

// -=-=-=-=-=-=-
// inheritance
// -=-=-=-=-=-=-
function inherit(obj) {
  return Object.create(obj);
}

function valuesInPropertyHierarchy(obj, name) {
  // Lookup all properties named name in the proto hierarchy of obj.
  // Example:
  // var a = {foo: 3}, b = Object.create(a), c = Object.create(b);
  // c.foo = 4;
  // obj.valuesInPropertyHierarchy(c, "foo") // => [3,4]
  var result = [],
      lookupObj = obj;
  while (lookupObj) {
    if (lookupObj.hasOwnProperty(name)) result.unshift(lookupObj[name]);
    lookupObj = Object.getPrototypeOf(lookupObj);
  }
  return result;
}

function mergePropertyInHierarchy(obj, propName) {
  // like `merge` but automatically gets all definitions of the value in the
  // prototype chain and merges those.
  // Example:
  // var o1 = {x: {foo: 23}}, o2 = {x: {foo: 24, bar: 15}}, o3 = {x: {baz: "zork"}};
  // o2.__proto__ = o1; o3.__proto__ = o2;
  // obj.mergePropertyInHierarchy(o3, "x");
  // // => {bar: 15, baz: "zork",foo: 24}
  return merge(valuesInPropertyHierarchy(obj, propName));
}

function deepCopy(object) {
  // Recursively traverses `object` and its properties to create a copy.
  if (!object || (typeof object === "undefined" ? "undefined" : _typeof(object)) !== "object" || object instanceof RegExp) return object;
  var result = Array.isArray(object) ? Array(object.length) : {};
  for (var key in object) {
    if (object.hasOwnProperty(key)) result[key] = deepCopy(object[key]);
  }
  return result;
}

// -=-=-=-=-=-=-=-=-
// stringification
// -=-=-=-=-=-=-=-=-
function typeStringOf(obj) {
  // ignore-in-doc
  if (obj === null) return "null";
  if (typeof obj === "undefined") return "undefined";
  return obj.constructor.name;
}

function shortPrintStringOf(obj) {
  // ignore-in-doc
  // primitive values
  if (!isMutableType(obj)) return safeToString(obj);

  // constructed objects
  if (obj.constructor.name !== 'Object' && !Array.isArray(obj)) {
    if (obj.constructor.name) return obj.constructor.name ? obj.constructor.name : Object.prototype.toString.call(obj).split(" ")[1].split("]")[0];
  }

  // arrays or plain objects
  var typeString = "";

  function displayTypeAndLength(obj, collectionType, firstBracket, secondBracket) {
    if (obj.constructor.name === collectionType) {
      typeString += firstBracket;
      if (obj.length || Object.keys(obj).length) typeString += "...";
      typeString += secondBracket;
    }
  }
  displayTypeAndLength(obj, "Object", "{", "}");
  displayTypeAndLength(obj, "Array", "[", "]");
  return typeString;
}

function isMutableType(obj) {
  // Is `obj` a value or mutable type?
  var immutableTypes = ["null", "undefined", "Boolean", "Number", "String"];
  return immutableTypes.indexOf(typeStringOf(obj)) === -1;
}

function safeToString(obj) {
  // Like `toString` but catches errors.
  try {
    return (obj ? obj.toString() : String(obj)).replace('\n', '');
  } catch (e) {
    return '<error printing object>';
  }
}

function asObject(obj) {
  switch (typeof obj === "undefined" ? "undefined" : _typeof(obj)) {
    case 'string':
      return new String(obj);
    case 'boolean':
      return new Boolean(obj);
    case 'number':
      return new Number(obj);
    default:
      return obj;
  }
}

function newKeyIn(obj) {
  var base = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "_";

  var i = 1,
      key;
  do {
    key = base + "-" + i++;
  } while (key in obj);
  return key;
}



var obj = Object.freeze({
	isArray: isArray$$1,
	isElement: isElement,
	isFunction: isFunction,
	isBoolean: isBoolean,
	isString: isString,
	isNumber: isNumber,
	isUndefined: isUndefined,
	isRegExp: isRegExp,
	isObject: isObject,
	isPrimitive: isPrimitive,
	isEmpty: isEmpty,
	equals: equals$1,
	keys: keys$1,
	values: values,
	select: select,
	dissoc: dissoc,
	addScript: addScript,
	extend: extend,
	clone: clone$$1,
	extract: extract,
	inspect: inspect,
	merge: merge,
	deepMerge: deepMerge,
	inherit: inherit,
	valuesInPropertyHierarchy: valuesInPropertyHierarchy,
	mergePropertyInHierarchy: mergePropertyInHierarchy,
	sortKeysWithBeforeAndAfterConstraints: sortKeysWithBeforeAndAfterConstraints,
	deepCopy: deepCopy,
	typeStringOf: typeStringOf,
	shortPrintStringOf: shortPrintStringOf,
	isMutableType: isMutableType,
	safeToString: safeToString,
	asObject: asObject,
	newKeyIn: newKeyIn
});

/*global btoa,JsDiff*/
/*lively.vm dontTransform: ["btoa"]*/

// String utility methods for printing, parsing, and converting strings.

var features = {
  repeat: !!String.prototype.repeat,
  includes: !!String.prototype.includes,
  startsWith: !!String.prototype.startsWith,
  endsWith: !!String.prototype.endsWith

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // printing and formatting strings
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

};function format() {
  // String+ -> String
  // Takes a variable number of arguments. The first argument is the format
  // string. Placeholders in the format string are marked with `"%s"`.
  // Example:
  //   lively.lang.string.format("Hello %s!", "Lively User"); // => "Hello Lively User!"
  return formatFromArray(Array.prototype.slice.call(arguments));
}

function formatFromArray(objects) {
  var self = objects.shift();
  if (!self) {
    console.log("Error in Strings>>formatFromArray, first arg is undefined");
  }

  function appendText(object, string) {
    return "" + object;
  }

  function appendInteger(value, string) {
    return value.toString();
  }

  function appendFloat(value, string, precision) {
    if (precision > -1) return value.toFixed(precision);else return value.toString();
  }

  function appendObject(value, string) {
    return inspect(value);
  }

  var appenderMap = { s: appendText, d: appendInteger, i: appendInteger, f: appendFloat, o: appendObject };
  var reg = /((^%|[^\\]%)(\d+)?(\.)([a-zA-Z]))|((^%|[^\\]%)([a-zA-Z]))/;

  function parseFormat(fmt) {
    var oldFmt = fmt;
    var parts = [];

    for (var m = reg.exec(fmt); m; m = reg.exec(fmt)) {
      var type = m[8] || m[5],
          appender = type in appenderMap ? appenderMap[type] : appendObject,
          precision = m[3] ? parseInt(m[3]) : m[4] == "." ? -1 : 0;
      parts.push(fmt.substr(0, m[0][0] == "%" ? m.index : m.index + 1));
      parts.push({ appender: appender, precision: precision });

      fmt = fmt.substr(m.index + m[0].length);
    }
    if (fmt) parts.push(fmt.toString());

    return parts;
  }

  var parts = parseFormat(self),
      str = "",
      objIndex = 0;

  for (var i = 0; i < parts.length; ++i) {
    var part = parts[i];
    if (part && (typeof part === "undefined" ? "undefined" : _typeof(part)) == "object") {
      var object = objects[objIndex++];
      str += (part.appender || appendText)(object, str, part.precision);
    } else {
      str += appendText(part, str);
    }
  }
  return str;
}

function indent(str, indentString, depth) {
  // String -> String -> String? -> String
  // Example:
  //   string.indent("Hello", "  ", 2) // => "    Hello"
  if (!depth || depth <= 0) return str;
  var indent = "";while (depth > 0) {
    depth--;indent += indentString;
  }
  return lines(str).map(function (line) {
    return indent + line;
  }).join("\n");
}

function minIndent(str, indentString) {
  // Find out what the minum indentation of the text in str is
  // Example:
  //   minIndent("    Hello", "  ") // => 2
  if (!indentString) indentString = "  ";
  var indentRe = new RegExp("^(" + indentString + ")*", "gm");
  return min(str.match(indentRe).map(function (ea) {
    return Math.floor(ea.length / indentString.length);
  }));
}

function changeIndent(str, indentString, depth) {
  // Add or remove indent from lines in str to match depth
  // Example:
  //   string.changeIndent("    Hello", "  ", 1) // => "  Hello"
  if (!indentString) indentString = "  ";
  if (!depth) depth = 0;
  var existingIndent = minIndent(str, indentString);
  if (existingIndent === depth) return str;
  if (existingIndent < depth) return indent(str, indentString, depth - existingIndent);
  var prefixToRemove = indentString.repeat(existingIndent - depth);
  return lines(str).map(function (line) {
    return line.slice(prefixToRemove.length);
  }).join("\n");
}

function quote(str) {
  // Example:
  //   string.print("fo\"o") // => "\"fo\\\"o\""
  return '"' + str.replace(/"/g, '\\"') + '"';
}

function print(obj) {
  // Prints Arrays and escapes quotations. See `obj.inspect` for how to
  // completely print / inspect JavaScript data strcutures
  // Example:
  //   string.print([[1,2,3], "string", {foo: 23}])
  //      // => [[1,2,3],"string",[object Object]]
  if (obj && Array.isArray(obj)) return '[' + obj.map(print) + ']';
  if (typeof obj !== "string") return String(obj);
  var result = String(obj);
  result = result.replace(/\n/g, '\\n\\\n');
  result = result.replace(/(")/g, '\\$1');
  result = '\"' + result + '\"';
  return result;
}

function printNested(list, depth) {
  // Example:
  //   string.printNested([1,2,[3,4,5]]) // => "1\n2\n  3\n  4\n  5\n"
  depth = depth || 0;
  return list.reduce(function (s, ea) {
    return s += Array.isArray(ea) ? printNested(ea, depth + 1) : indent(ea + "\n", '  ', depth);
  }, "");
}

function pad(string, n, left) {
  // Examples:
  // pad("Foo", 2) // => "Foo  "
  // pad("Foo", 2, true) // => "  Foo"
  return left ? ' '.repeat(n) + string : string + ' '.repeat(n);
}

function printTable(tableArray, options) {
  // Array -> Object? -> String
  // Takes a 2D Array and prints a table string. Kind of the reverse
  // operation to `tableize`
  // Example:
  //   string.printTable([["aaa", "b", "c"], ["d", "e","f"]])
  //    // =>
  //    // aaa b c
  //    // d   e f
  var columnWidths = [],
      separator = options && options.separator || ' ',
      alignLeftAll = !options || !options.align || options.align === 'left',
      alignRightAll = options && options.align === 'right';
  function alignRight(columnIndex) {
    if (alignLeftAll) return false;
    if (alignRightAll) return true;
    return options && Array.isArray(options.align) && options.align[columnIndex] === 'right';
  }
  tableArray.forEach(function (row) {
    row.forEach(function (cellVal, i) {
      if (columnWidths[i] === undefined) columnWidths[i] = 0;
      columnWidths[i] = Math.max(columnWidths[i], String(cellVal).length);
    });
  });
  return tableArray.map(function (row) {
    return row.map(function (cellVal, i) {
      var cellString = String(cellVal);
      return pad(cellString, columnWidths[i] - cellString.length, alignRight(i));
    }).join(separator);
  }).join('\n');
}

function printTree(rootNode, nodePrinter, childGetter, indent) {
  // Object -> Function -> Function -> Number? -> String
  // A generic function to print a tree representation from a nested data structure.
  // Receives three arguments:
  // - `rootNode` an object representing the root node of the tree
  // - `nodePrinter` is a function that gets a tree node and should return stringified version of it
  // - `childGetter` is a function that gets a tree node and should return a list of child nodes
  // Example:
  // var root = {name: "a", subs: [{name: "b", subs: [{name: "c"}]}, {name: "d"}]};
  // string.printTree(root, function(n) { return n.name; }, function(n) { return n.subs; });
  // // =>
  // // a
  // // |-b
  // // | \-c
  // // \-d

  var nodeList = [];
  indent = indent || '  ';
  iterator(0, 0, rootNode);
  return nodeList.join('\n');
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function iterator(depth, index, node) {
    // ignore-in-doc
    // 1. Create stringified representation of node
    nodeList[index] = indent.repeat(depth) + nodePrinter(node, depth);
    var children = childGetter(node, depth),
        childIndex = index + 1;
    if (!children || !children.length) return childIndex;
    // 2. If there are children then assemble those linear inside nodeList
    // The childIndex is the pointer of the current items of childList into
    // nodeList.
    var lastIndex = childIndex,
        lastI = children.length - 1;
    children.forEach(function (ea, i) {
      childIndex = iterator(depth + 1, childIndex, ea);
      // 3. When we have printed the recursive version then augment the
      // printed version of the direct children with horizontal slashes
      // directly in front of the represented representation
      var isLast = lastI === i,
          cs = nodeList[lastIndex].split(''),
          fromSlash = depth * indent.length + 1,
          toSlash = depth * indent.length + indent.length;
      for (var i = fromSlash; i < toSlash; i++) {
        cs[i] = '-';
      }if (isLast) cs[depth * indent.length] = '\\';
      nodeList[lastIndex] = cs.join('');
      // 4. For all children (direct and indirect) except for the
      // last one (itself and all its children) add vertical bars in
      // front of each at position of the current nodes depth. This
      // makes is much easier to see which child node belongs to which
      // parent
      if (!isLast) nodeList.slice(lastIndex, childIndex).forEach(function (ea, i) {
        var cs2 = ea.split('');
        cs2[depth * indent.length] = '|';
        nodeList[lastIndex + i] = cs2.join('');
      });
      lastIndex = childIndex;
    });
    return childIndex;
  }
}

function toArray$1(s) {
  // Example:
  // string.toArray("fooo") // => ["f","o","o","o"]
  return s.split('');
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// parsing strings into other entities
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function lines(str) {
  // Example: string.lines("foo\nbar\n\rbaz") // => ["foo","bar","baz"]
  return str.split(/\n\r?/);
}

function paragraphs(string, options) {
  // Examples:
  // var text = "Hello, this is a pretty long sentence\nthat even includes new lines."
  //         + "\n\n\nThis is a sentence in  a new paragraph.";
  // string.paragraphs(text) // => [
  //   // "Hello, this is a pretty long sentence\nthat even includes new lines.",
  //   // "This is a sentence in  a new paragraph."]
  // string.paragraphs(text, {keepEmptyLines: true}) // => [
  //   // "Hello, this is a pretty long sentence\n that even includes new lines.",
  //   // "\n ",
  //   // "This is a sentence in  a new paragraph."]
  var sep = options ? options.sep : '\n\n';
  if (!options || !options.keepEmptyLines) return string.split(new RegExp(sep + '+'));
  function isWhiteSpace(s) {
    return (/^\s*$/.test(s)
    );
  }
  return string.split('\n').concat('').reduce(function (parasAndLast, line) {
    var paras = parasAndLast[0],
        last$$1 = parasAndLast[1];
    if (isWhiteSpace(last$$1) === isWhiteSpace(line)) {
      last$$1 += '\n' + line;
    } else {
      last$$1.length && paras.push(last$$1);last$$1 = line;
    }
    return [paras, last$$1];
  }, [[], ''])[0];
}

function nonEmptyLines(str) {
  // Example: string.nonEmptyLines("foo\n\nbar\n") // => ["foo","bar"]
  return lines(str).compact();
}

function tokens(str, regex) {
  // Example:
  // string.tokens(' a b c') => ['a', 'b', 'c']
  return str.split(regex || /\s+/).filter(function (tok) {
    return !/^\s*$/.test(tok);
  });
}

function tableize(s, options) {
  // String -> Object? -> Array
  // Takes a String representing a "table" and parses it into a 2D-Array (as
  // accepted by the `collection.Grid` methods or `string.printTable`)
  // ```js
  // options = {
  //     convertTypes: BOOLEAN, // automatically convert to Numbers, Dates, ...?
  //     cellSplitter: REGEXP // how to recognize "cells", by default just spaces
  // }
  // ```
  // Examples:
  // string.tableize('a b c\nd e f')
  // // => [["a","b","c"],["d","e","f"]]
  // // can also parse csv like
  // var csv = '"Symbol","Name","LastSale",\n'
  //         + '"FLWS","1-800 FLOWERS.COM, Inc.","5.65",\n'
  //         + '"FCTY","1st Century Bancshares, Inc","5.65",'
  // string.tableize(csv, {cellSplitter: /^\s*"|","|",?\s*$/g})
  // // => [["Symbol","Name","LastSale"],
  // //     ["FLWS","1-800 FLOWERS.COM, Inc.",5.65],
  // //     ["FCTY","1st Century Bancshares, Inc",5.65]]

  options = options || {};
  var splitter = options.cellSplitter || /\s+/,
      emptyStringRe = /^\s*$/,
      convertTypes = options.hasOwnProperty('convertTypes') ? !!options.convertTypes : true,
      _lines = lines(s),
      table = [];
  for (var i = 0; i < _lines.length; i++) {
    var _tokens = tokens(_lines[i], splitter);
    if (convertTypes) {
      _tokens = _tokens.map(function (tok) {
        if (tok.match(emptyStringRe)) return tok;
        var num = Number(tok);
        if (!isNaN(num)) return num;
        var date = new Date(tok);
        if (!isNaN(+date)) return date;
        return tok.trim();
      });
    }
    if (_tokens.length > 0) table.push(_tokens);
  }
  return table;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// (un)escape / encoding / decoding
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function unescapeCharacterEntities(s) {
  // Converts [character entities](http://dev.w3.org/html5/html-author/charref)
  // into utf-8 strings
  // Example:
  //   string.unescapeCharacterEntities("foo &amp;&amp; bar") // => "foo && bar"
  if (typeof document === 'undefined') throw new Error("Cannot unescapeCharacterEntities");
  var div = document.createElement('div');
  div.innerHTML = s;
  return div.textContent;
}

function toQueryParams(s, separator) {
  // Example:
  // string.toQueryParams("http://example.com?foo=23&bar=test")
  //   // => {bar: "test", foo: "23"}
  var match = s.trim().match(/([^?#]*)(#.*)?$/);
  if (!match) return {};

  var hash = match[1].split(separator || '&').inject({}, function (hash, pair) {
    if ((pair = pair.split('='))[0]) {
      var key = decodeURIComponent(pair.shift());
      var value = pair.length > 1 ? pair.join('=') : pair[0];
      if (value != undefined) value = decodeURIComponent(value);

      if (key in hash) {
        if (!Array.isArray(hash[key])) hash[key] = [hash[key]];
        hash[key].push(value);
      } else hash[key] = value;
    }
    return hash;
  });
  return hash;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-
// file system path support
// -=-=-=-=-=-=-=-=-=-=-=-=-
var pathDotRe = /\/\.\//g;
var pathDoubleDotRe = /\/[^\/]+\/\.\./;
var pathDoubleSlashRe = /(^|[^:])[\/]+/g;
var urlStartRe = /^[a-z0-9-_\.]+:\/\//;
function normalizePath$1(pathString) {
  var urlStartMatch = pathString.match(urlStartRe),
      urlStart = urlStartMatch ? urlStartMatch[0] : null,
      result = urlStart ? pathString.slice(urlStart.length) : pathString;
  // /foo/../bar --> /bar
  do {
    pathString = result;
    result = pathString.replace(pathDoubleDotRe, '');
  } while (result != pathString);
  // foo//bar --> foo/bar
  result = result.replace(pathDoubleSlashRe, '$1/');
  // foo/./bar --> foo/bar
  result = result.replace(pathDotRe, '/');
  if (urlStart) result = urlStart + result;
  return result;
}

function joinPath() /*paths*/{
  // Joins the strings passed as paramters together so that ea string is
  // connected via a single "/".
  // Example:
  // string.joinPath("foo", "bar") // => "foo/bar";
  return normalizePath$1(Array.prototype.slice.call(arguments).reduce(function (path, ea) {
    return typeof ea === "string" ? path.replace(/\/*$/, "") + "/" + ea.replace(/^\/*/, "") : path;
  }));
}

// -=-=-=-=-=-=-=-=-
// ids and hashing
// -=-=-=-=-=-=-=-=-
var newUUIDTemplate = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
var newUUIDRe = /[xy]/g;
var newUUIDReplacer = function newUUIDReplacer(c) {
  var r = Math.random() * 16 | 0,
      v = c == 'x' ? r : r & 0x3 | 0x8;
  return v.toString(16);
};

function newUUID() {
  // Example:
  //   newUUID() // => "3B3E74D0-85EA-45F2-901C-23ECF3EAB9FB"
  return newUUIDTemplate.replace(newUUIDRe, newUUIDReplacer).toUpperCase();
}

function createDataURI(content, mimeType) {
  // String -> String -> String
  // Takes some string representing content and a mime type.
  // For a list of mime types see: [http://www.iana.org/assignments/media-types/media-types.xhtml]()
  // More about data URIs: [https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs]()
  // Example:
  //   window.open(string.createDataURI('<h1>test</h1>', 'text/html'));
  mimeType = mimeType || "text/plain";
  return "data:" + mimeType + ";base64," + btoa(content);
}

function hashCode(s) {
  // [http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/]()
  // Example: string.hashCode("foo") // => 101574
  var hash = 0,
      len = s.length;
  if (len == 0) return hash;
  for (var i = 0; i < len; i++) {
    var c = s.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function md5(string) {
  // © Joseph Myers [http://www.myersdaily.org/joseph/javascript/md5-text.html]()
  // Example:
  //   string.md5("foo") // => "acbd18db4cc2f85cedef654fccc4a4d8"

  /* ignore-in-doc
  this function is much faster,
  so if possible we use it. Some IEs
  are the only ones I know of that
  need the idiotic second function,
  generated by an if clause.  */
  // var add32 = hex(md51("hello")) === "5d41402abc4b2a76b9719d911017c592" ?
  //   function add32(a, b) { return (a + b) & 0xFFFFFFFF; } :
  var add32 = function add32(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF),
        msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return msw << 16 | lsw & 0xFFFF;
  };

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32(a << s | a >>> 32 - s, b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn(b & c | ~b & d, a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn(b & d | c & ~d, a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  function md5cycle(x, k) {
    var a = x[0],
        b = x[1],
        c = x[2],
        d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function md51(s) {
    var n = s.length,
        state = [1732584193, -271733879, -1732584194, 271733878],
        i;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        sl = s.length;
    for (i = 0; i < sl; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
    }tail[i >> 2] |= 0x80 << (i % 4 << 3);
    if (i > 55) {
      md5cycle(state, tail);
      i = 16;
      while (i--) {
        tail[i] = 0;
      }
      //			for (i=0; i<16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  /* ignore-in-doc
   * there needs to be support for Unicode here,
   * unless we pretend that we can redefine the MD-5
   * algorithm for multi-byte characters (perhaps
   * by adding every four 16-bit characters and
   * shortening the sum to 32 bits). Otherwise
   * I suggest performing MD-5 as if every character
   * was two bytes--e.g., 0040 0025 = @%--but then
   * how will an ordinary MD-5 sum be matched?
   * There is no way to standardize text to something
   * like UTF-8 before transformation; speed cost is
   * utterly prohibitive. The JavaScript standard
   * itself needs to look at this: it should start
   * providing access to strings as preformed UTF-8
   * 8-bit unsigned value arrays.
   */
  function md5blk(s) {
    // ignore-in-doc
    /* I figured global was faster.   */
    var md5blks = [],
        i; /* Andy King said do it this way. */
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  var hex_chr = '0123456789abcdef'.split('');

  function rhex(n) {
    var s = '',
        j = 0;
    for (; j < 4; j++) {
      s += hex_chr[n >> j * 8 + 4 & 0x0F] + hex_chr[n >> j * 8 & 0x0F];
    }return s;
  }

  function hex(x) {
    var l = x.length;
    for (var i = 0; i < l; i++) {
      x[i] = rhex(x[i]);
    }return x.join('');
  }

  return hex(md51(string));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-
// matching strings / regexps
// -=-=-=-=-=-=-=-=-=-=-=-=-=-

function reMatches$$1(string, re) {
  // Different to the native `match` function this method returns an object
  // with `start`, `end`, and `match` fields
  // Example:
  //   string.reMatches("Hello World", /o/g)
  //   // => [{start: 4, end: 5, match: "o"},{start: 7, end: 8, match: "o"}]
  var matches = [];
  string.replace(re, function (match, idx) {
    matches.push({ match: match, start: idx, end: idx + match.length });
  });
  return matches;
}

function stringMatch(s, patternString, options) {
  // returns `{matched: true}` if success otherwise
  // `{matched: false, error: EXPLANATION, pattern: STRING|RE, pos: NUMBER}`
  // Example:
  //   string.stringMatch("foo 123 bar", "foo __/[0-9]+/__ bar") // => {matched: true}
  //   string.stringMatch("foo aaa bar", "foo __/[0-9]+/__ bar")
  //     // => {
  //     //   error: "foo <--UNMATCHED-->aaa bar",
  //     //   matched: false,
  //     //   pattern: /[0-9]+/,
  //     //   pos: 4
  //     // }
  options = options || {};
  if (!!options.normalizeWhiteSpace) s = s.replace(/\s+/g, ' ');
  if (!!options.ignoreIndent) {
    s = s.replace(/^\s+/gm, '');
    patternString = patternString.replace(/^\s+/gm, '');
  }
  return s == patternString ? { matched: true } : embeddedReMatch(s, patternString);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function splitInThree(string, start, end, startGap, endGap) {
    // ignore-in-doc
    // split string at start and end
    // return (0, start), (start, end), (end, ...)
    startGap = startGap || 0;endGap = endGap || 0;
    return [string.slice(0, start), string.slice(start + startGap, end - endGap), string.slice(end)];
  }

  function matchStringForward(s, pattern) {
    // ignore-in-doc
    // try to match pattern at beginning of string. if matched, return
    // result object with {
    //   match: STRING,
    //   REST: STRING -- remaining string after pattern was consumed
    // }
    if (pattern.constructor !== RegExp) {
      var idx = s.indexOf(pattern);
      if (idx === 0) return { match: pattern, rest: s.slice(pattern.length)
        // no match
      };for (var i = 0; i < pattern.length; i++) {
        // figure out where we failed
        if (pattern[i] != s[i]) return { match: null, pos: i };
      }return { match: null };
    }
    var matches = reMatches$$1(s, pattern);
    // show(matches)
    // show(string.slice(matches[0].end));
    return !matches || !matches.length || matches[0].start !== 0 ? { match: null } : { match: matches[0].match, rest: s.slice(matches[0].end) };
  }

  function matchStringForwardWithAllPatterns(s, patterns) {
    // ignore-in-doc
    // like matchStringForward, just apply list of patterns
    var pos = 0;
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i],
          result = matchStringForward(s, p);
      if (!result.match) return { matched: false, pos: pos + (result.pos || 0), pattern: p };
      pos += result.match.length;
      s = result.rest;
    }
    return s.length ? { matched: false, pos: pos } : { matched: true };
  }

  function splitIntoPatterns(matcher) {
    var starts = reMatches$$1(matcher, /__\//g),
        ends = reMatches$$1(matcher, /\/__/g);
    if (starts.length !== ends.length) {
      throw new Error("pattern invalid: " + matcher + " cannot be split into __/.../__ embedded RegExps" + "\nstarts: " + JSON.stringify(starts) + '\nvs ends:\n' + JSON.stringify(ends));
    }
    var consumed = 0;
    return starts.reduce(function (patterns, start, i) {
      var end = ends[i];
      var matcher = patterns.pop();
      var splitted = splitInThree(matcher, start.start - consumed, end.end - consumed, 3, 3);
      if (splitted[0].length) {
        patterns.push(splitted[0]);
        consumed += splitted[0].length;
      }
      try {
        if (splitted[1].length) {
          patterns.push(new RegExp(splitted[1]));
          consumed += splitted[1].length + 3 + 3;
        }
      } catch (e) {
        throw new Error("Cannot create pattern re from: " + inspect(splitted));
      }
      if (splitted[2].length) {
        patterns.push(splitted[2]);
      }
      return patterns;
    }, [matcher]);
  }

  function embeddedReMatch(s, patternString) {
    // ignore-in-doc
    // the main match func
    var patterns = splitIntoPatterns(patternString);
    var result = matchStringForwardWithAllPatterns(s, patterns);
    if (result.matched) return result;
    result.error = s.slice(0, result.pos) + '<--UNMATCHED-->' + s.slice(result.pos);
    return result;
  }
}

function peekRight(s, start, needle) {
  // Finds the next occurence of `needle` (String or RegExp). Returns delta
  // index.
  // Example:
  // peekRight("Hello World", 0, /o/g) // => 4
  // peekRight("Hello World", 5, /o/) // => 2
  s = s.slice(start);
  if (typeof needle === 'string') {
    var idx = s.indexOf(needle);
    return idx === -1 ? null : idx + start;
  } else if (needle.constructor === RegExp) {
    var matches = reMatches$$1(s, needle);
    return matches[0] ? matches[0].start : null;
  }
  return null;
}

function peekLeft(s, start, needle) {
  // Similar to `peekRight`
  s = s.slice(0, start);
  if (typeof needle === 'string') {
    var idx = s.lastIndexOf(needle);
    return idx === -1 ? null : idx;
  } else if (needle.constructor === RegExp) {
    var matches = reMatches$$1(s, needle);
    return last(matches) ? last(matches).start : null;
  }
  return null;
}

function lineIndexComputer(s) {
  // String -> Function
  // For converting character positions to line numbers.
  // Returns a function accepting char positions. If the char pos is outside
  // of the line ranges -1 is returned.
  // Example:
  // var idxComp = lineIndexComputer("Hello\nWorld\n\nfoo");
  // idxComp(3) // => 0 (index 3 is "l")
  // idxComp(6) // => 1 (index 6 is "W")
  // idxComp(12) // => 2 (index 12 is "\n")

  // ignore-in-doc
  // line ranges: list of numbers, each line has two entries:
  // i -> start of line, i+1 -> end of line
  var _lineRanges = lineRanges(s);
  // ignore-in-doc
  // FIXME, this is O(n). Make cumputation more efficient, binary lookup?
  return function (pos) {
    for (var line = 0; line < _lineRanges.length; line++) {
      var lineRange = _lineRanges[line];
      if (pos >= lineRange[0] && pos < lineRange[1]) return line;
    }
    return -1;
  };
}

function lineNumberToIndexesComputer(s) {
  // String -> Function
  // For converting line numbers to [startIndex, endIndex]
  // Example:
  // var idxComp = lineNumberToIndexesComputer("Hello\nWorld\n\nfoo");
  // idxComp(1) // => [6,12]
  return function (lineNo) {
    return lineRanges(s)[lineNo];
  };
}

function lineRanges(s) {
  var from$$1 = 0,
      to = 0,
      linesOfS = lines(s),
      result = [];
  for (var i = 0; i < linesOfS.length; i++) {
    var line = linesOfS[i];
    to = from$$1 + line.length + 1;
    result.push([from$$1, to]);
    from$$1 = to;
  }
  return result;
}

function findLineWithIndexInLineRanges(lineRanges, idx) {
  // given a list of `lineRanges` (produced by
  // `livley.lang.string.lineRanges(string)`) like lineRanges = [[0, 12], [12, 33]]
  // and an string index `idx` into `string`, find the line no (the index into
  // `lineRanges`) that includes idx.  The index intervals include start and exclude end:
  // Example:
  // findLineWithIndex2(lineRanges, 2); // => 0
  // findLineWithIndex2(lineRanges, 12); // => 1
  // findLineWithIndex2(lineRanges, 33); // => 1
  // findLineWithIndex2(lineRanges, 34); // => -1
  // findLineWithIndex2(lineRanges, -4); // => -1
  var nRows = lineRanges.length;
  if (nRows === 0) return -1;
  // let currentRow = Math.floor(nRows/2), lastRow = nRows;
  var startRow = 0,
      endRow = nRows;
  while (true) {
    var middle = startRow + Math.floor((endRow - startRow) / 2),
        _lineRanges$middle = slicedToArray(lineRanges[middle], 2),
        from$$1 = _lineRanges$middle[0],
        to = _lineRanges$middle[1];

    if (idx < from$$1) {
      if (middle === 0) return -1;
      endRow = middle;
      continue;
    }
    if (idx > to) {
      startRow = middle;continue;
    }
    return middle;
  }
  return -1;
}

function regexIndexOf(string, regex) {
  var startpos = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

  var indexOf = this.substring(startpos || 0).search(regex);
  return indexOf >= 0 ? indexOf + (startpos || 0) : indexOf;
}

function regexLastIndexOf(string, regex) {
  var startpos = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : string.length;

  regex = regex.global ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
  var stringToWorkWith = this.substring(0, startpos + 1),
      lastIndexOf = -1,
      nextStop = 0,
      result;
  while ((result = regex.exec(stringToWorkWith)) != null) {
    lastIndexOf = result.index;
    regex.lastIndex = ++nextStop;
  }
  return lastIndexOf;
}

// -=-=-=-=-
// diffing
// -=-=-=-=-

function diff(s1, s2) {
  if (typeof JsDiff === "undefined") return 'diff not supported';
  return JsDiff.convertChangesToXML(JsDiff.diffWordsWithSpace(s1, s2));
}

// -=-=-=-=-
// testing
// -=-=-=-=-

function empty(s) {
  // show-in-doc
  return s == '';
}

var includes$$1 = features.includes ? function (s, pattern) {
  return s.includes(pattern);
} : function (s, pattern) {
  // Example:
  // include("fooo!", "oo") // => true
  return s.indexOf(pattern) > -1;
};

var include$$1 = includes$$1;

var startsWith = features.startsWith ? function (s, pattern) {
  return s.startsWith(pattern);
} : function (s, pattern) {
  // Example:
  // startsWith("fooo!", "foo") // => true
  return s.indexOf(pattern) === 0;
};

function startsWithVowel(s) {
  // show-in-doc
  var c = s[0];
  return c === 'A' || c === 'E' || c === 'I' || c === 'O' || c === 'U' || c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u' || false;
}

var endsWith = features.endsWith ? function (s, pattern) {
  return s.endsWith(pattern);
} : function (s, pattern) {
  // Example:
  // endsWith("fooo!", "o!") // => true
  var d = s.length - pattern.length;
  return d >= 0 && s.lastIndexOf(pattern) === d;
};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// string conversion and manipulation
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function withDecimalPrecision(str, precision) {
  // String -> Number -> String
  // Example: withDecimalPrecision("1.12345678", 3) // => "1.123"
  var floatValue = parseFloat(str);
  return isNaN(floatValue) ? str : floatValue.toFixed(precision);
}

function capitalize(s) {
  // Example:
  // capitalize("foo bar") // => "Foo bar"
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function camelCaseString(s) {
  // Spaces to camels, including first char
  // Example: camelCaseString("foo bar baz") // => "FooBarBaz"
  return s.split(" ").invoke('capitalize').join("");
}

function camelize(s) {
  // Dashes to camels, excluding first char
  // Example: camelize("foo-bar-baz") // => "fooBarBaz"
  var parts = s.split('-'),
      len = parts.length;
  if (len == 1) return parts[0];

  var camelized = s.charAt(0) == '-' ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1) : parts[0];
  for (var i = 1; i < len; i++) {
    camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
  }return camelized;
}

function truncate(s, length, truncation) {
  // Enforces that s is not more then `length` characters long.
  // Example:
  // truncate("123456789", 5) // => "12..."
  length = length || 30;
  truncation = truncation === undefined ? '...' : truncation;
  return s.length > length ? s.slice(0, length - truncation.length) + truncation : String(s);
}

function truncateLeft(s, length, truncation) {
  // Enforces that s is not more then `length` characters long.
  // Example:
  // truncate("123456789", 5) // => "12..."
  length = length || 30;
  truncation = truncation === undefined ? '...' : truncation;
  return s.length > length ? truncation + s.slice(-length) : String(s);
}

function regExpEscape(s) {
  // For creating RegExps from strings and not worrying about proper escaping
  // of RegExp special characters to literally match those.
  // Example:
  // var re = new RegExp(regExpEscape("fooo{20}"));
  // re.test("fooo") // => false
  // re.test("fooo{20}") // => true
  return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1').replace(/\x08/g, '\\x08');
}

function succ(s) {
  // Uses char code.
  // Example:
  // succ("a") // => "b"
  // succ("Z") // => "["
  return s.slice(0, s.length - 1) + String.fromCharCode(s.charCodeAt(s.length - 1) + 1);
}

function digitValue(s) {
  // ignore-in-doc
  return s.charCodeAt(0) - "0".charCodeAt(0);
}

var times = features.repeat ? function (s, count$$1) {
  return s.repeat(count$$1);
} : function (s, count$$1) {
  // Example:
  // string.times("test", 3) // => "testtesttest"
  return count$$1 < 1 ? '' : new Array(count$$1 + 1).join(s);
};

function longestCommonSubstring(a, b) {
  // Example:
  // longestCommonSubstring("bar foo barrr", "hello fooo world");
  // => {indexA: 3, indexB: 5, length: 4, string: " foo"}

  var lcs = [];
  for (var i = 0; i < a.length; i++) {
    lcs[i] = [];
    for (var j = 0; j < b.length; j++) {
      lcs[i][j] = 0;
    }
  }

  // if B is null then LCS of A, B =0
  for (var _i = 0; _i < a.length; _i++) {
    lcs[_i][0] = 0;
  } // fill the rest of the matrix
  for (var _i2 = 1; _i2 < a.length; _i2++) {
    for (var _j = 1; _j < b.length; _j++) {
      lcs[_i2][_j] = a[_i2 - 1] == b[_j - 1] ? lcs[_i2 - 1][_j - 1] + 1 : 0;
    }
  }

  var maxLength = -1,
      indexA = -1,
      indexB = -1;
  for (var _i3 = 0; _i3 < a.length; _i3++) {
    for (var _j2 = 0; _j2 < b.length; _j2++) {
      var length = lcs[_i3][_j2];
      if (maxLength < length) {
        maxLength = length;
        indexA = _i3 - length;
        indexB = _j2 - length;
      }
    }
  }

  return {
    length: maxLength, indexA: indexA, indexB: indexB,
    string: maxLength > 0 ? a.slice(indexA, indexA + maxLength) : ""
  };
}

function applyChange(string, change) {
  // change is of the form
  // `{start: Number, end: Number, lines: [String], action: "insert"|"remove"}`
  if (change.action === "insert") {
    return string.slice(0, change.start) + change.lines.join("\n") + string.slice(change.start);
  } else if (change.action === "remove") {
    return string.slice(0, change.start) + string.slice(change.end);
  }
  return string;
}

function applyChanges(s, changes) {
  return changes.reduce(function (result, change) {
    return applyChange(s, change);
  }, s);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// diffing / comparing

function levenshtein(a, b) {
  // How many edit operations separate string a from b?
  // MIT licensed, https://gist.github.com/andrei-
  // Copyright (c) 2011 Andrei Mackenzie and https://github.com/kigiri
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var tmp, i, j, prev, val, row;
  // swap to save some memory O(min(a,b)) instead of O(a)
  if (a.length > b.length) {
    tmp = a;a = b;b = tmp;
  }

  row = Array(a.length + 1);
  // init the row
  for (i = 0; i <= a.length; i++) {
    row[i] = i;
  } // fill in the rest
  for (i = 1; i <= b.length; i++) {
    prev = i;
    for (j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        val = row[j - 1]; // match
      } else {
        val = Math.min(row[j - 1] + 1, // substitution
        Math.min(prev + 1, // insertion
        row[j] + 1)); // deletion
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}



var string = Object.freeze({
	format: format,
	formatFromArray: formatFromArray,
	indent: indent,
	minIndent: minIndent,
	changeIndent: changeIndent,
	quote: quote,
	print: print,
	printNested: printNested,
	pad: pad,
	printTable: printTable,
	printTree: printTree,
	toArray: toArray$1,
	lines: lines,
	paragraphs: paragraphs,
	nonEmptyLines: nonEmptyLines,
	tokens: tokens,
	tableize: tableize,
	unescapeCharacterEntities: unescapeCharacterEntities,
	toQueryParams: toQueryParams,
	normalizePath: normalizePath$1,
	joinPath: joinPath,
	newUUID: newUUID,
	createDataURI: createDataURI,
	hashCode: hashCode,
	md5: md5,
	reMatches: reMatches$$1,
	stringMatch: stringMatch,
	peekRight: peekRight,
	peekLeft: peekLeft,
	lineIndexComputer: lineIndexComputer,
	lineNumberToIndexesComputer: lineNumberToIndexesComputer,
	findLineWithIndexInLineRanges: findLineWithIndexInLineRanges,
	regexIndexOf: regexIndexOf,
	regexLastIndexOf: regexLastIndexOf,
	lineRanges: lineRanges,
	diff: diff,
	empty: empty,
	includes: includes$$1,
	include: include$$1,
	startsWith: startsWith,
	startsWithVowel: startsWithVowel,
	endsWith: endsWith,
	withDecimalPrecision: withDecimalPrecision,
	capitalize: capitalize,
	camelCaseString: camelCaseString,
	camelize: camelize,
	truncate: truncate,
	truncateLeft: truncateLeft,
	regExpEscape: regExpEscape,
	succ: succ,
	digitValue: digitValue,
	times: times,
	longestCommonSubstring: longestCommonSubstring,
	applyChange: applyChange,
	applyChanges: applyChanges,
	levenshtein: levenshtein
});

/*
 * Utility functions for JS Numbers.
 */

function random(min, max) {
  // random number between (and including) `min` and `max`
  min = min || 0;
  max = max || 100;
  return Math.round(Math.random() * (max - min) + min);
}

var normalRandom = function (mean, stdDev) {
  // returns randomized numbers in a normal distribution that can be
  // controlled ising the `mean` and `stdDev` parameters
  var spare,
      isSpareReady = false;
  return function (mean, stdDev) {
    if (isSpareReady) {
      isSpareReady = false;
      return spare * stdDev + mean;
    } else {
      var u, v, s;
      do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s == 0);
      var mul = Math.sqrt(-2.0 * Math.log(s) / s);
      spare = v * mul;
      isSpareReady = true;
      return mean + stdDev * u * mul;
    }
  };
}();

function randomSmallerInteger(n) {
  return Math.floor(Math.random() * n);
}

function humanReadableByteSize(n) {
  // interpret `n` as byte size and print a more readable version
  // Example:
  //   num.humanReadableByteSize(Math.pow(2,32)) // => "4096MB"
  function round(n) {
    return Math.round(n * 100) / 100;
  }
  if (n < 1000) return String(round(n)) + 'B';
  n = n / 1024;
  if (n < 1000) return String(round(n)) + 'KB';
  n = n / 1024;
  return String(round(n)) + 'MB';
}

function average(numbers) {
  // show-in-doc
  return numbers.reduce(function (sum, n) {
    return sum + n;
  }, 0) / numbers.length;
}

function averageInc(newVal, oldAvg, n) {
  // show-in-doc
  // Example:
  //   let nums = range(0, 10).map(() => random(0, 10))
  //   nums.reduce((avg, ea, i) => avgInc(ea, avg, i+1), 0);
  return (newVal - oldAvg) / n + oldAvg;
}

function median(numbers) {
  // show-in-doc
  var sorted = numbers.sort(function (a, b) {
    return b - a;
  }),
      len = numbers.length;
  return len % 2 === 0 ? 0.5 * (sorted[len / 2 - 1] + sorted[len / 2]) : sorted[(len - 1) / 2];
}

function between(x, a, b, eps) {
  // is `a` <= `x` <= `y`?
  eps = eps || 0;
  var min, max;
  if (a < b) {
    min = a, max = b;
  } else {
    max = a, min = b;
  }
  return max - x + eps >= 0 && min - x - eps <= 0;
}

function sort$1(arr) {
  // numerical sort, JavaScript native `sort` function is lexical by default.
  return arr.sort(function (a, b) {
    return a - b;
  });
}

function parseLength(string, toUnit) {
  // This converts the length value to pixels or the specified `toUnit`.
  // length converstion, supported units are: mm, cm, in, px, pt, pc
  // Examples:
  // num.parseLength('3cm') // => 113.38582677165354
  // num.parseLength('3cm', "in") // => 1.1811023622047243
  toUnit = toUnit || 'px';
  var match = string.match(/([0-9\.]+)\s*(.*)/);
  if (!match || !match[1]) return undefined;
  var length = parseFloat(match[1]),
      fromUnit = match[2];
  return convertLength(length, fromUnit, toUnit);
}

var convertLength = function () {
  // ignore-in-doc
  // num.convertLength(20, 'px', 'pt').roundTo(0.01)
  function toCm(n, unit) {
    // as defined in http://www.w3.org/TR/css3-values/#absolute-lengths
    if (unit === 'cm') return n;else if (unit === 'mm') return n * 0.1;else if (unit === 'in') return n * 2.54;else if (unit === 'px') return n * toCm(1 / 96, 'in');else if (unit === 'pt') return n * toCm(1 / 72, 'in');else if (unit === 'pc') return n * toCm(12, 'pt');
  }
  return function to(length, fromUnit, toUnit) {
    if (fromUnit === toUnit) return length;else if (toUnit === "cm") return toCm(length, fromUnit);else if (fromUnit === "cm") return length / toCm(1, toUnit);else return to(to(length, fromUnit, 'cm'), 'cm', toUnit);
  };
}();

function roundTo(n, quantum) {
  // `quantum` is something like 0.01,

  // for JS rounding to work we need the reciprocal
  quantum = 1 / quantum;
  return Math.round(n * quantum) / quantum;
}

function detent(n, detent, grid, snap) {
  // This function is useful to implement smooth transitions and snapping.
  // Map all values that are within detent/2 of any multiple of grid to
  // that multiple. Otherwise, if snap is true, return self, meaning that
  // the values in the dead zone will never be returned. If snap is
  // false, then expand the range between dead zone so that it covers the
  // range between multiples of the grid, and scale the value by that
  // factor.
  // Examples:
  // // With snapping:
  // num.detent(0.11, 0.2, 0.5, true) // => 0.11
  // num.detent(0.39, 0.2, 0.5, true) // => 0.39
  // num.detent(0.55, 0.2, 0.5, true)  // => 0.5
  // num.detent(0.61, 0.2, 0.5, true)   // => 0.61
  // // Smooth transitions without snapping:
  // num.detent(0.1,  0.2, 0.5) // => 0
  // num.detent(0.11,  0.2, 0.5) // => 0.0166666
  // num.detent(0.34,  0.2, 0.5)  // => 0.4
  // num.detent(0.39,  0.2, 0.5) // => 0.4833334
  // num.detent(0.4,  0.2, 0.5) // => 0.5
  // num.detent(0.6,  0.2, 0.5) // => 0.5
  var r1 = roundTo(n, grid); // Nearest multiple of grid
  if (Math.abs(n - r1) < detent / 2) return r1; // Snap to that multiple...
  if (snap) return n; // ...and return n
  // or compute nearest end of dead zone
  var r2 = n < r1 ? r1 - detent / 2 : r1 + detent / 2;
  // and scale values between dead zones to fill range between multiples
  return r1 + (n - r2) * grid / (grid - detent);
}

function toDegrees(n) {
  // Example:
  // num.toDegrees(Math.PI/2) // => 90
  return n * 180 / Math.PI % 360;
}

function toRadians(n) {
  // Example:
  // num.toRadians(180) // => 3.141592653589793
  return n / 180 * Math.PI;
}

function backoff(attempt) /*ms*/{
  var base = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5;
  var cap = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 30000;

  // exponential backoff function
  // https://www.awsarchitectureblog.com/2015/03/backoff.html
  var temp = Math.min(cap, base * Math.pow(2, attempt)),
      sleep = temp / 2 + Math.round(Math.random() * (temp / 2));
  return Math.min(cap, base + Math.random() * (sleep * 3 - base));
}



var num = Object.freeze({
	random: random,
	normalRandom: normalRandom,
	randomSmallerInteger: randomSmallerInteger,
	humanReadableByteSize: humanReadableByteSize,
	average: average,
	averageInc: averageInc,
	median: median,
	between: between,
	sort: sort$1,
	parseLength: parseLength,
	convertLength: convertLength,
	roundTo: roundTo,
	detent: detent,
	toDegrees: toDegrees,
	toRadians: toRadians,
	backoff: backoff
});

function all$2(object, predicate) {
  // ignore-in-doc
  var a = [];
  for (var name in object) {
    if ((object.__lookupGetter__(name) || typeof object[name] !== 'function') && (predicate ? predicate(name, object) : true)) a.push(name);
  }
  return a;
}

function allOwnPropertiesOrFunctions(obj, predicate) {
  // ignore-in-doc
  return Object.getOwnPropertyNames(obj).reduce(function (result, name) {
    if (predicate ? predicate(obj, name) : true) result.push(name);
    return result;
  }, []);
}

function own$1(object) {
  // ignore-in-doc
  var a = [];
  for (var name in object) {
    if (object.hasOwnProperty(name) && (object.__lookupGetter__(name) || object[name] !== 'function')) a.push(name);
  }
  return a;
}

function forEachOwn(object, func, context) {
  // ignore-in-doc
  var result = [];
  for (var name in object) {
    if (!object.hasOwnProperty(name)) continue;
    var value = object[name];
    if (value !== 'function') {
      result.push(func.call(context || this, name, value));
    }
  }
  return result;
}

function nameFor(object, value) {
  // ignore-in-doc
  for (var name in object) {
    if (object[name] === value) return name;
  }return undefined;
}

function values$1(obj) {
  // ignore-in-doc
  var values = [];
  for (var name in obj) {
    values.push(obj[name]);
  }return values;
}

function ownValues(obj) {
  // ignore-in-doc
  var values = [];
  for (var name in obj) {
    if (obj.hasOwnProperty(name)) values.push(obj[name]);
  }return values;
}

function any$1(obj, predicate) {
  // ignore-in-doc
  for (var name in obj) {
    if (predicate(obj, name)) return true;
  }return false;
}

function allProperties(obj, predicate) {
  // ignore-in-doc
  var result = [];
  for (var name in obj) {
    if (predicate ? predicate(obj, name) : true) result.push(name);
  }return result;
}

function hash(obj) {
  // ignore-in-doc
  // Using the property names of `obj` to generate a hash value.
  return Object.keys(obj).sort().join('').hashCode();
}



var properties = Object.freeze({
	all: all$2,
	allOwnPropertiesOrFunctions: allOwnPropertiesOrFunctions,
	own: own$1,
	forEachOwn: forEachOwn,
	nameFor: nameFor,
	values: values$1,
	ownValues: ownValues,
	any: any$1,
	allProperties: allProperties,
	hash: hash
});

/*
 * Util functions to print and work with JS date objects.
 */

var dateFormat = function setupDateFormat() {

    /*
     * Date Format 1.2.3
     * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
     * MIT license
     *
     * Includes enhancements by Scott Trenda <scott.trenda.net>
     * and Kris Kowal <cixar.com/~kris.kowal/>
     *
     * Accepts a date, a mask, or a date and a mask.
     * Returns a formatted version of the given date.
     * The date defaults to the current date/time.
     * The mask defaults to dateFormat.masks.default.
     */

    // http://blog.stevenlevithan.com/archives/date-time-format

    var dateFormat = function () {
        var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
            timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
            timezoneClip = /[^-+\dA-Z]/g,
            pad = function pad(val, len) {
            val = String(val);
            len = len || 2;
            while (val.length < len) {
                val = "0" + val;
            }return val;
        };

        // Regexes and supporting functions are cached through closure
        return function (date, mask, utc) {
            var dF = dateFormat;

            // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
            if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
                mask = date;
                date = undefined;
            }

            // Passing date through Date applies Date.parse, if necessary
            date = date ? new Date(date) : new Date();
            if (isNaN(date)) throw SyntaxError("invalid date");

            mask = String(dF.masks[mask] || mask || dF.masks["default"]);

            // Allow setting the utc argument via the mask
            if (mask.slice(0, 4) == "UTC:") {
                mask = mask.slice(4);
                utc = true;
            }

            var _ = utc ? "getUTC" : "get",
                d = date[_ + "Date"](),
                D = date[_ + "Day"](),
                m = date[_ + "Month"](),
                y = date[_ + "FullYear"](),
                H = date[_ + "Hours"](),
                M = date[_ + "Minutes"](),
                s = date[_ + "Seconds"](),
                L = date[_ + "Milliseconds"](),
                o = utc ? 0 : date.getTimezoneOffset(),
                flags = {
                d: d,
                dd: pad(d),
                ddd: dF.i18n.dayNames[D],
                dddd: dF.i18n.dayNames[D + 7],
                m: m + 1,
                mm: pad(m + 1),
                mmm: dF.i18n.monthNames[m],
                mmmm: dF.i18n.monthNames[m + 12],
                yy: String(y).slice(2),
                yyyy: y,
                h: H % 12 || 12,
                hh: pad(H % 12 || 12),
                H: H,
                HH: pad(H),
                M: M,
                MM: pad(M),
                s: s,
                ss: pad(s),
                l: pad(L, 3),
                L: pad(L > 99 ? Math.round(L / 10) : L),
                t: H < 12 ? "a" : "p",
                tt: H < 12 ? "am" : "pm",
                T: H < 12 ? "A" : "P",
                TT: H < 12 ? "AM" : "PM",
                Z: utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
                o: (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
                S: ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
            };

            return mask.replace(token, function ($0) {
                return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
            });
        };
    }();

    // Some common format strings
    dateFormat.masks = {
        "default": "ddd mmm dd yyyy HH:MM:ss",
        shortDate: "m/d/yy",
        mediumDate: "mmm d, yyyy",
        longDate: "mmmm d, yyyy",
        fullDate: "dddd, mmmm d, yyyy",
        shortTime: "h:MM TT",
        mediumTime: "h:MM:ss TT",
        longTime: "h:MM:ss TT Z",
        isoDate: "yyyy-mm-dd",
        isoTime: "HH:MM:ss",
        isoDateTime: "yyyy-mm-dd'T'HH:MM:ss",
        isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
    };

    // Internationalization strings
    dateFormat.i18n = {
        dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    };

    return dateFormat;
}(); // end of setupDateFormat


function format$1(date, mask, utc) {
    // Custom date / time stringifier. Provides default masks:
    //
    // Mask           | Pattern
    // ---------------|--------------------------------
    // default        | `"ddd mmm dd yyyy HH:MM:ss"`
    // shortDate      | `"m/d/yy"`
    // mediumDate     | `"mmm d, yyyy"`
    // longDate       | `"mmmm d, yyyy"`
    // fullDate       | `"dddd, mmmm d, yyyy"`
    // shortTime      | `"h:MM TT"`
    // mediumTime     | `"h:MM:ss TT"`
    // longTime       | `"h:MM:ss TT Z"`
    // isoDate        | `"yyyy-mm-dd"`
    // isoTime        | `"HH:MM:ss"`
    // isoDateTime    | `"yyyy-mm-dd'T'HH:MM:ss"`
    // isoUtcDateTime | `"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"`
    //
    // and internationalized strings via `date.format.i18n.dayNames`
    // and `date.format.i18n.dayNames`
    // Examples:
    //   date.format(new Date(), date.format.masks.longTime) // => "7:13:31 PM PDT"
    //   date.format(new Date(), "yyyy/mm/dd") // => "2014/10/09"
    return dateFormat(date, mask, utc);
}

function equals$3(date, otherDate) {
    // show-in-doc
    return otherDate && otherDate instanceof Date && otherDate.getTime() === date.getTime();
}

function relativeTo(date, otherDate) {
    // Prints a human readable difference of two Date objects. The older date
    // goes first.
    // Examples:
    //   var now = new Date();
    //   date.relativeTo(new Date(now-2000), now) // => "2 secs"
    //   date.relativeTo(new Date("10/11/2014"), new Date("10/12/2014")) // => "1 day"
    if (!(otherDate instanceof Date)) return '';
    if (otherDate < date) return '';
    if (otherDate === date) return 'now';
    var minuteString = 'min',
        secondString = 'sec',
        hourString = 'hour',
        dayString = 'day',
        diff = otherDate - date,
        totalSecs = Math.round(diff / 1000),
        secs = totalSecs % 60,
        mins = Math.floor(totalSecs / 60) % 60,
        hours = Math.floor(totalSecs / 60 / 60) % 24,
        days = Math.floor(totalSecs / 60 / 60 / 24),
        parts = [];
    if (days > 0) {
        parts.push(days);
        if (days > 1) dayString += 's';
        parts.push(dayString);
    }
    if (hours > 0 && days < 2) {
        parts.push(hours);
        if (hours > 1) hourString += 's';
        parts.push(hourString);
    }
    if (mins > 0 && hours < 3 && days === 0) {
        parts.push(mins);
        if (mins > 1) minuteString += 's';
        parts.push(minuteString);
    }
    if (secs > 0 && mins < 3 && hours === 0 && days === 0) {
        parts.push(secs);
        if (secs > 1) secondString += 's';
        parts.push(secondString);
    }
    return parts.join(' ');
}



var date = Object.freeze({
	format: format$1,
	equals: equals$3,
	relativeTo: relativeTo
});

/*global require, process, Promise, System*/

/*
 * Methods helping with promises (Promise/A+ model). Not a promise shim.
 */

function promise(obj) {
  // Promise object / function converter
  // Example:
  // promise("foo");
  //   // => Promise({state: "fullfilled", value: "foo"})
  // lively.lang.promise({then: (resolve, reject) => resolve(23)})
  //   // => Promise({state: "fullfilled", value: 23})
  // lively.lang.promise(function(val, thenDo) { thenDo(null, val + 1) })(3)
  //   // => Promise({state: "fullfilled", value: 4})
  return typeof obj === "function" ? promise.convertCallbackFun(obj) : Promise.resolve(obj);
}

function delay$1(ms, resolveVal) {
  // Like `Promise.resolve(resolveVal)` but waits for `ms` milliseconds
  // before resolving
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms, resolveVal);
  });
}

function delayReject(ms, rejectVal) {
  // like `promise.delay` but rejects
  return new Promise(function (_, reject$$1) {
    return setTimeout(reject$$1, ms, rejectVal);
  });
}

function timeout(ms, promise) {
  // Takes a promise and either resolves to the value of the original promise
  // when it succeeds before `ms` milliseconds passed or fails with a timeout
  // error
  return new Promise(function (resolve, reject$$1) {
    var done = false;
    setTimeout(function () {
      return !done && (done = true) && reject$$1(new Error('Promise timed out'));
    }, ms);
    promise.then(function (val) {
      return !done && (done = true) && resolve(val);
    }, function (err) {
      return !done && (done = true) && reject$$1(err);
    });
  });
}

function waitFor$1(ms, tester, timeoutObj) {
  // Tests for a condition calling function `tester` until the result is
  // truthy. Resolves with last return value of `tester`. If `ms` is defined
  // and `ms` milliseconds passed, reject with timeout error
  // if timeoutObj is passed will resolve(!) with this object instead of raise
  // an error
  if (typeof ms === "function") {
    tester = ms;ms = undefined;
  }
  return new Promise(function (resolve, reject$$1) {
    var stopped = false,
        timedout = false,
        timeoutValue = undefined,
        error = undefined,
        value = undefined,
        i = setInterval(function () {
      if (stopped) return clearInterval(i);
      try {
        value = tester();
      } catch (e) {
        error = e;
      }
      if (!value && !error && !timedout) return;
      stopped = true;
      clearInterval(i);
      if (error) return reject$$1(error);
      if (timedout) return typeof timeoutObj === "undefined" ? reject$$1(new Error("timeout")) : resolve(timeoutObj);
      return resolve(value);
    }, 10);
    if (typeof ms === "number") setTimeout(function () {
      return timedout = true;
    }, ms);
  });
}

function deferred() {
  // returns an object
  // `{resolve: FUNCTION, reject: FUNCTION, promise: PROMISE}`
  // that separates the resolve/reject handling from the promise itself
  // Similar to the deprecated `Promise.defer()`
  var resolve,
      reject$$1,
      promise = new Promise(function (_resolve, _reject) {
    resolve = _resolve;reject$$1 = _reject;
  });
  return { resolve: resolve, reject: reject$$1, promise: promise };
}

function convertCallbackFun(func) {
  // Takes a function that accepts a nodejs-style callback function as a last
  // parameter and converts it to a function *not* taking the callback but
  // producing a promise instead. The promise will be resolved with the
  // *first* non-error argument.
  // nodejs callback convention: a function that takes as first parameter an
  // error arg and second+ parameters are the result(s).
  // Example:
  // var fs = require("fs"),
  //     readFile = promise.convertCallbackFun(fs.readFile);
  // readFile("./some-file.txt")
  //   .then(content => console.log(String(content)))
  //   .catch(err => console.error("Could not read file!", err));
  return function promiseGenerator() /*args*/{
    var args = Array.from(arguments),
        self = this;
    return new Promise(function (resolve, reject$$1) {
      args.push(function (err, result) {
        return err ? reject$$1(err) : resolve(result);
      });
      func.apply(self, args);
    });
  };
}

function convertCallbackFunWithManyArgs(func) {
  // like convertCallbackFun but the promise will be resolved with the
  // all non-error arguments wrapped in an array.
  return function promiseGenerator() /*args*/{
    var args = Array.from(arguments),
        self = this;
    return new Promise(function (resolve, reject$$1) {
      args.push(function () /*err + args*/{
        var args = Array.from(arguments),
            err = args.shift();
        return err ? reject$$1(err) : resolve(args);
      });
      func.apply(self, args);
    });
  };
}

function _chainResolveNext(promiseFuncs, prevResult, akku, resolve, reject$$1) {
  var next = promiseFuncs.shift();
  if (!next) resolve(prevResult);else {
    try {
      Promise.resolve(next(prevResult, akku)).then(function (result) {
        return _chainResolveNext(promiseFuncs, result, akku, resolve, reject$$1);
      }).catch(function (err) {
        reject$$1(err);
      });
    } catch (err) {
      reject$$1(err);
    }
  }
}

function chain$1(promiseFuncs) {
  // Similar to Promise.all but takes a list of promise-producing functions
  // (instead of Promises directly) that are run sequentially. Each function
  // gets the result of the previous promise and a shared "state" object passed
  // in. The function should return either a value or a promise. The result of
  // the entire chain call is a promise itself that either resolves to the last
  // returned value or rejects with an error that appeared somewhere in the
  // promise chain. In case of an error the chain stops at that point.
  // Example:
  // lively.lang.promise.chain([
  //   () => Promise.resolve(23),
  //   (prevVal, state) => { state.first = prevVal; return prevVal + 2 },
  //   (prevVal, state) => { state.second = prevVal; return state }
  // ]).then(result => console.log(result));
  // // => prints {first: 23,second: 25}
  return new Promise(function (resolve, reject$$1) {
    return _chainResolveNext(promiseFuncs.slice(), undefined, {}, resolve, reject$$1);
  });
}

function promise_finally(promise, finallyFn) {
  return Promise.resolve(promise).then(function (result) {
    try {
      finallyFn();
    } catch (err) {
      console.error("Error in promise finally: " + err.stack || err);
    }return result;
  }).catch(function (err) {
    try {
      finallyFn();
    } catch (err) {
      console.error("Error in promise finally: " + err.stack || err);
    }throw err;
  });
}

function parallel(promiseGenFns) {
  var parallelLimit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Infinity;

  // Starts functions from promiseGenFns that are expected to return a promise
  // Once `parallelLimit` promises are unresolved at the same time, stops
  // spawning further promises until a running promise resolves

  if (!promiseGenFns.length) return Promise.resolve([]);

  var results = [],
      error = null,
      index = 0,
      left = promiseGenFns.length,
      resolve = void 0,
      reject$$1 = void 0;

  return new Promise(function (res, rej) {
    resolve = function resolve() {
      return res(results);
    };
    reject$$1 = function reject$$1(err) {
      return rej(error = err);
    };
    spawnMore();
  });

  function spawn() {
    parallelLimit--;
    try {
      var i = index++,
          prom = promiseGenFns[i]();
      prom.then(function (result) {
        parallelLimit++;
        results[i] = result;
        if (--left === 0) resolve();else spawnMore();
      }).catch(function (err) {
        return reject$$1(err);
      });
    } catch (err) {
      reject$$1(err);
    }
  }

  function spawnMore() {
    while (!error && left > 0 && index < promiseGenFns.length && parallelLimit > 0) {
      spawn();
    }
  }
}

// FIXME!
Object.assign(promise, {
  delay: delay$1,
  delayReject: delayReject,
  timeout: timeout,
  waitFor: waitFor$1,
  deferred: deferred,
  convertCallbackFun: convertCallbackFun,
  convertCallbackFunWithManyArgs: convertCallbackFunWithManyArgs,
  chain: chain$1,
  "finally": promise_finally,
  parallel: parallel
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-
// js object path accessor
// -=-=-=-=-=-=-=-=-=-=-=-=-=-

// show-in-doc
// A `Path` is an objectified chain of property names (kind of a "complex"
// getter and setter). Path objects can make access and writes into deeply nested
// structures more convenient. `Path` provide "safe" get and set operations and
// can be used for debugging by providing a hook that allows users to find out
// when get/set operations happen.

function Path(p, splitter) {
  if (p instanceof Path) return p;
  if (!(this instanceof Path)) return new Path(p, splitter);
  this.setSplitter(splitter || '.');
  this.fromPath(p);
}

Object.assign(Path.prototype, {

  get isPathAccessor() {
    return true;
  },

  fromPath: function fromPath(path) {
    // ignore-in-doc
    if (typeof path === "string" && path !== '' && path !== this.splitter) {
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
  setSplitter: function setSplitter(splitter) {
    // ignore-in-doc
    if (splitter) this.splitter = splitter;
    return this;
  },
  parts: function parts() {
    /*key names as array*/return this._parts;
  },
  size: function size() {
    /*show-in-doc*/return this._parts.length;
  },
  slice: function slice(n, m) {
    /*show-in-doc*/return Path(this.parts().slice(n, m));
  },
  normalizePath: function normalizePath() {
    // ignore-in-doc
    // FIXME: define normalization
    return this._path;
  },
  isRoot: function isRoot(obj) {
    return this._parts.length === 0;
  },
  isIn: function isIn(obj) {
    // Does the Path resolve to a value when applied to `obj`?
    if (this.isRoot()) return true;
    var parent = this.get(obj, -1);
    return parent && parent.hasOwnProperty(this._parts[this._parts.length - 1]);
  },
  equals: function equals(obj) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path(["foo", 1, "bar", "baz"]);
    // // Path's can be both created via strings or pre-parsed with keys in a list.
    // p1.equals(p2) // => true
    return obj && obj.isPathAccessor && this.parts().equals(obj.parts());
  },
  isParentPathOf: function isParentPathOf(otherPath) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1.bar");
    // p2.isParentPathOf(p1) // => true
    // p1.isParentPathOf(p2) // => false
    otherPath = otherPath && otherPath.isPathAccessor ? otherPath : Path(otherPath);
    var parts = this.parts(),
        otherParts = otherPath.parts();
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] != otherParts[i]) return false;
    }
    return true;
  },
  relativePathTo: function relativePathTo(otherPath) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1");
    // p2.relativePathTo(p1) // => Path(["bar","baz"])
    // p1.relativePathTo(p2) // => undefined
    otherPath = Path(otherPath);
    return this.isParentPathOf(otherPath) ? otherPath.slice(this.size(), otherPath.size()) : undefined;
  },
  del: function del(obj) {
    if (this.isRoot()) return false;
    var parent = obj;
    for (var i = 0; i < this._parts.length - 1; i++) {
      var part = this._parts[i];
      if (parent.hasOwnProperty(part)) {
        parent = parent[part];
      } else return false;
    }
    return delete parent[this._parts[this._parts.length - 1]];
  },
  withParentAndKeyDo: function withParentAndKeyDo(obj, ensure, doFunc) {
    // Deeply resolve path in `obj`, not fully, however, only to the parent
    // element of the last part of path. Take the parent, the key (the last
    // part of path) and pass it to `doFunc`. When `ensure` is true, create
    // objects along path it path does not resolve
    if (this.isRoot()) return doFunc(null, null);
    var parent = obj;
    for (var i = 0; i < this._parts.length - 1; i++) {
      var part = this._parts[i];
      if (parent.hasOwnProperty(part) && (_typeof(parent[part]) === "object" || typeof parent[part] === "function")) {
        parent = parent[part];
      } else if (ensure) {
        parent = parent[part] = {};
      } else {
        return doFunc(null, part);
      }
    }
    return doFunc(parent, this._parts[this._parts.length - 1]);
  },
  set: function set(obj, val, ensure) {
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
    return this.withParentAndKeyDo(obj, ensure, function (parent, key) {
      return parent ? parent[key] = val : undefined;
    });
  },
  defineProperty: function defineProperty(obj, propertySpec, ensure) {
    // like `Path>>set`, however uses Objeect.defineProperty
    return this.withParentAndKeyDo(obj, ensure, function (parent, key) {
      return parent ? Object.defineProperty(parent, key, propertySpec) : undefined;
    });
  },
  get: function get(obj, n) {
    // show-in-doc
    var parts = n ? this._parts.slice(0, n) : this._parts;
    return parts.reduce(function (current, pathPart) {
      return current ? current[pathPart] : current;
    }, obj);
  },
  concat: function concat(p, splitter) {
    // show-in-doc
    return Path(this.parts().concat(Path(p, splitter).parts()));
  },
  toString: function toString() {
    return this.normalizePath();
  },
  serializeExpr: function serializeExpr() {
    // ignore-in-doc
    return 'lively.lang.Path(' + inspect(this.parts()) + ')';
  },
  watch: function watch(options) {
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
    var target = options.target,
        parent = this.get(target, -1),
        propName = this.parts().slice(-1)[0],
        newPropName = 'propertyWatcher$' + propName,
        watcherIsInstalled = parent && parent.hasOwnProperty(newPropName),
        uninstall = options.uninstall,
        haltWhenChanged = options.haltWhenChanged,
        showStack = options.showStack,
        getter = parent.__lookupGetter__(propName),
        setter = parent.__lookupSetter__(propName);
    if (!target || !propName || !parent) return;
    if (uninstall) {
      if (!watcherIsInstalled) return;
      delete parent[propName];
      parent[propName] = parent[newPropName];
      delete parent[newPropName];
      var msg = 'Watcher for ' + parent + '.' + propName + ' uninstalled';
      show(msg);
      return;
    }
    if (watcherIsInstalled) {
      var msg = 'Watcher for ' + parent + '.' + propName + ' already installed';
      show(msg);
      return;
    }
    if (getter || setter) {
      var msg = parent + '["' + propName + '"] is a getter/setter, watching not support';
      console.log(msg);
      if (typeof show === "undefined") show(msg);
      return;
    }
    // observe slots, for debugging
    parent[newPropName] = parent[propName];
    parent.__defineSetter__(propName, function (v) {
      var oldValue = parent[newPropName];
      if (options.onSet) options.onSet(v, oldValue);
      var msg = parent + "." + propName + " changed: " + oldValue + " -> " + v;
      if (showStack) msg += '\n' + (typeof lively !== "undefined" ? lively.printStack() : console.trace());
      if (options.verbose) {
        console.log(msg);
        if (typeof show !== 'undefined') show(msg);
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
    if (typeof show !== 'undefined') show(msg);
  },
  debugFunctionWrapper: function debugFunctionWrapper(options) {
    // ignore-in-doc
    // options = {target, [haltWhenChanged, showStack, verbose, uninstall]}
    var target = options.target,
        parent = this.get(target, -1),
        funcName = this.parts().slice(-1)[0],
        uninstall = options.uninstall,
        haltWhenChanged = options.haltWhenChanged === undefined ? true : options.haltWhenChanged,
        showStack = options.showStack,
        func = parent && funcName && parent[funcName],
        debuggerInstalled = func && func.isDebugFunctionWrapper;
    if (!target || !funcName || !func || !parent) return;
    if (uninstall) {
      if (!debuggerInstalled) return;
      parent[funcName] = parent[funcName].debugTargetFunction;
      var msg = 'Uninstalled debugFunctionWrapper for ' + parent + '.' + funcName;
      console.log(msg);
      if (typeof show !== 'undefined') show(msg);
      show(msg);
      return;
    }
    if (debuggerInstalled) {
      var msg = 'debugFunctionWrapper for ' + parent + '.' + funcName + ' already installed';
      console.log(msg);
      if (typeof show !== 'undefined') show(msg);
      return;
    }
    var debugFunc = parent[funcName] = func.wrap(function (proceed) {
      var args = Array.from(arguments);
      if (haltWhenChanged) debugger;
      if (showStack) show(lively.printStack());
      if (options.verbose) show(funcName + ' called');
      return args.shift().apply(parent, args);
    });
    debugFunc.isDebugFunctionWrapper = true;
    debugFunc.debugTargetFunction = func;
    var msg = 'debugFunctionWrapper for ' + parent + '.' + funcName + ' installed';
    console.log(msg);
    if (typeof show !== 'undefined') show(msg);
  }
});

/*
Computation over graphs. Unless otherwise specified a graph is a simple JS
object whose properties are interpreted as nodes that refer to arrays whose
elements describe edges. Example:

```js
var testGraph = {
  "a": ["b", "c"],
  "b": ["c", "d", "e", "f"],
  "d": ["c", "f"],
  "e": ["a", "f"],
  "f": []
}
```
*/

// show-in-doc
function clone$2(graph) {
  // return a copy of graph map
  var cloned = {};
  for (var id in graph) {
    cloned[id] = graph[id].slice();
  }return cloned;
}

function without$1(graph, ids) {
  // return a copy of graph map with ids removed
  var cloned = {};
  for (var id in graph) {
    if (ids.includes(id)) continue;
    cloned[id] = [];
    var refs = graph[id];
    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      if (!ids.includes(ref)) cloned[id].push(ref);
    }
  }
  return cloned;
}

function hull(g, id) {
  var ignoredKeyList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var maxDepth = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Infinity;

  // Takes a graph in object format and a start id and then traverses the
  // graph and gathers all nodes that can be reached from that start id.
  // Returns a list of those nodes.
  // Optionally use `ignore` list to filter out certain nodes that shouldn't
  // be considered and maxDepth to stop early. By default a maxDepth of 20 is
  // used.
  // Example:
  // var testGraph = {
  // "a": ["b", "c"],
  // "b": ["c", "d", "e", "f"],
  // "d": ["c", "f"],
  // "e": ["a", "f"],
  // "f": []
  // }
  // hull(testGraph, "d") // => ["c", "f"]
  // hull(testGraph, "e") // => ['a', 'f', 'b', 'c', 'd', 'e']
  // hull(testGraph, "e", ["b"]) // => ["a", "f", "c"]

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // below is an optimized variant, the functional but slow version:
  // return uniq(
  //         flatten(
  //           values(
  //             subgraphReachableBy(
  //               graphMap, id, ignore, maxDepth))));

  if (!Array.isArray(g[id])) return [];

  var hull = [],
      visited = {};

  var ignoredKeys = {};
  for (var i = 0; i < ignoredKeyList.length; i++) {
    ignoredKeys[ignoredKeyList[i]] = true;
  }var toVisitList = g[id].slice(),
      toVisitMapAndDistFromRoot = {};
  for (var _i = toVisitList.length; _i--;) {
    var key = toVisitList[_i];
    if (key in ignoredKeys) toVisitList.splice(_i, 1);else toVisitMapAndDistFromRoot[key] = 1;
  }

  if (ignoredKeyList) while (true) {
    if (toVisitList.length === 0) break;
    for (var _i2 = 0; _i2 < toVisitList.length; _i2++) {
      var _key = toVisitList.shift();
      if (_key in visited || _key in ignoredKeys) continue;
      var dist = toVisitMapAndDistFromRoot[_key] || 0;
      if (dist > maxDepth) continue;
      hull.push(_key);
      visited[_key] = true;
      var refs = g[_key];
      if (!refs) continue;
      for (var j = 0; j < refs.length; j++) {
        var refKey = refs[j];
        if (refKey in visited || refKey in toVisitMapAndDistFromRoot) continue;
        toVisitMapAndDistFromRoot[refKey] = dist + 1;
        toVisitList.push(refKey);
      }
    }
  }
  return hull;
}

function subgraphReachableBy(graphMap, startId, ignore) {
  var maxDepth = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Infinity;

  // show-in-doc
  // Like hull but returns subgraph map of `graphMap`
  // Example:
  // subgraphReachableBy(testGraph, "e", [], 2);
  // // => {e: [ 'a', 'f' ], a: [ 'b', 'c' ], f: []}
  if (ignore) graphMap = without$1(graphMap, ignore);
  var ids = [startId],
      step = 0,
      subgraph = {};
  while (ids.length && step++ < maxDepth) {
    var id = ids.shift();
    if (subgraph[id]) continue;
    var newIds = graphMap[id] || [];
    subgraph[id] = newIds;
    ids.push.apply(ids, toConsumableArray(newIds));
  }
  return subgraph;
}

function invert(g) {
  // inverts the references of graph object `g`.
  // Example:
  // invert({a: ["b"], b: ["a", "c"]})
  //   // => {a: ["b"], b: ["a"], c: ["b"]}
  var inverted = {};
  for (var key in g) {
    var refs = g[key];
    for (var i = 0; i < refs.length; i++) {
      var key2 = refs[i];
      if (!inverted[key2]) inverted[key2] = [key];else inverted[key2].push(key);
    }
  }
  return inverted;
}

function sortByReference(depGraph, startNode) {
  // Sorts graph into an array of arrays. Each "bucket" contains the graph
  // nodes that have no other incoming nodes than those already visited. This
  // means, we start with the leaf nodes and then walk our way up.
  // This is useful for computing how to traverse a dependency graph: You get
  // a sorted list of dependencies that also allows circular references.
  // Example:
  // var depGraph = {a: ["b", "c"], b: ["c"], c: ["b"]};
  // sortByReference(depGraph, "a");
  // // => [["c"], ["b"], ["a"]]


  // establish unique list of keys
  var remaining = [],
      remainingSeen = {},
      uniqDepGraph = {},
      inverseDepGraph = {};
  for (var _key2 in depGraph) {
    if (!remainingSeen.hasOwnProperty(_key2)) {
      remainingSeen[_key2] = true;
      remaining.push(_key2);
    }
    var deps = depGraph[_key2],
        uniqDeps = {};
    if (deps) {
      uniqDepGraph[_key2] = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = deps[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var dep = _step.value;

          if (uniqDeps.hasOwnProperty(dep) || _key2 === dep) continue;
          var inverse = inverseDepGraph[dep] || (inverseDepGraph[dep] = []);
          if (!inverse.includes(_key2)) inverse.push(_key2);
          uniqDeps[dep] = true;
          uniqDepGraph[_key2].push(dep);
          if (!remainingSeen.hasOwnProperty(dep)) {
            remainingSeen[dep] = true;
            remaining.push(dep);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }

  // for each iteration find the keys with the minimum number of dependencies
  // and add them to the result group list
  var groups = [];
  while (remaining.length) {
    var minDepCount = Infinity,
        minKeys = [],
        minKeyIndexes = [],
        affectedKeys = [];
    for (var i = 0; i < remaining.length; i++) {
      var key = remaining[i];
      var _deps = uniqDepGraph[key] || [];
      if (_deps.length > minDepCount) continue;

      // if (deps.length === minDepCount && !minKeys.some(ea => deps.includes(ea))) {
      if (_deps.length === minDepCount && !_deps.some(function (ea) {
        return minKeys.includes(ea);
      })) {
        var _affectedKeys;

        minKeys.push(key);
        minKeyIndexes.push(i);
        (_affectedKeys = affectedKeys).push.apply(_affectedKeys, toConsumableArray(inverseDepGraph[key] || []));
        continue;
      }
      minDepCount = _deps.length;
      minKeys = [key];
      minKeyIndexes = [i];
      affectedKeys = (inverseDepGraph[key] || []).slice();
    }
    for (var i = minKeyIndexes.length; i--;) {
      var key = remaining[minKeyIndexes[i]];
      inverseDepGraph[key] = [];
      remaining.splice(minKeyIndexes[i], 1);
    }
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = affectedKeys[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var key = _step2.value;

        uniqDepGraph[key] = uniqDepGraph[key].filter(function (ea) {
          return !minKeys.includes(ea);
        });
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    groups.push(minKeys);
  }
  return groups;
}

function reduce$1(doFunc, graph, rootNode, carryOver, ignore, context) {
  // Starts with `rootNode` and visits all (in)directly related nodes, calling
  // `doFunc` at each node. The result of `doFunc` is passed as first
  // argument to the next iterator call. For the first call the value
  // `carryOver` is used.
  // Example:
  // var depGraph = {a: ["b", "c"],b: ["c"]}
  // graphReduce((_, ea, i) => console.log("%s %s", ea, i), depGraph, "a")

  var visitedNodes = ignore || [],
      index = 0;
  iterator(rootNode);
  return carryOver;

  function iterator(currentNode) {
    if (visitedNodes.indexOf(currentNode) > -1) return;
    carryOver = doFunc.call(context, carryOver, currentNode, index++);
    visitedNodes = visitedNodes.concat([currentNode]);
    var next = withoutAll(graph[currentNode] || [], visitedNodes);
    next.forEach(function (ea) {
      return iterator(ea);
    });
  }
}

function random$1() {
  var nKeys = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;

  var g = {},
      keys$$1 = range(1, nKeys).map(String);
  for (var i = 0; i < keys$$1.length; i++) {
    var r = Math.floor(Math.random() * nKeys);
    g[keys$$1[i]] = shuffle(keys$$1).slice(0, r);
  }
  return g;
}



var graph = Object.freeze({
	clone: clone$2,
	without: without$1,
	hull: hull,
	subgraphReachableBy: subgraphReachableBy,
	invert: invert,
	sortByReference: sortByReference,
	reduce: reduce$1,
	random: random$1
});

/*global System, global*/

// show-in-doc
// Intervals are arrays whose first two elements are numbers and the
// first element should be less or equal the second element, see
// [`interval.isInterval`](). This abstraction is useful when working with text
// ranges in rich text, for example.

var GLOBAL$2 = typeof System !== "undefined" ? System.global : typeof window !== 'undefined' ? window : global;

function isInterval(object) {
  // Example:
  // interval.isInterval([1,12]) // => true
  // interval.isInterval([1,12, {property: 23}]) // => true
  // interval.isInterval([1]) // => false
  // interval.isInterval([12, 1]) // => false
  return Array.isArray(object) && object.length >= 2 && object[0] <= object[1];
}

function sort$2(intervals) {
  // Sorts intervals according to rules defined in [`interval.compare`]().
  return intervals.sort(compare);
}

function compare(a, b) {
  // How [`interval.sort`]() compares.
  // We assume that `a[0] <= a[1] and b[0] <= b[1]` according to `isInterval`
  // ```
  // -3: a < b and non-overlapping, e.g [1,2] and [3,4]
  // -2: a < b and intervals border at each other, e.g [1,3] and [3,4]
  // -1: a < b and overlapping, e.g, [1,3] and [2,4] or [1,3] and [1,4]
  //  0: a = b, e.g. [1,2] and [1,2]
  //  1: a > b and overlapping, e.g. [2,4] and [1,3]
  //  2: a > b and share border, e.g [1,4] and [0,1]
  //  3: a > b and non-overlapping, e.g [2,4] and [0,1]
  // ```
  if (a[0] < b[0]) {
    // -3 || -2 || -1
    if (a[1] < b[0]) return -3;
    if (a[1] === b[0]) return -2;
    return -1;
  }
  if (a[0] === b[0]) {
    // -1 || 0 || 1
    if (a[1] === b[1]) return 0;
    return a[1] < b[1] ? -1 : 1;
  }
  // we know a[0] > b[0], 1 || 2 || 3
  return -1 * compare(b, a);
}

function coalesce(interval1, interval2, optMergeCallback) {
  // Turns two interval into one iff compare(interval1, interval2) ∈ [-2,
  // -1,0,1, 2] (see [`inerval.compare`]()).
  // Otherwise returns null. Optionally uses merge function.
  // Examples:
  //   interval.coalesce([1,4], [5,7]) // => null
  //   interval.coalesce([1,2], [1,2]) // => [1,2]
  //   interval.coalesce([1,4], [3,6]) // => [1,6]
  //   interval.coalesce([3,6], [4,5]) // => [3,6]
  var cmpResult = this.compare(interval1, interval2);
  switch (cmpResult) {
    case -3:
    case 3:
      return null;
    case 0:
      optMergeCallback && optMergeCallback(interval1, interval2, interval1);
      return interval1;
    case 2:
    case 1:
      var temp = interval1;interval1 = interval2;interval2 = temp; // swap
    case -2:
    case -1:
      var coalesced = [interval1[0], Math.max(interval1[1], interval2[1])];
      optMergeCallback && optMergeCallback(interval1, interval2, coalesced);
      return coalesced;
    default:
      throw new Error("Interval compare failed");
  }
}

function coalesceOverlapping(intervals, mergeFunc) {
  // Like `coalesce` but accepts an array of intervals.
  // Example:
  //   interval.coalesceOverlapping([[9,10], [1,8], [3, 7], [15, 20], [14, 21]])
  //   // => [[1,8],[9,10],[14,21]]
  var condensed = [],
      len = intervals.length;
  while (len > 0) {
    var ival = intervals.shift();len--;
    for (var i = 0; i < len; i++) {
      var otherInterval = intervals[i],
          coalesced = coalesce(ival, otherInterval, mergeFunc);
      if (coalesced) {
        ival = coalesced;
        intervals.splice(i, 1);
        len--;i--;
      }
    }
    condensed.push(ival);
  }
  return this.sort(condensed);
}

function mergeOverlapping(intervalsA, intervalsB, mergeFunc) {
  var result = [];
  while (intervalsA.length > 0) {
    var intervalA = intervalsA.shift();

    var toMerge = intervalsB.map(function (intervalB) {
      var cmp = compare(intervalA, intervalB);
      return cmp === -1 || cmp === 0 || cmp === 1;
    });

    result.push(mergeFunc(intervalA, toMerge[0]));

    result.push(intervalA);
  }
  return result;
}

function intervalsInRangeDo(start, end, intervals, iterator, mergeFunc, context) {
  // Merges and iterates through sorted intervals. Will "fill up"
  // intervals. This is currently used for computing text chunks in
  // lively.morphic.TextCore.
  // Example:
  // interval.intervalsInRangeDo(
  //   2, 10, [[0, 1], [5,8], [2,4]],
  //   function(i, isNew) { i.push(isNew); return i; })
  // // => [[2,4,false],[4,5,true],[5,8,false],[8,10,true]]

  context = context || GLOBAL$2;
  // need to be sorted for the algorithm below
  intervals = this.sort(intervals);
  var free = [],
      nextInterval,
      collected = [];
  // merged intervals are already sorted, simply "negate" the interval array;
  while (nextInterval = intervals.shift()) {
    if (nextInterval[1] < start) continue;
    if (nextInterval[0] < start) {
      nextInterval = Array.prototype.slice.call(nextInterval);
      nextInterval[0] = start;
    }
    var nextStart = end < nextInterval[0] ? end : nextInterval[0];
    if (start < nextStart) {
      collected.push(iterator.call(context, [start, nextStart], true));
    }
    if (end < nextInterval[1]) {
      nextInterval = Array.prototype.slice.call(nextInterval);
      nextInterval[1] = end;
    }
    // special case, the newly constructed interval has length 0,
    // happens when intervals contains doubles at the start
    if (nextInterval[0] === nextInterval[1]) {
      var prevInterval;
      if (mergeFunc && (prevInterval = collected.slice(-1)[0])) {
        // arguments: a, b, merged, like in the callback of #merge
        mergeFunc.call(context, prevInterval, nextInterval, prevInterval);
      }
    } else {
      collected.push(iterator.call(context, nextInterval, false));
    }
    start = nextInterval[1];
    if (start >= end) break;
  }
  if (start < end) collected.push(iterator.call(context, [start, end], true));
  return collected;
}

function intervalsInbetween(start, end, intervals) {
  // Computes "free" intervals between the intervals given in range start - end
  // currently used for computing text chunks in lively.morphic.TextCore
  // Example:
  // interval.intervalsInbetween(0, 10,[[1,4], [5,8]])
  // // => [[0,1],[4,5],[8,10]]
  return intervalsInRangeDo(start, end, coalesceOverlapping(Array.prototype.slice.call(intervals)), function (interval, isNew) {
    return isNew ? interval : null;
  }).filter(Boolean);
}

function mapToMatchingIndexes(intervals, intervalsToFind) {
  // Returns an array of indexes of the items in intervals that match
  // items in `intervalsToFind`.
  // Note: We expect intervals and intervals to be sorted according to [`interval.compare`]()!
  // This is the optimized version of:
  // ```
  // return intervalsToFind.collect(function findOne(toFind) {
  //    var startIdx, endIdx;
  //    var start = intervals.detect(function(ea, i) {
  //       startIdx = i; return ea[0] === toFind[0]; });
  //    if (start === undefined) return [];
  //    var end = intervals.detect(function(ea, i) {
  //       endIdx = i; return ea[1] === toFind[1]; });
  //    if (end === undefined) return [];
  //    return Array.range(startIdx, endIdx);
  // });
  // ```

  var startIntervalIndex = 0,
      endIntervalIndex,
      currentInterval;
  return intervalsToFind.map(function (toFind) {
    while (currentInterval = intervals[startIntervalIndex]) {
      if (currentInterval[0] < toFind[0]) {
        startIntervalIndex++;continue;
      }
      break;
    }
    if (currentInterval && currentInterval[0] === toFind[0]) {
      endIntervalIndex = startIntervalIndex;
      while (currentInterval = intervals[endIntervalIndex]) {
        if (currentInterval[1] < toFind[1]) {
          endIntervalIndex++;continue;
        }
        break;
      }
      if (currentInterval && currentInterval[1] === toFind[1]) {
        return range(startIntervalIndex, endIntervalIndex);
      }
    }
    return [];
  });
}



var interval = Object.freeze({
	isInterval: isInterval,
	sort: sort$2,
	compare: compare,
	coalesce: coalesce,
	coalesceOverlapping: coalesceOverlapping,
	mergeOverlapping: mergeOverlapping,
	intervalsInRangeDo: intervalsInRangeDo,
	intervalsInbetween: intervalsInbetween,
	mapToMatchingIndexes: mapToMatchingIndexes
});

// show-in-doc
// Accessor to sub-ranges of arrays. This is used, for example, for rendering
// large lists or tables in which only a part of the items should be used for
// processing or rendering. An array projection provides convenient access and
// can apply operations to sub-ranges.

function create(array, length, optStartIndex) {
  // Example:
  // arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 1)
  // // => { array: [/*...*/], from: 1, to: 5 }
  var startIndex = optStartIndex || 0;
  if (startIndex + length > array.length) startIndex -= startIndex + length - array.length;
  return { array: array, from: startIndex, to: startIndex + length };
}

function toArray$4(projection) {
  // show-in-doc
  return projection.array.slice(projection.from, projection.to);
}

function originalToProjectedIndex(projection, index) {
  // Maps index from original Array to projection.
  // Example:
  //   var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  //   arrayProjection.originalToProjectedIndex(proj, 1) // => null
  //   arrayProjection.originalToProjectedIndex(proj, 3) // => 0
  //   arrayProjection.originalToProjectedIndex(proj, 5) // => 2
  return index < projection.from || index >= projection.to ? null : index - projection.from;
}

function projectedToOriginalIndex(projection, index) {
  // Inverse to `originalToProjectedIndex`.
  // Example:
  //   var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  //   arrayProjection.projectedToOriginalIndex(proj, 1) // => 4
  if (index < 0 || index > projection.to - projection.from) return null;
  return projection.from + index;
}

function transformToIncludeIndex(projection, index) {
  // Computes how the projection needs to shift minimally (think "scroll"
  // down or up) so that index becomes "visible" in projection.
  // Example:
  // var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  // arrayProjection.transformToIncludeIndex(proj, 1)
  // // => { array: [/*...*/], from: 1, to: 5 }
  if (!(index in projection.array)) return null;
  var delta = 0;
  if (index < projection.from) delta = -projection.from + index;
  if (index >= projection.to) delta = index - projection.to + 1;
  if (delta === 0) return projection;
  return create(projection.array, projection.to - projection.from, projection.from + delta);
}



var arrayProjection = Object.freeze({
	create: create,
	toArray: toArray$4,
	originalToProjectedIndex: originalToProjectedIndex,
	projectedToOriginalIndex: projectedToOriginalIndex,
	transformToIncludeIndex: transformToIncludeIndex
});

// show-in-doc
// A grid is a two-dimaensional array, representing a table-like data

function get$2(grid, nRow, nCol) {
  var row = grid[nRow];
  return row ? row[nCol] : undefined;
}

function set$2(grid, nRow, nCol, obj) {
  var row = grid[nRow];
  if (row) row[nCol] = obj;
  return obj;
}

function getRow(grid, nRow) {
  return grid[nRow];
}

function setRow(grid, nRow, newRow) {
  return grid[nRow] = newRow;
}

function getCol(grid, nCol) {
  return grid.reduce(function (col, row) {
    col.push(row[nCol]);return col;
  }, []);
}

function setCol(grid, nCol, newCol) {
  return grid.map(function (row, i) {
    return row[nCol] ? row[nCol] = newCol[i] : undefined;
  });
}

function create$1(rows, columns, initialObj) {
  // Example:
  // grid.create(3, 2, "empty")
  // // => [["empty","empty"],
  // //     ["empty","empty"],
  // //     ["empty","empty"]]
  var result = new Array(rows);
  while (rows > 0) {
    result[--rows] = withN(columns, initialObj);
  }return result;
}

function mapCreate(rows, cols, func, context) {
  // like `grid.create` but takes generator function for cells
  var result = new Array(rows);
  for (var i = 0; i < rows; i++) {
    result[i] = new Array(cols);
    for (var j = 0; j < cols; j++) {
      result[i][j] = func.call(context || this, i, j);
    }
  }
  return result;
}

function forEach$2(grid, func, context) {
  // iterate, `func` is called as `func(cellValue, i, j)`
  grid.forEach(function (row, i) {
    row.forEach(function (val, j) {
      func.call(context || this, val, i, j);
    });
  });
}

function map$2(grid, func, context) {
  // map, `func` is called as `func(cellValue, i, j)`
  var result = new Array(grid.length);
  grid.forEach(function (row, i) {
    result[i] = new Array(row.length);
    row.forEach(function (val, j) {
      result[i][j] = func.call(context || this, val, i, j);
    });
  });
  return result;
}

function toObjects(grid) {
  // The first row of the grid defines the propNames
  // for each following row create a new object with those porperties
  // mapped to the cells of the row as values
  // Example:
  // grid.toObjects([['a', 'b'],[1,2],[3,4]])
  // // => [{a:1,b:2},{a:3,b:4}]
  var props = grid[0],
      objects = new Array(grid.length - 1);
  for (var i = 1; i < grid.length; i++) {
    var obj = objects[i - 1] = {};
    for (var j = 0; j < props.length; j++) {
      obj[props[j]] = grid[i][j];
    }
  }
  return objects;
}

function tableFromObjects(objects, valueForUndefined) {
  // Reverse operation to `grid.toObjects`. Useful for example to convert objectified
  // SQL result sets into tables that can be printed via Strings.printTable.
  // Objects are key/values like [{x:1,y:2},{x:3},{z:4}]. Keys are interpreted as
  // column names and objects as rows.
  // Example:
  // grid.tableFromObjects([{x:1,y:2},{x:3},{z:4}])
  // // => [["x","y","z"],
  // //    [1,2,null],
  // //    [3,null,null],
  // //    [null,null,4]]

  if (!Array.isArray(objects)) objects = [objects];
  var table = [[]],
      columns = table[0],
      rows = objects.reduce(function (rows, ea) {
    return rows.concat([Object.keys(ea).reduce(function (row, col) {
      var colIdx = columns.indexOf(col);
      if (colIdx === -1) {
        colIdx = columns.length;columns.push(col);
      }
      row[colIdx] = ea[col];
      return row;
    }, [])]);
  }, []);
  valueForUndefined = arguments.length === 1 ? null : valueForUndefined;
  rows.forEach(function (row) {
    // fill cells with no value with null
    for (var i = 0; i < columns.length; i++) {
      if (!row[i]) row[i] = valueForUndefined;
    }
  });
  return table.concat(rows);
}



var grid = Object.freeze({
	get: get$2,
	set: set$2,
	getRow: getRow,
	setRow: setRow,
	getCol: getCol,
	setCol: setCol,
	create: create$1,
	mapCreate: mapCreate,
	forEach: forEach$2,
	map: map$2,
	toObjects: toObjects,
	tableFromObjects: tableFromObjects
});

/*
 * Methods for traversing and transforming tree structures.
 */

function prewalk(treeNode, iterator, childGetter) {
  var counter = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : { i: 0 };
  var depth = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

  var i = counter.i++;
  iterator(treeNode, i, depth);
  (childGetter(treeNode, i, depth) || []).forEach(function (ea) {
    return prewalk(ea, iterator, childGetter, counter, depth + 1);
  });
}

function postwalk(treeNode, iterator, childGetter) {
  var counter = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : { i: 0 };
  var depth = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

  var i = counter.i++;
  (childGetter(treeNode, i, depth) || []).forEach(function (ea) {
    return postwalk(ea, iterator, childGetter, counter, depth);
  });
  iterator(treeNode, i, depth);
}

function find(treeNode, testFunc, childGetter) {
  // Traverses a `treeNode` recursively and returns the first node for which
  // `testFunc` returns true. `childGetter` is a function to retrieve the
  // children from a node.
  if (testFunc(treeNode)) return treeNode;
  var children = childGetter(treeNode);
  if (!children || !children.length) return undefined;
  for (var i = 0; i < children.length; i++) {
    var found = find(children[i], testFunc, childGetter);
    if (found) return found;
  }
  return undefined;
}
var detect$1 = find;

function filter$1(treeNode, testFunc, childGetter) {
  // Traverses a `treeNode` recursively and returns all nodes for which
  // `testFunc` returns true. `childGetter` is a function to retrieve the
  // children from a node.
  var result = [];
  if (testFunc(treeNode)) result.push(treeNode);
  return result.concat(flatten((childGetter(treeNode) || []).map(function (n) {
    return filter$1(n, testFunc, childGetter);
  })));
}

function map$3(treeNode, mapFunc, childGetter) {
  var depth = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

  // Traverses a `treeNode` recursively and call `mapFunc` on each node. The
  // return values of all mapFunc calls is the result. `childGetter` is a
  // function to retrieve the children from a node.
  return [mapFunc(treeNode, depth)].concat(flatten((childGetter(treeNode) || []).map(function (n) {
    return map$3(n, mapFunc, childGetter, depth + 1);
  })));
}

function mapTree(treeNode, mapFunc, childGetter) {
  var depth = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

  // Traverses the tree and creates a structurally identical tree but with
  // mapped nodes
  var mappedNodes = (childGetter(treeNode) || []).map(function (n) {
    return mapTree(n, mapFunc, childGetter, depth + 1);
  });
  return mapFunc(treeNode, mappedNodes, depth);
}



var tree = Object.freeze({
	prewalk: prewalk,
	postwalk: postwalk,
	find: find,
	detect: detect$1,
	filter: filter$1,
	map: map$3,
	mapTree: mapTree
});

/*global process, require*/

/*
 * A simple node.js-like cross-platform event emitter implementation that can
 * be used as a mixin. Emitters support the methods: `on(eventName, handlerFunc)`,
 * `once(eventName, handlerFunc)`, `emit(eventName, eventData)`,
 * `removeListener(eventName, handlerFunc)`, `removeAllListeners(eventName)`
 * Example:
 * var emitter = events.makeEmitter({});
 * var log = [];
 * emitter.on("test", function() { log.push("listener1"); });
 * emitter.once("test", function() { log.push("listener2"); });
 * emitter.emit("test");
 * emitter.emit("test");
 * log // => ["listener1","listener2","listener1"]
 * emitter.removeAllListeners("test");
 * emitter.emit("test");
 * log // => is still ["listener1","listener2","listener1"]
 */

var isNode$1 = typeof process !== 'undefined' && process.versions && process.versions.node;

var makeEmitter = isNode$1 ? function (obj, options) {
  if (obj.on && obj.removeListener) return obj;
  var events = typeof System !== "undefined" ? System._nodeRequire("events") : require("events");
  Object.assign(obj, events.EventEmitter.prototype);
  events.EventEmitter.call(obj);
  if (options && options.maxListenerLimit) obj.setMaxListeners(options.maxListenerLimit);

  return obj;
} : function (obj) {
  if (obj.on && obj.removeListener) return obj;

  obj.listeners = {};

  obj.on = function (type, handler) {
    if (!handler) return;
    if (!obj.listeners[type]) obj.listeners[type] = [];
    obj.listeners[type].push(handler);
  };

  obj.once = function (type, handler) {
    if (!handler) return;
    function onceHandler /*ignore-in-docs args*/() {
      obj.removeListener(type, onceHandler);
      handler.apply(this, arguments);
    }
    obj.on(type, onceHandler);
  };

  obj.removeListener = function (type, handler) {
    if (!obj.listeners[type]) return;
    obj.listeners[type] = obj.listeners[type].filter(function (h) {
      return h !== handler;
    });
  };

  obj.removeAllListeners = function (type) {
    if (!obj.listeners[type]) return;
    obj.listeners[type] = [];
  };

  obj.emit = function () /*type and args*/{
    var args = Array.prototype.slice.call(arguments),
        type = args.shift(),
        handlers = obj.listeners[type];
    if (!handlers || !handlers.length) return;
    handlers.forEach(function (handler) {
      try {
        handler.apply(null, args);
      } catch (e) {
        console.error("Error in event handler: %s", e.stack || String(e));
      }
    });
  };

  return obj;
};



var events = Object.freeze({
	makeEmitter: makeEmitter
});

/*global clearTimeout, setTimeout, clearInterval, setInterval*/

/*
 * A pluggable interface to provide asynchronous, actor-like message
 * communication between JavaScript systems. Provides a unified message protocol
 * and send / receive methods.
 */

var OFFLINE = 'offline';
var ONLINE = 'online';
/*

TODO: move to promises! include broadcast API

renames:
listen() => open()
id() => id

*/

/*

A messenger is an object that provides a common, message-based interface. Messengers expect you to provide an implementation of a small number of methods: `send`, `listen`, `close`, and `isOnline`. A messenger will then provide a unified interface for sending and receiving messages. Common boilerplate functionality such as queuing messages, error handling, dealing with instable connections, heartbeats, etc. is handled by the messenger object automatically (and can be parameterized).

This allows to use a single interface across a range of heterogeneous objects without having to implement every detail of the abstraction repeatedly. This is especially valuable when dealing with asynchronous or remote communication (web workers, XHR requests, WebSockets, node.js processes, ...).

To see a minimal example of how to use messengers for the local communication between JavaScript objects [see this example](#messenger-example).

A more sophisticated example of messengers is [the worker implementation](worker.js) which provides an actor-like worker interface that uses web workers in web browsers and child_process.fork in node.js.

```js
var msger = lively.lang.messenger.create({
  send: function(msg, onSendDone) { console.log(msg); onSendDone(); },
  listen: function(thenDo) { thenDo(); },
  close: function(thenDo) { thenDo(); },
  isOnline: function() { return true }
});
```

#### Messenger interface

The interface methods are build to enable an user to send and receive
messages. Each messenger provides the following methods:

##### msger.id()

Each msger has an id that can either be defined by the user when the
msger is created or is automatically assigned. The id should be unique for each
messenger in a messenger network. It is used as the `target` attribute to
address messages and internally in the messaging implementation for routing.
See the [message protocol](#messenger-message-protocol) description for more info.

##### msger.isOnline()

Can the msger send and receive messages right now?

##### msger.heartbeatEnabled()

Does the msger send automated heartbeat messages?

##### msger.listen(optionalCallback)

Brings the messenger "online": Starts listening for messages and brings it
into a state to send messages. `optionalCallback` is a function that is called
when listening begins. It should accept one argument `error` that is null if no
error occured when listening was started, an Error object otherwise.

##### msger.send(msg, onReceiveFunc)

Sends a message. The message should be structured according to the [message
protocol](#messenger-message-protocol). `onReceiveFunc` is triggered when the `msg` is being
answered. `onReceiveFunc` should take two arguments: `error` and `answer`.
`answer` is itself a message object.

##### msger.sendTo(target, action, data, onReceiveFunc)

A simpler `send`, the `msg` object is automatically assembled. `target`
should be an id of the receiver and `action` a string naming the service that
should be triggered on the receiver.

##### msger.answer(msg, data, expectMore, whenSend)

Assembles an answer message for `msg` that includes `data`. `expectMore`
should be truthy when multiple answers should be send (a streaming response,
see the [messaging protocol](#messenger-message-protocol)).

##### msger.close(thenDo)

Stops listening.

##### msger.whenOnline(thenDo)

Registers a callback that is triggered as soon as a listen attempt succeeds
(or when the messenger is listening already then it succeeds immediately).

##### msger.outgoingMessages()

Returns the messages that are currently inflight or not yet send.

##### msger.addServices(serviceSpec)

Add services to the messenger. `serviceSpec` should be  JS object whose keys
correspond to message actions:

```js
msg.addServices({
  helloWorld: function(msg, messenger) {
    messenger.answer(msg, "received a message!");
  }
});
```

See the examples below for more information.

##### *[event]* msger.on("message")

To allow users to receive messages that were not initiated by a send,
messengers are [event emitters](events.js) that emit `"message"` events
whenever they receive a new message.

The messenger object is used to create new messenger interfaces and ties
them to a specific implementation. Please see [worker.js]() for examples of
how web workers and node.js processes are wrapped to provide a cross-platform
interface to a worker abstraction.


#### <a name="messenger-message-protocol"></a>Message protocol

A message is a JSON object with the following fields:

```js
var messageSchema = {

    // REQUIRED selector for service lookup. By convention action gets
    // postfixed with "Result" for response messages
    action: STRING,

    // REQUIRED target of the message, the id of the receiver
    target: UUID,

    // OPTIONAL arguments
    data: OBJECT,

    // OPTIONAL identifier of the message, will be provided if not set by user
    messageId: UUID,

    // OPTIONAL sender of the message, will be provided if not set by user
    sender: UUID,

    // OPTIONAL identifier of a message that this message answers, will be provided
    inResponseTo: UUID,

    // OPTIONAL if message is an answer. Can be interpreted by the receiver as
    // a streaming response. Lively participants (tracker and clients) will
    // trigger data bindings and fire callbacks for a message for every streaming
    // response
    expectMoreResponses: BOOL,

    // EXPERIMENTAL UUIDs of trackers/sessions handlers that forwarded this
    // message
    route: ARRAY
}
```

The `sendTo` and `answer` methods of messengers will automatically create these
messages. If the user invokes the `send` method then a JS object according to
the schema above should be passed as the first argument.

#### <a name="messenger-example"></a>Messenger examples

The following code implements what is needed to use a messenger to communicate
between any number of local JavaScript objects. Instead of dispatching methods using
a local list of messengers you will most likely use an existing networking /
messaging mechanism.

See the [worker](#) and [its implementation](worker.js) for a real use case in
which forking processes in the browser using Web Workers and in node.js using
child_process.fork is unified.

```js
// spec that defines message sending in terms of receivers in the messengers list
var messengers = [];
var messengerSpec = {
  send: function(msg, onSendDone) {
    var err = null, recv = arr.detect(messengers, function(ea) {
          return ea.id() === msg.target; });
    if (recv) recv.onMessage(msg);
    else err = new Error("Could not find receiver " + msg.target);
    onSendDone(err);
  },
  listen: function(thenDo) { arr.pushIfNotIncluded(messengers, this); },
  close: function(thenDo) { arr.remove(messengers, this); },
  isOnline: function() { return arr.include(messengers, this); }
};

// Create the messengers and add a simple "service"
var msger1 = messenger.create(messengerSpec);
var msger2 = messenger.create(messengerSpec);
msger2.addServices({
  add: function(msg, msger) { msger.answer(msg, {result: msg.data.a + msg.data.b}); }
});

// turn'em on...
msger1.listen();
msger2.listen();

// ...and action!
msger1.sendTo(msger2.id(), 'add', {a: 3, b: 4},
  function(err, answer) { alert(answer.data.result); });
```

*/

function create$2(spec) {

  var expectedMethods = [{ name: "send", args: ['msg', 'callback'] }, { name: "listen", args: ['messenger', 'callback'] }, { name: "close", args: ['messenger', 'callback'] }, { name: "isOnline", args: [] }];

  var ignoredAttributes = expectedMethods.map(function (ea) {
    return ea.name;
  }).concat(["id", "sendHeartbeat", "heartbeatInterval", "ignoreUnknownMessages", "allowConcurrentSends", "sendTimeout", "services"]);

  expectedMethods.forEach(function (exp) {
    if (spec[exp.name]) return;
    var msg = "message implementation needs function " + exp.name + "(" + exp.args.join(',') + ")";
    throw new Error(msg);
  });

  var heartbeatInterval = spec.sendHeartbeat && (spec.heartbeatInterval || 1000);
  var ignoreUnknownMessages = spec.hasOwnProperty("ignoreUnknownMessages") ? spec.ignoreUnknownMessages : false;

  var messenger = {

    _outgoing: [],
    _inflight: [],
    _id: spec.id || newUUID(),
    _ignoreUnknownMessages: ignoreUnknownMessages,
    _services: {},
    _messageCounter: 0,
    _messageResponseCallbacks: {},
    _whenOnlineCallbacks: [],
    _statusWatcherProc: null,
    _startHeartbeatProcessProc: null,
    _listenInProgress: null,
    _heartbeatInterval: heartbeatInterval,
    _status: OFFLINE,

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    _runWhenOnlineCallbacks: function _runWhenOnlineCallbacks() {
      var cbs = messenger._whenOnlineCallbacks.slice();
      messenger._whenOnlineCallbacks = [];
      cbs.forEach(function (ea) {
        try {
          ea.call(null, null, messenger);
        } catch (e) {
          console.error("error in _runWhenOnlineCallbacks: %s", e);
        }
      });
    },

    _ensureStatusWatcher: function _ensureStatusWatcher() {
      if (messenger._statusWatcherProc) return;
      messenger._statusWatcherProc = setInterval(function () {
        if (messenger.isOnline() && messenger._whenOnlineCallbacks.length) messenger._runWhenOnlineCallbacks();
        var prevStatus = messenger._status;
        messenger._status = messenger.isOnline() ? ONLINE : OFFLINE;
        if (messenger._status !== ONLINE && messenger._statusWatcherProc) {
          messenger.reconnect();
        }
        if (messenger._status !== prevStatus && messenger.onStatusChange) {
          messenger.onStatusChange();
        }
      }, 20);
    },

    _addMissingData: function _addMissingData(msg) {
      if (!msg.target) throw new Error("Message needs target!");
      if (!msg.action) throw new Error("Message needs action!");
      if (!msg.data) msg.data = null;
      if (!msg.messageId) msg.messageId = newUUID();
      msg.sender = messenger.id();
      msg.messageIndex = messenger._messageCounter++;
      return msg;
    },

    _queueSend: function _queueSend(msg, onReceiveFunc) {
      if (onReceiveFunc && typeof onReceiveFunc !== 'function') throw new Error("Expecing a when send callback, got: " + onReceiveFunc);
      messenger._outgoing.push([msg, onReceiveFunc]);
    },

    _deliverMessageQueue: function _deliverMessageQueue() {
      if (!spec.allowConcurrentSends && messenger._inflight.length) return;

      var queued = messenger._outgoing.shift();
      if (!queued) return;

      messenger._inflight.push(queued);
      if (messenger.isOnline()) deliver(queued);else messenger.whenOnline(function () {
        deliver(queued);
      });
      startTimeoutProc(queued);

      if (spec.allowConcurrentSends && messenger._outgoing.length) messenger._deliverMessageQueue();

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function deliver(queued) {
        // ignore-in-doc
        if (messenger._inflight.indexOf(queued) === -1) return; // timed out
        var msg = queued[0],
            callback = queued[1];
        if (callback) messenger._messageResponseCallbacks[msg.messageId] = callback;

        spec.send.call(messenger, msg, function (err) {
          remove(messenger._inflight, queued);
          if (err) onSendError(err, queued);
          messenger._deliverMessageQueue();
        });
      }

      function startTimeoutProc(queued) {
        if (typeof spec.sendTimeout !== 'number') return;
        setTimeout(function () {
          if (messenger._inflight.indexOf(queued) === -1) return; // delivered
          remove(messenger._inflight, queued);
          onSendError(new Error('Timeout sending message'), queued);
          messenger._deliverMessageQueue();
        }, spec.sendTimeout);
      }

      function onSendError(err, queued) {
        var msg = queued[0],
            callback = queued[1];
        delete messenger._messageResponseCallbacks[msg.messageId];
        console.error(err);
        callback && callback(err);
      }
    },

    _startHeartbeatProcess: function _startHeartbeatProcess() {
      if (messenger._startHeartbeatProcessProc) return;
      messenger._startHeartbeatProcessProc = setTimeout(function () {
        spec.sendHeartbeat.call(messenger, function (err, result) {
          messenger._startHeartbeatProcessProc = null;
          messenger._startHeartbeatProcess();
        });
      }, messenger._heartbeatInterval);
    },

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    id: function id() {
      return messenger._id;
    },

    isOnline: function isOnline() {
      return spec.isOnline.call(messenger);
    },

    heartbeatEnabled: function heartbeatEnabled() {
      return typeof messenger._heartbeatInterval === 'number';
    },

    listen: function listen(thenDo) {
      if (messenger._listenInProgress) return;
      messenger._listenInProgress = true;
      messenger._ensureStatusWatcher();
      return spec.listen.call(messenger, function (err) {
        messenger._listenInProgress = null;
        thenDo && thenDo(err);
        if (messenger.heartbeatEnabled()) messenger._startHeartbeatProcess();
      });
      return messenger;
    },

    reconnect: function reconnect() {
      if (messenger._status === ONLINE) return;
      messenger.listen();
      return messenger;
    },

    send: function send(msg, onReceiveFunc) {
      messenger._addMissingData(msg);
      messenger._queueSend(msg, onReceiveFunc);
      messenger._deliverMessageQueue();
      return msg;
    },

    sendTo: function sendTo(target, action, data, onReceiveFunc) {
      var msg = { target: target, action: action, data: data };
      return messenger.send(msg, onReceiveFunc);
    },

    onMessage: function onMessage(msg) {
      messenger.emit("message", msg);
      if (msg.inResponseTo) {
        var cb = messenger._messageResponseCallbacks[msg.inResponseTo];
        if (cb && !msg.expectMoreResponses) delete messenger._messageResponseCallbacks[msg.inResponseTo];
        if (cb) cb(null, msg);
      } else {
        var action = messenger._services[msg.action];
        if (action) {
          try {
            action.call(null, msg, messenger);
          } catch (e) {
            var errmMsg = String(e.stack || e);
            console.error("Error invoking service: " + errmMsg);
            messenger.answer(msg, { error: errmMsg });
          }
        } else if (!messenger._ignoreUnknownMessages) {
          var err = new Error("messageNotUnderstood: " + msg.action);
          messenger.answer(msg, { error: String(err) });
        }
      }
    },

    answer: function answer(msg, data, expectMore, whenSend) {
      if (typeof expectMore === 'function') {
        whenSend = expectMore;expectMore = false;
      }
      var answer = {
        target: msg.sender,
        action: msg.action + 'Result',
        inResponseTo: msg.messageId,
        data: data };
      if (expectMore) answer.expectMoreResponses = true;
      return messenger.send(answer, whenSend);
    },

    close: function close(thenDo) {
      clearInterval(messenger._statusWatcherProc);
      messenger._statusWatcherProc = null;
      spec.close.call(messenger, function (err) {
        messenger._status = OFFLINE;
        thenDo && thenDo(err);
      });
      return messenger;
    },

    whenOnline: function whenOnline(thenDo) {
      messenger._whenOnlineCallbacks.push(thenDo);
      if (messenger.isOnline()) messenger._runWhenOnlineCallbacks();
      return messenger;
    },

    outgoingMessages: function outgoingMessages() {
      return pluck(messenger._inflight.concat(messenger._outgoing), 0);
    },

    addServices: function addServices(serviceSpec) {
      Object.assign(messenger._services, serviceSpec);
      return messenger;
    }
  };

  if (spec.services) messenger.addServices(spec.services);
  makeEmitter(messenger);

  for (var name in spec) {
    if (ignoredAttributes.indexOf(name) === -1 && spec.hasOwnProperty(name)) {
      messenger[name] = spec[name];
    }
  }

  return messenger;
}



var messenger = Object.freeze({
	create: create$2
});

/*global require, Worker, URL, webkitURL, Blob, BlobBuilder, process, require*/

/*
 * A platform-independent worker interface that will spawn new processes per
 * worker (if the platform you use it on supports it).
 */

var isNodejs = typeof require !== 'undefined' && typeof process !== 'undefined';

// ignore-in-doc
// Code in worker setup is evaluated in the context of workers, it will get to
// workers in a stringified form(!).
var WorkerSetup = {

  loadDependenciesBrowser: function loadDependenciesBrowser(options) {
    var me = typeof self !== "undefined" ? self : this;
    importScripts.apply(me, options.scriptsToLoad || []);
  },

  loadDependenciesNodejs: function loadDependenciesNodejs(options) {
    var lv = global.lively || (global.lively = {});
    lv.lang = require(require("path").join(options.libLocation, "index"));
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // yoshiki and robert, 05/08/13: Inserted code that sets up the lively context
  // and globals of Lively and other required objects:
  initBrowserGlobals: function initBrowserGlobals(options) {
    remoteWorker.send = function (msg) {
      postMessage(msg);
    };
    var me = typeof self !== "undefined" ? self : this;
    var Global = me.Global = me;
    Global.window = Global;
    Global.console = Global.console || function () {
      var c = {};
      ['log', 'error', 'warn'].forEach(function (name) {
        c[name] = function () /*args*/{
          var string = arguments[0];
          for (var i = 1; i < arguments.length; i++) {
            string = string.replace('%s', arguments[i]);
          }remoteWorker.send({
            type: name,
            message: ['[', name.toUpperCase(), '] ', string].join('')
          });
        };
      });
      return c;
    }();
  },

  initOnMessageHandler: function initOnMessageHandler(options) {
    if (remoteWorker.on) remoteWorker.on('message', onMessage);else remoteWorker.onmessage = onMessage;

    function onMessage(msg) {
      msg = msg.data.data ? msg.data : msg;
      if (remoteWorker.messenger) remoteWorker.messenger.onMessage(msg);else if (msg.action == "close") {
        remoteWorker.send({ type: "closed", workerReady: false });
        remoteWorker.close();
        return;
      }
    }
  },

  initWorkerInterface: function initWorkerInterface(options) {
    remoteWorker.callStringifiedFunction = function (stringifiedFunc, args, thenDo) {
      // ignore-in-doc
      // runs stringified function and passing args. stringifiedFunc might
      // be asynchronous if it takes an addaitional argument. In this case a
      // callback to call when the work is done is passed, otherwise thenDo
      // will be called immediatelly after creating and calling the function

      var func;
      try {
        func = eval('(' + stringifiedFunc + ')');
      } catch (e) {
        thenDo(new Error("Cannot create function from string: " + e.stack || e));
        return;
      }

      // ignore-in-doc
      // when it takes one more arg then we assume that this is the callback
      // to be called by the run func when it considers to be done
      var usesCallback = func.length === args.length + 1;
      var whenDone = lively.lang.fun.once(function (err, result) {
        remoteWorker.isBusy = false;thenDo(err, result);
      });
      remoteWorker.isBusy = true;

      if (usesCallback) args.push(whenDone);

      try {
        var result = func.apply(remoteWorker, args.concat([whenDone]));
      } catch (e) {
        whenDone(e, null);return;
      }

      if (!usesCallback) whenDone(null, result);
    };

    remoteWorker.httpRequest = function (options) {
      if (!options.url) {
        console.log("Error, httpRequest needs url");
        return;
      }
      var req = new XMLHttpRequest(),
          method = options.method || 'GET';
      function handleStateChange() {
        if (req.readyState === 4) {
          // req.status
          options.done && options.done(req);
        }
      }
      req.onreadystatechange = handleStateChange;
      req.open(method, options.url);
      req.send();
    };

    remoteWorker.terminateIfNotBusyIn = function (ms) {
      setTimeout(function () {
        if (remoteWorker.isBusy) {
          remoteWorker.terminateIfNotBusyIn(ms);return;
        }
        remoteWorker.send({ type: "closed", workerReady: false });
        remoteWorker.close();
      }, ms);
    };
  },

  // ignore-in-doc
  // setting up the worker messenger interface, this is how the worker
  // should be communicated with
  initWorkerMessenger: function initWorkerMessenger(options) {
    if (!options.useMessenger) return null;
    if (!lively.lang.messenger) throw new Error("worker.create requires messenger.js to be loaded!");
    if (!lively.lang.events) throw new Error("worker.create requires events.js to be loaded!");

    return remoteWorker.messenger = lively.lang.messenger.create({
      services: {

        remoteEval: function remoteEval(msg, messenger) {
          var result;
          try {
            result = eval(msg.data.expr);
          } catch (e) {
            result = e.stack || e;
          }
          messenger.answer(msg, { result: String(result) });
        },

        run: function run(msg, messenger) {
          var funcString = msg.data.func,
              args = msg.data.args;
          if (!funcString) {
            messenger.answer(msg, { error: 'no funcString' });return;
          }
          remoteWorker.callStringifiedFunction(funcString, args, function (err, result) {
            messenger.answer(msg, { error: err ? String(err) : null, result: result });
          });
        },

        close: function close(msg, messenger) {
          messenger.answer(msg, { status: "OK" });
          remoteWorker.send({ type: "closed", workerReady: false });
          remoteWorker.close();
        }
      },

      isOnline: function isOnline() {
        return true;
      },
      send: function send(msg, whenSend) {
        remoteWorker.send(msg);whenSend();
      },
      listen: function listen(whenListening) {
        whenListening();
      },
      close: function close(whenClosed) {
        remoteWorker.send({ type: "closed", workerReady: false });remoteWorker.close();
      }

    });
  }

};

var BrowserWorker = {

  create: function create$3(options) {
    // ignore-in-doc
    // this function instantiates a browser worker object. We provide a
    // messenger-based interface to the pure Worker. Please use create to get an
    // improved interface to a worker

    options = options || {};

    // ignore-in-doc
    // figure out where the other lang libs can be loaded from
    if (!options.libLocation && !options.scriptsToLoad) {
      var workerScript = document.querySelector("script[src$=\"worker.js\"]");
      if (!workerScript) throw new Error("Cannot find library path to start worker. Use worker.create({libLocation: \"...\"}) to explicitly define the path!");
      options.libLocation = workerScript.src.replace(/worker.js$/, '');
    }

    var workerSetupCode = String(workerSetupFunction).replace("__FUNCTIONDECLARATIONS__", [WorkerSetup.initBrowserGlobals, WorkerSetup.loadDependenciesBrowser, WorkerSetup.initOnMessageHandler, WorkerSetup.initWorkerInterface, WorkerSetup.initWorkerMessenger].join('\n'));
    var workerCode = '(' + workerSetupCode + ')();';
    var worker = new Worker(makeDataURI(workerCode));
    init(options, worker);
    return worker;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // ignore-in-doc
    // This code is triggered in the UI process directly after the
    // creation of the worker and sends the setup message to the worker
    // for initializing it.
    function init(options, worker) {
      makeEmitter(worker);

      if (!options.scriptsToLoad) {
        options.scriptsToLoad = ['base.js', 'events.js', 'object.js', 'collection.js', 'function.js', 'string.js', 'number.js', 'date.js', 'messenger.js', 'worker.js'].map(function (ea) {
          return options.libLocation + ea;
        });
      }

      var workerOptions = Object.keys(options).reduce(function (opts, key) {
        if (typeof options[key] !== 'function') opts[key] = options[key];
        return opts;
      }, {});

      worker.onmessage = function (evt) {
        if (evt.data.workerReady !== undefined) {
          worker.ready = !!evt.data.workerReady;
          if (worker.ready) worker.emit("ready");else worker.emit("close");
        } else worker.emit('message', evt.data);
      };

      worker.errors = [];
      worker.onerror = function (evt) {
        console.error(evt);
        worker.errors.push(evt);
        worker.emit("error", evt);
      };

      worker.postMessage({ action: 'setup', options: workerOptions });
    }

    // ignore-in-doc
    // This code is run inside the worker and bootstraps the messenger
    // interface. It also installs a console.log method since since this is not
    // available by default.
    function workerSetupFunction() {
      var remoteWorker = self;
      remoteWorker.onmessage = function (evt) {
        if (evt.data.action !== "setup") {
          throw new Error("expected setup to be first message but got " + JSON.stringify(evt.data));
        }
        var options = evt.data.options || {};
        initBrowserGlobals(options);
        loadDependenciesBrowser(options);
        initOnMessageHandler(options);
        initWorkerInterface(options);
        initWorkerMessenger(options);
        postMessage({ workerReady: true });
      };
      __FUNCTIONDECLARATIONS__;
    }

    function makeDataURI(codeToInclude) {
      // ignore-in-doc
      // see http://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string
      var blob;
      try {
        blob = new Blob([codeToInclude], { type: "text/javascript" });
      } catch (e) {
        /* ignore-in-doc Backwards-compatibility*/
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(codeToInclude);
        blob = blob.getBlob();
      }
      var urlInterface = typeof webkitURL !== 'undefined' ? webkitURL : URL;
      return urlInterface.createObjectURL(blob);
    }
  }

};

var NodejsWorker = {

  debug: false,
  initCodeFileCreated: false,

  create: function create$3(options) {
    options = options || {};

    // ignore-in-doc
    // figure out where the other lang libs can be loaded from
    // if (!options.libLocation && !options.scriptsToLoad) {
    //   var workerScript = document.querySelector("script[src$=\"worker.js\"]");
    //   if (!workerScript) throw new Error("Cannot find library path to start worker. Use worker.create({libLocation: \"...\"}) to explicitly define the path!");
    //   options.libLocation = workerScript.src.replace(/worker.js$/, '');
    // }

    var workerProc;
    var worker = makeEmitter({
      ready: false,
      errors: [],

      postMessage: function postMessage(msg) {
        if (!workerProc) {
          worker.emit("error", new Error('nodejs worker process not yet created'));
          return;
        }
        if (!worker.ready) {
          worker.emit("error", new Error('nodejs worker process not ready or already closed'));
          return;
        }
        workerProc.send(msg);
      }
    });

    NodejsWorker.startWorker(options, function (err, _workerProc) {
      if (err) {
        worker.ready = false;worker.emit("error", err);return;
      }

      workerProc = _workerProc;

      workerProc.on('message', function (m) {
        NodejsWorker.debug && console.log('[WORKER PARENT] got message:', m);
        worker.emit("message", m);
      });

      workerProc.on('close', function () {
        console.log("[WORKER PARENT] worker closed");
        worker.emit("close");
      });

      workerProc.on('error', function (err) {
        console.log("[WORKER PARENT] error ", err);
        worker.errors.push(err);
        worker.emit("error", err);
      });

      worker.ready = true;
      worker.emit("ready");
    });

    return worker;
  },

  // this code is run in the context of the worker process
  workerSetupFunction: function workerSetupFunction() {
    var remoteWorker = process;
    var debug = true;
    var close = false;

    debug && console.log("[WORKER] Starting init");
    // ignore-in-doc
    // process.on('message', function(m) {
    //   debug && console.log('[WORKER] got message:', m);
    //   if (m.action === 'ping') process.send({action: 'pong', data: m});
    //   else if (m.action === 'close') close = true;
    //   else if (m.action === 'setup') setup(m.data);
    //   else console.error('[WORKER] unknown message: ', m);
    // });

    remoteWorker.on("message", function (msg) {
      if (msg.action !== "setup") {
        throw new Error("expected setup to be first message but got " + JSON.stringify(msg.data));
      }
      remoteWorker.removeAllListeners("message");
      var options = msg.data.options || {};
      debug && console.log("[WORKER] running setup with options", options);
      loadDependenciesNodejs(options);
      initOnMessageHandler(options);
      initWorkerInterface(options);
      initWorkerMessenger(options);
      remoteWorker.send({ workerReady: true });
    });
    __FUNCTIONDECLARATIONS__;
  },

  ensureInitCodeFile: function ensureInitCodeFile(options, initCode, thenDo) {
    var path = require("path");
    var os = require("os");
    var fs = require("fs");

    var workerTmpDir = path.join(os.tmpDir(), 'lively-nodejs-workers/');
    var fn = path.join(workerTmpDir, 'nodejs-worker-init.js');

    if (!NodejsWorker.initCodeFileCreated) NodejsWorker.createWorkerCodeFile(options, fn, initCode, thenDo);else fs.exists(fn, function (exists) {
      if (exists) thenDo(null, fn);else NodejsWorker.createWorkerCodeFile(options, fn, initCode, thenDo);
    });
  },

  createWorkerCodeFile: function createWorkerCodeFile(options, fileName, initCode, thenDo) {
    var path = require("path");
    var fs = require("fs");
    var exec = require("child_process").exec;

    exec("mkdir -p " + path.dirname(fileName), function (code, out, err) {
      if (code) {
        thenDo(new Error(["[WORKER PARENT] Could not create worker temp dir:", out, err].join('\n')));
        return;
      }
      fs.writeFile(fileName, initCode, function (err) {
        NodejsWorker.debug && console.log('worker code file %s created', fileName);
        NodejsWorker.initCodeFileCreated = true;
        thenDo(err, fileName);
      });
    });
  },

  startWorker: function startWorker(options, thenDo) {
    var util = require("util");
    var fork = require("child_process").fork;

    var workerSetupCode = String(NodejsWorker.workerSetupFunction).replace("__FUNCTIONDECLARATIONS__", [WorkerSetup.loadDependenciesNodejs, WorkerSetup.initOnMessageHandler, WorkerSetup.initWorkerInterface, WorkerSetup.initWorkerMessenger].join('\n'));

    var initCode = util.format("(%s)();\n", workerSetupCode);
    NodejsWorker.ensureInitCodeFile(options, initCode, function (err, codeFileName) {
      if (err) return thenDo(err);
      var worker = fork(codeFileName, {});
      NodejsWorker.debug && console.log('worker forked');
      worker.on('message', function (m) {
        if (m.action === 'pong') console.log("[WORKER pong] ", m);else if (m.action === 'log') console.log("[Message from WORKER] ", m.data);
      });
      worker.once('message', function (m) {
        NodejsWorker.debug && console.log('worker setup done');
        thenDo(null, worker, m);
      });
      worker.on('close', function () {
        NodejsWorker.debug && console.log("[WORKER PARENT] worker closed");
      });
      worker.send({ action: "setup", data: { options: options } });
      global.WORKER = worker;
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // the worker interface, usable both in browser and node.js contexts
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  /*
  Worker objects allow to fork processes in both Web and node.js JavaScript
  environments. They provide this mechanism using web workers in the browser and
  node.js child processes in node.js. The interface is unified for all platforms.
   */

};function fork(options, workerFunc, thenDo) {
  // Fork automatically starts a worker and calls `workerFunc`. `workerFunc`
  // gets as a last paramter a callback, that, when invoked with an error and
  // result object, ends the worker execution.
  //
  // Options are the same as in `create` except for an `args` property that
  // can be an array of objects. These objects will be passed to `workerFunc`
  // as arguments.
  //
  // Note: `workerFunc` will not be able to capture outside variables (create a
  // closure).
  //
  // Example:
  // // When running this inside a browser: Note how the UI does not block.
  // worker.fork({args: [40]},
  //   function(n, thenDo) {
  //     function fib(n) { return n <= 1 ? n : fib(n-1) + fib(n-2); }
  //     thenDo(null, fib(n));
  //   },
  //   function(err, result) { show(err ? err.stack : result); })

  if (!thenDo) {
    thenDo = workerFunc;workerFunc = options;options = null;
  }
  options = options || {};
  var args = options.args || [];
  var w = create$3(options);
  w.run.apply(w, [workerFunc].concat(args).concat(thenDo));
  return w;
}

function create$3(options) {
  // Explicitly creates a first-class worker. Options:
  // ```js
  // {
  //   workerId: STRING, // optional, id for worker, will be auto assigned if not provided
  //   libLocation: STRING, // optional, path to where the lively.lang lib is located. Worker will try to find it automatically if not provided.
  //   scriptsToLoad: ARRAY // optional, list of path/urls to load. Overwrites `libLocation`
  // }
  // ```
  //
  // Example:
  // // this is just a helper function
  // function resultHandler(err, result) { alert(err ? String(err) : result); }
  //
  // // 1. Create the worker
  // var worker = lively.lang.worker.create({libLocation: baseURL});
  //
  // // 2. You can evaluate arbitrary JS code
  // worker.eval("1+2", function(err, result) { show(err ? String(err) : result); });
  //
  // // 3. Arbitrary functions can be called inside the worker context.
  // //    Note: functions shouldn't be closures / capture local state!) and passing
  // //    in arguments!
  // worker.run(
  //   function(a, b, thenDo) { setTimeout(function() { thenDo(null, a+b); }, 300); },
  //   19, 4, resultHandler);
  //
  // // 4. You can also install your own messenger services...
  // worker.run(
  //   function(thenDo) {
  //     self.messenger.addServices({
  //       foo: function(msg, messenger) { messenger.answer(msg, "bar!"); }
  //     });
  //     thenDo(null, "Service installed!");
  //   }, resultHandler);
  //
  // // ... and call them via the messenger interface
  // worker.sendTo("worker", "foo", {}, resultHandler);
  //
  // // 5. afterwards: shut it down
  // worker.close(function(err) { err && show(String(err)); alertOK("worker shutdown"); })

  options = options || {};
  options.useMessenger = true;

  // if (!exports.messenger)
  //   throw new Error("worker.create requires messenger.js to be loaded!")
  // if (!exports.events)
  //   throw new Error("worker.create requires events.js to be loaded!")
  // if (!exports.obj)
  //   throw new Error("worker.create requires object.js to be loaded!")

  var workerId = options.workerId || newUUID();

  var messenger = create$2({
    sendTimeout: 5000,

    send: function send(msg, whenSend) {
      messenger.worker.postMessage(msg);
      whenSend();
    },

    listen: function listen(whenListening) {
      var w = messenger.worker = isNodejs ? NodejsWorker.create(options) : BrowserWorker.create(options);
      w.on("message", function (msg) {
        messenger.onMessage(msg);
      });
      w.on('ready', function () {
        NodejsWorker.debug && console.log("WORKER READY!!!");
      });
      w.on('close', function () {
        NodejsWorker.debug && console.log("WORKER CLOSED...!!!");
      });
      w.once('ready', whenListening);
    },

    close: function close(whenClosed) {
      if (!messenger.worker.ready) return whenClosed(null);
      return messenger.sendTo(workerId, 'close', {}, function (err, answer) {
        err = err || answer.data.error;
        err && console.error("Error in worker messenger close: " + err.stack || err);
        if (err) whenClosed(err);else {
          var closed = false;
          messenger.worker.once('close', function () {
            closed = true;
          });
          waitFor(1000, function () {
            return !!closed;
          }, whenClosed);
        }
      });
    },

    isOnline: function isOnline() {
      return messenger.worker && messenger.worker.ready;
    }

  });

  Object.assign(messenger, {
    eval: function _eval(code, thenDo) {
      messenger.sendTo(workerId, "remoteEval", { expr: code }, function (err, answer) {
        thenDo(err, answer ? answer.data.result : null);
      });
    },
    run: function run() /*runFunc, arg1, ... argN, thenDo*/{
      var args = Array.prototype.slice.call(arguments),
          workerFunc = args.shift(),
          thenDo = args.pop();
      if (typeof workerFunc !== "function") throw new Error("run: no function that should run in worker passed");
      if (typeof thenDo !== "function") throw new Error("run: no callback passed");

      return messenger.sendTo(workerId, 'run', { func: String(workerFunc), args: args }, function (err, answer) {
        thenDo(err || answer.data.error, answer ? answer.data.result : null);
      });
    }
  });

  messenger.listen();

  return messenger;
}



var worker = Object.freeze({
	fork: fork,
	create: create$3
});

var GLOBAL = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : undefined;

var isNode = typeof process !== "undefined" && process.env && typeof process.exit === "function";

var globalInterfaceSpec = [{ action: "installMethods", target: "Array", sources: ["arr"], methods: ["from", "genN", "range", "withN"] }, { action: "installMethods", target: "Array.prototype", sources: ["arr"], methods: ["all", "any", "batchify", "clear", "clone", "collect", "compact", "delimWith", "detect", "doAndContinue", "each", "equals", "filterByKey", "findAll", "first", "flatten", "forEachShowingProgress", "grep", "groupBy", "groupByKey", "histogram", "include", "inject", "intersect", "invoke", "last", "mapAsync", "mapAsyncSeries", "mask", "max", "min", "mutableCompact", "nestedDelay", "partition", "pluck", "pushAll", "pushAllAt", "pushAt", "pushIfNotIncluded", "reMatches", "reject", "rejectByKey", "remove", "removeAt", "replaceAt", "rotate", "shuffle", "size", "sortBy", "sortByKey", "sum", "swap", "toArray", "toTuples", "union", "uniq", "uniqBy", "without", "withoutAll", "zip"], alias: [["select", "filter"]] }, { action: "installMethods", target: "Date", sources: ["date"], methods: [/*"parse"*/] }, { action: "installMethods", target: "Date.prototype", sources: ["date"], methods: ["equals", "format", "relativeTo"] }, { action: "installMethods", target: "Function", sources: ["fun"], methods: ["fromString"] }, { action: "installMethods", target: "Function.prototype", sources: ["fun"], methods: [/*"addProperties",*/"addToObject", "argumentNames", "asScript", "asScriptOf", "binds", "curry", "delay", "functionNames", "localFunctionNames", "getOriginal", "getVarMapping", "logCalls", "logCompletion", "logErrors", "qualifiedMethodName", "setProperty", "traceCalls", "wrap"] }, { action: "installMethods", target: "Number", sources: ["num"], methods: [] }, { action: "installMethods", target: "Number.prototype", sources: ["num"], methods: ["detent", "randomSmallerInteger", "roundTo", "toDegrees", "toRadians"] }, { action: "installMethods", target: "Object", sources: ["obj"], methods: ["addScript", "clone", "deepCopy", "extend", "inherit", "isArray", "isBoolean", "isElement", "isEmpty", "isFunction", "isNumber", "isObject", "isRegExp", "isString", "isUndefined", "merge", "mergePropertyInHierarchy", "values", "valuesInPropertyHierarchy"] }, { action: "installMethods", target: "Object.prototype", sources: ["obj"], methods: [] }, { action: "installMethods", target: "String.prototype", sources: ["string"], methods: ["camelize", "capitalize", "digitValue", "empty", "hashCode", "include", "pad", "regExpEscape", "startsWithVowel", "succ", "times", "toArray", "toQueryParams", "truncate"] }, { action: "installObject", target: "Numbers", source: "num", methods: ["average", "between", "convertLength", "humanReadableByteSize", "median", "normalRandom", "parseLength", "random", "sort"] }, { action: "installObject", target: "Properties", source: "properties", methods: ["all", "allOwnPropertiesOrFunctions", "allProperties", "any", "forEachOwn", "hash", "nameFor", "own", "ownValues", "values"] }, { action: "installObject", target: "Strings", source: "string", methods: ["camelCaseString", "createDataURI", "diff", "format", "formatFromArray", "indent", "lineIndexComputer", "lines", "md5", "newUUID", "nonEmptyLines", "pad", "paragraphs", "peekLeft", "peekRight", "print", "printNested", "printTable", "printTree", "quote", "reMatches", "stringMatch", "tableize", "tokens", "unescapeCharacterEntities", "withDecimalPrecision"] }, { action: "installObject", target: "Objects", source: "obj", methods: ["asObject", "equals", "inspect", "isMutableType", "safeToString", "shortPrintStringOf", "typeStringOf"] }, { action: "installObject", target: "Functions", source: "fun", methods: ["all", "compose", "composeAsync", "createQueue", "debounce", "debounceNamed", "either", "extractBody", "flip", "notYetImplemented", "once", "own", "throttle", "throttleNamed", "timeToRun", "timeToRunN", "waitFor", "workerWithCallbackQueue", "wrapperChain"] }, { action: "installObject", target: "Grid", source: "grid" }, { action: "installObject", target: "Interval", source: "interval" }, { action: "installObject", target: "lively.ArrayProjection", source: "arrayProjection" }, { action: "installObject", target: "lively.Closure", source: "Closure" }, { action: "installObject", target: "lively.Grouping", source: "Group" }, { action: "installObject", target: "lively.PropertyPath", source: "Path" }, { action: "installObject", target: "lively.Worker", source: "worker" }, { action: "installObject", target: "lively.Class", source: "classHelper" }];

function createLivelyLangObject() {
  return {
    chain: chain$$1,
    noConflict: noConflict,
    installGlobals: installGlobals,
    uninstallGlobals: uninstallGlobals,
    globalInterfaceSpec: globalInterfaceSpec,
    toString: function toString() {
      return "[object lively.lang]";
    }
  };
}

var livelyLang = createLivelyLangObject();



function chain$$1(object) {
  if (!object) return object;

  var chained;
  if (Array.isArray(object)) return createChain(arr, object);
  if (object.constructor.name === "Date") return createChain(date, object);
  switch (typeof object === "undefined" ? "undefined" : _typeof(object)) {
    case 'string':
      return createChain(string, object);
    case 'object':
      return createChain(obj, object);
    case 'function':
      return createChain(fun, object);
    case 'number':
      return createChain(num, object);
  }
  throw new Error("Chain for object " + object + " (" + object.constructor.name + ") no supported");
}

function createChain(interfaceObj, obj) {
  return Object.keys(interfaceObj).reduce(function (chained, methodName) {
    chained[methodName] = function () /*args*/{
      var args = Array.prototype.slice.call(arguments),
          result = interfaceObj[methodName].apply(null, [obj].concat(args));
      return chain$$1(result);
    };
    return chained;
  }, { value: function value() {
      return obj;
    } });
}

function noConflict() {
  if (!isNode) {
    var keepLivelyNS = livelyLang._prevLivelyGlobal;
    if (!keepLivelyNS) delete GLOBAL.lively;else delete GLOBAL.lively.lang;
  }
  return livelyLang;
}

function installGlobals() {
  Object.assign(livelyLang, {
    worker: worker,
    messenger: messenger,
    events: events,
    tree: tree,
    grid: grid,
    arrayProjection: arrayProjection,
    interval: interval,
    graph: graph,
    date: date,
    properties: properties,
    obj: obj,
    arr: arr,
    fun: fun,
    num: num,
    string: string,
    Closure: Closure,
    promise: promise,
    Path: Path,
    Group: Group
  });
  globalInterfaceSpec.forEach(function (ea) {
    if (ea.action === "installMethods") {
      var targetPath = Path(ea.target);
      if (!targetPath.isIn(GLOBAL)) targetPath.set(GLOBAL, {}, true);
      var sourcePath = Path(ea.sources[0]);
      ea.methods.forEach(function (name) {
        installProperty(sourcePath.concat([name]), targetPath.concat([name]));
      });
      if (ea.alias) ea.alias.forEach(function (mapping) {
        installProperty(sourcePath.concat([mapping[1]]), targetPath.concat([mapping[0]]));
      });
    } else if (ea.action === "installObject") {
      var targetPath = Path(ea.target);
      var source = Path(ea.source).get(livelyLang);
      targetPath.set(GLOBAL, source, true);
    } else throw new Error("Cannot deal with global setup action: " + ea.action);
  });
}

function installProperty(sourcePath, targetPath) {
  if (!sourcePath.isIn(livelyLang)) {
    var err = new Error("property not provided by lively.lang: " + sourcePath);
    console.error(err.stack || err);
    throw err;
  }

  var prop = sourcePath.get(livelyLang);
  if (typeof prop === "function" && targetPath.slice(-2, -1).toString() === "prototype") {
    var origFunc = prop;
    prop = function prop() /*this and args*/{
      var args = Array.prototype.slice.call(arguments);
      args.unshift(this);
      return origFunc.apply(null, args);
    };
    prop.toString = function () {
      return origFunc.toString();
    };
  }
  targetPath.set(GLOBAL, prop, true);
}

function uninstallGlobals() {
  globalInterfaceSpec.forEach(function (ea) {
    if (ea.action === "installMethods") {
      var p = Path(ea.target);
      var source = Path(ea.source).get(livelyLang);
      var target = p.get(GLOBAL);
      if (!target) return;
      ea.methods.filter(function (name) {
        return source === target[name];
      }).forEach(function (name) {
        delete target[name];
      });
      if (ea.alias) ea.alias.filter(function (name) {
        return source === target[name];
      }).forEach(function (mapping) {
        delete target[mapping[0]];
      });
    } else if (ea.action === "installObject") {
      var p = Path(ea.target);
      p.del(GLOBAL);
    } else throw new Error("Cannot deal with global setup action: " + ea.action);
  });
}

exports.worker = worker;
exports.messenger = messenger;
exports.events = events;
exports.tree = tree;
exports.grid = grid;
exports.arrayProjection = arrayProjection;
exports.interval = interval;
exports.graph = graph;
exports.date = date;
exports.properties = properties;
exports.obj = obj;
exports.arr = arr;
exports.fun = fun;
exports.num = num;
exports.string = string;
exports.Closure = Closure;
exports.promise = promise;
exports.Path = Path;
exports.Group = Group;
exports.livelyLang = livelyLang;
exports.chain = chain$$1;
exports.noConflict = noConflict;
exports.installGlobals = installGlobals;
exports.uninstallGlobals = uninstallGlobals;

}((this.lively.lang = this.lively.lang || {})));

  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.lang;
})();
