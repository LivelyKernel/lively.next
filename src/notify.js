export {
  getNotifications,
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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// doits
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function recordDoitRequest(System, code, options, time) {
  var recorded = {
    type: "doitrequest",
    code: code, options: options,
    time: time || Date.now()
  }
  getNotifications(System).push(recorded);
  truncateNotifications(System);
  notifySubscriber(System, 'doitrequest', recorded);
  return recorded;
}

function recordDoitResult(System, code, options, result, time) {
  var recorded = {
    type: "doitresult",
    code: code, options: options, result: result,
    time: time || Date.now()
  }
  getNotifications(System).push(recorded);
  truncateNotifications(System);
  notifySubscriber(System, 'doitresult', recorded);
  return recorded;
}

function recordModuleChange(System, moduleId, oldSource, newSource, error, options, time) {
  var recorded = {
    type: "modulechange",
    module: moduleId,
    oldCode: oldSource, newCode: newSource,
    error: error, options: options,
    time: time || Date.now()
  }
  getNotifications(System).push(recorded);
  truncateNotifications(System);
  notifySubscriber(System, 'modulechange', recorded);
  return recorded;
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
