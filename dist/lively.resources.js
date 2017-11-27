/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

!(function(global) {
  "use strict";

  var hasOwn = Object.prototype.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var iteratorSymbol =
    typeof Symbol === "function" && Symbol.iterator || "@@iterator";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided, then outerFn.prototype instanceof Generator.
    var generator = Object.create((outerFn || Generator).prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype;
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `value instanceof AwaitArgument` to determine if the yielded value is
  // meant to be awaited. Some may consider the name of this method too
  // cutesy, but they are curmudgeons.
  runtime.awrap = function(arg) {
    return new AwaitArgument(arg);
  };

  function AwaitArgument(arg) {
    this.arg = arg;
  }

  function AsyncIterator(generator) {
    // This invoke function is written in a style that assumes some
    // calling function (or Promise) will handle exceptions.
    function invoke(method, arg) {
      var result = generator[method](arg);
      var value = result.value;
      return value instanceof AwaitArgument
        ? Promise.resolve(value.arg).then(invokeNext, invokeThrow)
        : Promise.resolve(value).then(function(unwrapped) {
            // When a yielded Promise is resolved, its final value becomes
            // the .value of the Promise<{value,done}> result for the
            // current iteration. If the Promise is rejected, however, the
            // result for this iteration will be rejected with the same
            // reason. Note that rejections of yielded Promises are not
            // thrown back into the generator function, as is the case
            // when an awaited Promise is rejected. This difference in
            // behavior between yield and await is important, because it
            // allows the consumer to decide what to do with the yielded
            // rejection (swallow it and continue, manually .throw it back
            // into the generator, abandon iteration, whatever). With
            // await, by contrast, there is no opportunity to examine the
            // rejection reason outside the generator function, so the
            // only option is to throw it from the await expression, and
            // let the generator function handle the exception.
            result.value = unwrapped;
            return result;
          });
    }

    if (typeof process === "object" && process.domain) {
      invoke = process.domain.bind(invoke);
    }

    var invokeNext = invoke.bind(generator, "next");
    var invokeThrow = invoke.bind(generator, "throw");
    var invokeReturn = invoke.bind(generator, "return");
    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return invoke(method, arg);
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : new Promise(function (resolve) {
          resolve(callInvokeWithMethodAndArg());
        });
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          if (method === "return" ||
              (method === "throw" && delegate.iterator[method] === undefined)) {
            // A return or throw (when the delegate iterator has no throw
            // method) always terminates the yield* loop.
            context.delegate = null;

            // If the delegate iterator has a return method, give it a
            // chance to clean up.
            var returnMethod = delegate.iterator["return"];
            if (returnMethod) {
              var record = tryCatch(returnMethod, delegate.iterator, arg);
              if (record.type === "throw") {
                // If the return method threw an exception, let that
                // exception prevail over the original return or throw.
                method = "throw";
                arg = record.arg;
                continue;
              }
            }

            if (method === "return") {
              // Continue with the outer return, now that the delegate
              // iterator has been terminated.
              continue;
            }
          }

          var record = tryCatch(
            delegate.iterator[method],
            delegate.iterator,
            arg
          );

          if (record.type === "throw") {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = record.arg;
            continue;
          }

          // Delegate generator ran and handled its own exceptions so
          // regardless of what the method was, we continue as if it is
          // "next" with an undefined arg.
          method = "next";
          arg = undefined;

          var info = record.arg;
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          context._sent = arg;

          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            context.sent = undefined;
          }
        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          if (context.dispatchException(arg)) {
            // If the dispatched exception was caught by a catch block,
            // then let that catch block handle the exception normally.
            method = "next";
            arg = undefined;
          }

        } else if (method === "return") {
          context.abrupt("return", arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          var info = {
            value: record.arg,
            done: context.done
          };

          if (record.arg === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = undefined;
            }
          } else {
            return info;
          }

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(arg) call above.
          method = "throw";
          arg = record.arg;
        }
      }
    };
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      this.sent = undefined;
      this.done = false;
      this.delegate = null;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;
        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.next = finallyEntry.finallyLoc;
      } else {
        this.complete(record);
      }

      return ContinueSentinel;
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = record.arg;
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
})(
  // Among the various tricks for obtaining a reference to the global
  // object, this seems to be the most reliable technique that does not
  // use indirect eval (which violates Content Security Policy).
  typeof global === "object" ? global :
  typeof window === "object" ? window :
  typeof self === "object" ? self : this
);

(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,fs) {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};









var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
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







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

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

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
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

function applyExclude(exclude, resources) {
  if (Array.isArray(exclude)) return exclude.reduce(function (intersect, exclude) {
    return applyExclude(exclude, intersect);
  }, resources);
  if (typeof exclude === "string") return resources.filter(function (ea) {
    return ea.path() !== exclude && ea.name() !== exclude;
  });
  if (exclude instanceof RegExp) return resources.filter(function (ea) {
    return !exclude.test(ea.path()) && !exclude.test(ea.name());
  });
  if (typeof exclude === "function") return resources.filter(function (ea) {
    return !exclude(ea);
  });
  return resources;
}

/*

applyExclude(["foo", "foo"], [
  {path: () => "foo", name: () => "foo"},
  {path: () => "bar", name: () => "bar"},
  {path: () => "baz", name: () => "baz"}
])

applyExclude(["bar", "foo"], [
  {path: () => "foo", name: () => "foo"},
  {path: () => "bar", name: () => "bar"},
  {path: () => "baz", name: () => "baz"}
])

*/

// parseQuery('?hello=world&x={"foo":{"bar": "baz"}}')
// parseQuery("?db=test-object-db&url=lively.morphic%2Fworlds%2Fdefault.json&type=world&name=default&commitSpec=%7B%22user%22%3A%7B%22name%22%3A%22robert%22%2C%22realm%22%3A%22https%3A%2F%2Fauth.lively-next.org%22%2C%22email%22%3A%22robert%40kra.hn%22%7D%2C%22description%22%3A%22An%20empty%20world.%20A%20place%20to%20start%20from%20scratch.%22%2C%22metadata%22%3A%7B%22belongsToCore%22%3Atrue%7D%7D&purgeHistory=true")

function parseQuery(url) {
  var url = url,
      _url$split = url.split("?"),
      _url$split2 = slicedToArray(_url$split, 2),
      _ = _url$split2[0],
      search = _url$split2[1],
      query = {};

  if (!search) return query;
  var args = search.split("&");
  if (args) for (var i = 0; i < args.length; i++) {
    var keyAndVal = args[i].split("="),
        key = keyAndVal[0],
        val = true;
    if (keyAndVal.length > 1) {
      val = decodeURIComponent(keyAndVal.slice(1).join("="));
      if (val === "undefined") val = undefined;else if (val.match(/^(true|false|null|[0-9"[{].*)$/)) try {
        val = JSON.parse(val);
      } catch (e) {
        if (val[0] === "[") val = val.slice(1, -1).split(","); // handle string arrays
        // if not JSON use string itself
      }
    }
    query[key] = val;
  }
  return query;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var slashEndRe$1 = /\/+$/;
var slashStartRe$1 = /^\/+/;
var urlRe = /^([^:\/]+):\/\/([^\/]*)(.*)/;
var pathDotRe = /\/\.\//g;
var pathDoubleDotRe = /\/[^\/]+\/\.\./;
var pathDoubleSlashRe = /(^|[^:])[\/]+/g;

function withRelativePartsResolved$1(inputPath) {
  var path = inputPath,
      result = path;

  // /foo/../bar --> /bar
  do {
    path = result;
    result = path.replace(pathDoubleDotRe, '');
  } while (result != path);

  // foo//bar --> foo/bar
  result = result.replace(pathDoubleSlashRe, '$1/');

  // foo/./bar --> foo/bar
  result = result.replace(pathDotRe, '/');

  return result;
}

function _relativePathBetween_checkPathes(path1, path2) {
  if (path1.startsWith("/")) path1 = path1.slice(1);
  if (path2.startsWith("/")) path2 = path2.slice(1);
  var paths1 = path1.split('/'),
      paths2 = path2.split('/');
  for (var i = 0; i < paths2.length; i++) {
    if (!paths1[i] || paths1[i] != paths2[i]) break;
  } // now that's some JavaScript FOO
  var result = '../'.repeat(Math.max(0, paths2.length - i - 1)) + paths1.splice(i, paths1.length).join('/');
  return result;
}

// pathA = "http://foo/bar/"
// pathB = "http://foo/bar/oink/baz.js";

function relativePathBetween(pathA, pathB) {
  // produces the relative path to get from `pathA` to `pathB`
  // Example:
  //   relativePathBetween("/foo/bar/", "/foo/baz.js"); // => ../baz.js
  var urlMatchA = pathA.match(urlRe),
      urlMatchB = pathB.match(urlRe),
      protocolA = void 0,
      domainA = void 0,
      protocolB = void 0,
      domainB = void 0,
      compatible = true;
  if (urlMatchA && !urlMatchB || !urlMatchA && urlMatchB) compatible = false;
  if (urlMatchA && urlMatchB) {
    protocolA = urlMatchA[1];
    domainA = urlMatchA[2];
    protocolB = urlMatchB[1];
    domainB = urlMatchB[2];
    if (protocolA !== protocolB) compatible = false;else if (domainA !== domainB) compatible = false;else {
      pathA = urlMatchA[3];pathB = urlMatchB[3];
    }
  }
  if (!compatible) throw new Error("[relativePathBetween] incompatible paths: " + pathA + " vs. " + pathB);
  pathA = withRelativePartsResolved$1(pathA);
  pathB = withRelativePartsResolved$1(pathB);
  if (pathA == pathB) return '';
  var relPath = _relativePathBetween_checkPathes(pathB, pathA);
  if (!relPath) throw new Error('pathname differs in relativePathFrom ' + pathA + ' vs ' + pathB);
  return relPath;
}

function join$1(pathA, pathB) {
  return withRelativePartsResolved$1(pathA.replace(slashEndRe$1, "") + "/" + pathB.replace(slashStartRe$1, ""));
}

function parent$1(path) {
  if (!path.startsWith("/")) return "";
  return path.replace(slashEndRe$1, "").split("/").slice(0, -1).join("/") + "/";
}

var slashEndRe = /\/+$/;
var slashStartRe = /^\/+/;
var protocolRe = /^[a-z0-9-_\.]+:/;
var slashslashRe = /^\/\/[^\/]+/;

function nyi(obj, name) {
  throw new Error(name + " for " + obj.constructor.name + " not yet implemented");
}

var Resource$$1 = function () {
  createClass(Resource$$1, null, [{
    key: "fromProps",
    value: function fromProps() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      // props can have the keys contentType, type, size, etag, created, lastModified, url
      // it should have at least url
      return new this(props.url).assignProperties(props);
    }
  }]);

  function Resource$$1(url) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, Resource$$1);

    if (!url) throw new Error("Cannot create resource without url");
    this.url = String(url);
    this.binary = false;
    this.lastModified = undefined;
    this.created = undefined;
    this.etag = undefined;
    this.size = undefined;
    this.type = undefined;
    this.contentType = undefined;
    this.user = undefined;
    this.group = undefined;
    this.mode = undefined;
    this._isDirectory = undefined;
    this._isLink = undefined;
    this.linkCount = undefined;
  }

  createClass(Resource$$1, [{
    key: "equals",
    value: function equals(otherResource) {
      if (!otherResource || this.constructor !== otherResource.constructor) return false;
      var myURL = this.url,
          otherURL = otherResource.url;
      if (myURL[myURL.length - 1] === "/") myURL = myURL.slice(0, -1);
      if (otherURL[otherURL.length - 1] === "/") otherURL = otherURL.slice(0, -1);
      return myURL === otherURL;
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.constructor.name + "(\"" + this.url + "\")";
    }
  }, {
    key: "newResource",
    value: function newResource(url) {
      return resource(url);
    }
  }, {
    key: "path",
    value: function path() {
      var path = this.url.replace(protocolRe, "").replace(slashslashRe, "");
      return path === "" ? "/" : path;
    }
  }, {
    key: "pathWithoutQuery",
    value: function pathWithoutQuery() {
      return this.path().split("?")[0];
    }
  }, {
    key: "name",
    value: function name() {
      var path = this.path(),
          queryIndex = path.lastIndexOf("?");
      if (queryIndex > -1) path = path.slice(0, queryIndex);
      if (path.endsWith("/")) path = path.slice(0, -1);
      var parts = path.split("/"),
          lastPart = parts[parts.length - 1];
      return decodeURIComponent(lastPart);
    }
  }, {
    key: "ext",
    value: function ext() {
      var url = this.url;
      if (url.endsWith("/")) return "";

      var _ref = url.match(/\.([^\/\.]+$)/) || ["", ""],
          _ref2 = slicedToArray(_ref, 2),
          _ = _ref2[0],
          ext = _ref2[1];

      return ext.toLowerCase();
    }
  }, {
    key: "nameWithoutExt",
    value: function nameWithoutExt() {
      var name = this.name(),
          extIndex = name.lastIndexOf(".");
      if (extIndex > 0) name = name.slice(0, extIndex);
      return name;
    }
  }, {
    key: "scheme",
    value: function scheme() {
      return this.url.split(":")[0];
    }
  }, {
    key: "host",
    value: function host() {
      var idx = this.url.indexOf("://");
      if (idx === -1) return null;
      var noScheme = this.url.slice(idx + 3),
          slashIdx = noScheme.indexOf("/");
      return noScheme.slice(0, slashIdx > -1 ? slashIdx : noScheme.length);
    }
  }, {
    key: "schemeAndHost",
    value: function schemeAndHost() {
      if (this.isRoot()) return this.asFile().url;
      return this.url.slice(0, this.url.length - this.path().length);
    }
  }, {
    key: "parent",
    value: function parent() {
      return this.isRoot() ? null : this.newResource(this.url.replace(slashEndRe, "").split("/").slice(0, -1).join("/") + "/");
    }
  }, {
    key: "parents",
    value: function parents() {
      var result = [],
          p = this.parent();
      while (p) {
        result.unshift(p);p = p.parent();
      }
      return result;
    }
  }, {
    key: "isParentOf",
    value: function isParentOf(otherRes) {
      var _this = this;

      return otherRes.schemeAndHost() === this.schemeAndHost() && otherRes.parents().some(function (p) {
        return p.equals(_this);
      });
    }
  }, {
    key: "query",
    value: function query() {
      return parseQuery(this.url);
    }
  }, {
    key: "withQuery",
    value: function withQuery(queryObj) {
      var query = _extends({}, this.query(), queryObj),
          _url$split = this.url.split("?"),
          _url$split2 = slicedToArray(_url$split, 1),
          url = _url$split2[0],
          queryString = Object.keys(query).map(function (key) {
        return key + "=" + encodeURIComponent(String(query[key]));
      }).join("&");

      return this.newResource(url + "?" + queryString);
    }
  }, {
    key: "commonDirectory",
    value: function commonDirectory(other) {
      if (other.schemeAndHost() !== this.schemeAndHost()) return null;
      if (this.isDirectory() && this.equals(other)) return this;
      if (this.isRoot()) return this.asDirectory();
      if (other.isRoot()) return other.asDirectory();
      var otherParents = other.parents(),
          myParents = this.parents(),
          common = this.root();
      for (var i = 0; i < myParents.length; i++) {
        var myP = myParents[i],
            otherP = otherParents[i];
        if (!otherP || !myP.equals(otherP)) return common;
        common = myP;
      }
      return common;
    }
  }, {
    key: "withRelativePartsResolved",
    value: function withRelativePartsResolved() {
      var path = this.path(),
          result = withRelativePartsResolved$1(path);
      if (result === path) return this;
      if (result.startsWith("/")) result = result.slice(1);
      return this.newResource(this.root().url + result);
    }
  }, {
    key: "relativePathFrom",
    value: function relativePathFrom(fromResource) {
      return relativePathBetween(fromResource.url, this.url);
    }
  }, {
    key: "withPath",
    value: function withPath(path) {
      var root = this.isRoot() ? this : this.root();
      return root.join(path);
    }
  }, {
    key: "join",
    value: function join$1(path) {
      return this.newResource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
    }
  }, {
    key: "isRoot",
    value: function isRoot() {
      return this.path() === "/";
    }
  }, {
    key: "isFile",
    value: function isFile() {
      return !this.isRoot() && !this.url.match(slashEndRe);
    }
  }, {
    key: "isDirectory",
    value: function isDirectory() {
      return !this.isFile();
    }
  }, {
    key: "asDirectory",
    value: function asDirectory() {
      if (this.url.endsWith("/")) return this;
      return this.newResource(this.url.replace(slashEndRe, "") + "/");
    }
  }, {
    key: "root",
    value: function root() {
      if (this.isRoot()) return this;
      var toplevel = this.url.slice(0, -this.path().length);
      return this.newResource(toplevel + "/");
    }
  }, {
    key: "asFile",
    value: function asFile() {
      if (!this.url.endsWith("/")) return this;
      return this.newResource(this.url.replace(slashEndRe, ""));
    }
  }, {
    key: "assignProperties",
    value: function assignProperties(props) {
      // lastModified, etag, ...
      for (var name in props) {
        if (name === "url") continue;
        // rename some properties to not create conflicts
        var myPropName = name;
        if (name === "isLink" || name === "isDirectory") myPropName = "_" + name;
        this[myPropName] = props[name];
      }
      return this;
    }
  }, {
    key: "ensureExistance",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee(optionalContent) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.exists();

              case 2:
                if (!_context.sent) {
                  _context.next = 4;
                  break;
                }

                return _context.abrupt("return", this);

              case 4:
                _context.next = 6;
                return this.parent().ensureExistance();

              case 6:
                if (!this.isFile()) {
                  _context.next = 11;
                  break;
                }

                _context.next = 9;
                return this.write(optionalContent || "");

              case 9:
                _context.next = 13;
                break;

              case 11:
                _context.next = 13;
                return this.mkdir();

              case 13:
                return _context.abrupt("return", this);

              case 14:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ensureExistance(_x3) {
        return _ref3.apply(this, arguments);
      }

      return ensureExistance;
    }()
  }, {
    key: "copyTo",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(otherResource) {
        var _this2 = this;

        var ensureParent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var toFile, fromResources, toResources;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (!this.isFile()) {
                  _context2.next = 13;
                  break;
                }

                toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());

                if (!ensureParent) {
                  _context2.next = 5;
                  break;
                }

                _context2.next = 5;
                return toFile.parent().ensureExistance();

              case 5:
                _context2.t0 = toFile;
                _context2.next = 8;
                return this.read();

              case 8:
                _context2.t1 = _context2.sent;
                _context2.next = 11;
                return _context2.t0.write.call(_context2.t0, _context2.t1);

              case 11:
                _context2.next = 25;
                break;

              case 13:
                if (otherResource.isDirectory()) {
                  _context2.next = 15;
                  break;
                }

                throw new Error("Cannot copy a directory to a file!");

              case 15:
                _context2.next = 17;
                return this.dirList('infinity');

              case 17:
                fromResources = _context2.sent;
                toResources = fromResources.map(function (ea) {
                  return otherResource.join(ea.relativePathFrom(_this2));
                });
                _context2.next = 21;
                return otherResource.ensureExistance();

              case 21:
                _context2.next = 23;
                return fromResources.reduceRight(function (next, ea, i) {
                  return function () {
                    return Promise.resolve(ea.isDirectory() && toResources[i].ensureExistance()).then(next);
                  };
                }, function () {
                  return Promise.resolve();
                })();

              case 23:
                _context2.next = 25;
                return fromResources.reduceRight(function (next, ea, i) {
                  return function () {
                    return Promise.resolve(ea.isFile() && ea.copyTo(toResources[i], false)).then(next);
                  };
                }, function () {
                  return Promise.resolve();
                })();

              case 25:
                return _context2.abrupt("return", this);

              case 26:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function copyTo(_x4) {
        return _ref4.apply(this, arguments);
      }

      return copyTo;
    }()
  }, {
    key: "rename",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(otherResource) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.copyTo(otherResource);

              case 2:
                this.remove();
                return _context3.abrupt("return", otherResource);

              case 4:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function rename$$1(_x6) {
        return _ref5.apply(this, arguments);
      }

      return rename$$1;
    }()
  }, {
    key: "beBinary",
    value: function beBinary(bool) {
      return this.setBinary(true);
    }
  }, {
    key: "setBinary",
    value: function setBinary(bool) {
      this.binary = bool;
      return this;
    }
  }, {
    key: "read",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                nyi(this, "read");
              case 1:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function read() {
        return _ref6.apply(this, arguments);
      }

      return read;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                nyi(this, "write");
              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function write() {
        return _ref7.apply(this, arguments);
      }

      return write;
    }()
  }, {
    key: "mkdir",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                nyi(this, "mkdir");
              case 1:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function mkdir() {
        return _ref8.apply(this, arguments);
      }

      return mkdir;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                nyi(this, "exists");
              case 1:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function exists() {
        return _ref9.apply(this, arguments);
      }

      return exists;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                nyi(this, "remove");
              case 1:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function remove() {
        return _ref10.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "dirList",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(depth, opts) {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                nyi(this, "dirList");
              case 1:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function dirList(_x7, _x8) {
        return _ref11.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "readProperties",
    value: function () {
      var _ref12 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(opts) {
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                nyi(this, "readProperties");
              case 1:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function readProperties(_x9) {
        return _ref12.apply(this, arguments);
      }

      return readProperties;
    }()
  }, {
    key: "writeJson",
    value: function writeJson(obj) {
      var pretty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      return this.write(pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
    }
  }, {
    key: "readJson",
    value: function () {
      var _ref13 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(obj) {
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                _context11.t0 = JSON;
                _context11.next = 3;
                return this.read();

              case 3:
                _context11.t1 = _context11.sent;
                return _context11.abrupt("return", _context11.t0.parse.call(_context11.t0, _context11.t1));

              case 5:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function readJson(_x11) {
        return _ref13.apply(this, arguments);
      }

      return readJson;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "__serialize__",
    value: function __serialize__() {
      return { __expr__: "var r = null; try { r = resource(\"" + this.url + "\");} catch (err) {}; r", bindings: { "lively.resources": ["resource"] } };
    }
  }, {
    key: "isResource",
    get: function get() {
      return true;
    }
  }, {
    key: "canDealWithJSON",
    get: function get() {
      return false;
    }
  }]);
  return Resource$$1;
}();

/*global fetch, DOMParser, XPathEvaluator, XPathResult, Namespace,System,global,process*/

var XPathQuery = function () {
  function XPathQuery(expression) {
    classCallCheck(this, XPathQuery);

    this.expression = expression;
    this.contextNode = null;
    this.xpe = new XPathEvaluator();
  }

  createClass(XPathQuery, [{
    key: "establishContext",
    value: function establishContext(node) {
      if (this.nsResolver) return;
      var ctx = node.ownerDocument ? node.ownerDocument.documentElement : node.documentElement;
      if (ctx !== this.contextNode) {
        this.contextNode = ctx;
        this.nsResolver = this.xpe.createNSResolver(ctx);
      }
    }
  }, {
    key: "manualNSLookup",
    value: function manualNSLookup() {
      this.nsResolver = function (prefix) {
        return Namespace[prefix.toUpperCase()] || null;
      };
      return this;
    }
  }, {
    key: "findAll",
    value: function findAll(node, defaultValue) {
      this.establishContext(node);
      var result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null),
          accumulator = [],
          res = null;
      while (res = result.iterateNext()) {
        accumulator.push(res);
      }return accumulator.length > 0 || defaultValue === undefined ? accumulator : defaultValue;
    }
  }, {
    key: "findFirst",
    value: function findFirst(node) {
      this.establishContext(node);
      var result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null);
      return result.iterateNext();
    }
  }]);
  return XPathQuery;
}();

function davNs(xmlString) {
  // finds the declaration of the webdav namespace, usually "d" or "D"
  var davNSMatch = xmlString.match(/\/([a-z]+?):multistatus/i);
  return davNSMatch ? davNSMatch[1] : "d";
}

var propertyNodeMap = {
  getlastmodified: "lastModified",
  creationDate: "created",
  getetag: "etag",
  getcontentlength: "size",
  resourcetype: "type", // collection or file
  getcontenttype: "contentType" // mime type
};
function readPropertyNode(propNode) {
  var result = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var tagName = propNode.tagName.replace(/[^:]+:/, ""),
      key = propertyNodeMap[tagName],
      value = propNode.textContent;
  switch (key) {
    case 'lastModified':
    case 'created':
      value = new Date(value);break;
    case 'size':
      value = Number(value);break;
    default:
    // code
  }
  result[key] = value;
  return result;
}

function readXMLPropfindResult(xmlString) {
  // the xmlString looks like this:
  // <?xml version="1.0" encoding="utf-8"?>
  // <d:multistatus xmlns:d="DAV:" xmlns:a="http://ajax.org/2005/aml">
  //   <d:response>
  //     <d:href>sub-dir/</d:href>
  //     <d:propstat>
  //       <d:prop>
  //         <d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">Fri, 24 Jun 2016 09:58:20 -0700</d:getlastmodified>
  //         <d:resourcetype>
  //           <d:collection/>
  //         </d:resourcetype>
  //       </d:prop>
  //       <d:status>HTTP/1.1 200 Ok</d:status>
  //     </d:propstat>
  //   </d:response>
  // ...
  // </d:multistatus>

  var doc = new DOMParser().parseFromString(xmlString, "text/xml"),
      ns = davNs(xmlString),
      nodes = new XPathQuery("/" + ns + ":multistatus/" + ns + ":response").findAll(doc.documentElement),
      urlQ = new XPathQuery(ns + ":href"),
      propsQ = new XPathQuery(ns + ":propstat/" + ns + ":prop");

  return nodes.map(function (node) {
    var propsNode = propsQ.findFirst(node),
        props = Array.from(propsNode.childNodes).reduce(function (props, node) {
      return readPropertyNode(node, props);
    }, {}),
        urlNode = urlQ.findFirst(node);
    props.url = urlNode.textContent || urlNode.text; // text is FIX for IE9+;
    return props;
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// MIT License Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>
// https://github.com/sindresorhus/binary-extensions
var binaryExtensions = ["3ds", "3g2", "3gp", "7z", "a", "aac", "adp", "ai", "aif", "aiff", "alz", "ape", "apk", "ar", "arj", "asf", "au", "avi", "bak", "bh", "bin", "bk", "bmp", "btif", "bz2", "bzip2", "cab", "caf", "cgm", "class", "cmx", "cpio", "cr2", "csv", "cur", "dat", "deb", "dex", "djvu", "dll", "dmg", "dng", "doc", "docm", "docx", "dot", "dotm", "dra", "DS_Store", "dsk", "dts", "dtshd", "dvb", "dwg", "dxf", "ecelp4800", "ecelp7470", "ecelp9600", "egg", "eol", "eot", "epub", "exe", "f4v", "fbs", "fh", "fla", "flac", "fli", "flv", "fpx", "fst", "fvt", "g3", "gif", "graffle", "gz", "gzip", "h261", "h263", "h264", "icns", "ico", "ief", "img", "ipa", "iso", "jar", "jpeg", "jpg", "jpgv", "jpm", "jxr", "key", "ktx", "lha", "lvp", "lz", "lzh", "lzma", "lzo", "m3u", "m4a", "m4v", "mar", "mdi", "mht", "mid", "midi", "mj2", "mka", "mkv", "mmr", "mng", "mobi", "mov", "movie", "mp3", "mp4", "mp4a", "mpeg", "mpg", "mpga", "mxu", "nef", "npx", "numbers", "o", "oga", "ogg", "ogv", "otf", "pages", "pbm", "pcx", "pdf", "pea", "pgm", "pic", "png", "pnm", "pot", "potm", "potx", "ppa", "ppam", "ppm", "pps", "ppsm", "ppsx", "ppt", "pptm", "pptx", "psd", "pya", "pyc", "pyo", "pyv", "qt", "rar", "ras", "raw", "rgb", "rip", "rlc", "rmf", "rmvb", "rtf", "rz", "s3m", "s7z", "scpt", "sgi", "shar", "sil", "sketch", "slk", "smv", "so", "sub", "swf", "tar", "tbz", "tbz2", "tga", "tgz", "thmx", "tif", "tiff", "tlz", "ttc", "ttf", "txz", "udf", "uvh", "uvi", "uvm", "uvp", "uvs", "uvu", "viv", "vob", "war", "wav", "wax", "wbmp", "wdp", "weba", "webm", "webp", "whl", "wim", "wm", "wma", "wmv", "wmx", "woff", "woff2", "wvx", "xbm", "xif", "xla", "xlam", "xls", "xlsb", "xlsm", "xlsx", "xlt", "xltm", "xltx", "xm", "xmind", "xpi", "xpm", "xwd", "xz", "z", "zip", "zipx"];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var isNode = typeof System !== "undefined" ? System.get("@system-env").node : typeof global !== "undefined" && typeof process !== "undefined";

function defaultOrigin() {
  // FIXME nodejs usage???
  return document.location.origin;
}

function makeRequest(resource) {
  var method = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "GET";
  var body = arguments[2];
  var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var url = resource.url,
      useCors = resource.useCors,
      useProxy = resource.useProxy,
      moreHeaders = resource.headers,
      useCors = typeof useCors !== "undefined" ? useCors : true,
      useProxy = typeof useProxy !== "undefined" ? useProxy : true,
      fetchOpts = { method: method };


  if (useProxy) {
    Object.assign(headers, {
      'pragma': 'no-cache',
      'cache-control': 'no-cache',
      "x-lively-proxy-request": url
    });

    url = defaultOrigin();
  }

  if (useCors) fetchOpts.mode = "cors";
  if (body) fetchOpts.body = body;
  fetchOpts.redirect = 'follow';
  fetchOpts.headers = _extends({}, headers, moreHeaders);

  return fetch(url, fetchOpts);
}

var WebDAVResource = function (_Resource) {
  inherits(WebDAVResource, _Resource);

  function WebDAVResource(url) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, WebDAVResource);

    var _this = possibleConstructorReturn(this, (WebDAVResource.__proto__ || Object.getPrototypeOf(WebDAVResource)).call(this, url, opts));

    _this.useProxy = opts.hasOwnProperty("useProxy") ? opts.useProxy : false;
    _this.useCors = opts.hasOwnProperty("useCors") ? opts.useCors : false;
    _this.headers = opts.headers || {};
    _this.binary = _this.isFile() ? binaryExtensions.includes(_this.ext()) : false;
    _this.errorOnHTTPStatusCodes = opts.hasOwnProperty("errorOnHTTPStatusCodes") ? opts.errorOnHTTPStatusCodes : true;
    return _this;
  }

  createClass(WebDAVResource, [{
    key: "join",
    value: function join(path) {
      return Object.assign(get$1(WebDAVResource.prototype.__proto__ || Object.getPrototypeOf(WebDAVResource.prototype), "join", this).call(this, path), { headers: this.headers, useCors: this.useCors, useProxy: this.useProxy });
    }
  }, {
    key: "makeProxied",
    value: function makeProxied() {
      return this.useProxy ? this : new this.constructor(this.url, { headers: this.headers, useCors: this.useCors, useProxy: true });
    }
  }, {
    key: "noErrorOnHTTPStatusCodes",
    value: function noErrorOnHTTPStatusCodes() {
      this.errorOnHTTPStatusCodes = false;return this;
    }
  }, {
    key: "read",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        var res;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return makeRequest(this);

              case 2:
                res = _context.sent;

                if (!(!res.ok && this.errorOnHTTPStatusCodes)) {
                  _context.next = 5;
                  break;
                }

                throw new Error("Cannot read " + this.url + ": " + res.statusText + " " + res.status);

              case 5:
                if (this.binary) {
                  _context.next = 7;
                  break;
                }

                return _context.abrupt("return", res.text());

              case 7:
                if (!(this.binary === "blob")) {
                  _context.next = 9;
                  break;
                }

                return _context.abrupt("return", res.blob());

              case 9:
                if (!(typeof res.arrayBuffer === "function")) {
                  _context.next = 11;
                  break;
                }

                return _context.abrupt("return", res.arrayBuffer());

              case 11:
                if (!(typeof res.buffer === "function")) {
                  _context.next = 13;
                  break;
                }

                return _context.abrupt("return", res.buffer());

              case 13:
                throw new Error("Don't now how to read binary resource " + this + "'");

              case 14:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function read() {
        return _ref.apply(this, arguments);
      }

      return read;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(content) {
        var res;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (this.isFile()) {
                  _context2.next = 2;
                  break;
                }

                throw new Error("Cannot write a non-file: " + this.url);

              case 2:
                _context2.next = 4;
                return makeRequest(this, "PUT", content);

              case 4:
                res = _context2.sent;

                if (!(!res.ok && this.errorOnHTTPStatusCodes)) {
                  _context2.next = 7;
                  break;
                }

                throw new Error("Cannot write " + this.url + ": " + res.statusText + " " + res.status);

              case 7:
                return _context2.abrupt("return", this);

              case 8:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function write(_x5) {
        return _ref2.apply(this, arguments);
      }

      return write;
    }()
  }, {
    key: "mkdir",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        var res;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!this.isFile()) {
                  _context3.next = 2;
                  break;
                }

                throw new Error("Cannot mkdir on a file: " + this.url);

              case 2:
                _context3.next = 4;
                return makeRequest(this, "MKCOL");

              case 4:
                res = _context3.sent;

                if (!(!res.ok && this.errorOnHTTPStatusCodes)) {
                  _context3.next = 7;
                  break;
                }

                throw new Error("Cannot create directory " + this.url + ": " + res.statusText + " " + res.status);

              case 7:
                return _context3.abrupt("return", this);

              case 8:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function mkdir() {
        return _ref3.apply(this, arguments);
      }

      return mkdir;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (!this.isRoot()) {
                  _context4.next = 4;
                  break;
                }

                _context4.t0 = true;
                _context4.next = 7;
                break;

              case 4:
                _context4.next = 6;
                return makeRequest(this, "HEAD");

              case 6:
                _context4.t0 = !!_context4.sent.ok;

              case 7:
                return _context4.abrupt("return", _context4.t0);

              case 8:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function exists() {
        return _ref4.apply(this, arguments);
      }

      return exists;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return makeRequest(this, "DELETE");

              case 2:
                return _context5.abrupt("return", this);

              case 3:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function remove() {
        return _ref5.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "_propfind",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var res, xmlString, root;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return makeRequest(this, "PROPFIND", null, // propfindRequestPayload(),
                {
                  'Content-Type': 'text/xml'
                  // rk 2016-06-24: jsDAV does not support PROPFIND via depth: 'infinity'
                  // 'Depth': String(depth)
                });

              case 2:
                res = _context6.sent;

                if (!(!res.ok && this.errorOnHTTPStatusCodes)) {
                  _context6.next = 5;
                  break;
                }

                throw new Error("Error in dirList for " + this.url + ": " + res.statusText);

              case 5:
                _context6.next = 7;
                return res.text();

              case 7:
                xmlString = _context6.sent;
                root = this.root();
                return _context6.abrupt("return", readXMLPropfindResult(xmlString).map(function (props) {
                  return root.join(props.url).assignProperties(props);
                }));

              case 10:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function _propfind() {
        return _ref6.apply(this, arguments);
      }

      return _propfind;
    }()
  }, {
    key: "dirList",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var exclude, resources, self, subResources, subCollections;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                if (!(typeof depth !== "number" && depth !== 'infinity')) {
                  _context7.next = 2;
                  break;
                }

                throw new Error("dirList \u2013 invalid depth argument: " + depth);

              case 2:
                exclude = opts.exclude;


                if (depth <= 0) depth = 1;

                if (!(depth === 1)) {
                  _context7.next = 13;
                  break;
                }

                _context7.next = 7;
                return this._propfind();

              case 7:
                resources = _context7.sent;
                self = resources.shift();

                if (exclude) resources = applyExclude(exclude, resources);
                return _context7.abrupt("return", resources);

              case 13:
                _context7.next = 15;
                return this.dirList(1, opts);

              case 15:
                subResources = _context7.sent;
                subCollections = subResources.filter(function (ea) {
                  return ea.isDirectory();
                });
                return _context7.abrupt("return", Promise.all(subCollections.map(function (col) {
                  return col.dirList(typeof depth === "number" ? depth - 1 : depth, opts);
                })).then(function (recursiveResult) {
                  return recursiveResult.reduce(function (all, ea) {
                    return all.concat(ea);
                  }, subResources);
                }));

              case 18:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function dirList() {
        return _ref7.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "readProperties",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(opts) {
        var props;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this._propfind();

              case 2:
                props = _context8.sent[0];
                return _context8.abrupt("return", this.assignProperties(props));

              case 4:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function readProperties(_x8) {
        return _ref8.apply(this, arguments);
      }

      return readProperties;
    }()
  }, {
    key: "post",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9() {
        var body = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
        var res, text, json;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (typeof body !== "string") body = JSON.stringify(body);
                _context9.next = 3;
                return makeRequest(this, "POST", body, {});

              case 3:
                res = _context9.sent;
                text = void 0;
                json = void 0;
                _context9.prev = 6;
                _context9.next = 9;
                return res.text();

              case 9:
                text = _context9.sent;
                _context9.next = 14;
                break;

              case 12:
                _context9.prev = 12;
                _context9.t0 = _context9["catch"](6);

              case 14:
                if (text && res.headers.get("content-type") === "application/json") {
                  try {
                    json = JSON.parse(text);
                  } catch (err) {}
                }

                if (!(!res.ok && this.errorOnHTTPStatusCodes)) {
                  _context9.next = 19;
                  break;
                }

                throw new Error("Error in POST " + this.url + ": " + (text || res.statusText));

              case 19:
                return _context9.abrupt("return", json || text);

              case 20:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this, [[6, 12]]);
      }));

      function post() {
        return _ref9.apply(this, arguments);
      }

      return post;
    }()
  }, {
    key: "copyTo",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(otherResource) {
        var ensureParent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var toFile;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                if (!this.isFile()) {
                  _context10.next = 7;
                  break;
                }

                toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
                // optimized copy, using pipes, for HTTP

                if (!isNode) {
                  _context10.next = 7;
                  break;
                }

                if (!toFile.isHTTPResource) {
                  _context10.next = 5;
                  break;
                }

                return _context10.abrupt("return", this._copyTo_file_nodejs_http(toFile, ensureParent));

              case 5:
                if (!toFile.isNodeJSFileResource) {
                  _context10.next = 7;
                  break;
                }

                return _context10.abrupt("return", this._copyTo_file_nodejs_fs(toFile, ensureParent));

              case 7:
                return _context10.abrupt("return", get$1(WebDAVResource.prototype.__proto__ || Object.getPrototypeOf(WebDAVResource.prototype), "copyTo", this).call(this, otherResource, ensureParent));

              case 8:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function copyTo(_x10) {
        return _ref10.apply(this, arguments);
      }

      return copyTo;
    }()
  }, {
    key: "_copyFrom_file_nodejs_fs",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(fromFile) {
        var ensureParent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var error, stream, toRes;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                if (!ensureParent) {
                  _context11.next = 3;
                  break;
                }

                _context11.next = 3;
                return this.parent().ensureExistance();

              case 3:
                error = void 0;
                stream = fromFile._createReadStream();

                stream.on("error", function (err) {
                  return error = err;
                });
                _context11.next = 8;
                return makeRequest(this, "PUT", stream);

              case 8:
                toRes = _context11.sent;

                if (!error) {
                  _context11.next = 11;
                  break;
                }

                throw error;

              case 11:
                if (!(!toRes.ok && this.errorOnHTTPStatusCodes)) {
                  _context11.next = 13;
                  break;
                }

                throw new Error("copyTo: Cannot GET: " + toRes.statusText + " " + toRes.status);

              case 13:
                return _context11.abrupt("return", this);

              case 14:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function _copyFrom_file_nodejs_fs(_x12) {
        return _ref11.apply(this, arguments);
      }

      return _copyFrom_file_nodejs_fs;
    }()
  }, {
    key: "_copyTo_file_nodejs_fs",
    value: function () {
      var _ref12 = asyncToGenerator(regeneratorRuntime.mark(function _callee12(toFile) {
        var _this2 = this;

        var ensureParent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var fromRes, error;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                if (!ensureParent) {
                  _context12.next = 3;
                  break;
                }

                _context12.next = 3;
                return toFile.parent().ensureExistance();

              case 3:
                _context12.next = 5;
                return makeRequest(this, "GET");

              case 5:
                fromRes = _context12.sent;

                if (!(!fromRes.ok && this.errorOnHTTPStatusCodes)) {
                  _context12.next = 8;
                  break;
                }

                throw new Error("copyTo: Cannot GET: " + fromRes.statusText + " " + fromRes.status);

              case 8:
                error = void 0;
                return _context12.abrupt("return", new Promise(function (resolve, reject) {
                  return fromRes.body.pipe(toFile._createWriteStream()).on("error", function (err) {
                    return error = err;
                  }).on("finish", function () {
                    return error ? reject(error) : resolve(_this2);
                  });
                }));

              case 10:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function _copyTo_file_nodejs_fs(_x14) {
        return _ref12.apply(this, arguments);
      }

      return _copyTo_file_nodejs_fs;
    }()
  }, {
    key: "_copyTo_file_nodejs_http",
    value: function () {
      var _ref13 = asyncToGenerator(regeneratorRuntime.mark(function _callee13(toFile) {
        var ensureParent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var fromRes, toRes;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                if (!ensureParent) {
                  _context13.next = 3;
                  break;
                }

                _context13.next = 3;
                return toFile.parent().ensureExistance();

              case 3:
                _context13.next = 5;
                return makeRequest(this, "GET");

              case 5:
                fromRes = _context13.sent;

                if (!(!fromRes.ok && this.errorOnHTTPStatusCodes)) {
                  _context13.next = 8;
                  break;
                }

                throw new Error("copyTo: Cannot GET: " + fromRes.statusText + " " + fromRes.status);

              case 8:
                _context13.next = 10;
                return makeRequest(toFile, "PUT", fromRes.body);

              case 10:
                toRes = _context13.sent;

                if (!(!fromRes.ok && this.errorOnHTTPStatusCodes)) {
                  _context13.next = 13;
                  break;
                }

                throw new Error("copyTo: Cannot PUT: " + toRes.statusText + " " + toRes.status);

              case 13:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function _copyTo_file_nodejs_http(_x16) {
        return _ref13.apply(this, arguments);
      }

      return _copyTo_file_nodejs_http;
    }()
  }, {
    key: "isHTTPResource",
    get: function get() {
      return true;
    }
  }]);
  return WebDAVResource;
}(Resource$$1);

var resourceExtension = {
  name: "http-webdav-resource",
  matches: function matches(url) {
    return url.startsWith("http:") || url.startsWith("https:");
  },
  resourceClass: WebDAVResource
};

function wrapInPromise(func) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return new Promise(function (resolve, reject) {
      return func.apply(null, args.concat(function (err, result) {
        return err ? reject(err) : resolve(result);
      }));
    });
  };
}

var readFileP = wrapInPromise(fs.readFile);
var writeFileP = wrapInPromise(fs.writeFile);
var existsP = function existsP(path) {
  return new Promise(function (resolve, reject) {
    return fs.exists(path, function (exists) {
      return resolve(!!exists);
    });
  });
};
var readdirP = wrapInPromise(fs.readdir);
var mkdirP = wrapInPromise(fs.mkdir);
var rmdirP = wrapInPromise(fs.rmdir);
var unlinkP = wrapInPromise(fs.unlink);
var lstatP = wrapInPromise(fs.lstat);
var renameP = wrapInPromise(fs.rename);

var NodeJSFileResource = function (_Resource) {
  inherits(NodeJSFileResource, _Resource);

  function NodeJSFileResource() {
    classCallCheck(this, NodeJSFileResource);
    return possibleConstructorReturn(this, (NodeJSFileResource.__proto__ || Object.getPrototypeOf(NodeJSFileResource)).apply(this, arguments));
  }

  createClass(NodeJSFileResource, [{
    key: "path",
    value: function path() {
      return this.url.replace("file://", "");
    }
  }, {
    key: "stat",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", lstatP(this.path()));

              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function stat() {
        return _ref.apply(this, arguments);
      }

      return stat;
    }()
  }, {
    key: "read",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var readP;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                readP = readFileP(this.path());
                return _context2.abrupt("return", this.binary ? readP : readP.then(String));

              case 2:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function read() {
        return _ref2.apply(this, arguments);
      }

      return read;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(content) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!this.isDirectory()) {
                  _context3.next = 2;
                  break;
                }

                throw new Error("Cannot write into a directory: " + this.path());

              case 2:
                _context3.next = 4;
                return writeFileP(this.path(), content);

              case 4:
                return _context3.abrupt("return", this);

              case 5:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function write(_x) {
        return _ref3.apply(this, arguments);
      }

      return write;
    }()
  }, {
    key: "mkdir",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(content) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (!this.isFile()) {
                  _context4.next = 2;
                  break;
                }

                throw new Error("Cannot mkdir on a file: " + this.path());

              case 2:
                _context4.next = 4;
                return mkdirP(this.path());

              case 4:
                return _context4.abrupt("return", this);

              case 5:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function mkdir(_x2) {
        return _ref4.apply(this, arguments);
      }

      return mkdir;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt("return", this.isRoot() ? true : existsP(this.path()));

              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function exists() {
        return _ref5.apply(this, arguments);
      }

      return exists;
    }()
  }, {
    key: "dirList",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var exclude, _subResources, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, name, subResource, stat, subResources, subCollections;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                if (!(typeof depth !== "number" && depth !== 'infinity')) {
                  _context6.next = 2;
                  break;
                }

                throw new Error("dirList \u2013 invalid depth argument: " + depth);

              case 2:
                exclude = opts.exclude;


                if (depth <= 0) depth = 1;

                if (!(depth === 1)) {
                  _context6.next = 42;
                  break;
                }

                _subResources = [];
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context6.prev = 9;
                _context6.next = 12;
                return readdirP(this.path());

              case 12:
                _context6.t0 = Symbol.iterator;
                _iterator = _context6.sent[_context6.t0]();

              case 14:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context6.next = 26;
                  break;
                }

                name = _step.value;
                subResource = this.join(name);
                _context6.next = 19;
                return subResource.stat();

              case 19:
                stat = _context6.sent;

                subResource = stat.isDirectory() ? subResource.asDirectory() : subResource;
                subResource._assignPropsFromStat(stat);
                _subResources.push(subResource);

              case 23:
                _iteratorNormalCompletion = true;
                _context6.next = 14;
                break;

              case 26:
                _context6.next = 32;
                break;

              case 28:
                _context6.prev = 28;
                _context6.t1 = _context6["catch"](9);
                _didIteratorError = true;
                _iteratorError = _context6.t1;

              case 32:
                _context6.prev = 32;
                _context6.prev = 33;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 35:
                _context6.prev = 35;

                if (!_didIteratorError) {
                  _context6.next = 38;
                  break;
                }

                throw _iteratorError;

              case 38:
                return _context6.finish(35);

              case 39:
                return _context6.finish(32);

              case 40:
                if (exclude) _subResources = applyExclude(exclude, _subResources);
                return _context6.abrupt("return", _subResources);

              case 42:
                _context6.next = 44;
                return this.dirList(1, opts);

              case 44:
                subResources = _context6.sent;
                subCollections = subResources.filter(function (ea) {
                  return ea.isDirectory();
                });
                return _context6.abrupt("return", Promise.all(subCollections.map(function (col) {
                  return col.dirList(typeof depth === "number" ? depth - 1 : depth, opts);
                })).then(function (recursiveResult) {
                  return recursiveResult.reduce(function (all, ea) {
                    return all.concat(ea);
                  }, subResources);
                }));

              case 47:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this, [[9, 28, 32, 40], [33,, 35, 39]]);
      }));

      function dirList() {
        return _ref6.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "isEmptyDirectory",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.dirList();

              case 2:
                _context7.t0 = _context7.sent.length;
                return _context7.abrupt("return", _context7.t0 === 0);

              case 4:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function isEmptyDirectory() {
        return _ref7.apply(this, arguments);
      }

      return isEmptyDirectory;
    }()
  }, {
    key: "rename",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(toResource) {
        var files, dirs, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, subR, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, subdir, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, file;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                if (toResource instanceof this.constructor) {
                  _context8.next = 2;
                  break;
                }

                return _context8.abrupt("return", get$1(NodeJSFileResource.prototype.__proto__ || Object.getPrototypeOf(NodeJSFileResource.prototype), "rename", this).call(this, toResource));

              case 2:
                if (!this.isFile()) {
                  _context8.next = 7;
                  break;
                }

                toResource = toResource.asFile();
                renameP(this.path(), toResource.path());

                _context8.next = 93;
                break;

              case 7:
                toResource = toResource.asDirectory();
                _context8.next = 10;
                return toResource.ensureExistance();

              case 10:
                files = [], dirs = [];
                _iteratorNormalCompletion2 = true;
                _didIteratorError2 = false;
                _iteratorError2 = undefined;
                _context8.prev = 14;
                _context8.next = 17;
                return this.dirList("infinity");

              case 17:
                _context8.t0 = Symbol.iterator;
                _iterator2 = _context8.sent[_context8.t0]();

              case 19:
                if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                  _context8.next = 25;
                  break;
                }

                subR = _step2.value;

                if (subR.isDirectory()) dirs.push(subR);else files.push(subR);

              case 22:
                _iteratorNormalCompletion2 = true;
                _context8.next = 19;
                break;

              case 25:
                _context8.next = 31;
                break;

              case 27:
                _context8.prev = 27;
                _context8.t1 = _context8["catch"](14);
                _didIteratorError2 = true;
                _iteratorError2 = _context8.t1;

              case 31:
                _context8.prev = 31;
                _context8.prev = 32;

                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }

              case 34:
                _context8.prev = 34;

                if (!_didIteratorError2) {
                  _context8.next = 37;
                  break;
                }

                throw _iteratorError2;

              case 37:
                return _context8.finish(34);

              case 38:
                return _context8.finish(31);

              case 39:
                _iteratorNormalCompletion3 = true;
                _didIteratorError3 = false;
                _iteratorError3 = undefined;
                _context8.prev = 42;
                _iterator3 = dirs[Symbol.iterator]();

              case 44:
                if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
                  _context8.next = 51;
                  break;
                }

                subdir = _step3.value;
                _context8.next = 48;
                return toResource.join(subdir.relativePathFrom(this)).ensureExistance();

              case 48:
                _iteratorNormalCompletion3 = true;
                _context8.next = 44;
                break;

              case 51:
                _context8.next = 57;
                break;

              case 53:
                _context8.prev = 53;
                _context8.t2 = _context8["catch"](42);
                _didIteratorError3 = true;
                _iteratorError3 = _context8.t2;

              case 57:
                _context8.prev = 57;
                _context8.prev = 58;

                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }

              case 60:
                _context8.prev = 60;

                if (!_didIteratorError3) {
                  _context8.next = 63;
                  break;
                }

                throw _iteratorError3;

              case 63:
                return _context8.finish(60);

              case 64:
                return _context8.finish(57);

              case 65:
                _iteratorNormalCompletion4 = true;
                _didIteratorError4 = false;
                _iteratorError4 = undefined;
                _context8.prev = 68;
                _iterator4 = files[Symbol.iterator]();

              case 70:
                if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                  _context8.next = 77;
                  break;
                }

                file = _step4.value;
                _context8.next = 74;
                return file.rename(toResource.join(file.relativePathFrom(this)));

              case 74:
                _iteratorNormalCompletion4 = true;
                _context8.next = 70;
                break;

              case 77:
                _context8.next = 83;
                break;

              case 79:
                _context8.prev = 79;
                _context8.t3 = _context8["catch"](68);
                _didIteratorError4 = true;
                _iteratorError4 = _context8.t3;

              case 83:
                _context8.prev = 83;
                _context8.prev = 84;

                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                  _iterator4.return();
                }

              case 86:
                _context8.prev = 86;

                if (!_didIteratorError4) {
                  _context8.next = 89;
                  break;
                }

                throw _iteratorError4;

              case 89:
                return _context8.finish(86);

              case 90:
                return _context8.finish(83);

              case 91:
                _context8.next = 93;
                return this.remove();

              case 93:
                return _context8.abrupt("return", toResource);

              case 94:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this, [[14, 27, 31, 39], [32,, 34, 38], [42, 53, 57, 65], [58,, 60, 64], [68, 79, 83, 91], [84,, 86, 90]]);
      }));

      function rename$$1(_x5) {
        return _ref8.apply(this, arguments);
      }

      return rename$$1;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9() {
        var _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, subResource;

        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return this.exists();

              case 2:
                if (_context9.sent) {
                  _context9.next = 5;
                  break;
                }

                _context9.next = 41;
                break;

              case 5:
                if (!this.isDirectory()) {
                  _context9.next = 39;
                  break;
                }

                _iteratorNormalCompletion5 = true;
                _didIteratorError5 = false;
                _iteratorError5 = undefined;
                _context9.prev = 9;
                _context9.next = 12;
                return this.dirList();

              case 12:
                _context9.t0 = Symbol.iterator;
                _iterator5 = _context9.sent[_context9.t0]();

              case 14:
                if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
                  _context9.next = 21;
                  break;
                }

                subResource = _step5.value;
                _context9.next = 18;
                return subResource.remove();

              case 18:
                _iteratorNormalCompletion5 = true;
                _context9.next = 14;
                break;

              case 21:
                _context9.next = 27;
                break;

              case 23:
                _context9.prev = 23;
                _context9.t1 = _context9["catch"](9);
                _didIteratorError5 = true;
                _iteratorError5 = _context9.t1;

              case 27:
                _context9.prev = 27;
                _context9.prev = 28;

                if (!_iteratorNormalCompletion5 && _iterator5.return) {
                  _iterator5.return();
                }

              case 30:
                _context9.prev = 30;

                if (!_didIteratorError5) {
                  _context9.next = 33;
                  break;
                }

                throw _iteratorError5;

              case 33:
                return _context9.finish(30);

              case 34:
                return _context9.finish(27);

              case 35:
                _context9.next = 37;
                return rmdirP(this.path());

              case 37:
                _context9.next = 41;
                break;

              case 39:
                _context9.next = 41;
                return unlinkP(this.path());

              case 41:
                return _context9.abrupt("return", this);

              case 42:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this, [[9, 23, 27, 35], [28,, 30, 34]]);
      }));

      function remove() {
        return _ref9.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "readProperties",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(opts) {
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _context10.t0 = this;
                _context10.next = 3;
                return this.stat();

              case 3:
                _context10.t1 = _context10.sent;
                return _context10.abrupt("return", _context10.t0._assignPropsFromStat.call(_context10.t0, _context10.t1));

              case 5:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function readProperties(_x6) {
        return _ref10.apply(this, arguments);
      }

      return readProperties;
    }()
  }, {
    key: "copyTo",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(otherResource) {
        var ensureParent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var toFile;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                if (!this.isFile()) {
                  _context11.next = 4;
                  break;
                }

                toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
                // optimized copy, using pipes, for HTTP

                if (!toFile.isHTTPResource) {
                  _context11.next = 4;
                  break;
                }

                return _context11.abrupt("return", toFile._copyFrom_file_nodejs_fs(this, ensureParent = true));

              case 4:
                return _context11.abrupt("return", get$1(NodeJSFileResource.prototype.__proto__ || Object.getPrototypeOf(NodeJSFileResource.prototype), "copyTo", this).call(this, otherResource, ensureParent));

              case 5:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function copyTo(_x7) {
        return _ref11.apply(this, arguments);
      }

      return copyTo;
    }()
  }, {
    key: "_assignPropsFromStat",
    value: function _assignPropsFromStat(stat) {
      return this.assignProperties({
        lastModified: stat.mtime,
        created: stat.ctime,
        size: stat.size,
        type: stat.isDirectory() ? "directory" : "file",
        isLink: stat.isSymbolicLink()
      });
    }
  }, {
    key: "_createWriteStream",
    value: function _createWriteStream() {
      return fs.createWriteStream(this.path());
    }
  }, {
    key: "_createReadStream",
    value: function _createReadStream() {
      return fs.createReadStream(this.path());
    }
  }, {
    key: "isNodeJSFileResource",
    get: function get() {
      return true;
    }
  }]);
  return NodeJSFileResource;
}(Resource$$1);

var resourceExtension$1 = {
  name: "nodejs-file-resource",
  matches: function matches(url) {
    return url.startsWith("file:");
  },
  resourceClass: NodeJSFileResource
};

var debug = false;
var slashRe = /\//g;

function applyExclude$1(resource$$1, exclude) {
  if (!exclude) return true;
  if (typeof exclude === "string") return !resource$$1.url.includes(exclude);
  if (typeof exclude === "function") return !exclude(resource$$1);
  if (exclude instanceof RegExp) return !exclude.test(resource$$1.url);
  return true;
}

var LocalResourceInMemoryBackend = function () {
  createClass(LocalResourceInMemoryBackend, null, [{
    key: "removeHost",
    value: function removeHost(name) {
      delete this.hosts[name];
    }
  }, {
    key: "ensure",
    value: function ensure(filespec) {
      var _this = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var host = this.named(options.host);
      return Promise.resolve().then(function () {
        return filespec ? createFiles("local://" + host.name, filespec) : null;
      }).then(function () {
        return _this;
      });
    }
  }, {
    key: "named",
    value: function named(name) {
      if (!name) name = "default";
      return this.hosts[name] || (this.hosts[name] = new this(name));
    }
  }, {
    key: "hosts",
    get: function get() {
      return this._hosts || (this._hosts = {});
    }
  }]);

  function LocalResourceInMemoryBackend(name) {
    var filespec = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, LocalResourceInMemoryBackend);

    if (!name || typeof name !== "string") throw new Error("LocalResourceInMemoryBackend needs name!");
    this.name = name;
    this._filespec = filespec;
  }

  createClass(LocalResourceInMemoryBackend, [{
    key: "get",
    value: function get(path) {
      return this._filespec[path];
    }
  }, {
    key: "set",
    value: function set(path, spec) {
      this._filespec[path] = spec;
    }
  }, {
    key: "write",
    value: function write(path, content) {
      var spec = this._filespec[path];
      if (!spec) spec = this._filespec[path] = { created: new Date() };
      spec.content = content;
      spec.isDirectory = false;
      spec.lastModified = new Date();
    }
  }, {
    key: "read",
    value: function read(path) {
      var spec = this._filespec[path];
      return !spec || !spec.content ? "" : spec.content;
    }
  }, {
    key: "mkdir",
    value: function mkdir(path) {
      var spec = this._filespec[path];
      if (spec && spec.isDirectory) return;
      if (!spec) spec = this._filespec[path] = { created: new Date() };
      if (spec.content) delete spec.content;
      spec.isDirectory = true;
      spec.lastModified = new Date();
    }
  }, {
    key: "partialFilespec",
    value: function partialFilespec() {
      var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "/";
      var depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Infinity;

      var result = {},
          filespec = this.filespec,
          paths = Object.keys(filespec);

      for (var i = 0; i < paths.length; i++) {
        var childPath = paths[i];
        if (!childPath.startsWith(path) || path === childPath) continue;
        var trailing = childPath.slice(path.length),
            childDepth = trailing.includes("/") ? trailing.match(slashRe).length + 1 : 1;
        if (childDepth > depth) continue;
        result[childPath] = filespec[childPath];
      }
      return result;
    }
  }, {
    key: "filespec",
    get: function get() {
      return this._filespec;
    },
    set: function set(filespec) {
      this._filespec = filespec;
    }
  }]);
  return LocalResourceInMemoryBackend;
}();

var LocalResource = function (_Resource) {
  inherits(LocalResource, _Resource);

  function LocalResource() {
    classCallCheck(this, LocalResource);
    return possibleConstructorReturn(this, (LocalResource.__proto__ || Object.getPrototypeOf(LocalResource)).apply(this, arguments));
  }

  createClass(LocalResource, [{
    key: "read",
    value: function read() {
      return Promise.resolve(this.localBackend.read(this.path()));
    }
  }, {
    key: "write",
    value: function write(content) {
      debug && console.log("[" + this + "] write");
      if (this.isDirectory()) throw new Error("Cannot write into a directory! (" + this.url + ")");
      var spec = this.localBackend.get(this.path());
      if (spec && spec.isDirectory) throw new Error(this.url + " already exists and is a directory (cannot write into it!)");
      this.localBackend.write(this.path(), content);
      return Promise.resolve(this);
    }
  }, {
    key: "mkdir",
    value: function mkdir() {
      debug && console.log("[" + this + "] mkdir");
      if (!this.isDirectory()) throw new Error("Cannot mkdir a file! (" + this.url + ")");
      var spec = this.localBackend.get(this.path());
      if (spec && spec.isDirectory) return Promise.resolve(this);
      if (spec && !spec.isDirectory) throw new Error(this.url + " already exists and is a file (cannot mkdir it!)");
      this.localBackend.mkdir(this.path());
      return Promise.resolve(this);
    }
  }, {
    key: "exists",
    value: function exists() {
      debug && console.log("[" + this + "] exists");
      return Promise.resolve(this.isRoot() || this.path() in this.localBackend.filespec);
    }
  }, {
    key: "remove",
    value: function remove() {
      var _this3 = this;

      debug && console.log("[" + this + "] remove");
      var thisPath = this.path();
      Object.keys(this.localBackend.filespec).forEach(function (path) {
        return path.startsWith(thisPath) && delete _this3.localBackend.filespec[path];
      });
      return Promise.resolve(this);
    }
  }, {
    key: "readProperties",
    value: function readProperties() {
      debug && console.log("[" + this + "] readProperties");
      throw new Error("not yet implemented");
    }
  }, {
    key: "dirList",
    value: function dirList() {
      var _this4 = this;

      var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      debug && console.log("[" + this + "] dirList");
      if (!this.isDirectory()) return this.asDirectory().dirList(depth, opts);

      var exclude = opts.exclude,
          prefix = this.path(),
          children = [],
          paths = Object.keys(this.localBackend.filespec);


      if (depth === "infinity") depth = Infinity;

      for (var i = 0; i < paths.length; i++) {
        var childPath = paths[i];
        if (!childPath.startsWith(prefix) || prefix === childPath) continue;
        var trailing = childPath.slice(prefix.length),
            childDepth = trailing.includes("/") ? trailing.match(slashRe).length + 1 : 1;
        if (childDepth > depth) {
          var _ret = function () {
            // add the dir pointing to child
            var dirToChild = _this4.join(trailing.split("/").slice(0, depth).join("/") + "/");
            if (!children.some(function (ea) {
              return ea.equals(dirToChild);
            })) children.push(dirToChild);
            return "continue";
          }();

          if (_ret === "continue") continue;
        }
        var child = this.join(trailing);
        if (!exclude || applyExclude$1(child, exclude)) children.push(child);
      }
      return Promise.resolve(children);
    }
  }, {
    key: "localBackend",
    get: function get() {
      return LocalResourceInMemoryBackend.named(this.host());
    }
  }]);
  return LocalResource;
}(Resource$$1);

var resourceExtension$2 = {
  name: "local-resource",
  matches: function matches(url) {
    return url.startsWith("local:");
  },
  resourceClass: LocalResource
};

/*global System,babel*/
var extensions = extensions || []; // [{name, matches, resourceClass}]

registerExtension(resourceExtension$2);
registerExtension(resourceExtension);
registerExtension(resourceExtension$1);

function resource(url, opts) {
  if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
  if (url.isResource) return url;
  url = String(url);
  for (var i = 0; i < extensions.length; i++) {
    if (extensions[i].matches(url)) return new extensions[i].resourceClass(url, opts);
  }throw new Error("Cannot find resource type for url " + url);
}

var createFiles = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(baseDir, fileSpec, opts) {
    var base, name, _resource;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // creates resources as specified in fileSpec, e.g.
            // {"foo.txt": "hello world", "sub-dir/bar.js": "23 + 19"}
            // supports both sync and async resources
            base = resource(baseDir, opts).asDirectory();
            _context.next = 3;
            return base.ensureExistance();

          case 3:
            _context.t0 = regeneratorRuntime.keys(fileSpec);

          case 4:
            if ((_context.t1 = _context.t0()).done) {
              _context.next = 18;
              break;
            }

            name = _context.t1.value;

            if (fileSpec.hasOwnProperty(name)) {
              _context.next = 8;
              break;
            }

            return _context.abrupt("continue", 4);

          case 8:
            _resource = base.join(name);

            if (!(_typeof(fileSpec[name]) === "object")) {
              _context.next = 14;
              break;
            }

            _context.next = 12;
            return createFiles(_resource, fileSpec[name], opts);

          case 12:
            _context.next = 16;
            break;

          case 14:
            _context.next = 16;
            return _resource.write(fileSpec[name]);

          case 16:
            _context.next = 4;
            break;

          case 18:
            return _context.abrupt("return", base);

          case 19:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function createFiles(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
}();

var createFileSpec = function () {
  var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(baseDir) {
    var depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "infinity";
    var opts = arguments[2];

    var files, spec, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, file, content, path, parentDir, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, pathPart;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return baseDir.dirList(depth, opts);

          case 2:
            files = _context2.sent;
            spec = {};
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 7;
            _iterator = files[Symbol.iterator]();

          case 9:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context2.next = 44;
              break;
            }

            file = _step.value;

            if (!file.isDirectory()) {
              _context2.next = 15;
              break;
            }

            _context2.t0 = {};
            _context2.next = 18;
            break;

          case 15:
            _context2.next = 17;
            return file.read();

          case 17:
            _context2.t0 = _context2.sent;

          case 18:
            content = _context2.t0;
            path = file.asFile().relativePathFrom(baseDir).split("/");
            parentDir = spec;
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context2.prev = 24;

            for (_iterator2 = path.slice(0, -1)[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              pathPart = _step2.value;

              if (!parentDir[pathPart]) parentDir[pathPart] = {};
              parentDir = parentDir[pathPart];
            }
            _context2.next = 32;
            break;

          case 28:
            _context2.prev = 28;
            _context2.t1 = _context2["catch"](24);
            _didIteratorError2 = true;
            _iteratorError2 = _context2.t1;

          case 32:
            _context2.prev = 32;
            _context2.prev = 33;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 35:
            _context2.prev = 35;

            if (!_didIteratorError2) {
              _context2.next = 38;
              break;
            }

            throw _iteratorError2;

          case 38:
            return _context2.finish(35);

          case 39:
            return _context2.finish(32);

          case 40:
            parentDir[path[path.length - 1]] = content;

          case 41:
            _iteratorNormalCompletion = true;
            _context2.next = 9;
            break;

          case 44:
            _context2.next = 50;
            break;

          case 46:
            _context2.prev = 46;
            _context2.t2 = _context2["catch"](7);
            _didIteratorError = true;
            _iteratorError = _context2.t2;

          case 50:
            _context2.prev = 50;
            _context2.prev = 51;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 53:
            _context2.prev = 53;

            if (!_didIteratorError) {
              _context2.next = 56;
              break;
            }

            throw _iteratorError;

          case 56:
            return _context2.finish(53);

          case 57:
            return _context2.finish(50);

          case 58:
            return _context2.abrupt("return", spec);

          case 59:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this, [[7, 46, 50, 58], [24, 28, 32, 40], [33,, 35, 39], [51,, 53, 57]]);
  }));

  return function createFileSpec(_x4) {
    return _ref2.apply(this, arguments);
  };
}();

function loadViaScript(url, onLoadCb) {
  // load JS code by inserting a <script src="..." /> tag into the
  // DOM. This allows cross domain script loading and JSONP

  var parentNode = document.head,
      xmlNamespace = parentNode.namespaceURI,
      useBabelJsForScriptLoad = false,
      SVGNamespace = "http://www.w3.org/2000/svg",
      XLINKNamespace = "http://www.w3.org/1999/xlink";

  return new Promise(function (resolve, reject) {
    var script = document.createElementNS(xmlNamespace, 'script');

    if (useBabelJsForScriptLoad && typeof babel !== "undefined") {
      script.setAttribute('type', "text/babel");
    } else {
      script.setAttribute('type', 'text/ecmascript');
    }

    parentNode.appendChild(script);
    script.setAttributeNS(null, 'id', url);

    script.namespaceURI === SVGNamespace ? script.setAttributeNS(XLINKNamespace, 'href', url) : script.setAttribute('src', url);

    script.onload = resolve;
    script.onerror = reject;
    script.setAttributeNS(null, 'async', true);
  });
}

var ensureFetch = function () {
  var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
    var thisModuleId, fetchInterface, moduleId;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (!("fetch" in System.global && "Headers" in System.global)) {
              _context3.next = 2;
              break;
            }

            return _context3.abrupt("return", Promise.resolve());

          case 2:
            thisModuleId = System.decanonicalize("lively.resources");

            if (!System.get("@system-env").node) {
              _context3.next = 16;
              break;
            }

            _context3.prev = 4;

            fetchInterface = System._nodeRequire("fetch-ponyfill");
            _context3.next = 14;
            break;

          case 8:
            _context3.prev = 8;
            _context3.t0 = _context3["catch"](4);
            _context3.next = 12;
            return System.normalize("fetch-ponyfill", thisModuleId);

          case 12:
            moduleId = _context3.sent.replace("file://", "");

            fetchInterface = System._nodeRequire(moduleId);

          case 14:
            _context3.next = 19;
            break;

          case 16:
            _context3.next = 18;
            return System.import("fetch-ponyfill", thisModuleId);

          case 18:
            fetchInterface = _context3.sent;

          case 19:
            Object.assign(System.global, fetchInterface());

          case 20:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this, [[4, 8]]);
  }));

  return function ensureFetch() {
    return _ref3.apply(this, arguments);
  };
}();

function registerExtension(extension) {
  // extension = {name: STRING, matches: FUNCTION, resourceClass: RESOURCE}
  // name: uniquely identifying this extension
  // predicate matches gets a resource url (string) passed and decides if the
  // extension handles it
  // resourceClass needs to implement the Resource interface
  var name = extension.name;

  extensions = extensions.filter(function (ea) {
    return ea.name !== name;
  }).concat(extension);
}

function unregisterExtension(extension) {
  var name = typeof extension === "string" ? extension : extension.name;
  extensions = extensions.filter(function (ea) {
    return ea.name !== name;
  });
}

exports.resource = resource;
exports.createFiles = createFiles;
exports.createFileSpec = createFileSpec;
exports.loadViaScript = loadViaScript;
exports.ensureFetch = ensureFetch;
exports.registerExtension = registerExtension;
exports.unregisterExtension = unregisterExtension;
exports.Resource = Resource$$1;
exports.parseQuery = parseQuery;

}((this.lively.resources = this.lively.resources || {}),typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: function() { throw new Error('fs module not available'); }}));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.resources;
})();