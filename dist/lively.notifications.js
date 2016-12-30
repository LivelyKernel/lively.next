(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang) {
'use strict';

/*global System*/

// type EventType = string
// type EventTime = number
// type Notification = {type: EventType, time: EventTime, ...};
// type Handler = Notification -> ()
// type Notifications = { [number]: Notification, limit: number }
// type Emitter = {isRecording: boolean, isLogging: boolean, ... }
// type Env = {emitter: Emitter, notifications: Notifications}

var env = void 0;

function getEnv(_System) {
  // System? -> Env
  if (_System === undefined) {
    if (typeof System === "undefined") {
      // fallback if not System is available
      if (env !== undefined) return env;
      return env || (env = {
        emitter: lively_lang.events.makeEmitter({}, { maxListenerLimit: 10000 }),
        notifications: []
      });
    }

    _System = System;
  }

  var livelyEnv = _System.get("@lively-env");
  if (!livelyEnv) _System.set("@lively-env", _System.newModule({ options: {} }));

  var options = livelyEnv.options;

  if (!options) throw new Error("@lively-env registered read-only");

  if (!options.emitter) {
    Object.assign(options, {
      emitter: _System["__lively.notifications_emitter"] || (_System["__lively.notifications_emitter"] = lively_lang.events.makeEmitter({}, { maxListenerLimit: 10000 })),
      notifications: _System["__lively.notifications_notifications"] || (_System["__lively.notifications_notifications"] = [])
    });
  }
  var emitter = options.emitter,
      notifications = options.notifications;

  return { emitter: emitter, notifications: notifications };
}

function subscribe(type, handler, system) {
  // EventType, Handler, System? -> Handler
  getEnv(system).emitter.on(type, handler);
  return handler;
}

function subscribeOnce(type, handler, system) {
  // EventType, Handler, System? -> Handler
  getEnv(system).emitter.once(type, handler);
  return handler;
}

function emit(type) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
  var system = arguments[3];

  // EventType, Notification?, EventTime?, System? -> Notification
  var notification = Object.assign({ type: type, time: time }, data),
      _getEnv = getEnv(system),
      emitter = _getEnv.emitter,
      notifications = _getEnv.notifications;

  emitter.emit(type, notification);
  if (emitter.isLogging) log(notification);
  if (emitter.isRecording) record(notifications, notification);
  return notification;
}

function unsubscribe(type, handler, system) {
  // EventType, Handler, System? -> Handler
  getEnv(system).emitter.removeListener(type, handler);
  return handler;
}

function unsubscribeAll(type, system) {
  // EventType, System? -> ()
  getEnv(system).emitter.removeAllListeners(type);
}

function record(notifications, notification) {
  // Array<Notification>, Notification -> ()
  notifications.push(notification);
  if (notifications.limit) {
    notifications.splice(0, notifications.length - notifications.limit);
  }
}

function startRecording(system) {
  // System? -> ()
  getEnv(system).emitter.isRecording = true;
}

function stopRecording(system) {
  // System? -> ()
  getEnv(system).emitter.isRecording = false;
}

function clearRecord(system) {
  // System? -> ()
  var _getEnv2 = getEnv(system),
      notifications = _getEnv2.notifications;

  notifications.splice(0, notifications.length);
}

function getRecord(system) {
  // System? -> Notifications
  return getEnv(system).notifications;
}

function log(notification) {
  // Notification -> ()
  var padded = notification.type + " ".repeat(Math.max(0, 32 - notification.type.length));
  console.log(padded + " " + lively_lang.obj.inspect(notification, { maxDepth: 2 }));
}

function startLogging(system) {
  // System? -> ()
  getEnv(system).emitter.isLogging = true;
}

function stopLogging(system) {
  // System? -> ()
  getEnv(system).emitter.isLogging = false;
}

exports.subscribe = subscribe;
exports.subscribeOnce = subscribeOnce;
exports.emit = emit;
exports.unsubscribe = unsubscribe;
exports.unsubscribeAll = unsubscribeAll;
exports.startRecording = startRecording;
exports.stopRecording = stopRecording;
exports.clearRecord = clearRecord;
exports.getRecord = getRecord;
exports.startLogging = startLogging;
exports.stopLogging = stopLogging;

}((this.lively.notifications = this.lively.notifications || {}),lively.lang));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.classes;
})();