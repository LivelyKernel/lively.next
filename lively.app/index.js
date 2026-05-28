// lively.app — programmatic API
// Utilities for NW.js integration, shared between node-main and browser contexts.

export function isNWjs () {
  try {
    return typeof nw !== 'undefined' ||
      (typeof process !== 'undefined' && !!process.versions?.['node-webkit']);
  } catch (_) {
    return false;
  }
}

export function nwjsFlavor () {
  if (!isNWjs()) return null;
  return process.versions['nw-flavor'] || 'unknown'; // "sdk" or "normal"
}
