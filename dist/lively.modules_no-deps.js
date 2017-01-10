
// INLINED /Users/robert/Lively/lively-dev2/lively.modules/systemjs-init.js
"format global";
(function configure() {

  System.useModuleTranslationCache = !urlQuery().noModuleCache;

  if (System.get("lively.transpiler")
   || (System.map['plugin-babel'] && System.map['systemjs-plugin-babel'])) {
    console.log("[lively.modules] System seems already to be configured");
    return;
  }

  var features = featureTest();
  var transpiler = decideAboutTranspiler(features);

  if (transpiler === "lively.transpiler") setupLivelyTranspiler(features);
  else if (transpiler === "plugin-babel") setupPluginBabelTranspiler(features);
  else console.error(`[lively.modules] could not find System transpiler for platform!`);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function decideAboutTranspiler(features) {
    if (features.supportsAsyncAwait && features.isBrowser) return "lively.transpiler";
    return "plugin-babel";
  }

  function setupLivelyTranspiler(features) {
    if (features.isBrowser) {
      if (typeof Babel !== "undefined") {
        System.global.babel = Babel
        delete System.global.Babel;
      }
      if (!System.global.babel) {
        console.error("[lively.modules] in browser environments babel is required to be loaded before lively.modules!");
        return;
      }
    } else {
      System.global.babel = loadBabel_node();
    }

    console.log("[lively.modules] SystemJS configured with lively.transpiler & babel");

    function Transpiler(System, moduleId, env) {
      this.System = System;
      this.moduleId = moduleId;
      this.env = env;
    }
    Transpiler.prototype.transpileDoit = function transpileDoit(source, options) {
      // wrap in async function so we can use await top-level
      var System = this.System,
          source = "(async function(__rec) {\n" + source.replace(/(\/\/# sourceURL=.+)$|$/, "\n}).call(this);\n$1"),
          opts = System.babelOptions,
          needsBabel = (opts.plugins && opts.plugins.length) || (opts.presets && opts.presets.length);
      return needsBabel ?
        System.global.babel.transform(source, opts).code :
        source;
    }
    Transpiler.prototype.transpileModule = function transpileModule(source, options) {
      var System = this.System,
          opts = Object.assign({}, System.babelOptions);
      opts.plugins = opts.plugins ? opts.plugins.slice() : [];
      opts.plugins.push("transform-es2015-modules-systemjs");
      return System.global.babel.transform(source, opts).code;
    }

    function translate(load, traceOpts) {
      return new Transpiler(this, load.name, {}).transpileModule(load.source, {})
    }
    System.set("lively.transpiler", System.newModule({default: Transpiler}));
    System._loader.transpilerPromise = Promise.resolve({translate})

    System.config({
      transpiler: 'lively.transpiler',
      babelOptions: {
        sourceMaps: false,
        compact: "auto",
        comments: "true",
        presets: features.supportsAsyncAwait ? [] : ["es2015"]
      }
    });
  }

  function setupPluginBabelTranspiler(features) {
    var pluginBabelPath = System.get("@system-env").browser ?
      findSystemJSPluginBabel_browser() : findSystemJSPluginBabel_node();

    var babel = System.global.babel;

    if (!pluginBabelPath && !babel) {
      console.error("[lively.modules] Could not find path to systemjs-plugin-babel nor a babel global! This will likely break lively.modules!");
      return;
    }

    if (!pluginBabelPath) {
      console.warn("[lively.modules] Could not find path to systemjs-plugin-babel but babel! Will fallback but there might be features in lively.modules that won't work!");
      System.config({transpiler: 'babel'});

    } else {

      console.log("[lively.modules] SystemJS configured with systemjs-plugin-babel transpiler");
      System.config({
        map: {
          'plugin-babel': pluginBabelPath + '/plugin-babel.js',
          'systemjs-babel-build': pluginBabelPath + '/systemjs-babel-browser.js'
        },
        transpiler: 'plugin-babel',
        babelOptions: Object.assign({
          sourceMaps: "inline",
          stage3: true,
          es2015: true,
          modularRuntime: true
        }, System.babelOptions)
      });
    }
  }


  function featureTest() {
    var isBrowser = System.get("@system-env").browser;

    // "feature test": we assume if the browser supports async/await it will also
    // support other es6/7/8 features we care about. In this case only use the
    // system-register transform. Otherwise use full transpilation.
    var supportsAsyncAwait = false;
    try { eval("async function foo() {}"); supportsAsyncAwait = true; } catch (e) {}

    return {supportsAsyncAwait, isBrowser};
  }

  function loadBabel_node() {
    var parent = require.cache[require.resolve("lively.modules")],
        babelPath = require("module").Module._resolveFilename("babel-standalone", parent);
    global.window = global;
    global.navigator = {};
    var babel = require(babelPath);
    delete global.navigator;
    delete global.window;
    return babel
  }

  function urlQuery() {
    if (typeof document === "undefined" || !document.location) return {};
    return (document.location.search || "").replace(/^\?/, "").split("&")
      .reduce(function(query, ea) {
        var split = ea.split("="), key = split[0], value = split[1];
        if (value === "true" || value === "false") value = eval(value);
        else if (!isNaN(Number(value))) value = Number(value);
        query[key] = value;
        return query;
      }, {});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function findSystemJSPluginBabel_browser() {
    // walks the script tags
    var scripts = [].slice.call(document.getElementsByTagName("script")),
        pluginBabelPath;

    for (var i = scripts.length-1; i >= 0; i--) {
      var src = scripts[i].src;
      // is lively.modules loaded? Use it's node_modules folder
      var index1 = src.indexOf("lively.modules/");
      if (index1 > -1) {
        pluginBabelPath = src.slice(0, index1) + "lively.modules/node_modules/systemjs-plugin-babel";
        break;
      }

      // is systemjs loaded? Assume that systemjs-plugin-babel sits in the same folder...
      var index2 = src.indexOf("systemjs/dist/system");
      if (index2 > -1) {
        pluginBabelPath = src.slice(0, index2) + "systemjs-plugin-babel";
        break;
      }

      // for LivelyKernel environments
      var index3 = src.indexOf("core/lively/bootstrap.js");
      if (index3 > -1) {
        pluginBabelPath = src.slice(0, index3) + "node_modules/lively.modules/node_modules/systemjs-plugin-babel";
        break;
      }

      var match = src.match(/(.*)generated\/[^\/]+\/combinedModules.js/);
      if (match) {
        pluginBabelPath = match[1] + "node_modules/lively.modules/node_modules/systemjs-plugin-babel";
        break;
      }
    }

    return pluginBabelPath;
  }

  function findSystemJSPluginBabel_node() {
    try {
      var parent = require.cache[require.resolve("lively.modules")];
      pluginBabelPath = require("module").Module._resolveFilename("systemjs-plugin-babel", parent)
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    } catch (e) {}
    try {
      var pluginBabelPath = require.resolve("systemjs-plugin-babel");
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    } catch (e) {}

    return null;
  }

})();
// INLINED END /Users/robert/Lively/lively-dev2/lively.modules/systemjs-init.js
(function() {

var semver;
(function(exports, module) {
// INLINED /Users/robert/Lively/lively-dev2/lively.modules/node_modules/semver/semver.js
exports = module.exports = SemVer;

// The debug function is excluded entirely from the minified version.
/* nomin */ var debug;
/* nomin */ if (typeof process === 'object' &&
    /* nomin */ process.env &&
    /* nomin */ process.env.NODE_DEBUG &&
    /* nomin */ /\bsemver\b/i.test(process.env.NODE_DEBUG))
  /* nomin */ debug = function() {
    /* nomin */ var args = Array.prototype.slice.call(arguments, 0);
    /* nomin */ args.unshift('SEMVER');
    /* nomin */ console.log.apply(console, args);
    /* nomin */ };
/* nomin */ else
  /* nomin */ debug = function() {};

// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
exports.SEMVER_SPEC_VERSION = '2.0.0';

var MAX_LENGTH = 256;
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;

// The actual regexps go on exports.re
var re = exports.re = [];
var src = exports.src = [];
var R = 0;

// The following Regular Expressions can be used for tokenizing,
// validating, and parsing SemVer version strings.

// ## Numeric Identifier
// A single `0`, or a non-zero digit followed by zero or more digits.

var NUMERICIDENTIFIER = R++;
src[NUMERICIDENTIFIER] = '0|[1-9]\\d*';
var NUMERICIDENTIFIERLOOSE = R++;
src[NUMERICIDENTIFIERLOOSE] = '[0-9]+';


// ## Non-numeric Identifier
// Zero or more digits, followed by a letter or hyphen, and then zero or
// more letters, digits, or hyphens.

var NONNUMERICIDENTIFIER = R++;
src[NONNUMERICIDENTIFIER] = '\\d*[a-zA-Z-][a-zA-Z0-9-]*';


// ## Main Version
// Three dot-separated numeric identifiers.

var MAINVERSION = R++;
src[MAINVERSION] = '(' + src[NUMERICIDENTIFIER] + ')\\.' +
                   '(' + src[NUMERICIDENTIFIER] + ')\\.' +
                   '(' + src[NUMERICIDENTIFIER] + ')';

var MAINVERSIONLOOSE = R++;
src[MAINVERSIONLOOSE] = '(' + src[NUMERICIDENTIFIERLOOSE] + ')\\.' +
                        '(' + src[NUMERICIDENTIFIERLOOSE] + ')\\.' +
                        '(' + src[NUMERICIDENTIFIERLOOSE] + ')';

// ## Pre-release Version Identifier
// A numeric identifier, or a non-numeric identifier.

var PRERELEASEIDENTIFIER = R++;
src[PRERELEASEIDENTIFIER] = '(?:' + src[NUMERICIDENTIFIER] +
                            '|' + src[NONNUMERICIDENTIFIER] + ')';

var PRERELEASEIDENTIFIERLOOSE = R++;
src[PRERELEASEIDENTIFIERLOOSE] = '(?:' + src[NUMERICIDENTIFIERLOOSE] +
                                 '|' + src[NONNUMERICIDENTIFIER] + ')';


// ## Pre-release Version
// Hyphen, followed by one or more dot-separated pre-release version
// identifiers.

var PRERELEASE = R++;
src[PRERELEASE] = '(?:-(' + src[PRERELEASEIDENTIFIER] +
                  '(?:\\.' + src[PRERELEASEIDENTIFIER] + ')*))';

var PRERELEASELOOSE = R++;
src[PRERELEASELOOSE] = '(?:-?(' + src[PRERELEASEIDENTIFIERLOOSE] +
                       '(?:\\.' + src[PRERELEASEIDENTIFIERLOOSE] + ')*))';

// ## Build Metadata Identifier
// Any combination of digits, letters, or hyphens.

var BUILDIDENTIFIER = R++;
src[BUILDIDENTIFIER] = '[0-9A-Za-z-]+';

// ## Build Metadata
// Plus sign, followed by one or more period-separated build metadata
// identifiers.

var BUILD = R++;
src[BUILD] = '(?:\\+(' + src[BUILDIDENTIFIER] +
             '(?:\\.' + src[BUILDIDENTIFIER] + ')*))';


// ## Full Version String
// A main version, followed optionally by a pre-release version and
// build metadata.

// Note that the only major, minor, patch, and pre-release sections of
// the version string are capturing groups.  The build metadata is not a
// capturing group, because it should not ever be used in version
// comparison.

var FULL = R++;
var FULLPLAIN = 'v?' + src[MAINVERSION] +
                src[PRERELEASE] + '?' +
                src[BUILD] + '?';

src[FULL] = '^' + FULLPLAIN + '$';

// like full, but allows v1.2.3 and =1.2.3, which people do sometimes.
// also, 1.0.0alpha1 (prerelease without the hyphen) which is pretty
// common in the npm registry.
var LOOSEPLAIN = '[v=\\s]*' + src[MAINVERSIONLOOSE] +
                 src[PRERELEASELOOSE] + '?' +
                 src[BUILD] + '?';

var LOOSE = R++;
src[LOOSE] = '^' + LOOSEPLAIN + '$';

var GTLT = R++;
src[GTLT] = '((?:<|>)?=?)';

// Something like "2.*" or "1.2.x".
// Note that "x.x" is a valid xRange identifer, meaning "any version"
// Only the first item is strictly required.
var XRANGEIDENTIFIERLOOSE = R++;
src[XRANGEIDENTIFIERLOOSE] = src[NUMERICIDENTIFIERLOOSE] + '|x|X|\\*';
var XRANGEIDENTIFIER = R++;
src[XRANGEIDENTIFIER] = src[NUMERICIDENTIFIER] + '|x|X|\\*';

var XRANGEPLAIN = R++;
src[XRANGEPLAIN] = '[v=\\s]*(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:\\.(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:\\.(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:' + src[PRERELEASE] + ')?' +
                   src[BUILD] + '?' +
                   ')?)?';

var XRANGEPLAINLOOSE = R++;
src[XRANGEPLAINLOOSE] = '[v=\\s]*(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:\\.(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:\\.(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:' + src[PRERELEASELOOSE] + ')?' +
                        src[BUILD] + '?' +
                        ')?)?';

var XRANGE = R++;
src[XRANGE] = '^' + src[GTLT] + '\\s*' + src[XRANGEPLAIN] + '$';
var XRANGELOOSE = R++;
src[XRANGELOOSE] = '^' + src[GTLT] + '\\s*' + src[XRANGEPLAINLOOSE] + '$';

// Tilde ranges.
// Meaning is "reasonably at or greater than"
var LONETILDE = R++;
src[LONETILDE] = '(?:~>?)';

var TILDETRIM = R++;
src[TILDETRIM] = '(\\s*)' + src[LONETILDE] + '\\s+';
re[TILDETRIM] = new RegExp(src[TILDETRIM], 'g');
var tildeTrimReplace = '$1~';

var TILDE = R++;
src[TILDE] = '^' + src[LONETILDE] + src[XRANGEPLAIN] + '$';
var TILDELOOSE = R++;
src[TILDELOOSE] = '^' + src[LONETILDE] + src[XRANGEPLAINLOOSE] + '$';

// Caret ranges.
// Meaning is "at least and backwards compatible with"
var LONECARET = R++;
src[LONECARET] = '(?:\\^)';

var CARETTRIM = R++;
src[CARETTRIM] = '(\\s*)' + src[LONECARET] + '\\s+';
re[CARETTRIM] = new RegExp(src[CARETTRIM], 'g');
var caretTrimReplace = '$1^';

var CARET = R++;
src[CARET] = '^' + src[LONECARET] + src[XRANGEPLAIN] + '$';
var CARETLOOSE = R++;
src[CARETLOOSE] = '^' + src[LONECARET] + src[XRANGEPLAINLOOSE] + '$';

// A simple gt/lt/eq thing, or just "" to indicate "any version"
var COMPARATORLOOSE = R++;
src[COMPARATORLOOSE] = '^' + src[GTLT] + '\\s*(' + LOOSEPLAIN + ')$|^$';
var COMPARATOR = R++;
src[COMPARATOR] = '^' + src[GTLT] + '\\s*(' + FULLPLAIN + ')$|^$';


// An expression to strip any whitespace between the gtlt and the thing
// it modifies, so that `> 1.2.3` ==> `>1.2.3`
var COMPARATORTRIM = R++;
src[COMPARATORTRIM] = '(\\s*)' + src[GTLT] +
                      '\\s*(' + LOOSEPLAIN + '|' + src[XRANGEPLAIN] + ')';

// this one has to use the /g flag
re[COMPARATORTRIM] = new RegExp(src[COMPARATORTRIM], 'g');
var comparatorTrimReplace = '$1$2$3';


// Something like `1.2.3 - 1.2.4`
// Note that these all use the loose form, because they'll be
// checked against either the strict or loose comparator form
// later.
var HYPHENRANGE = R++;
src[HYPHENRANGE] = '^\\s*(' + src[XRANGEPLAIN] + ')' +
                   '\\s+-\\s+' +
                   '(' + src[XRANGEPLAIN] + ')' +
                   '\\s*$';

var HYPHENRANGELOOSE = R++;
src[HYPHENRANGELOOSE] = '^\\s*(' + src[XRANGEPLAINLOOSE] + ')' +
                        '\\s+-\\s+' +
                        '(' + src[XRANGEPLAINLOOSE] + ')' +
                        '\\s*$';

// Star ranges basically just allow anything at all.
var STAR = R++;
src[STAR] = '(<|>)?=?\\s*\\*';

// Compile to actual regexp objects.
// All are flag-free, unless they were created above with a flag.
for (var i = 0; i < R; i++) {
  debug(i, src[i]);
  if (!re[i])
    re[i] = new RegExp(src[i]);
}

exports.parse = parse;
function parse(version, loose) {
  if (version instanceof SemVer)
    return version;

  if (typeof version !== 'string')
    return null;

  if (version.length > MAX_LENGTH)
    return null;

  var r = loose ? re[LOOSE] : re[FULL];
  if (!r.test(version))
    return null;

  try {
    return new SemVer(version, loose);
  } catch (er) {
    return null;
  }
}

exports.valid = valid;
function valid(version, loose) {
  var v = parse(version, loose);
  return v ? v.version : null;
}


exports.clean = clean;
function clean(version, loose) {
  var s = parse(version.trim().replace(/^[=v]+/, ''), loose);
  return s ? s.version : null;
}

exports.SemVer = SemVer;

function SemVer(version, loose) {
  if (version instanceof SemVer) {
    if (version.loose === loose)
      return version;
    else
      version = version.version;
  } else if (typeof version !== 'string') {
    throw new TypeError('Invalid Version: ' + version);
  }

  if (version.length > MAX_LENGTH)
    throw new TypeError('version is longer than ' + MAX_LENGTH + ' characters')

  if (!(this instanceof SemVer))
    return new SemVer(version, loose);

  debug('SemVer', version, loose);
  this.loose = loose;
  var m = version.trim().match(loose ? re[LOOSE] : re[FULL]);

  if (!m)
    throw new TypeError('Invalid Version: ' + version);

  this.raw = version;

  // these are actually numbers
  this.major = +m[1];
  this.minor = +m[2];
  this.patch = +m[3];

  if (this.major > MAX_SAFE_INTEGER || this.major < 0)
    throw new TypeError('Invalid major version')

  if (this.minor > MAX_SAFE_INTEGER || this.minor < 0)
    throw new TypeError('Invalid minor version')

  if (this.patch > MAX_SAFE_INTEGER || this.patch < 0)
    throw new TypeError('Invalid patch version')

  // numberify any prerelease numeric ids
  if (!m[4])
    this.prerelease = [];
  else
    this.prerelease = m[4].split('.').map(function(id) {
      if (/^[0-9]+$/.test(id)) {
        var num = +id;
        if (num >= 0 && num < MAX_SAFE_INTEGER)
          return num;
      }
      return id;
    });

  this.build = m[5] ? m[5].split('.') : [];
  this.format();
}

SemVer.prototype.format = function() {
  this.version = this.major + '.' + this.minor + '.' + this.patch;
  if (this.prerelease.length)
    this.version += '-' + this.prerelease.join('.');
  return this.version;
};

SemVer.prototype.toString = function() {
  return this.version;
};

SemVer.prototype.compare = function(other) {
  debug('SemVer.compare', this.version, this.loose, other);
  if (!(other instanceof SemVer))
    other = new SemVer(other, this.loose);

  return this.compareMain(other) || this.comparePre(other);
};

SemVer.prototype.compareMain = function(other) {
  if (!(other instanceof SemVer))
    other = new SemVer(other, this.loose);

  return compareIdentifiers(this.major, other.major) ||
         compareIdentifiers(this.minor, other.minor) ||
         compareIdentifiers(this.patch, other.patch);
};

SemVer.prototype.comparePre = function(other) {
  if (!(other instanceof SemVer))
    other = new SemVer(other, this.loose);

  // NOT having a prerelease is > having one
  if (this.prerelease.length && !other.prerelease.length)
    return -1;
  else if (!this.prerelease.length && other.prerelease.length)
    return 1;
  else if (!this.prerelease.length && !other.prerelease.length)
    return 0;

  var i = 0;
  do {
    var a = this.prerelease[i];
    var b = other.prerelease[i];
    debug('prerelease compare', i, a, b);
    if (a === undefined && b === undefined)
      return 0;
    else if (b === undefined)
      return 1;
    else if (a === undefined)
      return -1;
    else if (a === b)
      continue;
    else
      return compareIdentifiers(a, b);
  } while (++i);
};

// preminor will bump the version up to the next minor release, and immediately
// down to pre-release. premajor and prepatch work the same way.
SemVer.prototype.inc = function(release, identifier) {
  switch (release) {
    case 'premajor':
      this.prerelease.length = 0;
      this.patch = 0;
      this.minor = 0;
      this.major++;
      this.inc('pre', identifier);
      break;
    case 'preminor':
      this.prerelease.length = 0;
      this.patch = 0;
      this.minor++;
      this.inc('pre', identifier);
      break;
    case 'prepatch':
      // If this is already a prerelease, it will bump to the next version
      // drop any prereleases that might already exist, since they are not
      // relevant at this point.
      this.prerelease.length = 0;
      this.inc('patch', identifier);
      this.inc('pre', identifier);
      break;
    // If the input is a non-prerelease version, this acts the same as
    // prepatch.
    case 'prerelease':
      if (this.prerelease.length === 0)
        this.inc('patch', identifier);
      this.inc('pre', identifier);
      break;

    case 'major':
      // If this is a pre-major version, bump up to the same major version.
      // Otherwise increment major.
      // 1.0.0-5 bumps to 1.0.0
      // 1.1.0 bumps to 2.0.0
      if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0)
        this.major++;
      this.minor = 0;
      this.patch = 0;
      this.prerelease = [];
      break;
    case 'minor':
      // If this is a pre-minor version, bump up to the same minor version.
      // Otherwise increment minor.
      // 1.2.0-5 bumps to 1.2.0
      // 1.2.1 bumps to 1.3.0
      if (this.patch !== 0 || this.prerelease.length === 0)
        this.minor++;
      this.patch = 0;
      this.prerelease = [];
      break;
    case 'patch':
      // If this is not a pre-release version, it will increment the patch.
      // If it is a pre-release it will bump up to the same patch version.
      // 1.2.0-5 patches to 1.2.0
      // 1.2.0 patches to 1.2.1
      if (this.prerelease.length === 0)
        this.patch++;
      this.prerelease = [];
      break;
    // This probably shouldn't be used publicly.
    // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
    case 'pre':
      if (this.prerelease.length === 0)
        this.prerelease = [0];
      else {
        var i = this.prerelease.length;
        while (--i >= 0) {
          if (typeof this.prerelease[i] === 'number') {
            this.prerelease[i]++;
            i = -2;
          }
        }
        if (i === -1) // didn't increment anything
          this.prerelease.push(0);
      }
      if (identifier) {
        // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
        // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
        if (this.prerelease[0] === identifier) {
          if (isNaN(this.prerelease[1]))
            this.prerelease = [identifier, 0];
        } else
          this.prerelease = [identifier, 0];
      }
      break;

    default:
      throw new Error('invalid increment argument: ' + release);
  }
  this.format();
  this.raw = this.version;
  return this;
};

exports.inc = inc;
function inc(version, release, loose, identifier) {
  if (typeof(loose) === 'string') {
    identifier = loose;
    loose = undefined;
  }

  try {
    return new SemVer(version, loose).inc(release, identifier).version;
  } catch (er) {
    return null;
  }
}

exports.diff = diff;
function diff(version1, version2) {
  if (eq(version1, version2)) {
    return null;
  } else {
    var v1 = parse(version1);
    var v2 = parse(version2);
    if (v1.prerelease.length || v2.prerelease.length) {
      for (var key in v1) {
        if (key === 'major' || key === 'minor' || key === 'patch') {
          if (v1[key] !== v2[key]) {
            return 'pre'+key;
          }
        }
      }
      return 'prerelease';
    }
    for (var key in v1) {
      if (key === 'major' || key === 'minor' || key === 'patch') {
        if (v1[key] !== v2[key]) {
          return key;
        }
      }
    }
  }
}

exports.compareIdentifiers = compareIdentifiers;

var numeric = /^[0-9]+$/;
function compareIdentifiers(a, b) {
  var anum = numeric.test(a);
  var bnum = numeric.test(b);

  if (anum && bnum) {
    a = +a;
    b = +b;
  }

  return (anum && !bnum) ? -1 :
         (bnum && !anum) ? 1 :
         a < b ? -1 :
         a > b ? 1 :
         0;
}

exports.rcompareIdentifiers = rcompareIdentifiers;
function rcompareIdentifiers(a, b) {
  return compareIdentifiers(b, a);
}

exports.major = major;
function major(a, loose) {
  return new SemVer(a, loose).major;
}

exports.minor = minor;
function minor(a, loose) {
  return new SemVer(a, loose).minor;
}

exports.patch = patch;
function patch(a, loose) {
  return new SemVer(a, loose).patch;
}

exports.compare = compare;
function compare(a, b, loose) {
  return new SemVer(a, loose).compare(b);
}

exports.compareLoose = compareLoose;
function compareLoose(a, b) {
  return compare(a, b, true);
}

exports.rcompare = rcompare;
function rcompare(a, b, loose) {
  return compare(b, a, loose);
}

exports.sort = sort;
function sort(list, loose) {
  return list.sort(function(a, b) {
    return exports.compare(a, b, loose);
  });
}

exports.rsort = rsort;
function rsort(list, loose) {
  return list.sort(function(a, b) {
    return exports.rcompare(a, b, loose);
  });
}

exports.gt = gt;
function gt(a, b, loose) {
  return compare(a, b, loose) > 0;
}

exports.lt = lt;
function lt(a, b, loose) {
  return compare(a, b, loose) < 0;
}

exports.eq = eq;
function eq(a, b, loose) {
  return compare(a, b, loose) === 0;
}

exports.neq = neq;
function neq(a, b, loose) {
  return compare(a, b, loose) !== 0;
}

exports.gte = gte;
function gte(a, b, loose) {
  return compare(a, b, loose) >= 0;
}

exports.lte = lte;
function lte(a, b, loose) {
  return compare(a, b, loose) <= 0;
}

exports.cmp = cmp;
function cmp(a, op, b, loose) {
  var ret;
  switch (op) {
    case '===':
      if (typeof a === 'object') a = a.version;
      if (typeof b === 'object') b = b.version;
      ret = a === b;
      break;
    case '!==':
      if (typeof a === 'object') a = a.version;
      if (typeof b === 'object') b = b.version;
      ret = a !== b;
      break;
    case '': case '=': case '==': ret = eq(a, b, loose); break;
    case '!=': ret = neq(a, b, loose); break;
    case '>': ret = gt(a, b, loose); break;
    case '>=': ret = gte(a, b, loose); break;
    case '<': ret = lt(a, b, loose); break;
    case '<=': ret = lte(a, b, loose); break;
    default: throw new TypeError('Invalid operator: ' + op);
  }
  return ret;
}

exports.Comparator = Comparator;
function Comparator(comp, loose) {
  if (comp instanceof Comparator) {
    if (comp.loose === loose)
      return comp;
    else
      comp = comp.value;
  }

  if (!(this instanceof Comparator))
    return new Comparator(comp, loose);

  debug('comparator', comp, loose);
  this.loose = loose;
  this.parse(comp);

  if (this.semver === ANY)
    this.value = '';
  else
    this.value = this.operator + this.semver.version;

  debug('comp', this);
}

var ANY = {};
Comparator.prototype.parse = function(comp) {
  var r = this.loose ? re[COMPARATORLOOSE] : re[COMPARATOR];
  var m = comp.match(r);

  if (!m)
    throw new TypeError('Invalid comparator: ' + comp);

  this.operator = m[1];
  if (this.operator === '=')
    this.operator = '';

  // if it literally is just '>' or '' then allow anything.
  if (!m[2])
    this.semver = ANY;
  else
    this.semver = new SemVer(m[2], this.loose);
};

Comparator.prototype.toString = function() {
  return this.value;
};

Comparator.prototype.test = function(version) {
  debug('Comparator.test', version, this.loose);

  if (this.semver === ANY)
    return true;

  if (typeof version === 'string')
    version = new SemVer(version, this.loose);

  return cmp(version, this.operator, this.semver, this.loose);
};


exports.Range = Range;
function Range(range, loose) {
  if ((range instanceof Range) && range.loose === loose)
    return range;

  if (!(this instanceof Range))
    return new Range(range, loose);

  this.loose = loose;

  // First, split based on boolean or ||
  this.raw = range;
  this.set = range.split(/\s*\|\|\s*/).map(function(range) {
    return this.parseRange(range.trim());
  }, this).filter(function(c) {
    // throw out any that are not relevant for whatever reason
    return c.length;
  });

  if (!this.set.length) {
    throw new TypeError('Invalid SemVer Range: ' + range);
  }

  this.format();
}

Range.prototype.format = function() {
  this.range = this.set.map(function(comps) {
    return comps.join(' ').trim();
  }).join('||').trim();
  return this.range;
};

Range.prototype.toString = function() {
  return this.range;
};

Range.prototype.parseRange = function(range) {
  var loose = this.loose;
  range = range.trim();
  debug('range', range, loose);
  // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
  var hr = loose ? re[HYPHENRANGELOOSE] : re[HYPHENRANGE];
  range = range.replace(hr, hyphenReplace);
  debug('hyphen replace', range);
  // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
  range = range.replace(re[COMPARATORTRIM], comparatorTrimReplace);
  debug('comparator trim', range, re[COMPARATORTRIM]);

  // `~ 1.2.3` => `~1.2.3`
  range = range.replace(re[TILDETRIM], tildeTrimReplace);

  // `^ 1.2.3` => `^1.2.3`
  range = range.replace(re[CARETTRIM], caretTrimReplace);

  // normalize spaces
  range = range.split(/\s+/).join(' ');

  // At this point, the range is completely trimmed and
  // ready to be split into comparators.

  var compRe = loose ? re[COMPARATORLOOSE] : re[COMPARATOR];
  var set = range.split(' ').map(function(comp) {
    return parseComparator(comp, loose);
  }).join(' ').split(/\s+/);
  if (this.loose) {
    // in loose mode, throw out any that are not valid comparators
    set = set.filter(function(comp) {
      return !!comp.match(compRe);
    });
  }
  set = set.map(function(comp) {
    return new Comparator(comp, loose);
  });

  return set;
};

// Mostly just for testing and legacy API reasons
exports.toComparators = toComparators;
function toComparators(range, loose) {
  return new Range(range, loose).set.map(function(comp) {
    return comp.map(function(c) {
      return c.value;
    }).join(' ').trim().split(' ');
  });
}

// comprised of xranges, tildes, stars, and gtlt's at this point.
// already replaced the hyphen ranges
// turn into a set of JUST comparators.
function parseComparator(comp, loose) {
  debug('comp', comp);
  comp = replaceCarets(comp, loose);
  debug('caret', comp);
  comp = replaceTildes(comp, loose);
  debug('tildes', comp);
  comp = replaceXRanges(comp, loose);
  debug('xrange', comp);
  comp = replaceStars(comp, loose);
  debug('stars', comp);
  return comp;
}

function isX(id) {
  return !id || id.toLowerCase() === 'x' || id === '*';
}

// ~, ~> --> * (any, kinda silly)
// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0
// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0
// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0
// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0
// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0
function replaceTildes(comp, loose) {
  return comp.trim().split(/\s+/).map(function(comp) {
    return replaceTilde(comp, loose);
  }).join(' ');
}

function replaceTilde(comp, loose) {
  var r = loose ? re[TILDELOOSE] : re[TILDE];
  return comp.replace(r, function(_, M, m, p, pr) {
    debug('tilde', comp, _, M, m, p, pr);
    var ret;

    if (isX(M))
      ret = '';
    else if (isX(m))
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0';
    else if (isX(p))
      // ~1.2 == >=1.2.0 <1.3.0
      ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0';
    else if (pr) {
      debug('replaceTilde pr', pr);
      if (pr.charAt(0) !== '-')
        pr = '-' + pr;
      ret = '>=' + M + '.' + m + '.' + p + pr +
            ' <' + M + '.' + (+m + 1) + '.0';
    } else
      // ~1.2.3 == >=1.2.3 <1.3.0
      ret = '>=' + M + '.' + m + '.' + p +
            ' <' + M + '.' + (+m + 1) + '.0';

    debug('tilde return', ret);
    return ret;
  });
}

// ^ --> * (any, kinda silly)
// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0
// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0
// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0
// ^1.2.3 --> >=1.2.3 <2.0.0
// ^1.2.0 --> >=1.2.0 <2.0.0
function replaceCarets(comp, loose) {
  return comp.trim().split(/\s+/).map(function(comp) {
    return replaceCaret(comp, loose);
  }).join(' ');
}

function replaceCaret(comp, loose) {
  debug('caret', comp, loose);
  var r = loose ? re[CARETLOOSE] : re[CARET];
  return comp.replace(r, function(_, M, m, p, pr) {
    debug('caret', comp, _, M, m, p, pr);
    var ret;

    if (isX(M))
      ret = '';
    else if (isX(m))
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0';
    else if (isX(p)) {
      if (M === '0')
        ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0';
      else
        ret = '>=' + M + '.' + m + '.0 <' + (+M + 1) + '.0.0';
    } else if (pr) {
      debug('replaceCaret pr', pr);
      if (pr.charAt(0) !== '-')
        pr = '-' + pr;
      if (M === '0') {
        if (m === '0')
          ret = '>=' + M + '.' + m + '.' + p + pr +
                ' <' + M + '.' + m + '.' + (+p + 1);
        else
          ret = '>=' + M + '.' + m + '.' + p + pr +
                ' <' + M + '.' + (+m + 1) + '.0';
      } else
        ret = '>=' + M + '.' + m + '.' + p + pr +
              ' <' + (+M + 1) + '.0.0';
    } else {
      debug('no pr');
      if (M === '0') {
        if (m === '0')
          ret = '>=' + M + '.' + m + '.' + p +
                ' <' + M + '.' + m + '.' + (+p + 1);
        else
          ret = '>=' + M + '.' + m + '.' + p +
                ' <' + M + '.' + (+m + 1) + '.0';
      } else
        ret = '>=' + M + '.' + m + '.' + p +
              ' <' + (+M + 1) + '.0.0';
    }

    debug('caret return', ret);
    return ret;
  });
}

function replaceXRanges(comp, loose) {
  debug('replaceXRanges', comp, loose);
  return comp.split(/\s+/).map(function(comp) {
    return replaceXRange(comp, loose);
  }).join(' ');
}

function replaceXRange(comp, loose) {
  comp = comp.trim();
  var r = loose ? re[XRANGELOOSE] : re[XRANGE];
  return comp.replace(r, function(ret, gtlt, M, m, p, pr) {
    debug('xRange', comp, ret, gtlt, M, m, p, pr);
    var xM = isX(M);
    var xm = xM || isX(m);
    var xp = xm || isX(p);
    var anyX = xp;

    if (gtlt === '=' && anyX)
      gtlt = '';

    if (xM) {
      if (gtlt === '>' || gtlt === '<') {
        // nothing is allowed
        ret = '<0.0.0';
      } else {
        // nothing is forbidden
        ret = '*';
      }
    } else if (gtlt && anyX) {
      // replace X with 0
      if (xm)
        m = 0;
      if (xp)
        p = 0;

      if (gtlt === '>') {
        // >1 => >=2.0.0
        // >1.2 => >=1.3.0
        // >1.2.3 => >= 1.2.4
        gtlt = '>=';
        if (xm) {
          M = +M + 1;
          m = 0;
          p = 0;
        } else if (xp) {
          m = +m + 1;
          p = 0;
        }
      } else if (gtlt === '<=') {
        // <=0.7.x is actually <0.8.0, since any 0.7.x should
        // pass.  Similarly, <=7.x is actually <8.0.0, etc.
        gtlt = '<';
        if (xm)
          M = +M + 1;
        else
          m = +m + 1;
      }

      ret = gtlt + M + '.' + m + '.' + p;
    } else if (xm) {
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0';
    } else if (xp) {
      ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0';
    }

    debug('xRange return', ret);

    return ret;
  });
}

// Because * is AND-ed with everything else in the comparator,
// and '' means "any version", just remove the *s entirely.
function replaceStars(comp, loose) {
  debug('replaceStars', comp, loose);
  // Looseness is ignored here.  star is always as loose as it gets!
  return comp.trim().replace(re[STAR], '');
}

// This function is passed to string.replace(re[HYPHENRANGE])
// M, m, patch, prerelease, build
// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
// 1.2.3 - 3.4 => >=1.2.0 <3.5.0 Any 3.4.x will do
// 1.2 - 3.4 => >=1.2.0 <3.5.0
function hyphenReplace($0,
                       from, fM, fm, fp, fpr, fb,
                       to, tM, tm, tp, tpr, tb) {

  if (isX(fM))
    from = '';
  else if (isX(fm))
    from = '>=' + fM + '.0.0';
  else if (isX(fp))
    from = '>=' + fM + '.' + fm + '.0';
  else
    from = '>=' + from;

  if (isX(tM))
    to = '';
  else if (isX(tm))
    to = '<' + (+tM + 1) + '.0.0';
  else if (isX(tp))
    to = '<' + tM + '.' + (+tm + 1) + '.0';
  else if (tpr)
    to = '<=' + tM + '.' + tm + '.' + tp + '-' + tpr;
  else
    to = '<=' + to;

  return (from + ' ' + to).trim();
}


// if ANY of the sets match ALL of its comparators, then pass
Range.prototype.test = function(version) {
  if (!version)
    return false;

  if (typeof version === 'string')
    version = new SemVer(version, this.loose);

  for (var i = 0; i < this.set.length; i++) {
    if (testSet(this.set[i], version))
      return true;
  }
  return false;
};

function testSet(set, version) {
  for (var i = 0; i < set.length; i++) {
    if (!set[i].test(version))
      return false;
  }

  if (version.prerelease.length) {
    // Find the set of versions that are allowed to have prereleases
    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
    // That should allow `1.2.3-pr.2` to pass.
    // However, `1.2.4-alpha.notready` should NOT be allowed,
    // even though it's within the range set by the comparators.
    for (var i = 0; i < set.length; i++) {
      debug(set[i].semver);
      if (set[i].semver === ANY)
        continue;

      if (set[i].semver.prerelease.length > 0) {
        var allowed = set[i].semver;
        if (allowed.major === version.major &&
            allowed.minor === version.minor &&
            allowed.patch === version.patch)
          return true;
      }
    }

    // Version has a -pre, but it's not one of the ones we like.
    return false;
  }

  return true;
}

exports.satisfies = satisfies;
function satisfies(version, range, loose) {
  try {
    range = new Range(range, loose);
  } catch (er) {
    return false;
  }
  return range.test(version);
}

exports.maxSatisfying = maxSatisfying;
function maxSatisfying(versions, range, loose) {
  return versions.filter(function(version) {
    return satisfies(version, range, loose);
  }).sort(function(a, b) {
    return rcompare(a, b, loose);
  })[0] || null;
}

exports.minSatisfying = minSatisfying;
function minSatisfying(versions, range, loose) {
  return versions.filter(function(version) {
    return satisfies(version, range, loose);
  }).sort(function(a, b) {
    return compare(a, b, loose);
  })[0] || null;
}

exports.validRange = validRange;
function validRange(range, loose) {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return new Range(range, loose).range || '*';
  } catch (er) {
    return null;
  }
}

// Determine if version is less than all the versions possible in the range
exports.ltr = ltr;
function ltr(version, range, loose) {
  return outside(version, range, '<', loose);
}

// Determine if version is greater than all the versions possible in the range.
exports.gtr = gtr;
function gtr(version, range, loose) {
  return outside(version, range, '>', loose);
}

exports.outside = outside;
function outside(version, range, hilo, loose) {
  version = new SemVer(version, loose);
  range = new Range(range, loose);

  var gtfn, ltefn, ltfn, comp, ecomp;
  switch (hilo) {
    case '>':
      gtfn = gt;
      ltefn = lte;
      ltfn = lt;
      comp = '>';
      ecomp = '>=';
      break;
    case '<':
      gtfn = lt;
      ltefn = gte;
      ltfn = gt;
      comp = '<';
      ecomp = '<=';
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }

  // If it satisifes the range it is not outside
  if (satisfies(version, range, loose)) {
    return false;
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (var i = 0; i < range.set.length; ++i) {
    var comparators = range.set[i];

    var high = null;
    var low = null;

    comparators.forEach(function(comparator) {
      if (comparator.semver === ANY) {
        comparator = new Comparator('>=0.0.0')
      }
      high = high || comparator;
      low = low || comparator;
      if (gtfn(comparator.semver, high.semver, loose)) {
        high = comparator;
      } else if (ltfn(comparator.semver, low.semver, loose)) {
        low = comparator;
      }
    });

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high.operator === comp || high.operator === ecomp) {
      return false;
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if ((!low.operator || low.operator === comp) &&
        ltefn(version, low.semver)) {
      return false;
    } else if (low.operator === ecomp && ltfn(version, low.semver)) {
      return false;
    }
  }
  return true;
}

exports.prerelease = prerelease;
function prerelease(version, loose) {
  var parsed = parse(version, loose);
  return (parsed && parsed.prerelease.length) ? parsed.prerelease : null;
}

// INLINED END /Users/robert/Lively/lively-dev2/lively.modules/node_modules/semver/semver.js
semver = exports;
})({}, {});

  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,lively_ast,lively_notifications,lively_vm,lively_resources,lively_classes,semver) {
'use strict';

semver = 'default' in semver ? semver['default'] : semver;

function install(System, hookName, hook) {
  System[hookName] = lively_lang.fun.wrap(System[hookName], hook);
  System[hookName].hookFunc = hook;
}

function remove$1(System, methodName, hookOrName) {
  var chain = [],
      f = System[methodName];
  while (f) {
    chain.push(f);
    f = f.originalFunction;
  }

  var found = typeof hookOrName === "string" ? chain.find(function (wrapper) {
    return wrapper.hookFunc && wrapper.hookFunc.name === hookOrName;
  }) : chain.find(function (wrapper) {
    return wrapper.hookFunc === hookOrName;
  });

  if (!found) return false;

  lively_lang.arr.remove(chain, found);

  System[methodName] = chain.reduceRight(function (method, wrapper) {
    return lively_lang.fun.wrap(method, wrapper.hookFunc || wrapper);
  });

  return true;
}

function isInstalled(System, methodName, hookOrName) {
  var f = System[methodName];
  while (f) {
    if (f.hookFunc) {
      if (typeof hookOrName === "string" && f.hookFunc.name === hookOrName) return true;else if (f.hookFunc === hookOrName) return true;
    }
    f = f.originalFunction;
  }
  return false;
}

function computeRequireMap(System) {
  if (System.loads) {
    var store = System.loads,
        modNames = lively_lang.arr.uniq(Object.keys(loadedModules$1(System)).concat(Object.keys(store)));
    return modNames.reduce(function (requireMap, k) {
      var depMap = store[k] ? store[k].depMap : {};
      requireMap[k] = Object.keys(depMap).map(function (localName) {
        var resolvedName = depMap[localName];
        if (resolvedName === "@empty") return resolvedName + "/" + localName;
        return resolvedName;
      });
      return requireMap;
    }, {});
  }

  return Object.keys(System._loader.moduleRecords).reduce(function (requireMap, k) {
    requireMap[k] = System._loader.moduleRecords[k].dependencies.filter(Boolean).map(function (ea) {
      return ea.name;
    });
    return requireMap;
  }, {});
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj$$1) {
  return typeof obj$$1;
} : function (obj$$1) {
  return obj$$1 && typeof Symbol === "function" && obj$$1.constructor === Symbol && obj$$1 !== Symbol.prototype ? "symbol" : typeof obj$$1;
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





var defineProperty = function (obj$$1, key, value) {
  if (key in obj$$1) {
    Object.defineProperty(obj$$1, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj$$1[key] = value;
  }

  return obj$$1;
};

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
  function sliceIterator(arr$$1, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr$$1[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
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

  return function (arr$$1, i) {
    if (Array.isArray(arr$$1)) {
      return arr$$1;
    } else if (Symbol.iterator in Object(arr$$1)) {
      return sliceIterator(arr$$1, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var customTranslate = function () {
  var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(proceed, load) {
    var _this6 = this;

    var System, debug, start, format, mod, env, instrumented, isEsm, isCjs, isGlobal, useCache, indexdb, hashForCache, cache, stored, options, _prepareCodeForCustom, source, _prepareCodeForCustom2;

    return regeneratorRuntime.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            // load like
            // {
            //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
            //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
            //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
            //   source: "..."
            // }

            System = this, debug = System.debug;

            if (!exceptions.some(function (exc) {
              return exc(load.name);
            })) {
              _context6.next = 4;
              break;
            }

            debug && console.log("[lively.modules customTranslate ignoring] %s", load.name);
            return _context6.abrupt("return", proceed(load));

          case 4:
            if (!(isNode$1 && addNodejsWrapperSource(System, load))) {
              _context6.next = 7;
              break;
            }

            debug && console.log("[lively.modules] loaded %s from nodejs cache", load.name);
            return _context6.abrupt("return", proceed(load));

          case 7:
            start = Date.now();
            format = detectModuleFormat(load.source, load.metadata), mod = module$2(System, load.name), env = mod.env(), instrumented = false, isEsm = format === "esm", isCjs = format === "cjs", isGlobal = format === "global";


            mod.setSource(load.source);

            // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
            // cache experiment part 1
            _context6.prev = 10;
            useCache = System.useModuleTranslationCache, indexdb = System.global.indexedDB, hashForCache = useCache && String(lively_lang.string.hashCode(load.source));

            if (!(useCache && indexdb && isEsm)) {
              _context6.next = 23;
              break;
            }

            cache = System._livelyModulesTranslationCache || (System._livelyModulesTranslationCache = new BrowserModuleTranslationCache());
            _context6.next = 16;
            return cache.fetchStoredModuleSource(load.name);

          case 16:
            stored = _context6.sent;

            if (!(stored && stored.hash == hashForCache && stored.timestamp >= BrowserModuleTranslationCache.earliestDate)) {
              _context6.next = 23;
              break;
            }

            if (!stored.source) {
              _context6.next = 23;
              break;
            }

            load.metadata.format = "register";
            load.metadata.deps = []; // the real deps will be populated when the
            // system register code is run, still need
            // to define it here to avoid an
            // undefined entry later!

            console.log("[lively.modules customTranslate] loaded %s from cache after %sms", load.name, Date.now() - start);
            return _context6.abrupt("return", Promise.resolve(stored.source));

          case 23:
            _context6.next = 28;
            break;

          case 25:
            _context6.prev = 25;
            _context6.t0 = _context6["catch"](10);

            console.error("[lively.modules customTranslate] error reading module translation cache: " + _context6.t0.stack);

          case 28:
            // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

            options = {};


            if (isEsm) {
              load.metadata.format = "esm";
              _prepareCodeForCustom = prepareCodeForCustomCompile(System, load.source, load.name, env, mod, debug), options = _prepareCodeForCustom.options, source = _prepareCodeForCustom.source;

              load.source = source;
              load.metadata["lively.modules instrumented"] = true;
              instrumented = true;
              debug && console.log("[lively.modules] loaded %s as es6 module", load.name);
              // debug && console.log(load.source)
            } else if (load.metadata.format === "global") {
              env.recorderName = "System.global";
              env.recorder = System.global;
              load.metadata.format = "global";
              _prepareCodeForCustom2 = prepareCodeForCustomCompile(System, load.source, load.name, env, mod, debug), options = _prepareCodeForCustom2.options, source = _prepareCodeForCustom2.source;

              load.source = source;
              load.metadata["lively.modules instrumented"] = true;
              instrumented = true;
              debug && console.log("[lively.modules] loaded %s as instrumented global module", load.name);
            }

            // cjs is currently not supported to be instrumented
            // } else if (isCjs && isNode) {
            //   load.metadata.format = "cjs";
            //   var id = cjs.resolve(load.address.replace(/^file:\/\//, ""));
            //   load.source = cjs._prepareCodeForCustomCompile(load.source, id, cjs.envFor(id), debug);
            //   load.metadata["lively.modules instrumented"] = true;
            //   instrumented = true;
            //   debug && console.log("[lively.modules] loaded %s as instrumented cjs module", load.name)
            //   // console.log("[lively.modules] no rewrite for cjs module", load.name)
            // }

            if (!instrumented) {
              debug && console.log("[lively.modules] customTranslate ignoring %s b/c don't know how to handle format %s", load.name, load.metadata.format);
            }

            return _context6.abrupt("return", proceed(load).then(function () {
              var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(translated) {
                var cache;
                return regeneratorRuntime.wrap(function _callee5$(_context5) {
                  while (1) {
                    switch (_context5.prev = _context5.next) {
                      case 0:
                        if (translated.indexOf("System.register(") === 0) {
                          debug && console.log("[lively.modules customTranslate] Installing System.register setter captures for %s", load.name);
                          translated = prepareTranslatedCodeForSetterCapture(System, translated, load.name, env, mod, options, debug);
                        }

                        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
                        // cache experiment part 2

                        if (!(useCache && indexdb && isEsm)) {
                          _context5.next = 12;
                          break;
                        }

                        cache = System._livelyModulesTranslationCache || (System._livelyModulesTranslationCache = new BrowserModuleTranslationCache());
                        _context5.prev = 3;
                        _context5.next = 6;
                        return cache.cacheModuleSource(load.name, hashForCache, translated);

                      case 6:
                        console.log("[lively.modules customTranslate] stored cached version for %s", load.name);
                        _context5.next = 12;
                        break;

                      case 9:
                        _context5.prev = 9;
                        _context5.t0 = _context5["catch"](3);

                        console.error("[lively.modules customTranslate] failed storing module cache: " + _context5.t0.stack);

                      case 12:
                        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

                        debug && console.log("[lively.modules customTranslate] done %s after %sms", load.name, Date.now() - start);
                        return _context5.abrupt("return", translated);

                      case 14:
                      case "end":
                        return _context5.stop();
                    }
                  }
                }, _callee5, _this6, [[3, 9]]);
              }));

              return function (_x9) {
                return _ref6.apply(this, arguments);
              };
            }()));

          case 32:
          case "end":
            return _context6.stop();
        }
      }
    }, _callee6, this, [[10, 25]]);
  }));

  return function customTranslate(_x7, _x8) {
    return _ref5.apply(this, arguments);
  };
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Functions below are for re-loading modules from change.js. We typically
// start with a load object that skips the normalize / fetch step. Since we need
// to jumo in the "middle" of the load process and SystemJS does not provide an
// interface to this, we need to invoke the translate / instantiate / execute
// manually
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*global System*/
var funcCall = lively_ast.nodes.funcCall;
var member = lively_ast.nodes.member;
var literal = lively_ast.nodes.literal;

var isNode$1 = System.get("@system-env").node;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module cache experiment
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var ModuleTranslationCache = function () {
  function ModuleTranslationCache() {
    classCallCheck(this, ModuleTranslationCache);
  }

  createClass(ModuleTranslationCache, [{
    key: "cacheModuleSource",
    value: function cacheModuleSource(moduleId, hash, source) {
      throw new Error("not yet implemented");
    }
  }, {
    key: "fetchStoredModuleSource",
    value: function fetchStoredModuleSource(moduleId) {
      throw new Error("not yet implemented");
    }
  }], [{
    key: "earliestDate",
    get: function get() {
      return +new Date("Sun Nov 06 2016 16:00:00 GMT-0800 (PST)");
    }
  }]);
  return ModuleTranslationCache;
}();

var NodeModuleTranslationCache = function (_ModuleTranslationCac) {
  inherits(NodeModuleTranslationCache, _ModuleTranslationCac);

  function NodeModuleTranslationCache() {
    classCallCheck(this, NodeModuleTranslationCache);
    return possibleConstructorReturn(this, (NodeModuleTranslationCache.__proto__ || Object.getPrototypeOf(NodeModuleTranslationCache)).apply(this, arguments));
  }

  createClass(NodeModuleTranslationCache, [{
    key: "fetchStoredModuleSource",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(moduleId) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function fetchStoredModuleSource(_x) {
        return _ref.apply(this, arguments);
      }

      return fetchStoredModuleSource;
    }()
  }]);
  return NodeModuleTranslationCache;
}(ModuleTranslationCache);

var BrowserModuleTranslationCache = function (_ModuleTranslationCac2) {
  inherits(BrowserModuleTranslationCache, _ModuleTranslationCac2);

  function BrowserModuleTranslationCache() {
    var dbName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "lively.modules-module-translation-cache";
    classCallCheck(this, BrowserModuleTranslationCache);

    var _this2 = possibleConstructorReturn(this, (BrowserModuleTranslationCache.__proto__ || Object.getPrototypeOf(BrowserModuleTranslationCache)).call(this));

    _this2.version = 1;
    _this2.sourceCodeCacheStoreName = "sourceCodeStore";
    _this2.dbName = dbName;
    _this2.db = _this2.openDb();
    return _this2;
  }

  createClass(BrowserModuleTranslationCache, [{
    key: "openDb",
    value: function openDb() {
      var _this3 = this;

      var req = System.global.indexedDB.open(this.version);
      return new Promise(function (resolve, reject) {
        req.onsuccess = function (evt) {
          resolve(this.result);
        };
        req.onerror = function (evt) {
          return reject(evt.target);
        };
        req.onupgradeneeded = function (evt) {
          return evt.currentTarget.result.createObjectStore(_this3.sourceCodeCacheStoreName, { keyPath: 'moduleId' });
        };
      });
    }
  }, {
    key: "deleteDb",
    value: function deleteDb() {
      var req = System.global.indexedDB.deleteDatabase(this.dbName);
      return new Promise(function (resolve, reject) {
        req.onerror = function (evt) {
          return reject(evt.target);
        };
        req.onsuccess = function (evt) {
          return resolve(evt);
        };
      });
    }
  }, {
    key: "closeDb",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var db, req;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.db;

              case 2:
                db = _context2.sent;
                req = db.close();
                return _context2.abrupt("return", new Promise(function (resolve, reject) {
                  req.onsuccess = function (evt) {
                    resolve(this.result);
                  };
                  req.onerror = function (evt) {
                    return reject(evt.target.errorCode);
                  };
                }));

              case 5:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function closeDb() {
        return _ref2.apply(this, arguments);
      }

      return closeDb;
    }()
  }, {
    key: "cacheModuleSource",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(moduleId, hash, source) {
        var _this4 = this;

        var db;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.db;

              case 2:
                db = _context3.sent;
                return _context3.abrupt("return", new Promise(function (resolve, reject) {
                  var transaction = db.transaction([_this4.sourceCodeCacheStoreName], "readwrite"),
                      store = transaction.objectStore(_this4.sourceCodeCacheStoreName),
                      timestamp = Date.now();
                  store.put({ moduleId: moduleId, hash: hash, source: source, timestamp: timestamp });
                  transaction.oncomplete = resolve;
                  transaction.onerror = reject;
                }));

              case 4:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function cacheModuleSource(_x3, _x4, _x5) {
        return _ref3.apply(this, arguments);
      }

      return cacheModuleSource;
    }()
  }, {
    key: "fetchStoredModuleSource",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(moduleId) {
        var _this5 = this;

        var db;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return this.db;

              case 2:
                db = _context4.sent;
                return _context4.abrupt("return", new Promise(function (resolve, reject) {
                  var transaction = db.transaction([_this5.sourceCodeCacheStoreName]),
                      objectStore = transaction.objectStore(_this5.sourceCodeCacheStoreName),
                      req = objectStore.get(moduleId);
                  req.onerror = reject;
                  req.onsuccess = function (evt) {
                    return resolve(req.result);
                  };
                }));

              case 4:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function fetchStoredModuleSource(_x6) {
        return _ref4.apply(this, arguments);
      }

      return fetchStoredModuleSource;
    }()
  }]);
  return BrowserModuleTranslationCache;
}(ModuleTranslationCache);

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code instrumentation
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var node_modulesDir = System.decanonicalize("lively.modules/node_modules/");

var exceptions = [
// id => id.indexOf(resolve("node_modules/")) > -1,
// id => canonicalURL(id).indexOf(node_modulesDir) > -1,
function (id) {
  return !id.endsWith(".js");
}, function (id) {
  return id.endsWith("dist/acorn.js") || id.endsWith("dist/escodegen.browser.js") || id.endsWith("bowser.js");
}, function (id) {
  return id.endsWith("babel-core/browser.js") || id.endsWith("system.src.js") || id.includes("systemjs-plugin-babel");
}];

function prepareCodeForCustomCompile(System, source, moduleId, env, module, debug) {
  source = String(source);

  var embedOriginalCode = true,
      sourceAccessorName = embedOriginalCode ? env.sourceAccessorName : undefined;

  var options = {
    topLevelVarRecorder: env.recorder,
    varRecorderName: env.recorderName,
    sourceAccessorName: env.sourceAccessorName,
    dontTransform: env.dontTransform,
    recordGlobals: true,
    keepPreviouslyDeclaredValues: true,
    declarationWrapperName: module.varDefinitionCallbackName,
    evalId: module.nextEvalId(),
    currentModuleAccessor: funcCall(member(funcCall(member("System", "get"), literal("@lively-env")), "moduleEnv"), literal(moduleId))

  },
      isGlobal = env.recorderName === "System.global",
      header = debug ? "console.log(\"[lively.modules] executing module " + moduleId + "\");\n" : "",
      footer = "";

  if (isGlobal) {
    // FIXME how to update exports in that case?
    delete options.declarationWrapperName;
  } else {
    header += "System.get(\"@lively-env\").evaluationStart(\"" + moduleId + "\");\n" + ("var " + env.recorderName + " = System.get(\"@lively-env\").moduleEnv(\"" + moduleId + "\").recorder;\n") + (embedOriginalCode ? "\nvar " + sourceAccessorName + " = " + JSON.stringify(source) + ";\n" : "");
    footer += "\nSystem.get(\"@lively-env\").evaluationEnd(\"" + moduleId + "\");";
  }

  try {
    var rewrittenSource = header + lively_vm.evalCodeTransform(source, options) + footer;
    if (debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = rewrittenSource;
    return { source: rewrittenSource, options: options };
  } catch (e) {
    console.error("Error in prepareCodeForCustomCompile of " + moduleId + " " + e.stack);
    return { source: source, options: options };
  }
}

function prepareTranslatedCodeForSetterCapture(System, source, moduleId, env, module, options, debug) {
  source = String(source);
  var tfmOptions = _extends({}, options, {
    topLevelVarRecorder: env.recorder,
    varRecorderName: env.recorderName,
    dontTransform: env.dontTransform,
    recordGlobals: true,
    declarationWrapperName: module.varDefinitionCallbackName,
    currentModuleAccessor: funcCall(member(funcCall(member("System", "get"), literal("@lively-env")), "moduleEnv"), literal(moduleId))
  }),
      isGlobal = env.recorderName === "System.global";

  try {
    var rewrittenSource = lively_vm.evalCodeTransformOfSystemRegisterSetters(source, tfmOptions);
    if (debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString += rewrittenSource;
    return rewrittenSource;
  } catch (e) {
    console.error("Error in prepareTranslatedCodeForSetterCapture", e.stack);
    return source;
  }
}

function getCachedNodejsModule(System, load) {
  // On nodejs we might run alongside normal node modules. To not load those
  // twice we have this little hack...
  try {
    var Module = System._nodeRequire("module").Module,
        id = Module._resolveFilename(load.name.replace(/^file:\/\//, "")),
        nodeModule = Module._cache[id];
    return nodeModule;
  } catch (e) {
    System.debug && console.log("[lively.modules getCachedNodejsModule] %s unknown to nodejs", load.name);
  }
  return null;
}

function addNodejsWrapperSource(System, load) {
  // On nodejs we might run alongside normal node modules. To not load those
  // twice we have this little hack...
  var m = getCachedNodejsModule(System, load);
  if (m) {
    load.metadata.format = 'esm';
    load.source = "var exports = System._nodeRequire('" + m.id + "'); export default exports;\n" + lively_lang.properties.allOwnPropertiesOrFunctions(m.exports).map(function (k) {
      return lively_lang.classHelper.isValidIdentifier(k) ? "export var " + k + " = exports['" + k + "'];" : "/*ignoring export \"" + k + "\" b/c it is not a valid identifier*/";
    }).join("\n");
    System.debug && console.log("[lively.modules customTranslate] loading %s from nodejs module cache", load.name);
    return true;
  }
  System.debug && console.log("[lively.modules customTranslate] %s not yet in nodejs module cache", load.name);
  return false;
}

function instrumentSourceOfEsmModuleLoad(System, load) {
  // brittle!
  // The result of System.translate is source code for a call to
  // System.register that can't be run standalone. We parse the necessary
  // details from it that we will use to re-define the module
  // (dependencies, setters, execute)
  // Note: this only works for esm modules!

  return System.translate(load).then(function (translated) {
    // translated looks like
    // (function(__moduleName){System.register(["./some-es6-module.js", ...], function (_export) {
    //   "use strict";
    //   var x, z, y;
    //   return {
    //     setters: [function (_someEs6ModuleJs) { ... }],
    //     execute: function () {...}
    //   };
    // });

    var parsed = lively_ast.parse(translated),
        registerCall = parsed.body[0].expression,
        depNames = lively_lang.arr.pluck(registerCall["arguments"][0].elements, "value"),
        declareFuncNode = registerCall["arguments"][1],
        declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end),
        declare = eval("var __moduleName = \"" + load.name + "\";(" + declareFuncSource + ");\n//# sourceURL=" + load.name + "\n");

    if (System.debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = declare;

    return { localDeps: depNames, declare: declare };
  });
}

function instrumentSourceOfGlobalModuleLoad(System, load) {
  // return {localDeps: depNames, declare: declare};
  return System.translate(load).then(function (translated) {
    return { translated: translated };
  });
}

function wrapModuleLoad$1(System) {
  if (isInstalled(System, "translate", "lively_modules_translate_hook")) return;
  install(System, "translate", function lively_modules_translate_hook(proceed, load) {
    return customTranslate.call(System, proceed, load);
  });
}

function unwrapModuleLoad$1(System) {
  remove$1(System, "translate", "lively_modules_translate_hook");
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Changing exports of module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
      rec = module$2(System, moduleId).record();
  if (rec && (name in rec.exports || addNewExport)) {
    var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
    pending[name] = value;
  }
}

function runScheduledExportChanges(System, moduleId) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
      keysAndValues = pendingExportChanges[moduleId];
  if (!keysAndValues) return;
  clearPendingModuleExportChanges(System, moduleId);
  updateModuleExports(System, moduleId, keysAndValues);
}

function clearPendingModuleExportChanges(System, moduleId) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges;
  delete pendingExportChanges[moduleId];
}

function updateModuleExports(System, moduleId, keysAndValues) {
  var debug = System.debug;
  module$2(System, moduleId).updateRecord(function (record) {

    var newExports = [],
        existingExports = [];

    Object.keys(keysAndValues).forEach(function (name) {
      var value = keysAndValues[name];
      debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", moduleId, name, String(value).slice(0, 30).replace(/\n/g, "") + "...");

      var isNewExport = !(name in record.exports);
      if (isNewExport) record.__lively_modules__.evalOnlyExport[name] = true;
      // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
      record.exports[name] = value;

      if (isNewExport) newExports.push(name);else existingExports.push(name);
    });

    // if it's a new export we don't need to update dependencies, just the
    // module itself since no depends know about the export...
    // HMM... what about *-imports?
    if (newExports.length) {
      var m = System.get(moduleId);
      if (Object.isFrozen(m)) {
        console.warn("[lively.vm es6 updateModuleExports] Since module %s is frozen a new module object was installed in the system. Note that only(!) exisiting module bindings are updated. New exports that were added will only be available in already loaded modules after those are reloaded!", moduleId);
        System.set(moduleId, System.newModule(record.exports));
      } else {
        debug && console.log("[lively.vm es6 updateModuleExports] adding new exports to %s", moduleId);
        newExports.forEach(function (name) {
          Object.defineProperty(m, name, {
            configurable: false, enumerable: true,
            get: function get() {
              return record.exports[name];
            },
            set: function set() {
              throw new Error("exports cannot be changed from the outside");
            }
          });
        });
      }
    }

    if (existingExports.length) {
      debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
      for (var i = 0, l = record.importers.length; i < l; i++) {
        var importerModule = record.importers[i];
        if (!importerModule.locked) {
          // via the module bindings to importer modules we refresh the values
          // bound in those modules by triggering the setters defined in the
          // records of those modules
          var importerIndex,
              found = importerModule.dependencies.some(function (dep, i) {
            importerIndex = i;
            return dep && dep.name === record.name;
          });

          if (found) {
            if (debug) {
              var mod = module$2(System, importerModule.name);
              console.log("[lively.vm es6 updateModuleExports] calling setters of " + mod["package"]().name + "/" + mod.pathInPackage());
            }

            // We could run the entire module again with
            //   importerModule.execute();
            // but this has too many unwanted side effects, so just run the
            // setters:
            module$2(System, importerModule.name).evaluationStart();
            importerModule.setters[importerIndex](record.exports);
            module$2(System, importerModule.name).evaluationEnd();
          }
        }
      }
    }
  });
}

var moduleSourceChange$1 = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(System, moduleId, newSource, format, options) {
    var changeResult;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;

            System.debug && console.log("[module change] " + moduleId + " " + newSource.slice(0, 50).replace(/\n/g, "") + " " + format);

            if (!(!format || format === "es6" || format === "esm" || format === "register" || format === "defined")) {
              _context.next = 8;
              break;
            }

            _context.next = 5;
            return moduleSourceChangeEsm(System, moduleId, newSource, options);

          case 5:
            changeResult = _context.sent;
            _context.next = 15;
            break;

          case 8:
            if (!(format === "global")) {
              _context.next = 14;
              break;
            }

            _context.next = 11;
            return moduleSourceChangeGlobal(System, moduleId, newSource, options);

          case 11:
            changeResult = _context.sent;
            _context.next = 15;
            break;

          case 14:
            throw new Error("moduleSourceChange is not supported for module " + moduleId + " with format " + format);

          case 15:

            lively_notifications.emit("lively.modules/modulechanged", {
              module: moduleId, newSource: newSource, options: options }, Date.now(), System);

            return _context.abrupt("return", changeResult);

          case 19:
            _context.prev = 19;
            _context.t0 = _context["catch"](0);

            lively_notifications.emit("lively.modules/modulechanged", {
              module: moduleId, newSource: newSource, error: _context.t0, options: options }, Date.now(), System);
            throw _context.t0;

          case 23:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[0, 19]]);
  }));

  return function moduleSourceChange$1(_x, _x2, _x3, _x4, _x5) {
    return _ref.apply(this, arguments);
  };
}();

var moduleSourceChangeEsm = function () {
  var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(System, moduleId, newSource, options) {
    var debug, load, updateData, _exports, declared, deps, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, depName, depId, depModule, exports, prevLoad, mod, record;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            debug = System.debug, load = {
              status: 'loading',
              source: newSource,
              name: moduleId,
              address: moduleId,
              linkSets: [],
              dependencies: [],
              metadata: { format: "esm" }
            };

            // translate the source and produce a {declare: FUNCTION, localDeps:
            // [STRING]} object

            _context2.next = 3;
            return instrumentSourceOfEsmModuleLoad(System, load);

          case 3:
            updateData = _context2.sent;


            // evaluate the module source, to get the register module object with execute
            // and setters fields
            _exports = function _exports(name, val) {
              return scheduleModuleExportsChange(System, load.name, name, val, true);
            }, declared = updateData.declare(_exports);


            debug && console.log("[lively.vm es6] sourceChange of %s with deps", load.name, updateData.localDeps);

            // ensure dependencies are loaded
            deps = [];
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 10;
            _iterator = updateData.localDeps[Symbol.iterator]();

          case 12:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context2.next = 25;
              break;
            }

            depName = _step.value;
            _context2.next = 16;
            return System.normalize(depName, load.name);

          case 16:
            depId = _context2.sent;
            depModule = module$2(System, depId);
            _context2.next = 20;
            return depModule.load();

          case 20:
            exports = _context2.sent;

            deps.push({ name: depName, fullname: depId, module: depModule, exports: exports });

          case 22:
            _iteratorNormalCompletion = true;
            _context2.next = 12;
            break;

          case 25:
            _context2.next = 31;
            break;

          case 27:
            _context2.prev = 27;
            _context2.t0 = _context2["catch"](10);
            _didIteratorError = true;
            _iteratorError = _context2.t0;

          case 31:
            _context2.prev = 31;
            _context2.prev = 32;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 34:
            _context2.prev = 34;

            if (!_didIteratorError) {
              _context2.next = 37;
              break;
            }

            throw _iteratorError;

          case 37:
            return _context2.finish(34);

          case 38:
            return _context2.finish(31);

          case 39:

            // hmm... for house keeping... not really needed right now, though
            prevLoad = System.loads && System.loads[load.name];

            if (prevLoad) {
              prevLoad.deps = deps.map(function (ea) {
                return ea.name;
              });
              prevLoad.depMap = deps.reduce(function (map, dep) {
                map[dep.name] = dep.fullname;return map;
              }, {});
              if (prevLoad.metadata && prevLoad.metadata.entry) {
                prevLoad.metadata.entry.deps = prevLoad.deps;
                prevLoad.metadata.entry.normalizedDeps = deps.map(function (ea) {
                  return ea.fullname;
                });
                prevLoad.metadata.entry.declare = updateData.declare;
              }
            }

            mod = module$2(System, load.name), record = mod.record();

            // 1. update the record so that when its dependencies change and cause a
            // re-execute, the correct code (new version) is run

            deps.forEach(function (ea, i) {
              return mod.addDependencyToModuleRecord(ea.module, declared.setters[i]);
            });
            if (record) record.execute = declared.execute;

            // 2. run setters to populate imports
            deps.forEach(function (d, i) {
              return declared.setters[i](d.exports);
            });

            // 3. execute module body
            return _context2.abrupt("return", declared.execute());

          case 46:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this, [[10, 27, 31, 39], [32,, 34, 38]]);
  }));

  return function moduleSourceChangeEsm(_x6, _x7, _x8, _x9) {
    return _ref2.apply(this, arguments);
  };
}();

var moduleSourceChangeGlobal = function () {
  var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(System, moduleId, newSource, options) {
    var load, updateData, entry;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            load = {
              status: 'loading',
              source: newSource,
              name: moduleId,
              address: moduleId,
              linkSets: [],
              dependencies: [],
              metadata: { format: "global" }
            };

            if (System.get(moduleId)) {
              _context3.next = 4;
              break;
            }

            _context3.next = 4;
            return System["import"](moduleId);

          case 4:
            _context3.next = 6;
            return instrumentSourceOfGlobalModuleLoad(System, load);

          case 6:
            updateData = _context3.sent;


            load.source = updateData.translated;
            entry = doInstantiateGlobalModule(System, load);

            System.delete(moduleId);
            System.set(entry.name, entry.esModule);
            return _context3.abrupt("return", entry.module);

          case 12:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  return function moduleSourceChangeGlobal(_x10, _x11, _x12, _x13) {
    return _ref3.apply(this, arguments);
  };
}();

function doInstantiateGlobalModule(System, load) {

  var entry = __createEntry();
  entry.name = load.name;
  entry.esmExports = true;
  load.metadata.entry = entry;

  entry.deps = [];

  for (var g in load.metadata.globals) {
    var gl = load.metadata.globals[g];
    if (gl) entry.deps.push(gl);
  }

  entry.execute = function executeGlobalModule(require, exports, m) {

    // SystemJS exports detection for global modules is based in new props
    // added to the global. In order to allow re-load we remove previously
    // "exported" values
    var prevMeta = module$2(System, m.id).metadata(),
        exports = prevMeta && prevMeta.entry && prevMeta.entry.module && prevMeta.entry.module.exports;
    if (exports) Object.keys(exports).forEach(function (name) {
      try {
        delete System.global[name];
      } catch (e) {
        console.warn("[lively.modules] executeGlobalModule: Cannot delete global[\"" + name + "\"]");
      }
    });

    var globals;
    if (load.metadata.globals) {
      globals = {};
      for (var g in load.metadata.globals) {
        if (load.metadata.globals[g]) globals[g] = require(load.metadata.globals[g]);
      }
    }

    var exportName = load.metadata.exports;

    if (exportName) load.source += "\nSystem.global[\"" + exportName + "\"] = " + exportName + ";";

    var retrieveGlobal = System.get('@@global-helpers').prepareGlobal(module$2.id, exportName, globals);

    __evaluateGlobalLoadSource(System, load);

    return retrieveGlobal();
  };

  return runExecuteOfGlobalModule(System, entry);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function __createEntry() {
  return {
    name: null,
    deps: null,
    originalIndices: null,
    declare: null,
    execute: null,
    executingRequire: false,
    declarative: false,
    normalizedDeps: null,
    groupIndex: null,
    evaluated: false,
    module: null,
    esModule: null,
    esmExports: false
  };
}

function __evaluateGlobalLoadSource(System, load) {
  // System clobbering protection (mostly for Traceur)
  var curLoad,
      curSystem,
      callCounter = 0,
      __global = System.global;
  return __exec.call(System, load);

  function preExec(loader, load) {
    if (callCounter++ == 0) curSystem = __global.System;
    __global.System = __global.SystemJS = loader;
  }

  function postExec() {
    if (--callCounter == 0) __global.System = __global.SystemJS = curSystem;
    curLoad = undefined;
  }

  function __exec(load) {
    // if ((load.metadata.integrity || load.metadata.nonce) && supportsScriptExec)
    //   return scriptExec.call(this, load);
    try {
      preExec(this, load);
      curLoad = load;
      (0, eval)(load.source);
      postExec();
    } catch (e) {
      postExec();
      throw new Error("Error evaluating " + load.address + ":\n" + e.stack);
    }
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function runExecuteOfGlobalModule(System, entry) {
  // if (entry.module) return;

  var exports = {},
      module = entry.module = { exports: exports, id: entry.name };

  // // AMD requires execute the tree first
  // if (!entry.executingRequire) {
  //   for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
  //     var depName = entry.normalizedDeps[i];
  //     var depEntry = loader.defined[depName];
  //     if (depEntry)
  //       linkDynamicModule(depEntry, loader);
  //   }
  // }

  // now execute
  entry.evaluated = true;
  var output = entry.execute.call(System.global, function (name) {
    var dep = entry.deps.find(function (dep) {
      return dep === name;
    }),
        loadedDep = dep && System.get(entry.normalizedDeps[entry.deps.indexOf(dep)]) || System.get(System.decanonicalize(name, entry.name));
    if (loadedDep) return loadedDep;
    throw new Error('Module ' + name + ' not declared as a dependency of ' + entry.name);
  }, exports, module);

  if (output) module.exports = output;

  // create the esModule object, which allows ES6 named imports of dynamics
  exports = module.exports;

  // __esModule flag treats as already-named
  var Module = System.get("@system-env").constructor;
  if (exports && (exports.__esModule || exports instanceof Module)) entry.esModule = exports;
  // set module as 'default' export, then fake named exports by iterating properties
  else if (entry.esmExports && exports !== System.global) entry.esModule = System.newModule(exports);
    // just use the 'default' export
    else entry.esModule = { 'default': exports };

  return entry;
}

var join = lively_lang.string.joinPath;

function isURL(string$$1) {
  return (/^[^:\\]+:\/\//.test(string$$1)
  );
}

function urlResolve(url) {
  var urlMatch = url.match(/^([^:]+:\/\/)(.*)/);
  if (!urlMatch) return url;

  var protocol = urlMatch[1],
      path = urlMatch[2],
      result = path;
  // /foo/../bar --> /bar
  do {
    path = result;
    result = path.replace(/\/[^\/]+\/\.\./, '');
  } while (result != path);
  // foo//bar --> foo/bar
  result = result.replace(/(^|[^:])[\/]+/g, '$1/');
  // foo/./bar --> foo/bar
  result = result.replace(/\/\.\//g, '/');
  return protocol + result;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// internal
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function normalizeInsidePackage(System, urlOrName, packageURL) {
  return isURL(urlOrName) ? urlOrName : // absolute
  urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
}

function normalizePackageURL(System, packageURL) {
  if (allPackageNames(System).some(function (ea) {
    return ea === packageURL;
  })) return packageURL;

  var url = System.decanonicalize(packageURL.replace(/[\/]+$/, "") + "/");

  if (!isURL(url)) throw new Error("Strange package URL: " + url + " is not a valid URL");

  // ensure it's a directory
  if (!url.match(/\.js/)) url = url;else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");else url = url.split("/").slice(0, -1).join("/");

  if (url.match(/\.js$/)) throw new Error("packageURL is expected to point to a directory but seems to be a .js file: " + url);

  return String(url).replace(/\/$/, "");
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// We add instances of Package to the System which basically serves as
// "database" for all module / package related state.
// This also makes it easy to completely replace the module / package state by
// simply replacing the System instance
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// System.get("@lively-env").packages["http://localhost:9011/lively-system-interface/node_modules/lively.vm"] = new Package(System, System.decanonicalize("lively.vm/"))

function packageStore(System) {
  return System.get("@lively-env").packages;
}

function addToPackageStore(System, p) {
  var pInSystem = System.getConfig().packages[p.url] || {};
  p.mergeWithConfig(pInSystem);
  var store = packageStore(System);
  store[p.url] = p;
  return p;
}

function removeFromPackageStore(System, o) {
  var store = packageStore(System);
  delete store[o.url];
}

function findPackageNamed(System, name) {
  return lively_lang.obj.values(packageStore(System)).find(function (ea) {
    return ea.name === name;
  });
}

function getPackage$1(System, packageURL) {
  var isNormalized = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var url = isNormalized ? packageURL : normalizePackageURL(System, packageURL);
  return packageStore(System).hasOwnProperty(url) ? packageStore(System)[url] : addToPackageStore(System, new Package(System, url));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// config
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var PackageConfiguration = function () {
  function PackageConfiguration(pkg) {
    classCallCheck(this, PackageConfiguration);

    this.pkg = pkg;
  }

  createClass(PackageConfiguration, [{
    key: "applyConfig",
    value: function applyConfig(config) {
      // takes a config json object (typically read from a package.json file but
      // can be used standalone) and changes the System configuration to what it finds
      // in it.
      // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
      // and uses the "lively" section as described in `applyLivelyConfig`

      var System = this.System,
          packageURL = this.packageURL,
          pkg = this.pkg,
          name = config.name || packageURL.split("/").slice(-1)[0],
          version = config.version,
          sysConfig = config.systemjs || {},
          livelyConfig = config.lively,
          main = config.main || "index.js";


      System.config({
        map: defineProperty({}, name, packageURL),
        packages: defineProperty({}, packageURL, sysConfig)
      });

      var packageInSystem = System.getConfig().packages[packageURL] || {};
      if (!packageInSystem.map) packageInSystem.map = {};

      if (sysConfig) {
        if (livelyConfig && livelyConfig.main) main = livelyConfig.main;else if (sysConfig.main) main = sysConfig.main;
        this.applySystemJSConfig(sysConfig);
      }

      packageInSystem.referencedAs = packageInSystem.referencedAs || [];
      lively_lang.arr.pushIfNotIncluded(packageInSystem.referencedAs, name);

      if (!main.match(/\.[^\/\.]+/)) main += ".js";
      packageInSystem.main = main;

      // System.packages doesn't allow us to store our own properties
      pkg.version = version;
      pkg.mergeWithConfig(packageInSystem);

      return livelyConfig ? this.applyLivelyConfig(livelyConfig) : { subPackages: [] };
    }
  }, {
    key: "applySystemJSConfig",
    value: function applySystemJSConfig(sysConfig) {
      var System = this.System;
      // System.debug && console.log("[lively.modules package configuration] applying SystemJS config of %s", pkg);

      if (sysConfig.packageConfigPaths) System.packageConfigPaths = lively_lang.arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
      if (sysConfig.packages) // packages is normaly not support locally in a package.json
        System.config({ packages: sysConfig.packages });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // lively config
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "applyLivelyConfig",
    value: function applyLivelyConfig(livelyConfig) {
      // configures System object from lively config JSON object.
      // - adds System.package entry for package
      // - adds name to System.package[pkg.url].referencedAs
      // - installs hook from {hooks: [{name, source}]}
      // - merges livelyConfig.packageMap into System.package[pkg.url].map
      //   entries in packageMap are specifically meant to be sub-packages!
      // Will return a {subPackages: [{name, address},...]} object

      this.applyLivelyConfigMeta(livelyConfig);
      this.applyLivelyConfigHooks(livelyConfig);
      this.applyLivelyConfigBundles(livelyConfig);
      return this.applyLivelyConfigPackageMap(livelyConfig);
    }
  }, {
    key: "applyLivelyConfigHooks",
    value: function applyLivelyConfigHooks(livelyConfig) {
      var _this = this;

      (livelyConfig.hooks || []).forEach(function (h) {
        try {
          var f = eval("(" + h.source + ")");
          if (!f.name || !isInstalled(_this.System, h.target, f.name)) install(_this.System, h.target, f);
        } catch (e) {
          console.error("Error installing hook for %s: %s", _this.packageURL, e, h);
        }
      });
    }
  }, {
    key: "applyLivelyConfigBundles",
    value: function applyLivelyConfigBundles(livelyConfig) {
      var _this2 = this;

      if (!livelyConfig.bundles) return Promise.resolve();
      var normalized = Object.keys(livelyConfig.bundles).reduce(function (bundles, name) {
        var absName = _this2.packageURL + "/" + name,
            files = livelyConfig.bundles[name].map(function (f) {
          return _this2.System.decanonicalize(f, _this2.packageURL + "/");
        });
        bundles[absName] = files;
        return bundles;
      }, {});
      this.System.config({ bundles: normalized });
      return Promise.resolve();
    }
  }, {
    key: "applyLivelyConfigMeta",
    value: function applyLivelyConfigMeta(livelyConfig) {
      if (!livelyConfig.meta) return;
      var pConf = this.System.getConfig().packages[this.packageURL] || {},
          c = { meta: {}, packages: defineProperty({}, this.packageURL, pConf) };
      Object.keys(livelyConfig.meta).forEach(function (key) {
        var val = livelyConfig.meta[key];
        if (isURL(key)) {
          c.meta[key] = val;
        } else {
          if (!pConf.meta) pConf.meta = {};
          pConf.meta[key] = val;
        }
      });
      this.System.config(c);
    }
  }, {
    key: "applyLivelyConfigPackageMap",
    value: function applyLivelyConfigPackageMap(livelyConfig) {
      var _this3 = this;

      var subPackages = livelyConfig.packageMap ? Object.keys(livelyConfig.packageMap).map(function (name) {
        return _this3.subpackageNameAndAddress(livelyConfig, name);
      }) : [];
      return { subPackages: subPackages };
    }
  }, {
    key: "subpackageNameAndAddress",
    value: function subpackageNameAndAddress(livelyConfig, subPackageName) {
      // find out what other packages are dependencies of this.pkg

      var System = this.System,
          packageURL = this.packageURL,
          pkg = this.pkg,
          preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ? livelyConfig.preferLoadedPackages : true,
          normalized = System.decanonicalize(subPackageName, packageURL);


      if (preferLoadedPackages) {
        var subpackageURL,
            existing = findPackageNamed(System, subPackageName);

        if (existing) subpackageURL = existing.url;else if (pkg.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, pkg.map[subPackageName], packageURL);else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);else if (System.get(normalized)) subpackageURL = System.decanonicalize(subPackageName, packageURL + "/");

        if (subpackageURL) {
          if (System.get(subpackageURL)) subpackageURL = subpackageURL.split("/").slice(0, -1).join("/"); // force to be dir
          System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, pkg, subpackageURL);
          return getPackage$1(System, subpackageURL);
        }
      }

      pkg.addMapping(subPackageName, livelyConfig.packageMap[subPackageName]);

      // lookup
      var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], pkg.url);
      System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, pkg, subpackageURL);

      return getPackage$1(System, subpackageURL);
    }
  }, {
    key: "System",
    get: function get() {
      return this.pkg.System;
    }
  }, {
    key: "packageURL",
    get: function get() {
      return this.pkg.url;
    }
  }]);
  return PackageConfiguration;
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var Package = function () {
  createClass(Package, null, [{
    key: "allPackages",
    value: function allPackages(System) {
      return lively_lang.obj.values(packageStore(System));
    }
  }, {
    key: "forModule",
    value: function forModule(System, module) {
      var id = module.id,
          map = moduleNamesByPackageNames(System),
          pAddress = Object.keys(map).find(function (pName) {
        return map[pName].includes(id);
      });
      return getPackage$1(System, pAddress, true /*normalized*/);
    }
  }]);

  function Package(System, packageURL) {
    classCallCheck(this, Package);

    // the name from the packages config, set once the config is loaded
    this._name = undefined;
    // The names under which the package is referenced by other packages
    this.referencedAs = [];
    this.url = packageURL;
    this.System = System;
    this.version = null;
    this.registerProcess = null;
    this.map = {};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  createClass(Package, [{
    key: "path",
    value: function path() {
      var base = this.System.baseURL;
      return this.url.indexOf(base) === 0 ? this.url.slice(base.length) : this.url;
    }
  }, {
    key: "modules",
    value: function modules() {
      var _this4 = this;

      return (moduleNamesByPackageNames(this.System)[this.url] || []).map(function (id) {
        return module$2(_this4.System, id);
      });
    }
  }, {
    key: "resources",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(matches /*= url => url.match(/\.js$/)*/
      ) {
        var _this5 = this;

        var exclude = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [".git", "node_modules"];
        var allPackages, packagesToIgnore, dirList, resourceURLs, loadedModules$$1;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                allPackages = allPackageNames(this.System);
                packagesToIgnore = allPackages.filter(function (purl) {
                  return purl !== _this5.url && !_this5.url.startsWith(purl); /*parent packages*/
                });
                _context.next = 4;
                return lively_resources.resource(this.address).dirList('infinity', { exclude: exclude });

              case 4:
                dirList = _context.sent;
                resourceURLs = dirList.filter(function (ea) {
                  return !ea.isDirectory() && !packagesToIgnore.some(function (purl) {
                    return ea.url.startsWith(purl);
                  });
                }).map(function (ea) {
                  return ea.url;
                });
                loadedModules$$1 = lively_lang.arr.pluck(this.modules(), "id");


                if (matches) resourceURLs = resourceURLs.filter(matches);

                return _context.abrupt("return", resourceURLs.map(function (url) {
                  var nameInPackage = url.replace(_this5.address, "").replace(/^\//, ""),
                      isLoaded = loadedModules$$1.includes(url);
                  return { isLoaded: isLoaded, url: url, nameInPackage: nameInPackage, package: _this5 };
                }));

              case 9:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function resources(_x2, _x3) {
        return _ref.apply(this, arguments);
      }

      return resources;
    }()
  }, {
    key: "toString",
    value: function toString() {
      return "Package(" + this.name + " - " + this.path() + "/)";
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // configuration
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "mergeWithConfig",
    value: function mergeWithConfig(config) {
      config = _extends({}, config);
      var _config = config,
          name = _config.name,
          referencedAs = _config.referencedAs,
          map = _config.map;


      if (referencedAs) {
        delete config.referencedAs;
        this.referencedAs = lively_lang.arr.uniq(this.referencedAs.concat(referencedAs));
      }

      if (name) {
        delete config.name;
        this._name = name;
      }

      if (map) {
        delete config.map;
        Object.assign(this.map, map);
      }

      Object.assign(this, config);
      return this;
    }
  }, {
    key: "addMapping",
    value: function addMapping(name, url) {
      this.map[name] = url;
      this.System.config({ packages: defineProperty({}, this.url, { map: defineProperty({}, name, url) }) });
    }
  }, {
    key: "tryToLoadPackageConfig",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var System, url, packageConfigURL, config, name;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                System = this.System, url = this.url, packageConfigURL = url + "/package.json";


                System.config({
                  meta: defineProperty({}, packageConfigURL, { format: "json" }),
                  packages: defineProperty({}, url, { meta: { "package.json": { format: "json" } } })
                });

                System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL);

                _context2.prev = 3;
                _context2.t0 = System.get(packageConfigURL);

                if (_context2.t0) {
                  _context2.next = 9;
                  break;
                }

                _context2.next = 8;
                return System.import(packageConfigURL);

              case 8:
                _context2.t0 = _context2.sent;

              case 9:
                config = _context2.t0;

                lively_lang.arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL); // to inform systemjs that there is a config
                return _context2.abrupt("return", config);

              case 14:
                _context2.prev = 14;
                _context2.t1 = _context2["catch"](3);

                console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, _context2.t1);
                delete System.meta[packageConfigURL];
                name = url.split("/").slice(-1)[0];
                return _context2.abrupt("return", { name: name });

              case 20:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this, [[3, 14]]);
      }));

      function tryToLoadPackageConfig() {
        return _ref2.apply(this, arguments);
      }

      return tryToLoadPackageConfig;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // register / load
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "import",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.register();

              case 2:
                _context3.t0 = this.System;
                _context3.next = 5;
                return this.System.normalize(this.url);

              case 5:
                _context3.t1 = _context3.sent;
                return _context3.abrupt("return", _context3.t0.import.call(_context3.t0, _context3.t1));

              case 7:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function _import() {
        return _ref3.apply(this, arguments);
      }

      return _import;
    }()
  }, {
    key: "isRegistering",
    value: function isRegistering() {
      return !!this.registerProcess;
    }
  }, {
    key: "register",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(optPkgConfig) {
        var packageLoadStack = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [this.url];

        var System, url, cfg, packageConfigResult, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, supPkg, shortStack, registerP;

        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (!this.isRegistering()) {
                  _context4.next = 2;
                  break;
                }

                return _context4.abrupt("return", this.registerProcess.promise);

              case 2:
                System = this.System, url = this.url;

                this.registerProcess = lively_lang.promise.deferred();

                System.debug && console.log("[lively.modules package register] %s", url);

                _context4.t0 = optPkgConfig;

                if (_context4.t0) {
                  _context4.next = 10;
                  break;
                }

                _context4.next = 9;
                return this.tryToLoadPackageConfig();

              case 9:
                _context4.t0 = _context4.sent;

              case 10:
                cfg = _context4.t0;
                packageConfigResult = new PackageConfiguration(this).applyConfig(cfg);
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context4.prev = 15;
                _iterator = packageConfigResult.subPackages[Symbol.iterator]();

              case 17:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context4.next = 29;
                  break;
                }

                supPkg = _step.value;

                if (!packageLoadStack.includes(supPkg.url)) {
                  _context4.next = 23;
                  break;
                }

                if (System.debug || true) {
                  shortStack = packageLoadStack && packageLoadStack.map(function (ea) {
                    return ea.indexOf(System.baseURL) === 0 ? ea.slice(System.baseURL.length) : ea;
                  });

                  System.debug && console.log("[lively.modules package register]" + (" " + url + " is a circular dependency, stopping registering ") + ("subpackages, stack: " + shortStack));
                }
                _context4.next = 26;
                break;

              case 23:
                packageLoadStack.push(supPkg.url);
                _context4.next = 26;
                return supPkg.register(null, packageLoadStack);

              case 26:
                _iteratorNormalCompletion = true;
                _context4.next = 17;
                break;

              case 29:
                _context4.next = 35;
                break;

              case 31:
                _context4.prev = 31;
                _context4.t1 = _context4["catch"](15);
                _didIteratorError = true;
                _iteratorError = _context4.t1;

              case 35:
                _context4.prev = 35;
                _context4.prev = 36;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 38:
                _context4.prev = 38;

                if (!_didIteratorError) {
                  _context4.next = 41;
                  break;
                }

                throw _iteratorError;

              case 41:
                return _context4.finish(38);

              case 42:
                return _context4.finish(35);

              case 43:
                registerP = this.registerProcess.promise;

                this.registerProcess.resolve(cfg);
                delete this.registerProcess;
                lively_notifications.emit("lively.modules/packageregistered", { "package": this.url }, Date.now(), System);

                return _context4.abrupt("return", registerP);

              case 48:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[15, 31, 35, 43], [36,, 38, 42]]);
      }));

      function register(_x5, _x6) {
        return _ref4.apply(this, arguments);
      }

      return register;
    }()
  }, {
    key: "remove",
    value: function remove() {
      var System = this.System,
          url = this.url;


      url = url.replace(/\/$/, "");
      var conf = System.getConfig(),
          packageConfigURL = url + "/package.json",
          p = getPackages$1(System).find(function (ea) {
        return ea.address === url;
      });

      if (p) p.modules.forEach(function (mod) {
        return module$2(System, mod.name).unload({ forgetEnv: true, forgetDeps: false });
      });

      removeFromPackageStore(System, this);
      System.delete(String(packageConfigURL));
      lively_lang.arr.remove(conf.packageConfigPaths || [], packageConfigURL);

      System.config({
        meta: defineProperty({}, packageConfigURL, {}),
        packages: defineProperty({}, url, {}),
        packageConfigPaths: conf.packageConfigPaths
      });
      delete System.meta[packageConfigURL];
      delete System.packages[url];
      lively_notifications.emit("lively.modules/packageremoved", { "package": this.url }, Date.now(), System);
    }
  }, {
    key: "reload",
    value: function reload() {
      this.remove();return this.import();
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // searching
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "search",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(needle) {
        var _this6 = this;

        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var modules;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                if (!options.includeUnloaded) {
                  _context5.next = 7;
                  break;
                }

                _context5.next = 3;
                return this.resources(function (url) {
                  return url.endsWith(".js");
                }, [".git", "node_modules", "dist"]);

              case 3:
                _context5.t1 = function (_ref6) {
                  var url = _ref6.url;
                  return module$2(_this6.System, url);
                };

                _context5.t0 = _context5.sent.map(_context5.t1);
                _context5.next = 8;
                break;

              case 7:
                _context5.t0 = this.modules().filter(function (ea) {
                  return ea.isLoaded();
                });

              case 8:
                modules = _context5.t0;
                return _context5.abrupt("return", Promise.all(modules.map(function (m) {
                  return m.search(needle, options).catch(function (err) {
                    console.error("Error searching module " + m.name + ":\n" + err.stack);
                    return [];
                  });
                })).then(function (res) {
                  return lively_lang.arr.flatten(res, 1);
                }));

              case 10:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function search(_x8, _x9) {
        return _ref5.apply(this, arguments);
      }

      return search;
    }()
  }, {
    key: "name",
    get: function get() {
      if (this._name) return this._name;
      var config = this.System.get(this.url + "/package.json");
      if (config && config.name) return config.name;
      if (this.referencedAs[0]) return this.referencedAs[0];
      return lively_lang.arr.last(this.url.replace(/[\/]+$/, "").split("/"));
    },
    set: function set(v) {
      return this._name = v;
    }
  }, {
    key: "address",
    get: function get() {
      return this.url;
    },
    set: function set(v) {
      return this.url = v;
    }
  }]);
  return Package;
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function importPackage$1(System, packageURL) {
  return getPackage$1(System, packageURL).import();
}
function registerPackage$1(System, packageURL, optPkgConfig) {
  return getPackage$1(System, packageURL).register(optPkgConfig);
}
function removePackage$1(System, packageURL) {
  return getPackage$1(System, packageURL).remove();
}
function reloadPackage$1(System, packageURL) {
  return getPackage$1(System, packageURL).reload();
}

function allPackageNames(System) {
  var sysPackages = System.packages,
      livelyPackages = packageStore(System);
  return lively_lang.arr.uniq(Object.keys(sysPackages).concat(Object.keys(livelyPackages)));
}

function moduleNamesByPackageNames(System) {
  var modules = knownModuleNames(System),
      packageNames = allPackageNames(System);

  return modules.reduce(function (packageMap, moduleName) {
    var itsPackage = packageNames.reduce(function (itsPackage, packageName) {
      if (!moduleName.startsWith(packageName)) return itsPackage;
      if (!itsPackage || itsPackage.length < packageName.length) return packageName;
      return itsPackage;
    }, null) || "no group";
    var packageModules = packageMap[itsPackage] || (packageMap[itsPackage] = []);
    packageModules.push(moduleName);
    return packageMap;
  }, {});
}

function getPackages$1(System) {
  // Note does not return package instances but spec objects that can be JSON
  // stringified(!) like
  // ```
  // [{
  //   address: package-address,
  //   modules: [module-name-1, module-name-2, ...],
  //   name: package-name,
  //   names: [package-name, ...]
  //   version: semver version number
  // }, ... ]
  // ```
  return Package.allPackages(System).map(function (p) {
    return _extends({}, lively_lang.obj.select(p, ["name", "main", "map", "meta", "referencedAs", "url", "address", "version"]), {
      modules: p.modules().map(function (m) {
        return { name: m.id, deps: m.directRequirements().map(function (ea) {
            return ea.id;
          }) };
      })
    });
  });
}

function applyConfig(System, packageConfig, packageURL) {
  return new PackageConfiguration(getPackage$1(System, packageURL)).applyConfig(packageConfig);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// injecting the import into a module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*

The injector doesn't actually modify modules (or evaluate import statements)
but only generates the code to do so.

// The import we want to add
var importData = {
  exported: "xxx",
  moduleId: "http://foo/src/b.js",
  packageName: "test-package",
  packageURL: "http://foo/",
  pathInPackage: "src/b.js"
}

// The module and source we want to modify
var m = "http://foo/a.js", src = "import { yyy } from './src/b.js'; class Foo {}";

// run
var {generated, newSource, from, to, standaloneImport, importedVarName} =
  ImportInjector.run(System, m, {name: "test-package"}, src, importData, "zzz");

generated // => ", xxx"
from, to // => 12, 17 , indexes to inject generated
newSource // => "import { yyy, xxx } from './src/b.js'; class Foo {}"
standaloneImport // => import { xxx } from "./src/b.js"; can be used for evaluation
importedVarName // => "xxx"

*/

var ImportInjector = function () {
  createClass(ImportInjector, null, [{
    key: "run",
    value: function run(System, intoModuleId, intoPackage, intoModuleSource, importData) {
      var alias = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : undefined;
      var optAst = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : undefined;

      return new this(System, intoModuleId, intoPackage, intoModuleSource, importData, alias, optAst).run();
    }
  }]);

  function ImportInjector(System, intoModuleId, intoPackage, intoModuleSource, importData, alias, optAst) {
    classCallCheck(this, ImportInjector);

    this.System = System;
    this.intoModuleId = intoModuleId;
    this.intoPackage = intoPackage;
    this.intoModuleSource = intoModuleSource;
    this.fromModuleId = importData.moduleId;
    this.importData = importData;
    this.alias = alias;
    this.parsed = optAst || lively_ast.fuzzyParse(intoModuleSource);
  }

  createClass(ImportInjector, [{
    key: "run",
    value: function run() {
      var newImport = this.generateImportStatement(),
          standaloneImport = newImport.standaloneImport,
          importedVarName = newImport.importedVarName,
          _existingImportsOfFro = this.existingImportsOfFromModule(),
          imports = _existingImportsOfFro.imports,
          importsOfFromModule = _existingImportsOfFro.importsOfFromModule,
          importsOfVar = _existingImportsOfFro.importsOfVar;


      importsOfFromModule = this.importsToBeReused(importsOfFromModule, importsOfVar, newImport);

      // already imported?
      if (importsOfVar.length) return {
        status: "not modified",
        newSource: this.intoModuleSource,
        generated: "",
        importedVarName: "",
        standaloneImport: standaloneImport,
        from: importsOfVar[0].start, to: importsOfVar[0].end
      };

      // modify an existing import?
      if (importsOfFromModule.length) {
        var modified = this.modifyExistingImport(importsOfFromModule, standaloneImport);
        if (modified) return modified;
      }

      // prepend new import
      var lastImport = lively_lang.arr.last(imports),
          insertPos = lastImport ? lastImport.end : 0;
      return this.insertNewImport(importsOfFromModule, standaloneImport, importedVarName, insertPos);
    }
  }, {
    key: "importsToBeReused",
    value: function importsToBeReused(importsOfFromModule, importsOfVar, newImport) {
      if (newImport.isDefault) {
        importsOfFromModule = importsOfFromModule.filter(function (ea) {
          return !ea.specifiers.some(function (spec) {
            return spec.type == "ImportDefaultSpecifier";
          });
        });
      }
      return importsOfFromModule;
    }
  }, {
    key: "generateImportStatement",
    value: function generateImportStatement() {
      var intoModuleId = this.intoModuleId,
          fromModuleId = this.fromModuleId,
          importData = this.importData,
          intoPackage = this.intoPackage,
          alias = this.alias,
          isDefault = importData.exported === "default",
          varName = alias ? alias : isDefault ? importData.local : importData.exported,
          aliased = !isDefault && importData.exported !== varName,
          intoPackageName = intoPackage && intoPackage.name,
          exportPath = fromModuleId;
      var packageName = importData.packageName,
          pathInPackage = importData.pathInPackage,
          isMain = importData.isMain;

      if (isMain) exportPath = packageName;else if (intoPackageName === packageName) {
        try {
          exportPath = lively_resources.resource(fromModuleId).relativePathFrom(lively_resources.resource(intoModuleId));
          if (!exportPath.startsWith(".")) exportPath = "./" + exportPath;
        } catch (e) {
          if (packageName && packageName !== "no group" && pathInPackage) exportPath = packageName + "/" + pathInPackage;
        }
      } else {
        if (packageName && packageName !== "no group" && pathInPackage) exportPath = packageName + "/" + pathInPackage;
      }

      return {
        isDefault: isDefault,
        standaloneImport: isDefault ? "import " + varName + " from \"" + exportPath + "\";" : "import { " + importData.exported + (aliased ? " as " + varName : "") + " } from \"" + exportPath + "\";",
        importedVarName: varName
      };
    }
  }, {
    key: "existingImportsOfFromModule",
    value: function existingImportsOfFromModule() {
      var System = this.System,
          fromModuleId = this.fromModuleId,
          intoModuleId = this.intoModuleId,
          _importData = this.importData,
          exported = _importData.exported,
          local = _importData.local,
          parsed = this.parsed,
          alias = this.alias,
          isDefault = exported === "default",
          imports = parsed.body.filter(function (_ref) {
        var type = _ref.type;
        return type === "ImportDeclaration";
      }),
          varName = isDefault ? alias || local : alias || exported;


      var importsOfFromModule = imports.filter(function (ea) {
        if (!ea.source || typeof ea.source.value !== "string") return null;
        var sourceId = System.decanonicalize(ea.source.value, intoModuleId);
        return fromModuleId === sourceId;
      });

      var importsOfImportedVar = importsOfFromModule.filter(function (ea) {
        return (ea.specifiers || []).some(function (iSpec) {
          return isDefault ? iSpec.type === "ImportDefaultSpecifier" && iSpec.local.name === varName : lively_lang.Path("imported.name").get(iSpec) === exported && lively_lang.Path("local.name").get(iSpec) === varName;
        });
      });

      return {
        imports: imports, importsOfFromModule: importsOfFromModule,
        importsOfVar: importsOfImportedVar
      };
    }
  }, {
    key: "modifyExistingImport",
    value: function modifyExistingImport(imports, standaloneImport) {
      var specifiers = lively_lang.arr.flatmap(imports, function (_ref2) {
        var specifiers = _ref2.specifiers;
        return specifiers || [];
      });
      if (!specifiers.length) return null;

      var _arr$partition = lively_lang.arr.partition(specifiers, function (_ref3) {
        var type = _ref3.type;
        return type === "ImportDefaultSpecifier";
      }),
          _arr$partition2 = slicedToArray(_arr$partition, 2),
          _arr$partition2$ = slicedToArray(_arr$partition2[0], 1),
          defaultSpecifier = _arr$partition2$[0],
          _arr$partition2$2 = slicedToArray(_arr$partition2[1], 1),
          normalSpecifier = _arr$partition2$2[0];

      // defaultSpecifier = arr.partition(imports, ({type}) => type === "ImportDefaultSpecifier")[0][0]
      // normalSpecifier = arr.partition(imports, ({type}) => type === "ImportDefaultSpecifier")[1][0]

      var alias = this.alias,
          src = this.intoModuleSource,
          _importData2 = this.importData,
          impName = _importData2.exported,
          defaultImpName = _importData2.local,
          isDefault = impName === "default";

      // Since this method is only called with imports this should never happen:

      if (isDefault) console.assert(!!normalSpecifier, "no ImportSpecifier found");else console.assert(normalSpecifier || defaultSpecifier, "at least one kine of specifier is expected");

      if (isDefault) {
        var pos = src.slice(0, normalSpecifier.start).lastIndexOf("{") - 1;
        if (pos < 0) return null;

        var generated = (alias || defaultImpName) + ",",
            pre = src.slice(0, pos),
            post = src.slice(pos);

        if (!pre.endsWith(" ") || !pre.endsWith("\n")) generated = " " + generated;
        if (!post.startsWith(" ")) generated += " ";

        return {
          status: "modified",
          newSource: "" + pre + generated + post,
          generated: generated,
          standaloneImport: standaloneImport,
          importedVarName: alias || defaultImpName,
          from: pos, to: pos + generated.length
        };
      }

      var pos = normalSpecifier ? normalSpecifier.end : defaultSpecifier.end,
          aliased = alias && alias !== impName,
          namePart = aliased ? impName + " as " + alias : impName;
      generated = normalSpecifier ? ", " + namePart : ", { " + namePart + " }";

      return {
        status: "modified",
        newSource: "" + src.slice(0, pos) + generated + src.slice(pos),
        generated: generated,
        standaloneImport: standaloneImport,
        importedVarName: aliased ? alias : impName,
        from: pos, to: pos + generated.length
      };
    }
  }, {
    key: "insertNewImport",
    value: function insertNewImport(importsOfFromModule, standaloneImport, importedVarName) {
      var insertPos = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

      if (importsOfFromModule && importsOfFromModule.length) insertPos = lively_lang.arr.last(importsOfFromModule).end;

      var src = this.intoModuleSource,
          pre = src.slice(0, insertPos),
          post = src.slice(insertPos),
          generated = standaloneImport;

      if (pre.length && !pre.endsWith("\n")) generated = "\n" + generated;
      if (post.length && !post.startsWith("\n")) generated += "\n";

      return {
        status: "modified",
        newSource: pre + generated + post,
        generated: generated,
        standaloneImport: standaloneImport,
        importedVarName: importedVarName,
        from: insertPos, to: insertPos + generated.length
      };
    }
  }]);
  return ImportInjector;
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// removing imports from a module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*

var src = "import { xxx, yyy } from './src/b.js'; class Foo { m() { return yyy + 1 } }";
var unusedImports = ImportRemover.findUnusedImports(src);
unusedImports // => [{local: "xxx", importStmt: {...}}]



var {changes, removedImports, source} = ImportRemover.removeImports(src, unusedImports)
changes // => [{start: 0, end: 38, replacement: "import { yyy } from './src/b.js';"}]
removedImports // => [{from: "./src/b.js", local: "xxx"}]
source // => "import { yyy } from './src/b.js'; class Foo { m() { return yyy + 1 } }"

// or short:
ImportRemover.removeUnusedImports(src)

*/

var ImportRemover = function () {
  function ImportRemover() {
    classCallCheck(this, ImportRemover);
  }

  createClass(ImportRemover, null, [{
    key: "removeImports",
    value: function removeImports(moduleSource, importsToRemove, optModuleAst) {
      // returns {
      //   source: STRING,
      //   modifications: [{start: NUMBER, end: NUMBER, replacement: STRING}]
      //   removedImports: [{local: STRING, from: STRING}]
      // }

      var parsed = optModuleAst || lively_ast.fuzzyParse(moduleSource);

      // 1.get imports with specifiers
      var imports = lively_lang.arr.flatmap(parsed.body, function (ea) {
        if (ea.type !== "ImportDeclaration" || !ea.specifiers.length) return [];
        return ea.specifiers.map(function (spec) {
          return { local: spec.local, importStmt: ea };
        });
      });

      // 3. figure out what imports need to be removed or changed
      var importsToChange = imports.filter(function (ea) {
        return importsToRemove.some(function (rem) {
          return rem.local === ea.local.name;
        });
      }),
          removedImports = importsToChange.map(function (ea) {
        return { local: ea.local.name, from: ea.importStmt.source.value };
      }),
          affectedStmts = lively_lang.arr.uniq(importsToChange.map(function (ea) {
        var specToRemove = ea.importStmt.specifiers.find(function (spec) {
          return ea.local === spec.local;
        });
        lively_lang.arr.remove(ea.importStmt.specifiers, specToRemove);
        return ea.importStmt;
      }));

      // 4. Compute the actual modifications to transform source and also new source itself
      var modifications = affectedStmts.slice().reverse().reduce(function (state, importStmt) {
        var source = state.source,
            changes = state.changes,
            start = importStmt.start,
            end = importStmt.end,
            specifiers = importStmt.specifiers,
            pre = source.slice(0, start),
            post = source.slice(end),
            removed = source.slice(start, end),
            replacement = !specifiers.length ? "" : lively_ast.stringify(importStmt);


        if (replacement && replacement.includes("\n") && !removed.includes("\n")) replacement = replacement.replace(/\s+/g, " ");

        source = pre + replacement + post;
        changes = changes.concat({ replacement: replacement, start: start, end: end });
        return { source: source, changes: changes };
      }, { source: moduleSource, changes: [] });

      return _extends({}, modifications, { removedImports: removedImports });
    }
  }, {
    key: "findUnusedImports",
    value: function findUnusedImports(moduleSourceOrAst) {
      // get all var references of source without those included in the import
      // statments

      // 1.get imports with specifiers
      var parsed = typeof moduleSourceOrAst === "string" ? lively_ast.fuzzyParse(moduleSourceOrAst) : moduleSourceOrAst;

      var imports = lively_lang.arr.flatmap(parsed.body, function (ea) {
        if (ea.type !== "ImportDeclaration" || !ea.specifiers.length) return [];
        return ea.specifiers.map(function (spec) {
          return { local: spec.local, from: ea.source ? ea.source.value : "", importStmt: ea };
        });
      }),
          importIdentifiers = imports.map(function (ea) {
        return ea.local;
      });

      var scope = lively_ast.query.resolveReferences(lively_ast.query.scopes(parsed)),
          refsWithoutImports = Array.from(scope.resolvedRefMap.keys()).filter(function (ea) {
        return !importIdentifiers.includes(ea);
      }),
          realRefs = lively_lang.arr.uniq(refsWithoutImports.map(function (ea) {
        return ea.name;
      }));

      return imports.filter(function (ea) {
        return !realRefs.includes(ea.local.name);
      }).map(function (ea) {
        return _extends({}, ea, { local: ea.local.name });
      });
    }
  }, {
    key: "removeUnusedImports",
    value: function removeUnusedImports(moduleSource) {
      var parsed = lively_ast.fuzzyParse(moduleSource);
      return this.removeImports(moduleSource, this.findUnusedImports(parsed), parsed);
    }
  }]);
  return ImportRemover;
}();

var detectModuleFormat = function () {
  var esmFormatCommentRegExp = /['"]format (esm|es6)['"];/,
      cjsFormatCommentRegExp = /['"]format cjs['"];/,

  // Stolen from SystemJS
  esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

  return function (source, metadata) {
    if (metadata && metadata.format) {
      if (metadata.format == 'es6') metadata.format == 'esm';
      return metadata.format;
    }

    if (esmFormatCommentRegExp.test(source.slice(0, 5000)) || !cjsFormatCommentRegExp.test(source.slice(0, 5000)) && esmRegEx.test(source)) return "esm";

    return "global";
  };
}();

function module$2(System, moduleName, parent) {
  var sysEnv = livelySystemEnv(System),
      id = System.decanonicalize(moduleName, parent);
  return sysEnv.loadedModules[id] || (sysEnv.loadedModules[id] = new ModuleInterface(System, id));
}

// ModuleInterface is primarily used to provide an API that integrates the System
// loader state with lively.modules extensions.
// It does not hold any mutable state.

var ModuleInterface = function () {
  function ModuleInterface(System, id) {
    var _this = this;

    classCallCheck(this, ModuleInterface);

    // We assume module ids to be a URL with a scheme

    if (!isURL(id) && !/^@/.test(id)) throw new Error("ModuleInterface constructor called with " + id + " that does not seem to be a fully normalized module id.");
    this.System = System;
    this.id = id;

    // Under what variable name the recorder becomes available during module
    // execution and eval
    this.recorderName = "__lvVarRecorder";
    this.sourceAccessorName = "__lvOriginalCode";
    this._recorder = null;

    // cached values
    this._source = null;
    this._ast = null;
    this._scope = null;
    this._observersOfTopLevelState = [];

    this._evaluationsInProgress = 0;
    this._evalId = 1;

    lively_notifications.subscribe("lively.modules/modulechanged", function (data) {
      if (data.module === _this.id) _this.reset();
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // properties
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // returns Promise<string>


  createClass(ModuleInterface, [{
    key: "fullName",
    value: function fullName() {
      return this.id;
    }
  }, {
    key: "shortName",
    value: function shortName() {
      return this.package().name + "/" + this.pathInPackage();
    }
  }, {
    key: "source",
    value: function source() {
      var _this2 = this;

      // returns Promise<string>

      // rk 2016-06-24:
      // We should consider using lively.resource here. Unfortunately
      // System.fetch (at least with the current systemjs release) will not work in
      // all cases b/c modules once loaded by the loaded get cached and System.fetch
      // returns "" in those cases
      //
      // cs 2016-08-06:
      // Changed implementation, so it uses System.resource to be consistent
      // with module loading

      if (this.id === "@empty") return Promise.resolve("");

      if (this._source) return Promise.resolve(this._source);

      return this.System.resource(this.id).read().then(function (source) {
        return _this2._source = source;
      });
    }
  }, {
    key: "setSource",
    value: function setSource(source) {
      if (this._source === source) return;
      this.reset();
      this._source = source;
    }
  }, {
    key: "ast",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!this._ast) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt("return", this._ast);

              case 2:
                _context.next = 4;
                return this.source();

              case 4:
                _context.t0 = _context.sent;
                return _context.abrupt("return", this._ast = lively_ast.parse(_context.t0));

              case 6:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ast() {
        return _ref.apply(this, arguments);
      }

      return ast;
    }()
  }, {
    key: "scope",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var ast;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (!this._scope) {
                  _context2.next = 2;
                  break;
                }

                return _context2.abrupt("return", this._scope);

              case 2:
                _context2.next = 4;
                return this.ast();

              case 4:
                ast = _context2.sent;
                return _context2.abrupt("return", this._scope = lively_ast.query.topLevelDeclsAndRefs(ast).scope);

              case 6:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function scope() {
        return _ref2.apply(this, arguments);
      }

      return scope;
    }()
  }, {
    key: "resolvedScope",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.t0 = lively_ast.query;
                _context3.next = 3;
                return this.scope();

              case 3:
                _context3.t1 = _context3.sent;
                return _context3.abrupt("return", this._scope = _context3.t0.resolveReferences.call(_context3.t0, _context3.t1));

              case 5:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function resolvedScope() {
        return _ref3.apply(this, arguments);
      }

      return resolvedScope;
    }()
  }, {
    key: "metadata",
    value: function metadata() {
      var load = this.System.loads ? this.System.loads[this.id] : null;
      return load ? load.metadata : null;
    }
  }, {
    key: "format",
    value: function format() {
      // assume esm by default
      var meta = this.metadata();
      if (meta && meta.format) return meta.format;
      if (this._source) return detectModuleFormat(this._source);
      return "global";
    }
  }, {
    key: "setFormat",
    value: function setFormat(f) {
      // assume esm by default
      var meta = this.metadata();
      if (!meta) throw new Error("No meta data");
      return meta.format = f;
    }
  }, {
    key: "reset",
    value: function reset() {
      this._source = null;
      this._ast = null;
      this._scope = null;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // loading
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "load",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        var m;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                m = this.System.get(this.id);

                if (m) {
                  _context4.next = 6;
                  break;
                }

                _context4.next = 4;
                return this.System.import(this.id);

              case 4:
                m = _context4.sent;

                lively_notifications.emit("lively.modules/moduleloaded", { module: this.id }, Date.now(), this.System);

              case 6:
                return _context4.abrupt("return", m);

              case 7:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function load() {
        return _ref4.apply(this, arguments);
      }

      return load;
    }()
  }, {
    key: "isLoaded",
    value: function isLoaded() {
      return !!this.System.get(this.id);
    }
  }, {
    key: "unloadEnv",
    value: function unloadEnv() {
      this._recorder = null;
      this._observersOfTopLevelState = [];
      // FIXME this shouldn't be necessary anymore....
      delete livelySystemEnv(this.System).loadedModules[this.id];
    }
  }, {
    key: "unloadDeps",
    value: function unloadDeps(opts) {
      var _this3 = this;

      opts = lively_lang.obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
      this.dependents().forEach(function (ea) {
        _this3.System.delete(ea.id);
        if (_this3.System.loads) delete _this3.System.loads[ea.id];
        if (opts.forgetEnv) ea.unloadEnv();
      });
    }
  }, {
    key: "unload",
    value: function unload(opts) {
      opts = lively_lang.obj.merge({ reset: true, forgetDeps: true, forgetEnv: true }, opts);
      if (opts.reset) this.reset();
      if (opts.forgetDeps) this.unloadDeps(opts);
      this.System.delete(this.id);
      if (this.System.loads) {
        delete this.System.loads[this.id];
      }
      if (this.System.meta) delete this.System.meta[this.id];
      if (opts.forgetEnv) this.unloadEnv();
      lively_notifications.emit("lively.modules/moduleunloaded", { module: this.id }, Date.now(), this.System);
    }
  }, {
    key: "reload",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(opts) {
        var _this4 = this;

        var toBeReloaded;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                opts = lively_lang.obj.merge({ reloadDeps: true, resetEnv: true }, opts);
                toBeReloaded = [this];

                if (opts.reloadDeps) toBeReloaded = this.dependents().concat(toBeReloaded);
                this.unload({ forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv });
                _context5.next = 6;
                return Promise.all(toBeReloaded.map(function (ea) {
                  return ea.id !== _this4.id && ea.load();
                }));

              case 6:
                _context5.next = 8;
                return this.load();

              case 8:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function reload(_x) {
        return _ref5.apply(this, arguments);
      }

      return reload;
    }()
  }, {
    key: "whenLoaded",
    value: function whenLoaded(cb) {
      if (this.isLoaded()) {
        try {
          cb(this);
        } catch (e) {
          console.error(e);
        }
        return;
      }
      livelySystemEnv(this.System).onLoadCallbacks.push({ moduleName: this.id, resolved: true, callback: cb });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // change
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "changeSourceAction",
    value: function changeSourceAction(changeFunc) {
      var _this5 = this;

      return Promise.resolve(this.source()).then(function (oldSource) {
        return changeFunc(oldSource);
      }).then(function (newSource) {
        return _this5.changeSource(newSource);
      });
    }
  }, {
    key: "changeSource",
    value: function changeSource(newSource, options) {
      options = _extends({ doSave: true, doEval: true }, options);
      var System = this.System,
          id = this.id,
          format = this.format(),
          result;

      this.reset();
      return Promise.all([options.doSave && this.System.resource(id).write(newSource), options.doEval && moduleSourceChange$1(System, id, newSource, format, options).then(function (_result) {
        return result = _result;
      })]).then(function () {
        return result;
      });
    }
  }, {
    key: "addDependencyToModuleRecord",
    value: function addDependencyToModuleRecord(dependency) {
      var _this6 = this;

      var setter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};

      // `dependency is another module, setter is the function that gets
      // triggered when a dependency's binding changes so that "this" module is updated
      var record = this.record(),
          dependencyRecord = dependency.record();

      if (record && dependencyRecord) {
        // 1. update the record so that when its dependencies change and cause a
        // re-execute, the correct code (new version) is run
        var depIndex,
            hasDepenency = record.dependencies.some(function (ea, i) {
          if (!ea) return;depIndex = i;return ea && ea.name === dependency.id;
        });
        if (!hasDepenency) {
          record.dependencies.push(dependencyRecord);
        } else if (dependencyRecord !== record.dependencies[depIndex] /*happens when a dep is reloaded*/) record.dependencies.splice(depIndex, 1, dependencyRecord);

        // setters are for updating module bindings, the position of the record
        // in dependencies should be the same as the position of the setter for that
        // dependency...
        if (!hasDepenency || !record.setters[depIndex]) record.setters[hasDepenency ? depIndex : record.dependencies.length - 1] = setter;

        // 2. update records of dependencies, so that they know about this module as an importer
        var impIndex,
            hasImporter = dependencyRecord.importers.some(function (imp, i) {
          if (!imp) return;impIndex = i;return imp && imp.name === _this6.id;
        });
        if (!hasImporter) dependencyRecord.importers.push(record);else if (record !== dependencyRecord.importers[impIndex]) dependencyRecord.importers.splice(impIndex, 1, record);
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // dependencies
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "dependents",
    value: function dependents() {
      var _this7 = this;

      // which modules (module ids) are (in)directly import module with id
      // Let's say you have
      // module1: export var x = 23;
      // module2: import {x} from "module1.js"; export var y = x + 1;
      // module3: import {y} from "module2.js"; export var z = y + 1;
      // `dependents` gives you an answer what modules are "stale" when you
      // change module1 = module2 + module3
      return lively_lang.graph.hull(lively_lang.graph.invert(computeRequireMap(this.System)), this.id).map(function (mid) {
        return module$2(_this7.System, mid);
      });
    }
  }, {
    key: "requirements",
    value: function requirements() {
      var _this8 = this;

      // which modules (module ids) are (in)directly required by module with id
      // Let's say you have
      // module1: export var x = 23;
      // module2: import {x} from "module1.js"; export var y = x + 1;
      // module3: import {y} from "module2.js"; export var z = y + 1;
      // `module("./module3").requirements()` will report ./module2 and ./module1
      return lively_lang.graph.hull(computeRequireMap(this.System), this.id).map(function (mid) {
        return module$2(_this8.System, mid);
      });
    }
  }, {
    key: "directRequirements",
    value: function directRequirements() {
      var _this9 = this;

      var dependencies = (this.record() || {}).dependencies || [];
      return lively_lang.arr.pluck(dependencies.filter(Boolean), "name").map(function (id) {
        return module$2(_this9.System, id);
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // module environment
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // What variables to not transform during execution, i.e. what variables
    // should not be accessed as properties of recorder

  }, {
    key: "define",
    value: function define(varName, value) {
      var exportImmediately = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      var meta = arguments[3];

      // attaching source info to runtime objects

      var System = this.System,
          id = this.id,
          recorder = this.recorder;

      // System.debug && console.log(`[lively.modules] ${this.shortName()} defines ${varName}`);

      var metaSym = Symbol.for("lively-object-meta"),
          moduleSym = Symbol.for("lively-module-meta");

      if (typeof value === "function" && meta && (meta.kind === "function" || meta.kind === "class")) {
        value[metaSym] = meta;
      }

      if (value && value[metaSym] && !value[moduleSym]) {
        var pathInPackage = this.pathInPackage(),
            p = this.package();
        value[moduleSym] = {
          package: p ? { name: p.name, version: p.version } : {},
          pathInPackage: pathInPackage
        };
      }

      // storing local module state
      recorder[varName] = value;

      // exports update
      scheduleModuleExportsChange(System, id, varName, value, false /*force adding export*/);

      // system event
      this.notifyTopLevelObservers(varName);

      // immediately update exports (recursivly) when flagged or when the module
      // is not currently executing. During module execution we wait until the
      // entire module is done to avoid triggering the expensive update process
      // multiple times
      // ...whether or not this is in accordance with an upcoming es6 module spec
      // I don't know...
      exportImmediately = exportImmediately || !this.isEvalutionInProgress();
      if (exportImmediately) runScheduledExportChanges(System, id);

      return value;
    }
  }, {
    key: "undefine",
    value: function undefine(varName) {
      delete this.recorder[varName];
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // observing top level state
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "subscribeToToplevelDefinitionChanges",
    value: function subscribeToToplevelDefinitionChanges(func) {
      this._observersOfTopLevelState.push(func);
      return func;
    }
  }, {
    key: "notifyTopLevelObservers",
    value: function notifyTopLevelObservers(key) {
      var ignored = ["createOrExtendES6ClassForLively", "lively.capturing-declaration-wrapper"],
          rec = this.recorder;
      if (lively_lang.arr.include(ignored, key)) return;
      this._observersOfTopLevelState.forEach(function (fn) {
        return fn(key, rec[key]);
      });
    }
  }, {
    key: "unsubscribeFromToplevelDefinitionChanges",
    value: function unsubscribeFromToplevelDefinitionChanges(funcOrName) {
      this._observersOfTopLevelState = typeof funcOrName === "string" ? this._observersOfTopLevelState.filter(function (ea) {
        return ea.name !== funcOrName;
      }) : this._observersOfTopLevelState.filter(function (ea) {
        return ea !== funcOrName;
      });
    }

    // evaluationStart/End are also compiled into instrumented module code so are
    // also activated during module executions

  }, {
    key: "evaluationStart",
    value: function evaluationStart() {
      this._evaluationsInProgress++;
    }
  }, {
    key: "evaluationEnd",
    value: function evaluationEnd() {
      this._evaluationsInProgress--;
      runScheduledExportChanges(this.System, this.id);
    }
  }, {
    key: "nextEvalId",
    value: function nextEvalId() {
      return this._evalId++;
    }
  }, {
    key: "isEvalutionInProgress",
    value: function isEvalutionInProgress() {
      return this._evaluationsInProgress > 0;
    }
  }, {
    key: "env",
    value: function env() {
      return this;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // package related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "package",
    value: function _package() {
      return Package.forModule(this.System, this);
    }
  }, {
    key: "pathInPackage",
    value: function pathInPackage() {
      var p = this.package();
      return p && this.id.indexOf(p.address) === 0 ? this.id.slice(p.address.length).replace(/^\//, "") : this.id;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // imports and exports
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "imports",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.t0 = lively_ast.query;
                _context6.next = 3;
                return this.scope();

              case 3:
                _context6.t1 = _context6.sent;
                return _context6.abrupt("return", _context6.t0.imports.call(_context6.t0, _context6.t1));

              case 5:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function imports() {
        return _ref6.apply(this, arguments);
      }

      return imports;
    }()
  }, {
    key: "exports",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.t0 = lively_ast.query;
                _context7.next = 3;
                return this.scope();

              case 3:
                _context7.t1 = _context7.sent;
                return _context7.abrupt("return", _context7.t0.exports.call(_context7.t0, _context7.t1));

              case 5:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function exports() {
        return _ref7.apply(this, arguments);
      }

      return exports;
    }()
  }, {
    key: "addImports",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(specs) {
        var source, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, spec, fromModule, fromPackage, importData, alias, _ImportInjector$run, standAloneImport;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this.source();

              case 2:
                source = _context8.sent;
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context8.prev = 6;


                for (_iterator = specs[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                  spec = _step.value;
                  fromModule = module$2(this.System, spec.from || spec.moduleId), fromPackage = fromModule.package(), importData = {
                    exported: spec.exported || spec.local,
                    moduleId: fromModule.id,
                    packageName: fromPackage.name,
                    packageURL: fromPackage.url,
                    pathInPackage: fromModule.pathInPackage()
                  }, alias = spec.local, _ImportInjector$run = ImportInjector.run(this.System, this.id, this.package(), source, importData, alias), source = _ImportInjector$run.newSource, standAloneImport = _ImportInjector$run.standAloneImport;
                }

                _context8.next = 14;
                break;

              case 10:
                _context8.prev = 10;
                _context8.t0 = _context8["catch"](6);
                _didIteratorError = true;
                _iteratorError = _context8.t0;

              case 14:
                _context8.prev = 14;
                _context8.prev = 15;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 17:
                _context8.prev = 17;

                if (!_didIteratorError) {
                  _context8.next = 20;
                  break;
                }

                throw _iteratorError;

              case 20:
                return _context8.finish(17);

              case 21:
                return _context8.finish(14);

              case 22:
                _context8.next = 24;
                return this.changeSource(source);

              case 24:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this, [[6, 10, 14, 22], [15,, 17, 21]]);
      }));

      function addImports(_x4) {
        return _ref8.apply(this, arguments);
      }

      return addImports;
    }()
  }, {
    key: "removeImports",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(specs) {
        var _this10 = this;

        var source, _ref10, removedImports;

        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (specs.length) {
                  _context9.next = 2;
                  break;
                }

                return _context9.abrupt("return");

              case 2:
                _context9.next = 4;
                return this.source();

              case 4:
                source = _context9.sent;
                _context9.next = 7;
                return ImportRemover.removeImports(source, specs);

              case 7:
                _ref10 = _context9.sent;
                source = _ref10.source;
                removedImports = _ref10.removedImports;
                _context9.next = 12;
                return this.changeSource(source);

              case 12:
                removedImports.forEach(function (ea) {
                  return delete _this10.recorder[ea.local];
                });

              case 13:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function removeImports(_x5) {
        return _ref9.apply(this, arguments);
      }

      return removeImports;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // bindings
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "_localDeclForRefAt",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(pos) {
        var scope, ref;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _context10.next = 2;
                return this.resolvedScope();

              case 2:
                scope = _context10.sent;
                ref = lively_ast.query.refWithDeclAt(pos, scope);
                return _context10.abrupt("return", ref && { decl: ref.decl, id: ref.declId, declModule: this });

              case 5:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function _localDeclForRefAt(_x6) {
        return _ref11.apply(this, arguments);
      }

      return _localDeclForRefAt;
    }()
  }, {
    key: "_importForNSRefAt",
    value: function () {
      var _ref12 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(pos) {
        var scope, ast, nodes$$1, id, member, _ref13, decl, name, spec;

        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                _context11.next = 2;
                return this.resolvedScope();

              case 2:
                scope = _context11.sent;
                ast = scope.node;
                nodes$$1 = lively_ast.query.nodesAtIndex(ast, pos);

                if (!(nodes$$1.length < 2)) {
                  _context11.next = 7;
                  break;
                }

                return _context11.abrupt("return", [null, null]);

              case 7:
                id = nodes$$1[nodes$$1.length - 1], member = nodes$$1[nodes$$1.length - 2];

                if (!(id.type != "Identifier" || member.type != "MemberExpression" || member.computed || member.object.type !== "Identifier")) {
                  _context11.next = 10;
                  break;
                }

                return _context11.abrupt("return", [null, null]);

              case 10:
                _ref13 = scope.resolvedRefMap.get(member.object) || {}, decl = _ref13.decl;

                if (!(!decl || decl.type !== "ImportDeclaration")) {
                  _context11.next = 13;
                  break;
                }

                return _context11.abrupt("return", [null, null]);

              case 13:
                name = member.object.name, spec = decl.specifiers.find(function (s) {
                  return s.local.name === name;
                });
                return _context11.abrupt("return", spec.type !== "ImportNamespaceSpecifier" ? [null, null] : [decl, spec.local, id.name]);

              case 15:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function _importForNSRefAt(_x7) {
        return _ref12.apply(this, arguments);
      }

      return _importForNSRefAt;
    }()
  }, {
    key: "_resolveImportedDecl",
    value: function () {
      var _ref14 = asyncToGenerator(regeneratorRuntime.mark(function _callee12(decl) {
        var _decl$id, start, name, type, imports, im, imM;

        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                if (decl) {
                  _context12.next = 2;
                  break;
                }

                return _context12.abrupt("return", []);

              case 2:
                _decl$id = decl.id;
                start = _decl$id.start;
                name = _decl$id.name;
                type = _decl$id.type;
                _context12.next = 8;
                return this.imports();

              case 8:
                imports = _context12.sent;
                im = imports.find(function (i) {
                  return i.node.start == start && // can't rely on
                  i.node.name == name && // object identity
                  i.node.type == type;
                });

                if (!im) {
                  _context12.next = 17;
                  break;
                }

                imM = module$2(this.System, im.fromModule, this.id);
                _context12.t0 = [decl];
                _context12.next = 15;
                return imM.bindingPathForExport(im.imported);

              case 15:
                _context12.t1 = _context12.sent;
                return _context12.abrupt("return", _context12.t0.concat.call(_context12.t0, _context12.t1));

              case 17:
                return _context12.abrupt("return", [decl]);

              case 18:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function _resolveImportedDecl(_x8) {
        return _ref14.apply(this, arguments);
      }

      return _resolveImportedDecl;
    }()
  }, {
    key: "bindingPathForExport",
    value: function () {
      var _ref15 = asyncToGenerator(regeneratorRuntime.mark(function _callee13(name) {
        var exports, ex, imM, decl;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.next = 2;
                return this.resolvedScope();

              case 2:
                _context13.next = 4;
                return this.exports();

              case 4:
                exports = _context13.sent;
                ex = exports.find(function (e) {
                  return e.exported === name;
                });

                if (!ex.fromModule) {
                  _context13.next = 17;
                  break;
                }

                imM = module$2(this.System, ex.fromModule, this.id);
                decl = { decl: ex.node, id: ex.declId };

                decl.declModule = this;
                _context13.t0 = [decl];
                _context13.next = 13;
                return imM.bindingPathForExport(ex.imported);

              case 13:
                _context13.t1 = _context13.sent;
                return _context13.abrupt("return", _context13.t0.concat.call(_context13.t0, _context13.t1));

              case 17:
                return _context13.abrupt("return", this._resolveImportedDecl({
                  decl: ex.decl,
                  id: ex.declId,
                  declModule: ex && ex.decl ? this : null
                }));

              case 18:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function bindingPathForExport(_x9) {
        return _ref15.apply(this, arguments);
      }

      return bindingPathForExport;
    }()
  }, {
    key: "bindingPathForRefAt",
    value: function () {
      var _ref16 = asyncToGenerator(regeneratorRuntime.mark(function _callee14(pos) {
        var decl, _ref17, _ref18, imDecl, id, name, imM;

        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return this._localDeclForRefAt(pos);

              case 2:
                decl = _context14.sent;

                if (!decl) {
                  _context14.next = 7;
                  break;
                }

                _context14.next = 6;
                return this._resolveImportedDecl(decl);

              case 6:
                return _context14.abrupt("return", _context14.sent);

              case 7:
                _context14.next = 9;
                return this._importForNSRefAt(pos);

              case 9:
                _ref17 = _context14.sent;
                _ref18 = slicedToArray(_ref17, 3);
                imDecl = _ref18[0];
                id = _ref18[1];
                name = _ref18[2];

                if (imDecl) {
                  _context14.next = 16;
                  break;
                }

                return _context14.abrupt("return", []);

              case 16:
                imM = module$2(this.System, imDecl.source.value, this.id);
                _context14.t0 = [{ decl: imDecl, declModule: this, id: id }];
                _context14.next = 20;
                return imM.bindingPathForExport(name);

              case 20:
                _context14.t1 = _context14.sent;
                return _context14.abrupt("return", _context14.t0.concat.call(_context14.t0, _context14.t1));

              case 22:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function bindingPathForRefAt(_x10) {
        return _ref16.apply(this, arguments);
      }

      return bindingPathForRefAt;
    }()
  }, {
    key: "definitionForRefAt",
    value: function () {
      var _ref19 = asyncToGenerator(regeneratorRuntime.mark(function _callee15(pos) {
        var path;
        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                _context15.next = 2;
                return this.bindingPathForRefAt(pos);

              case 2:
                path = _context15.sent;
                return _context15.abrupt("return", path.length < 1 ? null : path[path.length - 1].decl);

              case 4:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function definitionForRefAt(_x11) {
        return _ref19.apply(this, arguments);
      }

      return definitionForRefAt;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // module records
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "ensureRecord",
    value: function ensureRecord() {
      var S = this.System,
          records = S._loader.moduleRecords;
      if (records[this.id]) return records[this.id];

      // see SystemJS getOrCreateModuleRecord
      return records[this.id] = {
        name: this.id,
        exports: S.newModule({}),
        dependencies: [],
        importers: [],
        setters: []
      };
    }
  }, {
    key: "record",
    value: function record() {
      var rec = this.System._loader.moduleRecords[this.id];
      if (!rec) return null;
      if (!rec.hasOwnProperty("__lively_modules__")) rec.__lively_modules__ = { evalOnlyExport: {} };
      return rec;
    }
  }, {
    key: "updateRecord",
    value: function updateRecord(doFunc) {
      var record = this.record();
      if (!record) throw new Error("es6 environment global of " + this.id + ": module not loaded, cannot get export object!");
      record.locked = true;
      try {
        return doFunc(record);
      } finally {
        record.locked = false;
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // search
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "search",
    value: function () {
      var _ref20 = asyncToGenerator(regeneratorRuntime.mark(function _callee16(searchStr, options) {
        var _this11 = this;

        var src, re, flags, match, res, i, j, line, lineStart, _res$j, idx, length, lineEnd, p;

        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                options = _extends({ excludedModules: [] }, options);

                if (!options.excludedModules.some(function (ex) {
                  if (typeof ex === "string") return ex === _this11.id;
                  if (ex instanceof RegExp) return ex.test(_this11.id);
                  if (typeof ex === "function") return ex(_this11.id);
                  return false;
                })) {
                  _context16.next = 3;
                  break;
                }

                return _context16.abrupt("return", []);

              case 3:
                _context16.next = 5;
                return this.source();

              case 5:
                src = _context16.sent;
                re = void 0;

                if (searchStr instanceof RegExp) {
                  flags = 'g'; // add 'g' flag

                  if (searchStr.ignoreCase) flags += 'i';
                  if (searchStr.multiline) flags += 'm';
                  re = RegExp(searchStr.source, flags);
                } else {
                  re = RegExp(searchStr, 'g');
                }

                match = void 0, res = [];

                while ((match = re.exec(src)) !== null) {
                  res.push([match.index, match[0].length]);
                }i = 0, j = 0, line = 1, lineStart = 0;

              case 11:
                if (!(i < src.length && j < res.length)) {
                  _context16.next = 24;
                  break;
                }

                if (src[i] == '\n') {
                  line++;
                  lineStart = i + 1;
                }
                _res$j = slicedToArray(res[j], 2), idx = _res$j[0], length = _res$j[1];

                if (!(i !== idx)) {
                  _context16.next = 16;
                  break;
                }

                return _context16.abrupt("continue", 21);

              case 16:
                lineEnd = src.slice(lineStart).indexOf("\n");

                if (lineEnd === -1) lineEnd = src.length;else lineEnd += lineStart;
                p = this.package();

                res[j] = {
                  moduleId: this.id,
                  packageName: p.name,
                  pathInPackage: this.pathInPackage(),
                  isLoaded: this.isLoaded(),
                  length: length,
                  line: line, column: i - lineStart,
                  lineString: src.slice(lineStart, lineEnd)
                };
                j++;

              case 21:
                i++;
                _context16.next = 11;
                break;

              case 24:
                return _context16.abrupt("return", res);

              case 25:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16, this);
      }));

      function search(_x12, _x13) {
        return _ref20.apply(this, arguments);
      }

      return search;
    }()
  }, {
    key: "toString",
    value: function toString() {
      return "module(" + this.id + ")";
    }
  }, {
    key: "dontTransform",
    get: function get() {
      return [this.recorderName, this.sourceAccessorName, "global", "self", "_moduleExport", "_moduleImport", "localStorage", // for Firefox, see fetch
      "prompt", "alert", "fetch" // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
      ].concat(lively_ast.query.knownGlobals);
    }

    // FIXME... better to make this read-only, currently needed for loading
    // global modules, from instrumentation.js

  }, {
    key: "recorder",
    set: function set(v) {
      return this._recorder = v;
    },
    get: function get() {
      var _Object$create;

      if (this._recorder) return this._recorder;

      var S = this.System,
          self = this;

      return this._recorder = Object.create(S.global, (_Object$create = {

        System: { configurable: true, writable: true, value: S },

        __currentLivelyModule: { value: self }

      }, defineProperty(_Object$create, lively_vm.defaultClassToFunctionConverterName, {
        configurable: true, writable: true,
        value: lively_classes.runtime.initializeClass
      }), defineProperty(_Object$create, this.varDefinitionCallbackName, {
        value: function value(name, kind, _value, recorder, meta) {
          meta = meta || {};
          meta.kind = kind;
          return self.define(name, _value, false /*signalChangeImmediately*/, meta);
        }

      }), defineProperty(_Object$create, "_moduleExport", {
        value: function value(name, val) {
          scheduleModuleExportsChange(S, self.id, name, val, true /*add export*/);
        }
      }), defineProperty(_Object$create, "_moduleImport", {
        value: function value(depName, key) {
          var depId = S.decanonicalize(depName, self.id),
              depExports = S.get(depId);

          if (!depExports) {
            console.warn("import of " + key + " failed: " + depName + " (tried as " + self.id + ") is not loaded!");
            return undefined;
          }

          self.addDependencyToModuleRecord(module$2(S, depId),
          // setter is only installed if there isn't a setter already. In
          // those cases we make sure that at least the module varRecorder gets
          // updated, which is good enough for "virtual modules"
          function (imports) {
            return Object.assign(self.recorder, imports);
          });

          if (key == undefined) return depExports;

          if (!depExports.hasOwnProperty(key)) console.warn("import from " + depExports + ": Has no export " + key + "!");

          return depExports[key];
        }
      }), _Object$create));
    }
  }, {
    key: "varDefinitionCallbackName",
    get: function get() {
      return "defVar_" + this.id;
    }
  }]);
  return ModuleInterface;
}();

// update pre-bootstrap modules
/*

var mods = System.get("@lively-env").loadedModules;
Object.keys(mods).forEach(id => {
  if (mods[id].constructor === ModuleInterface) return;
  mods[id] = Object.assign(new ModuleInterface(mods[id].System, mods[id].id), mods[id]);
});

*/

var fetchResource = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(proceed, load) {
    var System, res, result, error, isWebResource, isCrossDomain;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            System = this, res = System.resource(load.name);

            if (res) {
              _context.next = 3;
              break;
            }

            return _context.abrupt("return", proceed(load));

          case 3:
            _context.prev = 3;
            _context.next = 6;
            return res.read();

          case 6:
            result = _context.sent;
            _context.next = 12;
            break;

          case 9:
            _context.prev = 9;
            _context.t0 = _context["catch"](3);
            error = _context.t0;

          case 12:
            if (!(error && System.get("@system-env").browser)) {
              _context.next = 24;
              break;
            }

            isWebResource = res.url.startsWith("http"), isCrossDomain = !res.url.startsWith(document.location.origin);

            if (!(isWebResource && isCrossDomain)) {
              _context.next = 24;
              break;
            }

            _context.prev = 15;
            _context.next = 18;
            return res.makeProxied().read();

          case 18:
            result = _context.sent;

            error = null;
            _context.next = 24;
            break;

          case 22:
            _context.prev = 22;
            _context.t1 = _context["catch"](15);

          case 24:
            if (!error) {
              _context.next = 26;
              break;
            }

            throw error;

          case 26:
            return _context.abrupt("return", result);

          case 27:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[3, 9], [15, 22]]);
  }));

  return function fetchResource(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

// FIXME!!!


var livelyURLRe = /^lively:\/\/([^\/]+)\/(.*)$/;
function livelyProtocol(proceed, url) {
  var match = url.match(livelyURLRe);
  if (!match) return proceed(url);

  var _match = slicedToArray(match, 3),
      _ = _match[0],
      worldId = _match[1],
      id = _match[2];

  return {
    read: function read() {
      var m = typeof $world !== "undefined" && $world.getMorphWithId(id);
      return Promise.resolve(m ? m.textString : "/*Could not locate " + id + "*/");
    },
    write: function write(source) {
      var m = typeof $world !== "undefined" && $world.getMorphWithId(id);
      if (!m) return Promise.reject("Could not save morph " + id);
      m.textString = source;
      return Promise.resolve(this);
    }
  };
}

function wrapResource(System) {
  System.resource = lively_resources.resource;
  if (isInstalled(System, "fetch", fetchResource)) remove$1(System, "fetch", "fetchResource");
  install(System, "fetch", fetchResource);
  if (isInstalled(System, "resource", "livelyProtocol")) remove$1(System, "fetch", "livelyProtocol");
  install(System, "resource", livelyProtocol);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var isNode = System.get("@system-env").node;
var initialSystem = initialSystem || System;

var SystemClass = System.constructor;
if (!SystemClass.systems) SystemClass.systems = {};

var defaultOptions = {
  notificationLimit: null
};

// Accessible system-wide via System.get("@lively-env")
function livelySystemEnv(System) {
  return {
    moduleEnv: function moduleEnv(id) {
      return module$2(System, id);
    },


    // TODO this is just a test, won't work in all cases...
    get itself() {
      return System.get(System.decanonicalize("lively.modules/index.js"));
    },

    evaluationStart: function evaluationStart(moduleId) {
      module$2(System, moduleId).evaluationStart();
    },
    evaluationEnd: function evaluationEnd(moduleId) {
      module$2(System, moduleId).evaluationEnd();
    },
    dumpConfig: function dumpConfig() {
      return JSON.stringify({
        baseURL: System.baseURL,
        transpiler: System.transpiler,
        defaultJSExtensions: System.defaultJSExtensions,
        map: System.map,
        meta: System.meta,
        packages: System.packages,
        paths: System.paths,
        packageConfigPaths: System.packageConfigPaths
      }, null, 2);
    },


    // this is where the canonical state of the module system is held...
    packages: System["__lively.modules__packages"] || (System["__lively.modules__packages"] = {}),
    loadedModules: System["__lively.modules__loadedModules"] || (System["__lively.modules__loadedModules"] = {}),
    pendingExportChanges: System["__lively.modules__pendingExportChanges"] || (System["__lively.modules__pendingExportChanges"] = {}),
    notifications: System["__lively.modules__notifications"] || (System["__lively.modules__notifications"] = []),
    notificationSubscribers: System["__lively.modules__notificationSubscribers"] || (System["__lively.modules__notificationSubscribers"] = {}),
    options: System["__lively.modules__options"] || (System["__lively.modules__options"] = lively_lang.obj.deepCopy(defaultOptions)),
    onLoadCallbacks: System["__lively.modules__onLoadCallbacks"] || (System["__lively.modules__onLoadCallbacks"] = [])
  };
}

function systems() {
  return SystemClass.systems;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System creation + access interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function nameOfSystem(System) {
  return Object.keys(systems()).detect(function (name) {
    return systems()[name] === System;
  });
}

function getSystem(nameOrSystem, config) {
  return nameOrSystem && typeof nameOrSystem !== "string" ? nameOrSystem : systems()[nameOrSystem] || (systems()[nameOrSystem] = makeSystem(config));
}

function removeSystem(nameOrSystem) {
  // FIXME "unload" code...???
  var name = nameOrSystem && typeof nameOrSystem !== "string" ? nameOfSystem(nameOrSystem) : nameOrSystem;
  delete systems()[name];
}

function makeSystem(cfg) {
  return prepareSystem(new SystemClass(), cfg);
}

function prepareSystem(System, config) {
  System.trace = true;
  config = config || {};

  var useModuleTranslationCache = config.hasOwnProperty("useModuleTranslationCache") ? config.useModuleTranslationCache : !urlQuery().noModuleCache;
  System.useModuleTranslationCache = useModuleTranslationCache;

  System.set("@lively-env", System.newModule(livelySystemEnv(System)));

  wrapResource(System);
  wrapModuleLoad$1(System);

  if (!isInstalled(System, "normalizeHook")) install(System, "normalize", normalizeHook);

  if (!isInstalled(System, "decanonicalize", "decanonicalizeHook")) install(System, "decanonicalize", decanonicalizeHook);

  if (!isInstalled(System, "newModule", "newModule_volatile")) install(System, "newModule", newModule_volatile);

  if (!isInstalled(System, "instantiate", "instantiate_triggerOnLoadCallbacks")) install(System, "instantiate", instantiate_triggerOnLoadCallbacks);

  if (isNode) {
    var nodejsCoreModules = ["addons", "assert", "buffer", "child_process", "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs", "http", "https", "module", "net", "os", "path", "punycode", "querystring", "readline", "repl", "stream", "stringdecoder", "timers", "tls", "tty", "url", "util", "v8", "vm", "zlib"],
        map = nodejsCoreModules.reduce(function (map, ea) {
      map[ea] = "@node/" + ea;return map;
    }, {});
    config.map = lively_lang.obj.merge(map, config.map);
    // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
    // cfg.paths = obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
  }

  config.packageConfigPaths = config.packageConfigPaths || ['./node_modules/*/package.json'];

  if (!config.transpiler && System.transpiler === "traceur") {

    if (initialSystem.transpiler === "lively.transpiler") {
      System.set("lively.transpiler", initialSystem.get("lively.transpiler"));
      System._loader.transpilerPromise = initialSystem._loader.transpilerPromise;
      System.config({
        transpiler: 'lively.transpiler',
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });
    } else {
      System.config({
        map: {
          'plugin-babel': initialSystem.map["plugin-babel"],
          'systemjs-babel-build': initialSystem.map["systemjs-babel-build"]
        },
        transpiler: initialSystem.transpiler,
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });
    }
  }

  // if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;


  System.config(config);

  return System;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME! proper config!
function urlQuery() {
  if (typeof document === "undefined" || !document.location) return {};
  return (document.location.search || "").replace(/^\?/, "").split("&").reduce(function (query$$1, ea) {
    var split = ea.split("="),
        key = split[0],
        value = split[1];
    if (value === "true" || value === "false") value = eval(value);else if (!isNaN(Number(value))) value = Number(value);
    query$$1[key] = value;
    return query$$1;
  }, {});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// name resolution extensions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
var dotSlashStartRe = /^\.?\//;
var trailingSlashRe = /\/$/;
var jsExtRe = /\.js$/;
var jsonJsExtRe = /\.json\.js$/i;
var doubleSlashRe = /.\/{2,}/g;

function normalizeHook(proceed, name, parent, parentAddress) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  // rk 2016-07-19: sometimes SystemJS doStringMap() will resolve path into
  // names with double slashes which causes module id issues later. This fixes
  // that...
  // name = name.replace(/([^:])\/\/+/g, "$1\/");
  name = name.replace(doubleSlashRe, function (match) {
    return match[0] === ":" ? match : match[0] + "/";
  });

  return proceed(name, parent, parentAddress).then(function (result) {

    // lookup package main
    var base = result.replace(jsExtRe, "");
    if (base in System.packages) {
      var main = System.packages[base].main;
      if (main) return base.replace(trailingSlashRe, "") + "/" + main.replace(dotSlashStartRe, "");
    }

    // Fix issue with accidentally adding .js
    var m = result.match(jsonJsExtRe);
    if (m) return m[1];

    return result;
  });
}

function decanonicalizeHook(proceed, name, parent, isPlugin) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  // systemjs' decanonicalize has by default not the fancy
  // '{node: "events", "~node": "@empty"}' mapping but we need it
  var pkg = parent && normalize_packageOfURL(parent, System);
  if (pkg) {
    var mappedObject = pkg.map && pkg.map[name] || System.map[name];
    if ((typeof mappedObject === "undefined" ? "undefined" : _typeof(mappedObject)) === "object") {
      name = normalize_doMapWithObject(mappedObject, pkg, System) || name;
    }
  }

  var result = proceed(name, parent, isPlugin);

  // lookup package main
  var base = result.replace(jsExtRe, "");
  if (base in System.packages) {
    var main = System.packages[base].main;
    if (main) return base.replace(trailingSlashRe, "") + "/" + main.replace(dotSlashStartRe, "");
  }

  // Fix issue with accidentally adding .js
  var m = result.match(jsonJsExtRe);
  if (m) return m[1];

  return result;
}

function normalize_doMapWithObject(mappedObject, pkg, loader) {
  // SystemJS allows stuff like {events: {"node": "@node/events", "~node": "@empty"}}
  // for conditional name lookups based on the environment. The resolution
  // process in SystemJS is asynchronous, this one here synch. to support
  // decanonicalize and a one-step-load
  var env = loader.get(pkg.map['@env'] || '@system-env');
  // first map condition to match is used
  var resolved;
  for (var e in mappedObject) {
    var negate = e[0] == '~';
    var value = normalize_readMemberExpression(negate ? e.substr(1) : e, env);
    if (!negate && value || negate && !value) {
      resolved = mappedObject[e];
      break;
    }
  }

  if (resolved) {
    if (typeof resolved != 'string') throw new Error('Unable to map a package conditional to a package conditional.');
  }
  return resolved;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function normalize_readMemberExpression(p, value) {
    var pParts = p.split('.');
    while (pParts.length) {
      value = value[pParts.shift()];
    }return value;
  }
}

function normalize_packageOfURL(url, System) {
  // given a url like "http://localhost:9001/lively.lang/lib/base.js" finds the
  // corresponding package name in loader.packages, like "http://localhost:9001/lively.lang"
  // ... actually it returns the package
  var packageNames = Object.keys(System.packages || {}),
      matchingPackages = packageNames.map(function (pkgName) {
    return url.indexOf(pkgName) === 0 ? { url: pkgName, penalty: url.slice(pkgName.length).length } : null;
  }).filter(function (ea) {
    return !!ea;
  }),
      pName = matchingPackages.length ? matchingPackages.reduce(function (matchingPkg, ea) {
    return matchingPkg.penalty > ea.penalty ? ea : matchingPkg;
  }).url : null;
  return pName ? System.packages[pName] : null;
}

function newModule_volatile(proceed, exports) {
  var freeze = Object.freeze;
  Object.freeze = function (x) {
    return x;
  };
  var m = proceed(exports);
  Object.freeze = freeze;
  return m;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// debugging
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function printSystemConfig$1(System) {
  System = getSystem(System);
  var json = {
    baseURL: System.baseURL,
    transpiler: System.transpiler,
    defaultJSExtensions: System.defaultJSExtensions,
    defaultExtension: System.defaultExtension,
    map: System.map,
    meta: System.meta,
    packages: System.packages,
    paths: System.paths,
    packageConfigPaths: System.packageConfigPaths,
    bundles: System.bundles
  };
  return JSON.stringify(json, null, 2);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// on-load / import extensions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function instantiate_triggerOnLoadCallbacks(proceed, load) {
  var System = this;

  return proceed(load).then(function (result) {
    // Wait until module is properly loaded, i.e. added to the System moule cache.
    // Then find those callbacks in System.get("@lively-env").onLoadCallbacks that
    // resolve to the loaded module, trigger + remove them
    lively_lang.promise.waitFor(function () {
      return System.get(load.name);
    }).then(function () {
      var modId = load.name,
          mod = module$2(System, modId),
          callbacks = System.get("@lively-env").onLoadCallbacks;

      for (var i = callbacks.length; i--;) {
        var _callbacks$i = callbacks[i],
            moduleName = _callbacks$i.moduleName,
            resolved = _callbacks$i.resolved,
            callback = _callbacks$i.callback,
            id = resolved ? moduleName : System.decanonicalize(moduleName);

        if (id !== modId) continue;
        callbacks.splice(i, 1);
        try {
          callback(mod);
        } catch (e) {
          console.error(e);
        }
      }
    });

    return result;
  });
}

function whenLoaded$2(System, moduleName, callback) {
  var modId = System.decanonicalize(moduleName);
  if (System.get(modId)) {
    try {
      callback(module$2(System, modId));
    } catch (e) {
      console.error(e);
    }
    return;
  }
  System.get("@lively-env").onLoadCallbacks.push({ moduleName: moduleName, resolved: false, callback: callback });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module state
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function loadedModules$1(System) {
  return System.get("@lively-env").loadedModules;
}

function knownModuleNames(System) {
  var fromSystem = System.loads ? Object.keys(System.loads) : Object.keys(System._loader.moduleRecords);
  return lively_lang.arr.uniq(fromSystem.concat(Object.keys(loadedModules$1(System))));
}

var buildPackageMap = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(dir) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { maxDepth: 0, excludes: [] };
    var map = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var depth = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

    var maxDepth, excludes, config, key, node_modules, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _ref3, url;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // fetches the package.json config of dir and stores version and dependencies
            // into package map. Recursively searches in node_modules either until
            // maxDepth is reached or all packages have been visited. Since the
            // name@version is used for testing if package was seen, can deal with cyclic
            // symlinks.
            // Return value looks like
            //    { 'lively.server@0.1.0': 
            //       { url: 'file:///Users/robert/Lively/lively-dev/lively.server',
            //         name: 'lively.server',
            //         version: '0.1.0',
            //         dependencies: 
            //          { 'lively.modules': '*',
            //            'socket.io': '^1.5.1' },
            //         devDependencies: { 'mocha-es6': '*' },
            //         main: undefined } }

            maxDepth = options.maxDepth, excludes = options.excludes;

            if (!(maxDepth > 0 && depth > maxDepth)) {
              _context.next = 3;
              break;
            }

            return _context.abrupt("return", map);

          case 3:
            _context.prev = 3;
            _context.t0 = JSON;
            _context.next = 7;
            return lively_resources.resource(dir).join("package.json").read();

          case 7:
            _context.t1 = _context.sent;
            config = _context.t0.parse.call(_context.t0, _context.t1);
            key = config.name + "@" + config.version;

            if (!(map[key] || excludes.includes(config.name))) {
              _context.next = 12;
              break;
            }

            return _context.abrupt("return", map);

          case 12:

            map[key] = _extends({
              url: dir
            }, lively_lang.obj.select(config, ["name", "version", "dependencies", "devDependencies", "main"]));

            _context.next = 18;
            break;

          case 15:
            _context.prev = 15;
            _context.t2 = _context["catch"](3);
            return _context.abrupt("return", map);

          case 18:
            _context.prev = 18;
            _context.next = 21;
            return lively_resources.resource(dir).join("node_modules").dirList(1);

          case 21:
            node_modules = _context.sent;
            _context.next = 27;
            break;

          case 24:
            _context.prev = 24;
            _context.t3 = _context["catch"](18);
            return _context.abrupt("return", map);

          case 27:
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 30;
            _iterator = node_modules[Symbol.iterator]();

          case 32:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context.next = 41;
              break;
            }

            _ref3 = _step.value;
            url = _ref3.url;
            _context.next = 37;
            return buildPackageMap(url, options, map, depth + 1);

          case 37:
            map = _context.sent;

          case 38:
            _iteratorNormalCompletion = true;
            _context.next = 32;
            break;

          case 41:
            _context.next = 47;
            break;

          case 43:
            _context.prev = 43;
            _context.t4 = _context["catch"](30);
            _didIteratorError = true;
            _iteratorError = _context.t4;

          case 47:
            _context.prev = 47;
            _context.prev = 48;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 50:
            _context.prev = 50;

            if (!_didIteratorError) {
              _context.next = 53;
              break;
            }

            throw _iteratorError;

          case 53:
            return _context.finish(50);

          case 54:
            return _context.finish(47);

          case 55:
            return _context.abrupt("return", map);

          case 56:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[3, 15], [18, 24], [30, 43, 47, 55], [48,, 50, 54]]);
  }));

  return function buildPackageMap(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

function resolvePackageDependencies(pkg, packageMap) {
  // util.inspect(resolvePackageDependencies(packageMap["socket.io@1.5.1"], packageMap))
  // =>
  // "{ debug: 'debug@2.2.0',
  //   'engine.io': 'engine.io@1.7.2', ...}

  var deps = _extends({}, pkg.dependencies, pkg.devDependencies);
  return Object.keys(deps).reduce(function (depMap, depName) {
    var depVersion = deps[depName],
        _ref4 = lively_lang.obj.values(packageMap).find(function (_ref5) {
      var name = _ref5.name,
          version = _ref5.version;
      return name === depName && lively.modules.semver.satisfies(version, depVersion);
    }) || {},
        name = _ref4.name,
        version = _ref4.version;

    depMap[depName] = name ? name + "@" + version : undefined;
    return depMap;
  }, {});
}

function dependencyGraph(packageMap) {
  // builds dependency graph of package-name@version tuples:
  // {'lively.server@0.1.0':  ['lively.modules@0.5.41', ...],
  //  'lively.modules@0.5.41': [...]}

  var packages = lively_lang.obj.values(packageMap),
      cachedVersionQueries = {};

  return Object.keys(packageMap).reduce(function (depMap, name) {
    var pkg = packageMap[name],
        deps = _extends({}, pkg.dependencies, pkg.devDependencies);
    depMap[name] = Object.keys(deps).map(function (depName) {
      return findAvailablePackage(depName, deps[depName]);
    }).filter(function (ea) {
      return !!ea;
    });
    return depMap;
  }, {});

  function findAvailablePackage(depName, depVersionRange) {
    var cacheKey = depName + "@" + depVersionRange;
    if (cacheKey in cachedVersionQueries) return cachedVersionQueries[cacheKey];

    var _ref6 = packages.find(function (_ref7) {
      var name = _ref7.name,
          version = _ref7.version;
      return name === depName && lively.modules.semver.satisfies(version, depVersionRange);
    }) || {},
        name = _ref6.name,
        version = _ref6.version;

    return cachedVersionQueries[cacheKey] = name ? name + "@" + version : undefined;
  }
}



var dependencies = Object.freeze({
	buildPackageMap: buildPackageMap,
	resolvePackageDependencies: resolvePackageDependencies,
	dependencyGraph: dependencyGraph
});

/*

  ### `lively.modules.importPackage(packageName)`

  To load a project into your runtime you will typically use
  `lively.modules.importPackage('some-package-name')`. `'some-package-name'`
  should resolve to a directory with a JSON package config file (typically
  package.json) that at least defines a `name` field. The package will be
  imported, i.e. the main module of the package will be loaded via
  `lively.modules.System.import('some-package-name/index.js')`. By default the
  name of main is `'index.js'` but this can be customized via the `main` field
  of the package config file.

  The result of the importPackage call is the promise for loading the main module.



  #### Specifics of the lively package format

  The main purpose of the lively package format is to make it easy to integrate
  dependent packages in the lively.module and es6 module systems. It allows you
  to define a `"lively"` field in the main JSON that allows to set a separate
  main module, a `"packageMap"` object that maps names that can be used in
  `import` statements to directories of sub-packages. When sub-packages are
  discovered while importing a package, those are recursively imported as well.

  Here is an example how a config inside a package.json file could look like.

  ```json
  {
    "name": "some-package",
    "main": "main-for-non-es6.js",
    "lively": {
      "main": "for-es6.js",
      "packageMap": {
        "dep1": "./node_modules/dep1",
        "dep2": "./libs/dep2"
      }
    }
  }
  ```

  For more examples, see [lively.modules/package.json](https://github.com/LivelyKernel/lively.modules/package.json), or [lively.ast/package.json](https://github.com/LivelyKernel/lively.ast/package.json).



  ### `lively.modules.System`

  The main lively.modules interface provides access to a System loader object
  (currently from the [SystemJS library](https://github.com/systemjs/systemjs)
  that has some improvements added, e.g.   the name normalization respects the
  lively package conventions, translate is   used to instrument code by
  default, etc.

  By default the loader instance is the same as the global loader (e.g.
  window.System). Note: *The System instance can be easily changed* to support
  multiple, isolated environnments.

  Example:

  ```js
  var testSystem = lively.modules.getSystem("my-test-system");
  lively.modules.changeSystem(testSystem, true); // true: make the System global
  System.import("some-module"); // uses the new System loader
  ```

  Now all state (what modules are loaded, their metadata, etc) are stored in
  `testSystem`. Changing to another System allows to define different name
  resolution approach etc.

  Side note: Since all System related implementation functions defined in the
  modules in src/ will take a System loader object as first parameter, the
  implementation is loader independent.



  ### Loader state / module state

  - `lively.modules.loadedModules()`: Returns a list of ids of the currently loaded modules.

  - lively.modules.printSystemConfig(): Returns a stringified version of the [SystemJS config](https://github.com/systemjs/systemjs/blob/master/docs/config-api.md). Useful for debugging SystemJS issues

  #### `lively.modules.requireMap()`

  Will return a JS object whose keys are module ids and the corresponding
  values are lists of module ids of those modules that dependent on the key
  module (including the key module itself). I.e. the importers of that module.



  ### instrumentation

  By default lively.modules will hook into the `System.translate` process so that source code of modules get transformed to allow recording of their internal evaluation state (that is then captured in `moduleEnv`s). You can enable and disable this behavior via

  - `lively.modules.wrapModuleLoad()`
  - `lively.modules.unwrapModuleLoad()`



  ### evaluation

  * This is handled by the [lively.vm module](https://github.com/LivelyKernel/lively.vm)!



  ### ModuleInterface

  #### `lively.modules.module(moduleId)`

  Returns an instance of ModuleInterface with the following methods:

  ##### `ModuleInterface>>dependents()`

  Which modules (module ids) are (in)directly import module with id.

  Let's say you have

  - module1.js: `export var x = 23;`
  - module2.js: `import {x} from "module1.js"; export var y = x + 1;`
  - module3.js: `import {y} from "module2.js"; export var z = y + 1;`

  `module("module1.js").dependents()` returns [module("module2"), module("module3")]

  ##### `ModuleInterface>>requirements()`

  which modules (module ids) are (in)directly required by module with id?

  Let's say you have

  - module1: `export var x = 23;`
  - module2: `import {x} from "module1.js"; export var y = x + 1;`
  - module3: `import {y} from "module2.js"; export var z = y + 1;`

  `module("module3").requirements()` will report [module("module2"), module("module1")]

  ##### `async ModuleInterface>>changeSource(newSource, options)`

  To redefine a module's source code at runtime you can use the
  changeSource method. Given `a.js` from the previous example you can run
  `module('a.js').changeSource('var x = 24;\nexport x;')`.
  This will a) evaluate the changed code and b) try to modify the actual file
  behind the module. In browser environments this is done via a `PUT` request,
  in node.js `fs.writeFile` is used.

  ##### `async ModuleInterface>>reload(options)``

  Will re-import the module identified by `moduleName`. By default this will
  also reload all direct and indirect dependencies of that module. You can
  control that behavior via `options`, the default value of it is
  `{reloadDeps: true, resetEnv: true}`.

  ##### `ModuleInterface>>unload(options)`

  Will remove the module from the loaded module set of lively.modules.System.
  `options` are by default `{forgetDeps: true, forgetEnv: true}`.

  ##### `async ModuleInterface>>imports()` and `async ModuleInterface>>exports()`

  Import and export state. For exports this includes the local name of the
  exported variable, its export name, etc. For imports it includes the imported
  variable name, the module from where it was imported etc.

  Example:

  ```js
  await module("lively.modules/index.js").exports();
    // =>
    //   [{
    //       exported: "getSystem",
    //       local: "getSystem",
    //       fromModule: "http://localhost:9001/node_modules/lively.modules/index.js",
    //     }, ...]

  await module("lively.modules/index.js").imports();
    //   [{
    //       fromModule: "lively.lang",
    //       local: "obj",
    //       localModule: "http://localhost:9001/node_modules/lively.modules/index.js"
    //     }, {
    //       fromModule: "./src/system.js",
    //       local: "getSystem",
    //       localModule: "http://localhost:9001/node_modules/lively.modules/index.js"
    //     }, ...]
    //   })
  ```


  ##### `async ModuleInterface>>source()`

  Returns the source code of the module.

  ##### `async ModuleInterface>>env()`

  Returns the evaluation environment of the module.

  A "module env" is the object used for recording the evaluation state. Each
  module that is loaded with source instrumentation enabled as an according
  moduleEnv It is populated when the module is imported and then used and
  modified when users run evaluations using `lively.vm.runEval()` or change the module's
  code with `ModuleInterface>>changeSource()`. You can get access to the internal module
  state via `module(...).env().recorder` the recorder is a map of
  variable and function names.

  Example: When lively.modules is bootstrapped you can access the state of its
  main module via:

  ```js
  var id = System.decanonicalize("lively.modules/index.js");
  Object.keys(lively.modules.moduleEnv("lively.modules/index.js").recorder);
    // => ["defaultSystem", "changeSystem", "loadedModules", "sourceOf", "moduleEnv", ...]
  lively.modules.moduleEnv("lively.modules/index.js").recorder.changeSystem
    // => function() {...} The actual object defined in the module scope
  ```



  ### hooks

  lively.modules provides an easy way to customize the behavior of the System
  loader object via `installHook` and `removeHook`. To extend the behavior of
  of `lively.modules.System.fetch` you can for example do

  ```js
  installHook("fetch", function myFetch(proceed, load) {
    if (load.name === "my-custom-module.js") return "my.custom.code()";
    return proceed(load); // default behavior
  });
  ```
  
  ### notification
  
  There are five types of system-wide notifications:
  
  1. `{type: "lively.modules/moduleloaded", module}`
  2. `{type: "lively.modules/modulechanged", module, oldSource, newSource, error, options}`
  3. `{type: "lively.modules/moduleunloaded", module}`
  4. `{type: "lively.modules/packageregistered", package}`
  5. `{type: "lively.modules/packageremoved", package}`

  These notifications are all emitted with `lively.notifications`.

 */

/*global global, self*/
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System accessors
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
var GLOBAL = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : undefined;

exports.System = exports.System || prepareSystem(GLOBAL.System);
function changeSystem(newSystem, makeGlobal) {
  exports.System = newSystem;
  if (makeGlobal) GLOBAL.System = newSystem;
  return newSystem;
}
function loadedModules$$1() {
  return Object.keys(requireMap());
}
function module$1(id) {
  return module$2(exports.System, id);
}
function printSystemConfig$$1() {
  return printSystemConfig$1(exports.System);
}
function whenLoaded$1(moduleName, callback) {
  return whenLoaded$2(exports.System, moduleName, callback);
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function importPackage$$1(packageURL) {
  return importPackage$1(exports.System, packageURL);
}
function registerPackage$$1(packageURL) {
  return registerPackage$1(exports.System, packageURL);
}
function removePackage$$1(packageURL) {
  return removePackage$1(exports.System, packageURL);
}
function reloadPackage$$1(packageURL) {
  return reloadPackage$1(exports.System, packageURL);
}
function getPackages$$1() {
  return getPackages$1(exports.System);
}
function getPackage$$1(packageURL) {
  return getPackage$1(exports.System, packageURL);
}
function applyPackageConfig(packageConfig, packageURL) {
  return applyConfig(exports.System, packageConfig, packageURL);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// changing modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function moduleSourceChange$$1(moduleName, newSource, options) {
  return moduleSourceChange$1(exports.System, moduleName, newSource, options);
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// dependencies
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function requireMap() {
  return computeRequireMap(exports.System);
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// hooks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function isHookInstalled(methodName, hookOrName) {
  return isInstalled(exports.System, methodName, hookOrName);
}
function installHook(hookName, hook) {
  return install(exports.System, hookName, hook);
}
function removeHook(methodName, hookOrName) {
  return remove$1(exports.System, methodName, hookOrName);
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// instrumentation
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function wrapModuleLoad$$1() {
  wrapModuleLoad$1(exports.System);
}
function unwrapModuleLoad$$1() {
  unwrapModuleLoad$1(exports.System);
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// cjs
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

exports.getSystem = getSystem;
exports.removeSystem = removeSystem;
exports.loadedModules = loadedModules$$1;
exports.printSystemConfig = printSystemConfig$$1;
exports.whenLoaded = whenLoaded$1;
exports.changeSystem = changeSystem;
exports.module = module$1;
exports.importPackage = importPackage$$1;
exports.registerPackage = registerPackage$$1;
exports.removePackage = removePackage$$1;
exports.reloadPackage = reloadPackage$$1;
exports.getPackages = getPackages$$1;
exports.getPackage = getPackage$$1;
exports.applyPackageConfig = applyPackageConfig;
exports.moduleSourceChange = moduleSourceChange$$1;
exports.requireMap = requireMap;
exports.isHookInstalled = isHookInstalled;
exports.installHook = installHook;
exports.removeHook = removeHook;
exports.wrapModuleLoad = wrapModuleLoad$$1;
exports.unwrapModuleLoad = unwrapModuleLoad$$1;
exports.cjs = dependencies;
exports.semver = semver;

}((this.lively.modules = this.lively.modules || {}),lively.lang,lively.ast,lively.notifications,lively.vm,lively.resources,lively.classes,semver));

  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.lively.modules;
})();