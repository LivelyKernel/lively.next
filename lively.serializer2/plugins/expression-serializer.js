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

function handleOverriddenMaster (masterPolicy, opts) {
  const { asExpression, nestedExpressions } = opts;
  if (!asExpression) return; // ignore overridden master if not serializing as expression
  let expr = ''; let masterComponentName; let modulePath; let bindings = {};
  const { _autoMaster, _hoverMaster, _clickMaster } = masterPolicy;
  for (let [name, policy] of [['auto', _autoMaster], ['hover', _hoverMaster], ['click', _clickMaster]]) {
    if (!policy) continue;
    if (name === 'auto' && _autoMaster === masterPolicy.parent) continue;
    ({ exportedName: masterComponentName, moduleId: modulePath } = policy[Symbol.for('lively-module-meta')]);
    if (expr) expr += ', ';
    expr += name + ': ' + masterComponentName;
    bindings[modulePath]?.push(masterComponentName) || (bindings[modulePath] = [masterComponentName]);
  }
  if (!expr) return;
  const exprId = string.newUUID();
  nestedExpressions[exprId] = { __expr__: `{ ${expr} }`, bindings };
  return exprId;
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
  const { nestedExpressions, root, dropMorphsWithNameOnly, exposeMasterRefs } = subopts;
  return list.map((v, i) => {
    if (v && v.isMorph) {
      let val = serializeSpec(v, { // eslint-disable-line no-use-before-define
        ...subopts,
        dropMorphsWithNameOnly: !!v.master && exposeMasterRefs || dropMorphsWithNameOnly,
        root: exposeMasterRefs || root,
        path: v.master && exposeMasterRefs ? '' : (path ? path + '.' + name + '.' + i : name + '.' + i)
      });
      if (val.__expr__) {
        // insert the expression as nested
        const exprId = string.newUUID();
        nestedExpressions[exprId] = val;
        val = exprId;
      }
      return val;
    }
    if (v && v.__serialize__) {
      return getExpression(name + '.' + i, v, subopts);
    }
    return v;
  });
}

function getStyleProto (morph, opts) {
  let styleProto;
  const { masterInScope } = opts;
  if (masterInScope?.managesMorph(morph.name) || morph === masterInScope?.targetMorph) {
    let policy = masterInScope;
    if (!policy.targetMorph.isComponent) policy = masterInScope.parent;
    styleProto = policy?.synthesizeSubSpec(morph === masterInScope.targetMorph ? null : morph.name, null, false);
    while (styleProto?.isPolicyApplicator) {
      styleProto = styleProto.synthesizeSubSpec(null, null, false);
    }
  }
  return styleProto;
}

/**
 * Text morphs usually do not return text and attributes as a style properties,
 * so we process them separately in this routine.
 * @param { Morph } aMorph - A label or text morph to synthesize the text and attributes for.
 * @param { object } exported - The spec to be exported.
 * @param { object } styleProto
 * @param { string } path
 * @param { StylePolicy } masterInScope
 * @param { object } opts
 */
function handleTextAndAttributes (aMorph, exported, styleProto, path, masterInScope, opts) {
  const isText = aMorph.isText || aMorph.isLabel; // FIXME: remove once new text morph implementation live
  const { exposeMasterRefs, asExpression } = opts;
  if (isText && aMorph.textString !== '') {
    if (styleProto?.textString !== aMorph.textString &&
        !obj.equals(styleProto?.textAndAttributes, aMorph.textAndAttributes)) {
      exported.textAndAttributes = aMorph.textAndAttributes.map((ea, i) => {
        return ea && ea.isMorph
          ? serializeSpec(ea, { // eslint-disable-line no-use-before-define
            ...opts,
            path: path ? path + '.textAndAttributes.' + i : 'textAndAttributes.' + i
          })
          : ea;
      });
    }
    if (exposeMasterRefs && masterInScope?.managesMorph(aMorph.name)) {
      if (styleProto.textString === exported.textString) { delete exported.textString; }
      if (styleProto.textAndAttributes && arr.equals(styleProto.textAndAttributes, exported.textAndAttributes)) {
        delete exported.textAndAttributes;
      }
    }
    // all of the above work is then discarded basically...
    if (asExpression && exported.textAndAttributes) {
      exported.textAndAttributes = getArrayExpression('textAndAttributes', aMorph.textAndAttributes, path, opts);
    }
  }

  if (aMorph.isText) {
    delete exported.textString;

    if (aMorph.fixedWidth && aMorph.fixedHeight || !exported.extent) {
      // do nothing
    } else if (aMorph.fixedWidth) {
      exported.width = exported.extent.x;
      delete exported.extent;
    } else if (aMorph.fixedHeight) {
      exported.height = exported.extent.y;
      delete exported.extent;
    } else {
      delete exported.extent; // just ignore the extent completely
    }
  }
}

function traverseSubmorphs (morph, exported, path, masterInScope, subopts) {
  if (morph.submorphs && morph.submorphs.length > 0) {
    const { nestedExpressions, exposeMasterRefs, dropMorphsWithNameOnly, masterInScope, uncollapseHierarchy } = subopts;
    const embeddedMorphs = morph.isText ? morph.textAndAttributes.filter(m => m?.isMorph) : [];
    const listedSubmorphs = arr.withoutAll(morph.submorphs, embeddedMorphs);
    exported.submorphs = arr.compact(listedSubmorphs.map((ea, i) => {
      let val = serializeSpec(ea, { // eslint-disable-line no-use-before-define
        ...subopts,
        dropMorphsWithNameOnly: !uncollapseHierarchy && (!!ea.master && exposeMasterRefs || dropMorphsWithNameOnly || masterInScope?.managesMorph(ea.name)),
        path: ea.master && exposeMasterRefs ? '' : (path ? path + '.submorphs.' + i : 'submorphs.' + i)
      });
      if (val?.__expr__) {
        const exprId = string.newUUID();
        nestedExpressions[exprId] = val;
        val = exprId;
      }
      return val;
    }));
    if (exported.submorphs.length === 0) delete exported.submorphs;
  }
}

function isCustomObject (val) {
  return val && !obj.isString(val) && !obj.isNumber(val) &&
         properties.allOwnPropertiesOrFunctions(val).length > 0;
}

function handleCustomObject (name, val, path, subopts) {
  for (const prop in val) {
    if (val[prop] && val[prop].isMorph) {
      val[prop] = serializeSpec(val[prop], { // eslint-disable-line no-use-before-define
        ...subopts,
        path: path ? path + '.' + name + '.' + prop : name + '.' + prop
      });
    }
  }
}

/**
 * Traverses the props returned by the spec() call of a morph and prepares them
 * accordingly (e.g. in case we want to turn the spec into an expression).
 * @param { Morph } morph - The morph we derive the spec from.
 * @param { object } exported - The exported spec.
 * @param { object } [styleProto] - If applicable, a object containing the synthesized style props from a policy for this morph.
 * @param { string } path - The relative path from the root to this morph.
 * @param { StylePolicy } [masterInScope] - If applicable a style policy controlling the scope this morph resides on.
 * @param { object } opts - The options passed to the expression generation.
 */
function handleSpecProps (morph, exported, styleProto, path, masterInScope, opts) {
  const {
    skipAttributes, skipUnchangedFromDefault,
    valueTransform, keepConnections, objToPath
  } = opts;
  const { properties } = morph.propertiesAndPropertySettings();

  for (const name in morph.spec(skipUnchangedFromDefault)) {
    let v = morph[name];
    if (masterInScope && !morph.__only_serialize__.includes(name)) continue;
    if (name === 'textAndAttributes') continue;

    // store away just in case
    const val = valueTransform(name, v);
    if (keepConnections && val && typeof val === 'object' && !Array.isArray(val) && !val.isMorph) {
      objToPath.set(val, path ? path + '.' + name : name);
    }

    let folded;
    if (styleProto && (folded = properties[name].foldable)) {
      let unchanged = true;
      for (let subProp of folded) {
        if (!obj.equals(v[subProp], styleProto[name]?.[subProp] || styleProto[name])) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) continue;
    }
    if (name !== 'name' && styleProto && obj.equals(v, styleProto[name])) continue;
    if (name === 'master') {
      const val = handleOverriddenMaster(morph.master, opts);
      if (val) exported.master = val;
      continue;
    }
    if (name === 'position') {
      if (masterInScope?.isPositionedByLayout(morph)) continue;
      if (morph.owner?.isText && morph.owner.textAndAttributes.includes(morph)) {
        continue;
      }
    }
    if (name === 'extent') {
      // FIXME: This wont work with new Text morphs in label mode.
      if (morph.isLabel) continue;
      if (masterInScope?.isResizedByLayout(morph)) continue;
    }
    if (name === 'submorphs' || name === 'type') continue;
    if (skipAttributes.includes(name)) continue;
    if (name === 'metadata' && Path('commit.__serialize__').get(val)) {
      exported[name] = { ...val, commit: getExpression(name + '.commit', val.commit, opts) };
      continue;
    }
    if (['borderColor', 'borderWidth', 'borderStyle'].includes(name)) {
      exported[name] = serializeNestedProp(name, val, opts);
      continue;
    }
    if (name === 'borderRadius') {
      exported[name] = serializeNestedProp(name, val, opts, ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']);
      continue;
    }
    if (val && val.isMorph) {
      exported[name] = serializeSpec(val, { // eslint-disable-line no-use-before-define
        ...opts,
        path: path ? path + '.' + name : name
      });
      continue;
    }
    if (val && val.__serialize__) {
      if (styleProto && styleProto[name] !== undefined &&
          getExpression(name, val, { ...opts, asExpression: false }) ===
          getExpression(name, valueTransform(name, styleProto[name]), { ...opts, asExpression: false })) continue;
      exported[name] = getExpression(name, val, opts);
      continue;
    }
    if (Array.isArray(val)) {
      // check if each array member is seralizable
      const serializedArray = getArrayExpression(name, val, path, opts);
      if (styleProto) {
        const other = JSON.stringify(getArrayExpression(name, styleProto[name], path, opts));
        if (JSON.stringify(serializedArray) === other) continue;
      }
      exported[name] = serializedArray;
      continue;
    }
    if (isCustomObject(val)) {
      handleCustomObject(name, val, path, opts);
    }
    exported[name] = val;
  }
}

/**
 * Given a morph, extract all the connection information related to the morph
 * and populate the options with that info.
 * @param { Morph } aMorph - The morph to extract the connection info from.
 * @param { string } path - The relative path from the root to this morph.
 * @param { object } opts - The spec generation options.
 */
function gatherConnectionInfo (aMorph, path, opts) {
  const { keepConnections, objToPath, objRefs, connections } = opts;
  if (keepConnections) {
    if (objToPath.has(aMorph)) {
      objRefs.push([path, /* => */ objToPath.get(aMorph)]); // store assignment
      return null;
    }

    objToPath.set(aMorph, path);
    if (aMorph.attributeConnections) {
      connections.push(...aMorph.attributeConnections);
    }
  }
}

/**
 * Attaches connection info to a spec, that can be used to reconstruct
 * connections from a spec, if desired. Right now this approach is limited
 * to non expression exports. Also we can only reconstruct connections which are between morphs
 * or objects which are directly referenced by a morph. Other ones are skipped.
 * @param { object } exported - The spec to add the connection info to.
 * @param { object } opts - Options from the spec generation process.
 */
function insertConnections (exported, opts) {
  const { connections, objToPath, asExpression } = opts;
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

/**
 * Carrys over any function members that are attached to the morph.
 * @param { Morph } aMorph - The morph to extract function members from.
 * @param { object } exported - The spec to populate with the function values.
 */
function handleFunctionMembers (aMorph, exported) {
  Object.keys(aMorph).forEach(name => {
    if (typeof aMorph[name] !== 'function') return;
    if (aMorph[name].isConnectionWrapper) return;
    exported[name] = aMorph[name];
  });
}

/**
 * Properly attaches the type information to the generated spec.
 * @param { Morph } aMorph - The morph we derived the spec from.
 * @param { object } exported - The spec to adjust the type info on.
 * @param { object } opts - Options from the spec generation process.
 */
function handleTypeInfo (aMorph, exported, opts) {
  const { keepFunctions, asExpression, exposeMasterRefs, skipAttributes } = opts;
  if (keepFunctions) {
    if (asExpression) {
      exported.type = getExpression('type', aMorph.constructor, opts);
    } else {
      exported.type = aMorph.constructor.name;
    }
  } else {
    exported.type = getSerializableClassMeta(aMorph);
  }

  if (exposeMasterRefs) {
    exported.type = getExpression('type', aMorph.constructor, opts);
  }

  if (getClassName(aMorph) === 'Morph' || skipAttributes.includes('type')) {
    delete exported.type;
  }
}

/**
 * Converts a morph's spec to a serializable expression.
 * @param { Morph } aMorph - The morph we derived the spec from.
 * @param { object } exported - The spec to convert to an expression.
 * @param { boolean } isRoot - Wether or not we are the root of the entire spec.
 * @param { string } path - The current path to this morph from the root.
 * @param { object } opts - Options from the spec generation process.
 * @returns { object } An expression object if successful.
 */
function asSerializableExpression (aMorph, exported, isRoot, path, masterInScope, opts) {
  const { exposeMasterRefs, nestedExpressions } = opts;
  let __expr__, bindings;
  if (isRoot && (!exposeMasterRefs || !aMorph.master)) {
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
  } else if (exposeMasterRefs) {
    // right now still no good way to reconcile the modelView props
    // awlays drop morphs with only names here, since those are copied over by
    // the part already
    if (exported) {
      bindings = {};
      __expr__ = obj.inspect(obj.dissoc(exported, aMorph.master ? ['type'] : []), {
        keySorter: (a, b) => {
          if (a === 'name' || a === 'type' || a === 'tooltip') return -1;
          else return 0;
        }
      });
      if (aMorph.master) {
        const { exportedName: masterComponentName, moduleId: modulePath } = aMorph.master.parent[Symbol.for('lively-module-meta')];
        if (path.length === 0) {
          __expr__ = `part(${masterComponentName}, ${__expr__})`;
        }
        bindings = {
          [modulePath]: [masterComponentName],
          'lively.morphic': ['part']
        };
      }
      if (!isRoot && masterInScope && !masterInScope.managesMorph(aMorph.name)) {
        __expr__ = `add(${__expr__})`;
        if (bindings['lively.morphic']) {
          bindings['lively.morphic'].push('add');
        } else bindings['lively.morphic'] = ['add'];
      }
    }
  }
  if (__expr__) {
    for (const exprId in nestedExpressions) {
      __expr__ = __expr__.replace('\"' + exprId + '\"', nestedExpressions[exprId].__expr__);
      Object.entries(nestedExpressions[exprId].bindings || {}).forEach(([binding, imports]) => {
        if (bindings[binding]) {
          bindings[binding] = arr.uniq([...bindings[binding], ...imports]);
        } else bindings[binding] = imports;
      });
    }
    if (!isRoot && exposeMasterRefs && aMorph.master) {
      const exprId = string.newUUID();
      nestedExpressions[exprId] = { __expr__, bindings };
      return exprId;
    }
    return { __expr__, bindings };
  }
}

/**
 * Converts a morph to a spec object, or serializable expression.
 * @param { Morph } morph - The morph to convert to a spec.
 * @param { object } opts - Config for the spec generation.
 * @param { boolean } [opts.keepFunctions = true] - If set to true, this will keep any function objects in the spec. Note that this will make the resulting spec more difficult to serialize.
 * @param { string[] } [opts.skipAttributes = []] - An optional list of attribute names to ommit in the spec.
 * @param { string[] } [opts.onlyInclude] - An optional list of names to ONLY include in the spec. If ommitted this flag is ignored.
 * @param { boolean } [opts.keepConnections = true] - Wether or not to carry over the connections inside the morph hierarchy. Note that this is not supported when serializing to an expression as of now.
 * @param { boolean } [opts.skipUnchangedFromDefault = false] - If set to `true` we will skip the properties that are not differing from their respective default values.
 * @param { function } [valueTransform] - A custom value transform that each property key/value pair can be processed by.
 * @param { boolean } [asExpression = false] - If set to true, the resulting spec will be a serializable expression.
 * @returns { object } A spec or object expression.
 */
export function serializeSpec (morph, opts = {}) {
  let {
    keepFunctions = true,
    skipAttributes = [],
    onlyInclude = false,
    keepConnections = true,
    skipUnchangedFromDefault = false,
    valueTransform = (key, val) => val,
    asExpression = false,
    // this is needed in case we generate a component definition or part derivation
    // FIXME: can we combine this into one single flag?
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
    masterInScope = morph.master,
    uncollapseHierarchy = false
  } = opts;
  const subopts = {
    keepFunctions,
    skipAttributes,
    onlyInclude,
    keepConnections,
    skipUnchangedFromDefault,
    valueTransform,
    asExpression,
    // component def specific... replace with one flag??
    dropMorphsWithNameOnly,
    exposeMasterRefs,
    skipUnchangedFromMaster,
    // internal
    root: false,
    nestedExpressions,
    connections,
    objRefs,
    objToPath,
    masterInScope: morph.master || masterInScope,
    exprSerializer,
    uncollapseHierarchy
  };

  if (onlyInclude && !onlyInclude.includes(morph)) {
    return null;
  }

  let exported = {};
  const styleProto = skipUnchangedFromMaster && getStyleProto(morph, subopts);

  gatherConnectionInfo(morph, path, subopts);
  traverseSubmorphs(morph, exported, path, masterInScope, subopts); // needs to be done before we handle text attributes
  handleSpecProps(morph, exported, styleProto, path, masterInScope, subopts);
  handleTextAndAttributes(morph, exported, styleProto, path, masterInScope, subopts);

  if (root && keepConnections) {
    insertConnections(exported, subopts);
  }

  if (!root &&
      dropMorphsWithNameOnly &&
      masterInScope?.managesMorph(morph.name) && // can not drop morphs not managed by master
      morph.master !== masterInScope &&
      arr.isSubset(Object.keys(exported), ['type', 'name'])) {
    return null;
  }

  if (keepFunctions) {
    handleFunctionMembers(morph, exported);
  }

  handleTypeInfo(morph, exported, subopts);

  if (asExpression) {
    const exprObj = asSerializableExpression(morph, exported, root, path, masterInScope, subopts);
    if (exprObj) return exprObj;
  }

  if (obj.isEmpty(exported)) return null;

  if (root) exported.__refs__ = objRefs;
  if (!asExpression) exported._id = morph._id;

  return exported;
}
