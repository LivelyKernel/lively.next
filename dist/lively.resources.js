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
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
              return step("next", value);
            }, function (err) {
              return step("throw", err);
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

  var slashEndRe = /\/+$/;
  var slashStartRe = /^\/+/;
  var protocolRe = /^[a-z0-9-_]+:/;
  var slashslashRe = /^\/\/[^\/]+/;
  function nyi(obj, name) {
    throw new Error(name + " for " + obj.constructor.name + " not yet implemented");
  }

  var Resource = function () {
    function Resource(url) {
      classCallCheck(this, Resource);

      this.isResource = true;
      this.url = String(url);
    }

    createClass(Resource, [{
      key: "toString",
      value: function toString() {
        return this.constructor.name + "(\"" + this.url + "\")";
      }
    }, {
      key: "path",
      value: function path() {
        var path = this.url.replace(protocolRe, "").replace(slashslashRe, "");
        return path === "" ? "/" : path;
      }
    }, {
      key: "schemeAndHost",
      value: function schemeAndHost() {
        return this.url.slice(0, this.url.length - this.path().length);
      }
    }, {
      key: "parent",
      value: function parent() {
        if (this.isRoot()) return null;
        return resource(this.url.replace(slashEndRe, "").split("/").slice(0, -1).join("/") + "/");
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
      key: "join",
      value: function join(path) {
        return resource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
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
        return resource(this.url.replace(slashEndRe, "") + "/");
      }
    }, {
      key: "root",
      value: function root() {
        var toplevel = this.url.slice(0, -this.path().length);
        return resource(toplevel + "/");
      }
    }, {
      key: "asFile",
      value: function asFile() {
        return resource(this.url.replace(slashEndRe, ""));
      }
    }, {
      key: "ensureExistance",
      value: function () {
        var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(optionalContent) {
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

        function ensureExistance(_x) {
          return _ref.apply(this, arguments);
        }

        return ensureExistance;
      }()
    }, {
      key: "read",
      value: function () {
        var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  nyi(this, "read");
                case 1:
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
        var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
          return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  nyi(this, "write");
                case 1:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this);
        }));

        function write() {
          return _ref3.apply(this, arguments);
        }

        return write;
      }()
    }, {
      key: "exists",
      value: function () {
        var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  nyi(this, "exists");
                case 1:
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
                  nyi(this, "remove");
                case 1:
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
      key: "dirList",
      value: function () {
        var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(depth) {
          return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
              switch (_context6.prev = _context6.next) {
                case 0:
                  nyi(this, "dirList");
                case 1:
                case "end":
                  return _context6.stop();
              }
            }
          }, _callee6, this);
        }));

        function dirList(_x2) {
          return _ref6.apply(this, arguments);
        }

        return dirList;
      }()
    }]);
    return Resource;
  }();

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

  function urlListFromPropfindDocument(xmlString) {
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
        urlQ = new XPathQuery(ns + ":href");
    return nodes.slice(1 /*first node is source*/).map(function (node) {
      var urlNode = urlQ.findFirst(node);
      return urlNode.textContent || urlNode.text; // text is FIX for IE9+
    });
  }

  var WebDAVResource = function (_Resource) {
    inherits(WebDAVResource, _Resource);

    function WebDAVResource() {
      classCallCheck(this, WebDAVResource);
      return possibleConstructorReturn(this, Object.getPrototypeOf(WebDAVResource).apply(this, arguments));
    }

    createClass(WebDAVResource, [{
      key: "read",
      value: function () {
        var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.next = 2;
                  return fetch(this.url, { mode: 'cors' });

                case 2:
                  return _context.abrupt("return", _context.sent.text());

                case 3:
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
                  return fetch(this.url, { mode: 'cors', method: "PUT", body: content });

                case 4:
                  return _context2.abrupt("return", this);

                case 5:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        function write(_x) {
          return _ref2.apply(this, arguments);
        }

        return write;
      }()
    }, {
      key: "mkdir",
      value: function () {
        var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
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
                  return fetch(this.url, { mode: 'cors', method: "MKCOL" });

                case 4:
                  return _context3.abrupt("return", this);

                case 5:
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
                  return fetch(this.url, { mode: 'cors', method: "HEAD" });

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
                  return fetch(this.url, { mode: 'cors', method: "DELETE" });

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
      key: "dirList",
      value: function () {
        var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
          var depth = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];
          var res, xmlString, root, subResources, subCollections;
          return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
              switch (_context6.prev = _context6.next) {
                case 0:
                  if (this.isDirectory()) {
                    _context6.next = 2;
                    break;
                  }

                  throw new Error("dirList called on non-directory: " + this.path());

                case 2:
                  if (!(typeof depth !== "number" && depth !== 'infinity')) {
                    _context6.next = 4;
                    break;
                  }

                  throw new Error("dirList – invalid depth argument: " + depth);

                case 4:

                  if (depth <= 0) depth = 1;

                  if (!(depth === 1)) {
                    _context6.next = 18;
                    break;
                  }

                  _context6.next = 8;
                  return fetch(this.url, {
                    method: "PROPFIND",
                    mode: 'cors',
                    redirect: 'follow',
                    headers: new Headers({
                      'Content-Type': 'text/xml'
                    })
                  });

                case 8:
                  res = _context6.sent;

                  if (res.ok) {
                    _context6.next = 11;
                    break;
                  }

                  throw new Error("Error in dirList for " + this.url + ": " + res.statusText);

                case 11:
                  _context6.next = 13;
                  return res.text();

                case 13:
                  xmlString = _context6.sent;
                  root = this.root();
                  return _context6.abrupt("return", urlListFromPropfindDocument(xmlString).map(function (path) {
                    return root.join(path);
                  }));

                case 18:
                  _context6.next = 20;
                  return this.dirList(1);

                case 20:
                  subResources = _context6.sent;
                  subCollections = subResources.filter(function (ea) {
                    return ea.isDirectory();
                  });
                  return _context6.abrupt("return", Promise.all(subCollections.map(function (col) {
                    return col.dirList(typeof depth === "number" ? depth - 1 : depth);
                  })).then(function (recursiveResult) {
                    return recursiveResult.reduce(function (all, ea) {
                      return all.concat(ea);
                    }, subResources);
                  }));

                case 23:
                case "end":
                  return _context6.stop();
              }
            }
          }, _callee6, this);
        }));

        function dirList(_x2) {
          return _ref6.apply(this, arguments);
        }

        return dirList;
      }()
    }]);
    return WebDAVResource;
  }(Resource);

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
  var NodeJSFileResource = function (_Resource) {
    inherits(NodeJSFileResource, _Resource);

    function NodeJSFileResource() {
      classCallCheck(this, NodeJSFileResource);
      return possibleConstructorReturn(this, Object.getPrototypeOf(NodeJSFileResource).apply(this, arguments));
    }

    createClass(NodeJSFileResource, [{
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
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  return _context2.abrupt("return", readFileP(this.path()).then(String));

                case 1:
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
          var depth = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];

          var subResources, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, name, subResource, subCollections;

          return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
              switch (_context6.prev = _context6.next) {
                case 0:
                  if (this.isDirectory()) {
                    _context6.next = 2;
                    break;
                  }

                  throw new Error("dirList called on non-directory: " + this.path());

                case 2:
                  if (!(typeof depth !== "number" && depth !== 'infinity')) {
                    _context6.next = 4;
                    break;
                  }

                  throw new Error("dirList – invalid depth argument: " + depth);

                case 4:

                  if (depth <= 0) depth = 1;

                  if (!(depth === 1)) {
                    _context6.next = 48;
                    break;
                  }

                  subResources = [];
                  _iteratorNormalCompletion = true;
                  _didIteratorError = false;
                  _iteratorError = undefined;
                  _context6.prev = 10;
                  _context6.next = 13;
                  return readdirP(this.path());

                case 13:
                  _context6.t0 = Symbol.iterator;
                  _iterator = _context6.sent[_context6.t0]();

                case 15:
                  if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                    _context6.next = 31;
                    break;
                  }

                  name = _step.value;
                  subResource = this.join(name);
                  _context6.t1 = subResources;
                  _context6.next = 21;
                  return subResource.stat();

                case 21:
                  if (!_context6.sent.isDirectory()) {
                    _context6.next = 25;
                    break;
                  }

                  _context6.t2 = subResource.asDirectory();
                  _context6.next = 26;
                  break;

                case 25:
                  _context6.t2 = subResource;

                case 26:
                  _context6.t3 = _context6.t2;

                  _context6.t1.push.call(_context6.t1, _context6.t3);

                case 28:
                  _iteratorNormalCompletion = true;
                  _context6.next = 15;
                  break;

                case 31:
                  _context6.next = 37;
                  break;

                case 33:
                  _context6.prev = 33;
                  _context6.t4 = _context6["catch"](10);
                  _didIteratorError = true;
                  _iteratorError = _context6.t4;

                case 37:
                  _context6.prev = 37;
                  _context6.prev = 38;

                  if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                  }

                case 40:
                  _context6.prev = 40;

                  if (!_didIteratorError) {
                    _context6.next = 43;
                    break;
                  }

                  throw _iteratorError;

                case 43:
                  return _context6.finish(40);

                case 44:
                  return _context6.finish(37);

                case 45:
                  return _context6.abrupt("return", subResources);

                case 48:
                  _context6.next = 50;
                  return this.dirList(1);

                case 50:
                  subResources = _context6.sent;
                  subCollections = subResources.filter(function (ea) {
                    return ea.isDirectory();
                  });
                  return _context6.abrupt("return", Promise.all(subCollections.map(function (col) {
                    return col.dirList(typeof depth === "number" ? depth - 1 : depth);
                  })).then(function (recursiveResult) {
                    return recursiveResult.reduce(function (all, ea) {
                      return all.concat(ea);
                    }, subResources);
                  }));

                case 53:
                case "end":
                  return _context6.stop();
              }
            }
          }, _callee6, this, [[10, 33, 37, 45], [38,, 40, 44]]);
        }));

        function dirList(_x3) {
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
      key: "remove",
      value: function () {
        var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
          var _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, subResource;

          return regeneratorRuntime.wrap(function _callee8$(_context8) {
            while (1) {
              switch (_context8.prev = _context8.next) {
                case 0:
                  _context8.next = 2;
                  return this.exists();

                case 2:
                  if (_context8.sent) {
                    _context8.next = 5;
                    break;
                  }

                  _context8.next = 41;
                  break;

                case 5:
                  if (!this.isDirectory()) {
                    _context8.next = 39;
                    break;
                  }

                  _iteratorNormalCompletion2 = true;
                  _didIteratorError2 = false;
                  _iteratorError2 = undefined;
                  _context8.prev = 9;
                  _context8.next = 12;
                  return this.dirList();

                case 12:
                  _context8.t0 = Symbol.iterator;
                  _iterator2 = _context8.sent[_context8.t0]();

                case 14:
                  if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                    _context8.next = 21;
                    break;
                  }

                  subResource = _step2.value;
                  _context8.next = 18;
                  return subResource.remove();

                case 18:
                  _iteratorNormalCompletion2 = true;
                  _context8.next = 14;
                  break;

                case 21:
                  _context8.next = 27;
                  break;

                case 23:
                  _context8.prev = 23;
                  _context8.t1 = _context8["catch"](9);
                  _didIteratorError2 = true;
                  _iteratorError2 = _context8.t1;

                case 27:
                  _context8.prev = 27;
                  _context8.prev = 28;

                  if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                  }

                case 30:
                  _context8.prev = 30;

                  if (!_didIteratorError2) {
                    _context8.next = 33;
                    break;
                  }

                  throw _iteratorError2;

                case 33:
                  return _context8.finish(30);

                case 34:
                  return _context8.finish(27);

                case 35:
                  _context8.next = 37;
                  return rmdirP(this.path());

                case 37:
                  _context8.next = 41;
                  break;

                case 39:
                  _context8.next = 41;
                  return unlinkP(this.path());

                case 41:
                  return _context8.abrupt("return", this);

                case 42:
                case "end":
                  return _context8.stop();
              }
            }
          }, _callee8, this, [[9, 23, 27, 35], [28,, 30, 34]]);
        }));

        function remove() {
          return _ref8.apply(this, arguments);
        }

        return remove;
      }()
    }]);
    return NodeJSFileResource;
  }(Resource);

  function resource(url) {
    if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
    if (url.isResource) return url;
    url = String(url);
    if (url.match(/^http/i)) return new WebDAVResource(url);
    if (url.match(/^file/i)) return new NodeJSFileResource(url);
    throw new Error("Cannot find resource type for url " + url);
  }

  var createFiles = function () {
    var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(baseDir, fileSpec) {
      var base, name, _resource;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              base = resource(baseDir).asDirectory();
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
              return createFiles(_resource, fileSpec[name]);

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

    return function createFiles(_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }();

  exports.resource = resource;
  exports.createFiles = createFiles;

}((this.lively.resources = this.lively.resources || {}),typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: function() { throw new Error('fs module not available'); }}));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.resources;
})();