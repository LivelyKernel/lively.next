/*global process, require*/

/*
 * A simple node.js-like cross-platform event emitter implementation that can
 * be used as a mixin. Emitters support the methods: `on(eventName, handlerFunc)`,
 * `once(eventName, handlerFunc)`, `emit(eventName, eventData)`,
 * `removeListener(eventName, handlerFunc)`, `removeAllListeners(eventName)`
 * Example:
 * var emitter = events.makeEmitter({});
 * var log = [];
 * emitter.on("test", function() { log.push("listener1"); });
 * emitter.once("test", function() { log.push("listener2"); });
 * emitter.emit("test");
 * emitter.emit("test");
 * log // => ["listener1","listener2","listener1"]
 * emitter.removeAllListeners("test");
 * emitter.emit("test");
 * log // => is still ["listener1","listener2","listener1"]
 */

var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

var makeEmitter = isNode ? function(obj, options) {
    if (obj.on && obj.removeListener) return obj;
    var events = typeof System !== "undefined" ?
      System._nodeRequire("events") :
      require("events");
    Object.assign(obj, events.EventEmitter.prototype);
    events.EventEmitter.call(obj);
    if (options && options.maxListenerLimit)
      obj.setMaxListeners(options.maxListenerLimit);

    return obj;
  }

  :

  function(obj) {
    if (obj.on && obj.removeListener) return obj;

    obj.listeners = {};

    obj.on = function(type, handler) {
      if (!handler) return;
      if (!obj.listeners[type])
        obj.listeners[type] = [];
      obj.listeners[type].push(handler);
    };

    obj.once = function(type, handler) {
      if (!handler) return;
      function onceHandler /*ignore-in-docs args*/() {
        obj.removeListener(type, onceHandler);
        handler.apply(this, arguments);
      }
      obj.on(type, onceHandler);
    };

    obj.removeListener = function(type, handler) {
      if (!obj.listeners[type]) return;
      obj.listeners[type] = obj.listeners[type].filter(h => h !== handler);
    };

    obj.removeAllListeners = function(type) {
      if (!obj.listeners[type]) return;
      obj.listeners[type] = [];
    };

    obj.emit = function(/*type and args*/) {
      var args = Array.prototype.slice.call(arguments),
          type = args.shift(),
          handlers = obj.listeners[type];
      if (!handlers || !handlers.length) return;
      handlers.forEach(function(handler) {
        try {
          handler.apply(null, args);
        } catch (e) {
          console.error("Error in event handler: %s", e.stack || String(e));
        }
      });
    };

    return obj;
  };

export { makeEmitter }
