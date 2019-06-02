export function isPrimitive(obj) {
  // primitive objects don't need to be registered
  if (obj == null) return true;
  var t = typeof obj;
  if ("boolean" === t || "number" === t || "string" === t) return true;
  return false;
}
