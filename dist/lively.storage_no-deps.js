
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  if (typeof btoa === "undefined")
    GLOBAL.btoa = function(str) { return new Buffer(str).toString('base64'); };
  if (typeof atob === "undefined")
    GLOBAL.atob = function(str) { return new Buffer(str, 'base64').toString() };
  (function() {
    this.lively = this.lively || {};
(function (exports,_PouchDB,pouchdbAdapterMem,lively_resources) {
'use strict';

_PouchDB = 'default' in _PouchDB ? _PouchDB['default'] : _PouchDB;
pouchdbAdapterMem = 'default' in pouchdbAdapterMem ? pouchdbAdapterMem['default'] : pouchdbAdapterMem;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
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



var set$1 = function set$1(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set$1(parent, property, value, receiver);
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













var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

/*global global,self,process,System,require*/
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// PouchDB setup

var GLOBAL = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : undefined;

var isNode = typeof global !== "undefined" && typeof process !== "undefined";
var PouchDB = _PouchDB;
PouchDB.plugin(pouchdbAdapterMem);

function nodejsRequire(name) {
  if (!isNode) throw new Error("nodejsRequire can only be used in nodejs!");
  if (typeof System !== "undefined") return System._nodeRequire(name);
  return require("module")._load(name);
}

// nodejs_leveldbPath("test")
// nodejs_leveldbPath("file:///Users/robert/Downloads/hackernews-data")
function nodejs_leveldbPath(dbName) {
  // absolute path?
  if (dbName.startsWith("/")) return dbName;
  if (dbName.match(/[^\/]+:\/\//)) {
    if (dbName.startsWith("file:")) dbName = dbName.replace(/^file:\/\//, "");
    return dbName;
  }

  if (!isNode) throw new Error("nodejs_leveldbPath called under non-nodejs environment");
  var serverPath = GLOBAL.process.cwd();
  // are we in a typical lively.next env? Meaning serverPath points to
  // lively.next-dir/lively.server. If so, use parent dir of lively.server

  var _nodejsRequire = nodejsRequire("path"),
      join = _nodejsRequire.join,
      _nodejsRequire2 = nodejsRequire("fs"),
      mkdirSync = _nodejsRequire2.mkdirSync,
      existsSync = _nodejsRequire2.existsSync,
      readdirSync = _nodejsRequire2.readdirSync,
      readFileSync = _nodejsRequire2.readFileSync;

  try {
    var parentPackage = readFileSync(join(serverPath, "../package.json")),
        conf = JSON.parse(parentPackage);
    if (conf.name === "lively.web" || conf.name === "lively.next") {
      var _dbDir = join(serverPath, "../.livelydbs");
      if (!existsSync(_dbDir)) mkdirSync(_dbDir);
      return join(_dbDir, dbName);
    }
  } catch (e) {}

  var dbDir = join(serverPath, ".livelydbs");
  if (!existsSync(dbDir)) mkdirSync(dbDir);
  return join(dbDir, dbName);
}

function nodejs_attemptToLoadProperPouchDB() {
  // We ship lively.storage with a PouchDB dist version that runs everywhere.
  // This version does not support leveldb, the adapter backend that is needed in
  // nodejs for persistence storage.  Here we try to lazily switch to a PouchDB
  // required via node's require.

  if (!isNode) throw new Error("nodejs_attemptToLoadProperPouchDB called under non-nodejs environment");

  if (typeof System !== "undefined") {
    var _System$_nodeRequire = System._nodeRequire("path"),
        join = _System$_nodeRequire.join,
        storageMain = System.normalizeSync("lively.storage/index.js"),
        pouchDBMain = System.normalizeSync("pouchdb", storageMain).replace(/file:\/\//, ""),
        pouchDBNodeMain = join(pouchDBMain, "../../lib/index.js");

    try {
      PouchDB = System._nodeRequire(pouchDBNodeMain);
      PouchDB.plugin(pouchdbAdapterMem);
      return true;
    } catch (e) {
      return false;
    }
  }

  try {
    PouchDB = require("pouchdb");
    PouchDB.plugin(pouchdbAdapterMem);
    return true;
  } catch (err) {
    return false;
  }
}

// var pouch = createPouchDB("test-db"); pouch.adapter;
var createPouchDB = !isNode ? function (name, options) {
  return new PouchDB(_extends({ name: name }, options));
} : function () {
  var properLoadAttempted = false,
      nodejsCouchDBLoaded = false;
  return function createPouchDB(name) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (!properLoadAttempted) {
      properLoadAttempted = true;
      nodejsCouchDBLoaded = nodejs_attemptToLoadProperPouchDB();
    }
    if (!options.adapter) {
      options.adapter = name.startsWith("http") ? "http" : nodejsCouchDBLoaded ? "leveldb" : "memory";
    }
    if (options.adapter == "leveldb") name = nodejs_leveldbPath(name);
    options = _extends({}, options, { name: name });
    return new PouchDB(options);
  };
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// main database interface

var Database = function () {
  createClass(Database, null, [{
    key: "findDB",
    value: function findDB(name) {
      return this.databases.get(name);
    }
  }, {
    key: "ensureDB",
    value: function ensureDB(name, options) {
      var db = this.findDB(name);
      if (db) return db;
      db = new this(name, options);
      this.databases.set(name, db);
      return db;
    }
  }, {
    key: "PouchDB",
    get: function get() {
      return PouchDB;
    },
    set: function set(klass) {
      PouchDB = klass;
    }
  }, {
    key: "databases",
    get: function get() {
      return this._databases || (this._databases = new Map());
    }
  }]);

  function Database(name) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, Database);

    this.name = name;
    this.options = options;
    this._pouchdb = null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initialize / release
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  createClass(Database, [{
    key: "close",
    value: function close() {
      // close database to free mem
      if (!this._pouchdb) return;
      this._pouchdb.close();
      delete this._pouchdb;
    }
  }, {
    key: "isDestroyed",
    value: function isDestroyed() {
      return !!this.pouchdb._destroyed;
    }
  }, {
    key: "destroy",
    value: function destroy(opts) {
      // completely get rid of database
      this.constructor.databases.delete(this.name);
      return this.isDestroyed() ? { ok: true } : this.pouchdb.destroy(opts);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // accessing and updating
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "update",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(_id, updateFn, options) {
        var updateAttempt = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

        var _options, _options$ensure, ensure, _options$retryOnConfl, retryOnConflict, _options$maxUpdateAtt, maxUpdateAttempts, getOpts, db, lastDoc, newDoc, _ref2, id, rev;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                // Will try to fetch document _id and feed it to updateFn. The result value
                // (promise supported) of updateFn will be used as the next version of
                // document.  If updateFn returns a falsy value the update will be canceled.
                // options: {
                //   ensure: BOOL, // if no document exists, create one, default true
                //   retryOnConflict: BOOL, // if update conflicts retry maxUpdateAttempts
                //                          // times to update doc, default true
                //   maxUpdateAttempts: NUMBER // default 10
                // }
                // returns created document
                options = options || {};

                _options = options, _options$ensure = _options.ensure, ensure = _options$ensure === undefined ? true : _options$ensure, _options$retryOnConfl = _options.retryOnConflict, retryOnConflict = _options$retryOnConfl === undefined ? true : _options$retryOnConfl, _options$maxUpdateAtt = _options.maxUpdateAttempts, maxUpdateAttempts = _options$maxUpdateAtt === undefined ? 10 : _options$maxUpdateAtt, getOpts = { latest: true }, db = this.pouchdb, lastDoc = void 0, newDoc = void 0;

                // 1. get the old doc

                _context.prev = 2;
                _context.next = 5;
                return db.get(_id, getOpts);

              case 5:
                lastDoc = _context.sent;
                _context.next = 12;
                break;

              case 8:
                _context.prev = 8;
                _context.t0 = _context["catch"](2);

                if (!(_context.t0.name !== "not_found" || !ensure)) {
                  _context.next = 12;
                  break;
                }

                throw _context.t0;

              case 12:
                _context.next = 14;
                return updateFn(lastDoc);

              case 14:
                newDoc = _context.sent;

                if (!(!newDoc || (typeof newDoc === "undefined" ? "undefined" : _typeof(newDoc)) !== "object")) {
                  _context.next = 17;
                  break;
                }

                return _context.abrupt("return", null);

              case 17:
                // canceled!

                // ensure _id, _rev props
                if (newDoc._id !== _id) newDoc._id = _id;
                if (lastDoc && newDoc._rev !== lastDoc._rev) newDoc._rev = lastDoc._rev;

                // 3. try writing new doc
                _context.prev = 19;
                _context.next = 22;
                return db.put(newDoc);

              case 22:
                _ref2 = _context.sent;
                id = _ref2.id;
                rev = _ref2.rev;
                return _context.abrupt("return", Object.assign(newDoc, { _rev: rev }));

              case 28:
                _context.prev = 28;
                _context.t1 = _context["catch"](19);

                if (!(_context.t1.name === "conflict" && retryOnConflict && updateAttempt < maxUpdateAttempts)) {
                  _context.next = 32;
                  break;
                }

                return _context.abrupt("return", this.update(_id, updateFn, options, updateAttempt + 1));

              case 32:
                throw _context.t1;

              case 33:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this, [[2, 8], [19, 28]]);
      }));

      function update(_x3, _x4, _x5) {
        return _ref.apply(this, arguments);
      }

      return update;
    }()
  }, {
    key: "mixin",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(_id, _mixin, options) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                return _context2.abrupt("return", this.update(_id, function (oldDoc) {
                  return Object.assign(oldDoc || { _id: _id }, _mixin);
                }, options));

              case 1:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function mixin(_x7, _x8, _x9) {
        return _ref3.apply(this, arguments);
      }

      return mixin;
    }()
  }, {
    key: "set",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(id, value, options) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                return _context3.abrupt("return", this.update(id, function (_) {
                  return value;
                }, options));

              case 1:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function set$$1(_x10, _x11, _x12) {
        return _ref4.apply(this, arguments);
      }

      return set$$1;
    }()
  }, {
    key: "get",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(id) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.prev = 0;
                _context4.next = 3;
                return this.pouchdb.get(id);

              case 3:
                return _context4.abrupt("return", _context4.sent);

              case 6:
                _context4.prev = 6;
                _context4.t0 = _context4["catch"](0);

                if (!(_context4.t0.name === "not_found")) {
                  _context4.next = 10;
                  break;
                }

                return _context4.abrupt("return", undefined);

              case 10:
                throw _context4.t0;

              case 11:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[0, 6]]);
      }));

      function get$$1(_x13) {
        return _ref5.apply(this, arguments);
      }

      return get$$1;
    }()
  }, {
    key: "has",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(id) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.get(id);

              case 2:
                return _context5.abrupt("return", !!_context5.sent);

              case 3:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function has(_x14) {
        return _ref6.apply(this, arguments);
      }

      return has;
    }()
  }, {
    key: "add",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(doc) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                return _context6.abrupt("return", this.pouchdb.post(doc));

              case 1:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function add(_x15) {
        return _ref7.apply(this, arguments);
      }

      return add;
    }()
  }, {
    key: "docList",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var _ref9, rows, result, i, _rows$i, id, rev;

        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.pouchdb.allDocs(opts);

              case 2:
                _ref9 = _context7.sent;
                rows = _ref9.rows;
                result = [];

                for (i = 0; i < rows.length; i++) {
                  _rows$i = rows[i], id = _rows$i.id, rev = _rows$i.value.rev;

                  result.push({ id: id, rev: rev });
                }
                return _context7.abrupt("return", result);

              case 7:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function docList() {
        return _ref8.apply(this, arguments);
      }

      return docList;
    }()
  }, {
    key: "revList",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(id) {
        var _ref11, _id, _ref11$_revisions, start, ids;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this.pouchdb.get(id, { revs: true });

              case 2:
                _ref11 = _context8.sent;
                _id = _ref11._id;
                _ref11$_revisions = _ref11._revisions;
                start = _ref11$_revisions.start;
                ids = _ref11$_revisions.ids;
                return _context8.abrupt("return", ids.map(function (ea) {
                  return start-- + "-" + ea;
                }));

              case 8:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function revList(_x17) {
        return _ref10.apply(this, arguments);
      }

      return revList;
    }()
  }, {
    key: "getAllRevisions",
    value: function () {
      var _ref12 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(id) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _options$skip, skip, _options$limit, limit, revs, query;

        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _options$skip = options.skip;
                skip = _options$skip === undefined ? 0 : _options$skip;
                _options$limit = options.limit;
                limit = _options$limit === undefined ? 0 : _options$limit;
                _context9.next = 6;
                return this.revList(id);

              case 6:
                revs = _context9.sent;

                if (skip > 0) revs = revs.slice(skip);
                if (limit > 0) revs = revs.slice(0, limit);
                query = revs.map(function (rev) {
                  return { rev: rev, id: id };
                });
                _context9.next = 12;
                return this.getDocuments(query);

              case 12:
                return _context9.abrupt("return", _context9.sent);

              case 13:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function getAllRevisions(_x18) {
        return _ref12.apply(this, arguments);
      }

      return getAllRevisions;
    }()
  }, {
    key: "getAll",
    value: function () {
      var _ref13 = asyncToGenerator(regeneratorRuntime.mark(function _callee10() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var _ref14, rows;

        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _context10.next = 2;
                return this.pouchdb.allDocs(_extends({}, options, { include_docs: true }));

              case 2:
                _ref14 = _context10.sent;
                rows = _ref14.rows;
                return _context10.abrupt("return", rows.map(function (ea) {
                  return ea.doc;
                }));

              case 5:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function getAll() {
        return _ref13.apply(this, arguments);
      }

      return getAll;
    }()
  }, {
    key: "setDocuments",
    value: function () {
      var _ref15 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(documents, opts) {
        var results, i, d, result, _ref16, id, rev;

        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                _context11.next = 2;
                return this.pouchdb.bulkDocs(documents, opts);

              case 2:
                results = _context11.sent;
                i = 0;

              case 4:
                if (!(i < results.length)) {
                  _context11.next = 16;
                  break;
                }

                d = documents[i], result = results[i];
                // if a conflict happens and document does not specify the exact revision
                // then just overwrite old doc

                if (!(!result.ok && result.name === "conflict" && !d._rev)) {
                  _context11.next = 13;
                  break;
                }

                _context11.next = 9;
                return this.set(d._id, d);

              case 9:
                _ref16 = _context11.sent;
                id = _ref16._id;
                rev = _ref16._rev;

                results[i] = { ok: true, id: id, rev: rev };

              case 13:
                i++;
                _context11.next = 4;
                break;

              case 16:
                return _context11.abrupt("return", results);

              case 17:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function setDocuments(_x21, _x22) {
        return _ref15.apply(this, arguments);
      }

      return setDocuments;
    }()
  }, {
    key: "getDocuments",
    value: function () {
      var _ref17 = asyncToGenerator(regeneratorRuntime.mark(function _callee12(idsAndRevs) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _options$ignoreErrors, ignoreErrors, _ref18, results, result, i, _results$i, docs, id, j, d;

        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                _options$ignoreErrors = options.ignoreErrors;
                ignoreErrors = _options$ignoreErrors === undefined ? true : _options$ignoreErrors;
                _context12.next = 4;
                return this.pouchdb.bulkGet({ docs: idsAndRevs });

              case 4:
                _ref18 = _context12.sent;
                results = _ref18.results;
                result = [];
                i = 0;

              case 8:
                if (!(i < results.length)) {
                  _context12.next = 23;
                  break;
                }

                _results$i = results[i], docs = _results$i.docs, id = _results$i.id;

                console.assert(docs.length === 1, "getDocuments: expected only one doc for " + id);
                j = 0;

              case 12:
                if (!(j < docs.length)) {
                  _context12.next = 20;
                  break;
                }

                d = docs[j];

                if (!(ignoreErrors && !d.ok)) {
                  _context12.next = 16;
                  break;
                }

                return _context12.abrupt("continue", 17);

              case 16:
                result.push(d.ok || d.error || d);

              case 17:
                j++;
                _context12.next = 12;
                break;

              case 20:
                i++;
                _context12.next = 8;
                break;

              case 23:
                return _context12.abrupt("return", result);

              case 24:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function getDocuments(_x23) {
        return _ref17.apply(this, arguments);
      }

      return getDocuments;
    }()
  }, {
    key: "query",
    value: function query(subject, opts) {
      return this.pouchdb.query(subject, opts);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // removal
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "remove",
    value: function () {
      var _ref19 = asyncToGenerator(regeneratorRuntime.mark(function _callee13(_id, _rev, options) {
        var arg;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                if (!(typeof _rev !== "undefined")) {
                  _context13.next = 4;
                  break;
                }

                _context13.t0 = { _id: _id, _rev: _rev };
                _context13.next = 7;
                break;

              case 4:
                _context13.next = 6;
                return this.get(_id);

              case 6:
                _context13.t0 = _context13.sent;

              case 7:
                arg = _context13.t0;
                return _context13.abrupt("return", arg ? this.pouchdb.remove(arg) : undefined);

              case 9:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function remove(_x25, _x26, _x27) {
        return _ref19.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "removeAll",
    value: function () {
      var _ref20 = asyncToGenerator(regeneratorRuntime.mark(function _callee14() {
        var db, docs;
        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                db = this.pouchdb;
                _context14.next = 3;
                return db.allDocs();

              case 3:
                docs = _context14.sent;
                _context14.next = 6;
                return Promise.all(docs.rows.map(function (row) {
                  return db.remove(row.id, row.value.rev);
                }));

              case 6:
                return _context14.abrupt("return", _context14.sent);

              case 7:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function removeAll() {
        return _ref20.apply(this, arguments);
      }

      return removeAll;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // replication + conflicts
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "replicateTo",
    value: function replicateTo(otherDB, opts) {
      // opts: {live, retry}
      if (otherDB instanceof Database) otherDB = otherDB.pouchdb;
      return this.pouchdb.replicate.to(otherDB, opts);
    }
  }, {
    key: "replicateFrom",
    value: function replicateFrom(otherDB, opts) {
      // opts: {live, retry}
      if (otherDB instanceof Database) otherDB = otherDB.pouchdb;
      return this.pouchdb.replicate.from(otherDB, opts);
    }
  }, {
    key: "sync",
    value: function sync(otherDB, opts) {
      // opts: {live, retry}
      if (otherDB instanceof Database) otherDB = otherDB.pouchdb;
      return this.pouchdb.sync(otherDB, opts);
    }
  }, {
    key: "getConflicts",
    value: function () {
      var _ref21 = asyncToGenerator(regeneratorRuntime.mark(function _callee15() {
        var _ref22, rows;

        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                _context15.next = 2;
                return this.pouchdb.query({ map: "function(doc) { if (doc._conflicts) emit(doc._id); }" }, { reduce: false, include_docs: true, conflicts: true });

              case 2:
                _ref22 = _context15.sent;
                rows = _ref22.rows;
                return _context15.abrupt("return", rows.map(function (ea) {
                  return ea.doc;
                }));

              case 5:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function getConflicts() {
        return _ref21.apply(this, arguments);
      }

      return getConflicts;
    }()
  }, {
    key: "resolveConflicts",
    value: function () {
      var _ref23 = asyncToGenerator(regeneratorRuntime.mark(function _callee16(id, resolveFn) {
        var doc, query, conflicted, resolved, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, conflictedDoc;

        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                _context16.next = 2;
                return this.pouchdb.get("doc", { conflicts: true });

              case 2:
                doc = _context16.sent;
                query = doc._conflicts.map(function (rev) {
                  return { id: id, rev: rev };
                });
                _context16.next = 6;
                return this.getDocuments(query);

              case 6:
                conflicted = _context16.sent;
                resolved = doc;
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context16.prev = 11;
                _iterator = conflicted[Symbol.iterator]();

              case 13:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context16.next = 28;
                  break;
                }

                conflictedDoc = _step.value;
                _context16.next = 17;
                return resolveFn(resolved, conflictedDoc);

              case 17:
                resolved = _context16.sent;

                if (resolved) {
                  _context16.next = 20;
                  break;
                }

                return _context16.abrupt("return", null);

              case 20:
                _context16.next = 22;
                return this.set(id, resolved);

              case 22:
                resolved = _context16.sent;
                _context16.next = 25;
                return this.pouchdb.remove(conflictedDoc);

              case 25:
                _iteratorNormalCompletion = true;
                _context16.next = 13;
                break;

              case 28:
                _context16.next = 34;
                break;

              case 30:
                _context16.prev = 30;
                _context16.t0 = _context16["catch"](11);
                _didIteratorError = true;
                _iteratorError = _context16.t0;

              case 34:
                _context16.prev = 34;
                _context16.prev = 35;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 37:
                _context16.prev = 37;

                if (!_didIteratorError) {
                  _context16.next = 40;
                  break;
                }

                throw _iteratorError;

              case 40:
                return _context16.finish(37);

              case 41:
                return _context16.finish(34);

              case 42:
                return _context16.abrupt("return", resolved);

              case 43:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16, this, [[11, 30, 34, 42], [35,, 37, 41]]);
      }));

      function resolveConflicts(_x28, _x29) {
        return _ref23.apply(this, arguments);
      }

      return resolveConflicts;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // backup
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "dump",
    value: function () {
      var _ref24 = asyncToGenerator(regeneratorRuntime.mark(function _callee17() {
        var name, pouchdb, header, docs;
        return regeneratorRuntime.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                name = this.name;
                pouchdb = this.pouchdb;
                _context17.t0 = name;
                _context17.t1 = pouchdb.type();
                _context17.t2 = new Date().toJSON();
                _context17.next = 7;
                return pouchdb.info();

              case 7:
                _context17.t3 = _context17.sent;
                header = {
                  name: _context17.t0,
                  db_type: _context17.t1,
                  start_time: _context17.t2,
                  db_info: _context17.t3
                };
                _context17.next = 11;
                return this.getAll({ attachments: true });

              case 11:
                docs = _context17.sent;
                return _context17.abrupt("return", { header: header, docs: docs });

              case 13:
              case "end":
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));

      function dump() {
        return _ref24.apply(this, arguments);
      }

      return dump;
    }()
  }, {
    key: "backup",
    value: function () {
      var _ref25 = asyncToGenerator(regeneratorRuntime.mark(function _callee18() {
        var backupNo = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
        var name, backupDB;
        return regeneratorRuntime.wrap(function _callee18$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                name = this.name + "_backup_" + backupNo, backupDB = this.constructor.ensureDB(name);
                _context18.next = 3;
                return this.replicateTo(backupDB);

              case 3:
                return _context18.abrupt("return", backupDB);

              case 4:
              case "end":
                return _context18.stop();
            }
          }
        }, _callee18, this);
      }));

      function backup() {
        return _ref25.apply(this, arguments);
      }

      return backup;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // migration
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "migrate",
    value: function () {
      var _ref26 = asyncToGenerator(regeneratorRuntime.mark(function _callee19(migrationFn) {
        var docs, migrated, unchanged, i, doc, migratedDoc;
        return regeneratorRuntime.wrap(function _callee19$(_context19) {
          while (1) {
            switch (_context19.prev = _context19.next) {
              case 0:
                _context19.next = 2;
                return this.getAll();

              case 2:
                docs = _context19.sent;
                migrated = [], unchanged = [];
                i = 0;

              case 5:
                if (!(i < docs.length)) {
                  _context19.next = 16;
                  break;
                }

                doc = docs[i], migratedDoc = migrationFn(doc, i);

                if (migratedDoc) {
                  _context19.next = 10;
                  break;
                }

                unchanged.push(doc);return _context19.abrupt("continue", 13);

              case 10:

                if (!migratedDoc.hasOwnProperty("_id")) migratedDoc._id = doc._id;
                if (migratedDoc.hasOwnProperty("_rev")) delete migratedDoc._rev;

                migrated.push(migratedDoc);

              case 13:
                i++;
                _context19.next = 5;
                break;

              case 16:
                _context19.next = 18;
                return this.setDocuments(migrated);

              case 18:
                return _context19.abrupt("return", { migrated: migrated.length, unchanged: unchanged.length });

              case 19:
              case "end":
                return _context19.stop();
            }
          }
        }, _callee19, this);
      }));

      function migrate(_x31) {
        return _ref26.apply(this, arguments);
      }

      return migrate;
    }()
  }, {
    key: "pouchdb",
    get: function get() {
      // lazy pouch db accessor
      if (this._pouchdb) return this._pouchdb;
      var name = this.name,
          options = this.options;

      return this._pouchdb = createPouchDB(name, options);
    }
  }], [{
    key: "loadDump",
    value: function () {
      var _ref27 = asyncToGenerator(regeneratorRuntime.mark(function _callee20(dump) {
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var header, docs, name, db;
        return regeneratorRuntime.wrap(function _callee20$(_context20) {
          while (1) {
            switch (_context20.prev = _context20.next) {
              case 0:
                header = dump.header, docs = dump.docs, name = opts.name || header.name, db = this.ensureDB(name);
                _context20.next = 3;
                return db.setDocuments(docs, { new_edits: false });

              case 3:
                return _context20.abrupt("return", db);

              case 4:
              case "end":
                return _context20.stop();
            }
          }
        }, _callee20, this);
      }));

      function loadDump(_x32) {
        return _ref27.apply(this, arguments);
      }

      return loadDump;
    }()
  }]);
  return Database;
}();

/*global System,process,require*/
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// sha1
// Author: creationix
// Repo: https://github.com/creationix/git-sha1
// License: MIT https://github.com/creationix/git-sha1/blob/b3474591e6834232df63b5cf9bb969185a54a04c/LICENSE
var sha1 = function sha1_setup() {
  function r(r) {
    if (void 0 === r) return o(!1);var e = o(!0);return e.update(r), e.digest();
  }function e() {
    var r = f.createHash("sha1");return { update: function update(e) {
        return r.update(e);
      }, digest: function digest() {
        return r.digest("hex");
      } };
  }function t(r) {
    function e(r) {
      if ("string" == typeof r) return t(r);var e = r.length;h += 8 * e;for (var n = 0; n < e; n++) {
        o(r[n]);
      }
    }function t(r) {
      var e = r.length;h += 8 * e;for (var t = 0; t < e; t++) {
        o(r.charCodeAt(t));
      }
    }function o(r) {
      a[y] |= (255 & r) << g, g ? g -= 8 : (y++, g = 24), 16 === y && u();
    }function f() {
      o(128), (y > 14 || 14 === y && g < 24) && u(), y = 14, g = 24, o(0), o(0), o(h > 0xffffffffff ? h / 1099511627776 : 0), o(h > 4294967295 ? h / 4294967296 : 0);for (var r = 24; r >= 0; r -= 8) {
        o(h >> r);
      }return i(s) + i(c) + i(v) + i(p) + i(d);
    }function u() {
      for (var r = 16; r < 80; r++) {
        var e = a[r - 3] ^ a[r - 8] ^ a[r - 14] ^ a[r - 16];a[r] = e << 1 | e >>> 31;
      }var t,
          n,
          o = s,
          f = c,
          u = v,
          i = p,
          g = d;for (r = 0; r < 80; r++) {
        r < 20 ? (t = i ^ f & (u ^ i), n = 1518500249) : r < 40 ? (t = f ^ u ^ i, n = 1859775393) : r < 60 ? (t = f & u | i & (f | u), n = 2400959708) : (t = f ^ u ^ i, n = 3395469782);var h = (o << 5 | o >>> 27) + t + g + n + (0 | a[r]);g = i, i = u, u = f << 30 | f >>> 2, f = o, o = h;
      }for (s = s + o | 0, c = c + f | 0, v = v + u | 0, p = p + i | 0, d = d + g | 0, y = 0, r = 0; r < 16; r++) {
        a[r] = 0;
      }
    }function i(r) {
      for (var e = "", t = 28; t >= 0; t -= 4) {
        e += (r >> t & 15).toString(16);
      }return e;
    }var a,
        s = 1732584193,
        c = 4023233417,
        v = 2562383102,
        p = 271733878,
        d = 3285377520,
        y = 0,
        g = 24,
        h = 0;return a = r ? n : new Uint32Array(80), { update: e, digest: f };
  }var n, o, f;return "object" == (typeof process === "undefined" ? "undefined" : _typeof(process)) && "object" == _typeof(process.versions) && process.versions.node && "renderer" !== process.__atom_type ? (f = "undefined" != typeof System ? System._nodeRequire("crypto") : require("crypto"), o = e) : (n = new Uint32Array(80), o = t), r;
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var objectDBs = objectDBs || new Map();

var ObjectDB = function () {
  createClass(ObjectDB, null, [{
    key: "named",
    value: function named(name, options) {
      var existing = objectDBs.get(name);
      if (existing) return existing;
      var db = new this(name, options);
      objectDBs.set(name, db);
      return db;
    }
  }]);

  function ObjectDB(name, options) {
    classCallCheck(this, ObjectDB);

    this.name = name;
    if (!options.snapshotLocation || !options.snapshotLocation.isResource) throw new Error("ObjectDB needs snapshotLocation!");
    this.snapshotLocation = options.snapshotLocation;
    this.__commitDB = null;
    this.__versionDB = null;
  }

  createClass(ObjectDB, [{
    key: "destroy",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        var commitDB, versionDB;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                commitDB = Database.findDB("commits-" + this.name);

                if (!commitDB) {
                  _context.next = 4;
                  break;
                }

                _context.next = 4;
                return commitDB.destroy();

              case 4:
                versionDB = Database.findDB("version-graph-" + this.name);

                if (!versionDB) {
                  _context.next = 8;
                  break;
                }

                _context.next = 8;
                return versionDB.destroy();

              case 8:
                objectDBs.delete(this.name);
                // await this.snapshotLocation.remove()

              case 9:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function destroy() {
        return _ref.apply(this, arguments);
      }

      return destroy;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // storage

  }, {
    key: "snapshotResourceFor",
    value: function snapshotResourceFor(commit) {
      // content is sha1 hash
      var first = commit.content.slice(0, 2),
          rest = commit.content.slice(2);
      return this.snapshotLocation.join(first + "/" + rest + ".json");
    }
  }, {
    key: "snapshotObject",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(type, name, object, snapshotOptions, commitSpec, ref, expectedPrevVersion) {
        var serializeFn, snapshot;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                snapshotOptions = snapshotOptions || {};

                serializeFn = function serializeFn(x) {
                  return x;
                };

                _context2.next = 4;
                return serializeFn(object, snapshotOptions);

              case 4:
                snapshot = _context2.sent;
                return _context2.abrupt("return", this.commitSnapshot(type, name, snapshot, commitSpec, ref, expectedPrevVersion));

              case 6:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function snapshotObject(_x, _x2, _x3, _x4, _x5, _x6, _x7) {
        return _ref2.apply(this, arguments);
      }

      return snapshotObject;
    }()
  }, {
    key: "loadObject",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(type, name, loadOptions, commitIdOrCommit, ref) {
        var snapshot, deserializeFn;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                loadOptions = loadOptions || {};
                _context3.next = 3;
                return this.loadSnapshot(type, name, commitIdOrCommit, ref);

              case 3:
                snapshot = _context3.sent;

                deserializeFn = function deserializeFn(x) {
                  return x;
                };

                return _context3.abrupt("return", deserializeFn(snapshot, loadOptions));

              case 6:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function loadObject(_x8, _x9, _x10, _x11, _x12) {
        return _ref3.apply(this, arguments);
      }

      return loadObject;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // data management

  }, {
    key: "has",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(type, name) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return this.objectStats(type, name);

              case 2:
                return _context4.abrupt("return", !!_context4.sent);

              case 3:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function has(_x13, _x14) {
        return _ref4.apply(this, arguments);
      }

      return has;
    }()
  }, {
    key: "objects",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(type) {
        var stats, result, _type;

        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.objectStats(type);

              case 2:
                stats = _context5.sent;

                if (!type) {
                  _context5.next = 5;
                  break;
                }

                return _context5.abrupt("return", Object.keys(stats || {}));

              case 5:
                result = {};

                for (_type in stats) {
                  result[_type] = Object.keys(stats[_type]);
                }return _context5.abrupt("return", result);

              case 8:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function objects(_x15) {
        return _ref5.apply(this, arguments);
      }

      return objects;
    }()
  }, {
    key: "objectStats",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(objectType, objectName) {
        var statsByType, commitDB, queryOpts, _ref7, rows, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _ref9, objectTypeAndName, _ref9$value, count, newest, oldest, _objectTypeAndName$sp, _objectTypeAndName$sp2, type, _objectName, statsOfType;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                statsByType = {};
                _context6.t0 = this.__commitDB;

                if (_context6.t0) {
                  _context6.next = 6;
                  break;
                }

                _context6.next = 5;
                return this._commitDB();

              case 5:
                _context6.t0 = _context6.sent;

              case 6:
                commitDB = _context6.t0;
                queryOpts = { reduce: true, group: true };

                if (objectType && objectName) {
                  queryOpts.key = objectType + "\0" + objectName;
                  // queryOpts.endkey = `${objectType}\u0000${objectName}`;
                } else if (objectType) {
                  // queryOpts.key = objectType;
                  queryOpts.startkey = objectType + "\0";
                  queryOpts.endkey = objectType + "\uFFF0";
                }

                _context6.prev = 9;
                _context6.next = 12;
                return commitDB.pouchdb.query("nameWithMaxMinTimestamp_index", queryOpts);

              case 12:
                _ref7 = _context6.sent;
                rows = _ref7.rows;
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context6.prev = 17;

                for (_iterator = rows[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                  _ref9 = _step.value;
                  objectTypeAndName = _ref9.key, _ref9$value = _ref9.value, count = _ref9$value.count, newest = _ref9$value.max, oldest = _ref9$value.min;
                  _objectTypeAndName$sp = objectTypeAndName.split("\0"), _objectTypeAndName$sp2 = slicedToArray(_objectTypeAndName$sp, 2), type = _objectTypeAndName$sp2[0], _objectName = _objectTypeAndName$sp2[1], statsOfType = statsByType[type] || (statsByType[type] = {});

                  statsOfType[_objectName] = { count: count, newest: newest, oldest: oldest };
                }
                _context6.next = 25;
                break;

              case 21:
                _context6.prev = 21;
                _context6.t1 = _context6["catch"](17);
                _didIteratorError = true;
                _iteratorError = _context6.t1;

              case 25:
                _context6.prev = 25;
                _context6.prev = 26;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 28:
                _context6.prev = 28;

                if (!_didIteratorError) {
                  _context6.next = 31;
                  break;
                }

                throw _iteratorError;

              case 31:
                return _context6.finish(28);

              case 32:
                return _context6.finish(25);

              case 33:
                _context6.next = 39;
                break;

              case 35:
                _context6.prev = 35;
                _context6.t2 = _context6["catch"](9);

                console.error(_context6.t2);
                return _context6.abrupt("return", statsByType);

              case 39:
                if (!(objectType && objectName)) {
                  _context6.next = 41;
                  break;
                }

                return _context6.abrupt("return", (statsByType[objectType] || {})[objectName]);

              case 41:
                if (!objectType) {
                  _context6.next = 43;
                  break;
                }

                return _context6.abrupt("return", statsByType[objectType]);

              case 43:
                return _context6.abrupt("return", statsByType);

              case 44:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this, [[9, 35], [17, 21, 25, 33], [26,, 28, 32]]);
      }));

      function objectStats(_x16, _x17) {
        return _ref6.apply(this, arguments);
      }

      return objectStats;
    }()
  }, {
    key: "getCommits",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(type, objectName) {
        var ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "HEAD";
        var limit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Infinity;
        var history, commitDB, commits;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this._log(type, objectName, ref, limit);

              case 2:
                history = _context7.sent;

                if (history.length) {
                  _context7.next = 5;
                  break;
                }

                return _context7.abrupt("return", []);

              case 5:
                _context7.t0 = this.__commitDB;

                if (_context7.t0) {
                  _context7.next = 10;
                  break;
                }

                _context7.next = 9;
                return this._commitDB();

              case 9:
                _context7.t0 = _context7.sent;

              case 10:
                commitDB = _context7.t0;
                _context7.next = 13;
                return commitDB.getDocuments(history.map(function (ea) {
                  return { id: ea };
                }));

              case 13:
                commits = _context7.sent;
                return _context7.abrupt("return", commits);

              case 15:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function getCommits(_x18, _x19) {
        return _ref10.apply(this, arguments);
      }

      return getCommits;
    }()
  }, {
    key: "getLatestCommit",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(type, objectName) {
        var ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "HEAD";

        var _ref12, _ref13, commitId, commitDB;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this._log(type, objectName, ref, 1);

              case 2:
                _ref12 = _context8.sent;
                _ref13 = slicedToArray(_ref12, 1);
                commitId = _ref13[0];

                if (commitId) {
                  _context8.next = 7;
                  break;
                }

                return _context8.abrupt("return", null);

              case 7:
                _context8.t0 = this.__commitDB;

                if (_context8.t0) {
                  _context8.next = 12;
                  break;
                }

                _context8.next = 11;
                return this._commitDB();

              case 11:
                _context8.t0 = _context8.sent;

              case 12:
                commitDB = _context8.t0;
                return _context8.abrupt("return", commitDB.get(commitId));

              case 14:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function getLatestCommit(_x22, _x23) {
        return _ref11.apply(this, arguments);
      }

      return getLatestCommit;
    }()
  }, {
    key: "commitSnapshot",
    value: function () {
      var _ref14 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(type, name, snapshot, commitSpec) {
        var ref = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : "HEAD";
        var expectedPrevVersion = arguments[5];

        var user, _commitSpec$descripti, description, _commitSpec$tags, tags, _commitSpec$message, message, metadata, versionDB, versionData, ancestor, ancestors, snapshotJson, commit, commitDB, res;

        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                user = commitSpec.user, _commitSpec$descripti = commitSpec.description, description = _commitSpec$descripti === undefined ? "no description" : _commitSpec$descripti, _commitSpec$tags = commitSpec.tags, tags = _commitSpec$tags === undefined ? [] : _commitSpec$tags, _commitSpec$message = commitSpec.message, message = _commitSpec$message === undefined ? "" : _commitSpec$message, metadata = commitSpec.metadata;

                if (type) {
                  _context9.next = 3;
                  break;
                }

                throw new Error("object needs a type");

              case 3:
                if (name) {
                  _context9.next = 5;
                  break;
                }

                throw new Error("object needs a name");

              case 5:
                if (user) {
                  _context9.next = 7;
                  break;
                }

                throw new Error("Cannot snapshot " + type + "/" + name + " without user");

              case 7:
                _context9.t0 = this.__versionDB;

                if (_context9.t0) {
                  _context9.next = 12;
                  break;
                }

                _context9.next = 11;
                return this._versionDB();

              case 11:
                _context9.t0 = _context9.sent;

              case 12:
                versionDB = _context9.t0;
                _context9.next = 15;
                return this.versionGraph(type, name);

              case 15:
                versionData = _context9.sent;
                ancestor = versionData ? versionData.refs[ref] : null;
                ancestors = ancestor ? [ancestor] : [];

                if (!expectedPrevVersion) {
                  _context9.next = 23;
                  break;
                }

                if (versionData) {
                  _context9.next = 21;
                  break;
                }

                throw new Error("Trying to store " + name + " on top of expected version " + expectedPrevVersion + " but no version entry exists!");

              case 21:
                if (!(ancestor !== expectedPrevVersion)) {
                  _context9.next = 23;
                  break;
                }

                throw new Error("Trying to store " + name + " on top of expected version " + expectedPrevVersion + " but ref " + ref + " is of version " + ancestor + "!");

              case 23:

                // Snapshot object and create commit.

                snapshotJson = JSON.stringify(snapshot), commit = this._createCommit(type, name, description, tags, metadata, user, message, ancestors, snapshot, snapshotJson);

                // update version graph

                if (!versionData) versionData = { refs: {}, history: {} };
                versionData.refs[ref] = commit._id;
                versionData.history[commit._id] = ancestors;
                _context9.next = 29;
                return versionDB.set(type + "/" + name, versionData);

              case 29:
                _context9.t1 = this.__commitDB;

                if (_context9.t1) {
                  _context9.next = 34;
                  break;
                }

                _context9.next = 33;
                return this._commitDB();

              case 33:
                _context9.t1 = _context9.sent;

              case 34:
                commitDB = _context9.t1;
                _context9.next = 37;
                return commitDB.set(commit._id, commit);

              case 37:
                commit = _context9.sent;


                // write snapshot to resource
                res = this.snapshotResourceFor(commit);
                _context9.next = 41;
                return res.parent().ensureExistance();

              case 41:
                if (!res.canDealWithJSON) {
                  _context9.next = 46;
                  break;
                }

                _context9.next = 44;
                return res.writeJson(snapshot);

              case 44:
                _context9.next = 48;
                break;

              case 46:
                _context9.next = 48;
                return res.write(snapshotJson);

              case 48:
                return _context9.abrupt("return", commit);

              case 49:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function commitSnapshot(_x25, _x26, _x27, _x28) {
        return _ref14.apply(this, arguments);
      }

      return commitSnapshot;
    }()
  }, {
    key: "loadSnapshot",
    value: function () {
      var _ref15 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(type, name, commitOrId) {
        var ref = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "HEAD";
        var commit, commitDB;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                commit = void 0;

                if (!(commitOrId && typeof commitOrId !== "string")) {
                  _context10.next = 5;
                  break;
                }

                commit = commitOrId;
                _context10.next = 20;
                break;

              case 5:
                if (!commitOrId) {
                  _context10.next = 17;
                  break;
                }

                _context10.t0 = this.__commitDB;

                if (_context10.t0) {
                  _context10.next = 11;
                  break;
                }

                _context10.next = 10;
                return this._commitDB();

              case 10:
                _context10.t0 = _context10.sent;

              case 11:
                commitDB = _context10.t0;
                _context10.next = 14;
                return commitDB.get(commitOrId);

              case 14:
                commit = _context10.sent;
                _context10.next = 20;
                break;

              case 17:
                _context10.next = 19;
                return this.getLatestCommit(type, name, ref);

              case 19:
                commit = _context10.sent;

              case 20:
                return _context10.abrupt("return", this.snapshotResourceFor(commit).readJson());

              case 21:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function loadSnapshot(_x30, _x31, _x32) {
        return _ref15.apply(this, arguments);
      }

      return loadSnapshot;
    }()
  }, {
    key: "_createCommit",
    value: function _createCommit(type, name, description, tags, metadata, user) {
      var commitMessage = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : "";
      var ancestors = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : [];
      var snapshot = arguments[8];
      var snapshotJson = arguments[9];

      var commit = {
        name: name, type: type, timestamp: Date.now(),
        author: {
          name: user.name,
          email: user.email,
          realm: user.realm
        },
        tags: [], description: description,
        message: commitMessage,
        preview: snapshot.preview,
        content: sha1(snapshotJson),
        metadata: metadata,
        ancestors: ancestors
      };
      return Object.assign(commit, { _id: sha1(JSON.stringify(commit)) });
    }
  }, {
    key: "_commitDB",
    value: function () {
      var _ref16 = asyncToGenerator(regeneratorRuntime.mark(function _callee11() {
        var dbName, db, hasIndexes, nameIndex, nameAndTimestampIndex, nameWithMaxMinTimestamp;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                if (!this.__commitDB) {
                  _context11.next = 2;
                  break;
                }

                return _context11.abrupt("return", this.__commitDB);

              case 2:
                dbName = "commits-" + this.name, db = Database.findDB(dbName);

                if (!db) {
                  _context11.next = 5;
                  break;
                }

                return _context11.abrupt("return", this.__commitDB = db);

              case 5:

                db = Database.ensureDB(dbName);

                // prepare indexes
                _context11.next = 8;
                return Promise.all([db.has("_design/name_index"), db.has("_design/nameAndTimestamp_index"), db.has("_design/nameWithMaxMinTimestamp_index")]);

              case 8:
                hasIndexes = _context11.sent;

                if (hasIndexes.every(Boolean)) {
                  _context11.next = 16;
                  break;
                }

                console.log("Preparing indexes for object storage DB " + dbName);

                nameIndex = {
                  _id: '_design/name_index',
                  views: { 'name_index': { map: "function (doc) { emit(`${doc.type}\0${doc.name}}`); }" } } }, nameAndTimestampIndex = {
                  _id: '_design/nameAndTimestamp_index',
                  views: { 'nameAndTimestamp_index': {
                      map: "function (doc) { emit(`${doc.type}\0${doc.name}\0${doc.timestamp}}`); }" } } }, nameWithMaxMinTimestamp = {
                  _id: '_design/nameWithMaxMinTimestamp_index',
                  views: {
                    'nameWithMaxMinTimestamp_index': {
                      map: "doc => emit(`${doc.type}\0${doc.name}`, doc.timestamp)",
                      reduce: "_stats" } } };
                _context11.next = 14;
                return db.setDocuments([nameIndex, nameAndTimestampIndex, nameWithMaxMinTimestamp]);

              case 14:
                _context11.next = 16;
                return Promise.all([db.pouchdb.query('name_index', { stale: 'update_after' }), db.pouchdb.query('nameAndTimestamp_index', { stale: 'update_after' }), db.pouchdb.query("nameWithMaxMinTimestamp_index", { stale: 'update_after' })]);

              case 16:
                return _context11.abrupt("return", this.__commitDB = db);

              case 17:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function _commitDB() {
        return _ref16.apply(this, arguments);
      }

      return _commitDB;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // versioning

  }, {
    key: "versionGraph",
    value: function () {
      var _ref17 = asyncToGenerator(regeneratorRuntime.mark(function _callee12(type, objectName) {
        var versionDB, graph;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                _context12.t0 = this.__versionDB;

                if (_context12.t0) {
                  _context12.next = 5;
                  break;
                }

                _context12.next = 4;
                return this._versionDB();

              case 4:
                _context12.t0 = _context12.sent;

              case 5:
                versionDB = _context12.t0;
                _context12.next = 8;
                return versionDB.get(type + "/" + objectName);

              case 8:
                graph = _context12.sent;
                return _context12.abrupt("return", !graph || graph.deleted ? null : graph);

              case 10:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function versionGraph(_x36, _x37) {
        return _ref17.apply(this, arguments);
      }

      return versionGraph;
    }()
  }, {
    key: "_log",
    value: function () {
      var _ref18 = asyncToGenerator(regeneratorRuntime.mark(function _callee13(type, objectName) {
        var ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "HEAD";
        var limit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Infinity;

        var data, version, history, _ref19, _ref20;

        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.next = 2;
                return this.versionGraph(type, objectName);

              case 2:
                data = _context13.sent;

                if (!(!data || data.deleted)) {
                  _context13.next = 5;
                  break;
                }

                return _context13.abrupt("return", []);

              case 5:
                version = data.refs.HEAD, history = [];

              case 6:
                

                if (!history.includes(version)) {
                  _context13.next = 9;
                  break;
                }

                throw new Error("cyclic version graph???");

              case 9:
                history.push(version);
                // FIXME what about multiple ancestors?
                _ref19 = data.history[version] || [];
                _ref20 = slicedToArray(_ref19, 1);
                version = _ref20[0];

                if (!(!version || history.length >= limit)) {
                  _context13.next = 15;
                  break;
                }

                return _context13.abrupt("break", 17);

              case 15:
                _context13.next = 6;
                break;

              case 17:
                return _context13.abrupt("return", history);

              case 18:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function _log(_x38, _x39) {
        return _ref18.apply(this, arguments);
      }

      return _log;
    }()
  }, {
    key: "_findTimestampedVersionsOfObjectNamed",
    value: function () {
      var _ref21 = asyncToGenerator(regeneratorRuntime.mark(function _callee14(objectName) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _options$include_docs, include_docs, _options$descending, descending, _options$startTime, startTime, _options$endTime, endTime, startkey, endkey, objectDB, _ref22, rows;

        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _options$include_docs = options.include_docs;
                include_docs = _options$include_docs === undefined ? true : _options$include_docs;
                _options$descending = options.descending;
                descending = _options$descending === undefined ? true : _options$descending;
                _options$startTime = options.startTime;
                startTime = _options$startTime === undefined ? "0".repeat(13) : _options$startTime;
                _options$endTime = options.endTime;
                endTime = _options$endTime === undefined ? "9".repeat(13) : _options$endTime;
                startkey = objectName + "\0" + (descending ? endTime : startTime);
                endkey = objectName + "\0" + (descending ? startTime : endTime);
                _context14.t0 = this.__commitDB;

                if (_context14.t0) {
                  _context14.next = 15;
                  break;
                }

                _context14.next = 14;
                return this._commitDB();

              case 14:
                _context14.t0 = _context14.sent;

              case 15:
                objectDB = _context14.t0;
                _context14.next = 18;
                return objectDB.pouchdb.query("nameAndTimestamp_index", _extends({}, options, {
                  descending: descending,
                  include_docs: include_docs,
                  startkey: startkey,
                  endkey: endkey
                }));

              case 18:
                _ref22 = _context14.sent;
                rows = _ref22.rows;
                return _context14.abrupt("return", include_docs ? rows.map(function (ea) {
                  return ea.doc;
                }) : rows.map(function (ea) {
                  return ea.id;
                }));

              case 21:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function _findTimestampedVersionsOfObjectNamed(_x42) {
        return _ref21.apply(this, arguments);
      }

      return _findTimestampedVersionsOfObjectNamed;
    }()
  }, {
    key: "_versionDB",
    value: function () {
      var _ref23 = asyncToGenerator(regeneratorRuntime.mark(function _callee15() {
        var dbName, db;
        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                if (!this.__versionDB) {
                  _context15.next = 2;
                  break;
                }

                return _context15.abrupt("return", this.__versionDB);

              case 2:
                dbName = "version-graph-" + this.name, db = Database.findDB(dbName);

                if (!db) {
                  _context15.next = 5;
                  break;
                }

                return _context15.abrupt("return", this.__versionDB = db);

              case 5:
                db = Database.ensureDB(dbName);

                // var typeAndNameIndex = {
                //   _id: '_design/type_name_index',
                //   views: {'name_index': {map: 'function (doc) { emit(`${doc.type}\u0000${doc.name}}`); }'}}};
                // db.setDocuments([typeAndNameIndex]);
                // await Promise.alll([db.pouchdb.query('type_name_index', {stale: 'update_after'})]);

                return _context15.abrupt("return", this.__versionDB = db);

              case 7:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function _versionDB() {
        return _ref23.apply(this, arguments);
      }

      return _versionDB;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // export

  }, {
    key: "exportToDir",
    value: function () {
      var _ref24 = asyncToGenerator(regeneratorRuntime.mark(function _callee16(exportDir, nameAndTypes) {
        var _this = this;

        var copyResources = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var commitDB, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _loop, _iterator2, _step2;

        return regeneratorRuntime.wrap(function _callee16$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                _context17.t0 = this.__commitDB;

                if (_context17.t0) {
                  _context17.next = 5;
                  break;
                }

                _context17.next = 4;
                return this._commitDB();

              case 4:
                _context17.t0 = _context17.sent;

              case 5:
                commitDB = _context17.t0;
                ;
                _iteratorNormalCompletion2 = true;
                _didIteratorError2 = false;
                _iteratorError2 = undefined;
                _context17.prev = 10;
                _loop = regeneratorRuntime.mark(function _loop() {
                  var _ref25, name, type, currentExportDir, _ref26, refs, history, commitIds, commits, resourcesForCopy, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _ref28, from, to;

                  return regeneratorRuntime.wrap(function _loop$(_context16) {
                    while (1) {
                      switch (_context16.prev = _context16.next) {
                        case 0:
                          _ref25 = _step2.value;
                          name = _ref25.name, type = _ref25.type;
                          currentExportDir = exportDir.join(type).join(name);
                          _context16.next = 5;
                          return _this.versionGraph(type, name);

                        case 5:
                          _ref26 = _context16.sent;
                          refs = _ref26.refs;
                          history = _ref26.history;
                          commitIds = Object.keys(history);
                          _context16.next = 11;
                          return commitDB.getDocuments(commitIds.map(function (id) {
                            return { id: id };
                          }));

                        case 11:
                          commits = _context16.sent;
                          resourcesForCopy = copyResources ? commits.map(function (commit) {
                            delete commit._rev;
                            var from = _this.snapshotResourceFor(commit),
                                to = currentExportDir.join(from.parent().name() + "/" + from.name());
                            return { from: from, to: to };
                          }) : [];


                          if (!copyResources) commits.forEach(function (commit) {
                            delete commit._rev;
                          });
                          _context16.next = 16;
                          return currentExportDir.join("index.json").writeJson({ name: name, type: type });

                        case 16:
                          _context16.next = 18;
                          return currentExportDir.join("commits.json").writeJson(commits);

                        case 18:
                          _context16.next = 20;
                          return currentExportDir.join("history.json").writeJson({ refs: refs, history: history });

                        case 20:
                          _iteratorNormalCompletion3 = true;
                          _didIteratorError3 = false;
                          _iteratorError3 = undefined;
                          _context16.prev = 23;
                          _iterator3 = resourcesForCopy[Symbol.iterator]();

                        case 25:
                          if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
                            _context16.next = 33;
                            break;
                          }

                          _ref28 = _step3.value;
                          from = _ref28.from, to = _ref28.to;
                          _context16.next = 30;
                          return from.copyTo(to);

                        case 30:
                          _iteratorNormalCompletion3 = true;
                          _context16.next = 25;
                          break;

                        case 33:
                          _context16.next = 39;
                          break;

                        case 35:
                          _context16.prev = 35;
                          _context16.t0 = _context16["catch"](23);
                          _didIteratorError3 = true;
                          _iteratorError3 = _context16.t0;

                        case 39:
                          _context16.prev = 39;
                          _context16.prev = 40;

                          if (!_iteratorNormalCompletion3 && _iterator3.return) {
                            _iterator3.return();
                          }

                        case 42:
                          _context16.prev = 42;

                          if (!_didIteratorError3) {
                            _context16.next = 45;
                            break;
                          }

                          throw _iteratorError3;

                        case 45:
                          return _context16.finish(42);

                        case 46:
                          return _context16.finish(39);

                        case 47:
                        case "end":
                          return _context16.stop();
                      }
                    }
                  }, _loop, _this, [[23, 35, 39, 47], [40,, 42, 46]]);
                });
                _iterator2 = nameAndTypes[Symbol.iterator]();

              case 13:
                if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                  _context17.next = 18;
                  break;
                }

                return _context17.delegateYield(_loop(), "t1", 15);

              case 15:
                _iteratorNormalCompletion2 = true;
                _context17.next = 13;
                break;

              case 18:
                _context17.next = 24;
                break;

              case 20:
                _context17.prev = 20;
                _context17.t2 = _context17["catch"](10);
                _didIteratorError2 = true;
                _iteratorError2 = _context17.t2;

              case 24:
                _context17.prev = 24;
                _context17.prev = 25;

                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }

              case 27:
                _context17.prev = 27;

                if (!_didIteratorError2) {
                  _context17.next = 30;
                  break;
                }

                throw _iteratorError2;

              case 30:
                return _context17.finish(27);

              case 31:
                return _context17.finish(24);

              case 32:
              case "end":
                return _context17.stop();
            }
          }
        }, _callee16, this, [[10, 20, 24, 32], [25,, 27, 31]]);
      }));

      function exportToDir(_x44, _x45) {
        return _ref24.apply(this, arguments);
      }

      return exportToDir;
    }()
  }, {
    key: "exportToSpecs",
    value: function () {
      var _ref29 = asyncToGenerator(regeneratorRuntime.mark(function _callee17(nameAndTypes) {
        var specs, commitDB, stats, type, name, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _ref31, _name, _type2, _ref32, refs, history, commitIds, commits;

        return regeneratorRuntime.wrap(function _callee17$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                specs = [];
                _context18.t0 = this.__commitDB;

                if (_context18.t0) {
                  _context18.next = 6;
                  break;
                }

                _context18.next = 5;
                return this._commitDB();

              case 5:
                _context18.t0 = _context18.sent;

              case 6:
                commitDB = _context18.t0;
                ;

                if (nameAndTypes) {
                  _context18.next = 17;
                  break;
                }

                // = everything
                nameAndTypes = [];
                _context18.next = 12;
                return this.objectStats();

              case 12:
                _context18.t1 = _context18.sent;

                if (_context18.t1) {
                  _context18.next = 15;
                  break;
                }

                _context18.t1 = {};

              case 15:
                stats = _context18.t1;

                for (type in stats) {
                  for (name in stats[type]) {
                    nameAndTypes.push({ type: type, name: name });
                  }
                }

              case 17:
                _iteratorNormalCompletion4 = true;
                _didIteratorError4 = false;
                _iteratorError4 = undefined;
                _context18.prev = 20;
                _iterator4 = nameAndTypes[Symbol.iterator]();

              case 22:
                if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                  _context18.next = 39;
                  break;
                }

                _ref31 = _step4.value;
                _name = _ref31.name, _type2 = _ref31.type;
                _context18.next = 27;
                return this.versionGraph(_type2, _name);

              case 27:
                _ref32 = _context18.sent;
                refs = _ref32.refs;
                history = _ref32.history;
                commitIds = Object.keys(history);
                _context18.next = 33;
                return commitDB.getDocuments(commitIds.map(function (id) {
                  return { id: id };
                }));

              case 33:
                commits = _context18.sent;

                commits.forEach(function (commit) {
                  delete commit._rev;
                });
                specs.push({ type: _type2, name: _name, commits: commits, history: { refs: refs, history: history } });

              case 36:
                _iteratorNormalCompletion4 = true;
                _context18.next = 22;
                break;

              case 39:
                _context18.next = 45;
                break;

              case 41:
                _context18.prev = 41;
                _context18.t2 = _context18["catch"](20);
                _didIteratorError4 = true;
                _iteratorError4 = _context18.t2;

              case 45:
                _context18.prev = 45;
                _context18.prev = 46;

                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                  _iterator4.return();
                }

              case 48:
                _context18.prev = 48;

                if (!_didIteratorError4) {
                  _context18.next = 51;
                  break;
                }

                throw _iteratorError4;

              case 51:
                return _context18.finish(48);

              case 52:
                return _context18.finish(45);

              case 53:
                return _context18.abrupt("return", specs);

              case 54:
              case "end":
                return _context18.stop();
            }
          }
        }, _callee17, this, [[20, 41, 45, 53], [46,, 48, 52]]);
      }));

      function exportToSpecs(_x47) {
        return _ref29.apply(this, arguments);
      }

      return exportToSpecs;
    }()
  }, {
    key: "importFromDir",
    value: function () {
      var _ref33 = asyncToGenerator(regeneratorRuntime.mark(function _callee19(importDir) {
        var overwrite = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        var findImportDataIn = function () {
          var _ref34 = asyncToGenerator(regeneratorRuntime.mark(function _callee18(dir) {
            var _ref35, _ref36, _ref36$, type, name, commits, history, snapshotDirs;

            return regeneratorRuntime.wrap(function _callee18$(_context19) {
              while (1) {
                switch (_context19.prev = _context19.next) {
                  case 0:
                    _context19.next = 2;
                    return Promise.all([dir.join("index.json").readJson(), dir.join("commits.json").readJson(), dir.join("history.json").readJson()]);

                  case 2:
                    _ref35 = _context19.sent;
                    _ref36 = slicedToArray(_ref35, 3);
                    _ref36$ = _ref36[0];
                    type = _ref36$.type;
                    name = _ref36$.name;
                    commits = _ref36[1];
                    history = _ref36[2];

                    if (!copyResources) {
                      _context19.next = 15;
                      break;
                    }

                    _context19.next = 12;
                    return dir.dirList(1, { exclude: function exclude(ea) {
                        return !ea.isDirectory();
                      } });

                  case 12:
                    _context19.t0 = _context19.sent;
                    _context19.next = 16;
                    break;

                  case 15:
                    _context19.t0 = [];

                  case 16:
                    snapshotDirs = _context19.t0;
                    return _context19.abrupt("return", { dir: dir, type: type, name: name, commits: commits, history: history, snapshotDirs: snapshotDirs });

                  case 18:
                  case "end":
                    return _context19.stop();
                }
              }
            }, _callee18, this);
          }));

          return function findImportDataIn(_x51) {
            return _ref34.apply(this, arguments);
          };
        }();

        var copyResources = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var indexes, dirs, versionDB, commitDB, snapshotLocation, importSpecs, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, dir;

        return regeneratorRuntime.wrap(function _callee19$(_context20) {
          while (1) {
            switch (_context20.prev = _context20.next) {
              case 0:
                _context20.next = 2;
                return importDir.dirList(3, { exclude: function exclude(ea) {
                    return ea.name() !== "index.json";
                  } });

              case 2:
                indexes = _context20.sent;

                indexes = indexes.filter(function (ea) {
                  return ea.name() === "index.json";
                }); // FIXME!
                dirs = indexes.map(function (ea) {
                  return ea.parent();
                });
                _context20.t0 = this.__versionDB;

                if (_context20.t0) {
                  _context20.next = 10;
                  break;
                }

                _context20.next = 9;
                return this._versionDB();

              case 9:
                _context20.t0 = _context20.sent;

              case 10:
                versionDB = _context20.t0;
                _context20.t1 = this.__commitDB;

                if (_context20.t1) {
                  _context20.next = 16;
                  break;
                }

                _context20.next = 15;
                return this._commitDB();

              case 15:
                _context20.t1 = _context20.sent;

              case 16:
                commitDB = _context20.t1;
                snapshotLocation = this.snapshotLocation;
                importSpecs = [];


                // 2. retrieve import data
                _iteratorNormalCompletion5 = true;
                _didIteratorError5 = false;
                _iteratorError5 = undefined;
                _context20.prev = 22;
                _iterator5 = dirs[Symbol.iterator]();

              case 24:
                if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
                  _context20.next = 34;
                  break;
                }

                dir = _step5.value;
                _context20.t2 = importSpecs;
                _context20.next = 29;
                return findImportDataIn(dir);

              case 29:
                _context20.t3 = _context20.sent;

                _context20.t2.push.call(_context20.t2, _context20.t3);

              case 31:
                _iteratorNormalCompletion5 = true;
                _context20.next = 24;
                break;

              case 34:
                _context20.next = 40;
                break;

              case 36:
                _context20.prev = 36;
                _context20.t4 = _context20["catch"](22);
                _didIteratorError5 = true;
                _iteratorError5 = _context20.t4;

              case 40:
                _context20.prev = 40;
                _context20.prev = 41;

                if (!_iteratorNormalCompletion5 && _iterator5.return) {
                  _iterator5.return();
                }

              case 43:
                _context20.prev = 43;

                if (!_didIteratorError5) {
                  _context20.next = 46;
                  break;
                }

                throw _iteratorError5;

              case 46:
                return _context20.finish(43);

              case 47:
                return _context20.finish(40);

              case 48:
                return _context20.abrupt("return", this.importFromSpecs(importSpecs, overwrite, copyResources));

              case 49:
              case "end":
                return _context20.stop();
            }
          }
        }, _callee19, this, [[22, 36, 40, 48], [41,, 43, 47]]);
      }));

      function importFromDir(_x48) {
        return _ref33.apply(this, arguments);
      }

      return importFromDir;
    }()
  }, {
    key: "importFromSpecs",
    value: function () {
      var _ref37 = asyncToGenerator(regeneratorRuntime.mark(function _callee20(specs) {
        var overwrite = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var copyResources = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var versionDB, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, _ref39, type, name, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, spec;

        return regeneratorRuntime.wrap(function _callee20$(_context21) {
          while (1) {
            switch (_context21.prev = _context21.next) {
              case 0:
                if (overwrite) {
                  _context21.next = 36;
                  break;
                }

                _context21.t0 = this.__versionDB;

                if (_context21.t0) {
                  _context21.next = 6;
                  break;
                }

                _context21.next = 5;
                return this._versionDB();

              case 5:
                _context21.t0 = _context21.sent;

              case 6:
                versionDB = _context21.t0;
                _iteratorNormalCompletion6 = true;
                _didIteratorError6 = false;
                _iteratorError6 = undefined;
                _context21.prev = 10;
                _iterator6 = specs[Symbol.iterator]();

              case 12:
                if (_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done) {
                  _context21.next = 22;
                  break;
                }

                _ref39 = _step6.value;
                type = _ref39.type, name = _ref39.name;
                _context21.next = 17;
                return versionDB.get(type + "/" + name);

              case 17:
                if (!_context21.sent) {
                  _context21.next = 19;
                  break;
                }

                throw new Error("Import failed: object " + type + "/" + name + " already exists and overwrite is not allowed");

              case 19:
                _iteratorNormalCompletion6 = true;
                _context21.next = 12;
                break;

              case 22:
                _context21.next = 28;
                break;

              case 24:
                _context21.prev = 24;
                _context21.t1 = _context21["catch"](10);
                _didIteratorError6 = true;
                _iteratorError6 = _context21.t1;

              case 28:
                _context21.prev = 28;
                _context21.prev = 29;

                if (!_iteratorNormalCompletion6 && _iterator6.return) {
                  _iterator6.return();
                }

              case 31:
                _context21.prev = 31;

                if (!_didIteratorError6) {
                  _context21.next = 34;
                  break;
                }

                throw _iteratorError6;

              case 34:
                return _context21.finish(31);

              case 35:
                return _context21.finish(28);

              case 36:
                _iteratorNormalCompletion7 = true;
                _didIteratorError7 = false;
                _iteratorError7 = undefined;
                _context21.prev = 39;
                _iterator7 = specs[Symbol.iterator]();

              case 41:
                if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
                  _context21.next = 48;
                  break;
                }

                spec = _step7.value;
                _context21.next = 45;
                return this.importFromSpec(spec, true, copyResources);

              case 45:
                _iteratorNormalCompletion7 = true;
                _context21.next = 41;
                break;

              case 48:
                _context21.next = 54;
                break;

              case 50:
                _context21.prev = 50;
                _context21.t2 = _context21["catch"](39);
                _didIteratorError7 = true;
                _iteratorError7 = _context21.t2;

              case 54:
                _context21.prev = 54;
                _context21.prev = 55;

                if (!_iteratorNormalCompletion7 && _iterator7.return) {
                  _iterator7.return();
                }

              case 57:
                _context21.prev = 57;

                if (!_didIteratorError7) {
                  _context21.next = 60;
                  break;
                }

                throw _iteratorError7;

              case 60:
                return _context21.finish(57);

              case 61:
                return _context21.finish(54);

              case 62:
                return _context21.abrupt("return", specs);

              case 63:
              case "end":
                return _context21.stop();
            }
          }
        }, _callee20, this, [[10, 24, 28, 36], [29,, 31, 35], [39, 50, 54, 62], [55,, 57, 61]]);
      }));

      function importFromSpecs(_x52) {
        return _ref37.apply(this, arguments);
      }

      return importFromSpecs;
    }()
  }, {
    key: "importFromSpec",
    value: function () {
      var _ref40 = asyncToGenerator(regeneratorRuntime.mark(function _callee21(spec) {
        var overwrite = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var copyResources = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        var versionDB, commitDB, snapshotLocation, type, name, commits, history, snapshotDirs;
        return regeneratorRuntime.wrap(function _callee21$(_context22) {
          while (1) {
            switch (_context22.prev = _context22.next) {
              case 0:
                _context22.t0 = this.__versionDB;

                if (_context22.t0) {
                  _context22.next = 5;
                  break;
                }

                _context22.next = 4;
                return this._versionDB();

              case 4:
                _context22.t0 = _context22.sent;

              case 5:
                versionDB = _context22.t0;
                _context22.t1 = this.__commitDB;

                if (_context22.t1) {
                  _context22.next = 11;
                  break;
                }

                _context22.next = 10;
                return this._commitDB();

              case 10:
                _context22.t1 = _context22.sent;

              case 11:
                commitDB = _context22.t1;
                snapshotLocation = this.snapshotLocation;
                type = spec.type;
                name = spec.name;
                commits = spec.commits;
                history = spec.history;
                snapshotDirs = spec.snapshotDirs;
                _context22.t2 = !overwrite;

                if (!_context22.t2) {
                  _context22.next = 23;
                  break;
                }

                _context22.next = 22;
                return versionDB.get(type + "/" + name);

              case 22:
                _context22.t2 = _context22.sent;

              case 23:
                if (!_context22.t2) {
                  _context22.next = 25;
                  break;
                }

                throw new Error("Import failed: object " + type + "/" + name + " already exists and overwrite is not allowed");

              case 25:
                _context22.next = 27;
                return Promise.all([commitDB.setDocuments(commits), versionDB.set(type + "/" + name, history)].concat(toConsumableArray(snapshotDirs && copyResources ? snapshotDirs.map(function (ea) {
                  return ea.copyTo(snapshotLocation.join(ea.name()).asDirectory());
                }) : [])));

              case 27:
                return _context22.abrupt("return", spec);

              case 28:
              case "end":
                return _context22.stop();
            }
          }
        }, _callee21, this);
      }));

      function importFromSpec(_x55) {
        return _ref40.apply(this, arguments);
      }

      return importFromSpec;
    }()
  }, {
    key: "importFromResource",
    value: function () {
      var _ref41 = asyncToGenerator(regeneratorRuntime.mark(function _callee22(type, name, resource, commitData) {
        var purgeHistory = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
        var snap;
        return regeneratorRuntime.wrap(function _callee22$(_context23) {
          while (1) {
            switch (_context23.prev = _context23.next) {
              case 0:
                _context23.next = 2;
                return resource.readJson();

              case 2:
                snap = _context23.sent;
                _context23.t0 = purgeHistory;

                if (!_context23.t0) {
                  _context23.next = 8;
                  break;
                }

                _context23.next = 7;
                return this.has(type, name);

              case 7:
                _context23.t0 = _context23.sent;

              case 8:
                if (!_context23.t0) {
                  _context23.next = 11;
                  break;
                }

                _context23.next = 11;
                return this.delete(type, name, false);

              case 11:
                return _context23.abrupt("return", this.commitSnapshot(type, name, snap, commitData));

              case 12:
              case "end":
                return _context23.stop();
            }
          }
        }, _callee22, this);
      }));

      function importFromResource(_x58, _x59, _x60, _x61) {
        return _ref41.apply(this, arguments);
      }

      return importFromResource;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // deletion

  }, {
    key: "delete",
    value: function () {
      var _ref42 = asyncToGenerator(regeneratorRuntime.mark(function _callee23(type, name) {
        var dryRun = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

        var resources, commitDeletions, objectDB, opts, _ref43, rows, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, _ref46, commit, versionDB, _ref45, _id, _rev, deletedHist;

        return regeneratorRuntime.wrap(function _callee23$(_context24) {
          while (1) {
            switch (_context24.prev = _context24.next) {
              case 0:
                resources = [], commitDeletions = [];

                // 1. meta data to delete

                _context24.t0 = this.__commitDB;

                if (_context24.t0) {
                  _context24.next = 6;
                  break;
                }

                _context24.next = 5;
                return this._commitDB();

              case 5:
                _context24.t0 = _context24.sent;

              case 6:
                objectDB = _context24.t0;
                opts = {
                  include_docs: true,
                  startkey: type + "\0" + name + "\0",
                  endkey: type + "\0" + name + "\uFFFF"
                };
                _context24.next = 10;
                return objectDB.query("nameAndTimestamp_index", opts);

              case 10:
                _ref43 = _context24.sent;
                rows = _ref43.rows;
                _iteratorNormalCompletion8 = true;
                _didIteratorError8 = false;
                _iteratorError8 = undefined;
                _context24.prev = 15;


                for (_iterator8 = rows[Symbol.iterator](); !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
                  _ref46 = _step8.value;
                  commit = _ref46.doc;

                  // 2. resources to delete
                  resources.push(this.snapshotResourceFor(commit));
                  commitDeletions.push(_extends({}, commit, { _deleted: true }));
                }

                // 3. history to delete
                _context24.next = 23;
                break;

              case 19:
                _context24.prev = 19;
                _context24.t1 = _context24["catch"](15);
                _didIteratorError8 = true;
                _iteratorError8 = _context24.t1;

              case 23:
                _context24.prev = 23;
                _context24.prev = 24;

                if (!_iteratorNormalCompletion8 && _iterator8.return) {
                  _iterator8.return();
                }

              case 26:
                _context24.prev = 26;

                if (!_didIteratorError8) {
                  _context24.next = 29;
                  break;
                }

                throw _iteratorError8;

              case 29:
                return _context24.finish(26);

              case 30:
                return _context24.finish(23);

              case 31:
                _context24.t2 = this.__versionDB;

                if (_context24.t2) {
                  _context24.next = 36;
                  break;
                }

                _context24.next = 35;
                return this._versionDB();

              case 35:
                _context24.t2 = _context24.sent;

              case 36:
                versionDB = _context24.t2;
                _context24.next = 39;
                return versionDB.get(type + "/" + name);

              case 39:
                _ref45 = _context24.sent;
                _id = _ref45._id;
                _rev = _ref45._rev;
                deletedHist = { _id: _id, _rev: _rev, deleted: true };

                if (dryRun) {
                  _context24.next = 49;
                  break;
                }

                _context24.next = 46;
                return objectDB.setDocuments(commitDeletions);

              case 46:
                _context24.next = 48;
                return versionDB.setDocuments([deletedHist]);

              case 48:
                Promise.all(resources.map(function (ea) {
                  return ea.remove();
                }));

              case 49:
                return _context24.abrupt("return", {
                  commits: commitDeletions,
                  history: deletedHist,
                  resources: resources
                });

              case 50:
              case "end":
                return _context24.stop();
            }
          }
        }, _callee23, this, [[15, 19, 23, 31], [24,, 26, 30]]);
      }));

      function _delete(_x63, _x64) {
        return _ref42.apply(this, arguments);
      }

      return _delete;
    }()
  }, {
    key: "deleteCommit",
    value: function () {
      var _ref47 = asyncToGenerator(regeneratorRuntime.mark(function _callee24(commitOrId) {
        var dryRun = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        var ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "HEAD";

        var commit, commitDB, versionDB, objectDB, _commit, name, type, _id, resources, commitDeletions, hist, _ref48, _ref49, ancestor;

        return regeneratorRuntime.wrap(function _callee24$(_context25) {
          while (1) {
            switch (_context25.prev = _context25.next) {
              case 0:
                commit = void 0;

                if (!(commitOrId && typeof commitOrId !== "string")) {
                  _context25.next = 5;
                  break;
                }

                commit = commitOrId;
                _context25.next = 15;
                break;

              case 5:
                if (!commitOrId) {
                  _context25.next = 15;
                  break;
                }

                _context25.t0 = this.__commitDB;

                if (_context25.t0) {
                  _context25.next = 11;
                  break;
                }

                _context25.next = 10;
                return this._commitDB();

              case 10:
                _context25.t0 = _context25.sent;

              case 11:
                commitDB = _context25.t0;
                _context25.next = 14;
                return commitDB.get(commitOrId);

              case 14:
                commit = _context25.sent;

              case 15:
                if (commit) {
                  _context25.next = 17;
                  break;
                }

                throw new Error("commit needed!");

              case 17:
                _context25.t1 = this.__versionDB;

                if (_context25.t1) {
                  _context25.next = 22;
                  break;
                }

                _context25.next = 21;
                return this._versionDB();

              case 21:
                _context25.t1 = _context25.sent;

              case 22:
                versionDB = _context25.t1;
                _context25.t2 = this.__commitDB;

                if (_context25.t2) {
                  _context25.next = 28;
                  break;
                }

                _context25.next = 27;
                return this._commitDB();

              case 27:
                _context25.t2 = _context25.sent;

              case 28:
                objectDB = _context25.t2;
                _commit = commit;
                name = _commit.name;
                type = _commit.type;
                _id = _commit._id;
                resources = [this.snapshotResourceFor(commit)];
                commitDeletions = [_extends({}, commit, { _deleted: true })];
                _context25.next = 37;
                return versionDB.get(type + "/" + name);

              case 37:
                hist = _context25.sent;

                if (hist) {
                  _context25.next = 40;
                  break;
                }

                throw new Error("No history for " + type + "/" + name + "@" + commit._id);

              case 40:
                if (hist.refs[ref]) {
                  _context25.next = 42;
                  break;
                }

                throw new Error("Cannot delete commit " + type + "/" + name + "@" + commit._id + " b/c it is not where ref " + ref + " is pointing!");

              case 42:
                _ref48 = hist.history[commit._id] || [], _ref49 = slicedToArray(_ref48, 1), ancestor = _ref49[0];

                if (!(!ancestor && Object.keys(hist.history).length <= 1)) {
                  _context25.next = 47;
                  break;
                }

                hist.deleted = true;
                _context25.next = 53;
                break;

              case 47:
                if (ancestor) {
                  _context25.next = 51;
                  break;
                }

                throw new Error("Cannot delete commit " + type + "/" + name + "@" + commit._id + " b/c it has no ancestor but there are still other commits!");

              case 51:
                delete hist.history[commit._id];
                hist.refs[ref] = ancestor;

              case 53:
                if (dryRun) {
                  _context25.next = 59;
                  break;
                }

                _context25.next = 56;
                return objectDB.setDocuments(commitDeletions);

              case 56:
                _context25.next = 58;
                return versionDB.set(type + "/" + name, hist);

              case 58:
                Promise.all(resources.map(function (ea) {
                  return ea.remove();
                }));

              case 59:
                return _context25.abrupt("return", {
                  commits: commitDeletions,
                  history: hist,
                  resources: resources
                });

              case 60:
              case "end":
                return _context25.stop();
            }
          }
        }, _callee24, this);
      }));

      function deleteCommit(_x66) {
        return _ref47.apply(this, arguments);
      }

      return deleteCommit;
    }()
  }]);
  return ObjectDB;
}();

var debug = false;
var slashRe = /\//g;

function applyExclude(resource, exclude) {
  if (!exclude) return true;
  if (typeof exclude === "string") return !resource.url.includes(exclude);
  if (typeof exclude === "function") return !exclude(resource);
  if (exclude instanceof RegExp) return !exclude.test(resource.url);
  return true;
}

// await StorageDatabase.databases.get("lively.storage-worlds").destroy()
var StorageDatabase = function (_Database) {
  inherits(StorageDatabase, _Database);

  function StorageDatabase() {
    classCallCheck(this, StorageDatabase);
    return possibleConstructorReturn(this, (StorageDatabase.__proto__ || Object.getPrototypeOf(StorageDatabase)).apply(this, arguments));
  }

  createClass(StorageDatabase, null, [{
    key: "ensureDB",
    value: function ensureDB(name, options) {
      return get$1(StorageDatabase.__proto__ || Object.getPrototypeOf(StorageDatabase), "ensureDB", this).call(this, "lively.storage-" + name, options);
    }
  }]);
  return StorageDatabase;
}(Database);

var LivelyStorageResource = function (_Resource) {
  inherits(LivelyStorageResource, _Resource);

  function LivelyStorageResource() {
    classCallCheck(this, LivelyStorageResource);
    return possibleConstructorReturn(this, (LivelyStorageResource.__proto__ || Object.getPrototypeOf(LivelyStorageResource)).apply(this, arguments));
  }

  createClass(LivelyStorageResource, [{
    key: "read",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        var file, content;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                debug && console.log("[" + this + "] read");
                _context.next = 3;
                return this.db.get(this.pathWithoutQuery());

              case 3:
                file = _context.sent;
                content = file && file.content;
                return _context.abrupt("return", !content ? "" : typeof content === "string" ? content : JSON.stringify(content));

              case 6:
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
    key: "readJson",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var content;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.read();

              case 2:
                content = _context2.sent;
                return _context2.abrupt("return", typeof content === "string" ? JSON.parse(content) : content);

              case 4:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function readJson() {
        return _ref2.apply(this, arguments);
      }

      return readJson;
    }()
  }, {
    key: "write",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(content) {
        var _this3 = this;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                debug && console.log("[" + this + "] write");
                if (!content) content = "";

                if (!this.isDirectory()) {
                  _context3.next = 4;
                  break;
                }

                throw new Error("Cannot write into a directory! (" + this.url + ")");

              case 4:
                _context3.next = 6;
                return this.db.update(this.pathWithoutQuery(), function (spec) {
                  if (spec && spec.isDirectory) throw new Error(_this3.url + " already exists and is a directory (cannot write into it!)");
                  var t = Date.now();
                  if (!spec) {
                    return {
                      etag: undefined,
                      type: undefined,
                      contentType: undefined,
                      user: undefined,
                      group: undefined,
                      mode: undefined,
                      lastModified: t,
                      created: t,
                      size: typeof content === "string" ? content.length : 0,
                      content: content
                    };
                  }

                  return _extends({}, spec, {
                    lastModified: t,
                    size: content.length,
                    content: content
                  });
                });

              case 6:
                return _context3.abrupt("return", this);

              case 7:
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
    key: "writeJson",
    value: function writeJson(obj) {
      return this.write(obj);
    }
  }, {
    key: "mkdir",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        var spec, t;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                debug && console.log("[" + this + "] mkdir");

                if (this.isDirectory()) {
                  _context4.next = 3;
                  break;
                }

                throw new Error("Cannot mkdir a file! (" + this.url + ")");

              case 3:
                _context4.next = 5;
                return this.db.get(this.pathWithoutQuery());

              case 5:
                spec = _context4.sent;

                if (!spec) {
                  _context4.next = 10;
                  break;
                }

                if (spec.isDirectory) {
                  _context4.next = 9;
                  break;
                }

                throw new Error(this.url + " already exists and is a file (cannot mkdir it!)");

              case 9:
                return _context4.abrupt("return", this);

              case 10:
                t = Date.now();
                _context4.next = 13;
                return this.db.set(this.pathWithoutQuery(), {
                  etag: undefined,
                  type: undefined,
                  contentType: undefined,
                  user: undefined,
                  group: undefined,
                  mode: undefined,
                  lastModified: t,
                  created: t,
                  isDirectory: true
                });

              case 13:
                return _context4.abrupt("return", this);

              case 14:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function mkdir() {
        return _ref4.apply(this, arguments);
      }

      return mkdir;
    }()
  }, {
    key: "exists",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                debug && console.log("[" + this + "] exists");
                _context5.t0 = this.isRoot();

                if (_context5.t0) {
                  _context5.next = 6;
                  break;
                }

                _context5.next = 5;
                return this.db.get(this.pathWithoutQuery());

              case 5:
                _context5.t0 = !!_context5.sent;

              case 6:
                return _context5.abrupt("return", _context5.t0);

              case 7:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function exists() {
        return _ref5.apply(this, arguments);
      }

      return exists;
    }()
  }, {
    key: "remove",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var thisPath, db, matching;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                debug && console.log("[" + this + "] remove");
                thisPath = this.pathWithoutQuery();
                db = this.db;
                _context6.next = 5;
                return db.docList({ startkey: thisPath, endkey: thisPath + "\uFFFF" });

              case 5:
                matching = _context6.sent;
                _context6.next = 8;
                return db.setDocuments(matching.map(function (_ref7) {
                  var _id = _ref7.id,
                      _rev = _ref7.rev;
                  return { _id: _id, _rev: _rev, _deleted: true };
                }));

              case 8:
                return _context6.abrupt("return", this);

              case 9:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function remove() {
        return _ref6.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "readProperties",
    value: function readProperties() {
      debug && console.log("[" + this + "] readProperties");
      return this.db.get(this.pathWithoutQuery());
    }
  }, {
    key: "dirList",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        var _this4 = this;

        var depth = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var exclude, prefix, children, docs, i, doc, path, isDirectory, trailing, childDepth, _ret, child, propNames, props, _i;

        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                debug && console.log("[" + this + "] dirList");

                if (this.isDirectory()) {
                  _context7.next = 3;
                  break;
                }

                return _context7.abrupt("return", this.asDirectory().dirList(depth, opts));

              case 3:
                exclude = opts.exclude;
                prefix = this.pathWithoutQuery();
                children = [];
                _context7.next = 8;
                return this.db.getAll({ startkey: prefix, endkey: prefix + "\uFFFF" });

              case 8:
                docs = _context7.sent;


                if (depth === "infinity") depth = Infinity;

                i = 0;

              case 11:
                if (!(i < docs.length)) {
                  _context7.next = 29;
                  break;
                }

                doc = docs[i], path = doc._id, isDirectory = doc.isDirectory;

                if (!(!path.startsWith(prefix) || prefix === path)) {
                  _context7.next = 15;
                  break;
                }

                return _context7.abrupt("continue", 26);

              case 15:
                trailing = path.slice(prefix.length), childDepth = trailing.includes("/") ? trailing.match(slashRe).length + 1 : 1;

                if (!(childDepth > depth)) {
                  _context7.next = 20;
                  break;
                }

                _ret = function () {
                  // add the dirs pointing to child
                  var dirToChild = _this4.join(trailing.split("/").slice(0, depth).join("/") + "/");
                  if (!children.some(function (ea) {
                    return ea.equals(dirToChild);
                  })) children.push(dirToChild);
                  return "continue";
                }();

                if (!(_ret === "continue")) {
                  _context7.next = 20;
                  break;
                }

                return _context7.abrupt("continue", 26);

              case 20:
                child = this.join(trailing);

                if (!(exclude && !applyExclude(child, exclude))) {
                  _context7.next = 23;
                  break;
                }

                return _context7.abrupt("continue", 26);

              case 23:
                children.push(child);
                propNames = ["created", "lastModified", "mode", "group", "user", "contentType", "type", "etag", "size"], props = {};

                for (_i = 0; _i < propNames.length; _i++) {
                  child[propNames[_i]] = doc[propNames[_i]];
                }

              case 26:
                i++;
                _context7.next = 11;
                break;

              case 29:
                return _context7.abrupt("return", children);

              case 30:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function dirList() {
        return _ref8.apply(this, arguments);
      }

      return dirList;
    }()
  }, {
    key: "canDealWithJSON",
    get: function get() {
      return true;
    }
  }, {
    key: "db",
    get: function get() {
      return this._db || (this._db = StorageDatabase.ensureDB(this.host()));
    }
  }]);
  return LivelyStorageResource;
}(lively_resources.Resource);

var resourceExtension = {
  name: "lively.storage",
  matches: function matches(url) {
    return url.startsWith("lively.storage:");
  },
  resourceClass: LivelyStorageResource

  // will install resource extension:
};lively_resources.registerExtension(resourceExtension);

// to trigger resource extension

exports.Database = Database;
exports.ObjectDB = ObjectDB;

}((this.lively.storage = this.lively.storage || {}),PouchDB,pouchdbAdapterMem,lively.resources));

  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.storage;
})();
