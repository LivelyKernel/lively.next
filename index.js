/*global System*/

import { events, obj } from "lively.lang";

// type EventType = string
// type EventTime = number
// type Notification = {type: EventType, time: EventTime, ...};
// type Handler = Notification -> ()
// type Notifications = { [number]: Notification, limit: number }
// type Emitter = {isRecording: boolean, isLogging: boolean, ... }
// type Env = {emitter: Emitter, notifications: Notifications}

let env;

function getEnv(_System) { // System? -> Env
  if (_System === undefined) {
    if (typeof System === "undefined") {
      // fallback if not System is available
      if (env !== undefined) return env;
      return env || (env = {
        emitter: events.makeEmitter({}, {maxListenerLimit: 10000}),
        notifications: []
      });
    }

    _System = System;
  }

  const livelyEnv = _System.get("@lively-env");
  if (!livelyEnv)
    _System.set("@lively-env", _System.newModule({options: {}}));

  let options = livelyEnv.options;

  if (!options)
    throw new Error("@lively-env registered read-only");

  if (!options.emitter) {
    Object.assign(options, {
      emitter: _System["__lively.notifications_emitter"] ||
              (_System["__lively.notifications_emitter"] = events.makeEmitter({}, {maxListenerLimit: 10000})),
      notifications: _System["__lively.notifications_notifications"] ||
                    (_System["__lively.notifications_notifications"] = []),
    });
  }
  const {emitter, notifications} = options;
  return {emitter, notifications};
}

export function subscribe(type, handler, system) {
  // EventType, Handler, System? -> Handler
  getEnv(system).emitter.on(type, handler);
  return handler;
}

export function subscribeOnce(type, handler, system) {
  // EventType, Handler, System? -> Handler
  getEnv(system).emitter.once(type, handler);
  return handler;
}

export function emit(type, data = {}, time = Date.now(), system) {
  // EventType, Notification?, EventTime?, System? -> Notification
  const notification = Object.assign({type, time}, data),
        {emitter, notifications} = getEnv(system);
  emitter.emit(type, notification);
  if (emitter.isLogging) log(notification);
  if (emitter.isRecording) record(notifications, notification);
  return notification;
}

export function unsubscribe(type, handler, system) {
  // EventType, Handler, System? -> Handler
  getEnv(system).emitter.removeListener(type, handler);
  return handler;
}

export function unsubscribeAll(type, system) {
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

export function startRecording(system) { // System? -> ()
  getEnv(system).emitter.isRecording = true;
}

export function stopRecording(system) { // System? -> ()
  getEnv(system).emitter.isRecording = false;
}

export function clearRecord(system) { // System? -> ()
  const {notifications} = getEnv(system);
  notifications.splice(0, notifications.length);
}

export function getRecord(system) { // System? -> Notifications
  return getEnv(system).notifications;
}

function log(notification) { // Notification -> ()
  const padded = notification.type + " ".repeat(Math.max(0, 32 - notification.type.length));
  console.log(padded + " " + obj.inspect(notification, {maxDepth: 2}));
}

export function startLogging(system) { // System? -> ()
  getEnv(system).emitter.isLogging = true;
}

export function stopLogging(system) { // System? -> ()
  getEnv(system).emitter.isLogging = false;
}
