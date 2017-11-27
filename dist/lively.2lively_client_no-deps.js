(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
this.lively.l2l = this.lively.l2l || {};
this.lively.l2l.L2LClient = (function (lively_lang,_ioClient) {
'use strict';

_ioClient = 'default' in _ioClient ? _ioClient['default'] : _ioClient;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj$$1) {
  return typeof obj$$1;
} : function (obj$$1) {
  return obj$$1 && typeof Symbol === "function" && obj$$1.constructor === Symbol && obj$$1 !== Symbol.prototype ? "symbol" : typeof obj$$1;
};









var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};



var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};





var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

function nyi(msg) {
  throw new Error("Not yet implemented: " + msg);
}

var debugMessageOrder = false;

var L2LConnection = function () {
  function L2LConnection(ns) {
    classCallCheck(this, L2LConnection);

    this.id = lively_lang.string.newUUID();
    this.actions = {};
    this.options = { ackTimeout: 3500, debug: false };
    this._incomingOrderNumberingBySenders = new Map();
    this._outgoingOrderNumberingByTargets = new Map();
    this._outOfOrderCacheBySenders = new Map();
  }

  createClass(L2LConnection, [{
    key: "isOnline",
    value: function isOnline() {
      nyi("isOnline");
    }
  }, {
    key: "open",
    value: function open() {
      nyi("isOnline");
    }
  }, {
    key: "close",
    value: function close() {
      nyi("close");
    }
  }, {
    key: "remove",
    value: function remove() {
      nyi("remove");
    }
  }, {
    key: "whenOnline",
    value: function whenOnline(timeout) {
      var _this = this;

      return lively_lang.promise.waitFor(timeout, function () {
        return _this.isOnline();
      }).then(function () {
        return _this;
      }).catch(function (err) {
        return Promise.reject(/timeout/i.test(String(err)) ? new Error("Timeout in " + _this + ".whenOnline") : err);
      });
    }
  }, {
    key: "onError",
    value: function onError(err) {
      if (this.debug) console.log("[" + this + "] error: " + err);
    }
  }, {
    key: "removeService",
    value: function removeService(selector) {
      delete this.actions[selector];
    }
  }, {
    key: "removeServices",
    value: function removeServices(selectors) {
      var _this2 = this;

      selectors.forEach(function (ea) {
        return _this2.removeService(ea);
      });
    }
  }, {
    key: "addService",
    value: function addService(selector, handlerFn) {
      this.actions[selector] = handlerFn;
    }
  }, {
    key: "addServices",
    value: function addServices(services) {
      var _this3 = this;

      Object.keys(services).forEach(function (selector) {
        return _this3.addService(selector, services[selector]);
      });
    }
  }, {
    key: "ping",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(target) {
        var t, _ref2, t2, t3;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                t = Date.now();
                _context.next = 3;
                return this.sendToAndWait(target, "l2l-ping", { timestamp: t });

              case 3:
                _ref2 = _context.sent;
                t2 = _ref2.data.timestamp;
                t3 = Date.now();
                return _context.abrupt("return", {
                  to: t2 - t,
                  from: t3 - t2,
                  roundtrip: t3 - t
                });

              case 7:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ping(_x) {
        return _ref.apply(this, arguments);
      }

      return ping;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // sending stuff

  }, {
    key: "send",
    value: function send(msg, ackFn) {
      nyi("send");
    }
  }, {
    key: "sendAndWait",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(msg) {
        var _this4 = this;

        var sendP, timeout, timeoutMs, answer;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                // timeout actually dealt with on receiver side, see
                // installEventToMessageTranslator, this here is just to notice of things
                // really go wrong
                // FIXME: set timeoutMs to receiver timeout time!

                sendP = new Promise(function (resolve, reject) {
                  return _this4.send(msg, resolve);
                }), timeout = {}, timeoutMs = this.options.ackTimeout + 400;


                if ("ackTimeout" in msg) {
                  if (!msg.ackTimeout || msg.ackTimeout < 0) timeoutMs = null;else timeoutMs = msg.ackTimeout + 400;
                }

                if (!timeoutMs) {
                  _context2.next = 8;
                  break;
                }

                _context2.next = 5;
                return Promise.race([lively_lang.promise.delay(timeoutMs, timeout), sendP]);

              case 5:
                answer = _context2.sent;
                _context2.next = 11;
                break;

              case 8:
                _context2.next = 10;
                return sendP;

              case 10:
                answer = _context2.sent;

              case 11:
                if (!(answer === timeout)) {
                  _context2.next = 13;
                  break;
                }

                throw new Error("Timeout sending " + msg.action);

              case 13:
                return _context2.abrupt("return", answer);

              case 14:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function sendAndWait(_x2) {
        return _ref3.apply(this, arguments);
      }

      return sendAndWait;
    }()
  }, {
    key: "sendTo",
    value: function sendTo(target, action, data, ackFn) {
      return this.send({ target: target, action: action, data: data }, ackFn);
    }
  }, {
    key: "sendToAndWait",
    value: function sendToAndWait(target, action, data, opts) {
      return this.sendAndWait(_extends({ target: target, action: action, data: data }, opts));
    }
  }, {
    key: "prepareSend",
    value: function prepareSend(msg, ackFn) {
      var target = msg.target,
          action = msg.action,
          messageId = msg.messageId,
          data = msg.data,
          sender = msg.sender;

      if (!action) throw new Error("Trying to send a message without specifying action!");
      if (!target) throw new Error("Trying to send message " + action + " without specifying target!");
      if (!messageId) msg.messageId = lively_lang.string.newUUID();
      if (!sender) msg.sender = this.id;
      var n = msg.n = this._outgoingOrderNumberingByTargets.get(target) || 0;
      this._outgoingOrderNumberingByTargets.set(target, n + 1);

      if (typeof ackFn === "function") {
        var sender = this,
            originalAckFn = ackFn;
        ackFn = function ackFn(msg) {
          // here we receive an ack, we count sender as one more received message
          // as it matters in the message ordering
          var incomingN = sender._incomingOrderNumberingBySenders.get(msg.sender) || 0;

          sender.debug && debugMessageOrder && console.log("[MSG ORDER] " + sender + " received ack for " + msg.action + " as msg " + incomingN);

          try {
            originalAckFn.apply(null, arguments);
          } catch (err) {
            console.error("Error in ack fn of " + sender + ": " + err.stack);
          }
          sender._incomingOrderNumberingBySenders.set(msg.sender, incomingN + 1);
          setTimeout(function () {
            return sender.invokeOutOfOrderMessages(msg.sender);
          }, 0);
        };
      }

      this.debug && debugMessageOrder && console.log("[MSG ORDER] " + this + " sending " + n + " (" + msg.action + ") to " + target);

      return [msg, ackFn];
    }
  }, {
    key: "prepareAnswerMessage",
    value: function prepareAnswerMessage(forMsg, answerData) {
      return {
        action: forMsg.action + "-response",
        inResponseTo: forMsg.messageId,
        target: forMsg.sender,
        data: answerData,
        sender: this.id
      };
    }
  }, {
    key: "installEventToMessageTranslator",
    value: function installEventToMessageTranslator(socket) {
      var self = this;

      var onevent = socket.onevent;
      socket.onevent = function (packet) {
        var args = packet.data || [];
        onevent.call(this, packet); // original invocation
        packet.data = ["*"].concat(args);
        onevent.call(this, packet); // also invoke with *
      };

      socket.on("*", function (eventName, msg) {
        if (eventName && (typeof eventName === "undefined" ? "undefined" : _typeof(eventName)) === "object" && eventName.action) {
          msg = eventName;
          eventName = msg.action;
        }
        var lastArg = arguments[arguments.length - 1],
            ackFn = typeof lastArg === "function" ? lastArg : null;
        msg = msg === ackFn ? null : msg;

        if (!msg || !msg.data || typeof msg.n !== "number" && !msg.broadcast || !msg.sender) {
          console.warn(self + " received non-conformant message " + eventName + ":", arguments);
          typeof ackFn === "function" && ackFn({ data: { error: "invalid l2l message" } });
          return;
        }

        self.receive(msg, socket, ackFn);
      });
    }
  }, {
    key: "receive",
    value: function receive(msg, socket, ackFn) {
      this.dispatchL2LMessageToSelf(msg, socket, ackFn);
    }
  }, {
    key: "dispatchL2LMessageToSelf",
    value: function dispatchL2LMessageToSelf(msg, socket, ackFn) {
      var _this5 = this;

      var selector = msg.action;

      // for broadcasted messages order isn't enforced...
      if (msg.broadcast) {
        this.safeInvokeServiceHandler(selector, msg, ackFn, socket);
        return;
      }

      // do he message ordering dance....
      try {
        var expectedN = this._incomingOrderNumberingBySenders.get(msg.sender) || 0,
            ignoreN = selector === "register" || "unregister";

        if (!ignoreN && msg.n < expectedN) {
          console.error("[MSG ORDER] [" + this + "] received message no. " + msg.n + " but expected >= " + expectedN + ", dropping " + selector);
          return;
        }

        if (!ignoreN && msg.n > expectedN) {
          if (this.debug && debugMessageOrder) console.log("[MSG ORDER] [" + this + "] storing out of order message " + selector + " (" + msg.n + ") for later invocation");
          var cache = this._outOfOrderCacheBySenders.get(msg.sender);
          if (!cache) {
            cache = [];this._outOfOrderCacheBySenders.set(msg.sender, cache);
          }
          cache.push([selector, msg, ackFn, socket]);
          return;
        }

        this.safeInvokeServiceHandler(selector, msg, ackFn, socket);

        setTimeout(function () {
          return _this5.invokeOutOfOrderMessages(msg.sender);
        }, 0);
      } catch (e) {
        console.error("Error message ordering when handling " + selector + ": " + (e.stack || e));
        if (typeof ackFn === "function") ackFn(this.prepareAnswerMessage(msg, { isError: true, error: String(e.stack || e) }));
      }
    }
  }, {
    key: "invokeOutOfOrderMessages",
    value: function invokeOutOfOrderMessages(sender) {
      var outOfOrderMessages = this._outOfOrderCacheBySenders.get(sender);
      if (!outOfOrderMessages || !outOfOrderMessages.length) return;
      var expectedN = this._incomingOrderNumberingBySenders.get(sender) || 0,
          invocationArgsI = outOfOrderMessages.findIndex(function (_ref4) {
        var _ref5 = slicedToArray(_ref4, 2),
            _ = _ref5[0],
            n = _ref5[1].n;

        return n === expectedN;
      });
      if (invocationArgsI === -1) return;
      outOfOrderMessages.splice(invocationArgsI, 1);
      var invocationArgs = outOfOrderMessages[invocationArgsI];
      this.invokeServiceHandler.apply(this, invocationArgs);
    }
  }, {
    key: "renameTarget",
    value: function renameTarget(oldId, newId) {
      if (oldId === newId) return;
      var msgN = this._outgoingOrderNumberingByTargets.get(oldId);
      this._outgoingOrderNumberingByTargets.delete(oldId);
      this._outgoingOrderNumberingByTargets.set(newId, msgN);
    }
  }, {
    key: "safeInvokeServiceHandler",
    value: function safeInvokeServiceHandler(selector, msg, ackFn, socket) {
      try {
        if (typeof this.actions[selector] === "function") {
          this.invokeServiceHandler(selector, msg, ackFn, socket);
        } else {
          if (!socket._events || !Object.keys(socket._events).includes(selector)) {
            console.warn("WARNING [" + this + "] Unhandled message: " + selector);
            if (typeof ackFn === "function") ackFn(this.prepareAnswerMessage(msg, { isError: true, error: "message not understood: " + selector }));
          }
        }
      } catch (e) {
        console.error("Error when handling " + selector + ": " + (e.stack || e));
        if (typeof ackFn === "function") ackFn(this.prepareAnswerMessage(msg, { isError: true, error: String(e.stack || e) }));
      }
    }
  }, {
    key: "invokeServiceHandler",
    value: function invokeServiceHandler(selector, msg, ackFn, socket) {
      var _this6 = this;

      if (this.debug && debugMessageOrder) console.log("[MSG ORDER] " + this + " received " + msg.n + " (" + msg.action + ") from " + msg.sender);

      this._incomingOrderNumberingBySenders.set(msg.sender, msg.n + 1);

      if (typeof ackFn === "function") {
        // in case we send back an ack, other messages send between now and ackFn
        // invocation should be received "later" then the ack
        var ackCalled = false,
            ackTimedout = false,
            timeoutMs = "ackTimeout" in msg ? msg.ackTimeout : this.options.ackTimeout,
            ackN = this._outgoingOrderNumberingByTargets.get(msg.sender) || 0;

        this._outgoingOrderNumberingByTargets.set(msg.sender, ackN + 1);

        var answerFn = function answerFn(answerData) {
          if (ackTimedout) {
            console.warn("[" + _this6 + "] ackFn for " + msg.action + " called after it timed out, dropping answer!");
            return;
          }

          if (ackCalled) {
            console.warn("[" + _this6 + "] ack function called repeatedly when handling " + msg.action);
            return;
          }
          ackCalled = true;

          ackFn(_this6.prepareAnswerMessage(msg, answerData));

          if (_this6.debug && debugMessageOrder) console.log("[MSG ORDER] " + _this6 + " sending " + ackN + " (ack for " + msg.action + ")");
        };

        timeoutMs && setTimeout(function () {
          if (ackCalled) return;
          answerFn({
            isError: true,
            error: "Timeout error: " + _this6 + " did not send answer for " + msg.action + " after " + timeoutMs + "ms"
          });
          ackTimedout = true;
        }, timeoutMs);
      }

      try {
        this.actions[selector].call(this, this, msg, answerFn, socket);
      } catch (e) {
        console.error("[" + this + "] Error handling " + selector + ": " + (e.stack || e));
        answerFn && answerFn({ error: e.stack });
      }
    }
  }, {
    key: "debug",
    get: function get$$1() {
      return this.options.debug;
    },
    set: function set$$1(bool) {
      this.options.debug = bool;
    }
  }]);
  return L2LConnection;
}();

var _this = undefined;

var defaultActions = {

  "l2l-ping": function l2lPing(tracker, _ref, ackFn, socket) {
    var sender = _ref.sender,
        timestamp = _ref.data.timestamp;

    var t = Date.now();
    typeof ackFn === "function" && ackFn({ timestamp: t });
    tracker.debug && console.log("[" + _this + "] got ping from " + sender + ", time: " + (t - timestamp) + "ms");
  },

  "remote-eval": function remoteEval(tracker, _ref2, ackFn, socket) {
    var sender = _ref2.sender,
        source = _ref2.data.source;

    Promise.resolve().then(function () {
      return eval(source);
    }).then(function (result) {
      return ackFn({ value: result });
    }).catch(function (err) {
      // in case SystemJS wraps the error:
      if (err.originalErr) err = err.originalErr;
      console.error("eval error: " + err);
      typeof ackFn === "function" && ackFn({ isError: true, value: String(err.stack || err) });
    });
  },

  "remote-eval-2": function remoteEval2(tracker, _ref3, ackFn, socket) {
    var sender = _ref3.sender,
        source = _ref3.data.source;

    Promise.resolve().then(function () {
      var result = eval(source);
      if (!(result instanceof Promise)) {
        console.error("unexpected eval result:" + result);
        throw new Error("unexpected eval result:" + result);
      }
      return result;
    }).then(function (evalResult) {
      return ackFn(evalResult);
    }).catch(function (err) {
      console.error("eval error: " + err);
      if (err.originalErr) err = err.originalErr;
      typeof ackFn === "function" && ackFn({ isError: true, value: String(err.stack || err) });
    });
  }

};



var defaultClientActions = {
  "getRoomList": function getRoomList(_ref11) {
    var _this5 = this;

    var client = _ref11.client,
        ackFn = _ref11.ackFn;
    return asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
      var result;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              result = client._socketioClient.rooms;

              ackFn(result);

            case 2:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, _this5);
    }))();
  },
  "ask for": function askFor(tracker, _ref12, ackFn, socket) {
    var sender = _ref12.sender,
        query = _ref12.data.query;

    var _this6 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
      var promptMethod, answer;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              promptMethod = query.match(/password|sudo/i) ? 'passwordPrompt' : 'prompt';
              _context5.next = 3;
              return $world[promptMethod](query);

            case 3:
              answer = _context5.sent;

              typeof ackFn === "function" && ackFn({ answer: answer });
              tracker.debug && console.log("[" + _this6 + "] message 'ask for' from " + sender + ", query: " + query);

            case 6:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5, _this6);
    }))();
  },
  "open editor": function openEditor(tracker, _ref13, ackFn, socket) {
    var sender = _ref13.sender,
        args = _ref13.data.args;

    var _this7 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
      var status;
      return regeneratorRuntime.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              if (args.length) {
                _context6.next = 3;
                break;
              }

              ackFn({ error: 'no file specified' });
              return _context6.abrupt("return");

            case 3:
              _context6.next = 5;
              return $world.execCommand("open file for EDITOR", { url: args[0] });

            case 5:
              status = _context6.sent;

              typeof ackFn === "function" && ackFn(status === "aborted" ? { error: String(status) } : { status: status });

            case 7:
            case "end":
              return _context6.stop();
          }
        }
      }, _callee6, _this7);
    }))();
  },
  "changeWorkingDirectory": function changeWorkingDirectory(tracker, _ref14, ackFn, socket) {
    var sender = _ref14.sender,
        args = _ref14.data.args;

    var _this8 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
      var _ref15, _ref16, dir, commandMorphId, status, morph, shellPlugin;

      return regeneratorRuntime.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              _ref15 = args || [], _ref16 = slicedToArray(_ref15, 2), dir = _ref16[0], commandMorphId = _ref16[1];
              status = "OK";


              try {
                if (!dir) status = "[changeWorkingDirectory] No directory received";else if (!commandMorphId) status = "[changeWorkingDirectory] No command morph";else {
                  morph = $world.getMorphWithId(commandMorphId);

                  if (morph) {
                    if (morph.__lookupSetter__("cwd")) morph.cwd = dir;else if (typeof morph.changeWorkingDirectory === "function") morph.changeWorkingDirectory(dir);else if (typeof morph.pluginFind === "function") {
                      shellPlugin = morph.pluginFind(function (ea) {
                        return ea.isShellEditorPlugin;
                      });

                      if (shellPlugin) shellPlugin.cwd = dir;
                    } else {
                      status = "[changeWorkingDirectory] cannot figure pout how to set dir";
                    }
                  }
                }
              } catch (e) {
                status = String(e);
              }

              if (status !== "OK") console.warn(status);
              typeof ackFn === "function" && ackFn(status);

            case 5:
            case "end":
              return _context7.stop();
          }
        }
      }, _callee7, _this8);
    }))();
  }
};

/*global Map,System,process*/
var isNode = typeof System !== "undefined" ? System.get("@system-env").node : typeof process !== "undefined" && process.env;

// FIXME!!
// import ioClient from "socket.io-client";
var ioClient;
if (typeof _ioClient === "undefined" && isNode) {
  var require = System._nodeRequire("module")._load;
  ioClient = require("socket.io-client");
} else {
  ioClient = _ioClient;
}

var urlHelper = {
  isRoot: function isRoot(url) {
    return urlHelper.path(url) === "/";
  },

  root: function root(url) {
    return urlHelper.isRoot(url) ? url : url.slice(0, -urlHelper.path(url).length) + "/";
  },

  path: function () {
    var protocolRe = /^[a-z0-9-_\.]+:/,
        slashslashRe = /^\/\/[^\/]+/;
    return function (url) {
      var path = url.replace(protocolRe, "").replace(slashslashRe, "");
      return path === "" ? "/" : path;
    };
  }(),

  join: function join(url, path) {
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (path.startsWith("/")) path = path.slice(1);
    return url + "/" + path;
  }
};

function determineLocation() {
  if (typeof document !== "undefined" && document.location) return document.location.origin;

  if (isNode) return System._nodeRequire("os").hostname();

  return System.baseURL;
}

var L2LClient = function (_L2LConnection) {
  inherits(L2LClient, _L2LConnection);
  createClass(L2LClient, null, [{
    key: "clientKey",
    value: function clientKey(origin, path, namespace) {
      origin = origin.replace(/\/$/, "");
      path = path.replace(/^\//, "");
      namespace = namespace.replace(/^\//, "");
      return origin + "-" + path + "-" + namespace;
    }
  }, {
    key: "forLivelyInBrowser",
    value: function forLivelyInBrowser(info) {
      var hasInfo = !!info;
      info = _extends({ type: "lively.morphic browser" }, info);

      var def = this.default();

      if (!def) {
        return L2LClient.ensure({
          url: document.location.origin + "/lively-socket.io",
          namespace: "l2l", info: info
        });
      }

      if (hasInfo && !lively_lang.obj.equals(def.info, info) && def.isRegistered()) {
        def.info = info;
        def.unregister().then(function () {
          return def.register();
        }).catch(function (err) {
          return console.error("l2l re-register on info change errored: " + err);
        });
      }

      return def;
    }
  }, {
    key: "default",
    value: function _default() {
      // FIXME
      var key = L2LClient.clients.keys().next().value;
      return L2LClient.clients.get(key);
    }
  }, {
    key: "create",
    value: function create() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var _options$debug = options.debug,
          debug = _options$debug === undefined ? false : _options$debug,
          url = options.url,
          namespace = options.namespace,
          _options$autoOpen = options.autoOpen,
          autoOpen = _options$autoOpen === undefined ? true : _options$autoOpen,
          _options$info = options.info,
          info = _options$info === undefined ? {} : _options$info;


      if (!url) throw new Error("L2LClient needs server url!");

      var origin = urlHelper.root(url).replace(/\/+$/, ""),
          path = urlHelper.path(url),
          client = new this(origin, path, namespace || "", info);

      if (autoOpen) client.register();
      client.debug = debug;
      return client;
    }
  }, {
    key: "ensure",
    value: function ensure() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      // url specifies hostname + port + io path
      // namespace is io namespace
      var url = options.url,
          namespace = options.namespace;


      if (!url) throw new Error("L2LClient needs server url!");

      var origin = urlHelper.root(url).replace(/\/+$/, ""),
          path = urlHelper.path(url),
          key = this.clientKey(origin, path, namespace || ""),
          client = this.clients.get(key);

      if (!client) this.clients.set(key, client = this.create(_extends({}, options, { url: url, namespace: namespace })));

      return client;
    }
  }, {
    key: "clients",
    get: function get$$1() {
      return this._clients || (this._clients = new Map());
    }
  }]);

  function L2LClient(origin, path, namespace, info) {
    classCallCheck(this, L2LClient);

    var _this = possibleConstructorReturn(this, (L2LClient.__proto__ || Object.getPrototypeOf(L2LClient)).call(this));

    lively_lang.events.makeEmitter(_this);
    _this.info = info;
    _this.origin = origin;
    _this.path = path;
    _this.namespace = namespace.replace(/^\/?/, "/");
    _this.trackerId = null;
    _this._socketioClient = null;

    // not socket.io already does auto reconnect when network fails but if the
    // socket.io server disconnects a socket, it won't retry by itself. We want
    // that behavior for l2l, however
    _this._reconnectState = {
      closed: false,
      autoReconnect: true,
      isReconnecting: false,
      isReconnectingViaSocketio: false,
      registerAttempt: 0,
      registerProcess: null,
      isOpening: false
    };

    Object.keys(defaultActions).forEach(function (name) {
      return _this.addService(name, defaultActions[name]);
    });

    Object.keys(defaultClientActions).forEach(function (name) {
      return _this.addService(name, defaultClientActions[name]);
    });
    return _this;
  }

  createClass(L2LClient, [{
    key: "isOnline",
    value: function isOnline() {
      return this.socket && this.socket.connected;
    }
  }, {
    key: "isRegistered",
    value: function isRegistered() {
      return this.isOnline() && !!this.trackerId;
    }
  }, {
    key: "open",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        var _this2 = this;

        var url, opts, socket;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!this.isOnline()) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt("return", this);

              case 2:
                if (!this._reconnectState.isOpening) {
                  _context.next = 4;
                  break;
                }

                return _context.abrupt("return", this);

              case 4:
                _context.next = 6;
                return this.close();

              case 6:

                this._reconnectState.closed = false;

                url = urlHelper.join(this.origin, this.namespace), opts = { path: this.path, transports: ['websocket', 'polling'] }, socket = this._socketioClient = ioClient(url, opts);


                if (this.debug) console.log("[" + this + "] connecting");

                socket.on("error", function (err) {
                  _this2._reconnectState.isOpening = false;
                  _this2.debug && console.log("[" + _this2 + "] errored: " + err);
                });
                socket.on("close", function (reason) {
                  return _this2.debug && console.log("[" + _this2 + "] closed: " + reason);
                });
                socket.on("reconnect_failed", function () {
                  return _this2.debug && console.log("[" + _this2 + "] could not reconnect");
                });
                socket.on("reconnect_error", function (err) {
                  return _this2.debug && console.log("[" + _this2 + "] reconnect error " + err);
                });

                socket.on("connect", function () {
                  _this2.debug && console.log("[" + _this2 + "] connected");
                  _this2.emit("connected", _this2);
                  _this2._reconnectState.isOpening = false;
                  _this2._reconnectState.isReconnecting = false;
                  _this2._reconnectState.isReconnectingViaSocketio = false;
                });

                socket.on("disconnect", function () {
                  _this2._reconnectState.isOpening = false;

                  _this2.debug && console.log("[" + _this2 + "] disconnected");
                  _this2.emit("disconnected", _this2);

                  if (!_this2.trackerId) {
                    _this2.debug && console.log("[" + _this2 + "] disconnect: don't have a tracker id, won't try reconnect");
                    _this2.trackerId = "tracker";
                    return;
                  }

                  if (_this2.trackerId !== "tracker") {
                    // for maintaining seq nos.
                    _this2.renameTarget(_this2.trackerId, "tracker");
                    _this2.trackerId = null;
                  }

                  if (_this2._reconnectState.closed) {
                    _this2.debug && console.log("[" + _this2 + "] won't reconnect b/c client is marked as closed");
                    return;
                  }

                  if (!_this2._reconnectState.autoReconnect) {
                    _this2.debug && console.log("[" + _this2 + "] won't reconnect b/c client has reconnection disabled");
                    return;
                  }

                  _this2._reconnectState.isReconnecting = true;

                  setTimeout(function () {
                    // if socket.io isn't auto reconnecting we are doing it manually

                    if (_this2._reconnectState.closed) {
                      _this2.debug && console.log("[" + _this2 + "] won't reconnect b/c client is marked as closed 2");
                      return;
                    }
                    if (_this2._reconnectState.isReconnectingViaSocketio) {
                      _this2.debug && console.log("[" + _this2 + "] won't reconnect again, client already reconnecting");
                      return;
                    }

                    _this2.debug && console.log("[" + _this2 + "] initiating reconnection to tracker");
                    _this2.register();
                  }, 20);
                });

                socket.on("reconnecting", function () {
                  _this2.debug && console.log("[" + _this2 + "] reconnecting", _this2._reconnectState);
                  _this2.emit("reconnecting", _this2);
                  if (_this2._reconnectState.closed) {
                    _this2._reconnectState.isReconnecting = false;
                    _this2._reconnectState.isReconnectingViaSocketio = false;
                    socket.close();
                    _this2.close();
                  } else {
                    _this2._reconnectState.isReconnecting = true;
                    _this2._reconnectState.isReconnectingViaSocketio = true;
                  }
                });

                socket.on("reconnect", function () {
                  _this2.debug && console.log("[" + _this2 + "] reconnected");
                  _this2._reconnectState.isReconnecting = false;
                  _this2._reconnectState.isReconnectingViaSocketio = false;
                  _this2.register();
                });

                this.installEventToMessageTranslator(socket);

                this._reconnectState.isOpening = true;

                return _context.abrupt("return", new Promise(function (resolve, reject) {
                  socket.once("error", reject);
                  socket.once("connect", resolve);
                }).then(function () {
                  return _this2;
                }));

              case 20:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function open() {
        return _ref.apply(this, arguments);
      }

      return open;
    }()
  }, {
    key: "close",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var _this3 = this;

        var socket, reason;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this._reconnectState.closed = true;

                socket = this.socket;
                // this._socketioClient = null;

                if (socket) {
                  socket.removeAllListeners("reconnect");
                  socket.removeAllListeners("reconnecting");
                  socket.removeAllListeners("disconnect");
                  socket.removeAllListeners("connect");
                  socket.removeAllListeners("reconnect_error");
                  socket.removeAllListeners("reconnect_failed");
                  socket.removeAllListeners("close");
                  socket.removeAllListeners("error");
                  socket.close();
                }

                this.debug && console.log("[" + this + "] closing...");

                if (!this.isRegistered()) {
                  _context2.next = 7;
                  break;
                }

                _context2.next = 7;
                return this.unregister();

              case 7:
                if (!(!this.isOnline() && !this.socket)) {
                  _context2.next = 10;
                  break;
                }

                if (this.debug) {
                  reason = !this.isOnline() ? "not online" : "no socket";

                  this.debug && console.log("[" + this + "] cannot close: " + reason);
                }
                return _context2.abrupt("return", this);

              case 10:
                if (!(socket && !socket.connected)) {
                  _context2.next = 13;
                  break;
                }

                this.debug && console.log("[" + this + "] socket not connected, considering client closed");
                return _context2.abrupt("return", this);

              case 13:
                return _context2.abrupt("return", Promise.race([lively_lang.promise.delay(2000).then(function () {
                  return socket.removeAllListeners("disconnect");
                }), new Promise(function (resolve) {
                  return socket.once("disconnect", resolve);
                })]).then(function () {
                  _this3.debug && console.log("[" + _this3 + "] closed");
                  return _this3;
                }));

              case 14:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function close() {
        return _ref2.apply(this, arguments);
      }

      return close;
    }()
  }, {
    key: "remove",
    value: function remove() {
      var origin = this.origin,
          path = this.path,
          namespace = this.namespace,
          key = this.constructor.clientKey(origin, path, namespace);

      this.constructor.clients.delete(key);
      return this.close();
    }
  }, {
    key: "register",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        var _this4 = this;

        var answer, err, _err, _answer$data, trackerId, messageNumber, attempt, timeout;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!this.isRegistered()) {
                  _context3.next = 2;
                  break;
                }

                return _context3.abrupt("return");

              case 2:
                if (!this._reconnectState.closed) {
                  _context3.next = 6;
                  break;
                }

                this.debug && console.log("[" + this + "] not registering this b/c closed");
                this._reconnectState.registerAttempt = 0;
                return _context3.abrupt("return");

              case 6:
                if (!this._reconnectState.registerProcess) {
                  _context3.next = 9;
                  break;
                }

                this.debug && console.log("[" + this + "] not registering this b/c register process exists");
                return _context3.abrupt("return");

              case 9:
                _context3.prev = 9;

                if (this.isOnline()) {
                  _context3.next = 13;
                  break;
                }

                _context3.next = 13;
                return this.open();

              case 13:

                this.debug && console.log("[" + this + "] register");

                _context3.next = 16;
                return this.sendToAndWait("tracker", "register", _extends({
                  userName: "unknown",
                  type: "l2l " + (isNode ? "node" : "browser"),
                  location: determineLocation()
                }, this.info));

              case 16:
                answer = _context3.sent;

                if (answer.data) {
                  _context3.next = 21;
                  break;
                }

                err = new Error("Register answer is empty!");

                this.emit("error", err);
                throw err;

              case 21:
                if (!answer.data.isError) {
                  _context3.next = 25;
                  break;
                }

                _err = new Error(answer.data.error);

                this.emit("error", _err);
                throw _err;

              case 25:

                this._reconnectState.registerAttempt = 0;
                _answer$data = answer.data, trackerId = _answer$data.trackerId, messageNumber = _answer$data.messageNumber;

                this.trackerId = trackerId;
                this._incomingOrderNumberingBySenders.set(trackerId, messageNumber || 0);
                this.emit("registered", { trackerId: trackerId });

                _context3.next = 37;
                break;

              case 32:
                _context3.prev = 32;
                _context3.t0 = _context3["catch"](9);

                console.error("Error in register request of " + this + ": " + _context3.t0);
                attempt = this._reconnectState.registerAttempt++, timeout = lively_lang.num.backoff(attempt, 4 /*base*/, 5 * 60 * 1000 /*max*/);

                this._reconnectState.registerProcess = setTimeout(function () {
                  _this4._reconnectState.registerProcess = null;
                  _this4.register();
                }, timeout);

              case 37:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this, [[9, 32]]);
      }));

      function register() {
        return _ref3.apply(this, arguments);
      }

      return register;
    }()
  }, {
    key: "unregister",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        var trackerId;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (this.isRegistered()) {
                  _context4.next = 2;
                  break;
                }

                return _context4.abrupt("return");

              case 2:
                this.debug && console.log("[" + this + "] unregister");
                trackerId = this.trackerId;
                _context4.prev = 4;
                _context4.next = 7;
                return this.sendToAndWait(this.trackerId, "unregister", {});

              case 7:
                _context4.next = 11;
                break;

              case 9:
                _context4.prev = 9;
                _context4.t0 = _context4["catch"](4);

              case 11:
                this.renameTarget(trackerId, "tracker");
                this.trackerId = null;
                this.emit("unregistered", this);

              case 14:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[4, 9]]);
      }));

      function unregister() {
        return _ref4.apply(this, arguments);
      }

      return unregister;
    }()
  }, {
    key: "whenRegistered",
    value: function whenRegistered(timeout) {
      var _this5 = this;

      return lively_lang.promise.waitFor(timeout, function () {
        return _this5.isRegistered();
      }).catch(function (err) {
        return Promise.reject(/timeout/i.test(String(err)) ? new Error("Timeout in " + _this5 + ".whenRegistered") : err);
      });
    }
  }, {
    key: "send",
    value: function send(msg, ackFn) {
      var _this6 = this;

      var _prepareSend = this.prepareSend(msg, ackFn);

      var _prepareSend2 = slicedToArray(_prepareSend, 2);

      msg = _prepareSend2[0];
      ackFn = _prepareSend2[1];

      this.whenOnline().then(function () {
        var socket = _this6.socket,
            _msg = msg,
            action = _msg.action,
            target = _msg.target;

        if (!socket) throw new Error("Trying to send message " + action + " to " + target + " but cannot find a connection to it!");
        typeof ackFn === "function" ? socket.emit(action, msg, ackFn) : socket.emit(action, msg);
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // broadcasting

  }, {
    key: "joinRoom",
    value: function joinRoom(room) {
      var _this7 = this;

      return this.whenOnline().then(function () {
        return _this7.sendToAndWait(_this7.trackerId, "[broadcast] join room", { room: room });
      });
    }
  }, {
    key: "leaveRoom",
    value: function leaveRoom(room) {
      var _this8 = this;

      return this.whenOnline().then(function () {
        return _this8.sendToAndWait(_this8.trackerId, "[broadcast] leave room", { room: room });
      });
    }
  }, {
    key: "broadcast",
    value: function broadcast(room, action, data) {
      var _this9 = this;

      var isSystemBroadcast = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
      var isMultiServerBroadcast = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

      var broadcast = { action: action, room: room, broadcast: data };
      if (isSystemBroadcast) broadcast.isSystemBroadcast = true;
      if (isMultiServerBroadcast) broadcast.isMultiServerBroadcast = true;
      return this.whenOnline().then(function () {
        return _this9.sendToAndWait(_this9.trackerId, "[broadcast] send", broadcast);
      });
    }
  }, {
    key: "listRoomMembers",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(room) {
        var _ref6, data;

        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.sendToAndWait(this.trackerId, "[broadcast] list room members", { room: room });

              case 2:
                _ref6 = _context5.sent;
                data = _ref6.data;
                return _context5.abrupt("return", data);

              case 5:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function listRoomMembers(_x5) {
        return _ref5.apply(this, arguments);
      }

      return listRoomMembers;
    }()
  }, {
    key: "joinedRooms",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var _ref8, data;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.sendToAndWait(this.trackerId, "[broadcast] my rooms", {});

              case 2:
                _ref8 = _context6.sent;
                data = _ref8.data;
                return _context6.abrupt("return", data);

              case 5:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function joinedRooms() {
        return _ref7.apply(this, arguments);
      }

      return joinedRooms;
    }()
  }, {
    key: "listRooms",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        var _ref10, data;

        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.sendToAndWait(this.trackerId, "[broadcast] all rooms", {});

              case 2:
                _ref10 = _context7.sent;
                data = _ref10.data;
                return _context7.abrupt("return", data);

              case 5:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function listRooms() {
        return _ref9.apply(this, arguments);
      }

      return listRooms;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // user network related

  }, {
    key: "listPeers",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

        var _peersCached, t, timeout, _ref12, data, sessions;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _peersCached = this._peersCached, t = Date.now(), timeout = 1000;

                if (!(!force && _peersCached && t - _peersCached.timestamp < timeout)) {
                  _context8.next = 3;
                  break;
                }

                return _context8.abrupt("return", this._peersCached.sessions);

              case 3:
                if (this.isOnline()) {
                  _context8.next = 5;
                  break;
                }

                return _context8.abrupt("return", []);

              case 5:
                _context8.next = 7;
                return this.sendToAndWait(this.trackerId, "getClients", {});

              case 7:
                _ref12 = _context8.sent;
                data = _ref12.data;
                sessions = data.map(function (_ref13) {
                  var _ref14 = slicedToArray(_ref13, 2),
                      id = _ref14[0],
                      record = _ref14[1];

                  var _ref15 = record.info || {},
                      userRealm = _ref15.userRealm,
                      userToken = _ref15.userToken,
                      l2lUserToken = _ref15.l2lUserToken,
                      location = _ref15.location,
                      type = _ref15.type,
                      world = _ref15.world,
                      peer = _extends({}, lively_lang.obj.dissoc(record, ["info"]), { id: id, world: world, location: location, type: type });

                  userToken = userToken || l2lUserToken;
                  if (userToken && userToken !== "null") {
                    if (lively.user) {
                      peer.user = lively.user.ClientUser.fromToken(userToken, userRealm);
                    } else {
                      peer.userToken = userToken;
                      peer.userRealm = userRealm;
                    }
                  }
                  return peer;
                });


                this._peersCached = { timestamp: t, sessions: sessions };
                return _context8.abrupt("return", sessions);

              case 12:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function listPeers() {
        return _ref11.apply(this, arguments);
      }

      return listPeers;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // debugging

  }, {
    key: "toString",
    value: function toString() {
      var origin = this.origin,
          path = this.path,
          namespace = this.namespace,
          id = this.id,
          state = !this.isOnline() ? "disconnected" : !this.isRegistered() ? "unregistered" : "registered",
          shortId = (id || "").slice(0, 5);

      return "L2LClient(" + shortId + " " + origin + path + " - " + namespace + " " + state + ")";
    }
  }, {
    key: "socket",
    get: function get$$1() {
      return this._socketioClient;
    }
  }, {
    key: "socketId",
    get: function get$$1() {
      return this.socket ? this.namespace + "#" + this.socket.id : null;
    }
  }]);
  return L2LClient;
}(L2LConnection);

return L2LClient;

}(lively.lang,io));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.l2l.client;
})();