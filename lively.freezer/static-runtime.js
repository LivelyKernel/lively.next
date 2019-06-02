var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

(function runtimeDefinition() {
  var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this;"object" != _typeof(e.lively) && (e.lively = {});var t = {},
      r = {};if (e.lively.FreezerRuntime) {
    var _split$map = (void 0).split(".").map(Number),
        _split$map2 = _slicedToArray(_split$map, 3),
        _r = _split$map2[0],
        i = _split$map2[1],
        s = _split$map2[2],
        _e$lively$FreezerRunt = e.lively.FreezerRuntime.version.split(".").map(Number),
        _e$lively$FreezerRunt2 = _slicedToArray(_e$lively$FreezerRunt, 3),
        l = _e$lively$FreezerRunt2[0],
        n = _e$lively$FreezerRunt2[1],
        o = _e$lively$FreezerRunt2[2],
        u = !1;

    if ((isNaN(l) || !isNaN(_r) && _r > l) && (u = !0), !u && (isNaN(n) || !isNaN(i) && i > n) && (u = !0), !u && (isNaN(o) || !isNaN(s) && s > o) && (u = !0), !u) return;t = e.lively.FreezerRuntime.registry;
  }r["@lively-env"] = { executed: !0, options: {}, moduleEnv: function moduleEnv(e) {
      var t = System.get(e) || System.fetchStandaloneFor(e) || System.get(e + "index.js");return { recorder: t.recorder || t.exports };
    }
  }, r["@system-env"] = { executed: !0, browser: !0 }, e.lively.FreezerRuntime = { global: window, version: void 0, registry: t, globalModules: r, get: function get(e) {
      return e && e.startsWith("@") ? this.globalModules[e] : this.registry[e];
    },
    set: function set(e, t) {
      return this.registry[e] = t;
    },
    add: function add(e) {
      var t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      var r = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var i = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : !1;
      var s = { id: e, dependencies: t, executed: i, exports: r, execute: function execute() {}, setters: [], package: function _package() {} };return this.set(e, s), s;
    },
    decanonicalize: function decanonicalize(t) {
      if (e.lively.FreezerRuntime.globalModules[t]) return t;var r = t.replace("lively-object-modules/", "").replace(e.System.baseURL, "");if (!(r = r.includes("local://") ? r : "local://" + r).match(/\@\S*\//)) {
        (function () {
          var _r$replace$split = r.replace("local://", "").split("/"),
              _r$replace$split2 = _toArray(_r$replace$split),
              t = _r$replace$split2[0],
              i = _r$replace$split2.slice(1),
              s = Object.keys(e.lively.FreezerRuntime.registry).find(function (e) {
            return e.replace("local://", "").split("@")[0] == t;
          }),
              l = s && s.match(/\@[\d|\.|\-|\~]*\//)[0];

          r = "local://" + t + l + i;
        })();
      }return r;
    },
    loadObjectFromPartsbinFolder: function loadObjectFromPartsbinFolder(t) {
      return e.lively.resources.resource(origin + dynamicPartsDir).join(t + ".json").readJson().then(function (t) {
        return e.lively.morphic.loadMorphFromSnapshot(t, { onDeserializationStart: !1, migrations: [] });
      });
    }, fetchStandaloneFor: function fetchStandaloneFor(e) {
      for (var _t in this.globalModules) {
        if (e.match(_t.replace("local://", "").replace(/\@.*\//, "/").replace("/index.js", ""))) return this.globalModules[_t];
      }
    },
    resolveSync: function resolveSync(t, r) {
      var i = this.get(t);if (i) return i;if (!t.includes("/")) {
        var _r2 = t.split("."),
            _i = e;for (; _i && _r2.length;) {
          _i = _i[_r2.shift()];
        }if (_i) return { executed: !0, exports: _i, dependencies: [] };
      }var s = this.get(this.decanonicalize(t, r));if (s) return { executed: !0, exports: s, dependencies: [] };if (i = this.fetchStandaloneFor(t)) return i;throw new Error("Module " + t + " cannot be found in lively.freezer bundle!");
    },
    register: function register(e, t, r) {
      var i = this.add(e, t),
          s = r(function (e, t) {
        if ("string" == typeof e) i.exports[e] = t;else for (var _t2 in e) {
          i.exports[_t2] = e[_t2];
        }
      });return i.execute = s.execute, i.setters = s.setters, i;
    },
    updateImports: function updateImports(e) {
      if (e.dependencies) for (var _t3 = 0; _t3 < e.dependencies.length; _t3++) {
        var _r3 = e.dependencies[_t3],
            _i2 = "@empty" != _r3 && this.resolveSync(_r3, e.id);_i2 && e.setters[_t3](_i2.exports);
      }
    },
    updateDependent: function updateDependent(e, t) {
      for (var _r4 = 0; _r4 < t.dependencies.length; _r4++) {
        var _i3 = t.dependencies[_r4];"@empty" != _i3 && e == this.resolveSync(_i3, t.id) && t.setters[_r4](e.exports);
      }
    },
    computeUniqDepGraphs: function computeUniqDepGraphs(e) {
      var t = [],
          r = {},
          i = { "@empty": [] },
          s = { "@empty": [] };if (!e) {
        var _t4 = {},
            _r5 = lively.FreezerRuntime.registry;for (var _e in _r5) {
          _t4[_e] = _r5[_e].dependencies;
        }e = _t4;
      }for (var _o in e) {
        r.hasOwnProperty(_o) || (r[_o] = !0, t.push(_o));var l = e[_o],
            n = {};if (l) {
          i[_o] = [];var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = l[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var _e2 = _step.value;
              if (n.hasOwnProperty(_e2) || _o === _e2) continue;var _l = s[_e2] || (s[_e2] = []);_l.includes(_o) || _l.push(_o), n[_e2] = !0, i[_o].push(_e2), r.hasOwnProperty(_e2) || (r[_e2] = !0, t.push(_e2));
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }
      }return { uniqDepGraph: i, inverseDepGraph: s, dependencies: t };
    },
    sortForLoad: function sortForLoad(e) {
      var t,
          _computeUniqDepGraphs = this.computeUniqDepGraphs(),
          r = _computeUniqDepGraphs.dependencies,
          i = _computeUniqDepGraphs.uniqDepGraph,
          s = _computeUniqDepGraphs.inverseDepGraph,
          l = [],
          n = {};function o(e) {
        return e.split("/")[0];
      }function u(e) {
        return (i[t] || []).filter(function (e) {
          return !a(e);
        }).map(function (e) {
          return o(e);
        });
      }function a(e) {
        return "@empty" == e || !!lively.FreezerRuntime.globalModules[e];
      }function p(e, t) {
        var r = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new Set();
        return e == t || !!i[e] && (i[e].includes(t) || i[e].some(function (e) {
          return !r.has(e) && p(e, t, new Set([].concat(_toConsumableArray(r), _toConsumableArray(i[e]))));
        }));
      }for (var _e3 = r.length; _e3--;) {
        if (a(t = r[_e3])) l.push(t);else {
          var _n$_e4$deps;

          var _e4 = o(t);if (!p(_e4 + "/index.js", t)) continue;n[_e4] ? (n[_e4].modules.push(t), (_n$_e4$deps = n[_e4].deps).push.apply(_n$_e4$deps, _toConsumableArray(u()))) : n[_e4] = { modules: [t], deps: u() };
        }r.splice(_e3, 1);
      }var d = r;for (var c in n) {
        n[c].deps = new Set(n[c].deps.filter(function (e) {
          return e != c;
        }));
      }function h(e) {
        for (var _len = arguments.length, t = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          t[_key - 1] = arguments[_key];
        }

        return e.filter(function (e) {
          return "@empty" != e && !e.includes("/index.js");
        }).every(function (e) {
          return t.some(function (t) {
            return t.includes(e);
          });
        });
      }r = Object.keys(n);var f = [];for (; r.length;) {
        for (var g = 1 / 0, y = [], m = [], v = [], x = 0; x < r.length; x++) {
          var _e5 = [].concat(_toConsumableArray(n[b = r[x]].deps));_e5.length > g || (_e5.length === g && h(_e5, f, y) ? (y.push(b), m.push(x)) : (g = _e5.length, h(_e5, f, y) && (y = [b], m = [x])));
        }if (0 == y.length) break;for (x = m.length; x--;) {
          var b = r[m[x]];r.splice(m[x], 1);
        }f.push.apply(f, _toConsumableArray(y));
      }var S = r;var z;var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = f[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var F = _step2.value;
          for (z = n[F].modules; z.length;) {
            for (g = 1 / 0, y = [], m = [], v = [], x = 0; x < z.length; x++) {
              var _v2;

              b = z[x];var _e8 = i[b] || [];_e8.length > g || (_e8.length === g && h(_e8, l, y) ? (y.push(b), m.push(x), (_v2 = v).push.apply(_v2, _toConsumableArray(s[b] || []))) : (g = _e8.length, h(_e8, l, y) && (y = [b], m = [x], v = (s[b] || []).slice())));
            }if (0 == y.length) break;for (x = m.length; x--;) {
              s[b = z[m[x]]] = [], z.splice(m[x], 1);
            }var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;
            var _iteratorError5 = undefined;

            try {
              for (var _iterator5 = v[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                var b = _step5.value;
                i[b] = i[b].filter(function (e) {
                  return !y.includes(e);
                });
              }
            } catch (err) {
              _didIteratorError5 = true;
              _iteratorError5 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion5 && _iterator5.return) {
                  _iterator5.return();
                }
              } finally {
                if (_didIteratorError5) {
                  throw _iteratorError5;
                }
              }
            }

            l.push.apply(l, _toConsumableArray(y));
          }l.push.apply(l, _toConsumableArray(z));
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = (r = d, S)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _r6;

          var F = _step3.value;
          (_r6 = r).push.apply(_r6, _toConsumableArray(n[F].modules));
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      for (; r.length;) {
        for (g = 1 / 0, y = [], m = [], v = [], x = 0; x < r.length; x++) {
          var _v;

          b = r[x];var _e6 = i[b] || [];_e6.length > g || (_e6.length === g && h(_e6, l, y) ? (y.push(b), m.push(x), (_v = v).push.apply(_v, _toConsumableArray(s[b] || []))) : (g = _e6.length, h(_e6, l, y) && (y = [b], m = [x], v = (s[b] || []).slice())));
        }if (0 == y.length) break;for (x = m.length; x--;) {
          s[b = r[m[x]]] = [], r.splice(m[x], 1);
        }var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = v[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var b = _step4.value;
            i[b] = i[b].filter(function (e) {
              return !y.includes(e);
            });
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }

        l.push.apply(l, _toConsumableArray(y));
      }var w = [];for (var _e7 in l) {
        (i[_e7] || []).length && w.push(_e7);
      }return console.log("async modules due to preserved module structures: ", [].concat(w, _toConsumableArray(r))), [l, r];
    },
    initializeClass: function initializeClass(t, r) {
      var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
      var s = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var l = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      var n = arguments[5];
      var o = arguments[6];
      if (void 0 === r) throw Error("Superclass can not be undefined!");return e.System.initializeClass._get = e.lively.classes.runtime.initializeClass._get, e.System.initializeClass._set = e.lively.classes.runtime.initializeClass._set, lively.classes.runtime.initializeClass(t, r, i, s, l, n, o);
    },
    load: function load(e) {
      var _this = this;

      var _sortForLoad = this.sortForLoad(e),
          _sortForLoad2 = _slicedToArray(_sortForLoad, 2),
          t = _sortForLoad2[0],
          r = _sortForLoad2[1],
          _computeUniqDepGraphs2 = this.computeUniqDepGraphs(),
          i = _computeUniqDepGraphs2.inverseDepGraph,
          s = [].concat(_toConsumableArray(t), _toConsumableArray(r)),
          l = function l(e) {
        (i[e.id] || []).forEach(function (t) {
          var r = _this.get(t);try {
            _this.updateDependent(e, r);
          } catch (t) {
            e.executed = !1;
          }
        });
      },
          n = function n(e) {
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = e[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var _t5 = _step6.value;
            var _e9 = _this.get(_t5);if (_e9 && !_e9.executed) {
              _e9.executed = !0;try {
                _this.updateImports(_e9), _e9.execute();
              } catch (t) {
                _e9.executed = !1;
              }l(_e9);
            }
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }
      };

      for (var _e10 = 0; s.some(function (e) {
        return _this.get(e) && !_this.get(e).executed;
      }) && _e10 < 5; _e10++) {
        n(s);
      }return this.get(e).exports;
    }
  }, e.System = e.lively.FreezerRuntime;
})();