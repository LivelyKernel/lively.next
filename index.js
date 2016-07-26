/*global System*/

import { events } from 'lively.lang';

// type EventType = string
// type EventTime = number
// type Notification = {type: EventType, time: EventTime, ...};
// type Handler = Notification -> ()

function getEnv() { // -> [Emitter, Array<Notification>]
  if (typeof System === 'undefined') {
    console.log("no system");
    return [events.makeEmitter({}), []];
  }
  let livelyEnv = System.get("@lively-env");
  if (livelyEnv === undefined) {
    livelyEnv = {};
    System.set("@lively-env", System.newModule(livelyEnv));
  }
  if (!livelyEnv.emitter) {
    Object.assign(livelyEnv, {
      emitter: System["__lively.notifications_emitter"] ||
              (System["__lively.notifications_emitter"] = events.makeEmitter({})),
      record: System["__lively.notifications_record"] ||
             (System["__lively.notifications_record"] = []),
    });
  }
  return [livelyEnv.emitter, livelyEnv.record];
}

let emitter;
function getEmitter() { // -> Emitter
  if (emitter !== undefined) {
    return emitter;
  }
  return emitter = getEnv()[0];
}

let record;
function getRecord() { // -> Array<Notification>
  if (record !== undefined) {
    return record;
  }
  return record = getEnv()[1];
}

export function subscribe(type, handler) { // EventType, Handler -> ()
  getEmitter().on(type, handler);
}

export function emit(type, data = {}, time = Date.now()) {
  // EventType, Notification?, EventTime? -> ()
  getEmitter().emit(type, Object.assign({type, time}, data));
}

export function unsubscribe(type, handler) { // EventType, Handler -> ()
  getEmitter().removeListener(type, handler);
}

export function unsubscribeAll(type) { // EventType -> ()
  getEmitter().removeAllListeners(type);
}
