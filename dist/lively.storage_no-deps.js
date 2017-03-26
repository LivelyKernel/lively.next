
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
this.lively.storage = (function (_PouchDB,pouchdbAdapterMem) {
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

// await System.normalize("pouchdb-adapter-mem", "http://localhost:9011/lively.storage")


var GLOBAL = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : undefined;

var isNode = typeof global !== "undefined" && typeof process !== "undefined";
var PouchDB = _PouchDB;

function nodejsRequire(name) {
  if (!isNode) throw new Error("nodejsRequire can only be used in nodejs!");
  if (typeof System !== "undefined") return System._nodeRequire(name);
  var Module = require("module");
  return Module._load(name);
}

if (isNode && typeof System !== "undefined") {
  console.log("Loading proper nodejs pouchdb module");

  var _System$_nodeRequire = System._nodeRequire("path"),
      join = _System$_nodeRequire.join,
      storageMain = System.normalizeSync("lively.storage/index.js"),
      pouchDBMain = System.normalizeSync("pouchdb", storageMain).replace(/file:\/\//, ""),
      pouchDBNodeMain = join(pouchDBMain, "../../lib/index.js");

  try {
    PouchDB = System._nodeRequire(pouchDBMain);
  } catch (e) {
    console.log('nodejs pouchdb is not available');
  }
}
PouchDB.plugin(pouchdbAdapterMem);

// leveldbPath("test")
// leveldbPath("file:///Users/robert/Downloads/hackernews-data")

function leveldbPath(dbName) {
  // absolute path?
  if (dbName.startsWith("/")) return dbName;
  if (dbName.match(/[^\/]+:\/\//)) {
    if (dbName.startsWith("file:")) dbName = dbName.replace(/^file:\/\//, "");
    return dbName;
  }

  if (!isNode) throw new Error("leveldbPath called under non-nodejs environment");
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

// var pouch = createPouchDB("test-db");
function createPouchDB(name, options) {
  if (isNode) {
    name = leveldbPath(name);
    options = _extends({ adapter: "leveldb" }, options);
  }
  options = _extends({ name: name }, options);
  return new PouchDB(options);
}

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

      function update(_x2, _x3, _x4) {
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

      function mixin(_x6, _x7, _x8) {
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

      function set$$1(_x9, _x10, _x11) {
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

      function get$$1(_x12) {
        return _ref5.apply(this, arguments);
      }

      return get$$1;
    }()
  }, {
    key: "docList",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var _ref7, rows, result, i, _rows$i, id, rev;

        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.pouchdb.allDocs(opts);

              case 2:
                _ref7 = _context5.sent;
                rows = _ref7.rows;
                result = [];

                for (i = 0; i < rows.length; i++) {
                  _rows$i = rows[i], id = _rows$i.id, rev = _rows$i.value.rev;

                  result.push({ id: id, rev: rev });
                }
                return _context5.abrupt("return", result);

              case 7:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function docList() {
        return _ref6.apply(this, arguments);
      }

      return docList;
    }()
  }, {
    key: "revList",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(id) {
        var _ref9, _id, _ref9$_revisions, start, ids;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.pouchdb.get(id, { revs: true });

              case 2:
                _ref9 = _context6.sent;
                _id = _ref9._id;
                _ref9$_revisions = _ref9._revisions;
                start = _ref9$_revisions.start;
                ids = _ref9$_revisions.ids;
                return _context6.abrupt("return", ids.map(function (ea) {
                  return start-- + "-" + ea;
                }));

              case 8:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function revList(_x14) {
        return _ref8.apply(this, arguments);
      }

      return revList;
    }()
  }, {
    key: "getAllRevisions",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(id) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _options$skip, skip, _options$limit, limit, revs, query;

        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _options$skip = options.skip;
                skip = _options$skip === undefined ? 0 : _options$skip;
                _options$limit = options.limit;
                limit = _options$limit === undefined ? 0 : _options$limit;
                _context7.next = 6;
                return this.revList(id);

              case 6:
                revs = _context7.sent;

                if (skip > 0) revs = revs.slice(skip);
                if (limit > 0) revs = revs.slice(0, limit);
                query = revs.map(function (rev) {
                  return { rev: rev, id: id };
                });
                _context7.next = 12;
                return this.getDocuments(query);

              case 12:
                return _context7.abrupt("return", _context7.sent);

              case 13:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function getAllRevisions(_x15) {
        return _ref10.apply(this, arguments);
      }

      return getAllRevisions;
    }()
  }, {
    key: "getAll",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var _ref12, rows;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this.pouchdb.allDocs(_extends({}, options, { include_docs: true }));

              case 2:
                _ref12 = _context8.sent;
                rows = _ref12.rows;
                return _context8.abrupt("return", rows.map(function (ea) {
                  return ea.doc;
                }));

              case 5:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function getAll() {
        return _ref11.apply(this, arguments);
      }

      return getAll;
    }()
  }, {
    key: "setDocuments",
    value: function () {
      var _ref13 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(documents) {
        var results, i, d, result, _ref14, id, rev;

        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return this.pouchdb.bulkDocs(documents);

              case 2:
                results = _context9.sent;
                i = 0;

              case 4:
                if (!(i < results.length)) {
                  _context9.next = 16;
                  break;
                }

                d = documents[i], result = results[i];
                // if a conflict happens and document does not specify the exact revision
                // then just overwrite old doc

                if (!(!result.ok && result.name === "conflict" && !d._rev)) {
                  _context9.next = 13;
                  break;
                }

                _context9.next = 9;
                return this.set(d._id, d);

              case 9:
                _ref14 = _context9.sent;
                id = _ref14._id;
                rev = _ref14._rev;

                results[i] = { ok: true, id: id, rev: rev };

              case 13:
                i++;
                _context9.next = 4;
                break;

              case 16:
                return _context9.abrupt("return", results);

              case 17:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function setDocuments(_x18) {
        return _ref13.apply(this, arguments);
      }

      return setDocuments;
    }()
  }, {
    key: "getDocuments",
    value: function () {
      var _ref15 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(idsAndRevs) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _options$ignoreErrors, ignoreErrors, _ref16, results, result, i, _results$i, docs, id, j, d;

        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _options$ignoreErrors = options.ignoreErrors;
                ignoreErrors = _options$ignoreErrors === undefined ? true : _options$ignoreErrors;
                _context10.next = 4;
                return this.pouchdb.bulkGet({ docs: idsAndRevs });

              case 4:
                _ref16 = _context10.sent;
                results = _ref16.results;
                result = [];
                i = 0;

              case 8:
                if (!(i < results.length)) {
                  _context10.next = 23;
                  break;
                }

                _results$i = results[i], docs = _results$i.docs, id = _results$i.id;

                console.assert(docs.length === 1, "getDocuments: expected only one doc for " + id);
                j = 0;

              case 12:
                if (!(j < docs.length)) {
                  _context10.next = 20;
                  break;
                }

                d = docs[j];

                if (!(ignoreErrors && !d.ok)) {
                  _context10.next = 16;
                  break;
                }

                return _context10.abrupt("continue", 17);

              case 16:
                result.push(d.ok || d.error || d);

              case 17:
                j++;
                _context10.next = 12;
                break;

              case 20:
                i++;
                _context10.next = 8;
                break;

              case 23:
                return _context10.abrupt("return", result);

              case 24:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function getDocuments(_x19) {
        return _ref15.apply(this, arguments);
      }

      return getDocuments;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // removal
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "remove",
    value: function () {
      var _ref17 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(_id, _rev, options) {
        var arg;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                if (!(typeof _rev !== "undefined")) {
                  _context11.next = 4;
                  break;
                }

                _context11.t0 = { _id: _id, _rev: _rev };
                _context11.next = 7;
                break;

              case 4:
                _context11.next = 6;
                return this.get(_id);

              case 6:
                _context11.t0 = _context11.sent;

              case 7:
                arg = _context11.t0;
                return _context11.abrupt("return", arg ? this.pouchdb.remove(arg) : undefined);

              case 9:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function remove(_x21, _x22, _x23) {
        return _ref17.apply(this, arguments);
      }

      return remove;
    }()
  }, {
    key: "removeAll",
    value: function () {
      var _ref18 = asyncToGenerator(regeneratorRuntime.mark(function _callee12() {
        var db, docs;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                db = this.pouchdb;
                _context12.next = 3;
                return db.allDocs();

              case 3:
                docs = _context12.sent;
                _context12.next = 6;
                return Promise.all(docs.rows.map(function (row) {
                  return db.remove(row.id, row.value.rev);
                }));

              case 6:
                return _context12.abrupt("return", _context12.sent);

              case 7:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function removeAll() {
        return _ref18.apply(this, arguments);
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
      var _ref19 = asyncToGenerator(regeneratorRuntime.mark(function _callee13() {
        var _ref20, rows;

        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.next = 2;
                return this.pouchdb.query({ map: "function(doc) { if (doc._conflicts) emit(doc._id); }" }, { reduce: false, include_docs: true, conflicts: true });

              case 2:
                _ref20 = _context13.sent;
                rows = _ref20.rows;
                return _context13.abrupt("return", rows.map(function (ea) {
                  return ea.doc;
                }));

              case 5:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function getConflicts() {
        return _ref19.apply(this, arguments);
      }

      return getConflicts;
    }()
  }, {
    key: "resolveConflicts",
    value: function () {
      var _ref21 = asyncToGenerator(regeneratorRuntime.mark(function _callee14(id, resolveFn) {
        var doc, query, conflicted, resolved, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, conflictedDoc;

        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return this.pouchdb.get("doc", { conflicts: true });

              case 2:
                doc = _context14.sent;
                query = doc._conflicts.map(function (rev) {
                  return { id: id, rev: rev };
                });
                _context14.next = 6;
                return this.getDocuments(query);

              case 6:
                conflicted = _context14.sent;
                resolved = doc;
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context14.prev = 11;
                _iterator = conflicted[Symbol.iterator]();

              case 13:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context14.next = 28;
                  break;
                }

                conflictedDoc = _step.value;
                _context14.next = 17;
                return resolveFn(resolved, conflictedDoc);

              case 17:
                resolved = _context14.sent;

                if (resolved) {
                  _context14.next = 20;
                  break;
                }

                return _context14.abrupt("return", null);

              case 20:
                _context14.next = 22;
                return this.set(id, resolved);

              case 22:
                resolved = _context14.sent;
                _context14.next = 25;
                return this.pouchdb.remove(conflictedDoc);

              case 25:
                _iteratorNormalCompletion = true;
                _context14.next = 13;
                break;

              case 28:
                _context14.next = 34;
                break;

              case 30:
                _context14.prev = 30;
                _context14.t0 = _context14["catch"](11);
                _didIteratorError = true;
                _iteratorError = _context14.t0;

              case 34:
                _context14.prev = 34;
                _context14.prev = 35;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 37:
                _context14.prev = 37;

                if (!_didIteratorError) {
                  _context14.next = 40;
                  break;
                }

                throw _iteratorError;

              case 40:
                return _context14.finish(37);

              case 41:
                return _context14.finish(34);

              case 42:
                return _context14.abrupt("return", resolved);

              case 43:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this, [[11, 30, 34, 42], [35,, 37, 41]]);
      }));

      function resolveConflicts(_x24, _x25) {
        return _ref21.apply(this, arguments);
      }

      return resolveConflicts;
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
  }]);
  return Database;
}();

return Database;

}(PouchDB,pouchdbAdapterMem));

  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.storage;
})();
