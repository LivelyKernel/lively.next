import { arr, Path } from "lively.lang";
import { superclassSymbol } from "./runtime.js";
import { RuntimeSourceDescriptor } from "./source-descriptors.js";

export function superclasses(klass) {
  return withSuperclasses(klass).slice(1)
}

export function withSuperclasses(klass) {
  var classes = [];
  while (klass) {
    classes.push(klass);
    klass = klass[superclassSymbol];
  }
  return classes;
}

export function inheritsFrom(klass, maybeSuperclass) {
  do {
    if (klass === maybeSuperclass) return true;
  } while (klass = klass[superclassSymbol]);
  return false;
}

export function changeClass(obj, newClass) {
  if (obj.constructor === newClass
   && obj.__proto__ === newClass.prototype) return obj;
  obj.constructor = newClass;
  obj.__proto__ = newClass.prototype;
  return obj;
}

export function isClass(klass) {
  return klass && typeof klass === "function";
}

export function lexicalClassMembers(klass) {
  var {ast: parsed, type} = RuntimeSourceDescriptor.for(klass);
  if (type !== "ClassDeclaration")
    throw new Error(`Expected class but got ${type}`);

  var members = Path("body.body").get(parsed);

  return members.map(node => {
    var {static: isStatic, kind, key: {type: keyType, name: id, value: literalId}} = node,
        name = id || literalId,
        base = isStatic ? klass : klass.prototype,
        value = kind === "get" ? base.__lookupGetter__(name) :
                  kind === "set" ? base.__lookupSetter__(name) :
                    base[name];
    return {static: isStatic, name, value, kind, owner: klass}
  });
}


export function runtimeClassMembers(klass) {
  return runtimeNonStaticMembers(klass).concat(runtimeNonStaticMembers(klass));
}

function runtimeClassMembersInProtoChain(klass) {
  return arr.uniq(
          arr.flatmap(
            arr.without(withSuperclasses(klass), Object),
            ea => runtimeClassMembers(ea)));
}

function runtimeNonStaticMembers(klass) {
  var owner = klass.prototype,
      descriptors = Object.getOwnPropertyDescriptors(owner);
  return arr.withoutAll(
    Object.keys(descriptors),
    ["constructor"])
      .map(key => {
        var descr = descriptors[key],
            kind = typeof descr.value === "function" ? "method" :
                    "get" in descr ? "get" : 
                      "set" in descr ? "set" :
                        "unknown",
            value = kind === "method" ? descr.value :
                      kind === "get" ? descr.get :
                        kind === "set" ? descr.set : null
        return {static: false, name: key, value, kind, owner};
      });

}

function runtimeNonstaticClassMembersInProtoChain(klass) {
  return arr.uniq(
          arr.flatmap(
            arr.without(withSuperclasses(klass), Object),
            ea => runtimeNonStaticMembers(ea)));
}

export function runtimeStaticClassMembers(klass) {
  var owner = klass,
      descriptors = Object.getOwnPropertyDescriptors(owner);
  return arr.withoutAll(
    Object.keys(descriptors),
    ["prototype", "name", "length", "toString"])
      .map(key => {
        var descr = descriptors[key],
            kind = typeof descr.value === "function" ? "method" :
                    "get" in descr ? "get" : 
                      "set" in descr ? "set" :
                        "unknown",
            value = kind === "method" ? descr.value :
                      kind === "get" ? descr.get :
                        kind === "set" ? descr.set : null;
        return {static: true, name: key, value, kind, owner};
      });
}

export function runtimeStaticClassMembersInProtoChain(klass) {
  return arr.uniq(
          arr.flatmap(
            arr.without(withSuperclasses(klass), Object),
            ea => runtimeStaticClassMembers(ea)));
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

export var toJsIdentifier = (function() {

  var keywords = ["break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "implements", "import", "in", "instanceof", "interface", "let", "new", "null", "package", "private", "protected", "public", "return", "static", "switch", "super", "this", "throw", "true", "try", "typeof", "undefined", "var", "void", "while", "with", "yield"];

  var illegalChars = {
    "~":  "_tilde_",
    "`":  "_backtick_",
    "!":  "_exclamationmark_",
    "@":  "_at_",
    "#":  "_pound_",
    "%":  "_percent_",
    "^":  "_carat_",
    "&":  "_amperstand_",
    "*":  "_asterisk_",
    "(":  "_leftparen_",
    ")":  "_rightparen_",
    "+":  "_plus_",
    "=":  "_equals_",
    "{":  "_leftcurly_",
    "}":  "_rightcurly_",
    "[":  "_leftsquare_",
    "]":  "_rightsquare_",
    "|":  "_pipe_",
    "-":  "_dash_",
    "\\": "_backslash_",
    "\"": "_doublequote_",
    "'":  "_singlequote_",
    ":":  "_colon_",
    ";":  "_semicolon_",
    "<":  "_leftangle_",
    ">":  "_rightangle_",
    ",":  "_comma_",
    ".":  "_period_",
    "?":  "_questionmark_",
    "/":  "_forwardslash_",
    "\t": "_tab_",
    "\n": "_newline_",
    "\r": "_carriagereturn_"
  };

  var nums = {
    "0": "_zero_",
    "1": "_one_",
    "2": "_two_",
    "3": "_three_",
    "4": "_four_",
    "5": "_five_",
    "6": "_siz_",
    "7": "_seven_",
    "8": "_eight_",
    "9": "_nine_",
  }

  var wrapper = text => text,
      charWrapper = char => wrapper(illegalChars[char] || "ASCII_" + (char.charCodeAt(0))),
      dedashRe = /([\s-]+.)/g;

  function dedash(string) {
    return string.replace(dedashRe, (_, m) => m[m.length-1].toUpperCase());
  }

  return function toJsIdentifier(text) {
    text = dedash(text);
    if ((keywords.indexOf(text)) >= 0) return wrapper(text);
    if (text.length === 0) return wrapper("_null_");
    return text.replace(/^\d/, n => wrapper(nums[n]))
               .replace(/[^\w\$_]/g, charWrapper);
  }

})();
