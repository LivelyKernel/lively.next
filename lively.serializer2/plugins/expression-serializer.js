/* global System */
import { string, Closure, Path, obj, properties, arr } from 'lively.lang';
import { getSerializableClassMeta, getClassName } from '../class-helper.js';
import { connect } from 'lively.bindings';
import { joinPath } from 'lively.lang/string.js';

// 25.5.20 rms: this function requires the parameters to be unchanged when we run this through google closure. This is why we construct if from source.
const __eval__ = Closure.fromSource(`function __eval__(__source__, __boundValues__) { 
  return eval(__source__); 
}`).getFunc();

export default class ExpressionSerializer {
  constructor (opts) {
    const { prefix } = {
      prefix: '__lv_expr__',
      ...opts
    };
    this._decanonicalized = {};
    this.prefix = prefix + ':';
  }

  isSerializedExpression (string) {
    return obj.isString(string) && string.indexOf(this.prefix) === 0;
  }

  requiredModulesOf__expr__ (__expr__) {
    if (!this.isSerializedExpression(__expr__)) return null;
    const { bindings } = this.exprStringDecode(__expr__);
    return bindings ? Object.keys(bindings) : null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // encode / decode of serialized expressions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  exprStringDecode (string) {
    // 1. read prefix
    // string = "_prefix:{foo}:package/foo.js:foo()"
    // => {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}

    let idx = string.indexOf(':');
    let rest = string.slice(idx + 1);
    const bindings = {};
    const httpPlaceholder = '__HTTP_PLACEHOLDER__';
    let hasBindings = false;

    // 2. bindings?
    while (rest && rest.startsWith('{') && (idx = rest.indexOf('}:')) >= 0) {
      hasBindings = true;
      const importedVars = rest.slice(1, idx);
      rest = rest.slice(idx + 2); // skip }:
      if (rest.includes('https:') && rest.indexOf('https:') < rest.indexOf(':')) {
        rest = rest.replace('https:', httpPlaceholder);
        idx = rest.indexOf(':') - httpPlaceholder.length + 'https:'.length;
        rest = rest.replace(httpPlaceholder, 'https:');
      } if (rest.includes('local:') && rest.indexOf('local:') < rest.indexOf(':')) {
        rest = rest.replace('local:', httpPlaceholder);
        idx = rest.indexOf(':') - httpPlaceholder.length + 'local:'.length;
        rest = rest.replace(httpPlaceholder, 'local:');
      } else idx = rest.indexOf(':'); // end of package
      const from = rest.slice(0, idx);
      const imports = importedVars.split(',')
        .filter(ea => Boolean(ea.trim()))
        .map(ea => {
          if (!ea.includes(':')) return ea;
          const [exported, local] = ea.split(':');
          return { exported, local };
        });
      bindings[from] = imports;
      rest = rest.slice(idx + 1); // skip :
    }

    return { __expr__: rest, bindings: hasBindings ? bindings : null };
  }

  exprStringEncode ({ __expr__, bindings }) {
    // {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}
    // => "_prefix:{foo}:package/foo.js:foo()"

    let string = String(__expr__);
    if (bindings) {
      const keys = Object.keys(bindings);
      for (let i = 0; i < keys.length; i++) {
        const from = keys[i]; let binding = bindings[from];
        if (Array.isArray(binding)) {
          binding = binding.map(ea =>
            typeof ea === 'string' ? ea : ea.exported + ':' + ea.local).join(',');
        }
        string = `{${binding}}:${from}:${string}`;
      }
    }
    return this.prefix + string;
  }

  getExpressionForFunction (func) {
    const { package: pkg, pathInPackage } = func[Symbol.for('lively-module-meta')];

    return this.exprStringEncode({
      __expr__: func.name,
      bindings: {
        [joinPath(pkg.name, pathInPackage)]: [func.name]
      }
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  convert__expr__obj (obj) {
    // obj.__expr__ is encoded serialized expression *without* prefix
    console.assert('__expr__' in obj, 'obj has no property __expr__');
    return this.prefix + obj.__expr__;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // deserialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // note __boundValues__ becomes a dynamically scoped "variable" inside eval
  __eval__ (source, boundValues) {
    return __eval__(source, boundValues);
  }

  deserializeExpr (encoded) {
    if (!encoded.startsWith(this.prefix)) { throw new Error(`"${encoded}" is not a serialized expression, missing prefix "${this.prefix}"`); }
    return this.deserializeExprObj(this.exprStringDecode(encoded));
  }

  resolveModule (modName) {
    return this._decanonicalized[modName] || (this._decanonicalized[modName] = System.decanonicalize(modName));
  }

  getModuleRecorder (modName) {
    const m = System.get('@lively-env').loadedModules[this.resolveModule(modName)];
    return m ? m.recorder : {};
  }

  getModuleExports (modName) {
    const m = System.get('@lively-env').loadedModules[this.resolveModule(modName)];
    return m ? m.record().exports : {};
  }

  deserializeExprObj ({ __expr__: source, bindings }) {
    const __boundValues__ = {};

    if (bindings) {
      const mods = bindings ? Object.keys(bindings) : [];

      // synchronously get modules specified in bindings object and pull out
      // the vars needed for evaluating source. Add those to __boundValues__
      for (let i = 0; i < mods.length; i++) {
        const modName = mods[i];
        const vars = bindings[modName];
        let exports;
        if (lively.FreezerRuntime) {
          exports = lively.FreezerRuntime.get(lively.FreezerRuntime.decanonicalize(modName));
          if (!exports) {
            // try to fetch if global is defined
            const mod = lively.FreezerRuntime.fetchStandaloneFor(modName);
            if (mod) exports = mod.exports;
          }
          if (exports.exports) exports = exports.exports;
        } else {
          exports = System.get(this.resolveModule(modName));
          if (!exports) {
            exports = this.getModuleExports(modName);
          }
        }
        if (!exports) {
          throw new Error(`[lively.serializer] expression eval: bindings specify to import ${
             modName
          } but this module is not loaded!\nSource: ${
             source
          }`);
        }
        for (let j = 0; j < vars.length; j++) {
          const varName = vars[j]; let local; let exported;
          if (typeof varName === 'string') {
            local = varName; exported = varName;
          } else if (typeof varName === 'object') { // alias
            ({ local, exported } = varName);
          }
          if (!exports[exported]) __boundValues__[local] = this.getModuleRecorder(modName)[exported];
          else __boundValues__[local] = exports[exported];
          source = `var ${local} = __boundValues__.${local};\n${source}`;
        }
      }
    }

    // evaluate
    return this.__eval__(source, __boundValues__);
  }

  embedValue (val, nestedExpressions) {
    if (val && val.__serialize__) {
      val = val.__serialize__({ expressionSerializer: this });
      if (val && val.__expr__) {
        if (nestedExpressions) {
          const uuid = string.newUUID();
          nestedExpressions[uuid] = val;
          val = uuid;
        } else val = this.exprStringEncode(val);
      }
    }
    return val;
  }
}

/*
 22.06.19 rms:
 The following two functions are helpers that allow us to convert non cyclical morph hierarchies
 into nested serialized expressions. As of now it is kinda morph specific, however could be easily
 generalized to become suitable for more general object trees.
*/

function getExpression (name, val, ctx) {
  const { exprSerializer, asExpression, nestedExpressions } = ctx;
  try {
    if (val[Symbol.for('__LivelyClassName__')]) {
      val = exprSerializer.exprStringDecode(exprSerializer.getExpressionForFunction(val));
    } else {
      val = val.__serialize__({ expressionSerializer: exprSerializer });
      if (exprSerializer.isSerializedExpression(val)) val = exprSerializer.exprStringDecode(val);
      exprSerializer;
    }
    if (asExpression) {
      const exprId = string.newUUID();
      nestedExpressions[exprId] = val;
      val = exprId;
    } else val = val.__expr__ ? exprSerializer.exprStringEncode(val) : val;
  } catch (e) {
    console.log(`[export to JSON] failed converting ${name} to serialized expression`);
  }
  return val;
}

/**
 * Turns a spec into a fully initialized morph hierarchy (or base object).
 * @param { Object } serializedSpec - A proper spec object.
 * @param { function } [subSpecHandler] - Optional function that allows us to convert/filter subspecs.
 * @param { Morph|Object } [base] - Optional object or morph that is populated according to the spec.
 * @returns { Morph|Object }
 */
export function deserializeSpec (serializedSpec, subSpecHandler = (spec) => spec, base = {}) {
  const exprSerializer = new ExpressionSerializer();
  const deserializedSpec = base;
  let props = base.isMorph ? base.propertiesAndPropertySettings().order : [];
  props = props.length ? props : obj.keys(serializedSpec);

  for (const prop of props) {
    let value = serializedSpec[prop];
    if (prop === '_env' || prop === 'env' || prop === '__connections__' || prop === '__refs__') return;
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

  if (serializedSpec.submorphs) {
    deserializedSpec.submorphs = serializedSpec.submorphs.map(spec => {
      return deserializeSpec(spec, subSpecHandler);
    });
  }

  if (base) {
    for (const prop of props.filter(key => !!serializedSpec[key])) base[prop] = deserializedSpec[prop];
  }

  if (serializedSpec.__refs__) {
    for (const [pathToParent, pathToVal] of serializedSpec.__refs__) {
      Path(pathToParent).set(deserializedSpec, Path(pathToVal).get(deserializedSpec));
    }
  }
  if (serializedSpec.__connections__) {
    for (const conn of serializedSpec.__connections__) {
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

export function serializeNestedProp (name, val, serializerContext, members = ['top', 'left', 'right', 'bottom']) {
  const { asExpression, exprSerializer, nestedExpressions } = serializerContext;
  let serializedVal = {};
  // if all members of the val are equal resort to short hand
  if (arr.uniqBy(Object.values(val).filter(v => typeof v !== 'function'), obj.equals).length === 1) {
    serializedVal = getExpression(name, val[members[0]], serializerContext);
  } else {
    for (const mem of members) {
      serializedVal[mem] = exprSerializer.embedValue(val[mem], asExpression && nestedExpressions);
    }
  }
  return serializedVal;
}

function getArrayExpression (name, list, path, subopts) {
  return list.map((v, i) => {
    if (v && v.isMorph) {
      return serializeSpec(v, { // eslint-disable-line no-use-before-define
        ...subopts,
        path: path ? path + '.' + name + '.' + i : name + '.' + i
      });
    }
    if (v && v.__serialize__) {
      return getExpression(name + '.' + i, v, subopts);
    }
    return v;
  });
}

export function serializeSpec (morph, opts = {}) {
  // quick hack to "snapshot" into JSON or serialized expression
  let {
    keepFunctions = true,
    skipAttributes = [],
    onlyInclude = false,
    keepConnections = true,
    skipUnchangedFromDefault = false,
    valueTransform = (key, val) => val,
    asExpression = false,
    // this is needed in case we generate a component definition or part derivation
    dropMorphsWithNameOnly = false,
    exposeMasterRefs = false,
    skipUnchangedFromMaster = false,
    // internal params
    root = true,
    path = '',
    nestedExpressions = {},
    objToPath = new WeakMap(),
    objRefs = [],
    connections = [],
    exprSerializer = new ExpressionSerializer(),
    masterInScope = morph.master
  } = opts;
  const subopts = {
    keepFunctions,
    skipAttributes,
    root: false,
    asExpression,
    nestedExpressions,
    connections,
    objRefs,
    objToPath,
    keepConnections,
    valueTransform,
    exposeMasterRefs,
    masterInScope: morph.master || masterInScope,
    exprSerializer,
    onlyInclude,
    dropMorphsWithNameOnly,
    skipUnchangedFromDefault,
    skipUnchangedFromMaster
  };

  if (objToPath.has(morph)) {
    // morph was already serialized, add ref and return
    objRefs.push([path, /* => */ objToPath.get(morph)]); // store assignment
    return null;
  } else objToPath.set(morph, path);

  let exported = {};

  objToPath.set(morph, path);

  if (keepConnections && morph.attributeConnections) { connections.push(...morph.attributeConnections); }

  let styleProto;
  if (skipUnchangedFromMaster &&
        masterInScope &&
        (masterInScope.managesMorph(morph.name) || morph === masterInScope.targetMorph)) {
    styleProto = masterInScope.synthesizeSubSpec(morph === masterInScope.targetMorph ? null : morph.name, null, false);
    while (styleProto.isPolicyApplicator) {
      styleProto = styleProto.synthesizeSubSpec(null, null, false);
    }
  }

  if ((morph.isText || morph.isLabel) && morph.textString !== '') {
    // text morphs usually do not return text and attributes so we add them by hand
    if (styleProto?.textString !== morph.textString) {
      exported.textAndAttributes = morph.textAndAttributes.map((ea, i) => {
        return ea && ea.isMorph
          ? serializeSpec(ea, {
            ...subopts,
            path: path ? path + '.textAndAttributes.' + i : 'textAndAttributes.' + i
          })
          : ea;
      });
    }
    if (exposeMasterRefs && masterInScope?.managesMorph(morph.name)) {
      const parentSpec = masterInScope.parent?.getSubSpecFor(morph.name);
      // check for either textString or textAndAttributes
      if (parentSpec.textString === exported.textString) delete exported.textString;
      if (arr.equals(parentSpec.textAndAttributes, exported.textAndAttributes)) { delete exported.textAndAttributes; }
    }
  }

  if (morph.submorphs && morph.submorphs.length > 0) {
    // if one of the morphs is returned as expression also incorporate them properly
    exported.submorphs = morph.submorphs.map((ea, i) => serializeSpec(ea, {
      ...subopts,
      path: path ? path + '.submorphs.' + i : 'submorphs.' + i
    })).filter(Boolean);
    if (exported.submorphs.length === 0) delete exported.submorphs;
  }

  let propsNotManagedByMaster;
  if (masterInScope) {
    propsNotManagedByMaster = morph.__only_serialize__;
  }

  for (const name in morph.spec(skipUnchangedFromDefault)) {
    let v = morph[name];
    v = v?.valueOf ? v.valueOf() : v;
    if (name !== 'name' && styleProto &&
        obj.equals(v, styleProto[name])) continue;
    const val = valueTransform(name, morph[name]);
    if (val && typeof val === 'object' && !Array.isArray(val) && !val.isMorph) {
      objToPath.set(val, path ? path + '.' + name : name);
    }
    if (propsNotManagedByMaster && !propsNotManagedByMaster.includes(name)) continue;
    if (name === 'master') continue;
    if (name === 'position' && masterInScope?.isPositionedByLayout(morph)) continue;
    if (name === 'extent') {
      // FIXME: This wont work with new Text morphs in label mode.
      if (morph.isLabel) continue;
      if (masterInScope?.isResizedByLayout(morph)) continue;
    }
    if (name === 'submorphs' || name === 'type') continue;
    if (skipAttributes.includes(name)) continue;
    if (name === 'metadata' && Path('commit.__serialize__').get(val)) {
      exported[name] = { ...val, commit: getExpression(name + '.commit', val.commit, subopts) };
      continue;
    }
    if (['borderColor', 'borderWidth', 'borderStyle'].includes(name)) {
      exported[name] = serializeNestedProp(name, val, subopts);
      continue;
    }
    if (name === 'borderRadius') {
      exported[name] = serializeNestedProp(name, val, subopts, ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']);
      continue;
    }
    if (val && val.isMorph) {
      exported[name] = serializeSpec(val, {
        ...subopts,
        path: path ? path + '.' + name : name
      });
      continue;
    }
    if (val && val.__serialize__) {
      if (styleProto && styleProto[name] !== undefined &&
          getExpression(name, val, { ...subopts, asExpression: false }) ===
          getExpression(name, valueTransform(name, styleProto[name]), { ...subopts, asExpression: false })) continue;
      exported[name] = getExpression(name, val, subopts);
      continue;
    }
    if (Array.isArray(val)) {
      // check if each array member is seralizable
      const serializedArray = getArrayExpression(name, val, path, subopts);
      if (styleProto) {
        const r = (k, v) => k === '_rev' ? undefined : v;
        const other = JSON.stringify(getArrayExpression(name, styleProto[name], path, subopts), r);
        if (JSON.stringify(serializedArray, r) === other) continue;
      }
      exported[name] = serializedArray;
      continue;
    }
    if (val && !obj.isString(val) && !obj.isNumber(val) &&
         properties.allOwnPropertiesOrFunctions(val).length > 0) {
      for (const prop in val) {
        if (val[prop] && val[prop].isMorph) {
          val[prop] = serializeSpec(val[prop], {
            ...subopts,
            path: path ? path + '.' + name + '.' + prop : name + '.' + prop
          });
        }
      }
    }
    exported[name] = val;
  }

  if (morph.isText) {
    delete exported.textString;

    if (morph.fixedWidth && morph.fixedHeight) {
      // do nothing
    } else if (morph.fixedWidth) {
      exported.width = exported.extent.x;
      delete exported.extent;
    } else if (morph.fixedHeight) {
      exported.height = exported.extent.y;
      delete exported.extent;
    } else {
      delete exported.extent; // just ignore the extent completely
    }
  }

  if (!asExpression) exported._id = morph._id;
  // this.exportToJSON()
  if (keepConnections && root) {
    /*
       Right now we can only reconstruct connections which are between morphs
       or objects which are directly referenced by a morph. Other ones are skipped.
     */
    const connectionExpressions = [];
    for (const conn of connections) {
      const {
        sourceAttrName, targetMethodName, sourceObj, targetObj,
        updaterString, converterString, garbageCollect
      } = conn;
      const pathToSource = objToPath.get(sourceObj);
      const pathToTarget = objToPath.get(targetObj);
      if (typeof pathToSource === 'string' && typeof pathToTarget === 'string') {
        connectionExpressions.push({
          pathToSource,
          pathToTarget,
          garbageCollect,
          updaterString,
          converterString,
          sourceAttrName,
          targetMethodName,
          varMapping: {
            properties
          }
        });
        continue;
      }
    }
    if (!asExpression) exported.__connections__ = connectionExpressions;
  }

  if (dropMorphsWithNameOnly && !root &&
      (exposeMasterRefs || morph.master !== masterInScope) &&
      arr.isSubset(Object.keys(exported), ['type', 'name'])) {
    return null;
  }
  if (onlyInclude && !onlyInclude.includes(morph)) {
    return null;
  }

  if (keepFunctions) {
    Object.keys(morph).forEach(name =>
      typeof morph[name] === 'function' && !morph[name].isConnectionWrapper && (exported[name] = morph[name]));
    if (asExpression) {
      exported.type = getExpression('type', morph.constructor, subopts);
    } else {
      exported.type = morph.constructor.name; // not JSON!
    }
  } else {
    exported.type = getSerializableClassMeta(morph);
  }

  if (exposeMasterRefs) {
    exported.type = getExpression('type', morph.constructor, subopts);
  }

  if (getClassName(morph) === 'Morph' || skipAttributes.includes('type')) {
    delete exported.type;
  }

  if (asExpression) {
    let __expr__, bindings;
    if (root && (!exposeMasterRefs || !morph.master)) {
      // replace the nestedExpressions after stringification
      __expr__ = `morph(${obj.inspect(exported, {
        keySorter: (a, b) => {
          if (a === 'name' || a === 'type') return -1;
          if (a === 'submorphs') return 1;
          else return 0;
        }
      })})`;
      bindings = {
        'lively.morphic': ['morph']
      };
    } else if (exposeMasterRefs && morph.master) {
      const { exportedName: masterComponentName, moduleId: modulePath, path } = morph.master.parent[Symbol.for('lively-module-meta')];
      // right now still no good way to reconcile the modelView props
      // awlays drop morphs with only names here, since those are copied over by
      // the part already
      if (exported) {
        __expr__ = obj.inspect(obj.dissoc(exported, ['type']), {
          keySorter: (a, b) => {
            if (a === 'name' || a === 'type' || a === 'tooltip') return -1;
            else return 0;
          }
        });
        if (path.length === 0) {
          __expr__ = `part(${masterComponentName}, ${__expr__})`;
        }
      }
      bindings = {
        [modulePath]: [masterComponentName],
        'lively.morphic': ['part']
      };
    }
    if (__expr__) {
      for (const exprId in nestedExpressions) {
        __expr__ = __expr__.replace('\"' + exprId + '\"', nestedExpressions[exprId].__expr__);
        Object.entries(nestedExpressions[exprId].bindings || {}).forEach(([binding, imports]) => {
          if (bindings[binding]) { bindings[binding] = arr.uniq([...bindings[binding], ...imports]); } else bindings[binding] = imports;
        });
      }
      if (exposeMasterRefs && morph.master && !root) {
        const exprId = string.newUUID();
        nestedExpressions[exprId] = { __expr__, bindings };
        return exprId;
      }
      return { __expr__, bindings };
    }
  }

  if (obj.isEmpty(exported)) return null;

  if (root) exported.__refs__ = objRefs;

  return exported;
}
