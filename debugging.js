// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// debugging helpers

function printUUID(id) {
  if (typeof id !== "string") return String(id);
  if (/^[a-z]/i.test(id)) return id.slice(0, id.indexOf("_")+6);
  return id.slice(0, 5);
}

function printObj(obj) {
  if (!obj) return String(obj);
  if (typeof obj.serializeExpr === "function") return obj.serializeExpr();
  if (obj.type === "lively-sync-morph-spec") return `<spec for ${printUUID(obj.spec._id)}>`
  if (obj.type === "lively-sync-morph-ref") return `<ref for ${printUUID(obj.id)}>`
  return lively.lang.obj.inspect(obj, {maxDepth: 1}).replace(/\n/g, "").replace(/\s\s+/g, " ");
}

function printChange(change) {
  var {type, target, value, prop, selector, args} = change;
  switch (type) {
    case 'method-call':
      return `${printUUID(target.id)}.${selector}(${args.map(printObj).join(",")})`;
    case 'setter':
      return `${printUUID(target.id)}.${prop} = ${printObj(value)}`;
    default:
      "?????????"
  }
}

export function printOp(op) {
  var {id, parent, change, creator, version} = op;
  return `${printUUID(id)} < ${printUUID(parent)} | ${version} | ${printChange(change)} | ${creator}`
}

export function printOps(ops) { return ops.map(printOp).join("\n"); }
