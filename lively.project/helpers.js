export function projectAsset (fileName) {
  // The bundler takes care of moving all assets for us.
  if (lively.FreezerRuntime) {
    return './assets/' + fileName;
  }

  // Uses Error() to generate the stacktrace from this function being called.
  // Afterwards, we find out from within which project we were called.
  // This is the project of which we need to construct the asset path!
  const callStack = (new Error()).stack;
  const callingProject = callStack.match(new RegExp('\\(.*\\/local_projects\\/(?<callingProject>[a-zA-Z_\\-\\d]+)\\/.*\\.js')).groups.callingProject;

  return '/local_projects/' + callingProject + '/assets/' + fileName;
}
