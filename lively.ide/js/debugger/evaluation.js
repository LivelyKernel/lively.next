function own (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function bindingsForScope (scope) {
  if (!scope) return {};
  const bindings = scope.bindings;
  return bindings || {};
}

export function scopeLookupProxy (scopes = [], fallback = globalThis) {
  const mappings = scopes.map(bindingsForScope).filter(Boolean);
  return new Proxy(Object.create(null), {
    has (target, key) {
      if (key === Symbol.unscopables) return false;
      return mappings.some(mapping => own(mapping, key)) || key in fallback;
    },

    get (target, key) {
      if (key === Symbol.unscopables) return undefined;
      const mapping = mappings.find(mapping => own(mapping, key));
      return mapping ? mapping[key] : fallback[key];
    },

    set (target, key, value) {
      const mapping = mappings.find(mapping => own(mapping, key));
      if (mapping) mapping[key] = value;
      else fallback[key] = value;
      return true;
    }
  });
}

function evaluatorForSource (source) {
  try {
    return Function('__scope__', `with (__scope__) { return (${source}); }`);
  } catch (err) {
    return Function('__scope__', `with (__scope__) { ${source} }`);
  }
}

export function evaluateInDebuggerScopes (source, scopes = [], fallback = globalThis) {
  const proxy = scopeLookupProxy(scopes, fallback);
  return evaluatorForSource(String(source || ''))(proxy);
}
