import { string, arr, Closure } from "lively.lang";

export { connect, disconnect, disconnectAll, once, signal, noUpdate }

class AttributeConnection {

  constructor(source, sourceProp, target, targetProp, spec) {
    this.init(source, sourceProp, target, targetProp, spec);
  }

  init(source, sourceProp, target, targetProp, spec) {
    this.doNotSerialize = ['isActive', 'converter', 'updater'];
    this.sourceObj = source;
    this.sourceAttrName = sourceProp;
    this.targetObj = target;
    this.targetMethodName = targetProp;
    this.varMapping = {source, target};

    spec = {
      removeAfterUpdate: false,
      forceAttributeConnection: false,
      garbageCollect: true,
      signalOnAssignment: true,
      ...spec
    };

    if (spec.removeAfterUpdate)
      this.removeAfterUpdate = true;
    if (spec.forceAttributeConnection)
      this.forceAttributeConnection = true;
    if (typeof spec.garbageCollect === "boolean")
      this.garbageCollect = spec.garbageCollect;
    if (typeof spec.signalOnAssignment === "boolean")
      this.signalOnAssignment = spec.signalOnAssignment

    // when converter function references objects from its environment
    // we can't serialize it. To fail as early as possible we will
    // serialize the converter / updater already in the setters
    if (spec.converter)
      this.setConverter(spec.converter);
    if (spec.updater)
      this.setUpdater(spec.updater);
    if (spec.varMapping)
      this.varMapping = Object.assign(spec.varMapping, this.varMapping);

    return this;
  }

  __after_deserialize__(snapshot, objRef) {
    this.connect();
  }
  
  onSourceAndTargetRestored() {
    if (this.sourceObj && this.targetObj) this.connect();
  }

  copy(copier) {
    return AttributeConnection.fromLiteral(this.toLiteral(), copier);
  }

  fixInstanceAfterCopyingFromSite(name, ref, index) {
    // alert("removed connection: "  + this)
    this.disconnect();
  }

  clone() {
    //rk 2012-10-09: What is the reason to have clone AND copy?!
    var con = new this.constructor(
      this.getSourceObj(), this.getSourceAttrName(),
      this.getTargetObj(), this.getTargetMethodName(),
      this.getSpec());
    if (this.dependedBy) con.dependedBy = this.dependedBy;
    return con;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  getTargetObj() { return this.targetObj }
  getSourceObj() { return this.sourceObj }
  getSourceAttrName() { return this.sourceAttrName }
  getTargetMethodName() { return this.targetMethodName }
  getSourceValue() { return this.getSourceObj()[this.getSourceAttrName()] }
  getPrivateSourceValue() { return this.sourceObj[this.privateAttrName(this.sourceAttrName)] }

  getConverter() {
    if (!this.converterString) return null;
    if (!this.converter)
      this.converter = Closure.fromSource(this.converterString, this.varMapping).recreateFunc();
    return this.converter;
  }

  setConverter(funcOrSource) {
    delete this.converter;
    return this.converterString = funcOrSource ? String(funcOrSource) : null;
  }

  getUpdater() {
    if (!this.updaterString) return null;
    if (!this.updater) {
      this.updater = Closure.fromSource(this.updaterString, this.varMapping).recreateFunc();
    }
    return this.updater;
  }

  setUpdater(funcOrSource) {
    delete this.updater;
    return this.updaterString = funcOrSource ? String(funcOrSource) : null;
  }

  getSpec() {
    var spec = {};
    if (this.updaterString) spec.updater = this.getUpdater();
    if (this.converterString) spec.converter = this.getConverter();
    if (this.removeAfterUpdate) spec.removeAfterUpdate = true;
    if (this.forceAttributeConnection) spec.forceAttributeConnection = true;
    if (this.hasOwnProperty("garbageCollect")) spec.garbageCollect = this.garbageCollect;
    if (this.hasOwnProperty("signalOnAssignment")) spec.signalOnAssignment = this.signalOnAssignment;
    return spec;
  }

  resetSpec() {
    delete this.garbageCollect;
    delete this.signalOnAssignment;
    delete this.removeAfterUpdate;
    delete this.forceAttributeConnection;
    delete this.converter;
    delete this.converterString;
    delete this.updater;
    delete this.updaterString;
  }

  privateAttrName(attrName) { return '$$' + attrName }

  activate() { this.isActive = true }

  deactivate() { delete this.isActive; }

  connect() {
    var existing = this.getExistingConnection()
    if (existing !== this) {
      // when existing == null just add new connection when
      // existing === this then connect was called twice or we are in
      // deserialization. Just do nothing then.
      existing && existing.disconnect();
      this.addAttributeConnection();
    }

    // Check for existing getters that might be there and not belong to
    // lively.bindings We deal with them in addSourceObjGetterAndSetter()
    var existingSetter = this.sourceObj.__lookupSetter__(this.sourceAttrName),
        existingGetter = this.sourceObj.__lookupGetter__(this.sourceAttrName);

    // Check if a method is the source. We check both the value behind
    // sourceAttrName and $$sourceAttrName because when deserializing
    // scripts those get currently stored in $$sourceAttrName (for
    // non-scripts it doesn't matter since those methods should be in the
    // prototype chain)
    var methodOrValue = !existingSetter && !existingGetter &&
      (this.getSourceValue() || this.getPrivateSourceValue());

    // method connect... FIXME refactori into own class!
    if (typeof methodOrValue === "function" && !this.forceAttributeConnection) {
      if (!methodOrValue.isWrapped) {
        this.addConnectionWrapper(this.sourceObj, this.sourceAttrName, methodOrValue);
      }
    } else { // attribute connect
      this.addSourceObjGetterAndSetter(existingGetter, existingSetter);
    }

    return this;
  }

  disconnect() {
    var obj = this.sourceObj;
    if (!obj || !obj.attributeConnections)
      return this.removeSourceObjGetterAndSetter();

    obj.attributeConnections = obj.attributeConnections.filter(con =>
      !this.isSimilarConnection(con));
    var connectionsWithSameSourceAttr = obj.attributeConnections.filter(con =>
      this.getSourceAttrName() == con.getSourceAttrName());
    if (obj.attributeConnections.length == 0)
      delete obj.attributeConnections;
    if (connectionsWithSameSourceAttr.length == 0)
      this.removeSourceObjGetterAndSetter();

    return null;
  }

  update(newValue, oldValue) {
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

    if (this.isActive/*this.isRecursivelyActivated()*/) return null;
    var connection = this, updater = this.getUpdater(), converter = this.getConverter(),
      target = this.targetObj, propName = this.targetMethodName;
    if (!target || !propName) {
      var msg = 'Cannot update ' + this.toString(newValue)
          + ' because of no target ('
          + target + ') or targetProp (' + propName+') ';
      if (this.isWeakConnection) { this.disconnect(); }
      console.error(msg);

      return null;
    }
    var targetMethod = target[propName], callOrSetTarget = function(newValue, oldValue) {
      // use a function and not a method to capture this in self and so
      // that no bind is necessary and oldValue is accessible. Note that
      // when updater calls this method arguments can be more than just
      // the new value
      var args = arr.from(arguments);
      if (converter) {
        newValue = converter.call(connection, newValue, oldValue);
        args[0] = newValue;
      }
      var result = (typeof targetMethod === 'function') ?
        targetMethod.apply(target, args) :
        target[propName] = newValue;
      if (connection.removeAfterUpdate) connection.disconnect();
      return result;
    };

    try {
      this.isActive = true;
      return updater ?
        updater.call(this, callOrSetTarget, newValue, oldValue) :
        callOrSetTarget(newValue, oldValue);
    } catch(e) {
      var world = (this.sourceObj && typeof this.sourceObj.world === "function" && this.sourceObj.world())
               || (this.targetObj && typeof this.targetObj.world === "function" && this.targetObj.world());
      if (world) {
        world.logError(e, 'AttributeConnection>>update: ');
      } else {
        console.error('Error when trying to update ' + this + ' with value '
             + newValue + ':\n' + e + '\n' + e.stack);
      }
    } finally {
      delete this.isActive;
    }

    return null;
  }

  addSourceObjGetterAndSetter(existingGetter, existingSetter) {
    if ((existingGetter && existingGetter.isAttributeConnectionGetter) ||
      (existingSetter && existingSetter.isAttributeConnectionSetter)) {
      return;
    }

    var sourceObj = this.sourceObj,
      sourceAttrName = this.sourceAttrName,
      newAttrName = this.privateAttrName(sourceAttrName);

    if (sourceObj[newAttrName]) {
      console.warn('newAttrName ' + newAttrName + ' already exists.' +
             'Are there already other connections?');
    }

    // add new attr to the serialization ignore list
    if (!sourceObj.hasOwnProperty('doNotSerialize')) sourceObj.doNotSerialize = [];
    arr.pushIfNotIncluded(sourceObj.doNotSerialize, newAttrName);

    if (!sourceObj.hasOwnProperty('doNotCopyProperties')) sourceObj.doNotCopyProperties = [];
    arr.pushIfNotIncluded(sourceObj.doNotCopyProperties, newAttrName);

    if (existingGetter)
      sourceObj.__defineGetter__(newAttrName, existingGetter);
    if (existingSetter)
      sourceObj.__defineSetter__(newAttrName, existingSetter);

    // assign old value to new slot
    if (!existingGetter && !existingSetter && sourceObj.hasOwnProperty(sourceAttrName))
      sourceObj[newAttrName] = sourceObj[sourceAttrName];

    this.sourceObj.__defineSetter__(sourceAttrName, function(newVal) {
      var oldVal = sourceObj[newAttrName];
      sourceObj[newAttrName] = newVal;
      if (sourceObj.attributeConnections === undefined) {
        console.error('Sth wrong with sourceObj, has no attributeConnections');
        return null;
      }
      sourceObj.attributeConnections.forEach(function(c) {
        if (c && c.getSourceAttrName() === sourceAttrName && c.signalOnAssignment)
        c.update(newVal, oldVal);
      });
      return newVal;
    });
    this.sourceObj.__lookupSetter__(sourceAttrName).isAttributeConnectionSetter = true;

    this.sourceObj.__defineGetter__(this.sourceAttrName, function() {
      return sourceObj[newAttrName];
    });
    this.sourceObj.__lookupGetter__(sourceAttrName).isAttributeConnectionGetter = true;
  }

  addConnectionWrapper(sourceObj, methodName, origMethod) {
    if (typeof origMethod !== "function") {
      throw new Error('addConnectionWrapper didnt get a method to wrap');
    }

    // save so that it can be restored
    sourceObj[this.privateAttrName(methodName)] = origMethod;
    sourceObj[methodName] = function connectionWrapper() {
      if (this.attributeConnections === undefined)
          throw new Error('Sth wrong with this, has no attributeConnections')
      var conns = lively.lang.obj.clone(this.attributeConnections),
        result = this[methodName].originalFunction.apply(this, arguments);
      conns.forEach(function(c) {
        if (c.getSourceAttrName() === methodName)
        result = c.update(result);
      });
      return result;
    };

    sourceObj[methodName].isWrapped = true;
    sourceObj[methodName].isConnectionWrapper = true;
    sourceObj[methodName].originalFunction = origMethod; // for getOriginal()
  }

  removeSourceObjGetterAndSetter() {
    // delete the getter and setter and the slot were the real value was stored
    // assign the real value to the old slot
    var realAttrName = this.sourceAttrName,
      helperAttrName = this.privateAttrName(realAttrName),
      srcObj = this.sourceObj;

    if (!srcObj) return;

    if (srcObj.__lookupGetter__(realAttrName)) {
      delete srcObj[realAttrName];
      srcObj[realAttrName] = srcObj[helperAttrName];
      delete srcObj[helperAttrName];
    } else if(srcObj[realAttrName] && srcObj[realAttrName].isConnectionWrapper) {
      srcObj[realAttrName] = srcObj[realAttrName].originalFunction
    }

    if (srcObj.doNotSerialize && srcObj.doNotSerialize.includes(helperAttrName)) {
      srcObj.doNotSerialize = arr.without(srcObj.doNotSerialize, helperAttrName);
      if (srcObj.doNotSerialize.length == 0) delete srcObj.doNotSerialize;
    }

    if (srcObj.doNotCopyProperties && srcObj.doNotCopyProperties.includes(helperAttrName)) {
      srcObj.doNotCopyProperties = arr.without(srcObj.doNotCopyProperties, helperAttrName);
      if (srcObj.doNotCopyProperties.length == 0) delete srcObj.doNotCopyProperties;
    }
  }

  addAttributeConnection() {
    if (!this.sourceObj.attributeConnections)
      this.sourceObj.attributeConnections = [];
    this.sourceObj.attributeConnections.push(this);
  }

  getExistingConnection() {
    var conns = this.sourceObj && this.sourceObj.attributeConnections;
    if (!conns) return null;
    for (var i = 0, len = conns.length; i < len; i++) {
      if (this.isSimilarConnection(conns[i])) return conns[i];
    }
    return null;
  }

  isRecursivelyActivated() {
    // is this enough? Maybe use Stack?
    return this.isActive
  }

  isSimilarConnection(other) {
    if (!other) return false;
    if (other.constructor != this.constructor) return false;
    return this.sourceObj == other.sourceObj &&
      this.sourceAttrName == other.sourceAttrName &&
      this.targetObj == other.targetObj &&
      this.targetMethodName == other.targetMethodName;
  }

  toString(optValue) {
    try {
      return string.format(
        'AttributeConnection(%s.%s %s %s.%s)',
        this.getSourceObj(),
        this.getSourceAttrName(),
        optValue ? ('-->' + String(optValue) + '-->') : '-->',
        this.getTargetObj(),
        this.getTargetMethodName());
    } catch(e) {
      return '<Error in AttributeConnection>>toString>';
    }
  }
}

// AttributeConnection.addMethods({
//   toLiteral() {
//     var self  = this;
//     function getId(obj) {
//       if (!obj) {
//         console.warn('Cannot correctly serialize connections having '
//               + 'undefined source or target objects');
//         return null;
//       }
//       if (obj.id && Object.isFunction(obj.id))
//         return obj.id();
//       if (obj.nodeType && obj.getAttribute) { // is it a real node?
//         var id = obj.getAttribute('id')
//         if (!id) { // create a new id
//           id = 'ElementConnection--' + Date.now();
//           obj.setAttribute('id', id);
//         }
//         return id;
//       }
//       console.warn('Cannot correctly serialize connections having '
//             + 'source or target objects that have no id: ' + self);
//       return null
//     }
//     var literal = {
//       sourceObj: getId(this.sourceObj),
//       sourceAttrName: this.sourceAttrName,
//       targetObj: getId(this.targetObj),
//       targetMethodName: this.targetMethodName
//     };
//     if (this.converterString) literal.converter = this.converterString;
//     if (this.updaterString) literal.updater = this.updaterString;
//     if (this.removeAfterUpdate) literal.removeAfterUpdate = true;
//     if (this.forceAttributeConnection) literal.forceAttributeConnection = true;
//     return literal;
//   }
// })

// Object.extend(AttributeConnection, {
//   fromLiteral(literal, importer) {
//     if (!importer)
//       throw new Error('AttributeConnection needs importer for resolving uris!!!');

//     // just create the connection, connection not yet installed!!!
//     var con = new AttributeConnection(
//       null, literal.sourceAttrName, null, literal.targetMethodName, literal);

//     // when target/source obj are restored asynchronly
//     new AttributeConnection(con, 'sourceObj', con, 'onSourceAndTargetRestored',
//       {removeAfterUpdate: true}).connect();
//     new AttributeConnection(con, 'targetObj', con, 'onSourceAndTargetRestored',
//       {removeAfterUpdate: true}).connect();

//     function restore(id, fieldName) {
//       if (!id) {
//         console.warn('cannot deserialize ' + fieldName + ' when deserilaizing a connect');
//         return
//       }
//       if (id.split('--')[0] == 'ElementConnection') { // FIXME brittle!!!
//         con[fieldName] = importer.canvas().ownerDocument.getElementById(id);
//         return
//       }
//       importer.addPatchSite(con, fieldName, id);
//     };

//     restore(literal.sourceObj, 'sourceObj');
//     restore(literal.targetObj, 'targetObj');

//     return con;
//   }
// });

// AttributeConnection.addMethods('serialization', {
//   onrestore() {
//     try {
//       if (this.targetObj && this.sourceObj) this.connect();
//     } catch(e) {
//       dbgOn(true);
//       console.error('AttributeConnection>>onrestore: Cannot restore ' + this + '\n' + e);
//     }
//   }
// });


  // documentation: 'connect parameters: source, sourceProp, target, targetProp, spec\n'
  //       + 'spec can be: {\n'
  //       + '  removeAfterUpdate: Boolean,\n'
  //       + '  forceAttributeConnection: Boolean,\n'
  //       + '  converter: Function,\n'
  //       + '  updater: Function,\n'
  //       + '  varMapping: Object\n'
  //       + '}',

function connect(sourceObj, attrName, targetObj, targetMethodName, specOrConverter) {
  // 1: determine what kind of connection to create. Default is
  //  AttributeConnection but source.connections/
  //  source.getConnectionPoints can specify different settings
  var connectionPoints = (sourceObj.getConnectionPoints && sourceObj.getConnectionPoints())
            || (sourceObj.connections),
    connectionPoint = connectionPoints && connectionPoints[attrName],
    klass = (connectionPoint && connectionPoint.map && lively.morphic && lively.morphic.GeometryConnection)
       || (connectionPoint && connectionPoint.connectionClassType && lively.Class.forName(connectionPoint.connectionClassType))
       || AttributeConnection,
    spec;

  // 2: connection settings: converter/updater/...
  if (typeof specOrConverter === "function") {
    console.warn('Directly passing a converter function to connect() '
           + 'is deprecated! Use spec object instead!');
    spec = {converter: specOrConverter};
  } else {
    spec = specOrConverter;
  }

  if (connectionPoint) spec = lively.lang.obj.merge(connectionPoint, spec);

  // 3: does a similar connection exist? Yes: update it with new specs,
  //  no: create new connection
  var connection = new klass(sourceObj, attrName, targetObj, targetMethodName, spec),
    existing = connection.getExistingConnection();
  if (existing) {
    existing.resetSpec();
    existing.init(sourceObj, attrName, targetObj, targetMethodName, spec);
    return existing;
  }
  var result = connection.connect();

  // 4: notify source object if it has a #onConnect method
  if (typeof sourceObj.onConnect === "function") {
    sourceObj.onConnect(attrName, targetObj, targetMethodName)
  }

  // 5: If wanted updated the connection right now
  if (connectionPoint && connectionPoint.updateOnConnect) {
    connection.update(sourceObj[attrName]);
  }
  return result;
}

function disconnect(sourceObj, attrName, targetObj, targetMethodName) {
  if (!sourceObj.attributeConnections) return;

  sourceObj.attributeConnections.slice().forEach(function(con) {
    if (con.getSourceAttrName() == attrName
    &&  con.getTargetObj() === targetObj
    &&  con.getTargetMethodName() == targetMethodName) con.disconnect(); });

  if (typeof sourceObj['onDisconnect'] == 'function') {
    sourceObj.onDisconnect(attrName, targetObj, targetMethodName);
  };
}

function disconnectAll(sourceObj) {
  while (sourceObj.attributeConnections && sourceObj.attributeConnections.length > 0) {
    sourceObj.attributeConnections[0].disconnect();
  }
}

function once(sourceObj, attrName, targetObj, targetMethodName, spec) {
  spec = spec || {};
  spec.removeAfterUpdate = true;
  return connect(sourceObj, attrName, targetObj, targetMethodName, spec);
}

function signal(sourceObj, attrName, newVal) {
  var connections = sourceObj.attributeConnections;
  if (!connections) return;
  var oldVal = sourceObj[attrName];
  for (var i = 0, len = connections.length; i < len; i++) {
    var c = connections[i];
    if (c.getSourceAttrName() == attrName) c.update(newVal, oldVal);
  }
}

export function callWhenNotNull(sourceObj, sourceProp, targetObj, targetSelector) {
  // ensure that sourceObj[sourceProp] is not null, then run targetObj[targetProp]()
  if (sourceObj[sourceProp] != null) {
    targetObj[targetSelector](sourceObj[sourceProp]);
  } else {
    connect(
      sourceObj, sourceProp, targetObj, targetSelector,
      {removeAfterUpdate: true});
  }
}

export function callWhenPathNotNull(source, path, target, targetProp) {
  var helper = {
    key: path.pop(),
    whenDefined(context) {
      callWhenNotNull(context, this.key, target, targetProp)
    }
  }

  while (path.length > 0) {
    helper = {
      key: path.pop(),
      next: helper,
      whenDefined(context) {
        callWhenNotNull(context, this.key, this.next, 'whenDefined')
      }
    }
  }

  helper.whenDefined(source);
}

function noUpdate(noUpdateSpec, func) {
  var globalNoUpdate = false, result;
  if (!func && typeof noUpdateSpec === "function") {
    func = noUpdateSpec; globalNoUpdate = true; }
  if (globalNoUpdate) { // rather a hack for now
    var proto = AttributeConnection.prototype;
    if (!proto.isActive) proto.isActive = 0;
    proto.isActive++;
    try { result = func(); } finally {
      proto.isActive--;
      if (proto.isActive <= 0) proto.isActive;
    }
  } else {
    var obj = noUpdateSpec.sourceObj,
        attr = noUpdateSpec.sourceAttribute,
        targetObj = noUpdateSpec.targetObj,
        targetAttr = noUpdateSpec.targetAttribute,
        filter = targetObj && targetAttr ?
          ea => ea.getSourceAttrName() === attr
                   && targetObj === ea.getTargetObj()
                   && targetAttr === ea.getTargetMethodName() :
          ea => ea.getSourceAttrName() === attr,
        conns = obj.attributeConnections.filter(filter);
    arr.invoke(conns, 'activate');
    try { result = func(); }
    finally { arr.invoke(conns,'deactivate'); }
  }
  return result;
}
