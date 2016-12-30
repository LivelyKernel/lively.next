import { arr } from "lively.lang";
import { superclassSymbol } from "./runtime.js";

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

export function instanceFields(klass) {
  var owner = klass.prototype,
      descriptors = Object.getOwnPropertyDescriptors(owner);
  return arr.withoutAll(
    Object.keys(descriptors),
    ["constructor"])
      .map(key => {
        var descr = descriptors[key],
            type = typeof descr.value === "function" ? "method" :
                    "get" in descr ? "getter" : 
                      "set" in descr ? "setter" :
                        "unknown",
            value = type === "method" ? descr.value :
                      type === "getter" ? descr.get :
                        type === "setter" ? descr.set : null
        return {name: key, value, type, owner};
      });

}

export function allInstanceFields(klass) {
  return arr.uniq(
          arr.flatmap(
            arr.without(withSuperclasses(klass), Object),
            ea => instanceFields(ea)));
}

export function classFields(klass) {
  var owner = klass,
      descriptors = Object.getOwnPropertyDescriptors(owner);
  return arr.withoutAll(
    Object.keys(descriptors),
    ["prototype", "name", "length", "toString"])
      .map(key => {
        var descr = descriptors[key],
            type = typeof descr.value === "function" ? "method" :
                    "get" in descr ? "getter" : 
                      "set" in descr ? "setter" :
                        "unknown",
            value = type === "method" ? descr.value :
                      type === "getter" ? descr.get :
                        type === "setter" ? descr.set : null;
        return {name: key, value, type, owner};
      });
}

export function allClassFields(klass) {
  return arr.uniq(
          arr.flatmap(
            arr.without(withSuperclasses(klass), Object),
            ea => classFields(ea)));
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

Object.getOwnPropertyDescriptors(Bar.prototype).constructor
Object.getOwnPropertyDescriptors(Bar.prototype).xxxx.
instanceFields(Bar)
allInstanceFields(Bar)

classFields(Bar)
allClassFields(Bar)
*/