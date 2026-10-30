import _t from '@babel/types';
import _babel from '@babel/core';

export function cjsDefault (module, expectedProperty, requireName) {
  let value = module;
  const hasExpected = candidate => {
    if (typeof candidate === 'function') return true;
    if (!expectedProperty) return true;
    if (candidate?.[expectedProperty] != null) return true;
    const canonicalName = expectedProperty[0].toLowerCase() + expectedProperty.slice(1);
    return candidate?.[canonicalName] != null;
  };
  while (value && typeof value === 'object' && !hasExpected(value) && 'default' in value) {
    value = value.default;
  }
  if (!hasExpected(value) && requireName && isNodeSystem(globalThis.System) && globalThis.System?._nodeRequire) {
    value = globalThis.System._nodeRequire(requireName);
    while (value && typeof value === 'object' && !hasExpected(value) && 'default' in value) {
      value = value.default;
    }
  }
  return value;
}

export function babelTypes (types, fallbackTypes) {
  const target = types && (typeof types === 'object' || typeof types === 'function') ? types : {};
  return new Proxy(target, {
    get (target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      const fallback = globalThis.babel?.types || globalThis.babel?.default?.types || fallbackTypes;
      if (typeof property === 'string' && /^[A-Z]/.test(property) && typeof value !== 'function') {
        const canonicalName = property[0].toLowerCase() + property.slice(1);
        const canonical = Reflect.get(target, canonicalName, receiver);
        if (typeof canonical === 'function') return canonical;
        if (typeof fallback?.[property] === 'function') return fallback[property];
        if (typeof fallback?.[canonicalName] === 'function') return fallback[canonicalName];
      }
      if (typeof value !== 'function' && typeof fallback?.[property] === 'function') return fallback[property];
      return value;
    }
  });
}

export function isBrowserSystem (System) {
  try {
    if (System?.get?.('@system-env')?.browser) return true;
  } catch (_) {}
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function isNodeSystem (System) {
  try {
    const env = System?.get?.('@system-env');
    if (env) return !!env.node && !env.browser && !env.nw;
  } catch (_) {}
  return !isBrowserSystem(System) &&
    typeof process !== 'undefined' &&
    !!process.versions?.node;
}

export const babel = cjsDefault(_babel, 'parse');
export const t = babelTypes(cjsDefault(_t, 'Identifier'), babel?.types);
