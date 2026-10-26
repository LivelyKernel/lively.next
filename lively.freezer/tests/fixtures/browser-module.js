/* global window */
/** Run the standalone browser bundle fixture. */
export function main () {
  const veryLongVariableName = 42;
  window.__freezerBrowserMainCalls = (window.__freezerBrowserMainCalls || 0) + 1;
  return veryLongVariableName;
}
