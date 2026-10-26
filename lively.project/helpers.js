/** Pass the caller's module URL explicitly for native or namespace imports. */
export function projectAsset (fileName, module = this?.__currentLivelyModule) {
  // The bundler takes care of moving all assets for us.
  if (globalThis.lively?.FreezerRuntime) {
    return './assets/' + fileName;
  }

  // Older component source calls this without metadata; stack URLs work across
  // Chromium and Firefox without depending on their frame formatting.
  const moduleId = (typeof module === 'string' ? module : module?.id || module?.url) || new Error().stack;
  const callingProject = moduleId?.match(/\/local_projects\/([^/]+)\//)?.[1];
  if (!callingProject) {
    throw new Error('projectAsset requires a module URL inside local_projects; pass import.meta.url as its second argument.');
  }

  return '/local_projects/' + callingProject + '/assets/' + fileName;
}
