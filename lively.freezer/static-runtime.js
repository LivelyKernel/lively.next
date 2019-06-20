var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

(function runtimeDefinition() {
  var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this;"object" != _typeof(e.lively) && (e.lively = {});var t = {},
      r = {},
      i = {},
      n = ["_g", "sessionStorage", "localStorage", "clipboardData", "frames", "frameElement", "external", "mozAnimationStartTime", "webkitStorageInfo", "webkitIndexedDB", "mozInnerScreenY", "mozInnerScreenX"];function s(t) {
    !function (t) {
      if (Object.keys) Object.keys(e).forEach(t);else for (var r in e) {
        Object.hasOwnProperty.call(e, r) && t(r);
      }
    }(function (r) {
      if (-1 == n.indexOf(r)) {
        try {
          var i = e[r];
        } catch (e) {
          n.push(r);
        }t(r, i);
      }
    });
  }function l(e, t) {
    for (var r = e.split("."); r.length;) {
      t = t[r.shift()];
    }return t;
  }if (e.lively.FreezerRuntime) {
    var _split$map = (void 0).split(".").map(Number),
        _split$map2 = _slicedToArray(_split$map, 3),
        _r = _split$map2[0],
        _i = _split$map2[1],
        _n = _split$map2[2],
        _e$lively$FreezerRunt = e.lively.FreezerRuntime.version.split(".").map(Number),
        _e$lively$FreezerRunt2 = _slicedToArray(_e$lively$FreezerRunt, 3),
        _s = _e$lively$FreezerRunt2[0],
        _l = _e$lively$FreezerRunt2[1],
        o = _e$lively$FreezerRunt2[2],
        a = !1;

    if ((isNaN(_s) || !isNaN(_r) && _r > _s) && (a = !0), !a && (isNaN(_l) || !isNaN(_i) && _i > _l) && (a = !0), !a && (isNaN(o) || !isNaN(_n) && _n > o) && (a = !0), !a) return;t = e.lively.FreezerRuntime.registry;
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
      var n = { id: e, dependencies: t, executed: i, exports: r, execute: function execute() {}, setters: [], subscribeToToplevelDefinitionChanges: function subscribeToToplevelDefinitionChanges() {}, package: function _package() {} };return this.set(e, n), n;
    },
    decanonicalize: function decanonicalize(t) {
      if (e.lively.FreezerRuntime.globalModules[t]) return t;var r = t.replace("lively-object-modules/", "").replace(e.System.baseURL, "");if (!(r = r.includes("local://") ? r : "local://" + r).match(/\@\S*\//)) {
        (function () {
          var _r$replace$split = r.replace("local://", "").split("/"),
              _r$replace$split2 = _toArray(_r$replace$split),
              t = _r$replace$split2[0],
              i = _r$replace$split2.slice(1),
              n = Object.keys(e.lively.FreezerRuntime.registry).find(function (e) {
            return e.replace("local://", "").split("@")[0] == t;
          }),
              s = n && n.match(/\@[\d|\.|\-|\~]*\//)[0];

          r = "local://" + t + s + i;
        })();
      }return r;
    },
    loadObjectFromPartsbinFolder: function loadObjectFromPartsbinFolder(t) {
      var r = document.location.href.split("?")[0],
          i = e.lively.resources.resource(r);return "index.html" === i.name() && (i = i.parent()), i.join("dynamicParts/" + t + ".json").readJson().then(function (t) {
        return e.lively.morphic.loadMorphFromSnapshot(t, { onDeserializationStart: !1, migrations: [] });
      });
    },
    fetchStandaloneFor: function fetchStandaloneFor(e) {
      for (var _t in this.globalModules) {
        if (e.match(_t.replace("local://", "").replace(/\@.*\//, "/").replace("/index.js", ""))) return this.globalModules[_t];
      }
    },
    resolveSync: function resolveSync(t, r) {
      var i = this.get(t);if (i) return i;if (!t.includes("/")) {
        var _r2 = t.split("."),
            _i2 = e;for (; _i2 && _r2.length;) {
          _i2 = _i2[_r2.shift()];
        }if (_i2) return { executed: !0, exports: _i2, dependencies: [] };
      }var n = this.get(this.decanonicalize(t, r));if (n) return { executed: !0, exports: n, dependencies: [] };if (i = this.fetchStandaloneFor(t)) return i;throw new Error("Module " + t + " cannot be found in lively.freezer bundle!");
    },
    register: function register(e, t, r) {
      var i = this.add(e, t),
          n = r(function (e, t) {
        if ("string" == typeof e) i.exports[e] = t;else {
          var r = {};for (var _e in i.exports) {
            r[_e] = i.exports[_e];
          }i.exports = e;for (var _e2 in r) {
            i.exports[_e2] || (i.exports[_e2] = r[_e2]);
          }
        }
      });return i.execute = n.execute, i.setters = n.setters, i;
    },
    updateImports: function updateImports(e) {
      if (e.dependencies) for (var _t2 = 0; _t2 < e.dependencies.length; _t2++) {
        var _r3 = e.dependencies[_t2],
            _i3 = "@empty" != _r3 && this.resolveSync(_r3, e.id);_i3 && e.setters[_t2](_i3.exports);
      }
    },
    updateDependent: function updateDependent(e, t) {
      for (var _r4 = 0; _r4 < t.dependencies.length; _r4++) {
        var _i4 = t.dependencies[_r4];"@empty" != _i4 && e == this.resolveSync(_i4, t.id) && t.setters[_r4](e.exports);
      }
    },
    computeUniqDepGraphs: function computeUniqDepGraphs(e) {
      var t = [],
          r = {},
          i = { "@empty": [] },
          n = { "@empty": [] };if (!e) {
        var _t3 = {},
            _r5 = lively.FreezerRuntime.registry;for (var _e3 in _r5) {
          _t3[_e3] = _r5[_e3].dependencies;
        }e = _t3;
      }for (var _o in e) {
        r.hasOwnProperty(_o) || (r[_o] = !0, t.push(_o));var s = e[_o],
            l = {};if (s) {
          i[_o] = [];var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = s[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var _e4 = _step.value;
              if (l.hasOwnProperty(_e4) || _o === _e4) continue;var _s2 = n[_e4] || (n[_e4] = []);_s2.includes(_o) || _s2.push(_o), l[_e4] = !0, i[_o].push(_e4), r.hasOwnProperty(_e4) || (r[_e4] = !0, t.push(_e4));
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
      }return { uniqDepGraph: i, inverseDepGraph: n, dependencies: t };
    },
    sortForLoad: function sortForLoad(e) {
      var t,
          _computeUniqDepGraphs = this.computeUniqDepGraphs(),
          r = _computeUniqDepGraphs.dependencies,
          i = _computeUniqDepGraphs.uniqDepGraph,
          n = _computeUniqDepGraphs.inverseDepGraph,
          s = [],
          l = {};function o(e) {
        return e.split("/")[0];
      }function a(e) {
        return (i[t] || []).filter(function (e) {
          return !u(e);
        }).map(function (e) {
          return o(e);
        });
      }function u(e) {
        return "@empty" == e || !!lively.FreezerRuntime.globalModules[e];
      }function p(e, t) {
        var r = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new Set();
        return e == t || !!i[e] && (i[e].includes(t) || i[e].some(function (e) {
          return !r.has(e) && p(e, t, new Set([].concat(_toConsumableArray(r), _toConsumableArray(i[e]))));
        }));
      }for (var _e5 = r.length; _e5--;) {
        if (u(t = r[_e5])) s.push(t);else {
          var _l$_e6$deps;

          var _e6 = o(t);if (!p(_e6 + "/index.js", t)) continue;l[_e6] ? (l[_e6].modules.push(t), (_l$_e6$deps = l[_e6].deps).push.apply(_l$_e6$deps, _toConsumableArray(a()))) : l[_e6] = { modules: [t], deps: a() };
        }r.splice(_e5, 1);
      }var c = r;for (var d in l) {
        l[d].deps = new Set(l[d].deps.filter(function (e) {
          return e != d;
        }));
      }function f(e) {
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
      }r = Object.keys(l);var h = [];for (; r.length;) {
        for (var m = 1 / 0, g = [], v = [], y = [], x = 0; x < r.length; x++) {
          var _e7 = [].concat(_toConsumableArray(l[b = r[x]].deps));_e7.length > m || (_e7.length === m && f(_e7, h, g) ? (g.push(b), v.push(x)) : (m = _e7.length, f(_e7, h, g) && (g = [b], v = [x])));
        }if (0 == g.length) break;for (x = v.length; x--;) {
          var b = r[v[x]];r.splice(v[x], 1);
        }h.push.apply(h, _toConsumableArray(g));
      }var S = r;var z;var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = h[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var w = _step2.value;
          for (z = l[w].modules; z.length;) {
            for (m = 1 / 0, g = [], v = [], y = [], x = 0; x < z.length; x++) {
              var _y2;

              b = z[x];var _e10 = i[b] || [];_e10.length > m || (_e10.length === m && f(_e10, s, g) ? (g.push(b), v.push(x), (_y2 = y).push.apply(_y2, _toConsumableArray(n[b] || []))) : (m = _e10.length, f(_e10, s, g) && (g = [b], v = [x], y = (n[b] || []).slice())));
            }if (0 == g.length) break;for (x = v.length; x--;) {
              n[b = z[v[x]]] = [], z.splice(v[x], 1);
            }var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;
            var _iteratorError5 = undefined;

            try {
              for (var _iterator5 = y[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                var b = _step5.value;
                i[b] = i[b].filter(function (e) {
                  return !g.includes(e);
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

            s.push.apply(s, _toConsumableArray(g));
          }s.push.apply(s, _toConsumableArray(z));
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
        for (var _iterator3 = (r = c, S)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _r6;

          var w = _step3.value;
          (_r6 = r).push.apply(_r6, _toConsumableArray(l[w].modules));
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
        for (m = 1 / 0, g = [], v = [], y = [], x = 0; x < r.length; x++) {
          var _y;

          b = r[x];var _e8 = i[b] || [];_e8.length > m || (_e8.length === m && f(_e8, s, g) ? (g.push(b), v.push(x), (_y = y).push.apply(_y, _toConsumableArray(n[b] || []))) : (m = _e8.length, f(_e8, s, g) && (g = [b], v = [x], y = (n[b] || []).slice())));
        }if (0 == g.length) break;for (x = v.length; x--;) {
          n[b = r[v[x]]] = [], r.splice(v[x], 1);
        }var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = y[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var b = _step4.value;
            i[b] = i[b].filter(function (e) {
              return !g.includes(e);
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

        s.push.apply(s, _toConsumableArray(g));
      }var F = [];for (var _e9 in s) {
        (i[_e9] || []).length && F.push(_e9);
      }return console.log("async modules due to preserved module structures: ", [].concat(F, _toConsumableArray(r))), [s, r];
    },
    initializeClass: function initializeClass(t, r) {
      var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
      var n = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var s = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      var l = arguments[5];
      var o = arguments[6];
      if (void 0 === r) throw Error("Superclass can not be undefined!");return e.System.initializeClass._get = e.lively.classes.runtime.initializeClass._get, e.System.initializeClass._set = e.lively.classes.runtime.initializeClass._set, lively.classes.runtime.initializeClass(t, r, i, n, s, l, o);
    },
    prepareGlobal: function prepareGlobal(t, r, n, o) {
      var a,
          u = e.define;if (e.define = void 0, n) for (var p in a = {}, n) {
        a[p] = e[p], e[p] = n[p];
      }return r || (i = {}, s(function (e, t) {
        i[e] = t;
      })), function () {
        var t,
            n = r ? function (t) {
          if ("string" == typeof t) return l(t, e);if (!(t instanceof Array)) throw new Error("Global exports must be a string or array.");for (var r = {}, i = !0, n = 0; n < t.length; n++) {
            var s = l(t[n], e);i && (r.default = s, i = !1), r[t[n].split(".").pop()] = s;
          }return r;
        }(r) : {},
            p = !!r;if (r && !o || s(function (s, l) {
          i[s] !== l && void 0 !== l && (o && (e[s] = void 0), r || (n[s] = l, void 0 !== t ? p || t === l || (p = !0) : t = l));
        }), n = p ? n : t, a) for (var c in a) {
          e[c] = a[c];
        }return e.define = u, n;
      };
    },
    load: function load(e) {
      var _this = this;

      var _sortForLoad = this.sortForLoad(e),
          _sortForLoad2 = _slicedToArray(_sortForLoad, 2),
          t = _sortForLoad2[0],
          r = _sortForLoad2[1],
          _computeUniqDepGraphs2 = this.computeUniqDepGraphs(),
          i = _computeUniqDepGraphs2.inverseDepGraph,
          n = [].concat(_toConsumableArray(t), _toConsumableArray(r)),
          s = function s(e) {
        (i[e.id] || []).forEach(function (t) {
          var r = _this.get(t);try {
            _this.updateDependent(e, r);
          } catch (t) {
            e.executed = !1;
          }
        });
      },
          l = function l(e) {
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = e[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var _t4 = _step6.value;
            var _e11 = _this.get(_t4);if (_e11 && !_e11.executed) {
              _e11.executed = !0;try {
                _this.updateImports(_e11), _e11.execute();
              } catch (t) {
                _e11.executed = !1;
              }s(_e11);
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

      for (var _e12 = 0; n.some(function (e) {
        return _this.get(e) && !_this.get(e).executed;
      }) && _e12 < 5; _e12++) {
        l(n);
      }return this.get(e).exports;
    }
  }, e.System = e.lively.FreezerRuntime;
})();