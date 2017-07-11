
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  (function() {
    this.lively = this.lively || {};
this.lively.user = (function () {
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
            _context.t0 = _context["catch"](6);

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
            return _context.abrupt("return", json);

          case 18:
          case "end":
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
    key: "named",
    value: function named(name, url) {
      var key = name + "-" + url;
      var user = userMap.get(key);
      if (!user) {
        user = new this(name, url);
        userMap.set(key, user);
      }
      return user;
    }
  }, {
    key: "fromToken",
    value: function fromToken(token, url) {
      var _jwtTokenDecode = jwtTokenDecode(token),
          name = _jwtTokenDecode.name,
          roles = _jwtTokenDecode.roles,
          createdAt = _jwtTokenDecode.createdAt,
          email = _jwtTokenDecode.email;

      return Object.assign(this.named(name, url), { roles: roles, createdAt: createdAt, email: email, token: token });
    }
  }, {
    key: "clearCache",
    value: function clearCache() {
      userMap = new Map();
    }
  }, {
    key: "guest",
    get: function get() {
      return guestUser;
    }
  }]);

  function User(name, url) {
    classCallCheck(this, User);

    this.url = url;
    this.name = name;
    this.roles = {};
    this.createdAt = 0;
    this.email = null;
    this.token = null;
  }

  createClass(User, [{
    key: "isLoggedIn",
    value: function isLoggedIn() {
      return !!this.token;
    }
  }, {
    key: "loginOrRegister",
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

                return _context2.abrupt("return", answer);

              case 10:
                token = answer.token, _jwtTokenDecode2 = jwtTokenDecode(token), roles = _jwtTokenDecode2.roles, createdAt = _jwtTokenDecode2.createdAt, email = _jwtTokenDecode2.email;

                Object.assign(this, { roles: roles, createdAt: createdAt, email: email, token: token });
                return _context2.abrupt("return", { status: answer.status });

              case 13:
              case "end":
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
    key: "login",
    value: function login(password) {
      return this.loginOrRegister("login", password, this.url);
    }
  }, {
    key: "register",
    value: function register(password) {
      return this.loginOrRegister("register", password, this.url);
    }
  }, {
    key: "toString",
    value: function toString() {
      return "<User " + this.name + " logged in: " + this.isLoggedIn() + ">";
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
    key: "isLoggedIn",
    value: function isLoggedIn() {
      return false;
    }
  }, {
    key: "loginOrRegister",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(action, password, authServerURL) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                throw new Error("Guest user cannot " + action + "!");

              case 1:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function loginOrRegister(_x8, _x9, _x10) {
        return _ref3.apply(this, arguments);
      }

      return loginOrRegister;
    }()
  }, {
    key: "toString",
    value: function toString() {
      return "<GuestUser " + this.name + ">";
    }
  }, {
    key: "isGuestUser",
    get: function get() {
      return true;
    }
  }]);
  return GuestUser;
}(User);

var guestUser = guestUser || new GuestUser("guest");
var userMap = userMap || new Map();

return User;

}());

  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.user;
})();
