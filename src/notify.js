export {
  getNotifications,
  record,
  recordDoitResult, recordDoitRequest,
  recordModuleChange,
  subscribe
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
  subsribersForType(System, type).forEach(handlerFunc => {
    try {
      handlerFunc(data);
    } catch (e) {
      console.error(`Error in lively.modules notification hander ${handlerFunc}:\n${e.stackk}`)
    }
  });
}

function subsribersForType(System, type) {
  var subscribers = System["__lively.modules__"].notificationSubscribers;
  return subscribers[type] || (subscribers[type] = []);
}

function subscribe(System, type, handlerFunc) {
  if (["modulechange", "doitrequest", "doitresult"].indexOf(type) === -1) throw new Error(`Unknown notification type ${type}`);
  if (typeof handlerFunc !== "function") throw new Error(`handlerFunc in subscribe is not a function ${handlerFunc}`);
  subsribersForType(System, type).push(handlerFunc);
}
