import { string, Path, obj, properties, arr } from "lively.lang";
import { getSerializableClassMeta } from "../class-helper.js";
import { connect } from "lively.bindings";
/*global System*/
export default class ExpressionSerializer {

  constructor(opts) {
    var {prefix} = {
      prefix: "__lv_expr__",
      ...opts
    }
    this.prefix = prefix + ":";
  }

  isSerializedExpression(string) {
    return string.indexOf(this.prefix) === 0;
  }

  requiredModulesOf__expr__(__expr__) {
    if (!this.isSerializedExpression(__expr__)) return null;
    var {bindings} = this.exprStringDecode(__expr__);
    return bindings ? Object.keys(bindings) : null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // encode / decode of serialized expressions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  exprStringDecode(string) {
    // 1. read prefix
    // string = "_prefix:{foo}:package/foo.js:foo()"
    // => {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}

    let idx = string.indexOf(":"),
        prefix = string.slice(0, idx),
        rest = string.slice(idx+1),
        bindings = {},
        httpPlaceholder = `__HTTP_PLACEHOLDER__`,
        hasBindings = false;

    // 2. bindings?
    while (rest && rest.startsWith("{") && (idx = rest.indexOf("}:")) >= 0) {
      hasBindings = true;
      let importedVars = rest.slice(1,idx);
      rest = rest.slice(idx+2); // skip }:
      if (rest.includes('https:') && rest.indexOf('https:') < rest.indexOf(':')) {
        rest = rest.replace('https:', httpPlaceholder);
        idx = rest.indexOf(":") - httpPlaceholder.length + 'https:'.length;
        rest = rest.replace(httpPlaceholder, 'https:');
      } else idx = rest.indexOf(":") // end of package
      let from = rest.slice(0, idx),
          imports = importedVars.split(",")
            .filter(ea => Boolean(ea.trim()))
            .map(ea => {
              if (!ea.includes(":")) return ea;
              let [exported, local] = ea.split(":");
              return {exported, local};
            })
      bindings[from] = imports;
      rest = rest.slice(idx+1); // skip :
    }

    return {__expr__: rest, bindings: hasBindings ? bindings : null};
  }

  exprStringEncode({__expr__, bindings}) {
    // {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}
    // => "_prefix:{foo}:package/foo.js:foo()"

    var string = String(__expr__);
    if (bindings) {
      var keys = Object.keys(bindings);
      for (var i = 0; i < keys.length; i++) {
        var from = keys[i], binding = bindings[from];
        if (Array.isArray(binding)) {
          binding = binding.map(ea =>
            typeof ea === "string" ? ea : ea.exported + ":" + ea.local).join(",")
        }
        string = `{${binding}}:${from}:${string}`;
      }
    }
    return this.prefix + string
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  convert__expr__obj(obj) {
    // obj.__expr__ is encoded serialized expression *without* prefix
    console.assert("__expr__" in obj, "obj has no property __expr__");
    return this.prefix + obj.__expr__;
  }

  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // deserialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // note __boundValues__ becomes a dynamically scoped "variable" inside eval
  __eval__(__source__, __boundValues__) { 
    this.__boundValues__ = __boundValues__;
    return eval(__source__); 
  }

  deserializeExpr(encoded) {
    if (!encoded.startsWith(this.prefix))
      throw new Error(`"${encoded}" is not a serialized expression, missing prefix "${this.prefix}"`);
    return this.deserializeExprObj(this.exprStringDecode(encoded));
  }

  deserializeExprObj({__expr__: source, bindings}) {

    let __boundValues__ = {};

    if (bindings) {
      let mods = bindings ? Object.keys(bindings) : [];

      // synchronously get modules specified in bindings object and pull out
      // the vars needed for evaluating source. Add those to __boundValues__
      for (let i = 0; i < mods.length; i++) {
        let modName = mods[i],
            vars = bindings[modName],
            exports = System.get(System.decanonicalize(modName));
        if (lively.FreezerRuntime) {
          if (!exports) {
            // try to fetch if global is defined
            let mod = lively.FreezerRuntime.fetchStandaloneFor(modName);
            if (mod) exports = mod.exports; 
          }
          if (exports.exports) exports = exports.exports;
        }
        if (!exports) {
          throw new Error(`[lively.serializer] expression eval: bindings specify to import ${
             modName
          } but this module is not loaded!\nSource: ${
             source
          }`);
        }
        for (let j = 0; j < vars.length; j++) {
          let varName = vars[j], local, exported;
          if (typeof varName === "string") {
            local = varName; exported = varName;
          } else if (typeof varName === "object") { // alias
            ({local, exported} = varName);
          }
          __boundValues__[local] = exports[exported];
          source = `var ${local} = this.__boundValues__.${local};\n${source}`;
        }
      }
    }

    // evaluate
    return this.__eval__(source, __boundValues__);
  }

}

/*
 22.06.19 rms:
 The following two functions are helpers that allow us to convert non cyclical morph hierarchies
 into nested serialized expressions. As of now it is kinda morph specific, however could be easily
 generalized to become suitable for more general object trees.
*/

export function deserializeSpec(serializedSpec, subSpecHandler = (spec) => spec, base = {}) {
  const exprSerializer = new ExpressionSerializer();
  let deserializedSpec = base;
  let props = base.isMorph ? base.propertiesAndPropertySettings().properties : []
  props = props.length ? obj.sortKeysWithBeforeAndAfterConstraints(props) : obj.keys(serializedSpec);

  for (let prop of props) {
    let value = serializedSpec[prop];
    if (prop ==='_env' || prop ==='env' || prop === '__connections__' || prop === '__refs__') return;
    if (obj.isString(value) && exprSerializer.isSerializedExpression(value)) {
      value = exprSerializer.deserializeExpr(value);
    }
    if (['borderColor', 'borderWidth', 'borderStyle', 'borderRadius'].includes(prop)) {
      value = deserializeSpec(value, subSpecHandler);
    }
    if (value && value._id) {
      value = subSpecHandler(deserializeSpec(value, subSpecHandler));
    }
    deserializedSpec[prop] = value;
  }
  
  if (serializedSpec.submorphs) deserializedSpec.submorphs = serializedSpec.submorphs.map(spec => {
    return deserializeSpec(spec, subSpecHandler)
  });

  if (base) {
    for (let prop of props.filter(key => !!serializedSpec[key])) base[prop] = deserializedSpec[prop];
  }
  
  if (serializedSpec.__refs__) {
    for (let [pathToParent, pathToVal] of serializedSpec.__refs__) {
      Path(pathToParent).set(deserializedSpec, Path(pathToVal).get(deserializedSpec));
    }
  }
  if (serializedSpec.__connections__) {
    for (let conn of serializedSpec.__connections__) {
      connect(
        Path(conn.pathToSource).get(deserializedSpec),
        conn.sourceAttrName,
        Path(conn.pathToTarget).get(deserializedSpec),
        conn.targetMethodName, {
          ...obj.select(conn, ['garbageCollect', 'converterString', 'updaterString', 'varMapping'])
      });
    }
  }
  return deserializedSpec;
}

// this.exportToJSON()

export function serializeSpec(morph, opts = {}) {
  // quick hack to "snapshot" into JSON or serialized expression
    var { 
      keepFunctions = true,
      skipAttributes = [],
      keepConnections = true,
      asExpression = false, 
      root = true,
      path = '',
      skipUnchangedFromDefault = false,
      nestedExpressions = {},
      objToPath = new WeakMap(),
      objRefs = [],
      connections = [],
    } = opts;
    let subopts = {
      skipAttributes,
      skipUnchangedFromDefault,
      root: false,
      keepFunctions,
      asExpression,
      nestedExpressions,
      connections,
      objRefs,
      objToPath,
      keepConnections
    };

    if (objToPath.has(morph)) {
      // morph was already serialized, add ref and return
      objRefs.push([path, /* => */ objToPath.get(morph)]) // store assignment
      return null;
    } else objToPath.set(morph, path);
    if (asExpression) keepFunctions = false;
    const exprSerializer = new ExpressionSerializer();
    const getExpression = (name, val) => {
      try {
          val = val.__serialize__(); // serializeble expressions
          if (asExpression) {
            let exprId = string.newUUID();
            nestedExpressions[exprId] = val;
            val = exprId;
          } else val = val.__expr__ ? exprSerializer.exprStringEncode(val) : val;
        } catch (e) {
          console.log(`[export to JSON] failed converting ${name} to serialized expression`); 
        }
      return val;
    }

    var exported = {};

    objToPath.set(morph, path);

    if (keepConnections && morph.attributeConnections)
      connections.push(...morph.attributeConnections);

    if (morph.isText) {
      exported.textAndAttributes = morph.textAndAttributes.map((ea, i) => {
        return ea && ea.isMorph ? serializeSpec(ea, {
           ...subopts,
           path: path ? path + '.textAndAttributes.' + i : 'textAndAttributes.' + i ,
        }) : ea
      })
    }

    if (morph.submorphs && morph.submorphs.length > 0) {
      exported.submorphs = morph.submorphs.map((ea, i) => serializeSpec(ea, {
        ...subopts,
        path: path ? path + '.submorphs.' + i : 'submorphs.' + i ,
      })).filter(Boolean);
    }

    for (let name in morph.spec(skipUnchangedFromDefault)) {
      let val = morph[name];
      if (val && typeof val === 'object' && !Array.isArray(val) && !val.isMorph) {
        objToPath.set(val, path ? path + '.' + name : name);
      }
      if (name === "submorphs") continue;
      if (skipAttributes.includes(name)) continue;
      if (name === 'metadata' && Path('commit.__serialize__').get(val)) {
        exported[name] = { ...val, commit: getExpression(name + '.commit', val.commit)};
        continue;
      }
      if (['borderColor', 'borderWidth', 'borderStyle', 'borderRadius'].includes(name)) {
        let serializedVal = {};
        for (let mem of ['top', 'left', 'right', 'bottom']) {
          let memberValue = val[mem];
          if (memberValue && memberValue.__serialize__) {
             memberValue = memberValue.__serialize__();
             if (memberValue && memberValue.__expr__) {
               if (asExpression) {
                 let uuid = string.newUUID();
                 nestedExpressions[uuid] = memberValue;
                 memberValue = uuid;
               } else memberValue = exprSerializer.exprStringEncode(memberValue)
             }
          }
          serializedVal[mem] = memberValue; 
        }
        exported[name] = serializedVal;
        continue;
      }
      if (val && val.isMorph) {
        exported[name] = serializeSpec(val, {
          ...subopts,
          path: path ? path + "." + name : name
        });
        continue;
      }
      if (val && val.__serialize__) {
        exported[name] = getExpression(name, val);
        continue;
      }
      if (Array.isArray(val)) {
        // check if each array member is seralizable
        exported[name] = val.map((v, i) => {
          if (v && v.isMorph)
            return serializeSpec(v, {
              ...subopts,
              path: path ? path + '.' + name + '.' + i : name + '.' + i
            });
          if (v && v.__serialize__) {
            return getExpression(name + '.' + i, v);
          }
          return v;
        });
        continue;
      }
      if (val && !obj.isString(val) && !obj.isNumber(val) &&          
         properties.allOwnPropertiesOrFunctions(val).length > 0) {
         for (let prop in val) {
           if (val[prop] && val[prop].isMorph) val[prop] = serializeSpec(val[prop], {
             ...subopts,
             path: path ? path + '.' + name + '.' + prop : name + '.' + prop
           });
         }
      }
      exported[name] = val;
    }

    if (morph.isText) delete exported.textString;
    
    if (!asExpression) exported._id = morph._id;
    if (keepFunctions) {
      exported.type = morph.constructor; // not JSON!
      Object.keys(morph).forEach(name =>
        typeof morph[name] === "function" && (exported[name] = morph[name]));
    } else {
      if (exported.styleSheets) exported.styleSheets = [];
      exported.type = getSerializableClassMeta(morph);
    }
    // this.exportToJSON()
    if (keepConnections && root) {
       /*
         Right now we can only reconstruct connections which are between morphs 
         or objects which are directly referenced by a morph. Other ones are skipped.
       */
       let connectionExpressions = []
       for (let conn of connections) {
         let { 
           sourceAttrName, targetMethodName, sourceObj, targetObj,
           updaterString, converterString, varMapping, garbageCollect
         } = conn;
         let pathToSource = objToPath.get(sourceObj);
         let pathToTarget = objToPath.get(targetObj);
         if (typeof pathToSource === 'string' && typeof pathToTarget === 'string') {
           connectionExpressions.push({
             pathToSource, pathToTarget, garbageCollect,
             updaterString, converterString,
             sourceAttrName, targetMethodName,
             varMapping: {
               properties
             }
           })
           continue;
         }
         console.log('skipping:', conn);
       }
      if (!asExpression) exported.__connections__ = connectionExpressions;
    }
    
    if (asExpression && root) {
      // replace the nestedExpressions after stringification
      let __expr__ = `morph(${obj.inspect(exported)})`;
      let bindings = {
        'lively.morphic': ['morph']
      }
      for (let exprId in nestedExpressions) {
        __expr__ = __expr__.replace('\"' + exprId + '\"', nestedExpressions[exprId].__expr__);
        Object.entries(nestedExpressions[exprId].bindings || {}).forEach(([binding, imports]) => {
          if (bindings[binding])
            bindings[binding] = arr.uniq([...bindings[binding], ...imports])
          else bindings[binding] = imports;
        });
      }
      return { __expr__, bindings }
    }

    if (root) exported.__refs__ = objRefs;
  
    return exported;
}