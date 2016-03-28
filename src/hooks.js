import { arr, fun } from "lively.lang";
import { getSystem } from "./system.js";

function install(System, hookName, hook) {
  System = getSystem(System);
  System[hookName] = fun.wrap(System[hookName], hook);
  System[hookName].hookFunc = hook;
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

function isInstalled(System, methodName, hookOrName) {
  var f = System[methodName];
  while (f) {
    if (f.hookFunc) {
      if (typeof hookOrName === "string" && f.hookFunc.name === hookOrName) return true;
      else if (f.hookFunc === hookOrName) return true;
    }
    f = f.originalFunction;
  }
  return false;
}

export { install, remove, isInstalled };