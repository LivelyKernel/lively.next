
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
                return this.db.get(this.path());

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
                return this.db.update(this.path(), function (spec) {
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
                return this.db.get(this.path());

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
                return this.db.set(this.path(), {
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
                return this.db.get(this.path());

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
                thisPath = this.path();
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
      return this.db.get(this.path());
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
                prefix = this.path();
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
};

// will install resource extension:
lively_resources.registerExtension(resourceExtension);

// to trigger resource extension

exports.Database = Database;

}((this.lively.storage = this.lively.storage || {}),PouchDB,pouchdbAdapterMem,lively.resources));

  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.storage;
})();
