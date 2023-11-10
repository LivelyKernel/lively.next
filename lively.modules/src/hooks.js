import { arr, fun } from 'lively.lang';

function install (System, methodName, hook, hookName = hook.name) {
  let wrapper = System[methodName] = System[methodName] ? fun.wrap(System[methodName], hook) : hook;
  wrapper.hookFunc = hook;
  hook.hookName = hookName; // function.name is not reliable when minified!
}

function remove (System, methodName, hookOrName) {
  let chain = []; let f = System[methodName];
  while (f) {
    chain.push(f);
    f = f.originalFunction;
  }

  let found = typeof hookOrName === 'string'
    ? chain.find(wrapper => wrapper.hookFunc && wrapper.hookFunc.hookName === hookOrName)
    : chain.find(wrapper => wrapper.hookFunc === hookOrName);

  if (!found) return false;

  arr.remove(chain, found);

  System[methodName] = chain.reduceRight((method, wrapper) =>
    fun.wrap(method, wrapper.hookFunc || wrapper));

  return true;
}

function isInstalled (System, methodName, hookOrName) {
  let f = System[methodName];
  while (f) {
    if (f.hookFunc) {
      if (typeof hookOrName === 'string' && f.hookFunc.hookName === hookOrName) return true;
      else if (f.hookFunc === hookOrName) return true;
    }
    f = f.originalFunction;
  }
  return false;
}

export { install, remove, isInstalled };
