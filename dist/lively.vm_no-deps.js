(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lang,module$1,fs,ast) {
  'use strict';

  // helper
  function signatureOf(name, func) {
    var source = String(func),
        match = source.match(/function\s*[a-zA-Z0-9_$]*\s*\(([^\)]*)\)/),
        params = (match && match[1]) || '';
    return name + '(' + params + ')';
  }

  function pluck(list, prop) { return list.map(function(ea) { return ea[prop]; }); }

  function getObjectForCompletion(evalFunc, stringToEval) {
    var startLetters = '';
    return Promise.resolve().then(() => {
      // thenDo = function(err, obj, startLetters)
      var idx = stringToEval.lastIndexOf('.');
      if (idx >= 0) {
        startLetters = stringToEval.slice(idx+1);
        stringToEval = stringToEval.slice(0,idx);
      } else {
        startLetters = stringToEval;
        stringToEval = '(typeof window === "undefined" ? global : window)';
      }
      return evalFunc(stringToEval);
    })
    .then(evalResult => ({
      evalResult: evalResult,
      startLetters: startLetters,
      code: stringToEval
    }));
  }

  function propertyExtract(excludes, obj, extractor) {
    return Object.getOwnPropertyNames(obj)
      .filter(key => excludes.indexOf(key) === -1)
      .map(extractor)
      .filter(ea => !!ea)
      .sort((a,b) => a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
  }

  function getMethodsOf(excludes, obj) {
    return propertyExtract(excludes, obj, function(key) {
      if ((obj.__lookupGetter__ && obj.__lookupGetter__(key)) || typeof obj[key] !== 'function') return null;
      return {name: key, completion: signatureOf(key, obj[key])}; })
  }

  function getAttributesOf(excludes, obj) {
    return propertyExtract(excludes, obj, function(key) {
      if ((obj.__lookupGetter__ && !obj.__lookupGetter__(key)) && typeof obj[key] === 'function') return null;
      return {name: key, completion: key}; })
  }

  function getProtoChain(obj) {
    var protos = [], proto = obj;
    while (obj) { protos.push(obj); obj = obj.__proto__ }
    return protos;
  }

  function getDescriptorOf(originalObj, proto) {
    function shorten(s, len) {
      if (s.length > len) s = s.slice(0,len) + '...';
      return s.replace(/\n/g, '').replace(/\s+/g, ' ');
    }

    if (originalObj === proto) {
      if (typeof originalObj !== 'function') return shorten(originalObj.toString ? originalObj.toString() : "[some object]", 50);
      var funcString = originalObj.toString(),
          body = shorten(funcString.slice(funcString.indexOf('{')+1, funcString.lastIndexOf('}')), 50);
      return signatureOf(originalObj.displayName || originalObj.name || 'function', originalObj) + ' {' + body + '}';
    }

    var klass = proto.hasOwnProperty('constructor') && proto.constructor;
    if (!klass) return 'prototype';
    if (typeof klass.type === 'string' && klass.type.length) return shorten(klass.type, 50);
    if (typeof klass.name === 'string' && klass.name.length) return shorten(klass.name, 50);
    return "anonymous class";
  }

  function descriptorsOfObjAndProtoProperties(obj) {
    var excludes = [],
        completions = getProtoChain(obj)
          .map(function(proto) {
            var descr = getDescriptorOf(obj, proto),
                methodsAndAttributes = getMethodsOf(excludes, proto)
                  .concat(getAttributesOf(excludes, proto));
            excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
            return [descr, pluck(methodsAndAttributes, 'completion')];
          });
    return completions;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // the main deal
  function getCompletions(evalFunc, string, thenDo) {
    // thendo = function(err, completions/*ARRAY*/)
    // eval string and for the resulting object find attributes and methods,
    // grouped by its prototype / class chain
    // if string is something like "foo().bar.baz" then treat "baz" as start
    // letters = filter for properties of foo().bar
    // ("foo().bar.baz." for props of the result of the complete string)
    var promise = getObjectForCompletion(evalFunc, string)
      .then(evalResultAndStartLetters => {
        var evalResult = evalResultAndStartLetters.evalResult,
            value = evalResult && evalResult.isEvalResult ? evalResult.value : evalResult,
            result = {
              completions: descriptorsOfObjAndProtoProperties(value),
              startLetters: evalResultAndStartLetters.startLetters,
              code: evalResultAndStartLetters.code
            };

        if (evalResult && evalResult.isPromise) {
          if (evalResult.promiseStatus === "fulfilled")
            result.promiseResolvedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue)
          else if (evalResult.promiseStatus === "rejected")
            result.promiseRejectedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue)
        }
        return result;
    });
    if (typeof thenDo === "function") {
      promise.then(result => thenDo(null, result)).catch(err => thenDo(err));
    }
    return promise;
  }



  var completions = Object.freeze({
    getCompletions: getCompletions
  });

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  // resolves . and .. elements in a path array with directory names there
  // must be no slashes, empty elements, or device names (c:\) in the array
  // (so also no leading and trailing slashes - it does not distinguish
  // relative and absolute paths)
  function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..');
      }
    }

    return parts;
  }

  // Split a filename into [root, dir, basename, ext], unix version
  // 'root' is just a slash, or nothing.
  var splitPathRe =
      /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  var splitPath = function(filename) {
    return splitPathRe.exec(filename).slice(1);
  };

  // path.resolve([from ...], to)
  // posix version
  function resolve$1() {
    var resolvedPath = '',
        resolvedAbsolute = false;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? arguments[i] : process.cwd();

      // Skip empty and invalid entries
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
      return !!p;
    }), !resolvedAbsolute).join('/');

    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
  };

  // path.normalize(path)
  // posix version
  function normalize(path) {
    var isAbsolute = isAbsolute(path),
        trailingSlash = substr(path, -1) === '/';

    // Normalize the path
    path = normalizeArray(filter(path.split('/'), function(p) {
      return !!p;
    }), !isAbsolute).join('/');

    if (!path && !isAbsolute) {
      path = '.';
    }
    if (path && trailingSlash) {
      path += '/';
    }

    return (isAbsolute ? '/' : '') + path;
  };

  // posix version
  function isAbsolute$1(path) {
    return path.charAt(0) === '/';
  }

  // posix version
  function join$1() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return normalize(filter(paths, function(p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings');
      }
      return p;
    }).join('/'));
  }


  // path.relative(from, to)
  // posix version
  function relative$1(from, to) {
    from = resolve$1(from).substr(1);
    to = resolve$1(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break;
      }

      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '') break;
      }

      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }

    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));

    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }

    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
  }

  var sep = '/';
  var delimiter = ':';

  function dirname$1(path) {
    var result = splitPath(path),
        root = result[0],
        dir = result[1];

    if (!root && !dir) {
      // No dirname whatsoever
      return '.';
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
  };


  function basename(path, ext) {
    var f = splitPath(path)[2];
    // TODO: make this comparison case-insensitive on windows?
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length);
    }
    return f;
  }


  function extname(path) {
    return splitPath(path)[3];
  }
  var path = {
    extname: extname,
    basename: basename,
    dirname: dirname$1,
    sep: sep,
    delimiter: delimiter,
    relative: relative$1,
    join: join$1,
    isAbsolute: isAbsolute$1,
    normalize: normalize,
    resolve: resolve$1
  };
  function filter (xs, f) {
      if (xs.filter) return xs.filter(f);
      var res = [];
      for (var i = 0; i < xs.length; i++) {
          if (f(xs[i], i, xs)) res.push(xs[i]);
      }
      return res;
  }

  // String.prototype.substr - negative index don't work in IE8
  var substr = 'ab'.substr(-1) === 'b'
      ? function (str, start, len) { return str.substr(start, len) }
      : function (str, start, len) {
          if (start < 0) start = str.length + start;
          return str.substr(start, len);
      }
  ;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // helper

  function _normalizeEvalOptions(opts) {
    if (!opts) opts = {};
    opts = lang.obj.merge({
      targetModule: null,
      sourceURL: opts.targetModule,
      runtime: null,
      context: getGlobal(),
      varRecorderName: '__lvVarRecorder',
      dontTransform: [], // blacklist vars
      topLevelDefRangeRecorder: null, // object for var ranges
      recordGlobals: null,
      returnPromise: true,
      promiseTimeout: 200,
      waitForPromise: true
    }, opts);

    if (opts.targetModule) {
      var moduleEnv = opts.runtime
                   && opts.runtime.modules
                   && opts.runtime.modules[opts.targetModule];
      if (moduleEnv) opts = lang.obj.merge(opts, moduleEnv);
    }

    return opts;
  }

  function _eval(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/) {
    return eval(__lvEvalStatement);
  }

  function tryToWaitForPromise(evalResult, timeoutMs) {
    console.assert(evalResult.isPromise, "no promise in tryToWaitForPromise???");
    var timeout = {},
        timeoutP = new Promise(resolve => setTimeout(resolve, timeoutMs, timeout));
    return Promise.race([timeoutP, evalResult.value])
      .then(resolved => lang.obj.extend(evalResult, resolved !== timeout ?
              {promiseStatus: "fulfilled", promisedValue: resolved} :
              {promiseStatus: "pending"}))
      .catch(rejected => lang.obj.extend(evalResult,
              {promiseStatus: "rejected", promisedValue: rejected}))
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // evaluator interface

  function EvalResult() {}
  EvalResult.prototype.isEvalResult = true;
  EvalResult.prototype.value = undefined;
  EvalResult.prototype.warnings = [];
  EvalResult.prototype.isError = false;
  EvalResult.prototype.isPromise = false;
  EvalResult.prototype.promisedValue = undefined;
  EvalResult.prototype.promiseStatus = "unknown";

  function print(value, options) {
    if (options.isError || value instanceof Error) return value.stack || String(value);

    if (options.isPromise) {
      var status = lang.string.print(options.promiseStatus),
          value = options.promiseStatus === "pending" ?
            undefined : print(options.promisedValue, lang.obj.merge(options, {isPromise: false}));
      return `Promise({status: ${status}, ${(value === undefined ? "" : "value: " + value)}})`;
    }
    
    if (value instanceof Promise)
      return 'Promise({status: "unknown"})';
    if (options.inspect) {
      var printDepth = options.printDepth || 2;
      return lang.obj.inspect(value, {maxDepth: printDepth})
    }

    // options.asString
    return String(value);
  }

  EvalResult.prototype.printed = function(options) {
    this.value = print(this.value, lang.obj.merge(options, {
      isError: this.isError,
      isPromise: this.isPromise,
      promisedValue: this.promisedValue,
      promiseStatus: this.promiseStatus,
    }));
  }

  EvalResult.prototype.processSync = function(options) {
    if (options.inspect || options.asString) this.value = this.print(this.value, options);
    return this;
  }

  EvalResult.prototype.process = function(options) {
    var result = this;
    if (result.isPromise && options.waitForPromise) {
      return tryToWaitForPromise(result, options.promiseTimeout)
        .then(() => {
          if (options.inspect || options.asString) result.printed(options);
          return result;
        });
    }
    if (options.inspect || options.asString) result.printed(options);
    return Promise.resolve(result);
  }

  function transformForVarRecord(
    code,
    varRecorder,
    varRecorderName,
    blacklist,
    defRangeRecorder,
    recordGlobals,
    es6ExportFuncId,
    es6ImportFuncId) {
    // variable declaration and references in the the source code get
    // transformed so that they are bound to `varRecorderName` aren't local
    // state. THis makes it possible to capture eval results, e.g. for
    // inspection, watching and recording changes, workspace vars, and
    // incrementally evaluating var declarations and having values bound later.
    blacklist = blacklist || [];
    blacklist.push("arguments");
    var undeclaredToTransform = recordGlobals ?
          null/*all*/ : lang.arr.withoutAll(Object.keys(varRecorder), blacklist),
        transformed = ast.capturing.rewriteToCaptureTopLevelVariables(
          code, {name: varRecorderName, type: "Identifier"},
          {es6ImportFuncId: es6ImportFuncId,
           es6ExportFuncId: es6ExportFuncId,
           ignoreUndeclaredExcept: undeclaredToTransform,
           exclude: blacklist, recordDefRanges: !!defRangeRecorder});
    code = transformed.source;
    if (defRangeRecorder) lang.obj.extend(defRangeRecorder, transformed.defRanges);
    return code;
  }

  function transformSingleExpression(code) {
    // evaling certain expressions such as single functions or object
    // literals will fail or not work as intended. When the code being
    // evaluated consists just out of a single expression we will wrap it in
    // parens to allow for those cases
    try {
      var parsed = ast.fuzzyParse(code);
      if (parsed.body.length === 1 &&
         (parsed.body[0].type === 'FunctionDeclaration'
      || (parsed.body[0].type === 'BlockStatement'
       && parsed.body[0].body[0].type === 'LabeledStatement'))) {
        code = '(' + code.replace(/;\s*$/, '') + ')';
      }
    } catch(e) {
      if (typeof lively && lively.Config && lively.Config.showImprovedJavaScriptEvalErrors) $world.logError(e)
      else console.error("Eval preprocess error: %s", e.stack || e);
    }
    return code;
  }

  function evalCodeTransform(code, options) {
    if (options.topLevelVarRecorder)
      code = transformForVarRecord(
        code,
        options.topLevelVarRecorder,
        options.varRecorderName || '__lvVarRecorder',
        options.dontTransform,
        options.topLevelDefRangeRecorder,
        !!options.recordGlobals,
        options.es6ExportFuncId,
        options.es6ImportFuncId);
    code = transformSingleExpression(code);

    if (options.sourceURL) code += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

    return code;
  }

  function getGlobal() {
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    if (typeof Global !== "undefined") return Global;
    return (function() { return this; })();
  }

  function runEval$1(code, options, thenDo) {
    // The main function where all eval options are configured.
    // options can be: {
    //   runtime: {
    //     modules: {[MODULENAME: PerModuleOptions]}
    //   }
    // }
    // or directly, PerModuleOptions = {
    //   varRecorderName: STRING, // default is '__lvVarRecorder'
    //   topLevelVarRecorder: OBJECT,
    //   context: OBJECT,
    //   sourceURL: STRING,
    //   recordGlobals: BOOLEAN // also transform free vars? default is false
    // }

    if (typeof options === 'function' && arguments.length === 2) {
      thenDo = options; options = null;
    }

    options = _normalizeEvalOptions(options);

    var warnings = [];

    try {
      code = evalCodeTransform(code, options);
      if (options.header) code = options.header + code;
      if (options.footer) code = code + options.footer;
      // console.log(code);
    } catch (e) {
      var warning = "lively.vm evalCodeTransform not working: " + (e.stack || e);
      console.warn(warning);
      warnings.push(warning);
    }

    var result = new EvalResult();
    try {
      typeof $morph !== "undefined" && $morph('log') && ($morph('log').textString = code);
      result.value = _eval.call(options.context, code, options.topLevelVarRecorder);
      if (result.value instanceof Promise) result.isPromise = true;
    } catch (e) { result.isError = true; result.value = e; }

    if (options.sync) return result.processSync(options);
    else {
      return (typeof thenDo === "function") ? 
        new Promise((resolve, reject) =>
          result.process(options)
            .then(() => { thenDo(null, result); resolve(result); })
            .catch(err => { thenDo(err); reject(err); })) :
        result.process(options);
    }

    // // tries to return as value
    // try {
    //   JSON.stringify(value);
    //   return value;
    // } catch (e) {
    //   try {
    //     var printDepth = options.printDepth || 2;
    //     return lang.obj.inspect(value, {maxDepth: printDepth})
    //   } catch (e) { return String(value); }
    // }

  }

  function syncEval(string, options) {
    // See #runEval for options.
    // Although the defaul eval is synchronous we assume that the general
    // evaluation might not return immediatelly. This makes is possible to
    // change the evaluation backend, e.g. to be a remotely attached runtime
    options = lang.obj.merge(options, {sync: true});
    return runEval$1(string, options);
  }

  /*global process, require, global, __dirname*/

  var isNode = System.get("@system-env").node
  var GLOBAL = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);
  var debug = false;
  var join = lang.string.joinPath;
  var isAbsolute = p => !!p.match(/^(\/|[^\/]+:\/\/)/);
  var relative = relative$1 || ((base, path) => path);
  var dirname = path => path.replace(/\/[^\/]+$/, "");
  var nodeModules = isNode ? {
    get cache() { return module$1.Module._cache; },
    get require() { return (name, parent) => System._nodeRequire(name, parent); },
    get resolve() { return (name, parent) => module$1.Module._resolveFilename(name, parent); },
  } : {
    get cache() {
      console.warn("[lively.vm cjs] module cache accessor used on non-node system");
      return {};
    },
    get require() {
      return (name, parent) => {
        console.warn("[lively.vm cjs] require used on non-node system");
        return undefined;
      };
    },
    get resolve() {
      return (name, parent) => {
        console.warn("[lively.vm cjs] resolveFilename used on non-node system");
        return name;
      };
    }
  }

  var __dirname = System.normalizeSync("lively.vm/lib/").replace(/^[^:]+:\/\//, '');
  var __filename = isNode ?
    join(__dirname, "commonjs-interface.js") :
    System.normalizeSync("lively.vm/lib/commonjs-interface.js").replace(/^[^:]+:\/\//, '');

  function callsite(){
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error;
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // helper
  function resolve(file, parent) {
    if (typeof parent === "string") parent = {id: parent};

    // normal resolve
    try {
      return nodeModules.resolve(file, parent);
    } catch (e) {}

    // manual lookup using path
    if (!isAbsolute(file) && parent) {
      if (!file.match(/\.js$/)) file += ".js";
      try {
        return nodeModules.resolve(join(parent.id, "..", file));
      } catch (e) {}
    }

    // manual lookup using callstack
    var frames = callsite(), frame;
    for (var i = 2; i < frames.length; i++) {
      frame = frames[i];
      var frameFile = frame.getFileName();
      if (!frameFile) continue;
      var dir = dirname(frameFile),
          full = join(dir, file);
      try { return nodeModules.resolve(full, parent); } catch (e) {}
    }

    // last resort: current working directory
    try {
      return nodeModules.resolve(join(process.cwd(), file), parent);
    } catch (e) {}

    return file;
  }

  function sourceOf(moduleName, parent) {
    var read = lang.promise.convertCallbackFun(fs.readFile);
    return read(resolve(moduleName, parent)).then(String);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module wrapping + loading

  // maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
  var loadedModules = {};
  var requireMap = {};
  var originalCompile = null;
  var originalLoad = null;
  var exceptions = [];
  var scratchModule = join(__dirname, "commonjs-scratch.js");
  // fallback eval target

  function getExceptions() { return exceptions; }
  function setExceptions(value) { return exceptions = value; }

  function instrumentedFiles() { return Object.keys(loadedModules); }
  function isLoaded(fileName) { return nodeModules.cache[fileName] && fileName in loadedModules; }
  function ensureEnv(fullName) {
    return loadedModules[fullName]
      || (loadedModules[fullName] = {
        isInstrumented: false,
        loadError: undefined,
        // recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
        // recorderName: "eval_rec_" + fullName.replace(/[^a-z]/gi, "_"),
        recorderName: "__lv_rec__",
        recorder: Object.create(GLOBAL)
      });
  }

  function _prepareCodeForCustomCompile(source, filename, env) {
    source = String(source);
    var magicVars = ["exports", "require", "module", "__filename", "__dirname"],
        tfmOptions = {
          topLevelVarRecorder: env.recorder,
          varRecorderName: env.recorderName,
          dontTransform: [env.recorderName, "global"].concat(magicVars),
          recordGlobals: true
        },
        header = `var __cjs = System.get('file://${__filename}'),\n    ${env.recorderName} = __cjs.envFor('${filename}').recorder;\n`
               + magicVars.map(varName => `${env.recorderName}.${varName} = ${varName};`).join("\n");

    try {
      return (header + "\n"
            + ";(function() {\n"
            + evalCodeTransform(source, tfmOptions)
            + "\n})();");
    } catch (e) { return e; }
  }

  var loadDepth = 0;
  function customCompile(content, filename) {
    // wraps Module.prototype._compile to capture top-level module definitions
    if (exceptions.some(exc => exc(filename)) || isLoaded(filename))
      return originalCompile.call(this, content, filename);

    debug && console.log("[lively.vm customCompile] %s", filename);
    // console.log(lang.string.indent("[lively.vm commonjs] loads %s", " ", loadDepth), filename);

    // if cache was cleared also reset our recorded state
    if (!nodeModules.cache[filename] && loadedModules[filename])
      delete loadedModules[filename];

    var env = ensureEnv(filename),
        _ = env.isInstrumented = true,
        tfmedContent = _prepareCodeForCustomCompile(content, filename, env);

    if (tfmedContent instanceof Error) {
      console.warn("Cannot compile module %s:", filename, tfmedContent);
      env.loadError = tfmedContent;
      var result = originalCompile.call(this, content, filename);
      return result;
    }

    GLOBAL[env.recorderName] = env.recorder;
    loadDepth++;
    try {
      var result = originalCompile.call(this, tfmedContent, filename);
      env.loadError = undefined;
      return result;
    } catch (e) {
      console.log("-=-=-=-=-=-=-=-");
      console.error("[lively.vm commonjs] evaluator error loading module: ", e.stack || e);
      console.log("-=-=-=-=-=-=-=-");
      console.log(tfmedContent);
      console.log("-=-=-=-=-=-=-=-");
      env.loadError = e; throw e;
    } finally {
      loadDepth--;
      // console.log(lang.string.indent("[lively.vm commonjs] done loading %s", " ", loadDepth), filename);
      // delete global[env.recorderName];
    }
  }

  function customLoad(request, parent, isMain) {
    // console.log("LOADING ", request, parent ? parent.id : "NO PARENT")

    var id = resolve(request, parent),
        parentId = resolve(parent.id);
    if (exceptions.some(exc => exc(id)) || exceptions.some(exc => exc(parentId)))
      return originalLoad.call(this, request, parent, isMain);

    if (debug) {
      var parentRel = relative(process.cwd(), parentId);
      console.log(lang.string.indent("[lively.vm cjs dependency] %s -> %s", " ", loadDepth), parentRel, request);
      // console.log(id);
    }

    if (!requireMap[parent.id]) requireMap[parent.id] = [id];
    else requireMap[parent.id].push(id);
    return originalLoad.call(this, request, parent, isMain);
  }

  function wrapModuleLoad() {
    if (!originalCompile)
      originalCompile = module$1.Module.prototype._compile;
    module$1.Module.prototype._compile = customCompile;
    if (!originalLoad)
      originalLoad = module$1.Module._load;
    module$1.Module._load = customLoad;
  }

  function unwrapModuleLoad() {
    if (originalCompile)
      module$1.Module.prototype._compile = originalCompile;
    if (originalLoad)
      module$1.Module._load = originalLoad;
  }

  function envFor(moduleName) {
    // var fullName = require.resolve(moduleName);
    var fullName = resolve(moduleName);
    return ensureEnv(fullName);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // instrumented code evaluation

  function runEval(code, options) {
    options = lang.obj.merge({targetModule: null, parentModule: null}, options);

    return Promise.resolve().then(() => {
      if (!options.targetModule) {
        options.targetModule = scratchModule;
      } else {
        options.targetModule = resolve(options.targetModule, options.parentModule);
      }

      var fullName = resolve(options.targetModule);
      if (!nodeModules.cache[fullName]) {
        try {
          nodeModules.require(fullName);
        } catch (e) {
          throw new Error(`Cannot load module ${options.targetModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)
        }
      }

      var m = nodeModules.cache[fullName],
          env = envFor(fullName),
          rec = env.recorder,
          recName = env.recorderName;
      rec.__filename = m.filename;
      var d = rec.__dirname = dirname(m.filename);
      // rec.require = function(fname) {
      //   if (!path.isAbsolute(fname))
      //     fname = path.join(d, fname);
      //   return Module._load(fname, m);
      // };
      rec.exports = m.exports;
      rec.module = m;
      GLOBAL[recName] = rec;
      options = lang.obj.merge(options, {
        recordGlobals: true,
        dontTransform: [recName, "global"],
        varRecorderName: recName,
        topLevelVarRecorder: rec,
        sourceURL: options.targetModule,
        context: rec.exports || {}
      });

      return runEval$1(code, options);
    });
  }

  function importCjsModule(name) {
    return new Promise(ok => ok(nodeModules.require(resolve(name))));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module runtime status

  function status(thenDo) {
    var files = Object.keys(loadedModules),
        envs = files.reduce((envs, fn) => {
          envs[fn] = {
            loadError:         loadedModules[fn].loadError,
            isLoaded:          isLoaded(fn),
            recorderName:      loadedModules[fn].recorderName,
            isInstrumented:    loadedModules[fn].isInstrumented,
            recordedVariables: Object.keys(loadedModules[fn].recorder)
          }
          return envs;
        }, {});
    if (typeof thenDo === "function") thenDo(null, envs);
    return Promise.resolve(envs);
  }

  function statusForPrinted(moduleName, options, thenDo) {
    options = lang.obj.merge({depth: 3}, options);
    var env = envFor(moduleName);

    var state = {
      loadError:         env.loadError,
      recorderName:      env.recorderName,
      recordedVariables: env.recorder
    }

    thenDo(null, lang.obj.inspect(state, {maxDepth: options.depth}));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module reloading

  function _invalidateCacheForModules(fullModuleIds, moduleMap) {
    fullModuleIds.forEach(id => {
      delete moduleMap[id];
      delete loadedModules[id];
    });
  }

  function forgetModule(moduleName, parent) {
    var id = resolve(moduleName, parent),
        deps = findDependentsOf(id);
    _invalidateCacheForModules([id].concat(deps), module$1.Module._cache);
    return id;
  }

  function forgetModuleDeps(moduleName, parent) {
    var id = resolve(moduleName, parent),
        deps = findDependentsOf(id);
    _invalidateCacheForModules(deps, module$1.Module._cache);
    return id;
  }

  function reloadModule(moduleName, parent) {
    var id = forgetModule(moduleName, parent);
    return nodeModules.require(id);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module dependencies

  function findDependentsOf(id) {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: exports.x = 23;
    // module2: exports.y = require("./module1").x + 1;
    // module3: exports.z = require("./module2").y + 1;
    // `findDependentsOf` gives you an answer what modules are "stale" when you
    // change module1
    return lang.graph.hull(lang.graph.invert(requireMap), resolve(id));
  }

  function findRequirementsOf(id) {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: exports.x = 23;
    // module2: exports.y = require("./module1").x + 1;
    // module3: exports.z = require("./module2").y + 1;
    // `findRequirementsOf("./module3")` will report ./module2 and ./module1
    return lang.graph.hull(requireMap, resolve(id));
  }



  var cjs = Object.freeze({
    _requireMap: requireMap,
    _loadedModules: loadedModules,
    instrumentedFiles: instrumentedFiles,
    _prepareCodeForCustomCompile: _prepareCodeForCustomCompile,
    _getExceptions: getExceptions,
    _setExceptions: setExceptions,
    sourceOf: sourceOf,
    envFor: envFor,
    status: status,
    statusForPrinted: statusForPrinted,
    runEval: runEval,
    resolve: resolve,
    import: importCjsModule,
    reloadModule: reloadModule,
    forgetModule: forgetModule,
    forgetModuleDeps: forgetModuleDeps,
    findRequirementsOf: findRequirementsOf,
    findDependentsOf: findDependentsOf,
    wrapModuleLoad: wrapModuleLoad,
    unwrapModuleLoad: unwrapModuleLoad
  });

  var __require = (name, parent) => module$1.Module._load(name, parent);

  var GLOBAL$1 = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);

  function currentSystem() { return GLOBAL$1.System; }

  var SystemLoader = currentSystem().constructor;

  SystemLoader.prototype.__defineGetter__("__lively_vm__", function() {
    return {
      envFor: envFor$1,
      evaluationDone: function(moduleId) {
        var env = envFor$1(moduleId);
        addGetterSettersForNewVars(moduleId, env);
        runScheduledExportChanges(moduleId);
      },
      dumpConfig: function() {
        var System = currentSystem(),
            json = {
              baseURL: System.baseURL,
              transpiler: System.transpiler,
              map: System.map,
              meta: System.meta,
              packages: System.packages,
              paths: System.paths,
              packageConfigPaths: System.packageConfigPaths
            }
        return JSON.stringify(json, null, 2);
      },
      loadedModules: this.__lively_vm__loadedModules || (this.__lively_vm__loadedModules = {})
    }
  });

  var isNode$1 = currentSystem().get("@system-env").node;

  var debug$1 = false;
  // var debug = true;

  function relative$2(a, b) {
    return !path || !path.relative ? b : relative$2(a,b);
  }

  function relativeName(name) {
    var base = currentSystem().baseURL.replace(/^[\w]+:\/\//, ""),
        abs = name.replace(/^[\w]+:\/\//, "");
    return relative$2(base, abs);
  }

  var node_modulesDir = resolve$2("lively.vm/node_modules/");

  var exceptions$1 = [
        // id => id.indexOf(resolve("node_modules/")) > -1,
        id => canonicalURL(id).indexOf(node_modulesDir) > -1,
        id => lang.string.include(id, "babel-core/browser.js") || lang.string.include(id, "system.src.js"),
        // id => lang.string.include(id, "lively.ast.es6.bundle.js"),
        id => id.slice(-3) !== ".js"
      ];
  var pendingConfigs = [];
  var configInitialized = false;
  var esmFormatCommentRegExp = /['"]format (esm|es6)['"];/;
  var cjsFormatCommentRegExp = /['"]format cjs['"];/;
  var esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;
  function getExceptions$1() { return exceptions$1; }
  function setExceptions$1(v) { return exceptions$1 = v; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // configuration
  function init(cfg) {
    var SystemLoader = currentSystem().constructor;

    debug$1 && console.log("[lively.vm es6] defining new System");
    GLOBAL$1.System = new SystemLoader();
    currentSystem().trace = true;

    // _currentSystem.__defineGetter__("__lively_vm__", () => module.exports);

    cfg = lang.obj.merge({transpiler: 'babel', babelOptions: {}}, cfg);
    if (currentSystem().get("@system-env").node) {
      var nodejsCoreModules = ["addons", "assert", "buffer", "child_process",
          "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs",
          "http", "https", "module", "net", "os", "path", "punycode", "querystring",
          "readline", "repl", "stream", "stringdecoder", "timers", "tls",
          "tty", "url", "util", "v8", "vm", "zlib"],
          map = nodejsCoreModules.reduce((map, ea) => { map[ea] = "@node/" + ea; return map; }, {});
      cfg.map = lang.obj.merge(map, cfg.map);
      // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
      cfg.paths = lang.obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
      cfg.packageConfigPaths = cfg.packageConfigPaths || ['./node_modules/*/package.json'];
      if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;
    }
    config(cfg);
  }

  function config(cfg) {
    // First config call needs to have baseURL. To still allow setting other
    // config parameters we cache non-baseURL calls that come before and run them
    // as soon as we get the baseURL
    if (!configInitialized && !cfg.baseURL) {
      debug$1 && console.log("[lively.vm es6 config call queued]");
      pendingConfigs.push(cfg);
      return;
    }
    debug$1 && console.log("[lively.vm es6 System] config");
    currentSystem().config(cfg);
    if (!configInitialized) {
      configInitialized = true;
      pendingConfigs.forEach(ea => currentSystem().config(ea));
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // loading
  function importES6Module(path, options) {
    if (typeof options !== "undefined") config(options);
    return currentSystem().import(path);
  }

  function canonicalURL(url) {
    // removes double slashes, doesn't resolve relative parts yet
    var m = url.match(/([^:]+:\/\/)(.*)/);
    if (m) {
      var protocol = m[1];
      url = m[2];
    }
    url = url.replace(/([^:])\/[\/]+/g, "$1/");
    return (protocol || "") + url;
  }

  function resolve$2(name, parentName, parentAddress) {
    // if (name.match(/^([\w+_]+:)?\/\//)) return name;
    return canonicalURL(currentSystem().normalizeSync(name, parentName, parentAddress));
  }

  function addGetterSettersForNewVars(moduleId, env) {
    // after eval we modify the env so that all captures vars are wrapped in
    // getter/setter to be notified of changes
    // FIXME: better to not capture via assignments but use func calls...!
    var prefix = "__lively.vm__";
    Object.keys(env).forEach(key => {
      if (key.indexOf(prefix) === 0 || env.__lookupGetter__(key)) return;
      env[prefix + key] = env[key];
      env.__defineGetter__(key, () => env[prefix + key]);
      env.__defineSetter__(key, (v) => {
        scheduleModuleExportsChange(moduleId, key, v, false/*add export*/);
        return env[prefix + key] = v;
      });
    });
  }

  function envFor$1(fullname) {
    if (currentSystem().__lively_vm__.loadedModules[fullname]) return currentSystem().__lively_vm__.loadedModules[fullname];
    var env = currentSystem().__lively_vm__.loadedModules[fullname] = {
      loadError: undefined,
      recorderName: "__rec__",
      // recorderName: "__lvVarRecorder",
      dontTransform: ["__lively_vm__", "__rec__", "__lvVarRecorder", "global", "System", "_moduleExport", "_moduleImport"].concat(ast.query.knownGlobals),
      recorder: Object.create(GLOBAL$1, {
        _moduleExport: {
          get() { return (name, val) => scheduleModuleExportsChange(fullname, name, val, true/*add export*/); }
        },
        _moduleImport: {
          get: function() {
            return (moduleName, name) => {
              var fullModuleName = resolve$2(moduleName, fullname),
                  imported = currentSystem()._loader.modules[fullModuleName];
              if (!imported) throw new Error(`import of ${name} failed: ${moduleName} (tried as ${fullModuleName}) is not loaded!`);
              if (name == undefined)
                return imported.module;
              if (!imported.module.hasOwnProperty(name))
                console.warn(`import from ${moduleName}: Has no export ${name}!`);
              return imported.module[name];
              // var fullModuleName = resolve(moduleName, fullname),
              //     rec = moduleRecordFor(fullModuleName);
              // if (!rec) throw new Error(`import of ${name} failed: ${moduleName} (tried as ${fullModuleName}) is not loaded!`);
              // return rec.exports[name];
            }
          }
        }
      })
    }
    return env;
  }

  function moduleRecordFor(fullname) {
    var record = currentSystem()._loader.moduleRecords[fullname];
    if (!record) return null;
    if (!record.hasOwnProperty("__lively_vm__")) record.__lively_vm__ = {
      evalOnlyExport: {}
    };
    return record;
  }

  function updateModuleRecordOf(fullname, doFunc) {
    var record = moduleRecordFor(fullname);
    if (!record) throw new Error(`es6 environment global of ${fullname}: module not loaded, cannot get export object!`);
    record.locked = true;
    try {
      doFunc(record);
    } finally { record.locked = false; }
  }

  function sourceOf$1(moduleName, parent) {
    var name = resolve$2(moduleName),
        load = (currentSystem().loads && currentSystem().loads[name]) || {
          status: 'loading', address: name, name: name,
          linkSets: [], dependencies: [], metadata: {}};
    return currentSystem().fetch(load);
  }

  function importsAndExportsOf(moduleName) {
    return currentSystem().normalize(moduleName)
    .then(id =>
      Promise.resolve(sourceOf$1(id))
        .then(source => {
          var parsed = ast.parse(source),
              scope = ast.query.scopes(parsed);

          // compute imports
          var imports = scope.importDecls.reduce((imports, node) => {
            var nodes = ast.query.nodesAtIndex(parsed, node.start);
            var importStmt = lang.arr.without(nodes, scope.node)[0];
            if (!importStmt) return imports;

            var from = importStmt.source ? importStmt.source.value : "unknown module";
            if (!importStmt.specifiers.length) // no imported vars
              return imports.concat([{
                localModule:     id,
                local:           null,
                imported:        null,
                fromModule:      from,
                importStatement: importStmt
              }]);

            return imports.concat(importStmt.specifiers.map(importSpec => {
              var imported;
              if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";
              else if (importSpec.type === "ImportDefaultSpecifier") imported = "default";
              else if (importStmt.source) imported = importStmt.source.name;
              else imported = null;
              return {
                localModule:     id,
                local:           importSpec.local ? importSpec.local.name : null,
                imported:        imported,
                fromModule:      from,
                importStatement: importStmt
              }
            }))
          }, []);

          var exports = scope.exportDecls.reduce((exports, node) => {
            var nodes = ast.query.nodesAtIndex(parsed, node.start);
            var exportsStmt = lang.arr.without(nodes, scope.node)[0];
            if (!exportsStmt) return exports;

            if (exportsStmt.type === "ExportAllDeclaration") {
              var from = exportsStmt.source ? exportsStmt.source.value : null;
              return exports.concat([{
                localModule:     id,
                local:           null,
                exported:        "*",
                fromModule:      from,
                exportStatement: exportsStmt
              }])
            }

            return exports.concat(exportsStmt.specifiers.map(exportSpec => {
              return {
                localModule:     id,
                local:           exportSpec.local ? exportSpec.local.name : null,
                exported:        exportSpec.exported ? exportSpec.exported.name : null,
                fromModule:      id,
                exportStatement: exportsStmt
              }
            }))
          }, []);

          return {
            imports: lang.arr.uniqBy(imports, (a, b) => a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule),
            exports: lang.arr.uniqBy(exports, (a, b) => a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule)
          }
        }))
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // update exports
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var pendingExportChanges = {};

  function scheduleModuleExportsChange(moduleId, name, value, addNewExport) {
    var rec = moduleRecordFor(moduleId);
    if (rec && (name in rec.exports || addNewExport)) {
      var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
      pending[name] = value;
    }
  }

  function runScheduledExportChanges(moduleId) {
    var keysAndValues = pendingExportChanges[moduleId];
    if (!keysAndValues) return;
    clearPendingModuleExportChanges(moduleId);
    updateModuleExports(moduleId, keysAndValues);
  }

  function clearPendingModuleExportChanges(moduleId) {
    delete pendingExportChanges[moduleId];
  }

  function updateModuleExports(moduleId, keysAndValues) {
    updateModuleRecordOf(moduleId, (record) => {

      var newExports = [], existingExports = [];

      Object.keys(keysAndValues).forEach(name => {
        var value = keysAndValues[name];
        debug$1 && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", relativeName(moduleId), name, String(value).slice(0,30).replace(/\n/g, "") + "...");

        var isNewExport = !(name in record.exports);
        if (isNewExport) record.__lively_vm__.evalOnlyExport[name] = true;
        // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
        record.exports[name] = value;

        if (isNewExport) newExports.push(name);
        else existingExports.push(name);
      });


      // if it's a new export we don't need to update dependencies, just the
      // module itself since no depends know about the export...
      // HMM... what about *-imports?
      newExports.forEach(name => {
        var oldM = currentSystem()._loader.modules[moduleId].module,
            m = currentSystem()._loader.modules[moduleId].module = new oldM.constructor(),
            pNames = Object.getOwnPropertyNames(record.exports);
        for (var i = 0; i < pNames.length; i++) (function(key) {
          Object.defineProperty(m, key, {
            configurable: false, enumerable: true,
            get() { return record.exports[key]; }
          });
        })(pNames[i]);
        // Object.defineProperty(System._loader.modules[fullname].module, name, {
        //   configurable: false, enumerable: true,
        //   get() { return record.exports[name]; }
        // });
      });

      // For exising exports we find the execution func of each dependent module and run that
      // FIXME this means we run the entire modules again, side effects and all!!!
      if (existingExports.length) {
        debug$1 && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, relativeName(moduleId));
        for (var i = 0, l = record.importers.length; i < l; i++) {
          var importerModule = record.importers[i];
          if (!importerModule.locked) {
            var importerIndex = importerModule.dependencies.indexOf(record);
            importerModule.setters[importerIndex](record.exports);
            importerModule.execute();
          }
        }
      }

    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // code instrumentation
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function prepareCodeForCustomCompile(source, fullname, env) {
    source = String(source);
    var tfmOptions = {
          topLevelVarRecorder: env.recorder,
          varRecorderName: env.recorderName,
          dontTransform: env.dontTransform,
          recordGlobals: true
        },
        header = (debug$1 ? `console.log("[lively.vm es6] executing module ${relativeName(fullname)}");\n` : "")
              + `var __lively_vm__ = System.__lively_vm__, ${env.recorderName} = __lively_vm__.envFor("${fullname}").recorder;\n`,
        footer = `\n__lively_vm__.evaluationDone("${fullname}");`;

    try {
      return header + evalCodeTransform(source, tfmOptions) + footer;
    } catch (e) {
      console.error("Error in prepareCodeForCustomCompile", e.stack);
      return source;
    }
  }

  function getCachedNodejsModule(load) {
    // On nodejs we might run alongside normal node modules. To not load those
    // twice we have this little hack...
    try {
      var Module = __require("module").Module,
          id = Module._resolveFilename(load.name.replace(/^file:\/\//, "")),
          nodeModule = Module._cache[id];
      return nodeModule;
    } catch (e) {
      debug$1 && console.log("[lively.vm es6 getCachedNodejsModule] %s unknown to nodejs", relativeName(load.name));
    }
    return null;
  }

  function addNodejsWrapperSource(load) {
    // On nodejs we might run alongside normal node modules. To not load those
    // twice we have this little hack...
    var m = getCachedNodejsModule(load);
    if (m) {
      load.source = `export default System._nodeRequire('${m.id}');\n`;
      load.source += lang.properties.allOwnPropertiesOrFunctions(m.exports).map(k =>
        lang.classHelper.isValidIdentifier(k) ?
          `export var ${k} = System._nodeRequire('${m.id}')['${k}'];` :
          `/*ignoring export "${k}" b/c it is not a valid identifier*/`).join("\n")
      debug$1 && console.log("[lively.vm es6 customTranslate] loading %s from nodejs module cache", relativeName(load.name));
      return true;
    }
    debug$1 && console.log("[lively.vm es6 customTranslate] %s not yet in nodejs module cache", relativeName(load.name));
    return false;
  }

  function customTranslate(proceed, load) {
    // load like
    // {
    //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
    //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
    //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
    //   source: "..."
    // }

    if (exceptions$1.some(exc => exc(load.name))) {
      debug$1 && console.log("[lively.vm es6 customTranslate ignoring] %s", relativeName(load.name));
      return proceed(load);
    }
    if (currentSystem().get("@system-env").node && addNodejsWrapperSource(load)) {
      debug$1 && console.log("[lively.vm es6] loaded %s from nodejs cache", relativeName(load.name))
      return proceed(load);
    }

    var start = Date.now();

    var isEsm = load.metadata.format == 'esm' || load.metadata.format == 'es6'
             || (!load.metadata.format && esmFormatCommentRegExp.test(load.source.slice(0,5000)))
             || (!load.metadata.format && !cjsFormatCommentRegExp.test(load.source.slice(0,5000)) && esmRegEx.test(load.source)),
        isCjs = load.metadata.format == 'cjs',
        isGlobal = load.metadata.format == 'global';
    // console.log(load.name + " isEsm? " + isEsm)

    if (isEsm) {
      load.metadata.format = "esm";
      load.source = prepareCodeForCustomCompile(load.source, load.name, envFor$1(load.name));
      load.metadata["lively.vm instrumented"] = true;
      debug$1 && console.log("[lively.vm es6] loaded %s as es6 module", relativeName(load.name))
      // debug && console.log(load.source)
    } else if (isCjs && isNode$1) {
      load.metadata.format = "cjs";
      var id = resolve(load.address.replace(/^file:\/\//, ""));
      load.source = _prepareCodeForCustomCompile(load.source, id, envFor(id));
      load.metadata["lively.vm instrumented"] = true;
      debug$1 && console.log("[lively.vm es6] loaded %s as instrumented cjs module", relativeName(load.name))
      // console.log("[lively.vm es6] no rewrite for cjs module", load.name)
    } else if (isGlobal) {
      load.source = prepareCodeForCustomCompile(load.source, load.name, envFor$1(load.name));
      load.metadata["lively.vm instrumented"] = true;
    } else {
      debug$1 && console.log("[lively.vm es6] customTranslate ignoring %s b/c don't know how to handle global format", relativeName(load.name));
    }

    debug$1 && console.log("[lively.vm es6 customTranslate] done %s after %sms", relativeName(load.name), Date.now()-start);
    return proceed(load);
  }

  function wrapModuleLoad$1() {
    if (!currentSystem().origTranslate) {
      currentSystem().origTranslate = currentSystem().translate
      currentSystem().translate = function(load) {
        return customTranslate(currentSystem().origTranslate.bind(currentSystem()), load);
      }
    }
  }

  function unwrapModuleLoad$1() {
    if (currentSystem().origTranslate) {
      currentSystem().translate = currentSystem().origTranslate;
      delete currentSystem().origTranslate;
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // evaluation

  function ensureImportsAreLoaded(code, parentModule) {
    var body = ast.parse(code).body,
        imports = body.filter(node => node.type === "ImportDeclaration");
    return Promise.all(imports.map(node => {
      var fullName = resolve$2(node.source.value, parentModule);
      return moduleRecordFor(fullName) ? undefined : currentSystem().import(fullName);
    })).catch(err => {
      console.error("Error ensuring imports: " + err.message);
      throw err;
    });
  }

  function runEval$2(code, options) {
    options = lang.obj.merge({
      targetModule: null, parentModule: null,
      parentAddress: null
    }, options);

    return Promise.resolve().then(() => {
      // if (!options.targetModule) return reject(new Error("options.targetModule not defined"));
      if (!options.targetModule) {
        options.targetModule = "*scratch*"
        // resolve(options.targetModule);
      } else {
        options.targetModule = resolve$2(options.targetModule, options.parentModule || currentSystem().baseURL, options.parentAddress);
      }

      var fullname = options.targetModule;

      // throw new Error(`Cannot load module ${options.targetModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)

      return importES6Module(fullname)
        .then(() => ensureImportsAreLoaded(code, options.targetModule))
        .then(() => {
          var env = envFor$1(fullname),
              rec = env.recorder,
              recName = env.recorderName,
              header = `var ${recName} = System.__lively_vm__.envFor("${fullname}").recorder,\n`
                     + `    _moduleExport = ${recName}._moduleExport,\n`
                     + `    _moduleImport = ${recName}._moduleImport;\n`;


          options = lang.obj.merge(
            {waitForPromise: true},
            options, {
              recordGlobals: true,
              dontTransform: env.dontTransform,
              varRecorderName: recName,
              topLevelVarRecorder: rec,
              sourceURL: options.sourceURL || options.targetModule,
              context: rec,
              es6ExportFuncId: "_moduleExport",
              es6ImportFuncId: "_moduleImport",
              header: header
            });

          clearPendingModuleExportChanges(fullname);

          return runEval$1(code, options).then(result => {
            currentSystem().__lively_vm__.evaluationDone(fullname); return result; })
        })
        // .catch(err => console.error(err) || err)
    });
  }

  function sourceChange(moduleName, newSource, options) {
    var fullname = resolve$2(moduleName),
        load = {
          status: 'loading',
          source: newSource,
          name: fullname,
          linkSets: [],
          dependencies: [],
          metadata: {format: "esm"}
        };

    return (currentSystem().get(fullname) ? Promise.resolve() : importES6Module(fullname))
      .then((_) => _systemTranslateParsed(load))
      .then(updateData => {
        var record = moduleRecordFor(fullname),
            _exports = (name, val) => scheduleModuleExportsChange(fullname, name, val),
            declared = updateData.declare(_exports);

        currentSystem().__lively_vm__.evaluationDone(fullname);

        // ensure dependencies are loaded
        debug$1 && console.log("[lively.vm es6] sourceChange of %s with deps", fullname, updateData.localDeps);

        return Promise.all(
          // gather the data we need for the update, this includes looking up the
          // imported modules and getting the module record and module object as
          // a fallback (module records only exist for esm modules)
          updateData.localDeps.map(depName =>
            currentSystem().normalize(depName, fullname)
              .then(depFullname => {
                  var depModule = currentSystem().get(depFullname),
                      record = moduleRecordFor(depFullname);
                  return depModule && record ?
                    {name: depName, fullname: depFullname, module: depModule, record: record} :
                    importES6Module(depFullname).then((module) => ({
                      name: depName,
                      fullname: depFullname,
                      module: currentSystem().get(depFullname) || module,
                      record: moduleRecordFor(depFullname)
                    }));
              })))

        .then(deps => {
          // 1. update dependencies
          record.dependencies = deps.map(ea => ea.record);
          // hmm... for house keeping... not really needed right now, though
          var load = currentSystem().loads && currentSystem().loads[fullname];
          if (load) {
            load.deps = deps.map(ea => ea.name);
            load.depMap = deps.reduce((map, dep) => { map[dep.name] = dep.fullname; return map; }, {});
            if (load.metadata && load.metadata.entry) {
              load.metadata.entry.deps = load.deps;
              load.metadata.entry.normalizedDeps = deps.map(ea => ea.fullname);
              load.metadata.entry.declare = updateData.declare;
            }
          }
          // 2. run setters to populate imports
          deps.forEach((d,i) => declared.setters[i](d.module));
          // 3. execute module body
          return declared.execute();
        });
      });
  }

  function _systemTranslateParsed(load) {
    // brittle!
    // The result of System.translate is source code for a call to
    // System.register that can't be run standalone. We parse the necessary
    // details from it that we will use to re-define the module
    // (dependencies, setters, execute)
    return currentSystem().translate(load).then(translated => {
      // translated looks like
      // (function(__moduleName){System.register(["./some-es6-module.js", ...], function (_export) {
      //   "use strict";
      //   var x, z, y;
      //   return {
      //     setters: [function (_someEs6ModuleJs) { ... }],
      //     execute: function () {...}
      //   };
      // });

      var parsed            = ast.parse(translated),
          call              = parsed.body[0].expression,
          moduleName        = call.arguments[0].value,
          registerCall      = call.callee.body.body[0].expression,
          depNames          = lang.arr.pluck(registerCall["arguments"][0].elements, "value"),
          declareFuncNode   = call.callee.body.body[0].expression["arguments"][1],
          declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end),
          declare           = eval(`var __moduleName = "${moduleName}";(${declareFuncSource});\n//@ sourceURL=${moduleName}\n`);
      if (typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = declare;
      return {localDeps: depNames, declare: declare};
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module dependencies

  function modulesMatching(stringOrRegExp) {
    var re = stringOrRegExp instanceof RegExp ? stringOrRegExp : new RegExp(stringOrRegExp);
    return Object.keys(currentSystem()._loader.modules).filter(ea => stringOrRegExp.test(ea));
  }

  function forgetEnvOf(fullname) {
    delete currentSystem().__lively_vm__.loadedModules[fullname]
  }

  function forgetModuleDeps$1(moduleName, opts) {
    opts = lang.obj.merge({forgetDeps: true, forgetEnv: true}, opts)
    var id = resolve$2(moduleName),
        deps = findDependentsOf$1(id);
    deps.forEach(ea => {
      currentSystem().delete(ea);
      if (currentSystem().loads) delete currentSystem().loads[ea];
      opts.forgetEnv && forgetEnvOf(ea);
    });
    return id;
  }

  function forgetModule$1(moduleName, opts) {
    opts = lang.obj.merge({forgetDeps: true, forgetEnv: true}, opts);
    var id = opts.forgetDeps ? forgetModuleDeps$1(moduleName, opts) : resolve$2(moduleName);
    currentSystem().delete(moduleName);
    currentSystem().delete(id);
    if (currentSystem().loads) {
      delete currentSystem().loads[moduleName];
      delete currentSystem().loads[id];
    }
    if (opts.forgetEnv) {
      forgetEnvOf(id);
      forgetEnvOf(moduleName);
    }
  }

  function reloadModule$1(moduleName, opts) {
    opts = lang.obj.merge({reloadDeps: true, resetEnv: true}, opts);
    var id = resolve$2(moduleName),
        toBeReloaded = [id];
    if (opts.reloadDeps) toBeReloaded = findDependentsOf$1(id).concat(toBeReloaded);
    forgetModule$1(id, {forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv});
    return Promise.all(toBeReloaded.map(ea => ea !== id && importES6Module(ea)))
        .then(() => importES6Module(id));
  }

  // function computeRequireMap() {
  //   return Object.keys(_currentSystem.loads).reduce((requireMap, k) => {
  //     requireMap[k] = lang.obj.values(_currentSystem.loads[k].depMap);
  //     return requireMap;
  //   }, {});
  // }

  function computeRequireMap() {
    if (currentSystem().loads) {
      var store = currentSystem().loads,
          modNames = lang.arr.uniq(Object.keys(currentSystem().__lively_vm__.loadedModules).concat(Object.keys(store)));
      return modNames.reduce((requireMap, k) => {
        var depMap = store[k] ? store[k].depMap : {};
        requireMap[k] = Object.keys(depMap).map(localName => {
          var resolvedName = depMap[localName];
          if (resolvedName === "@empty") return `${resolvedName}/${localName}`;
          return resolvedName;
        })
        return requireMap;
      }, {});
    }

    return Object.keys(currentSystem()._loader.moduleRecords).reduce((requireMap, k) => {
      requireMap[k] = currentSystem()._loader.moduleRecords[k].dependencies.filter(Boolean).map(ea => ea.name);
      return requireMap;
    }, {});
  }

  function findDependentsOf$1(id) {
    // which modules (module ids) are (in)directly import module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `findDependentsOf` gives you an answer what modules are "stale" when you
    // change module1 = module2 + module3
    return lang.graph.hull(lang.graph.invert(computeRequireMap()), resolve$2(id));
  }

  function findRequirementsOf$1(id) {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `findRequirementsOf("./module3")` will report ./module2 and ./module1
    return lang.graph.hull(computeRequireMap(), resolve$2(id));
  }

  function groupIntoPackages(moduleNames, packageNames) {

    return lang.arr.groupBy(moduleNames, groupFor);

    function groupFor(moduleName) {
      var fullname = resolve$2(moduleName),
          matching = packageNames.filter(p => fullname.indexOf(p) === 0);
      return matching.length ?
        matching.reduce((specific, ea) => ea.length > specific.length ? ea : specific) :
        "no group";
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // update after source changes...
  if (currentSystem().origTranslate) { unwrapModuleLoad$1(); wrapModuleLoad$1(); }



  var es6 = Object.freeze({
    currentSystem: currentSystem,
    _init: init,
    config: config,
    _moduleRecordFor: moduleRecordFor,
    _updateModuleRecordOf: updateModuleRecordOf,
    _updateModuleExports: updateModuleExports,
    _computeRequireMap: computeRequireMap,
    getExceptions: getExceptions$1,
    setExceptions: setExceptions$1,
    sourceOf: sourceOf$1,
    envFor: envFor$1,
    importsAndExportsOf: importsAndExportsOf,
    runEval: runEval$2,
    sourceChange: sourceChange,
    resolve: resolve$2,
    modulesMatching: modulesMatching,
    import: importES6Module,
    reloadModule: reloadModule$1,
    forgetModule: forgetModule$1,
    forgetModuleDeps: forgetModuleDeps$1,
    findRequirementsOf: findRequirementsOf$1,
    findDependentsOf: findDependentsOf$1,
    groupIntoPackages: groupIntoPackages,
    wrapModuleLoad: wrapModuleLoad$1,
    unwrapModuleLoad: unwrapModuleLoad$1
  });

  function setLoadFunction(f) { exports.load = f; }
  function setConfigureFunction(f) { exports.configure = f; }
  function setBootstrapFunction(f) { exports.bootstrap = f; }

  exports.completions = completions;
  exports.cjs = cjs;
  exports.es6 = es6;
  exports.setBootstrapFunction = setBootstrapFunction;
  exports.setLoadFunction = setLoadFunction;
  exports.setConfigureFunction = setConfigureFunction;
  exports.transformForVarRecord = transformForVarRecord;
  exports.transformSingleExpression = transformSingleExpression;
  exports.evalCodeTransform = evalCodeTransform;
  exports.getGlobal = getGlobal;
  exports.runEval = runEval$1;
  exports.syncEval = syncEval;

}((this.lively.vm = this.lively.vm || {}),lively.lang,typeof module !== 'undefined' ? module.constructor : {},typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: () => { throw new Error('fs module not available'); }},lively.ast));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();