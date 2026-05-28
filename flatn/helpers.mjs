
export function resolveExportMapping (mapping, context) {
  if (!mapping) throw Error('Cannot resolve undefined mapping!');
  if (typeof mapping === 'string') return mapping;
  let adjustedPath;
  if (Array.isArray(mapping)) {
    for (let subMapping of mapping) {
      adjustedPath = resolveExportMapping(subMapping, context);
      if (adjustedPath) {
        mapping = adjustedPath;
        break; 
      }
    }
  }
  if (typeof mapping === 'object') {
    switch (context) {
      case 'node-require': adjustedPath = mapping.node || mapping.require || mapping.default; break;
      case 'systemjs-browser': 
      case 'node-import': adjustedPath = mapping.node || mapping.import || mapping.default; break;
      case 'module': adjustedPath = mapping.module ||  mapping.node || mapping.import || mapping.default; break;
      default: adjustedPath = mapping.default;
    }
    return resolveExportMapping(adjustedPath, context);
  }
  
  return adjustedPath;
}

export function resolveImportMapping(name, mapping, context) {
  if (!mapping) throw Error('Cannot resolve undefined mapping!');
  mapping = mapping[name];
  if (!mapping) throw Error('Cannot resolve undefined mapping!');
  while (typeof mapping === 'object') {
    switch (context) {
      case 'node-require': mapping = mapping.node || mapping.require || mapping.default; break;
      case 'systemjs-browser': 
      case 'node-import': mapping = mapping.node || mapping.import || mapping.default; break;
      case 'module': mapping = mapping.module ||  mapping.node || mapping.import || mapping.default; break;
      default: mapping = mapping.default;
    }
  }
  if (!mapping) throw Error('Cannot resolve undefined mapping!');
  return mapping;
}

function equivalentImportMapScopesFor (url) {
  if (!url || typeof url !== 'string') return [];
  const urls = [url];
  if (url.startsWith('https://ga.jspm.io/')) {
    urls.push(url.replace('https://ga.jspm.io/', 'esm://ga.jspm.io/'));
  } else if (url.startsWith('esm://ga.jspm.io/')) {
    urls.push(url.replace('esm://ga.jspm.io/', 'https://ga.jspm.io/'));
  }
  return urls;
}

export function resolveViaImportMap (id, importMap, importer) {
  let scope, remapped = importMap.imports?.[id] || null;
  const importers = equivalentImportMapScopesFor(importer);
  if (scope = Object.entries(importMap.scopes || {})
    .filter(([k]) => importers.some(ea => ea.startsWith(k)))
    .sort((a, b) => a[0].length - b[0].length)
    .map(([_, scope]) => scope)
    .reduce((a, b) => ({ ...a, ...b }), false)) {
    if (scope[id]) remapped = scope[id];
    else {
      const prefixMapping = Object.keys(scope).find(k => k.endsWith('/') && id.startsWith(k))
      if (prefixMapping) remapped = id.replace(prefixMapping, scope[prefixMapping]);
    }
  }
  if (remapped) {
    return remapped;
  }
}
