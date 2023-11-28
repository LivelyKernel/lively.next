import { string, arr, Closure, obj } from 'lively.lang';
import { stringifyFunctionWithoutToplevelRecorder } from 'lively.source-transform';
import ExpressionSerializer from 'lively.serializer2/plugins/expression-serializer.js';

export class AttributeConnection {
  constructor (source, sourceProp, target, targetProp, spec) {
    this.init(source, sourceProp, target, targetProp, spec);
  }

  init (source, sourceProp, target, targetProp, spec) {
    this.doNotSerialize = ['isActive', 'converter', 'updater'];
    this.sourceObj = source;
    this.sourceAttrName = sourceProp;
    this.targetObj = target;
    this.targetMethodName = targetProp;
    this.varMapping = { source, target };

    spec = {
      removeAfterUpdate: false,
      forceAttributeConnection: false,
      garbageCollect: false,
      signalOnAssignment: true,
      override: false,
      ...spec
    };

    if (spec.removeAfterUpdate) { this.removeAfterUpdate = true; }
    if (spec.forceAttributeConnection) { this.forceAttributeConnection = true; }
    if (typeof spec.garbageCollect === 'boolean') { this.garbageCollect = spec.garbageCollect; }
    if (typeof spec.signalOnAssignment === 'boolean') { this.signalOnAssignment = spec.signalOnAssignment; }

    // when converter function references objects from its environment
    // we can't serialize it. To fail as early as possible we will
    // serialize the converter / updater already in the setters
    if (spec.converter) { this.setConverter(spec.converter); }
    if (spec.updater) { this.setUpdater(spec.updater); }
    if (spec.varMapping) { this.varMapping = Object.assign(spec.varMapping, this.varMapping); }

    if (spec.isEpiConnection) this._isEpiConnection = true;

    this.override = spec.override;

    // ensure that spec is valid
    this.getSpec();

    return this;
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    delete this.varMapping._rev; // unnecessary left-over from serializer

    // if only source and target are set in the varMapping, we don't need to serialize it,
    // since we already serialize those in this.sourceObj and this.targetObj
    if (arr.equals(Object.keys(this.varMapping), ['source', 'target'])) {
      delete snapshot.props.varMapping;
      return;
    }

    addFn('varMapping', this._getSerializableVarMapping());
  }

  __after_deserialize__ (snapshot, objRef) {
    // since we usually don't serialize source and target of varMapping, set it here
    if (!this.varMapping) {
      this.varMapping = {};
      this.varMapping.source = this.sourceObj;
      this.varMapping.target = this.targetObj;
    }
    this.onSourceAndTargetRestored();
  }

  _getSerializableVarMapping () {
    const varMappingCopy = { ...this.varMapping };
    for (const varName of Object.keys(varMappingCopy)) {
      try {
        if (obj.isFunction(varMappingCopy[varName])) {
          varMappingCopy[varName] = new ExpressionSerializer()
            .getExpressionForFunction(varMappingCopy[varName]);
        }
      } catch (err) {
        throw new Error(`Cannot be serialized due to lack of module information: ${varName} in ${this}`);
      }
    }
    return varMappingCopy;
  }

  onSourceAndTargetRestored () {
    if (this.sourceObj && this.targetObj) { this.connect(); }
  }

  copy (copier) {
    return AttributeConnection.fromLiteral(this.toLiteral(), copier);
  }

  fixInstanceAfterCopyingFromSite (name, ref, index) {
    // alert("removed connection: "  + this)
    this.disconnect();
  }

  clone () {
    // rk 2012-10-09: What is the reason to have clone AND copy?!
    const con = new this.constructor(
      this.getSourceObj(), this.getSourceAttrName(),
      this.getTargetObj(), this.getTargetMethodName(),
      this.getSpec());
    if (this.dependedBy) con.dependedBy = this.dependedBy;
    return con;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  getTargetObj () { return this.targetObj; }
  getSourceObj () { return this.sourceObj; }
  getSourceAttrName () { return this.sourceAttrName; }
  getTargetMethodName () { return this.targetMethodName; }
  getSourceValue () { return this.getSourceObj()[this.getSourceAttrName()]; }
  getPrivateSourceValue () { return this.sourceObj[this.privateAttrName(this.sourceAttrName)]; }

  getConverter () {
    if (!this.converterString) return null;
    if (!this.converter) { this.converter = Closure.fromSource(this.converterString, this.varMapping).recreateFunc(); }
    return this.converter;
  }

  setConverter (funcOrSource) {
    delete this.converter;
    return this.converterString = funcOrSource ? String(funcOrSource) : null;
  }

  getUpdater () {
    if (!this.updaterString) return null;
    if (!this.updater) {
      this.updater = Closure.fromSource(this.updaterString, this.varMapping).recreateFunc();
    }
    return this.updater;
  }

  setUpdater (funcOrSource) {
    delete this.updater;
    return this.updaterString = funcOrSource ? (stringifyFunctionWithoutToplevelRecorder || String)(funcOrSource) : null;
  }

  getSpec () {
    const spec = {};
    if (this.updaterString) spec.updater = this.getUpdater();
    if (this.converterString) spec.converter = this.getConverter();
    if (this.removeAfterUpdate) spec.removeAfterUpdate = true;
    if (this.forceAttributeConnection) spec.forceAttributeConnection = true;
    if (this.hasOwnProperty('garbageCollect')) spec.garbageCollect = this.garbageCollect;
    if (this.hasOwnProperty('signalOnAssignment')) spec.signalOnAssignment = this.signalOnAssignment;
    spec.override = !!this.override;
    return spec;
  }

  resetSpec () {
    delete this.garbageCollect;
    delete this.signalOnAssignment;
    delete this.removeAfterUpdate;
    delete this.forceAttributeConnection;
    delete this.converter;
    delete this.converterString;
    delete this.updater;
    delete this.updaterString;
  }

  privateAttrName (attrName) { return '$$' + attrName; }

  deactivate () { this.isActive = true; }

  activate () { delete this.isActive; }

  connect () {
    const existing = this.getExistingConnection();
    if (existing !== this) {
      // when existing == null just add new connection when
      // existing === this then connect was called twice or we are in
      // deserialization. Just do nothing then.
      existing && existing.disconnect();
      this.addAttributeConnection();
    }

    // Check for existing getters that might be there and not belong to
    // lively.bindings We deal with them in addSourceObjGetterAndSetter()
    const { sourceObj, sourceAttrName, forceAttributeConnection } = this;
    const existingSetter = sourceObj.__lookupSetter__(sourceAttrName);
    const existingGetter = sourceObj.__lookupGetter__(sourceAttrName);

    // Check if a method is the source. We check both the value behind
    // sourceAttrName and $$sourceAttrName because when deserializing
    // scripts those get currently stored in $$sourceAttrName (for
    // non-scripts it doesn't matter since those methods should be in the
    // prototype chain)
    const methodOrValue = !existingSetter && !existingGetter &&
      (this.getSourceValue() || this.getPrivateSourceValue());

    // method connect... FIXME refactoring into own class!
    if (typeof methodOrValue === 'function' && !forceAttributeConnection) {
      if (!methodOrValue.isWrapped) {
        this.addConnectionWrapper(sourceObj, sourceAttrName, methodOrValue);
      }
    } else { // attribute connect
      this.addSourceObjGetterAndSetter(existingGetter, existingSetter);
    }

    return this;
  }

  disconnect () {
    const { sourceObj } = this;
    if (!sourceObj || !sourceObj.attributeConnections) { return this.removeSourceObjGetterAndSetter(); }

    sourceObj.attributeConnections = sourceObj.attributeConnections.filter(con =>
      !this.isSimilarConnection(con));
    const connectionsWithSameSourceAttr = sourceObj.attributeConnections.filter(con =>
      this.getSourceAttrName() === con.getSourceAttrName());
    if (sourceObj.attributeConnections.length === 0) { delete sourceObj.attributeConnections; }
    if (connectionsWithSameSourceAttr.length === 0) { this.removeSourceObjGetterAndSetter(); }

    return null;
  }

  update (newValue, oldValue) {
    // This method is optimized for Safari and Chrome.
    // See tests.BindingTests.BindingsProfiler
    // The following requirements exists:
    // - Complete Customization of control (how often, if at all, binding
    //   should be activated, parameters passed, delay,... )
    // - run converter with oldValue and newValue
    // - when updater is existing run converter only if update is proceeded
    // - bind is slow
    // - arguments is slow when it's items are accessed or it's converted
    //   using arr.from. Note 2014-02-10: We currently need to modify the
    //   argument array for allowing conversion.

    if (this.isActive/* this.isRecursivelyActivated() */) return null;

    const connection = this;
    const updater = this.getUpdater();
    const converter = this.getConverter();
    const target = this.targetObj;
    const propName = this.targetMethodName;

    if (!target || !propName) {
      const msg = 'Cannot update ' + this.toString(newValue) +
          ' because of no target (' +
          target + ') or targetProp (' + propName + ') ';
      if (this.isWeakConnection) { this.disconnect(); }
      console.error(msg);
      return null;
    }

    const targetMethod = target[propName];
    const callOrSetTarget = function (arg1/* newValue */, arg2/* oldValue */, arg3, arg4, arg5, arg6) {
      // use a function and not a method to capture this in self and so
      // that no bind is necessary and oldValue is accessible. Note that
      // when updater calls this method arguments can be more than just
      // the new value
      const args = [arg1, arg2, arg3, arg4, arg5, arg6];
      if (converter) {
        newValue = converter.call(connection, arg1, arg2);
        arg1 = args[0] = newValue;
      }
      const result = (typeof targetMethod === 'function')
        ? targetMethod.apply(target, args)
        : target[propName] = arg1;
      if (connection.removeAfterUpdate) connection.disconnect();
      return result;
    };

    try {
      this.isActive = true;
      return updater
        ? updater.call(this, callOrSetTarget, newValue, oldValue)
        : callOrSetTarget(newValue, oldValue);
    } catch (e) {
      const world = (this.sourceObj && typeof this.sourceObj.world === 'function' && this.sourceObj.world()) ||
               (this.targetObj && typeof this.targetObj.world === 'function' && this.targetObj.world());
      if (world) {
        world.logError(e, 'AttributeConnection>>update: ');
      } else {
        console.error('Error when trying to update ' + this + ' with value ' +
                     newValue + ':\n' + e + '\n' + e.stack);
      }
    } finally { delete this.isActive; }

    return null;
  }

  addSourceObjGetterAndSetter (existingGetter, existingSetter) {
    if ((existingGetter && existingGetter.isAttributeConnectionGetter) ||
     (existingSetter && existingSetter.isAttributeConnectionSetter)) { return; }

    const { sourceObj, sourceAttrName } = this;
    const newAttrName = this.privateAttrName(sourceAttrName);

    if (sourceObj[newAttrName]) {
      console.warn('newAttrName ' + newAttrName + ' already exists.' +
             'Are there already other connections?');
    }

    // add new attr to the serialization ignore list
    if (!sourceObj.hasOwnProperty('doNotSerialize')) sourceObj.doNotSerialize = [];
    arr.pushIfNotIncluded(sourceObj.doNotSerialize, newAttrName);

    if (!sourceObj.hasOwnProperty('doNotCopyProperties')) sourceObj.doNotCopyProperties = [];
    arr.pushIfNotIncluded(sourceObj.doNotCopyProperties, newAttrName);

    if (existingGetter) {
      // check if getter is defined on instance or on prototype
      if (!sourceObj.hasOwnProperty(sourceAttrName)) {
        sourceObj.__defineGetter__(newAttrName, () => {
          return sourceObj.constructor.prototype.__lookupGetter__(sourceAttrName).bind(sourceObj)();
        });
      } else {
        sourceObj.__defineGetter__(newAttrName, existingGetter);
      }
    }
    if (existingSetter) {
      if (!sourceObj.hasOwnProperty(sourceAttrName)) {
        sourceObj.__defineSetter__(newAttrName, (newVal) => {
          sourceObj.constructor.prototype.__lookupSetter__(sourceAttrName).bind(sourceObj)(newVal);
        });
      } else {
        sourceObj.__defineSetter__(newAttrName, existingSetter);
      }
    }

    // assign old value to new slot
    if (!existingGetter && !existingSetter && sourceObj.hasOwnProperty(sourceAttrName)) { sourceObj[newAttrName] = sourceObj[sourceAttrName]; }

    sourceObj.__defineSetter__(sourceAttrName, (newVal) => {
      const oldVal = sourceObj[newAttrName];
      sourceObj[newAttrName] = newVal;
      if (sourceObj.attributeConnections === undefined) {
        console.error('Sth wrong with sourceObj, has no attributeConnections');
        return null;
      }
      sourceObj.attributeConnections.forEach((c) => {
        if (c && c.getSourceAttrName() === sourceAttrName && c.signalOnAssignment) { c.update(newVal, oldVal); }
      });
      return newVal;
    });
    sourceObj.__lookupSetter__(sourceAttrName).isAttributeConnectionSetter = true;

    sourceObj.__defineGetter__(sourceAttrName, () => sourceObj[newAttrName]);
    sourceObj.__lookupGetter__(sourceAttrName).isAttributeConnectionGetter = true;
  }

  addConnectionWrapper (sourceObj, methodName, origMethod) {
    if (typeof origMethod !== 'function') {
      throw new Error('addConnectionWrapper didnt get a method to wrap');
    }

    let getOriginal, isOwnProperty;

    // save so that it can be restored
    if (isOwnProperty = sourceObj.hasOwnProperty(methodName)) {
      sourceObj[this.privateAttrName(methodName)] = origMethod;
      getOriginal = () => origMethod;
    } else {
      getOriginal = () => Object.getPrototypeOf(sourceObj)[methodName];
    }
    sourceObj[methodName] = function connectionWrapper () {
      if (this.attributeConnections === undefined) { throw new Error('[lively.bindings] Something is wrong with connection source object, it has no attributeConnections'); }
      const conns = this.attributeConnections.filter(c => c.getSourceAttrName() === methodName);
      const overridingConnection = conns.find(c => !!c.hasOverride);
      let result;
      if (overridingConnection) {
        result = overridingConnection.targetObj[overridingConnection.targetMethodName]((...args) =>
          this[methodName].originalFunction.apply(this, args), ...arguments
        );
        // result = overridingConnection.override((args) => , arguments);
      } else {
        result = this[methodName].originalFunction.apply(this, arguments);
      } // make it an option to block the existing function
      for (let i = 0; i < conns.length; i++) {
        if (conns[i] === overridingConnection) continue;
        conns[i].update(arguments[0]);
      }
      return result;
    };

    sourceObj[methodName].isOwnProperty = isOwnProperty;
    sourceObj[methodName].isWrapped = true;
    sourceObj[methodName].isConnectionWrapper = true;
    Object.defineProperty(sourceObj[methodName], 'originalFunction', {
      get: getOriginal
    });
    sourceObj[methodName].toString = () => `<Wrapped ${getOriginal()}>`;
  }

  removeSourceObjGetterAndSetter () {
    // delete the getter and setter and the slot were the real value was stored
    // assign the real value to the old slot
    const realAttrName = this.sourceAttrName;
    const helperAttrName = this.privateAttrName(realAttrName);
    const srcObj = this.sourceObj;

    if (!srcObj) return;

    if (srcObj.__lookupGetter__(realAttrName)) {
      delete srcObj[realAttrName];
      if (srcObj.hasOwnProperty(helperAttrName)) {
        try { srcObj[realAttrName] = srcObj[helperAttrName]; } catch (err) {}
        delete srcObj[helperAttrName];
      }
    } else if (srcObj[realAttrName] && srcObj[realAttrName].isConnectionWrapper) {
      const wrapper = srcObj[realAttrName];
      delete srcObj[realAttrName];
      if (!srcObj[realAttrName]) { // only restore for scripts, non-scripts are restored via prototype chain
        srcObj[realAttrName] = wrapper.originalFunction;
      }
    }

    if (srcObj.doNotSerialize && srcObj.doNotSerialize.includes(helperAttrName)) {
      srcObj.doNotSerialize = arr.without(srcObj.doNotSerialize, helperAttrName);
      if (srcObj.doNotSerialize.length === 0) delete srcObj.doNotSerialize;
    }

    if (srcObj.doNotCopyProperties && srcObj.doNotCopyProperties.includes(helperAttrName)) {
      srcObj.doNotCopyProperties = arr.without(srcObj.doNotCopyProperties, helperAttrName);
      if (srcObj.doNotCopyProperties.length === 0) delete srcObj.doNotCopyProperties;
    }
  }

  addAttributeConnection () {
    if (!this.sourceObj.attributeConnections) { this.sourceObj.attributeConnections = []; }
    this.sourceObj.attributeConnections.push(this);
  }

  getExistingConnection () {
    const conns = this.sourceObj && this.sourceObj.attributeConnections;
    if (!conns) return null;
    for (let i = 0, len = conns.length; i < len; i++) {
      if (this.isSimilarConnection(conns[i])) return conns[i];
    }
    return null;
  }

  isRecursivelyActivated () {
    // is this enough? Maybe use Stack?
    return this.isActive;
  }

  isSimilarConnection (other) {
    if (!other || other.constructor !== this.constructor) return false;
    return this.sourceObj === other.sourceObj &&
        this.sourceAttrName === other.sourceAttrName &&
        this.targetObj === other.targetObj &&
        this.targetMethodName === other.targetMethodName;
  }

  get hasOverride () {
    return this.override;
  }

  toString (optValue) {
    try {
      return string.format(
        'AttributeConnection(%s.%s %s %s.%s)',
        this.getSourceObj(),
        this.getSourceAttrName(),
        optValue ? ('-->' + String(optValue) + '-->') : '-->',
        this.getTargetObj(),
        this.getTargetMethodName());
    } catch (e) { return '<Error in AttributeConnection>>toString>'; }
  }
}

function connect (sourceObj, attrName, targetObj, targetMethodName, specOrConverter) {
  // 1: is it a function connection? targetMethodName => "call"
  if (typeof targetObj === 'function' &&
      (typeof targetMethodName === 'undefined' ||
          typeof targetMethodName === 'object')) {
    specOrConverter = targetMethodName;
    targetMethodName = 'call';
    // make function.call work, passing "null" as this
    if (!specOrConverter) specOrConverter = {};
    if (!specOrConverter.updater) specOrConverter.updater = ($upd, val) => $upd(null, val);
  }

  // 2: determine what kind of connection to create. Default is
  //  AttributeConnection but source.connections/
  //  source.getConnectionPoints can specify different settings
  const connectionPoints = (sourceObj.getConnectionPoints && sourceObj.getConnectionPoints()) ||
                         (sourceObj.connections);
  const connectionPoint = connectionPoints && connectionPoints[attrName];
  const klass = (connectionPoint && connectionPoint.map &&
               lively.morphic && lively.morphic.GeometryConnection) ||
       (connectionPoint && connectionPoint.connectionClassType &&
           lively.Class.forName(connectionPoint.connectionClassType)) ||
       AttributeConnection; let spec;

  // 3: connection settings: converter/updater/...
  if (typeof specOrConverter === 'function') {
    console.warn('Directly passing a converter function to connect() ' +
               'is deprecated! Use spec object instead!');
    spec = { converter: specOrConverter };
  } else spec = specOrConverter;

  if (connectionPoint) spec = obj.merge(connectionPoint, spec);

  // 4: does a similar connection exist? Yes: update it with new specs,
  //  no: create new connection
  const connection = new klass(sourceObj, attrName, targetObj, targetMethodName, spec);
  const existing = connection.getExistingConnection();
  if (existing) {
    existing.resetSpec();
    existing.init(sourceObj, attrName, targetObj, targetMethodName, spec);
    return existing;
  }

  const result = connection.connect();

  // 5: notify source object if it has a #onConnect method
  if (typeof sourceObj.onConnect === 'function') { sourceObj.onConnect(attrName, targetObj, targetMethodName); }

  // 6: If wanted updated the connection right now
  if (connectionPoint && connectionPoint.updateOnConnect) { connection.update(sourceObj[attrName]); }
  return result;
}

function epiConnect (sourceObj, attrName, targetObj, targetMethodName, specOrConverter) {
  const conn = connect(sourceObj, attrName, targetObj, targetMethodName, specOrConverter);
  conn._isEpiConnection = true;
  return conn;
}

function disconnect (sourceObj, attrName, targetObj, targetMethodName) {
  // is it a function connection? targetMethodName => "call"
  if (typeof targetObj === 'function' &&
      (typeof targetMethodName === 'undefined' ||
          typeof targetMethodName === 'object')) {
    targetMethodName = 'call';
  }

  if (!sourceObj.attributeConnections) return;

  for (const con of sourceObj.attributeConnections.slice()) {
    if (con.getSourceAttrName() === attrName &&
        con.getTargetObj() === targetObj &&
        con.getTargetMethodName() === targetMethodName) { con.disconnect(); }
  }

  if (typeof sourceObj.onDisconnect === 'function') { sourceObj.onDisconnect(attrName, targetObj, targetMethodName); }
}

function disconnectAll (sourceObj) {
  let con;
  while (sourceObj.attributeConnections && (con = sourceObj.attributeConnections[0])) { con.disconnect(); }
}

function once (sourceObj, attrName, targetObj, targetMethodName, spec) {
  // function connection:
  if (typeof targetObj === 'function' &&
      (typeof targetMethodName === 'undefined' ||
          typeof targetMethodName === 'object')) {
    spec = targetMethodName;
    targetMethodName = 'call';
    spec = spec || {};
    // make function.call work, passing "null" as this
    if (!spec) spec = {};
    if (!spec.updater) spec.updater = ($upd, val) => $upd(null, val);
  } else spec = spec || {};
  spec = spec || {};
  spec.removeAfterUpdate = true;
  return connect(sourceObj, attrName, targetObj, targetMethodName, spec);
}

function signal (sourceObj, attrName, newVal) {
  const connections = sourceObj.attributeConnections;
  if (!connections) return;
  const oldVal = sourceObj[attrName];
  for (let i = 0, len = connections.length; i < len; i++) {
    const c = connections[i];
    if (c.getSourceAttrName() === attrName) c.update(newVal, oldVal);
  }
}

export function callWhenNotNull (sourceObj, sourceProp, targetObj, targetSelector) {
  // ensure that sourceObj[sourceProp] is not null, then run targetObj[targetProp]()
  if (sourceObj[sourceProp]) {
    targetObj[targetSelector](sourceObj[sourceProp]);
  } else {
    connect(
      sourceObj, sourceProp, targetObj, targetSelector,
      { removeAfterUpdate: true });
  }
}

export function callWhenPathNotNull (source, path, target, targetProp) {
  let helper = {
    key: path.pop(),
    whenDefined (context) {
      callWhenNotNull(context, this.key, target, targetProp);
    }
  };

  while (path.length > 0) {
    helper = {
      key: path.pop(),
      next: helper,
      whenDefined (context) {
        callWhenNotNull(context, this.key, this.next, 'whenDefined');
      }
    };
  }

  helper.whenDefined(source);
}

function noUpdate (noUpdateSpec, func) {
  let globalNoUpdate = false; let result;
  if (!func && typeof noUpdateSpec === 'function') {
    func = noUpdateSpec; globalNoUpdate = true;
  }
  if (globalNoUpdate) { // rather a hack for now
    const proto = AttributeConnection.prototype;
    if (!proto.isActive) proto.isActive = 0;
    proto.isActive++;
    try { result = func(); } finally {
      proto.isActive--;
      if (proto.isActive <= 0) delete proto.isActive;
    }
  } else {
    const obj = noUpdateSpec.sourceObj;
    const attr = noUpdateSpec.sourceAttribute;
    const targetObj = noUpdateSpec.targetObj;
    const targetAttr = noUpdateSpec.targetAttribute;
    const filter = targetObj && targetAttr
      ? ea => ea.getSourceAttrName() === attr &&
                   targetObj === ea.getTargetObj() &&
                   targetAttr === ea.getTargetMethodName()
      : ea => ea.getSourceAttrName() === attr;
    const conns = obj.attributeConnections && obj.attributeConnections.filter(filter);
    conns && arr.invoke(conns, 'deactivate');
    try { result = func(); } finally { conns && arr.invoke(conns, 'activate'); }
  }
  return result;
}

export { connect, epiConnect, disconnect, disconnectAll, once, signal, noUpdate };
