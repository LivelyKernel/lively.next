
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  (function() {
    this.lively = this.lively || {};
(function (exports) {
'use strict';

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

var get$1 = function get$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
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



var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
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

var POST = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(url, body) {
    var res, text, json;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (typeof body !== "string") body = JSON.stringify(body);
            _context.next = 3;
            return makeRequest(url, "POST", body, {});

          case 3:
            res = _context.sent;
            text = void 0;
            json = void 0;
            _context.prev = 6;
            _context.next = 9;
            return res.text();

          case 9:
            text = _context.sent;
            _context.next = 14;
            break;

          case 12:
            _context.prev = 12;
            _context.t0 = _context['catch'](6);

          case 14:
            if (text && res.headers.get("content-type") === "application/json") {
              try {
                json = JSON.parse(text);
              } catch (err) {}
            }

            if (json) {
              _context.next = 17;
              break;
            }

            throw new Error("Unexpected response: " + text);

          case 17:
            return _context.abrupt('return', json);

          case 18:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[6, 12]]);
  }));

  return function POST(_x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

/*global fetch*/

function jwtTokenDecode(token) {
  var _token$split = token.split("."),
      _token$split2 = slicedToArray(_token$split, 3),
      a = _token$split2[0],
      b = _token$split2[1],
      c = _token$split2[2];

  return JSON.parse(atob(b));
}

function guid() {
  var s4 = function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  };
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function makeRequest(url) {
  var method = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "GET";
  var body = arguments[2];
  var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

  var useCors = true,
      fetchOpts = { method: method };
  if (useCors) fetchOpts.mode = "cors";
  if (body) fetchOpts.body = body;
  fetchOpts.redirect = 'follow';
  fetchOpts.headers = _extends({}, headers);
  return fetch(url, fetchOpts);
}

var User = function () {
  createClass(User, null, [{
    key: 'named',
    value: function named(name, url) {
      var key = name + "-" + url,
          user = userMap.get(key);
      if (!user) {
        user = new this(name, url);
        userMap.set(key, user);
      }
      return user;
    }
  }, {
    key: 'fromToken',
    value: function fromToken(token, url) {
      var _jwtTokenDecode = jwtTokenDecode(token),
          name = _jwtTokenDecode.name,
          roles = _jwtTokenDecode.roles,
          createdAt = _jwtTokenDecode.createdAt,
          email = _jwtTokenDecode.email;

      return Object.assign(this.named(name, url), { roles: roles, createdAt: createdAt, email: email, token: token });
    }
  }, {
    key: 'clearCache',
    value: function clearCache() {
      userMap = new Map();
    }
  }, {
    key: 'guest',
    get: function get() {
      return guestUser;
    }
  }]);

  function User(name, url) {
    classCallCheck(this, User);

    this.realm = url;
    this.name = name;
    this.roles = {};
    this.createdAt = 0;
    this.email = null;
    this.token = null;
  }

  createClass(User, [{
    key: 'isLoggedIn',
    value: function isLoggedIn() {
      return !!this.token;
    }
  }, {
    key: 'loginOrRegister',
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(action, password, authServerURL) {
        var email, createdAt, roles, name, payload, answer, token, _jwtTokenDecode2;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                email = this.email;
                createdAt = this.createdAt;
                roles = this.roles;
                name = this.name;
                payload = action === "register" ? { password: password, email: email, createdAt: createdAt, roles: roles, name: name } : { password: password, name: name };
                _context2.next = 7;
                return POST(authServerURL + "/" + action, payload);

              case 7:
                answer = _context2.sent;

                if (!answer.error) {
                  _context2.next = 10;
                  break;
                }

                return _context2.abrupt('return', answer);

              case 10:
                token = answer.token, _jwtTokenDecode2 = jwtTokenDecode(token), roles = _jwtTokenDecode2.roles, createdAt = _jwtTokenDecode2.createdAt, email = _jwtTokenDecode2.email;

                Object.assign(this, { roles: roles, createdAt: createdAt, email: email, token: token });
                return _context2.abrupt('return', { status: answer.status });

              case 13:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function loginOrRegister(_x5, _x6, _x7) {
        return _ref2.apply(this, arguments);
      }

      return loginOrRegister;
    }()
  }, {
    key: 'verify',
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        var _ref4, error, status;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return POST(this.realm + "/verify", { token: this.token });

              case 2:
                _ref4 = _context3.sent;
                error = _ref4.error;
                status = _ref4.status;
                return _context3.abrupt('return', error ? false : true);

              case 6:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function verify() {
        return _ref3.apply(this, arguments);
      }

      return verify;
    }()
  }, {
    key: 'login',
    value: function login(password) {
      return this.loginOrRegister("login", password, this.realm);
    }
  }, {
    key: 'register',
    value: function register(password) {
      return this.loginOrRegister("register", password, this.realm);
    }
  }, {
    key: 'checkPassword',
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(password) {
        var _ref6, error, status;

        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (this.isLoggedIn) {
                  _context4.next = 2;
                  break;
                }

                throw new Error("To check password, user needs to login.");

              case 2:
                _context4.next = 4;
                return POST(this.realm + "/check-password", { token: this.token, password: password });

              case 4:
                _ref6 = _context4.sent;
                error = _ref6.error;
                status = _ref6.status;

                if (!error) {
                  _context4.next = 9;
                  break;
                }

                throw new Error(error);

              case 9:
                return _context4.abrupt('return', status);

              case 10:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function checkPassword(_x8) {
        return _ref5.apply(this, arguments);
      }

      return checkPassword;
    }()
  }, {
    key: 'modify',
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(changes) {
        var _ref8, error, status, token, _jwtTokenDecode3, name, roles, createdAt, email;

        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return POST(this.realm + "/modify", { token: this.token, changes: changes });

              case 2:
                _ref8 = _context5.sent;
                error = _ref8.error;
                status = _ref8.status;
                token = _ref8.token;

                if (!error) {
                  _context5.next = 8;
                  break;
                }

                return _context5.abrupt('return', { error: error });

              case 8:
                if (token) {
                  _jwtTokenDecode3 = jwtTokenDecode(token), name = _jwtTokenDecode3.name, roles = _jwtTokenDecode3.roles, createdAt = _jwtTokenDecode3.createdAt, email = _jwtTokenDecode3.email;

                  Object.assign(this, { roles: roles, createdAt: createdAt, email: email, token: token });
                }

                return _context5.abrupt('return', { status: status });

              case 10:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function modify(_x9) {
        return _ref7.apply(this, arguments);
      }

      return modify;
    }()
  }, {
    key: 'toString',
    value: function toString() {
      return '<' + this.constructor.name + ' ' + this.name + ' ' + (this.isLoggedIn() ? "" : "not ") + 'logged in>';
    }
  }]);
  return User;
}();

var GuestUser = function (_User) {
  inherits(GuestUser, _User);

  function GuestUser() {
    classCallCheck(this, GuestUser);
    return possibleConstructorReturn(this, (GuestUser.__proto__ || Object.getPrototypeOf(GuestUser)).apply(this, arguments));
  }

  createClass(GuestUser, [{
    key: 'isLoggedIn',
    value: function isLoggedIn() {
      return false;
    }
  }, {
    key: 'loginOrRegister',
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(action, password, authServerURL) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                throw new Error("Guest user cannot " + action + "!");

              case 1:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function loginOrRegister(_x10, _x11, _x12) {
        return _ref9.apply(this, arguments);
      }

      return loginOrRegister;
    }()
  }, {
    key: 'isGuestUser',
    get: function get() {
      return true;
    }
  }]);
  return GuestUser;
}(User);

var userMap = userMap || new Map();
var guestUser = guestUser || GuestUser.named("guest-" + guid(), null);

/*global System*/
var UserRegistry = function () {
  function UserRegistry() {
    classCallCheck(this, UserRegistry);
  }

  createClass(UserRegistry, [{
    key: "hasUserStored",
    value: function hasUserStored() {
      try {
        return !!localStorage["lively.user"] || !!sessionStorage["lively.user"];
      } catch (err) {
        return false;
      }
    }
  }, {
    key: "login",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(user, password) {
        var _ref2, error;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (user.isGuestUser) {
                  _context.next = 7;
                  break;
                }

                _context.next = 3;
                return user.login(password);

              case 3:
                _ref2 = _context.sent;
                error = _ref2.error;

                if (!error) {
                  _context.next = 7;
                  break;
                }

                throw Error(error);

              case 7:
                this.saveUserToLocalStorage(user);
                return _context.abrupt("return", user);

              case 9:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function login(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return login;
    }()
  }, {
    key: "logout",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(user) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                try {
                  delete localStorage["lively.user"];
                  delete sessionStorage["lively.user"];
                } catch (err) {}
                user = user && user.isGuestUser ? user : User.guest;
                if (lively.notifications) lively.notifications.emit("lively.user/userchanged", { user: user }, Date.now(), System);
                return _context2.abrupt("return", user);

              case 4:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function logout(_x3) {
        return _ref3.apply(this, arguments);
      }

      return logout;
    }()
  }, {
    key: "register",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(user, password) {
        var _ref5, error;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!(!user || user.isGuestUser)) {
                  _context3.next = 2;
                  break;
                }

                throw new Error("guest users cannot register");

              case 2:
                _context3.next = 4;
                return user.register(password);

              case 4:
                _ref5 = _context3.sent;
                error = _ref5.error;

                if (!error) {
                  _context3.next = 8;
                  break;
                }

                throw Error(error);

              case 8:
                this.saveUserToLocalStorage(user);
                return _context3.abrupt("return", user);

              case 10:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function register(_x4, _x5) {
        return _ref4.apply(this, arguments);
      }

      return register;
    }()
  }, {
    key: "loadUserFromLocalStorage",
    value: function loadUserFromLocalStorage(authServerURL) {
      try {
        var stored = localStorage["lively.user"] || sessionStorage["lively.user"];
        if (stored) {
          stored = JSON.parse(stored);
          return stored.isGuest ? GuestUser.named(stored.name, null) : User.fromToken(stored.token, authServerURL);
        }
      } catch (err) {
        console.warn("Could not read user from localStorage: " + err);
      }
      return GuestUser.guest;
    }
  }, {
    key: "saveUserToLocalStorage",
    value: function saveUserToLocalStorage(user) {
      if (!user || !user.isGuestUser && !user.token) return false;

      if (lively.notifications) lively.notifications.emit("lively.user/userchanged", { user: user }, Date.now(), System);

      try {
        if (user.isGuestUser) {
          sessionStorage["lively.user"] = JSON.stringify({ isGuest: true, name: user.name });
          delete localStorage["lively.user"];
        } else {
          localStorage["lively.user"] = JSON.stringify({ token: user.token });
        }
        return true;
      } catch (err) {
        console.warn("Could not save user into local/sessionStorage: " + err);
        return false;
      }
    }
  }], [{
    key: "current",
    get: function get() {
      return this._current || (this._current = new this());
    }
  }]);
  return UserRegistry;
}();

exports.ClientUser = User;
exports.GuestUser = GuestUser;
exports.UserRegistry = UserRegistry;

}((this.lively.user = this.lively.user || {})));

  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.user;
})();
