import { arr, fun } from "lively.lang";
import { getSystem, ensureExtension } from "./system.js";

function install(System, hookName, hook) {
  System = getSystem(System);
  System[hookName] = fun.wrap(System[hookName], hook);
  System[hookName].hookFunc = hook;

  // var ext = ensureExtension(System);
  // var hookData = ext.hooks[hookName] || (ext.hooks[hookName] = {original: null, hooks: []});
  // if (!hookData.original) hookData.original = System[hookName];
  // arr.pushIfNotIncluded(hookData.hooks, hook);
}

function remove(System, methodName, hookOrName) {
  var chain = [], f = System[methodName];
  while (f) {
    chain.push(f);
    f = f.originalFunction;
  }

  var found = typeof hookOrName === "string" ?
    chain.find(wrapper => wrapper.hookFunc && wrapper.hookFunc.name === hookOrName) :
    chain.find(wrapper => wrapper.hookFunc === hookOrName);
  
  if (!found) return false;
  
  arr.remove(chain, found);
  
  System[methodName] = chain.reduceRight((method, wrapper) =>
    method.wrap(wrapper.hookFunc || wrapper));

  return true;
}

export { install, remove };