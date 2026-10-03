import { ImportMap } from '@jspm/import-map';

const blockedURL = 'lively-import-map-blocked:/';
const resolvers = new Map();

function importMapWithEquivalentScopes (map) {
  const scopes = {};
  const replaceBlockedMappings = entries => Object.fromEntries(
    Object.entries(entries || {}).map(([key, value]) => [key, value === null ? blockedURL : value]));

  for (const [scope, entries] of Object.entries(map.scopes || {})) {
    const mappings = replaceBlockedMappings(entries);
    scopes[scope] = mappings;
    if (scope.startsWith('https:')) scopes[scope.replace(/^https:/, 'esm:')] ||= mappings;
    if (scope.startsWith('esm:')) scopes[scope.replace(/^esm:/, 'https:')] ||= mappings;
  }

  // Integrity hashes affect fetching, not specifier resolution.
  return { imports: replaceBlockedMappings(map.imports), scopes };
}

// Browser-compatible import-map resolution used by SystemJS and the freezer.
export function resolveViaImportMap (id, map, importer) {
  if (!map) return undefined;
  const parent = /^[a-z][a-z0-9+.-]*:/i.test(importer || '') ? importer : map._mapUrl || 'file:///';
  const mapUrl = map._mapUrl || parent;
  // Key by content: Node reloads map objects, and live maps can be edited in place.
  const key = JSON.stringify([mapUrl, map.imports, map.scopes]);
  try {
    let resolver = resolvers.get(key);
    if (!resolver) {
      resolver = new ImportMap({ mapUrl, map: importMapWithEquivalentScopes(map) });
      // Bound retained maps; an evicted map is rebuilt on its next resolution.
      if (resolvers.size >= 32) resolvers.delete(resolvers.keys().next().value);
      resolvers.set(key, resolver);
    }
    const resolved = resolver.resolve(id, parent);
    if (resolved === blockedURL || resolved?.startsWith(blockedURL)) {
      throw new Error(`Import map blocks ${id}`);
    }
    const urlLike = id.startsWith('.') || id.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(id);
    if (urlLike && resolved === new URL(id, parent).href) return undefined;
    return resolved;
  } catch (error) {
    if (!id.startsWith('.') && !id.startsWith('/') && !id.includes(':') && /^Unable to resolve /.test(error.message)) {
      return undefined;
    }
    throw error;
  }
}
