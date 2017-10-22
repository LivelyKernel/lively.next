import { toJsIdentifier } from "lively.classes/util.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function incName(name) {
  return name.replace(/(?:_([0-9]*))?$/, (match, n) => match ? `_${Number(n)+1}` : "_1");
}

export function findUniqJsName(name, boundNames = []) {
  name = toJsIdentifier(name);
  while (boundNames.includes(name)) name = incName(name);
  return name;
}