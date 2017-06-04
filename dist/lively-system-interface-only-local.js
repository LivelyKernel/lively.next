
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,ast,lively_lang,lively_resources,modules,vm) {
'use strict';

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

function parseJsonLikeObj(source) {
  try {
    var obj$$1 = eval("(" + ast.transform.wrapInFunction("var _; _ = (" + source + ")") + ")()");
  } catch (e) {
    return JSON.parse(source);
  }
  return (typeof obj$$1 === "undefined" ? "undefined" : _typeof(obj$$1)) !== "object" ? null : obj$$1;
}

var loadPackage = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(system, spec) {
    var mochaEs6;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return system.importPackage(spec.address + "/");

          case 2:
            if (!spec.main) {
              _context.next = 5;
              break;
            }

            _context.next = 5;
            return system.importModule(spec.main.toString());

          case 5:
            if (!spec.test) {
              _context.next = 19;
              break;
            }

            _context.prev = 6;
            _context.next = 9;
            return system.importPackage("mocha-es6");

          case 9:
            mochaEs6 = _context.sent;
            _context.next = 12;
            return mochaEs6.installSystemInstantiateHook();

          case 12:
            _context.next = 14;
            return system.importModule(spec.test.toString());

          case 14:
            _context.next = 19;
            break;

          case 16:
            _context.prev = 16;
            _context.t0 = _context["catch"](6);

            console.warn("Cannot load test of new package: " + _context.t0);

          case 19:
            return _context.abrupt("return", system.getPackage(spec.address));

          case 20:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[6, 16]]);
  }));

  return function loadPackage(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

var interactivelyCreatePackage$1 = function () {
  var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(system, requester) {
    var world, name, guessedAddress, res, baseURL, maybePackageDir, loc, url, address;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            world = requester.world();
            _context2.next = 3;
            return world.prompt("Enter package name", {
              input: "", historyId: "lively.vm-editor-add-package-name", useLastInput: true });

          case 3:
            name = _context2.sent;

            if (name) {
              _context2.next = 6;
              break;
            }

            throw "Canceled";

          case 6:
            _context2.prev = 6;
            res = lively_resources.resource(name);

            name = res.name();
            guessedAddress = res.url;
            _context2.next = 21;
            break;

          case 12:
            _context2.prev = 12;
            _context2.t0 = _context2["catch"](6);
            _context2.next = 16;
            return system.getConfig();

          case 16:
            baseURL = _context2.sent.baseURL;
            maybePackageDir = lively_resources.resource(baseURL).join(name).asDirectory().url;
            _context2.next = 20;
            return system.normalize(maybePackageDir);

          case 20:
            guessedAddress = _context2.sent.replace(/\/\.js$/, "/");

          case 21:
            _context2.next = 23;
            return world.prompt("Confirm or change package location", {
              input: guessedAddress, historyId: "lively.vm-editor-add-package-address" });

          case 23:
            loc = _context2.sent;

            if (loc) {
              _context2.next = 26;
              break;
            }

            throw "Canceled";

          case 26:
            url = lively_resources.resource(loc).asDirectory(), address = url.asFile().url;
            _context2.next = 29;
            return system.removePackage(address);

          case 29:
            _context2.next = 31;
            return system.resourceCreateFiles(address, {
              "index.js": "'format esm';\n",
              "package.json": "{\n  \"name\": \"" + name + "\",\n  \"version\": \"0.1.0\"\n}",
              ".gitignore": "node_modules/",
              "README.md": "# " + name + "\n\nNo description for package " + name + " yet.\n",
              "tests": {
                "test.js": "import { expect } from \"mocha-es6\";\ndescribe(\"" + name + "\", () => {\n  it(\"works\", () => {\n    expect(1 + 2).equals(3);\n  });\n});"
              }
            });

          case 31:
            return _context2.abrupt("return", loadPackage(system, {
              name: name,
              address: address,
              configFile: url.join("package.json").url,
              main: url.join("index.js").url,
              test: url.join("tests/test.js").url,
              type: "package"
            }));

          case 32:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this, [[6, 12]]);
  }));

  return function interactivelyCreatePackage$1(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();

var interactivelyLoadPackage$1 = function () {
  var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(system, requester) {
    var relatedPackageAddress = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var spec, config, relatedPackage, dir;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:

            // var vmEditor = that.owner;
            // var system = vmEditor.systemInterface()

            spec = { name: "", address: "", type: "package" };
            _context3.next = 3;
            return system.getConfig();

          case 3:
            config = _context3.sent;

            if (!relatedPackageAddress) {
              _context3.next = 13;
              break;
            }

            _context3.next = 7;
            return system.getPackage(relatedPackageAddress);

          case 7:
            _context3.t0 = _context3.sent;

            if (_context3.t0) {
              _context3.next = 12;
              break;
            }

            _context3.next = 11;
            return system.getPackageForModule(relatedPackageAddress);

          case 11:
            _context3.t0 = _context3.sent;

          case 12:
            relatedPackage = _context3.t0;

          case 13:
            _context3.next = 15;
            return requester.world().prompt("What is the package directory?", {
              input: relatedPackage ? relatedPackage.address : config.baseURL,
              historyId: "lively.vm-editor-package-load-history",
              useLastInput: false
            });

          case 15:
            dir = _context3.sent;

            if (dir) {
              _context3.next = 18;
              break;
            }

            throw "Canceled";

          case 18:

            // if (dir.indexOf(URL.root.protocol) === 0) {
            //   var relative = new URL(dir).relativePathFrom(URL.root);
            //   if (relative.include("..")) {
            //     throw new Error(`The package path ${relative} is not inside the Lively directory (${URL.root})`)
            //   }
            // }

            spec.address = dir.replace(/\/$/, "");
            spec.url = new URL(spec.address + "/");
            spec.configFile = lively_resources.resource(spec.url).join("package.json").url;

            _context3.prev = 21;
            _context3.t1 = JSON;
            _context3.next = 25;
            return system.moduleRead(spec.configFile);

          case 25:
            _context3.t2 = _context3.sent;
            _context3.t1.parse.call(_context3.t1, _context3.t2).name;
            _context3.next = 33;
            break;

          case 29:
            _context3.prev = 29;
            _context3.t3 = _context3["catch"](21);

            spec.name = String(spec.url).replace(/\/$/, "");
            system.resourceEnsureExistance(spec.configFile, "{\n  \"name\": \"" + spec.name + "\",\n  \"version\": \"0.1.0\"\n}");

          case 33:
            return _context3.abrupt("return", loadPackage(system, spec));

          case 34:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this, [[21, 29]]);
  }));

  return function interactivelyLoadPackage$1(_x5, _x6) {
    return _ref3.apply(this, arguments);
  };
}();

var interactivelyReloadPackage$1 = function () {
  var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(system, vmEditor, packageURL) {
    var name, p;
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            name = lively_resources.resource(packageURL).asFile().url;
            _context4.next = 3;
            return system.getPackage(name);

          case 3:
            _context4.t0 = _context4.sent;

            if (_context4.t0) {
              _context4.next = 8;
              break;
            }

            _context4.next = 7;
            return system.getPackageForModule(name);

          case 7:
            _context4.t0 = _context4.sent;

          case 8:
            p = _context4.t0;

            if (p) {
              _context4.next = 11;
              break;
            }

            throw new Error("Cannot find package for " + name);

          case 11:
            _context4.next = 13;
            return system.reloadPackage(name);

          case 13:
            if (!vmEditor) {
              _context4.next = 19;
              break;
            }

            _context4.next = 16;
            return vmEditor.updateModuleList();

          case 16:
            _context4.next = 18;
            return vmEditor.uiSelect(name, false);

          case 18:
            return _context4.abrupt("return", _context4.sent);

          case 19:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  return function interactivelyReloadPackage$1(_x8, _x9, _x10) {
    return _ref4.apply(this, arguments);
  };
}();

var interactivelyUnloadPackage$1 = function () {
  var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(system, vmEditor, packageURL, world) {
    var p, really;
    return regeneratorRuntime.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return system.getPackage(packageURL);

          case 2:
            p = _context5.sent;
            _context5.next = 5;
            return (world || $world).confirm("Unload package " + p.name + "??");

          case 5:
            really = _context5.sent;

            if (really) {
              _context5.next = 8;
              break;
            }

            throw "Canceled";

          case 8:
            _context5.next = 10;
            return system.removePackage(packageURL);

          case 10:
            if (!vmEditor) {
              _context5.next = 15;
              break;
            }

            _context5.next = 13;
            return vmEditor.updateModuleList();

          case 13:
            _context5.next = 15;
            return vmEditor.uiSelect(null);

          case 15:
          case "end":
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  return function interactivelyUnloadPackage$1(_x11, _x12, _x13, _x14) {
    return _ref5.apply(this, arguments);
  };
}();

var interactivelyRemovePackage$1 = function () {
  var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(system, requester, packageURL) {
    var world, p, really, really2, really3;
    return regeneratorRuntime.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            world = requester.world();
            _context6.next = 3;
            return system.getPackage(packageURL);

          case 3:
            p = _context6.sent;
            _context6.next = 6;
            return world.confirm("Really remove package " + p.name + "??");

          case 6:
            really = _context6.sent;

            if (really) {
              _context6.next = 9;
              break;
            }

            throw "Canceled";

          case 9:

            system.removePackage(packageURL);

            _context6.next = 12;
            return world.confirm("Also remove directory " + p.name + " including " + p.modules.length + " modules?");

          case 12:
            really2 = _context6.sent;

            if (!really2) {
              _context6.next = 20;
              break;
            }

            _context6.next = 16;
            return world.confirm("REALLY *remove* directory " + p.name + "? No undo possible...");

          case 16:
            really3 = _context6.sent;

            if (!really3) {
              _context6.next = 20;
              break;
            }

            _context6.next = 20;
            return system.resourceRemove(p.address);

          case 20:
          case "end":
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  return function interactivelyRemovePackage$1(_x15, _x16, _x17) {
    return _ref6.apply(this, arguments);
  };
}();

// showExportsAndImportsOf("http://localhost:9001/packages/lively-system-interface/")
var showExportsAndImportsOf$1 = function () {
  var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(system, packageAddress) {
    var world = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : $world;

    var p, reports, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, mod, importsExports, report;

    return regeneratorRuntime.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            _context7.next = 2;
            return system.getPackage(packageAddress);

          case 2:
            p = _context7.sent;

            if (p) {
              _context7.next = 5;
              break;
            }

            throw new Error("Cannot find package " + packageAddress);

          case 5:
            reports = [];
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context7.prev = 9;
            _iterator = p.modules[Symbol.iterator]();

          case 11:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context7.next = 40;
              break;
            }

            mod = _step.value;

            if (mod.name.match(/\.js$/)) {
              _context7.next = 15;
              break;
            }

            return _context7.abrupt("continue", 37);

          case 15:
            _context7.prev = 15;
            _context7.t0 = system;
            _context7.t1 = mod.name;
            _context7.next = 20;
            return system.moduleRead(mod.name);

          case 20:
            _context7.t2 = _context7.sent;
            _context7.next = 23;
            return _context7.t0.importsAndExportsOf.call(_context7.t0, _context7.t1, _context7.t2);

          case 23:
            importsExports = _context7.sent;
            _context7.next = 30;
            break;

          case 26:
            _context7.prev = 26;
            _context7.t3 = _context7["catch"](15);

            world.logError(new Error("Error when getting imports/exports from module " + mod.name + ":\n" + _context7.t3.stack));
            return _context7.abrupt("continue", 37);

          case 30:
            report = "" + mod.name;

            if (!(!importsExports.imports.length && !importsExports.exports.length)) {
              _context7.next = 34;
              break;
            }

            report += "\n  does not import / export anything";
            return _context7.abrupt("continue", 37);

          case 34:

            if (importsExports.imports.length) {
              report += "\n  imports:\n";
              report += lively_lang.arr.groupByKey(importsExports.imports, "fromModule").mapGroups(function (from, imports) {
                return "from " + from + ": " + imports.map(function (ea) {
                  return !ea.local && !ea.imported ? "nothing imported" : !ea.imported || ea.imported === ea.local ? ea.local : ea.imported + " as " + ea.local;
                }).join(", ");
              }).toArray().join("\n").split("\n").map(function (ea) {
                return ea = "    " + ea;
              }).join("\n");
            }

            if (importsExports.exports.length) {
              report += "\n  exports:\n";
              report += importsExports.exports.map(function (ea) {
                return !ea.local ? ea.exported + " from " + ea.fromModule : !ea.local || ea.local === ea.exported ? ea.exported : ea.local + " as " + ea.exported;
              }).join(", ").split("\n").map(function (ea) {
                return ea = "    " + ea;
              }).join("\n");
            }

            reports.push(report);

          case 37:
            _iteratorNormalCompletion = true;
            _context7.next = 11;
            break;

          case 40:
            _context7.next = 46;
            break;

          case 42:
            _context7.prev = 42;
            _context7.t4 = _context7["catch"](9);
            _didIteratorError = true;
            _iteratorError = _context7.t4;

          case 46:
            _context7.prev = 46;
            _context7.prev = 47;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 49:
            _context7.prev = 49;

            if (!_didIteratorError) {
              _context7.next = 52;
              break;
            }

            throw _iteratorError;

          case 52:
            return _context7.finish(49);

          case 53:
            return _context7.finish(46);

          case 54:
            _context7.next = 56;
            return world.execCommand("open text window", {
              title: "imports and exports of " + packageAddress,
              content: reports.join("\n\n")
            });

          case 56:
          case "end":
            return _context7.stop();
        }
      }
    }, _callee7, this, [[9, 42, 46, 54], [15, 26], [47,, 49, 53]]);
  }));

  return function showExportsAndImportsOf$1(_x18, _x19) {
    return _ref7.apply(this, arguments);
  };
}();

var _askForModuleName = function () {
  var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(system, input, world) {
    var fullname, really;
    return regeneratorRuntime.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _context6.next = 2;
            return world.prompt("Enter module name", { input: input, historyId: "lively.vm-editor-add-module-name" });

          case 2:
            input = _context6.sent;

            if (input) {
              _context6.next = 5;
              break;
            }

            throw "Canceled";

          case 5:
            _context6.next = 7;
            return system.normalize(input);

          case 7:
            fullname = _context6.sent;
            _context6.next = 10;
            return world.confirm("Create module " + fullname + "?");

          case 10:
            really = _context6.sent;

            if (really) {
              _context6.next = 13;
              break;
            }

            throw "Canceled";

          case 13:
            return _context6.abrupt("return", fullname);

          case 14:
          case "end":
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  return function _askForModuleName(_x19, _x20, _x21) {
    return _ref6.apply(this, arguments);
  };
}();

var _searchForExistingFiles = function () {
  var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(requester, rootURL, p) {
    return regeneratorRuntime.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            if (!String(rootURL).match(/^http/)) {
              _context7.next = 4;
              break;
            }

            return _context7.abrupt("return", _searchForExistingFilesWeb(requester, rootURL, p));

          case 4:
            return _context7.abrupt("return", _searchForExistingFilesManually(requester, rootURL, p));

          case 5:
          case "end":
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  return function _searchForExistingFiles(_x22, _x23, _x24) {
    return _ref7.apply(this, arguments);
  };
}();

var _searchForExistingFilesManually = function () {
  var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(requester, rootURL, p) {
    var choice, result;
    return regeneratorRuntime.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _context8.next = 2;
            return requester.world().multipleChoicePrompt("Create new module or load an existing one?", { choices: ["create", "load"] });

          case 2:
            choice = _context8.sent;

            if (!(choice === "create")) {
              _context8.next = 5;
              break;
            }

            return _context8.abrupt("return", "[create new module]");

          case 5:
            if (!(choice === "load")) {
              _context8.next = 11;
              break;
            }

            _context8.next = 8;
            return requester.world().prompt("URL of module?", {
              input: rootURL,
              historyId: "lively.vm._searchForExistingFilesManually.url-of-module"
            });

          case 8:
            result = _context8.sent;

            if (!result) {
              _context8.next = 11;
              break;
            }

            return _context8.abrupt("return", [result]);

          case 11:
            ;
            throw "Canceled";

          case 14:
          case "end":
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  return function _searchForExistingFilesManually(_x25, _x26, _x27) {
    return _ref8.apply(this, arguments);
  };
}();

var _searchForExistingFilesWeb = function () {
  var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(requester, rootURL, p) {
    var exclude, found, candidates, answer, result;
    return regeneratorRuntime.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            exclude = function exclude(resource$$1) {
              var name = resource$$1.name();
              if ([".git", "node_modules", ".optimized-loading-cache", ".module_cache"].includes(resource$$1.name())) return true;
              if (p) {
                var modules$$1 = lively_lang.arr.pluck(p.modules, "name");
                if (modules$$1.includes(resource$$1.url)) return true;
              }
              return false;
            };

            _context9.next = 3;
            return lively_resources.resource(rootURL).dirList(5, { exclude: exclude });

          case 3:
            _context9.t0 = function (ea) {
              return ea.url;
            };

            _context9.next = 6;
            return _context9.sent.map(_context9.t0);

          case 6:
            found = _context9.sent;
            candidates = [{
              isListItem: true,
              string: "[create new module]",
              value: "[create new module]" }].concat(found.filter(function (ea) {
              return ea.endsWith(".js");
            }).map(function (name) {
              var shortName = name;
              shortName = p && name.indexOf(p.address) == 0 ? p.name + name.slice(p.address.length) : name;
              return { isListItem: true, string: shortName, value: name };
            }));
            _context9.next = 10;
            return requester.world().filterableListPrompt("What module to load?", candidates, _extends({
              filterLabel: "filter: ",
              multiselect: true
            }, requester ? { extent: requester.bounds().extent().withY(400) } : {}));

          case 10:
            answer = _context9.sent;

            if (!(!answer || answer.status === "canceled" || !answer.selected.length)) {
              _context9.next = 13;
              break;
            }

            throw "Canceled";

          case 13:
            result = answer.selected || answer;

            if (!Array.isArray(result)) result = [result];
            return _context9.abrupt("return", result);

          case 16:
          case "end":
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  return function _searchForExistingFilesWeb(_x28, _x29, _x30) {
    return _ref9.apply(this, arguments);
  };
}();

var _createAndLoadModules = function () {
  var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(system, fullnames) {
    var results, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, fullname;

    return regeneratorRuntime.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            if (!Array.isArray(fullnames)) fullnames = [fullnames];
            results = [];
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context10.prev = 5;
            _iterator = fullnames[Symbol.iterator]();

          case 7:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context10.next = 25;
              break;
            }

            fullname = _step.value;
            _context10.next = 11;
            return system.forgetModule(fullname, { forgetDeps: false, forgetEnv: false });

          case 11:
            _context10.next = 13;
            return system.resourceEnsureExistance(fullname, '"format esm";\n');

          case 13:
            _context10.prev = 13;
            _context10.next = 16;
            return system.importModule(fullname);

          case 16:
            results.push({ name: fullname });
            _context10.next = 22;
            break;

          case 19:
            _context10.prev = 19;
            _context10.t0 = _context10["catch"](13);

            results.push({ name: fullname, error: _context10.t0 });

          case 22:
            _iteratorNormalCompletion = true;
            _context10.next = 7;
            break;

          case 25:
            _context10.next = 31;
            break;

          case 27:
            _context10.prev = 27;
            _context10.t1 = _context10["catch"](5);
            _didIteratorError = true;
            _iteratorError = _context10.t1;

          case 31:
            _context10.prev = 31;
            _context10.prev = 32;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 34:
            _context10.prev = 34;

            if (!_didIteratorError) {
              _context10.next = 37;
              break;
            }

            throw _iteratorError;

          case 37:
            return _context10.finish(34);

          case 38:
            return _context10.finish(31);

          case 39:
            return _context10.abrupt("return", results);

          case 40:
          case "end":
            return _context10.stop();
        }
      }
    }, _callee10, this, [[5, 27, 31, 39], [13, 19], [32,, 34, 38]]);
  }));

  return function _createAndLoadModules(_x31, _x32) {
    return _ref10.apply(this, arguments);
  };
}();

function shortModuleName$1(system, moduleId, itsPackage) {
  var packageAddress = itsPackage && itsPackage.address,
      shortName = packageAddress && moduleId.indexOf(packageAddress) === 0 ? moduleId.slice(packageAddress.length).replace(/^\//, "") : relative(moduleId);
  return shortName;

  function relative(name) {
    var conf = system.getConfig();
    if (conf && conf.constructor === Promise) return name;
    try {
      return String(new URL(name).relativePathFrom(new URL(system.getConfig().baseURL)));
    } catch (e) {}
    return name;
  }
}

var interactivelyChangeModule$1 = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(system, moduleName, newSource, options) {
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // options.write, options.eval, ..
            options = _extends({ targetModule: moduleName }, options);
            _context.next = 3;
            return system.normalize(moduleName);

          case 3:
            moduleName = _context.sent;
            _context.next = 6;
            return system.moduleSourceChange(moduleName, newSource, options);

          case 6:
            return _context.abrupt("return", moduleName);

          case 7:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function interactivelyChangeModule$1(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

var interactivelyReloadModule$1 = function () {
  var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(system, vmEditor, moduleName) {
    var reloadDeps = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var resetEnv = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            vmEditor && vmEditor.setStatusMessage("Reloading " + moduleName);
            _context2.prev = 1;
            _context2.next = 4;
            return system.reloadModule(moduleName, { reloadDeps: reloadDeps, resetEnv: resetEnv });

          case 4:
            _context2.t0 = vmEditor;

            if (!_context2.t0) {
              _context2.next = 8;
              break;
            }

            _context2.next = 8;
            return vmEditor.updateModuleList();

          case 8:
            vmEditor && vmEditor.setStatusMessage("Reloded " + moduleName);
            _context2.next = 24;
            break;

          case 11:
            _context2.prev = 11;
            _context2.t1 = _context2["catch"](1);
            _context2.prev = 13;
            _context2.t2 = vmEditor;

            if (!_context2.t2) {
              _context2.next = 18;
              break;
            }

            _context2.next = 18;
            return vmEditor.updateEditorWithSourceOf(moduleName);

          case 18:
            _context2.next = 22;
            break;

          case 20:
            _context2.prev = 20;
            _context2.t3 = _context2["catch"](13);

          case 22:
            vmEditor && vmEditor.showError(_context2.t1);throw _context2.t1;

          case 24:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this, [[1, 11], [13, 20]]);
  }));

  return function interactivelyReloadModule$1(_x5, _x6, _x7) {
    return _ref2.apply(this, arguments);
  };
}();

var interactivelyUnloadModule$1 = function () {
  var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(system, vmEditor, moduleName) {
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return system.forgetModule(moduleName, { forgetEnv: true, forgetDeps: true });

          case 2:
            _context3.t0 = vmEditor;

            if (!_context3.t0) {
              _context3.next = 6;
              break;
            }

            _context3.next = 6;
            return vmEditor.updateModuleList();

          case 6:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  return function interactivelyUnloadModule$1(_x10, _x11, _x12) {
    return _ref3.apply(this, arguments);
  };
}();

var interactivelyRemoveModule$1 = function () {
  var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(system, requester, moduleName) {
    var fullname, really, p;
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.next = 2;
            return system.normalize(moduleName);

          case 2:
            fullname = _context4.sent;
            _context4.next = 5;
            return requester.world().confirm("Remove file " + fullname + "?", { requester: requester });

          case 5:
            really = _context4.sent;

            if (really) {
              _context4.next = 8;
              break;
            }

            throw "Canceled";

          case 8:
            _context4.next = 10;
            return system.forgetModule(fullname);

          case 10:
            _context4.next = 12;
            return system.resourceRemove(fullname);

          case 12:
            _context4.next = 14;
            return system.getPackageForModule(fullname);

          case 14:
            p = _context4.sent;
            return _context4.abrupt("return", p);

          case 16:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  return function interactivelyRemoveModule$1(_x13, _x14, _x15) {
    return _ref4.apply(this, arguments);
  };
}();

var interactivelyAddModule$1 = function () {
  var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(system, requester, relatedPackageOrModuleName) {
    var root, p, candidates, fullname, namesAndErrors, errors, hasError;
    return regeneratorRuntime.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.t0 = URL;
            _context5.next = 3;
            return system.getConfig();

          case 3:
            _context5.t1 = _context5.sent.baseURL;
            root = new _context5.t0(_context5.t1);

            if (!relatedPackageOrModuleName) {
              _context5.next = 15;
              break;
            }

            _context5.next = 8;
            return system.getPackage(relatedPackageOrModuleName);

          case 8:
            _context5.t2 = _context5.sent;

            if (_context5.t2) {
              _context5.next = 13;
              break;
            }

            _context5.next = 12;
            return system.getPackageForModule(relatedPackageOrModuleName);

          case 12:
            _context5.t2 = _context5.sent;

          case 13:
            p = _context5.t2;

            if (p) root = new URL(p.address);

          case 15:
            _context5.next = 17;
            return _searchForExistingFiles(requester, String(root), p);

          case 17:
            candidates = _context5.sent;

            if (!candidates.includes("[create new module]")) {
              _context5.next = 23;
              break;
            }

            _context5.next = 21;
            return _askForModuleName(system, relatedPackageOrModuleName || String(root), requester.world());

          case 21:
            fullname = _context5.sent;

            candidates = [fullname];

          case 23:
            _context5.next = 25;
            return _createAndLoadModules(system, candidates);

          case 25:
            namesAndErrors = _context5.sent;
            errors = lively_lang.arr.compact(namesAndErrors.map(function (ea) {
              return ea.error;
            }));
            hasError = !!errors.length;
            return _context5.abrupt("return", namesAndErrors);

          case 29:
          case "end":
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  return function interactivelyAddModule$1(_x16, _x17, _x18) {
    return _ref5.apply(this, arguments);
  };
}();

var modulesInPackage = function () {
  var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(system, packageName) {
    var p, exclude, res, found;
    return regeneratorRuntime.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            exclude = function exclude(res) {
              if ([".git", "node_modules", ".optimized-loading-cache", ".module_cache"].includes(res.name())) {
                return true;
              }
              return false;
            };

            _context11.next = 3;
            return system.getPackage(packageName);

          case 3:
            p = _context11.sent;

            if (!(!p || !p.address.match(/^http/))) {
              _context11.next = 6;
              break;
            }

            throw new Error("Cannot load package " + packageName);

          case 6:
            res = lively_resources.resource(new URL(p.address));
            _context11.next = 9;
            return res.dirList(5, { exclude: exclude });

          case 9:
            _context11.t0 = function (ea) {
              return ea.url;
            };

            found = _context11.sent.map(_context11.t0);
            return _context11.abrupt("return", found.filter(function (f) {
              return f.match(/\.js$/);
            }).map(function (m) {
              return system.getModule(m);
            }));

          case 12:
          case "end":
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  return function modulesInPackage(_x33, _x34) {
    return _ref11.apply(this, arguments);
  };
}();

var loadMochaTestFile$1 = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(file) {
    var testsByFile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var tester;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return System.import("mocha-es6/index.js");

          case 2:
            tester = _context.sent;
            return _context.abrupt("return", tester.loadTestModuleAndExtractTestState(file, testsByFile));

          case 4:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function loadMochaTestFile$1(_x) {
    return _ref.apply(this, arguments);
  };
}();

var runMochaTests$1 = function () {
  var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(grep, testsByFile, onChange, onError) {
    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _ref5, file, _ref6, mocha, mochaRun;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            mochaRun = function mochaRun(mocha) {
              return new Promise(function (resolve, reject) {
                var files = lively_lang.arr.compact(mocha.suite.suites).map(function (_ref4) {
                  var file = _ref4.file;
                  return file;
                }),
                    tests = lively.lang.chain(testsByFile).filter(function (ea) {
                  return files.includes(ea.file);
                }).pluck("tests").flatten().value();

                if (!tests || !tests.length) return reject(new Error("Trying to run tests of " + files.join(", ") + " but cannot find them in loaded tests!"));
                mocha.reporter(function Reporter(runner) {
                  runner.on("test", function (test) {
                    try {
                      var t = tests.find(function (ea) {
                        return ea.fullTitle === test.fullTitle();
                      });
                      t.state = "running";
                      typeof onChange === "function" && onChange(t, "test");
                    } catch (e) {
                      typeof onError === "function" && onError(e, "test");
                    }
                  });

                  runner.on("pass", function (test) {
                    try {
                      var t = tests.find(function (ea) {
                        return ea.fullTitle === test.fullTitle();
                      });
                      t.state = "succeeded";
                      t.duration = test.duration;
                      typeof onChange === "function" && onChange(t, "pass");
                    } catch (e) {
                      typeof onError === "function" && onError(e, "pass");
                    }
                  });

                  runner.on("fail", function (test, error) {
                    try {
                      var _attachErrorToTest = function _attachErrorToTest(test, error, duration) {
                        test.state = "failed";
                        test.duration = test.duration;
                        test.error = error;
                      };

                      var t = tests.find(function (ea) {
                        return ea.fullTitle === test.fullTitle();
                      });
                      if (t) _attachErrorToTest(t, error, test.duration);else {
                        // "test" is a hook...
                        var parentTests = lively_lang.arr.invoke(test.parent.tests, "fullTitle");
                        tests.filter(function (ea) {
                          return parentTests.includes(ea.fullTitle);
                        }).forEach(function (ea) {
                          return _attachErrorToTest(ea, error, test.duration);
                        });
                      }

                      typeof onChange === "function" && onChange(t, "fail");
                    } catch (e) {
                      typeof onError === "function" && onError(e, "fail");
                    }
                  });
                });

                mocha.run(function (failures) {
                  return resolve({ testsByFile: testsByFile, mocha: mocha });
                });
              });
            };

            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 4;
            _iterator = testsByFile[Symbol.iterator]();

          case 6:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context2.next = 19;
              break;
            }

            _ref5 = _step.value;
            file = _ref5.file;
            _context2.next = 11;
            return loadMochaTestFile$1(file, testsByFile);

          case 11:
            _ref6 = _context2.sent;
            mocha = _ref6.mocha;

            if (grep) mocha = mocha.grep(grep);
            _context2.next = 16;
            return mochaRun(mocha);

          case 16:
            _iteratorNormalCompletion = true;
            _context2.next = 6;
            break;

          case 19:
            _context2.next = 25;
            break;

          case 21:
            _context2.prev = 21;
            _context2.t0 = _context2["catch"](4);
            _didIteratorError = true;
            _iteratorError = _context2.t0;

          case 25:
            _context2.prev = 25;
            _context2.prev = 26;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 28:
            _context2.prev = 28;

            if (!_didIteratorError) {
              _context2.next = 31;
              break;
            }

            throw _iteratorError;

          case 31:
            return _context2.finish(28);

          case 32:
            return _context2.finish(25);

          case 33:
            return _context2.abrupt("return", { mocha: mocha, testsByFile: testsByFile });

          case 34:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this, [[4, 21, 25, 33], [26,, 28, 32]]);
  }));

  return function runMochaTests$1(_x3, _x4, _x5, _x6) {
    return _ref2.apply(this, arguments);
  };
}();

function todo(methodName) {
  throw new Error(methodName + " is not yet implemented!");
}

var AbstractCoreInterface = function () {
  function AbstractCoreInterface() {
    classCallCheck(this, AbstractCoreInterface);
  }

  createClass(AbstractCoreInterface, [{
    key: "dynamicCompletionsForPrefix",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // lively.vm
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(moduleName, prefix, options) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                todo("dynamicCompletionsForPrefix");
              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function dynamicCompletionsForPrefix(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
      }

      return dynamicCompletionsForPrefix;
    }()
  }, {
    key: "runEval",
    value: function runEval(source, options) {
      todo("runEval");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // resources
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "resourceExists",
    value: function resourceExists(url) {
      todo("resourceExists");
    }
  }, {
    key: "resourceEnsureExistance",
    value: function resourceEnsureExistance(url, optContent) {
      todo("resourceEnsureExistance");
    }
  }, {
    key: "resourceMkdir",
    value: function resourceMkdir(url) {
      todo("resourceMkdir");
    }
  }, {
    key: "resourceRead",
    value: function resourceRead(url) {
      todo("resourceRead");
    }
  }, {
    key: "resourceRemove",
    value: function resourceRemove(url) {
      todo("resourceRemove");
    }
  }, {
    key: "resourceWrite",
    value: function resourceWrite(url, source) {
      todo("resourceWrite");
    }
  }, {
    key: "resourceCreateFiles",
    value: function resourceCreateFiles(baseDir, spec) {
      todo("resourceCreateFiles");
    }
  }, {
    key: "resourceDirList",
    value: function resourceDirList(baseDir, depth, opts) {
      todo("resourceDirList");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // system related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "normalizeSync",
    value: function normalizeSync(name, parentName, isPlugin) {
      todo("normalizeSync");
    }
  }, {
    key: "normalize",
    value: function normalize(name, parent, parentAddress) {
      todo("normalize");
    }
  }, {
    key: "printSystemConfig",
    value: function printSystemConfig() {
      todo("printSystemConfig");
    }
  }, {
    key: "getConfig",
    value: function getConfig() {
      todo("getConfig");
    }
  }, {
    key: "setConfig",
    value: function setConfig(conf) {
      todo("setConfig");
    }
  }, {
    key: "getPackages",
    value: function getPackages(options) {
      todo("getPackages");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "isModuleLoaded",
    value: function isModuleLoaded(name, isNormalized) {
      todo("isModuleLoaded");
    }
  }, {
    key: "doesModuleExist",
    value: function doesModuleExist(name, isNormalized) {
      todo("doesModuleExist");
    }
  }, {
    key: "getModules",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.t0 = lively_lang.arr;
                _context2.next = 3;
                return this.getPackages();

              case 3:
                _context2.t1 = _context2.sent;

                _context2.t2 = function (ea) {
                  return ea.modules;
                };

                return _context2.abrupt("return", _context2.t0.flatmap.call(_context2.t0, _context2.t1, _context2.t2));

              case 6:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function getModules() {
        return _ref2.apply(this, arguments);
      }

      return getModules;
    }()
  }, {
    key: "getModule",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(name) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.getModules();

              case 2:
                _context3.t0 = function (ea) {
                  return ea.name === name;
                };

                return _context3.abrupt("return", _context3.sent.find(_context3.t0));

              case 4:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function getModule(_x4) {
        return _ref3.apply(this, arguments);
      }

      return getModule;
    }()
  }, {
    key: "getPackage",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(name) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                name = name.replace(/\/+$/, "");
                _context4.next = 3;
                return this.getPackages();

              case 3:
                _context4.t0 = function (ea) {
                  return ea.address === name || ea.name === name;
                };

                return _context4.abrupt("return", _context4.sent.find(_context4.t0));

              case 5:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function getPackage(_x5) {
        return _ref4.apply(this, arguments);
      }

      return getPackage;
    }()
  }, {
    key: "getPackageForModule",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(name) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                todo("getPackageForModule");
              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function getPackageForModule(_x6) {
        return _ref5.apply(this, arguments);
      }

      return getPackageForModule;
    }()
  }, {
    key: "systemConfChange",
    value: function systemConfChange(source) {
      var jso = parseJsonLikeObj(source),
          exceptions = ["baseURL"];
      exceptions.forEach(function (ea) {
        return delete jso[ea];
      });
      // Object.keys(jso).forEach(k => modules.System[k] = jso[k]);
      return this.setConfig(jso);
    }
  }, {
    key: "resourcesOfPackage",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(packageOrAddress, exclude) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                todo("resourcesOfPackage");
              case 1:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function resourcesOfPackage(_x7, _x8) {
        return _ref6.apply(this, arguments);
      }

      return resourcesOfPackage;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  
    // package related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "registerPackage",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(packageURL) {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                todo("registerPackage");
              case 1:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function registerPackage(_x9) {
        return _ref7.apply(this, arguments);
      }

      return registerPackage;
    }()
  }, {
    key: "importPackage",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(packageURL) {
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                todo("importPackage");
              case 1:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function importPackage(_x10) {
        return _ref8.apply(this, arguments);
      }

      return importPackage;
    }()
  }, {
    key: "removePackage",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(packageURL) {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                todo("removePackage");
              case 1:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function removePackage(_x11) {
        return _ref9.apply(this, arguments);
      }

      return removePackage;
    }()
  }, {
    key: "reloadPackage",
    value: function () {
      var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(packageURL) {
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                todo("reloadPackage");
              case 1:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function reloadPackage(_x12) {
        return _ref10.apply(this, arguments);
      }

      return reloadPackage;
    }()
  }, {
    key: "packageConfChange",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(source, confFile) {
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                todo("packageConfChange");
              case 1:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function packageConfChange(_x13, _x14) {
        return _ref11.apply(this, arguments);
      }

      return packageConfChange;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // module related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "importModule",
    value: function importModule(name) {
      todo("importModule");
    }
  }, {
    key: "forgetModule",
    value: function forgetModule(name, opts) {
      todo("forgetModule");
    }
  }, {
    key: "reloadModule",
    value: function reloadModule(name, opts) {
      todo("reloadModule");
    }
  }, {
    key: "moduleFormat",
    value: function moduleFormat(moduleName) {
      todo("moduleFormat");
    }
  }, {
    key: "moduleRead",
    value: function moduleRead(moduleName) {
      todo("moduleRead");
    }
  }, {
    key: "moduleSourceChange",
    value: function moduleSourceChange(moduleName, newSource, options) {
      todo("moduleSourceChange");
    }
  }, {
    key: "importsAndExportsOf",
    value: function importsAndExportsOf(modId, sourceOrAst) {
      todo("importsAndExportsOf");
    }
  }, {
    key: "keyValueListOfVariablesInModule",
    value: function keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
      todo("keyValueListOfVariablesInModule");
    }
  }, {
    key: "moduleWrite",
    value: function moduleWrite(moduleName, newSource) {
      return this.moduleSourceChange(moduleName, newSource);
    }
  }]);
  return AbstractCoreInterface;
}();

var RemoteCoreInterface = function (_AbstractCoreInterfac) {
  inherits(RemoteCoreInterface, _AbstractCoreInterfac);

  function RemoteCoreInterface() {
    classCallCheck(this, RemoteCoreInterface);

    var _this = possibleConstructorReturn(this, (RemoteCoreInterface.__proto__ || Object.getPrototypeOf(RemoteCoreInterface)).call(this));

    _this.currentEval = null;
    return _this;
  }

  createClass(RemoteCoreInterface, [{
    key: "runEval",
    value: function runEval(source, options) {
      throw new Error("Not yet implemented");
    }
  }, {
    key: "runEvalAndStringify",
    value: function runEvalAndStringify(source, opts) {
      var _this2 = this;

      if (this.currentEval) return this.currentEval.then(function () {
        return _this2.runEvalAndStringify(source, opts);
      });

      return this.currentEval = Promise.resolve().then(asyncToGenerator(regeneratorRuntime.mark(function _callee12() {
        var result, val, parsedResult;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                _context12.next = 2;
                return _this2.runEval("\n        Promise.resolve((async " + ast.transform.wrapInFunction(source) + ")())\n          .then(function(result) { return JSON.stringify(result); })\n          .catch(function(err) { return {isError: true, value: err}; })\n          .then(function(result) {\n            if (!result || typeof result === \"string\") return result;\n            return JSON.stringify(result.isError ?\n              {isError: true, value: result.value.stack || String(result.value)} :\n              result)\n          });", _extends({
                  targetModule: "lively://remote-lively-system/runEvalAndStringify",
                  promiseTimeout: 30 * 1000,
                  waitForPromise: true
                }, opts));

              case 2:
                result = _context12.sent;

                if (!(result && result.isError)) {
                  _context12.next = 5;
                  break;
                }

                throw new Error(String(result.value || result.error));

              case 5:
                if (!(!result || !result.value)) {
                  _context12.next = 7;
                  break;
                }

                return _context12.abrupt("return", null);

              case 7:
                _context12.t0 = result.promisedValue;

                if (_context12.t0) {
                  _context12.next = 12;
                  break;
                }

                _context12.next = 11;
                return result.value;

              case 11:
                _context12.t0 = _context12.sent;

              case 12:
                val = _context12.t0;

                if (val) {
                  _context12.next = 15;
                  break;
                }

                return _context12.abrupt("return");

              case 15:
                if (!(val === "undefined")) {
                  _context12.next = 17;
                  break;
                }

                return _context12.abrupt("return", undefined);

              case 17:
                if (!(val === "null")) {
                  _context12.next = 19;
                  break;
                }

                return _context12.abrupt("return", null);

              case 19:
                if (!(val === "true")) {
                  _context12.next = 21;
                  break;
                }

                return _context12.abrupt("return", true);

              case 21:
                if (!(val === "false")) {
                  _context12.next = 23;
                  break;
                }

                return _context12.abrupt("return", false);

              case 23:
                parsedResult = void 0;
                _context12.prev = 24;
                parsedResult = JSON.parse(val);_context12.next = 31;
                break;

              case 28:
                _context12.prev = 28;
                _context12.t1 = _context12["catch"](24);
                return _context12.abrupt("return", val);

              case 31:
                if (!(parsedResult && parsedResult.isError)) {
                  _context12.next = 33;
                  break;
                }

                throw new Error(String(parsedResult.value));

              case 33:
                return _context12.abrupt("return", parsedResult);

              case 34:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, _this2, [[24, 28]]);
      }))).then(function (result) {
        delete _this2.currentEval;return result;
      }, function (err) {
        delete _this2.currentEval;return Promise.reject(err);
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // lively.vm
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "dynamicCompletionsForPrefix",
    value: function () {
      var _ref13 = asyncToGenerator(regeneratorRuntime.mark(function _callee13(moduleName, prefix, options) {
        var src;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                options = lively_lang.obj.dissoc(options, ["systemInterface", "System", "context"]);
                src = "\n      var prefix = " + JSON.stringify(prefix) + ",\n          opts = " + JSON.stringify(options) + ",\n          evalFn = code => lively.vm.runEval(code, opts);\n      if (typeof System === \"undefined\") delete opts.targetModule;\n      lively.vm.completions.getCompletions(evalFn, prefix).then(function(result) {\n        if (result.isError) throw result.value;\n        return {\n          completions: result.completions,\n          prefix: result.startLetters\n        }\n      });";
                return _context13.abrupt("return", this.runEvalAndStringify(src));

              case 3:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function dynamicCompletionsForPrefix(_x15, _x16, _x17) {
        return _ref13.apply(this, arguments);
      }

      return dynamicCompletionsForPrefix;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // resources
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "evalWithResource",
    value: function evalWithResource(url, method, arg) {
      return this.runEvalAndStringify("var {resource} = await System.import(\"lively.resources\"); await resource(\"" + url + "\")." + method + "(" + (arg ? JSON.stringify(arg) : "") + ")");
    }
  }, {
    key: "resourceExists",
    value: function resourceExists(url) {
      return this.evalWithResource(url, "exists");
    }
  }, {
    key: "resourceEnsureExistance",
    value: function resourceEnsureExistance(url, optContent) {
      return this.evalWithResource(url, "ensureExistance", optContent);
    }
  }, {
    key: "resourceMkdir",
    value: function resourceMkdir(url) {
      return this.evalWithResource(url, "mkdir");
    }
  }, {
    key: "resourceRead",
    value: function resourceRead(url) {
      return this.evalWithResource(url, "read");
    }
  }, {
    key: "resourceRemove",
    value: function resourceRemove(url) {
      return this.evalWithResource(url, "remove");
    }
  }, {
    key: "resourceWrite",
    value: function resourceWrite(url, source) {
      return this.evalWithResource(url, "write", source);
    }
  }, {
    key: "resourceCreateFiles",
    value: function resourceCreateFiles(baseDir, spec) {
      return this.runEvalAndStringify("var {createFiles} = await System.import(\"lively.resources\"); await createFiles(\"" + baseDir + "\", " + JSON.stringify(spec) + ")");
    }
  }, {
    key: "resourceDirList",
    value: function resourceDirList(url, depth, opts) {
      return this.runEvalAndStringify("\n      var {resource} = await System.import(\"lively.resources\");\n      (await resource(\"" + url + "\").dirList(" + JSON.stringify(depth) + ", " + JSON.stringify(opts) + "))\n        .map(({url}) => ({url}))");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // system related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "normalizeSync",
    value: function normalizeSync(name, parentName, isPlugin) {
      return this.runEvalAndStringify("lively.modules.System.decanonicalize(" + JSON.stringify(name) + ", " + JSON.stringify(parentName) + ", " + isPlugin + ")");
    }
  }, {
    key: "normalize",
    value: function normalize(name, parent, parentAddress) {
      return this.runEvalAndStringify("lively.modules.System.normalize(" + JSON.stringify(name) + ", " + JSON.stringify(parent) + ", " + JSON.stringify(parentAddress) + ")");
    }
  }, {
    key: "printSystemConfig",
    value: function printSystemConfig() {
      return this.runEvalAndStringify("lively.modules.printSystemConfig()");
    }
  }, {
    key: "getConfig",
    value: function getConfig() {
      return this.runEvalAndStringify("var c = Object.assign({}, lively.modules.System.getConfig()); for (var name in c) if (name.indexOf(\"__lively.modules__\") === 0 || name.indexOf(\"loads\") === 0) delete c[name]; c");
    }
  }, {
    key: "setConfig",
    value: function setConfig(conf) {
      return this.runEvalAndStringify("lively.modules.System.config(" + JSON.stringify(conf) + ")");
    }
  }, {
    key: "getPackages",
    value: function getPackages(options) {
      options = _extends({ excluded: [] }, options);
      options.excluded = options.excluded.map(String);
      return this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\")),\n          options = " + JSON.stringify(options) + ";\n      options.excluded = options.excluded.map(ea => {\n        let evaled = lively.vm.syncEval(ea).value;\n        return typeof evaled === \"function\" ? evaled : ea;\n      });\n      await livelySystem.localInterface.getPackages(options)\n        .map(ea => Object.assign({}, ea, {System: null}));");
    }
  }, {
    key: "getPackageForModule",
    value: function getPackageForModule(moduleId) {
      return this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\"));\n      await livelySystem.localInterface.getPackageForModule(" + JSON.stringify(moduleId) + ")");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // package related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "isModuleLoaded",
    value: function isModuleLoaded(name, isNormalized) {
      return this.runEvalAndStringify("lively.modules.isModuleLoaded(\"" + name + "\", " + isNormalized + ")");
    }
  }, {
    key: "doesModuleExist",
    value: function doesModuleExist(name, isNormalized) {
      return this.runEvalAndStringify("lively.modules.doesModuleExist(\"" + name + "\", " + isNormalized + ")");
    }
  }, {
    key: "registerPackage",
    value: function () {
      var _ref14 = asyncToGenerator(regeneratorRuntime.mark(function _callee14(packageURL) {
        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                return _context14.abrupt("return", this.runEvalAndStringify("lively.modules.registerPackage(" + JSON.stringify(packageURL) + ")"));

              case 1:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function registerPackage(_x18) {
        return _ref14.apply(this, arguments);
      }

      return registerPackage;
    }()
  }, {
    key: "importPackage",
    value: function () {
      var _ref15 = asyncToGenerator(regeneratorRuntime.mark(function _callee15(packageURL) {
        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                return _context15.abrupt("return", this.runEvalAndStringify("lively.modules.importPackage(" + JSON.stringify(packageURL) + ")"));

              case 1:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function importPackage(_x19) {
        return _ref15.apply(this, arguments);
      }

      return importPackage;
    }()
  }, {
    key: "removePackage",
    value: function () {
      var _ref16 = asyncToGenerator(regeneratorRuntime.mark(function _callee16(packageURL) {
        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                return _context16.abrupt("return", this.runEvalAndStringify("lively.modules.removePackage(" + JSON.stringify(packageURL) + ")"));

              case 1:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16, this);
      }));

      function removePackage(_x20) {
        return _ref16.apply(this, arguments);
      }

      return removePackage;
    }()
  }, {
    key: "reloadPackage",
    value: function () {
      var _ref17 = asyncToGenerator(regeneratorRuntime.mark(function _callee17(packageURL, opts) {
        return regeneratorRuntime.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                return _context17.abrupt("return", this.runEvalAndStringify("lively.modules.reloadPackage(" + JSON.stringify(packageURL) + ", " + JSON.stringify(opts) + ")"));

              case 1:
              case "end":
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));

      function reloadPackage(_x21, _x22) {
        return _ref17.apply(this, arguments);
      }

      return reloadPackage;
    }()
  }, {
    key: "packageConfChange",
    value: function packageConfChange(source, confFile) {
      return this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\"));\n      await livelySystem.localInterface.packageConfChange(" + JSON.stringify(source) + ", " + JSON.stringify(confFile) + ")");
    }
  }, {
    key: "resourcesOfPackage",
    value: function () {
      var _ref18 = asyncToGenerator(regeneratorRuntime.mark(function _callee18(packageOrAddress) {
        var exclude = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [".git", "node_modules", ".module_cache", "lively.next-node_modules"];
        return regeneratorRuntime.wrap(function _callee18$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                if (packageOrAddress.address) packageOrAddress = packageOrAddress.address;
                return _context18.abrupt("return", this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\"));\n      await livelySystem.localInterface.resourcesOfPackage(" + JSON.stringify(packageOrAddress) + ", " + JSON.stringify(exclude) + ");"));

              case 2:
              case "end":
                return _context18.stop();
            }
          }
        }, _callee18, this);
      }));

      function resourcesOfPackage(_x23) {
        return _ref18.apply(this, arguments);
      }

      return resourcesOfPackage;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // module related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "getModule",
    value: function () {
      var _ref19 = asyncToGenerator(regeneratorRuntime.mark(function _callee19(name) {
        var spec;
        return regeneratorRuntime.wrap(function _callee19$(_context19) {
          while (1) {
            switch (_context19.prev = _context19.next) {
              case 0:
                _context19.next = 2;
                return this.getModules();

              case 2:
                _context19.t0 = function (ea) {
                  return ea.name === name;
                };

                spec = _context19.sent.find(_context19.t0);
                return _context19.abrupt("return", spec ? modules.module(spec.name) : null);

              case 5:
              case "end":
                return _context19.stop();
            }
          }
        }, _callee19, this);
      }));

      function getModule(_x25) {
        return _ref19.apply(this, arguments);
      }

      return getModule;
    }()
  }, {
    key: "importModule",
    value: function importModule(name) {
      return this.runEvalAndStringify("lively.modules.System.import(" + JSON.stringify(name) + ")");
    }
  }, {
    key: "forgetModule",
    value: function forgetModule(name, opts) {
      return this.runEvalAndStringify("lively.modules.module(" + JSON.stringify(name) + ").unload(" + JSON.stringify(opts) + ")");
    }
  }, {
    key: "reloadModule",
    value: function reloadModule(name, opts) {
      return this.runEvalAndStringify("lively.modules.module(" + JSON.stringify(name) + ").reload(" + JSON.stringify(opts) + ")");
    }
  }, {
    key: "moduleFormat",
    value: function moduleFormat(moduleName) {
      return this.runEvalAndStringify("lively.modules.module(" + JSON.stringify(moduleName) + ").format();");
    }
  }, {
    key: "moduleRead",
    value: function moduleRead(moduleName) {
      return this.runEvalAndStringify("lively.modules.module(" + JSON.stringify(moduleName) + ").source()");
    }
  }, {
    key: "moduleSourceChange",
    value: function moduleSourceChange(moduleName, newSource, options) {
      return this.runEvalAndStringify("lively.modules.module(" + JSON.stringify(moduleName) + ").changeSource(" + JSON.stringify(newSource) + ", " + JSON.stringify(options) + ")");
    }
  }, {
    key: "keyValueListOfVariablesInModule",
    value: function keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
      return this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\"));\n      await livelySystem.localInterface.keyValueListOfVariablesInModule(" + JSON.stringify(moduleName) + ", " + JSON.stringify(sourceOrAst) + ")");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // imports/exports
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "importsAndExportsOf",
    value: function importsAndExportsOf(modId, sourceOrAst) {
      return this.runEvalAndStringify("({\n      imports: await lively.modules.module(" + JSON.stringify(modId) + ").imports(),\n      exports: await lively.modules.module(" + JSON.stringify(modId) + ").exports()})");
    }
  }, {
    key: "exportsOfModules",
    value: function exportsOfModules(options) {
      return this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\"));\n      await livelySystem.localInterface.exportsOfModules(" + JSON.stringify(options) + ")");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // search
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "searchInPackage",
    value: function searchInPackage(packageURL, searchString, options) {
      return this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\"));\n      await livelySystem.localInterface.searchInPackage(" + JSON.stringify(packageURL) + ", " + JSON.stringify(searchString) + ", " + JSON.stringify(options) + ")");
    }

    // -=-=-=-
    // tests
    // -=-=-=-

  }, {
    key: "loadMochaTestFile",
    value: function () {
      var _ref20 = asyncToGenerator(regeneratorRuntime.mark(function _callee20(file) {
        var testsByFile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
        return regeneratorRuntime.wrap(function _callee20$(_context20) {
          while (1) {
            switch (_context20.prev = _context20.next) {
              case 0:
                return _context20.abrupt("return", this.runEvalAndStringify("\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\")),\n          {testsByFile} = await livelySystem.localInterface.loadMochaTestFile(" + JSON.stringify(file) + ", " + JSON.stringify(testsByFile) + "), result;\n      result = {testsByFile}"));

              case 1:
              case "end":
                return _context20.stop();
            }
          }
        }, _callee20, this);
      }));

      function loadMochaTestFile(_x26) {
        return _ref20.apply(this, arguments);
      }

      return loadMochaTestFile;
    }()
  }, {
    key: "runMochaTests",
    value: function () {
      var _ref21 = asyncToGenerator(regeneratorRuntime.mark(function _callee21(grep, testsByFile, onChange, onError) {
        return regeneratorRuntime.wrap(function _callee21$(_context21) {
          while (1) {
            switch (_context21.prev = _context21.next) {
              case 0:
                if (grep && grep instanceof RegExp) grep = { isRegExp: true, value: String(grep).replace(/^\/|\/$/g, "") };
                return _context21.abrupt("return", this.runEvalAndStringify("\n      var grep = " + JSON.stringify(grep) + ";\n      if (grep && grep.isRegExp)\n        grep = new RegExp(grep.value);\n      var livelySystem = (typeof lively !== \"undefined\" && lively.systemInterface) || System.get(System.decanonicalize(\"lively-system-interface\")),\n          {testsByFile, isError, value: error} = await livelySystem.localInterface.runMochaTests(grep, " + JSON.stringify(testsByFile || []) + "), result;\n      error = error ? String(error.stack || error) : null;\n      if (testsByFile) {\n        testsByFile.forEach(ea =>\n          ea.tests.forEach(ea => {\n            if (!ea.error) return;\n            var {message, stack, actual, expected} = ea.error;\n            ea.error = {\n              message: message || String(ea.error),\n              stack: stack,\n              actual, exected\n            }\n          }));\n      }\n      result = {testsByFile, isError, error}"));

              case 2:
              case "end":
                return _context21.stop();
            }
          }
        }, _callee21, this);
      }));

      function runMochaTests(_x28, _x29, _x30, _x31) {
        return _ref21.apply(this, arguments);
      }

      return runMochaTests;
    }()
  }]);
  return RemoteCoreInterface;
}(AbstractCoreInterface);

var LocalCoreInterface = function (_AbstractCoreInterfac) {
  inherits(LocalCoreInterface, _AbstractCoreInterfac);

  function LocalCoreInterface() {
    classCallCheck(this, LocalCoreInterface);
    return possibleConstructorReturn(this, (LocalCoreInterface.__proto__ || Object.getPrototypeOf(LocalCoreInterface)).apply(this, arguments));
  }

  createClass(LocalCoreInterface, [{
    key: "dynamicCompletionsForPrefix",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // lively.vm
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(moduleName, prefix, options) {
        var result;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return vm.completions.getCompletions(function (code) {
                  return vm.runEval(code, _extends({ targetModule: moduleName }, options));
                }, prefix);

              case 2:
                result = _context.sent;

                if (!result.isError) {
                  _context.next = 5;
                  break;
                }

                throw result.value;

              case 5:
                return _context.abrupt("return", {
                  completions: result.completions,
                  prefix: result.startLetters
                });

              case 6:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function dynamicCompletionsForPrefix(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
      }

      return dynamicCompletionsForPrefix;
    }()
  }, {
    key: "runEval",
    value: function runEval(source, options) {
      return vm.runEval(source, options);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // resources
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "resourceExists",
    value: function resourceExists(url) {
      return lively_resources.resource(url).exists();
    }
  }, {
    key: "resourceEnsureExistance",
    value: function resourceEnsureExistance(url, optContent) {
      return lively_resources.resource(url).ensureExistance(optContent);
    }
  }, {
    key: "resourceMkdir",
    value: function resourceMkdir(url) {
      return lively_resources.resource(url).mkdir();
    }
  }, {
    key: "resourceRead",
    value: function resourceRead(url) {
      return lively_resources.resource(url).read();
    }
  }, {
    key: "resourceRemove",
    value: function resourceRemove(url) {
      return lively_resources.resource(url).remove();
    }
  }, {
    key: "resourceWrite",
    value: function resourceWrite(url, source) {
      return lively_resources.resource(url).write(source);
    }
  }, {
    key: "resourceCreateFiles",
    value: function resourceCreateFiles(baseDir, spec) {
      return lively_resources.createFiles(baseDir, spec);
    }
  }, {
    key: "resourceDirList",
    value: function resourceDirList(url, depth, opts) {
      return lively_resources.resource(url).dirList(depth, opts);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // system related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "normalizeSync",
    value: function normalizeSync(name, parentName, isPlugin) {
      return modules.System.decanonicalize(name, parentName, isPlugin);
    }
  }, {
    key: "normalize",
    value: function normalize(name, parent, parentAddress) {
      return modules.System.normalize(name, parent, parentAddress);
    }
  }, {
    key: "printSystemConfig",
    value: function printSystemConfig() {
      return modules.printSystemConfig();
    }
  }, {
    key: "getConfig",
    value: function getConfig() {
      return modules.System.getConfig();
    }
  }, {
    key: "setConfig",
    value: function setConfig(conf) {
      modules.System.config(conf);
    }
  }, {
    key: "getPackages",
    value: function getPackages(options) {
      var _options = _extends({}, options),
          _options$excluded = _options.excluded,
          excluded = _options$excluded === undefined ? [] : _options$excluded,
          excludedURLs = excluded.filter(function (ea) {
        return typeof ea === "string";
      }),
          excludeFns = excluded.filter(function (ea) {
        return typeof ea === "function";
      });

      excludedURLs = excludedURLs.concat(excludedURLs.map(function (url) {
        return System.decanonicalize(url.replace(/\/?$/, "/")).replace(/\/$/, "");
      }));
      return modules.getPackages().filter(function (p) {
        return !excludedURLs.includes(p.url) && !excludeFns.some(function (fn) {
          return fn(p.url);
        });
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // package related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "registerPackage",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(packageURL) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                return _context2.abrupt("return", modules.registerPackage(packageURL));

              case 1:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function registerPackage(_x4) {
        return _ref2.apply(this, arguments);
      }

      return registerPackage;
    }()
  }, {
    key: "importPackage",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(packageURL) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                return _context3.abrupt("return", modules.importPackage(packageURL));

              case 1:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function importPackage(_x5) {
        return _ref3.apply(this, arguments);
      }

      return importPackage;
    }()
  }, {
    key: "removePackage",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(packageURL) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                return _context4.abrupt("return", modules.removePackage(packageURL));

              case 1:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function removePackage(_x6) {
        return _ref4.apply(this, arguments);
      }

      return removePackage;
    }()
  }, {
    key: "reloadPackage",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(packageURL, opts) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt("return", modules.reloadPackage(packageURL, opts));

              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function reloadPackage(_x7, _x8) {
        return _ref5.apply(this, arguments);
      }

      return reloadPackage;
    }()
  }, {
    key: "packageConfChange",
    value: function () {
      var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(source, confFile) {
        var S, config, newSource, p;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                S = modules.System, config = parseJsonLikeObj(source), newSource = JSON.stringify(config, null, 2);
                _context6.next = 3;
                return modules.module(confFile).changeSource(newSource, { doEval: false });

              case 3:
                S.set(confFile, S.newModule(config)); // FIXME, do this in lively.modules

                _context6.next = 6;
                return this.getPackageForModule(confFile);

              case 6:
                p = _context6.sent;

                if (p) modules.applyPackageConfig(config, p.address);

              case 8:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function packageConfChange(_x9, _x10) {
        return _ref6.apply(this, arguments);
      }

      return packageConfChange;
    }()
  }, {
    key: "resourcesOfPackage",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(packageOrAddress) {
        var exclude = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [".git", "node_modules", ".module_cache"];
        var url, p;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.prev = 0;
                url = packageOrAddress.address ? packageOrAddress.address : packageOrAddress, p = modules.getPackage(url);
                _context7.next = 4;
                return p.resources(undefined, exclude);

              case 4:
                _context7.t0 = function (ea) {
                  return Object.assign(ea, { package: ea.package.url });
                };

                return _context7.abrupt("return", _context7.sent.map(_context7.t0));

              case 8:
                _context7.prev = 8;
                _context7.t1 = _context7["catch"](0);

                console.warn("resourcesOfPackage error for " + packageOrAddress + ": " + _context7.t1);
                return _context7.abrupt("return", []);

              case 12:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this, [[0, 8]]);
      }));

      function resourcesOfPackage(_x11) {
        return _ref7.apply(this, arguments);
      }

      return resourcesOfPackage;
    }()
  }, {
    key: "getPackageForModule",
    value: function getPackageForModule(moduleId) {
      var p = modules.getPackageOfModule(moduleId);
      return p ? p.asSpec() : p;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // module related
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "isModuleLoaded",
    value: function isModuleLoaded(name, isNormalized) {
      return modules.isModuleLoaded(name, isNormalized);
    }
  }, {
    key: "doesModuleExist",
    value: function doesModuleExist(name, isNormalized) {
      return modules.isModuleLoaded(name, isNormalized);
    }
  }, {
    key: "getModule",
    value: function getModule(name) {
      return modules.module(name);
    }
  }, {
    key: "importModule",
    value: function importModule(name) {
      return modules.System.import(name);
    }
  }, {
    key: "forgetModule",
    value: function forgetModule(name, opts) {
      return modules.module(name).unload(opts);
    }
  }, {
    key: "reloadModule",
    value: function reloadModule(name, opts) {
      return modules.module(name).reload(opts);
    }
  }, {
    key: "moduleFormat",
    value: function moduleFormat(moduleName) {
      return modules.module(moduleName).format();
    }
  }, {
    key: "moduleRead",
    value: function moduleRead(moduleName) {
      return modules.module(moduleName).source();
    }
  }, {
    key: "moduleSourceChange",
    value: function moduleSourceChange(moduleName, newSource, options) {
      return modules.module(moduleName).changeSource(newSource, options);
    }
  }, {
    key: "keyValueListOfVariablesInModule",
    value: function () {
      var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(moduleName, sourceOrAstOrNothing) {
        var parsed, id, format, scope, importsExports, toplevel, decls, imports, col1Width;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                if (sourceOrAstOrNothing) {
                  _context8.next = 4;
                  break;
                }

                _context8.next = 3;
                return this.resourceRead(moduleName);

              case 3:
                sourceOrAstOrNothing = _context8.sent;

              case 4:
                parsed = typeof sourceOrAstOrNothing === "string" ? ast.parse(sourceOrAstOrNothing) : sourceOrAstOrNothing;
                id = this.normalizeSync(moduleName);
                format = this.moduleFormat(id);
                scope = modules.module(id).env().recorder;
                _context8.next = 10;
                return this.importsAndExportsOf(id, parsed);

              case 10:
                importsExports = _context8.sent;
                toplevel = ast.query.topLevelDeclsAndRefs(parsed);
                decls = lively_lang.arr.sortByKey(ast.query.declarationsOfScope(toplevel.scope, true), "start");
                imports = lively_lang.arr.pluck(toplevel.scope.importSpecifiers, "name");
                col1Width = 0;
                return _context8.abrupt("return", decls.map(function (v) {
                  var nameLength = v.name.length,
                      isExport = importsExports.exports.find(function (ea) {
                    return ea.local === v.name;
                  }),
                      isImport = lively_lang.arr.include(imports, v.name);
                  if (isExport) nameLength += " [export]".length;
                  if (isImport) nameLength += " [import]".length;
                  col1Width = Math.max(col1Width, nameLength);

                  return {
                    isExport: isExport,
                    isImport: isImport,
                    name: v.name,
                    value: scope[v.name],
                    node: v,
                    printedName: v.name + (isExport ? " [export]" : "") + (isImport ? " [import]" : ""),
                    printedValue: lively_lang.obj.inspect(scope[v.name], { maxDepth: 1 }).replace(/\n/g, "")
                  };
                }).map(function (val) {
                  return {
                    isListItem: true,
                    value: val,
                    string: val.printedName + lively_lang.string.indent(" = " + val.printedValue, " ", col1Width - val.printedName.length)
                  };
                }));

              case 16:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function keyValueListOfVariablesInModule(_x13, _x14) {
        return _ref8.apply(this, arguments);
      }

      return keyValueListOfVariablesInModule;
    }()
  }, {
    key: "importsAndExportsOf",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(modId, sourceOrAst) {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return modules.module(modId).imports(sourceOrAst);

              case 2:
                _context9.t0 = _context9.sent;
                _context9.next = 5;
                return modules.module(modId).exports(sourceOrAst);

              case 5:
                _context9.t1 = _context9.sent;
                return _context9.abrupt("return", {
                  imports: _context9.t0,
                  exports: _context9.t1
                });

              case 7:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function importsAndExportsOf(_x15, _x16) {
        return _ref9.apply(this, arguments);
      }

      return importsAndExportsOf;
    }()
  }, {
    key: "exportsOfModules",
    value: function exportsOfModules(options) {
      return modules.ExportLookup.run(modules.System, options);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // search
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "searchInPackage",
    value: function searchInPackage(packageURL, searchString, options) {
      return modules.getPackage(packageURL).search(searchString, options);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // tests
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "runMochaTests",
    value: function runMochaTests(grep, testsByFile, onChange, onError) {
      return runMochaTests$1(grep, testsByFile, onChange, onError);
    }
  }, {
    key: "loadMochaTestFile",
    value: function loadMochaTestFile(file, testsByFile) {
      return loadMochaTestFile$1(file, testsByFile);
    }
  }, {
    key: "name",
    get: function get() {
      return "local";
    }
  }]);
  return LocalCoreInterface;
}(AbstractCoreInterface);

var Interface = function () {
  function Interface(coreInterface) {
    classCallCheck(this, Interface);

    this.coreInterface = coreInterface;
  }

  createClass(Interface, [{
    key: "dynamicCompletionsForPrefix",
    value: function dynamicCompletionsForPrefix(mod, prefix, opts) {
      return this.coreInterface.dynamicCompletionsForPrefix(mod, prefix, opts);
    }
  }, {
    key: "runEval",
    value: function runEval(source, options) {
      return this.coreInterface.runEval(source, options);
    }
  }, {
    key: "printSystemConfig",
    value: function printSystemConfig(a, b, c) {
      return this.coreInterface.printSystemConfig(a, b, c);
    }
  }, {
    key: "getConfig",
    value: function getConfig(a, b, c) {
      return this.coreInterface.getConfig(a, b, c);
    }
  }, {
    key: "getPackages",
    value: function getPackages(options) {
      return this.coreInterface.getPackages(options);
    }
  }, {
    key: "getModules",
    value: function getModules(a, b, c) {
      return this.coreInterface.getModules(a, b, c);
    }
  }, {
    key: "getModule",
    value: function getModule(a, b, c) {
      return this.coreInterface.getModule(a, b, c);
    }
  }, {
    key: "getPackage",
    value: function getPackage(a, b, c) {
      return this.coreInterface.getPackage(a, b, c);
    }
  }, {
    key: "getPackageForModule",
    value: function getPackageForModule(a, b, c) {
      return this.coreInterface.getPackageForModule(a, b, c);
    }
  }, {
    key: "resourcesOfPackage",
    value: function resourcesOfPackage(packageAddress, excludes) {
      return this.coreInterface.resourcesOfPackage(packageAddress, excludes);
    }
  }, {
    key: "systemConfChange",
    value: function systemConfChange(a, b, c) {
      return this.coreInterface.systemConfChange(a, b, c);
    }
  }, {
    key: "registerPackage",
    value: function registerPackage(packageURL) {
      return this.coreInterface.registerPackage(packageURL);
    }
  }, {
    key: "importPackage",
    value: function importPackage(packageURL) {
      return this.coreInterface.importPackage(packageURL);
    }
  }, {
    key: "removePackage",
    value: function removePackage(packageURL) {
      return this.coreInterface.removePackage(packageURL);
    }
  }, {
    key: "reloadPackage",
    value: function reloadPackage(packageURL) {
      return this.coreInterface.reloadPackage(packageURL);
    }
  }, {
    key: "packageConfChange",
    value: function packageConfChange(source, confFile) {
      return this.coreInterface.packageConfChange(source, confFile);
    }
  }, {
    key: "keyValueListOfVariablesInModule",
    value: function keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
      return this.coreInterface.keyValueListOfVariablesInModule(moduleName, sourceOrAst);
    }
  }, {
    key: "interactivelyCreatePackage",
    value: function interactivelyCreatePackage(requester) {
      return interactivelyCreatePackage$1(this.coreInterface, requester);
    }
  }, {
    key: "interactivelyLoadPackage",
    value: function interactivelyLoadPackage(a, b) {
      return interactivelyLoadPackage$1(this.coreInterface, a, b);
    }
  }, {
    key: "interactivelyReloadPackage",
    value: function interactivelyReloadPackage(a, b) {
      return interactivelyReloadPackage$1(this.coreInterface, a, b);
    }
  }, {
    key: "interactivelyUnloadPackage",
    value: function interactivelyUnloadPackage(vmEditor, packageURL, world) {
      return interactivelyUnloadPackage$1(this.coreInterface, vmEditor, packageURL, world);
    }
  }, {
    key: "interactivelyRemovePackage",
    value: function interactivelyRemovePackage(requester, pkgURL) {
      return interactivelyRemovePackage$1(this.coreInterface, requester, pkgURL);
    }
  }, {
    key: "isModuleLoaded",
    value: function isModuleLoaded(name, isNormalized) {
      return this.coreInterface.isModuleLoaded(name, isNormalized);
    }
  }, {
    key: "doesModuleExist",
    value: function doesModuleExist(name, isNormalized) {
      return this.coreInterface.doesModuleExist(name, isNormalized);
    }
  }, {
    key: "importModule",
    value: function importModule(name) {
      return this.coreInterface.importModule(name);
    }
  }, {
    key: "forgetModule",
    value: function forgetModule(name, opts) {
      return this.coreInterface.forgetModule(name, opts);
    }
  }, {
    key: "reloadModule",
    value: function reloadModule(name, opts) {
      return this.coreInterface.reloadModule(name, opts);
    }
  }, {
    key: "moduleFormat",
    value: function moduleFormat(name) {
      return this.coreInterface.moduleFormat(name);
    }
  }, {
    key: "moduleRead",
    value: function moduleRead(name) {
      return this.coreInterface.moduleRead(name);
    }
  }, {
    key: "moduleWrite",
    value: function moduleWrite(name, content) {
      return this.coreInterface.moduleWrite(name, content);
    }
  }, {
    key: "getModulesInPackage",
    value: function getModulesInPackage(name) {
      return modulesInPackage(this.coreInterface, name);
    }
  }, {
    key: "shortModuleName",
    value: function shortModuleName(moduleId, itsPackage) {
      return shortModuleName$1(this.coreInterface, moduleId, itsPackage);
    }
  }, {
    key: "interactivelyChangeModule",
    value: function interactivelyChangeModule(moduleName, newSource, options) {
      return interactivelyChangeModule$1(this.coreInterface, moduleName, newSource, options);
    }
  }, {
    key: "interactivelyReloadModule",
    value: function interactivelyReloadModule(vmEditor, moduleName) {
      return interactivelyReloadModule$1(this.coreInterface, vmEditor, moduleName);
    }
  }, {
    key: "interactivelyUnloadModule",
    value: function interactivelyUnloadModule(vmEditor, moduleName) {
      return interactivelyUnloadModule$1(this.coreInterface, vmEditor, moduleName);
    }
  }, {
    key: "interactivelyRemoveModule",
    value: function interactivelyRemoveModule(requester, moduleName) {
      return interactivelyRemoveModule$1(this.coreInterface, requester, moduleName);
    }
  }, {
    key: "interactivelyAddModule",
    value: function interactivelyAddModule(requester, relatedPackageOrModule) {
      return interactivelyAddModule$1(this.coreInterface, requester, relatedPackageOrModule);
    }
  }, {
    key: "showExportsAndImportsOf",
    value: function showExportsAndImportsOf(packageAddress, world) {
      return showExportsAndImportsOf$1(this.coreInterface, packageAddress, world);
    }
  }, {
    key: "exportsOfModules",
    value: function exportsOfModules(options) {
      return this.coreInterface.exportsOfModules(options);
    }

    // -=-=-=-
    // search
    // -=-=-=-

  }, {
    key: "searchInPackage",
    value: function searchInPackage(packageURL, searchTerm, options) {
      return this.coreInterface.searchInPackage(packageURL, searchTerm, options);
    }
  }, {
    key: "searchInAllPackages",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(searchTerm) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var packages, results, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _ref3, url, packageResults;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.coreInterface.getPackages({ excluded: options.excludedPackages });

              case 2:
                packages = _context.sent;
                results = [];
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context.prev = 7;
                _iterator = packages[Symbol.iterator]();

              case 9:
                if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                  _context.next = 27;
                  break;
                }

                _ref3 = _step.value;
                url = _ref3.url;

                if (!(!url || url === "no group" /*FIXME*/)) {
                  _context.next = 14;
                  break;
                }

                return _context.abrupt("continue", 24);

              case 14:
                _context.prev = 14;
                _context.next = 17;
                return this.coreInterface.searchInPackage(url, searchTerm, options);

              case 17:
                packageResults = _context.sent;

                results = results.concat(packageResults);
                _context.next = 24;
                break;

              case 21:
                _context.prev = 21;
                _context.t0 = _context["catch"](14);
                console.error("Error searching in package " + url + ":\n" + _context.t0.stack);

              case 24:
                _iteratorNormalCompletion = true;
                _context.next = 9;
                break;

              case 27:
                _context.next = 33;
                break;

              case 29:
                _context.prev = 29;
                _context.t1 = _context["catch"](7);
                _didIteratorError = true;
                _iteratorError = _context.t1;

              case 33:
                _context.prev = 33;
                _context.prev = 34;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 36:
                _context.prev = 36;

                if (!_didIteratorError) {
                  _context.next = 39;
                  break;
                }

                throw _iteratorError;

              case 39:
                return _context.finish(36);

              case 40:
                return _context.finish(33);

              case 41:
                return _context.abrupt("return", results);

              case 42:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this, [[7, 29, 33, 41], [14, 21], [34,, 36, 40]]);
      }));

      function searchInAllPackages(_x) {
        return _ref.apply(this, arguments);
      }

      return searchInAllPackages;
    }()

    // -=-=-=-=-
    // testing
    // -=-=-=-=-

  }, {
    key: "loadMochaTestFile",
    value: function loadMochaTestFile(file, testsByFile) {
      return this.coreInterface.loadMochaTestFile(file, testsByFile);
    }
  }, {
    key: "runMochaTests",
    value: function runMochaTests(grep, testsByFile, onChange, onError) {
      return this.coreInterface.runMochaTests(grep, testsByFile, onChange, onError);
    }
  }, {
    key: "isSystemInterface",
    get: function get() {
      return true;
    }
  }, {
    key: "name",
    get: function get() {
      return this.coreInterface.name;
    }
  }]);
  return Interface;
}();

var localInterface = new Interface(new LocalCoreInterface());

exports.Interface = Interface;
exports.localInterface = localInterface;

}((this.lively.systemInterface = this.lively.systemInterface || {}),lively.ast,lively.lang,lively.resources,lively.modules,lively.vm));

  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.lively.systemInterface;
})();