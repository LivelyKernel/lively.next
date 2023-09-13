import * as arr from 'lively.lang/array.js';
import * as obj from 'lively.lang/object.js';
import Path from 'lively.lang/path.js';

export function superclasses (klass) {
  return withSuperclasses(klass).slice(1);
}

export const initializeSymbol = Symbol.for('lively-instance-initialize');
export const instanceRestorerSymbol = Symbol.for('lively-instance-restorer');
export const superclassSymbol = Symbol.for('lively-instance-superclass');
export const moduleMetaSymbol = Symbol.for('lively-module-meta');
export const objMetaSymbol = Symbol.for('lively-object-meta');
export const moduleSubscribeToToplevelChangesSym = Symbol.for('lively-klass-changes-subscriber');

export function getClassHierarchy (klass) {
  let curr = klass; const hierarchy = [];
  do {
    hierarchy.push(curr);
    curr = curr[superclassSymbol];
  } while (curr && curr.name);
  return hierarchy.map(c => c.name).join('->');
}

export function withSuperclasses (klass) {
  const classes = [];
  while (klass) {
    classes.push(klass);
    klass = klass[superclassSymbol];
  }
  return classes;
}

export function inheritsFrom (klass, maybeSuperclass) {
  do {
    if (klass === maybeSuperclass) return true;
  } while (klass = klass[superclassSymbol]);
  return false;
}

export function changeClass (obj, newClass) {
  if (obj.constructor === newClass &&
   obj.__proto__ === newClass.prototype) return obj;
  obj.constructor = newClass;
  obj.__proto__ = newClass.prototype;
  return obj;
}

export function isClass (klass) {
  return klass && typeof klass === 'function';
}

export function isOverridden (klass, name) {
  while (klass != Object) {
    klass = klass[Symbol.for('lively-instance-superclass')];
    if (klass.prototype.hasOwnProperty(name)) return true;
  }
  return false;
}

export function runtimeClassMembers (klass) {
  return runtimeNonStaticMembers(klass).concat(runtimeNonStaticMembers(klass));
}

function runtimeClassMembersInProtoChain (klass) {
  return arr.uniq(
    arr.without(withSuperclasses(klass), Object)
      .flatMap(ea => runtimeClassMembers(ea))
  );
}

function runtimeNonStaticMembers (klass) {
  const owner = klass.prototype;
  const descriptors = obj.getOwnPropertyDescriptors(owner);
  return arr.withoutAll(
    Object.keys(descriptors),
    ['constructor'])
    .map(key => {
      const descr = descriptors[key];
      const kind = typeof descr.value === 'function'
        ? 'method'
        : 'get' in descr
          ? 'get'
          : 'set' in descr
            ? 'set'
            : 'unknown';
      const value = kind === 'method'
        ? descr.value
        : kind === 'get'
          ? descr.get
          : kind === 'set' ? descr.set : null;
      return { static: false, name: key, value, kind, owner };
    });
}

function runtimeNonstaticClassMembersInProtoChain (klass) {
  return arr.uniq(
    arr.without(withSuperclasses(klass), Object)
      .flatMap(ea => runtimeNonStaticMembers(ea))
  );
}

export function runtimeStaticClassMembers (klass) {
  const owner = klass;
  const descriptors = obj.getOwnPropertyDescriptors(owner);
  return arr.withoutAll(
    Object.keys(descriptors),
    ['prototype', 'name', 'length', 'toString'])
    .map(key => {
      const descr = descriptors[key];
      const kind = typeof descr.value === 'function'
        ? 'method'
        : 'get' in descr
          ? 'get'
          : 'set' in descr
            ? 'set'
            : 'unknown';
      const value = kind === 'method'
        ? descr.value
        : kind === 'get'
          ? descr.get
          : kind === 'set' ? descr.set : null;
      return { static: true, name: key, value, kind, owner };
    });
}

export function runtimeStaticClassMembersInProtoChain (klass) {
  return arr.uniq(
    arr.without(withSuperclasses(klass), Object)
      .flatMap(ea => runtimeStaticClassMembers(ea))
  );
}

/*

class Foo {
  static foooo() {}
  x() { return 23; }
  y() { return 24; }
}

class Bar extends Foo {
  x() { return 22 }
  z() { return 42; }
  get xxxx() { return 42; }
  set xxxx(f) { ; }
}

runtimeClassMembers(Bar)[0]
runtimeClassMembersInProtoChain(Bar)

*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export var toJsIdentifier = (function () {
  const keywords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'static', 'switch', 'super', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield'];

  const illegalChars = {
    '~': '_tilde_',
    '`': '_backtick_',
    '!': '_exclamationmark_',
    '@': '_at_',
    '#': '_pound_',
    '%': '_percent_',
    '^': '_carat_',
    '&': '_amperstand_',
    '*': '_asterisk_',
    '(': '_leftparen_',
    ')': '_rightparen_',
    '+': '_plus_',
    '=': '_equals_',
    '{': '_leftcurly_',
    '}': '_rightcurly_',
    '[': '_leftsquare_',
    ']': '_rightsquare_',
    '|': '_pipe_',
    '-': '_dash_',
    '\\': '_backslash_',
    '"': '_doublequote_',
    "'": '_singlequote_',
    ':': '_colon_',
    ';': '_semicolon_',
    '<': '_leftangle_',
    '>': '_rightangle_',
    ',': '_comma_',
    '.': '_period_',
    '?': '_questionmark_',
    '/': '_forwardslash_',
    '\t': '_tab_',
    '\n': '_newline_',
    '\r': '_carriagereturn_'
  };

  const nums = {
    0: '_zero_',
    1: '_one_',
    2: '_two_',
    3: '_three_',
    4: '_four_',
    5: '_five_',
    6: '_siz_',
    7: '_seven_',
    8: '_eight_',
    9: '_nine_'
  };

  const wrapper = text => text;
  const charWrapper = char => wrapper(illegalChars[char] || 'ASCII_' + (char.charCodeAt(0)));
  const dedashRe = /([\s-]+.)/g;

  function dedash (string) {
    return string.replace(dedashRe, (_, m) => m[m.length - 1].toUpperCase());
  }

  return function toJsIdentifier (text) {
    text = dedash(text);
    if ((keywords.indexOf(text)) >= 0) return wrapper(text);
    if (text.length === 0) return wrapper('_null_');
    return text.replace(/^\d/, n => wrapper(nums[n]))
      .replace(/[^\w\$_]/g, charWrapper);
  };
})();
