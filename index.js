/*global System*/

import { events } from 'lively.lang';

// type EventType = string
// type EventTime = number
// type Notification = {type: EventType, time: EventTime, ...};
// type Handler = Notification -> ()

function getEnv() { // -> [Emitter, Array<Notification>]
  if (typeof System === 'undefined') {
    return [events.makeEmitter({}), []];
  }
  const livelyEnv = System.get("@lively-env");
  let options;
  if (livelyEnv === undefined) {
    options = {};
    System.set("@lively-env", System.newModule({options}));
  } else {
    options = livelyEnv.options;
  }
  if (!options) {
    throw new Error("@lively-env registered read-only");
  }
  if (!options.emitter) {
    Object.assign(options, {
      emitter: System["__lively.notifications_emitter"] ||
              (System["__lively.notifications_emitter"] = events.makeEmitter({})),
      notifications: System["__lively.notifications_notifications"] ||
             (System["__lively.notifications_notifications"] = []),
    });
  }
  return [options.emitter, options.notifications];
}

let emitter;
function getEmitter() { // -> Emitter
  if (emitter !== undefined) {
    return emitter;
  }
  return emitter = getEnv()[0];
}

let notifications;
export function getNotifications() { // -> Array<Notification>
  if (notifications !== undefined) {
    return notifications;
  }
  return notifications = getEnv()[1];
}

export function subscribe(type, handler) { // EventType, Handler -> ()
  getEmitter().on(type, handler);
}

export function emit(type, data = {}, time = Date.now()) {
  // EventType, Notification?, EventTime? -> ()
  const notification = Object.assign({type, time}, data);
  getEmitter().emit(type, notification);
  record(notification);
}

export function unsubscribe(type, handler) { // EventType, Handler -> ()
  getEmitter().removeListener(type, handler);
}

export function unsubscribeAll(type) { // EventType -> ()
  getEmitter().removeAllListeners(type);
}

function record(notification) { // Notification -> ()
  const notifications = getNotifications();
  if (notifications.isRecording) {
    notifications.push(notification);
    if (notifications.limit) {
      notifications.splice(0, notifications.length - notifications.limit);
    }
  }
}

export function startRecording() {
  getNotifications().isRecording = true;
}

export function stopRecording() {
  getNotifications().isRecording = false;
}

export function clearRecord() {
  const notifications = getNotifications();
  notifications.splice(0, notifications.length);
}
