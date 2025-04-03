
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
      case 'node-import': mapping = mapping.node || mapping.import || mapping.default; break;
      case 'module': mapping = mapping.module ||  mapping.node || mapping.import || mapping.default; break;
      default: mapping = mapping.default;
    }
  }
  if (!mapping) throw Error('Cannot resolve undefined mapping!');
  return mapping;
}