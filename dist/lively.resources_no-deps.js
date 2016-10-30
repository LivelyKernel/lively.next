(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,fs) {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};





var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();



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

var slashEndRe = /\/+$/;
var slashStartRe = /^\/+/;
var protocolRe = /^[a-z0-9-_]+:/;
var slashslashRe = /^\/\/[^\/]+/;

function nyi(obj, name) {
  throw new Error(name + " for " + obj.constructor.name + " not yet implemented");
}

var Resource = function () {
  createClass(Resource, null, [{
    key: "fromProps",
    value: function fromProps() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      // props can have the keys contentType, type, size, etag, created, lastModified, url
      // it should have at least url
      return new this(props.url).assignProperties(props);
    }
  }]);

  function Resource(url) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, Resource);

    if (!url) throw new Error("Cannot create resource without url");
    this.url = String(url);
    this.lastModified = undefined;
    this.created = undefined;
    this.etag = undefined;
    this.size = undefined;
    this.type = undefined;
    this.contentType = undefined;
  }

  createClass(Resource, [{
    key: "equals",
    value: function equals(otherResource) {
      if (!otherResource || this.constructor !== otherResource.constructor) return false;
      var myURL = this.url,
          otherURL = otherResource.url;
      if (myURL[myURL.length - 1] === "/") myURL = myURL.slice(0, -1);
      if (otherURL[otherURL.length - 1] === "/") otherURL = otherURL.slice(0, -1);
      return myURL === otherURL;
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.constructor.name + "(\"" + this.url + "\")";
    }
  }, {
    key: "path",
    value: function path() {
      var path = this.url.replace(protocolRe, "").replace(slashslashRe, "");
      return path === "" ? "/" : path;
    }
  }, {
    key: "name",
    value: function name() {
      return this.path().replace(/\/$/, "").split("/").slice(-1)[0];
    }
  }, {
    key: "schemeAndHost",
    value: function schemeAndHost() {
      if (this.isRoot()) return this.asFile().url;
      return this.url.slice(0, this.url.length - this.path().length);
    }
  }, {
    key: "parent",
    value: function parent() {
      if (this.isRoot()) return null;
      return resource(this.url.replace(slashEndRe, "").split("/").slice(0, -1).join("/") + "/");
    }
  }, {
    key: "parents",
    value: function parents() {
      var result = [],
          p = this.parent();
      while (p) {
        result.unshift(p);p = p.parent();
      }
      return result;
    }
  }, {
    key: "isParentOf",
    value: function isParentOf(otherRes) {
      var _this = this;

      return otherRes.schemeAndHost() === this.schemeAndHost() && otherRes.parents().some(function (p) {
        return p.equals(_this);
      });
    }
  }, {
    key: "commonDirectory",
    value: function commonDirectory(other) {
      if (other.schemeAndHost() !== this.schemeAndHost()) return null;
      if (this.isDirectory() && this.equals(other)) return this;
      if (this.isRoot()) return this.asDirectory();
      if (other.isRoot()) return other.asDirectory();
      var otherParents = other.parents(),
          myParents = this.parents(),
          common = this.root();
      for (var i = 0; i < myParents.length; i++) {
        var myP = myParents[i],
            otherP = otherParents[i];
        if (!otherP || !myP.equals(otherP)) return common;
        common = myP;
      }
      return common;
    }
  }, {
    key: "join",
    value: function join(path) {
      return resource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
    }
  }, {
    key: "isRoot",
    value: function isRoot() {
      return this.path() === "/";
    }
  }, {
    key: "isFile",
    value: function isFile() {
      return !this.isRoot() && !this.url.match(slashEndRe);
    }
  }, {
    key: "isDirectory",
    value: function isDirectory() {
      return !this.isFile();
    }
  }, {
    key: "asDirectory",
    value: function asDirectory() {
      if (this.url.endsWith("/")) return this;
      return resource(this.url.replace(slashEndRe, "") + "/");
    }
  }, {
    key: "root",
    value: function root() {
      if (this.isRoot()) return this;
      var toplevel = this.url.slice(0, -this.path().length);
      return resource(toplevel + "/");
    }
  }, {
    key: "asFile",
    value: function asFile() {
      if (!this.url.endsWith("/")) return this;
      return resource(this.url.replace(slashEndRe, ""));
    }
  }, {
    key: "assignProperties",
    value: function assignProperties(props) {
      // lastModified, etag, ...
      for (var name in props) {
        if (name !== "url") this[name] = props[name];
      }return this;
    }
  }, {
    key: "ensureExistance",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(optionalContent) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.exists();

              case 2:
                if (!_context.sent) {
                  _context.next = 4;
                  break;
                }

                return _context.abrupt("return", this);

              case 4:
                _context.next = 6;
                return this.parent().ensureExistance();

              case 6:
                if (!this.isFile()) {
                  _context.next = 11;
                  break;
                }

                _context.next = 9;
                return this.write(optionalContent || "");

              case 9:
                _context.next = 13;
                break;

              case 11:
                _context.next = 13;
                return this.mkdir();

              case 13:
                return _context.abrupt("return", this);

              case 14:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ensureExistance(_x3) {
        return _ref.apply(this, arguments);
      }

      return ensureExistance;
    }()
  }, {
    key: "read",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                nyi(this, "read");
              case 1:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function read() {
        return _ref2.apply(this, arguments);
      }

      return read;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                nyi(this, "write");
              case 1:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function write() {
        return _ref3.apply(this, arguments);
      }

      return write;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                nyi(this, "exists");
              case 1:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function exists$$1() {
        return _ref4.apply(this, arguments);
      }

      return exists$$1;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                nyi(this, "remove");
              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function remove() {
        return _ref5.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "dirList",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(depth, opts) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                nyi(this, "dirList");
              case 1:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function dirList(_x4, _x5) {
        return _ref6.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "readProperties",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(opts) {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                nyi(this, "readProperties");
              case 1:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function readProperties(_x6) {
        return _ref7.apply(this, arguments);
      }

      return readProperties;
    }()
  }, {
    key: "isResource",
    get: function get() {
      return true;
    }
  }]);
  return Resource;
}();

function applyExclude(exclude, resources) {
  if (Array.isArray(exclude)) return exclude.reduce(function (intersect, exclude) {
    return applyExclude(exclude, intersect);
  }, resources);
  if (typeof exclude === "string") return resources.filter(function (ea) {
    return ea.path() !== exclude && ea.name() !== exclude;
  });
  if (exclude instanceof RegExp) return resources.filter(function (ea) {
    return !exclude.test(ea.path()) && !exclude.test(ea.name());
  });
  if (typeof exclude === "function") return resources.filter(function (ea) {
    return !exclude(ea);
  });
  return resources;
}

/*

applyExclude(["foo", "foo"], [
  {path: () => "foo", name: () => "foo"},
  {path: () => "bar", name: () => "bar"},
  {path: () => "baz", name: () => "baz"}
])

applyExclude(["bar", "foo"], [
  {path: () => "foo", name: () => "foo"},
  {path: () => "bar", name: () => "bar"},
  {path: () => "baz", name: () => "baz"}
])

*/

/*global fetch, Headers, DOMParser, XPathEvaluator, XPathResult, Namespace*/

var XPathQuery = function () {
  function XPathQuery(expression) {
    classCallCheck(this, XPathQuery);

    this.expression = expression;
    this.contextNode = null;
    this.xpe = new XPathEvaluator();
  }

  createClass(XPathQuery, [{
    key: "establishContext",
    value: function establishContext(node) {
      if (this.nsResolver) return;
      var ctx = node.ownerDocument ? node.ownerDocument.documentElement : node.documentElement;
      if (ctx !== this.contextNode) {
        this.contextNode = ctx;
        this.nsResolver = this.xpe.createNSResolver(ctx);
      }
    }
  }, {
    key: "manualNSLookup",
    value: function manualNSLookup() {
      this.nsResolver = function (prefix) {
        return Namespace[prefix.toUpperCase()] || null;
      };
      return this;
    }
  }, {
    key: "findAll",
    value: function findAll(node, defaultValue) {
      this.establishContext(node);
      var result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null),
          accumulator = [],
          res = null;
      while (res = result.iterateNext()) {
        accumulator.push(res);
      }return accumulator.length > 0 || defaultValue === undefined ? accumulator : defaultValue;
    }
  }, {
    key: "findFirst",
    value: function findFirst(node) {
      this.establishContext(node);
      var result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null);
      return result.iterateNext();
    }
  }]);
  return XPathQuery;
}();

function davNs(xmlString) {
  // finds the declaration of the webdav namespace, usually "d" or "D"
  var davNSMatch = xmlString.match(/\/([a-z]+?):multistatus/i);
  return davNSMatch ? davNSMatch[1] : "d";
}

var propertyNodeMap = {
  getlastmodified: "lastModified",
  creationDate: "created",
  getetag: "etag",
  getcontentlength: "size",
  resourcetype: "type", // collection or file
  getcontenttype: "contentType" // mime type
};
function readPropertyNode(propNode) {
  var result = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var tagName = propNode.tagName.replace(/[^:]+:/, ""),
      key = propertyNodeMap[tagName],
      value = propNode.textContent;
  switch (key) {
    case 'lastModified':
    case 'created':
      value = new Date(value);break;
    case 'size':
      value = Number(value);break;
    default:
    // code
  }
  result[key] = value;
  return result;
}

function readXMLPropfindResult(xmlString) {
  // the xmlString looks like this:
  // <?xml version="1.0" encoding="utf-8"?>
  // <d:multistatus xmlns:d="DAV:" xmlns:a="http://ajax.org/2005/aml">
  //   <d:response>
  //     <d:href>sub-dir/</d:href>
  //     <d:propstat>
  //       <d:prop>
  //         <d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">Fri, 24 Jun 2016 09:58:20 -0700</d:getlastmodified>
  //         <d:resourcetype>
  //           <d:collection/>
  //         </d:resourcetype>
  //       </d:prop>
  //       <d:status>HTTP/1.1 200 Ok</d:status>
  //     </d:propstat>
  //   </d:response>
  // ...
  // </d:multistatus>

  var doc = new DOMParser().parseFromString(xmlString, "text/xml"),
      ns = davNs(xmlString),
      nodes = new XPathQuery("/" + ns + ":multistatus/" + ns + ":response").findAll(doc.documentElement),
      urlQ = new XPathQuery(ns + ":href"),
      propsQ = new XPathQuery(ns + ":propstat/" + ns + ":prop");

  return nodes.map(function (node) {
    var propsNode = propsQ.findFirst(node),
        props = Array.from(propsNode.childNodes).reduce(function (props, node) {
      return readPropertyNode(node, props);
    }, {}),
        urlNode = urlQ.findFirst(node);
    props.url = urlNode.textContent || urlNode.text; // text is FIX for IE9+;
    return props;
  });
}

var WebDAVResource = function (_Resource) {
  inherits(WebDAVResource, _Resource);

  function WebDAVResource() {
    classCallCheck(this, WebDAVResource);
    return possibleConstructorReturn(this, (WebDAVResource.__proto__ || Object.getPrototypeOf(WebDAVResource)).apply(this, arguments));
  }

  createClass(WebDAVResource, [{
    key: "read",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return fetch(this.url, { mode: 'cors' });

              case 2:
                return _context.abrupt("return", _context.sent.text());

              case 3:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function read() {
        return _ref.apply(this, arguments);
      }

      return read;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(content) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (this.isFile()) {
                  _context2.next = 2;
                  break;
                }

                throw new Error("Cannot write a non-file: " + this.url);

              case 2:
                _context2.next = 4;
                return fetch(this.url, { mode: 'cors', method: "PUT", body: content });

              case 4:
                return _context2.abrupt("return", this);

              case 5:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function write(_x2) {
        return _ref2.apply(this, arguments);
      }

      return write;
    }()
  }, {
    key: "mkdir",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!this.isFile()) {
                  _context3.next = 2;
                  break;
                }

                throw new Error("Cannot mkdir on a file: " + this.url);

              case 2:
                _context3.next = 4;
                return fetch(this.url, { mode: 'cors', method: "MKCOL" });

              case 4:
                return _context3.abrupt("return", this);

              case 5:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function mkdir$$1() {
        return _ref3.apply(this, arguments);
      }

      return mkdir$$1;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (!this.isRoot()) {
                  _context4.next = 4;
                  break;
                }

                _context4.t0 = true;
                _context4.next = 7;
                break;

              case 4:
                _context4.next = 6;
                return fetch(this.url, { mode: 'cors', method: "HEAD" });

              case 6:
                _context4.t0 = !!_context4.sent.ok;

              case 7:
                return _context4.abrupt("return", _context4.t0);

              case 8:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function exists$$1() {
        return _ref4.apply(this, arguments);
      }

      return exists$$1;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return fetch(this.url, { mode: 'cors', method: "DELETE" });

              case 2:
                return _context5.abrupt("return", this);

              case 3:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function remove() {
        return _ref5.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "_propfind",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var res, xmlString, root;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return fetch(this.url, {
                  method: "PROPFIND",
                  mode: 'cors',
                  redirect: 'follow',
                  // body: propfindRequestPayload(),
                  headers: new Headers({
                    'Content-Type': 'text/xml'
                  })
                });

              case 2:
                res = _context6.sent;

                if (res.ok) {
                  _context6.next = 5;
                  break;
                }

                throw new Error("Error in dirList for " + this.url + ": " + res.statusText);

              case 5:
                _context6.next = 7;
                return res.text();

              case 7:
                xmlString = _context6.sent;
                root = this.root();
                return _context6.abrupt("return", readXMLPropfindResult(xmlString).map(function (props) {
                  return root.join(props.url).assignProperties(props);
                }));

              case 10:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function _propfind() {
        return _ref6.apply(this, arguments);
      }

      return _propfind;
    }()
  }, {
    key: "dirList",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        var _this2 = this;

        var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var exclude, resources, self, _ret;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                if (!(typeof depth !== "number" && depth !== 'infinity')) {
                  _context8.next = 2;
                  break;
                }

                throw new Error("dirList \u2013 invalid depth argument: " + depth);

              case 2:
                exclude = opts.exclude;


                if (depth <= 0) depth = 1;

                if (!(depth === 1)) {
                  _context8.next = 13;
                  break;
                }

                _context8.next = 7;
                return this._propfind();

              case 7:
                resources = _context8.sent;
                self = resources.shift();

                if (exclude) resources = applyExclude(exclude, resources);
                return _context8.abrupt("return", resources);

              case 13:
                return _context8.delegateYield(regeneratorRuntime.mark(function _callee7() {
                  var subResources, subCollections;
                  return regeneratorRuntime.wrap(function _callee7$(_context7) {
                    while (1) {
                      switch (_context7.prev = _context7.next) {
                        case 0:
                          _context7.next = 2;
                          return _this2.dirList(1, opts);

                        case 2:
                          subResources = _context7.sent;
                          subCollections = subResources.filter(function (ea) {
                            return ea.isDirectory();
                          });
                          return _context7.abrupt("return", {
                            v: Promise.all(subCollections.map(function (col) {
                              return col.dirList(typeof depth === "number" ? depth - 1 : depth, opts);
                            })).then(function (recursiveResult) {
                              return recursiveResult.reduce(function (all, ea) {
                                return all.concat(ea);
                              }, subResources);
                            })
                          });

                        case 5:
                        case "end":
                          return _context7.stop();
                      }
                    }
                  }, _callee7, _this2);
                })(), "t0", 14);

              case 14:
                _ret = _context8.t0;

                if (!((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object")) {
                  _context8.next = 17;
                  break;
                }

                return _context8.abrupt("return", _ret.v);

              case 17:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function dirList(_x3, _x4) {
        return _ref7.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "readProperties",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(opts) {
        var props;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return this._propfind();

              case 2:
                props = _context9.sent[0];
                return _context9.abrupt("return", this.assignProperties(props));

              case 4:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function readProperties(_x7) {
        return _ref8.apply(this, arguments);
      }

      return readProperties;
    }()
  }]);
  return WebDAVResource;
}(Resource);

function wrapInPromise(func) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return new Promise(function (resolve, reject) {
      return func.apply(null, args.concat(function (err, result) {
        return err ? reject(err) : resolve(result);
      }));
    });
  };
}

var readFileP = wrapInPromise(fs.readFile);
var writeFileP = wrapInPromise(fs.writeFile);
var existsP = function existsP(path) {
  return new Promise(function (resolve, reject) {
    return fs.exists(path, function (exists$$1) {
      return resolve(!!exists$$1);
    });
  });
};
var readdirP = wrapInPromise(fs.readdir);
var mkdirP = wrapInPromise(fs.mkdir);
var rmdirP = wrapInPromise(fs.rmdir);
var unlinkP = wrapInPromise(fs.unlink);
var lstatP = wrapInPromise(fs.lstat);

var NodeJSFileResource = function (_Resource) {
  inherits(NodeJSFileResource, _Resource);

  function NodeJSFileResource() {
    classCallCheck(this, NodeJSFileResource);
    return possibleConstructorReturn(this, (NodeJSFileResource.__proto__ || Object.getPrototypeOf(NodeJSFileResource)).apply(this, arguments));
  }

  createClass(NodeJSFileResource, [{
    key: "stat",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", lstatP(this.path()));

              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function stat() {
        return _ref.apply(this, arguments);
      }

      return stat;
    }()
  }, {
    key: "read",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                return _context2.abrupt("return", readFileP(this.path()).then(String));

              case 1:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function read() {
        return _ref2.apply(this, arguments);
      }

      return read;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(content) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!this.isDirectory()) {
                  _context3.next = 2;
                  break;
                }

                throw new Error("Cannot write into a directory: " + this.path());

              case 2:
                _context3.next = 4;
                return writeFileP(this.path(), content);

              case 4:
                return _context3.abrupt("return", this);

              case 5:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function write(_x) {
        return _ref3.apply(this, arguments);
      }

      return write;
    }()
  }, {
    key: "mkdir",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(content) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (!this.isFile()) {
                  _context4.next = 2;
                  break;
                }

                throw new Error("Cannot mkdir on a file: " + this.path());

              case 2:
                _context4.next = 4;
                return mkdirP(this.path());

              case 4:
                return _context4.abrupt("return", this);

              case 5:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function mkdir$$1(_x2) {
        return _ref4.apply(this, arguments);
      }

      return mkdir$$1;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt("return", this.isRoot() ? true : existsP(this.path()));

              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function exists$$1() {
        return _ref5.apply(this, arguments);
      }

      return exists$$1;
    }()
  }, {
    key: "dirList",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var exclude, _subResources, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, name, subResource, stat, subResources, subCollections;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                if (!(typeof depth !== "number" && depth !== 'infinity')) {
                  _context6.next = 2;
                  break;
                }

                throw new Error("dirList \u2013 invalid depth argument: " + depth);

              case 2:
                exclude = opts.exclude;


                if (depth <= 0) depth = 1;

                if (!(depth === 1)) {
                  _context6.next = 42;
                  break;
                }

                _subResources = [];
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context6.prev = 9;
                _context6.next = 12;
                return readdirP(this.path());

              case 12:
                _context6.t0 = Symbol.iterator;
                _iterator = _context6.sent[_context6.t0]();

              case 14:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context6.next = 26;
                  break;
                }

                name = _step.value;
                subResource = this.join(name);
                _context6.next = 19;
                return subResource.stat();

              case 19:
                stat = _context6.sent;

                subResource = stat.isDirectory() ? subResource.asDirectory() : subResource;
                subResource._assignPropsFromStat(stat);
                _subResources.push(subResource);

              case 23:
                _iteratorNormalCompletion = true;
                _context6.next = 14;
                break;

              case 26:
                _context6.next = 32;
                break;

              case 28:
                _context6.prev = 28;
                _context6.t1 = _context6["catch"](9);
                _didIteratorError = true;
                _iteratorError = _context6.t1;

              case 32:
                _context6.prev = 32;
                _context6.prev = 33;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 35:
                _context6.prev = 35;

                if (!_didIteratorError) {
                  _context6.next = 38;
                  break;
                }

                throw _iteratorError;

              case 38:
                return _context6.finish(35);

              case 39:
                return _context6.finish(32);

              case 40:
                if (exclude) _subResources = applyExclude(exclude, _subResources);
                return _context6.abrupt("return", _subResources);

              case 42:
                _context6.next = 44;
                return this.dirList(1, opts);

              case 44:
                subResources = _context6.sent;
                subCollections = subResources.filter(function (ea) {
                  return ea.isDirectory();
                });
                return _context6.abrupt("return", Promise.all(subCollections.map(function (col) {
                  return col.dirList(typeof depth === "number" ? depth - 1 : depth, opts);
                })).then(function (recursiveResult) {
                  return recursiveResult.reduce(function (all, ea) {
                    return all.concat(ea);
                  }, subResources);
                }));

              case 47:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this, [[9, 28, 32, 40], [33,, 35, 39]]);
      }));

      function dirList(_x3, _x4) {
        return _ref6.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "isEmptyDirectory",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.dirList();

              case 2:
                _context7.t0 = _context7.sent.length;
                return _context7.abrupt("return", _context7.t0 === 0);

              case 4:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function isEmptyDirectory() {
        return _ref7.apply(this, arguments);
      }

      return isEmptyDirectory;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        var _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, subResource;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this.exists();

              case 2:
                if (_context8.sent) {
                  _context8.next = 5;
                  break;
                }

                _context8.next = 41;
                break;

              case 5:
                if (!this.isDirectory()) {
                  _context8.next = 39;
                  break;
                }

                _iteratorNormalCompletion2 = true;
                _didIteratorError2 = false;
                _iteratorError2 = undefined;
                _context8.prev = 9;
                _context8.next = 12;
                return this.dirList();

              case 12:
                _context8.t0 = Symbol.iterator;
                _iterator2 = _context8.sent[_context8.t0]();

              case 14:
                if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                  _context8.next = 21;
                  break;
                }

                subResource = _step2.value;
                _context8.next = 18;
                return subResource.remove();

              case 18:
                _iteratorNormalCompletion2 = true;
                _context8.next = 14;
                break;

              case 21:
                _context8.next = 27;
                break;

              case 23:
                _context8.prev = 23;
                _context8.t1 = _context8["catch"](9);
                _didIteratorError2 = true;
                _iteratorError2 = _context8.t1;

              case 27:
                _context8.prev = 27;
                _context8.prev = 28;

                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }

              case 30:
                _context8.prev = 30;

                if (!_didIteratorError2) {
                  _context8.next = 33;
                  break;
                }

                throw _iteratorError2;

              case 33:
                return _context8.finish(30);

              case 34:
                return _context8.finish(27);

              case 35:
                _context8.next = 37;
                return rmdirP(this.path());

              case 37:
                _context8.next = 41;
                break;

              case 39:
                _context8.next = 41;
                return unlinkP(this.path());

              case 41:
                return _context8.abrupt("return", this);

              case 42:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this, [[9, 23, 27, 35], [28,, 30, 34]]);
      }));

      function remove() {
        return _ref8.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "readProperties",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(opts) {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.t0 = this;
                _context9.next = 3;
                return this.stat();

              case 3:
                _context9.t1 = _context9.sent;
                return _context9.abrupt("return", _context9.t0._assignPropsFromStat.call(_context9.t0, _context9.t1));

              case 5:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function readProperties(_x7) {
        return _ref9.apply(this, arguments);
      }

      return readProperties;
    }()
  }, {
    key: "_assignPropsFromStat",
    value: function _assignPropsFromStat(stat) {
      return this.assignProperties({
        lastModified: stat.mtime,
        created: stat.ctime,
        size: stat.size,
        type: stat.isDirectory() ? "directory" : "file",
        isLink: stat.isSymbolicLink()
      });
    }
  }]);
  return NodeJSFileResource;
}(Resource);

function resource(url) {
  if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
  if (url.isResource) return url;
  url = String(url);
  if (url.match(/^http/i)) return new WebDAVResource(url);
  if (url.match(/^file/i)) return new NodeJSFileResource(url);
  throw new Error("Cannot find resource type for url " + url);
}

var createFiles = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(baseDir, fileSpec) {
    var base, name, _resource;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            base = resource(baseDir).asDirectory();
            _context.next = 3;
            return base.ensureExistance();

          case 3:
            _context.t0 = regeneratorRuntime.keys(fileSpec);

          case 4:
            if ((_context.t1 = _context.t0()).done) {
              _context.next = 18;
              break;
            }

            name = _context.t1.value;

            if (fileSpec.hasOwnProperty(name)) {
              _context.next = 8;
              break;
            }

            return _context.abrupt("continue", 4);

          case 8:
            _resource = base.join(name);

            if (!(_typeof(fileSpec[name]) === "object")) {
              _context.next = 14;
              break;
            }

            _context.next = 12;
            return createFiles(_resource, fileSpec[name]);

          case 12:
            _context.next = 16;
            break;

          case 14:
            _context.next = 16;
            return _resource.write(fileSpec[name]);

          case 16:
            _context.next = 4;
            break;

          case 18:
            return _context.abrupt("return", base);

          case 19:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function createFiles(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

exports.resource = resource;
exports.createFiles = createFiles;

}((this.lively.resources = this.lively.resources || {}),typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: function() { throw new Error('fs module not available'); }}));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.resources;
})();