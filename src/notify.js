var eventTypes = ["modulechange", "doitrequest", "doitresult"];

export {
  getNotifications,
  record,
  recordDoitResult, recordDoitRequest,
  recordModuleChange,
  subscribe, unsubscribe,
  eventTypes
};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// genric stuff
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function getNotifications(System) {
  return System["__lively.modules__"].notifications;
}

function truncateNotifications(System) {
  var limit = System["__lively.modules__"].options.notificationLimit;
  if (limit) {
    var notifications = getNotifications(System);
    notifications.splice(0, notifications.length - limit)
  }
}

function record(System, event) {
  getNotifications(System).push(event);
  truncateNotifications(System);
  notifySubscriber(System, event.type, event);
  return event;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// doits
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function recordDoitRequest(System, code, options, time) {
  return record(System, {
    type: "doitrequest",
    code: code, options: options,
    time: time || Date.now()
  })
}

function recordDoitResult(System, code, options, result, time) {
  return record(System, {
    type: "doitresult",
    code: code, options: options, result: result,
    time: time || Date.now()
  });
}

function recordModuleChange(System, moduleId, oldSource, newSource, error, options, time) {
  return record(System, {
    type: "modulechange",
    module: moduleId,
    oldCode: oldSource, newCode: newSource,
    error: error, options: options,
    time: time || Date.now()
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// subscriptions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function notifySubscriber(System, type, data) {
  subsribersForType(System, type).forEach(({name, handler}) => {
    try {
      handler(data);
    } catch (e) {
      console.error(`Error in lively.modules notification handler ${name || handler}:\n${e.stack}`)
    }
  });
}

function subsribersForType(System, type) {
  var subscribers = System["__lively.modules__"].notificationSubscribers;
  return subscribers[type] || (subscribers[type] = []);
}

function _addSubscriber(System, name, type, handlerFunc) {
  var subscribers = subsribersForType(System, type);
  if (name) _removeNamedSubscriptionOfType(System, name, type);
  subscribers.push({name: name, handler: handlerFunc});
}

function _removeNamedSubscriptionOfType(System, name, type) {
  var subscribers = subsribersForType(System, type);
  subscribers.forEach((ea, i) =>
    ea.name === name && subscribers.splice(i, 1));
}

function _removeSubscriptionOfType(System, handlerFunc, type) {
  var subscribers = subsribersForType(System, type);
  subscribers.forEach((ea, i) =>
    ea.handler === handlerFunc && subscribers.splice(i, 1));
}

function subscribe(System, type, name, handlerFunc) {
  if (typeof name === "function") {
    handlerFunc = name;
    name = undefined
  }

  if (typeof type === "function") {
    handlerFunc = type;
    type = undefined;
    name = undefined;
  }
  
  if (type && eventTypes.indexOf(type) === -1) throw new Error(`Unknown notification type ${type}`);
  if (typeof handlerFunc !== "function") throw new Error(`handlerFunc in subscribe is not a function ${handlerFunc}`);
  var types = type ? [type] : eventTypes;
  types.forEach(type => _addSubscriber(System, name, type, handlerFunc));
}

function unsubscribe(System, type, nameOrHandlerFunc) {
  if (typeof nameOrHandlerFunc === "undefined") {
    nameOrHandlerFunc = type;
    type = undefined;
  }

  var types = type ? [type] : eventTypes,
      remover = typeof nameOrHandlerFunc === "function" ?
        _removeSubscriptionOfType : _removeNamedSubscriptionOfType;
  types.forEach(type => remover(System, nameOrHandlerFunc, type))
}
