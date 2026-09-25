export const ComponentImportKind = Object.freeze({
  NAMED: 'named',
  DEFAULT: 'default',
  NAMESPACE: 'namespace'
});

const importKinds = new Set(Object.values(ComponentImportKind));
const identifierPattern = /^[A-Za-z_$][\w$]*$/;

function requireIdentifier (value, description) {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw new Error(`${description} requires a JavaScript identifier`);
  }
}

export function componentImportBinding ({ kind, moduleId, imported, local }) {
  if (!importKinds.has(kind)) throw new Error(`Unknown component import kind: ${kind}`);
  if (typeof moduleId !== 'string' || !moduleId) {
    throw new Error('Component imports require a module ID');
  }
  requireIdentifier(local, 'Component imports');
  if (kind === ComponentImportKind.NAMED) {
    requireIdentifier(imported, 'Named component imports');
  } else if (imported !== undefined) {
    throw new Error(`${kind} component imports do not accept an imported name`);
  }
  return Object.freeze({
    kind,
    moduleId,
    ...(kind === ComponentImportKind.NAMED ? { imported } : {}),
    local
  });
}

export function normalizeComponentImportBindings (bindings = []) {
  if (!Array.isArray(bindings)) {
    throw new Error('Component import bindings must be an array');
  }
  const normalized = [];
  const byLocal = new Map();
  for (const spec of bindings) {
    const binding = componentImportBinding(spec);
    const previous = byLocal.get(binding.local);
    if (previous) {
      if (previous.kind !== binding.kind || previous.moduleId !== binding.moduleId ||
          previous.imported !== binding.imported) {
        throw new Error(`Conflicting component imports for local binding ${binding.local}`);
      }
      continue;
    }
    byLocal.set(binding.local, binding);
    normalized.push(binding);
  }
  return Object.freeze(normalized);
}

// Adapts the expression serializer's legacy module -> exported-name map at
// the boundary. Projection commands only carry validated domain bindings.
export function componentImportBindingsFromExpression (bindings = {}) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    throw new Error('Serialized expression bindings must be an object');
  }
  const specs = [];
  for (const [moduleId, rawReferences] of Object.entries(bindings)) {
    const references = Array.isArray(rawReferences) ? rawReferences : [rawReferences];
    for (const reference of references) {
      if (typeof reference === 'string') {
        specs.push({
          kind: ComponentImportKind.NAMED,
          moduleId,
          imported: reference,
          local: reference
        });
        continue;
      }
      const exported = reference?.exported;
      const local = reference?.local || exported;
      if (exported === 'default') {
        specs.push({ kind: ComponentImportKind.DEFAULT, moduleId, local });
      } else if (exported === '*') {
        specs.push({ kind: ComponentImportKind.NAMESPACE, moduleId, local });
      } else {
        specs.push({
          kind: ComponentImportKind.NAMED,
          moduleId,
          imported: exported,
          local
        });
      }
    }
  }
  return normalizeComponentImportBindings(specs);
}
