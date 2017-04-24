(function() {
  /*!
 * Bowser - a browser detector
 * https://github.com/ded/bowser
 * MIT License | (c) Dustin Diaz 2015
 */
!function(e,t,n){typeof module!="undefined"&&module.exports?module.exports=n():typeof define=="function"&&define.amd?define(t,n):e[t]=n()}(this,"bowser",function(){function t(t){function n(e){var n=t.match(e);return n&&n.length>1&&n[1]||""}function r(e){var n=t.match(e);return n&&n.length>1&&n[2]||""}var i=n(/(ipod|iphone|ipad)/i).toLowerCase(),s=/like android/i.test(t),o=!s&&/android/i.test(t),u=/nexus\s*[0-6]\s*/i.test(t),a=!u&&/nexus\s*[0-9]+/i.test(t),f=/CrOS/.test(t),l=/silk/i.test(t),c=/sailfish/i.test(t),h=/tizen/i.test(t),p=/(web|hpw)os/i.test(t),d=/windows phone/i.test(t),v=/SamsungBrowser/i.test(t),m=!d&&/windows/i.test(t),g=!i&&!l&&/macintosh/i.test(t),y=!o&&!c&&!h&&!p&&/linux/i.test(t),b=n(/edge\/(\d+(\.\d+)?)/i),w=n(/version\/(\d+(\.\d+)?)/i),E=/tablet/i.test(t),S=!E&&/[^-]mobi/i.test(t),x=/xbox/i.test(t),T;/opera/i.test(t)?T={name:"Opera",opera:e,version:w||n(/(?:opera|opr|opios)[\s\/](\d+(\.\d+)?)/i)}:/opr|opios/i.test(t)?T={name:"Opera",opera:e,version:n(/(?:opr|opios)[\s\/](\d+(\.\d+)?)/i)||w}:/SamsungBrowser/i.test(t)?T={name:"Samsung Internet for Android",samsungBrowser:e,version:w||n(/(?:SamsungBrowser)[\s\/](\d+(\.\d+)?)/i)}:/coast/i.test(t)?T={name:"Opera Coast",coast:e,version:w||n(/(?:coast)[\s\/](\d+(\.\d+)?)/i)}:/yabrowser/i.test(t)?T={name:"Yandex Browser",yandexbrowser:e,version:w||n(/(?:yabrowser)[\s\/](\d+(\.\d+)?)/i)}:/ucbrowser/i.test(t)?T={name:"UC Browser",ucbrowser:e,version:n(/(?:ucbrowser)[\s\/](\d+(?:\.\d+)+)/i)}:/mxios/i.test(t)?T={name:"Maxthon",maxthon:e,version:n(/(?:mxios)[\s\/](\d+(?:\.\d+)+)/i)}:/epiphany/i.test(t)?T={name:"Epiphany",epiphany:e,version:n(/(?:epiphany)[\s\/](\d+(?:\.\d+)+)/i)}:/puffin/i.test(t)?T={name:"Puffin",puffin:e,version:n(/(?:puffin)[\s\/](\d+(?:\.\d+)?)/i)}:/sleipnir/i.test(t)?T={name:"Sleipnir",sleipnir:e,version:n(/(?:sleipnir)[\s\/](\d+(?:\.\d+)+)/i)}:/k-meleon/i.test(t)?T={name:"K-Meleon",kMeleon:e,version:n(/(?:k-meleon)[\s\/](\d+(?:\.\d+)+)/i)}:d?(T={name:"Windows Phone",windowsphone:e},b?(T.msedge=e,T.version=b):(T.msie=e,T.version=n(/iemobile\/(\d+(\.\d+)?)/i))):/msie|trident/i.test(t)?T={name:"Internet Explorer",msie:e,version:n(/(?:msie |rv:)(\d+(\.\d+)?)/i)}:f?T={name:"Chrome",chromeos:e,chromeBook:e,chrome:e,version:n(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)}:/chrome.+? edge/i.test(t)?T={name:"Microsoft Edge",msedge:e,version:b}:/vivaldi/i.test(t)?T={name:"Vivaldi",vivaldi:e,version:n(/vivaldi\/(\d+(\.\d+)?)/i)||w}:c?T={name:"Sailfish",sailfish:e,version:n(/sailfish\s?browser\/(\d+(\.\d+)?)/i)}:/seamonkey\//i.test(t)?T={name:"SeaMonkey",seamonkey:e,version:n(/seamonkey\/(\d+(\.\d+)?)/i)}:/firefox|iceweasel|fxios/i.test(t)?(T={name:"Firefox",firefox:e,version:n(/(?:firefox|iceweasel|fxios)[ \/](\d+(\.\d+)?)/i)},/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(t)&&(T.firefoxos=e)):l?T={name:"Amazon Silk",silk:e,version:n(/silk\/(\d+(\.\d+)?)/i)}:/phantom/i.test(t)?T={name:"PhantomJS",phantom:e,version:n(/phantomjs\/(\d+(\.\d+)?)/i)}:/slimerjs/i.test(t)?T={name:"SlimerJS",slimer:e,version:n(/slimerjs\/(\d+(\.\d+)?)/i)}:/blackberry|\bbb\d+/i.test(t)||/rim\stablet/i.test(t)?T={name:"BlackBerry",blackberry:e,version:w||n(/blackberry[\d]+\/(\d+(\.\d+)?)/i)}:p?(T={name:"WebOS",webos:e,version:w||n(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i)},/touchpad\//i.test(t)&&(T.touchpad=e)):/bada/i.test(t)?T={name:"Bada",bada:e,version:n(/dolfin\/(\d+(\.\d+)?)/i)}:h?T={name:"Tizen",tizen:e,version:n(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i)||w}:/qupzilla/i.test(t)?T={name:"QupZilla",qupzilla:e,version:n(/(?:qupzilla)[\s\/](\d+(?:\.\d+)+)/i)||w}:/chromium/i.test(t)?T={name:"Chromium",chromium:e,version:n(/(?:chromium)[\s\/](\d+(?:\.\d+)?)/i)||w}:/chrome|crios|crmo/i.test(t)?T={name:"Chrome",chrome:e,version:n(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)}:o?T={name:"Android",version:w}:/safari|applewebkit/i.test(t)?(T={name:"Safari",safari:e},w&&(T.version=w)):i?(T={name:i=="iphone"?"iPhone":i=="ipad"?"iPad":"iPod"},w&&(T.version=w)):/googlebot/i.test(t)?T={name:"Googlebot",googlebot:e,version:n(/googlebot\/(\d+(\.\d+))/i)||w}:T={name:n(/^(.*)\/(.*) /),version:r(/^(.*)\/(.*) /)},!T.msedge&&/(apple)?webkit/i.test(t)?(/(apple)?webkit\/537\.36/i.test(t)?(T.name=T.name||"Blink",T.blink=e):(T.name=T.name||"Webkit",T.webkit=e),!T.version&&w&&(T.version=w)):!T.opera&&/gecko\//i.test(t)&&(T.name=T.name||"Gecko",T.gecko=e,T.version=T.version||n(/gecko\/(\d+(\.\d+)?)/i)),!T.windowsphone&&!T.msedge&&(o||T.silk)?T.android=e:!T.windowsphone&&!T.msedge&&i?(T[i]=e,T.ios=e):g?T.mac=e:x?T.xbox=e:m?T.windows=e:y&&(T.linux=e);var N="";T.windowsphone?N=n(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i):i?(N=n(/os (\d+([_\s]\d+)*) like mac os x/i),N=N.replace(/[_\s]/g,".")):o?N=n(/android[ \/-](\d+(\.\d+)*)/i):T.webos?N=n(/(?:web|hpw)os\/(\d+(\.\d+)*)/i):T.blackberry?N=n(/rim\stablet\sos\s(\d+(\.\d+)*)/i):T.bada?N=n(/bada\/(\d+(\.\d+)*)/i):T.tizen&&(N=n(/tizen[\/\s](\d+(\.\d+)*)/i)),N&&(T.osversion=N);var C=N.split(".")[0];if(E||a||i=="ipad"||o&&(C==3||C>=4&&!S)||T.silk)T.tablet=e;else if(S||i=="iphone"||i=="ipod"||o||u||T.blackberry||T.webos||T.bada)T.mobile=e;return T.msedge||T.msie&&T.version>=10||T.yandexbrowser&&T.version>=15||T.vivaldi&&T.version>=1||T.chrome&&T.version>=20||T.samsungBrowser&&T.version>=4||T.firefox&&T.version>=20||T.safari&&T.version>=6||T.opera&&T.version>=10||T.ios&&T.osversion&&T.osversion.split(".")[0]>=6||T.blackberry&&T.version>=10.1||T.chromium&&T.version>=20?T.a=e:T.msie&&T.version<10||T.chrome&&T.version<20||T.firefox&&T.version<20||T.safari&&T.version<6||T.opera&&T.version<10||T.ios&&T.osversion&&T.osversion.split(".")[0]<6||T.chromium&&T.version<20?T.c=e:T.x=e,T}function r(e){return e.split(".").length}function i(e,t){var n=[],r;if(Array.prototype.map)return Array.prototype.map.call(e,t);for(r=0;r<e.length;r++)n.push(t(e[r]));return n}function s(e){var t=Math.max(r(e[0]),r(e[1])),n=i(e,function(e){var n=t-r(e);return e+=(new Array(n+1)).join(".0"),i(e.split("."),function(e){return(new Array(20-e.length)).join("0")+e}).reverse()});while(--t>=0){if(n[0][t]>n[1][t])return 1;if(n[0][t]!==n[1][t])return-1;if(t===0)return 0}}function o(e,r,i){var o=n;typeof r=="string"&&(i=r,r=void 0),r===void 0&&(r=!1),i&&(o=t(i));var u=""+o.version;for(var a in e)if(e.hasOwnProperty(a)&&o[a]){if(typeof e[a]!="string")throw new Error("Browser version in the minVersion map should be a string: "+a+": "+String(e));return s([u,e[a]])<0}return r}function u(e,t,n){return!o(e,t,n)}var e=!0,n=t(typeof navigator!="undefined"?navigator.userAgent||"":"");return n.test=function(e){for(var t=0;t<e.length;++t){var r=e[t];if(typeof r=="string"&&r in n)return!0}return!1},n.isUnsupportedBrowser=o,n.compareVersions=s,n.check=u,n._detect=t,n})

  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,bowser) {
'use strict';

bowser = 'default' in bowser ? bowser['default'] : bowser;

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





var defineProperty = function (obj$$1, key, value) {
  if (key in obj$$1) {
    Object.defineProperty(obj$$1, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj$$1[key] = value;
  }

  return obj$$1;
};

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

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
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















var toConsumableArray = function (arr$$1) {
  if (Array.isArray(arr$$1)) {
    for (var i = 0, arr2 = Array(arr$$1.length); i < arr$$1.length; i++) arr2[i] = arr$$1[i];

    return arr2;
  } else {
    return Array.from(arr$$1);
  }
};

function printArg(x) {
  return lively_lang.obj.inspect(x, { maxDepth: 1 }).replace(/\n/g, "").replace(/\s+/g, " ");
}

var CommandHandler = function () {
  function CommandHandler() {
    classCallCheck(this, CommandHandler);

    this.history = [];
    this.maxHistorySize = 300;
  }

  createClass(CommandHandler, [{
    key: "addToHistory",
    value: function addToHistory(cmdName) {
      this.history.push(cmdName);
      if (this.history.length > this.maxHistorySize) this.history.splice(0, this.history.length - this.maxHistorySize);
    }
  }, {
    key: "printHistory",
    value: function printHistory() {
      return this.history.map(function (_ref) {
        var name = _ref.name,
            targetName = _ref.target.string,
            args = _ref.args,
            count = _ref.count;
        return name + " " + (args ? printArg(args) : "") + (typeof count === "number" ? " x" + count : "") + " " + targetName;
      }).join("\n");
    }
  }, {
    key: "lookupCommand",
    value: function lookupCommand(commandOrName, morph) {
      var name, command;

      if (!commandOrName) return {};

      if (typeof commandOrName === "string") name = commandOrName;
      if (typeof commandOrName.command === "string") name = commandOrName.command;

      if (commandOrName.exec) {
        command = commandOrName;
        name = command.name;
      }

      if (!command) command = morph.commands.find(function (ea) {
        return ea.name === name;
      });
      return { name: name, command: command };
    }
  }, {
    key: "exec",
    value: function exec(commandOrName, morph, args, count, evt) {
      var _this = this;

      // commandOrName can be
      // 1. a string, naming a command in morphs.commands
      // 2. a spec object like {command: "cmd name", args: {...}, handlesCount: BOOL, }
      // 3. a proper command object {name: STRING, exec: FUNCTION, ....}
      var _ref2 = this.lookupCommand(commandOrName, morph) || {},
          name = _ref2.name,
          command = _ref2.command;

      if (!command) {
        console.warn("Cannot find command " + (name || commandOrName));
        return null;
      }

      name && this.addToHistory({ name: name, target: { string: String(morph), id: morph.id }, args: args, count: count, time: Date.now() });

      var world = morph.world(),
          result;

      if (typeof command.exec === "function") {
        try {
          result = command.exec(morph, args, command.handlesCount ? count : undefined, evt);
        } catch (err) {
          result = err;
          var msg = "Error in interactive command " + name + ": " + (err.stack || err);
          world ? world.logError(msg) : console.error(msg);
        }
      } else {
        console.error("command " + name + " has no exec function!");
      }

      // to not swallow errors
      if (result && typeof result.catch === "function") {
        result.catch(function (err) {
          var msg = "Error in interactive command " + name + ": " + err + "\n" + (err.stack || err);
          world ? world.logError(msg) : console.error(msg);
          throw err;
        });
      }

      // handle count by repeating command
      if (result && typeof count === "number" && count > 1 && !command.handlesCount) {
        result = typeof result.then === "function" ? result.then(function () {
          return _this.exec(command, morph, args, count - 1, evt, null);
        }) : this.exec(command, morph, args, count - 1, evt, null);
      }

      return result;
    }
  }]);
  return CommandHandler;
}();

var letterRe = /[a-z]/i;

function computeHashIdOfEvent(evt) {
  var key = evt.key,
      ctrlKey = evt.ctrlKey,
      altKey = evt.altKey,
      shiftKey = evt.shiftKey,
      metaKey = evt.metaKey,
      hashId = 0 | (ctrlKey ? 1 : 0) | (altKey ? 2 : 0) | (shiftKey ? 4 : 0) | (metaKey ? 8 : 0);


  if (hashId === 0 && !canonicalizeFunctionKey(key) && key && letterRe.test(key)) hashId = -1;

  return hashId;
}

var KEY_MODS = function () {
  var base = {
    "control": 1, "ctrl": 1, "alt": 2, "option": 2, "shift": 4,
    "super": 8, "win": 8, "meta": 8, "command": 8, "cmd": 8
  };

  var mods = ["alt", "ctrl", "meta", "shift"];
  for (var i = Math.pow(2, mods.length); i--;) {
    base[i] = mods.filter(function (x) {
      return i & base[x];
    }).join("-") + "-";
  }base[0] = "";
  base[-1] = "input-";

  return base;
}();

var isNumber = function () {
  var numberRe = /^[0-9]+$/;
  return function (key) {
    return numberRe.test(key);
  };
}();

function isModifier(key) {
  if (isNumber(key)) return false;
  key = key.replace(/-$/, "").toLowerCase();
  return lively_lang.arr.withoutAll(Object.keys(KEY_MODS), ["", "input-"]).includes(key);
}

var FUNCTION_KEYS = ["backspace", "tab", "enter", "pause", "escape", " ", "pageup", "pagedown", "end", "home", "left", "up", "right", "down", "print", "insert", "delete", "numpad0", "numpad1", "numpad2", "numpad3", "numpad4", "numpad5", "numpad6", "numpad7", "numpad8", "numpad9", "numpadenter", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12", "numlock", "scrolllock"];

function canonicalizeFunctionKey(key) {
  key = key.toLowerCase();
  switch (key) {
    case 'space':
      key = "space";break;
    case 'esc':
      key = "escape";break;
    case 'return':
      key = "enter";break;
    case 'arrowleft':
      key = "left";break;
    case 'arrowright':
      key = "right";break;
    case 'arrowup':
      key = "up";break;
    case 'arrowdown':
      key = "down";break;
    case 'esc':
      key = "escape";break;
    case 'return':
      key = "enter";break;
  }

  return FUNCTION_KEYS.includes(key) ? lively_lang.string.capitalize(key) : "";
}

function decodeKeyIdentifier(identifier, keyCode) {
  // trying to find out what the String representation of the key pressed
  // in key event is.
  // Uses keyIdentifier which can be Unicode like "U+0021"

  var id = identifier,
      unicodeDecodeRe = /u\+?([\d\w]{4})/gi,
      unicodeReplacer = function unicodeReplacer(match, grp) {
    return String.fromCharCode(parseInt(grp, 16));
  },
      key = id && id.replace(unicodeDecodeRe, unicodeReplacer);

  if (key === 'Command' || key === 'Cmd') key = "Meta";
  if (key === ' ') key = "Space";
  if (keyCode === 8 /*KEY_BACKSPACE*/) key = "Backspace";
  return key;
}

function identifyKeyFromCode(_ref) {
  var code = _ref.code;

  // works on Chrome and Safari
  // https://developer.mozilla.org/en/docs/Web/API/KeyboardEvent/code
  // For certain inputs evt.key or keyCode will return the inserted char, not
  // the key pressed. For keybindings it is nicer to have the actual key,
  // however

  if (typeof code !== "string") return null;

  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Numpad")) return code;
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code.match(/^F[0-9]{1-2}$/)) return code;

  switch (code) {
    case "Insert":
    case "Home":
    case "PageUp":
    case "PageDown":
      return code;
    case 'Period':
      return ".";
    case 'Comma':
      return ",";
    case 'Help':
      return "Insert";
    case 'Equal':
      return "=";
    case 'Backslash':
    case 'IntlBackslash':
      return "\\";
    case 'Equal':
      return "=";
    case "Minus":
      return "-";
    case "BracketRight":
      return "]";
    case "BracketLeft":
      return "[";
    case "Quote":
      return "'";
    case 'Backquote':
      return "`";
    case 'Semicolon':
      return ";";
  }

  return null;
}

function dedasherize(keyCombo) {
  // splits string like Meta-x or Ctrl-- into its parts
  // dedasherize("Ctrl--") => ["Ctrl", "-"]
  var parts = [];
  while (true) {
    var idx = keyCombo.indexOf("-");
    if (idx === -1) {
      if (keyCombo) parts.push(keyCombo);
      return parts;
    }
    if (idx === 0) {
      parts.push(keyCombo[0]);
      keyCombo = keyCombo.slice(2);
    } else {
      parts.push(keyCombo.slice(0, idx));
      keyCombo = keyCombo.slice(idx + 1);
    }
  }
}

var Keys = {

  computeHashIdOfEvent: computeHashIdOfEvent,

  keyComboToEventSpec: function keyComboToEventSpec(keyCombo, flags) {
    // keyCombo = "Enter"
    // key sth like alt-f, output an keyevent-like object

    // 1. create a key event object. We first gather what properties need to be
    // passed to the event creator in terms of the keyboard state

    var spec = _extends({
      _isLivelyKeyEventSpec: true,
      keyCombo: "",
      key: '',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      altGraphKey: false,
      isFunctionKey: false,
      isModified: false,
      onlyModifiers: false
    }, flags);

    // 2. Are any modifier keys pressed?
    var keyMods = dedasherize(keyCombo),
        modsToEvent = {
      shift: "shiftKey",
      control: "ctrlKey",
      ctrl: "ctrlKey",
      alt: "altKey",
      meta: "metaKey",
      command: "metaKey",
      cmd: "metaKey"
    };

    // input event
    if (keyMods[0] === "input" && keyMods.length === 2) {
      spec.keyCombo = keyCombo;
      spec.key = keyMods[1];
      return spec;
    }

    for (var i = keyMods.length - 1; i >= 0; i--) {
      var mod = keyMods[i],
          modEventFlag = modsToEvent[mod.toLowerCase()];
      if (!modEventFlag) continue;
      keyMods.splice(i, 1);
      spec.isModified = true;
      spec[modEventFlag] = true;
    }

    // only modifiers
    if (!keyMods.length) {
      spec.keyCombo = Keys.eventToKeyCombo(spec);
      spec.key = lively_lang.arr.last(dedasherize(spec.keyCombo));
      spec.onlyModifiers = true;
      return spec;
    }

    if (keyMods.length > 1) {
      console.warn("Strange key \"" + keyCombo + "\" encountered in keyComboToEventSpec, parsing probably failed");
    }

    var trailing = lively_lang.arr.last(keyMods);

    // 3. determine the key code and key string of the event.
    var fnKey = canonicalizeFunctionKey(trailing);
    if (fnKey) {
      spec.isFunctionKey = true;
      spec.key = fnKey;
    } else if (spec.isModified) {
      spec.key = lively_lang.string.capitalize(trailing);
    } else {
      spec.key = trailing;
    }

    spec.keyCombo = Keys.eventToKeyCombo(spec);
    return spec;
  },
  eventToKeyCombo: function eventToKeyCombo(evt, options) {
    // var evt = Keys.keyComboToEventSpec("Enter")
    // var evt = {type: "keydown", keyIdentifier: "Meta"}
    // Keys.eventToKeyCombo(x)
    // stringify event to a key or key combo
    var _ignoreModifiersIfNoC = _extends({
      ignoreModifiersIfNoCombo: false,
      ignoreKeys: [] }, options),
        ignoreModifiersIfNoCombo = _ignoreModifiersIfNoC.ignoreModifiersIfNoCombo,
        ignoreKeys = _ignoreModifiersIfNoC.ignoreKeys;

    var key = evt.key,
        data = evt.data,
        keyIdentifier = evt.keyIdentifier;

    // deal with input events: They are considered coming from verbatim key
    // presses which might not be real but we maintain the data this way

    if (typeof data === "string") return "input-" + data;

    // fallback to keyIdentifier for Safari...
    if (!key && keyIdentifier) {
      key = decodeKeyIdentifier(keyIdentifier, evt.which || evt.keyCode);
      evt.key = key = key[evt.shiftKey ? "toUpperCase" : "toLowerCase"]();
      if (isModifier(key)) return lively_lang.string.capitalize(key);
    }

    var mod = KEY_MODS[computeHashIdOfEvent(evt)];

    if (mod === "input-") return mod + key;

    if (evt.code) key = identifyKeyFromCode(evt) || key;

    var keyCombo = !key || isModifier(key) ? mod.replace(/-$/, "") : mod + key;

    if (keyCombo.match(/\s$/)) keyCombo = keyCombo.replace(/\s$/, "Space");

    return keyCombo.replace(/(^|-)([a-z])/g, function (_, start, char) {
      return start + char.toUpperCase();
    });
  },
  canonicalizeKeyCombo: function canonicalizeKeyCombo(string$$1) {
    return Keys.eventToKeyCombo(Keys.keyComboToEventSpec(string$$1));
  },
  canonicalizeEvent: function canonicalizeEvent(evt) {
    return evt._isLivelyKeyEventSpec ? evt : Keys.keyComboToEventSpec(Keys.eventToKeyCombo(evt));
  }
};

var _simulateKeys = function () {
  var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(morph, keyComboString) {
    var keyInputState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : { keyChain: undefined, count: undefined };

    var pressedKeys, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, keys;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // keyComboString like "a b ctrl-c"
            // there can be multiple pressed keys separated by spaces. To simulate a
            // space press use a double space. split up the individual keys and
            // simulate each
            pressedKeys = keyComboString.length === 1 ? [keyComboString] : keyComboString.split(/ /g).map(ensureSpaces);
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 4;
            _iterator = pressedKeys[Symbol.iterator]();

          case 6:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context.next = 13;
              break;
            }

            keys = _step.value;
            _context.next = 10;
            return simulateKey(morph, keys, keyInputState);

          case 10:
            _iteratorNormalCompletion = true;
            _context.next = 6;
            break;

          case 13:
            _context.next = 19;
            break;

          case 15:
            _context.prev = 15;
            _context.t0 = _context["catch"](4);
            _didIteratorError = true;
            _iteratorError = _context.t0;

          case 19:
            _context.prev = 19;
            _context.prev = 20;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 22:
            _context.prev = 22;

            if (!_didIteratorError) {
              _context.next = 25;
              break;
            }

            throw _iteratorError;

          case 25:
            return _context.finish(22);

          case 26:
            return _context.finish(19);

          case 27:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[4, 15, 19, 27], [20,, 22, 26]]);
  }));

  return function _simulateKeys(_x2, _x3) {
    return _ref.apply(this, arguments);
  };
}();

function ensureSpaces(s) {
  return s.length ? s : ' ';
}

function _invokeKeyHandlers(target, evt) {
  var noInputEvents = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  evt = Keys.canonicalizeEvent(evt);

  var _evt = evt,
      keyCombo = _evt.keyCombo,
      key = _evt.key,
      data = _evt.data,
      toExecute = void 0,
      executed = false,
      keyhandlers = target.keyhandlers,
      keyInputState = evt.keyInputState || {},
      isInputEvent = keyCombo.startsWith("input-"),
      nullCommand = false,
      carryOverCount = keyInputState.count,
      carryOverKeyChain = keyInputState.keyChain || "",
      keyInputStateNeedsUpdate = false;


  if (!keyhandlers || noInputEvents && isInputEvent) return false;

  for (var i = keyhandlers.length; i--;) {
    toExecute = keyhandlers[i].eventCommandLookup(target, evt);

    if (!toExecute || !toExecute.command) continue;

    var _toExecute = toExecute,
        command = _toExecute.command,
        args = _toExecute.args,
        passEvent = _toExecute.passEvent,
        _count = _toExecute.count,
        keyChain = _toExecute.keyChain,
        onlyWhenFocused = _toExecute.onlyWhenFocused;

    // carry count and keychain along, either to be used in the command lookup
    // + execute process, or if there is no command (keyCombo is part of a key
    // chain) then update the keyInputState accordingly so that count/keyChain are
    // remembered when the next event is processed

    keyInputStateNeedsUpdate = true;
    carryOverCount = _count;
    carryOverKeyChain = keyChain;

    nullCommand = command === "null"; // "null"... is there something better?!

    if (onlyWhenFocused) {
      var world = target.world();
      if (world && world.focusedMorph && world.focusedMorph !== target) continue;
    }

    executed = nullCommand ? false : target.execCommand(command, args, _count, evt);

    // do not stop input events to not break repeating
    if (executed && (!isInputEvent || command !== "insertstring") && !passEvent && typeof evt.stop === "function") evt.stop();

    if (executed || nullCommand) break;
  }

  if (!executed && !nullCommand && isInputEvent && target.onTextInput && !carryOverKeyChain) {
    var count = keyInputState.count;
    executed = target.execCommand("insertstring", {
      string: data || key,
      // undoGroup: config.text.undoGroupDelay/*ms*/
      undoGroup: 600 /*ms*/
    }, count, evt);
  }

  if (keyInputStateNeedsUpdate) {
    // delay setting the new keyInputState to allow all target morphs to
    // handle key, this is necessary when multiple morphs share the same
    // keyChain prefixes
    // keyInputState.count = carryOverCount;
    if (typeof evt.onAfterDispatch === "function") {
      evt.onAfterDispatch(function () {
        keyInputState.count = executed ? undefined : carryOverCount;
        keyInputState.keyChain = executed ? "" : carryOverKeyChain;
      });
    } else {
      keyInputState.count = executed ? undefined : carryOverCount;
      keyInputState.keyChain = executed ? "" : carryOverKeyChain;
    }
  }

  // when isKeyChainPrefix was detected, do not return a truthy value so that
  // submorphs that might also be the event target can process the evt as well.
  // This is necessary to allow for shared keyChain prefixes in multiple morphs,
  // sth like "Ctrl-X D" in the world and "Ctrl-X Ctrl-X" in a text morph.
  return executed && !nullCommand;
}

function simulateKey(morph, keyComboString, keyInputState) {
  return _invokeKeyHandlers(morph, _extends({}, Keys.keyComboToEventSpec(keyComboString), { keyInputState: keyInputState }));
}

function bowserOS() {
  // if (bowser.mac)          return "windows";
  if (bowser.mac) return "mac";
  if (bowser.windows) return "windows";
  if (bowser.windowsphone) return "windowsphone";
  if (bowser.linux) return "linux";
  if (bowser.chromeos) return "chromeos";
  if (bowser.android) return "android";
  if (bowser.ios) return "ios";
  if (bowser.blackberry) return "blackberry";
  if (bowser.firefoxos) return "firefoxos";
  if (bowser.webos) return "webos";
  if (bowser.bada) return "bada";
  if (bowser.tizen) return "tizen";
  if (bowser.sailfish) return "sailfish";
  // console.error(`bowserOS detection, unknown OS!`, bowser);
  return "unknown";
}

function findKeysForPlatform(binding, platform /*bowser OS flag*/) {
  // bowser OS flags 2016-08-24:
  // bowser
  // mac
  // windows - other than Windows Phone
  // windowsphone
  // linux - other than android, chromeos, webos, tizen, and sailfish
  // chromeos
  // android
  // ios - also sets one of iphone/ipad/ipod
  // blackberry
  // firefoxos
  // webos - may also set touchpad
  // bada
  // tizen
  // sailfish

  if (typeof binding === "string") return binding;

  if (!binding || (typeof binding === "undefined" ? "undefined" : _typeof(binding)) !== "object") return null;

  switch (platform) {
    case 'ios':
      return binding.ios || binding.mac;
    case 'mac':
      return binding.mac || binding.ios;
    case 'win':
    case 'windows':
    case 'windowsphone':
      return binding.win || binding.windows;
    case 'linux':
      return binding.linux || binding.win || binding.windows;
    case 'chromeos':
      return binding.chromeos || binding.linux || binding.win || binding.windows;
    case 'android':
      return binding.android || binding.linux || binding.win || binding.windows;
    default:
      return binding.linux || binding.win || binding.windows;
  }
}

var regexps = {
  meta: /Meta|Cmd|Command/gi,
  alt: /Alt/gi,
  ctrl: /Ctrl|Control/gi,
  tab: /Tab/gi,
  enter: /Enter|Return/gi,
  shift: /Shift/gi,
  backspace: /Backspace/gi,
  delete: /del(ete)?/gi,
  left: /left/gi,
  right: /right/gi,
  up: /up/gi,
  down: /down/gi,
  keySpacer: /([^-])-/g,
  seqSpacer: /([^\s])\s/g
};

var KeyHandler = function () {
  createClass(KeyHandler, null, [{
    key: "invokeKeyHandlers",
    value: function invokeKeyHandlers(morph, evt) {
      var noInputEvents = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      return _invokeKeyHandlers(morph, evt, noInputEvents);
    }
  }, {
    key: "simulateKeys",
    value: function simulateKeys(morph, keyCombo, keyInputState) {
      return _simulateKeys(morph, keyCombo, keyInputState);
    }
  }, {
    key: "withBindings",
    value: function withBindings(listOfBindings, platform) {
      // listOfBindings is a list of objects that should have at least fields keys and command
      // e.g. {keys: "Ctrl-A", command: "selectall"}
      // you can make platform specific bindings like
      // {keys: {mac: "Meta-A", win: "Ctrl-A"}, command: "selectall"}
      // command can be an object specifying additional properties like "args"
      // that are being passed to the command handler when the command is executed,
      // e.g. {command: {command: "goto line start", args: {select: true}}, keys: "Shift-Home"}
      var handler = new this(platform);
      listOfBindings.forEach(function (_ref2) {
        var command = _ref2.command,
            keys = _ref2.keys;
        return handler.bindKey(keys, command);
      });
      return handler;
    }
  }, {
    key: "prettyCombo",
    value: function prettyCombo(combo) {
      var map = this._prettyCombos || (this._prettyCombos = {});
      if (this._prettyCombos[combo]) return map[combo];
      return map[combo] = combo.replace(regexps.meta, "⌘").replace(regexps.alt, "⌥").replace(regexps.ctrl, "⌃").replace(regexps.tab, "⇥").replace(regexps.enter, "⏎").replace(regexps.shift, "⇧").replace(regexps.backspace, "⌫").replace(regexps.delete, "⌦").replace(regexps.left, "→").replace(regexps.right, "←").replace(regexps.up, "↑").replace(regexps.down, "↓").replace(regexps.keySpacer, "$1").replace(regexps.seqSpacer, "$1-");
    }
  }, {
    key: "generateCommandToKeybindingMap",
    value: function generateCommandToKeybindingMap(morph) {
      var _this = this;

      var includeOwnerCommands = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var prettyKeys = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

      var keyMaps = {},
          commandsToKeys = {},
          commands = includeOwnerCommands ? morph.commandsIncludingOwners || [] : morph.commands.map(function (command) {
        return { command: command, target: morph };
      });

      return commands.map(function (_ref3) {
        var target = _ref3.target,
            command = _ref3.command;

        var keys = commandsToKeysFor(target)[command.name];
        return {
          keys: keys,
          target: target, command: command,
          prettyKeys: keys && prettyKeys ? keys.map(function (ea) {
            return _this.prettyCombo(ea);
          }) : null
        };
      });

      function commandsToKeysFor(target) {
        if (commandsToKeys[target.id]) return commandsToKeys[target.id];
        var keyMap = keyMaps[target.id] || (keyMaps[target.id] = target.keyCommandMap);
        return commandsToKeys[target.id] = lively_lang.arr.groupBy(Object.keys(keyMap), function (combo) {
          return keyMap[combo].name;
        });
      }
    }
  }]);

  function KeyHandler() {
    var platform = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : bowserOS();
    classCallCheck(this, KeyHandler);

    this.platform = platform;
    this.keyBindings = {};
  }

  createClass(KeyHandler, [{
    key: "eventCommandLookup",
    value: function eventCommandLookup(morph, evt) {
      var keyCombo = evt.keyCombo,
          keyInputState = evt.keyInputState;

      return this.lookup(keyCombo, keyInputState);
    }
  }, {
    key: "lookup",
    value: function lookup(keyCombo) {
      var _this2 = this;

      var keyInputState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { keyChain: undefined, count: undefined };

      // tries to find suitable command name or object for keyCombo in
      // this.keyBindings. Uses keyInputState for keychains.
      keyCombo = Keys.canonicalizeKeyCombo(keyCombo);

      var keyChain = keyInputState.keyChain || "",
          count = keyInputState.count;

      if (!keyChain && keyCombo.startsWith("Ctrl-")) {
        var countMatch = keyCombo.match(/^Ctrl-([0-9]+)/);
        if (countMatch) {
          var numArg = parseInt((typeof count === "number" ? count : "") + countMatch[1]);
          return { command: "null", count: numArg };
        }
        // universal argument
        if (keyCombo === "Ctrl-U") return { command: "null", count: 4, keyChain: "Ctrl-U" };
      }

      // for simple input test both upper and lowercase
      var combos = [keyCombo];
      if (!command && keyCombo.startsWith("input-")) {
        var upper = keyCombo.replace(/^(input-)(.*)$/, function (_, before, key) {
          return before + key.toUpperCase();
        }),
            lower = keyCombo.replace(/^(input-)(.*)$/, function (_, before, key) {
          return before + key.toLowerCase();
        });
        if (!combos.includes(upper)) combos.push(upper);
        if (!combos.includes(lower)) combos.push(lower);
      }

      var command = lively_lang.arr.findAndGet(combos, function (keyCombo) {
        return _this2.keyBindings[keyCombo];
      });

      if (keyChain) {
        var chainCombo = combos.find(function (keyCombo) {
          return _this2.keyBindings[keyChain + " " + keyCombo];
        });
        if (chainCombo) {
          keyChain += " " + chainCombo;
          command = this.keyBindings[keyChain] || command;
        }
      }

      if (command && command === "chainKeys") {
        keyChain = keyChain || keyCombo;
        var result = { command: "null", keyChain: keyChain };
        if (count !== undefined) result.count = count;
        return result;
      }

      if (!command) return undefined;
      var result = (typeof command === "undefined" ? "undefined" : _typeof(command)) === "object" ? _extends({}, command) : { command: command };
      if (count !== undefined) result.count = count;
      return result;
    }
  }, {
    key: "bindKey",
    value: function bindKey(keyCombo, command) {
      var _this3 = this;

      if ((typeof keyCombo === "undefined" ? "undefined" : _typeof(keyCombo)) == "object" && keyCombo && !Array.isArray(keyCombo)) keyCombo = findKeysForPlatform(keyCombo, this.platform);

      if (!keyCombo) return;

      if (typeof command == "function") return this.addCommand({ exec: command, bindKey: keyCombo, name: command.name || keyCombo });

      var allCombos = Array.isArray(keyCombo) ? keyCombo : keyCombo.includes("|") ? keyCombo.split("|") : [keyCombo];

      allCombos.forEach(function (keyPart) {
        var chain = "";
        if (keyPart.indexOf(" ") != -1) {
          var parts = keyPart.split(/\s+/);
          keyPart = parts.pop();
          parts.forEach(function (keyPart) {
            var binding = Keys.canonicalizeKeyCombo(keyPart);
            chain += (chain ? " " : "") + binding;
            _this3.addCommandToBinding(chain, "chainKeys");
          });
          chain += " ";
        }

        _this3.addCommandToBinding(chain + Keys.canonicalizeKeyCombo(keyPart), command);
      });

      this.cleanupUnusedKeyChains();
    }
  }, {
    key: "unbindKey",
    value: function unbindKey(keyCombo) {
      this.bindKey(keyCombo, null);
    }
  }, {
    key: "cleanupUnusedKeyChains",
    value: function cleanupUnusedKeyChains() {
      var _this4 = this;

      var keys = Object.keys(this.keyBindings),
          chainedKeys = keys.filter(function (key) {
        return _this4.keyBindings[key] === "chainKeys";
      });
      chainedKeys = lively_lang.arr.sortBy(chainedKeys, function (ea) {
        return ea.length;
      }).reverse();
      // remove all chainKeys bindings that doesn't point to a real binding
      chainedKeys.forEach(function (key) {
        if (keys.some(function (other) {
          return key !== other && other.startsWith(key);
        })) return;
        delete _this4.keyBindings[key];
        lively_lang.arr.remove(keys, key);
        lively_lang.arr.remove(chainedKeys, key);
      });
    }
  }, {
    key: "addCommand",
    value: function addCommand(command) {
      return !command || !command.bindKey ? undefined : this.addCommandToBinding(command.bindKey, command);
    }
  }, {
    key: "addCommandToBinding",
    value: function addCommandToBinding(keyCombo, command) {
      var _this5 = this;

      // remove overwritten keychains
      var prev = this.keyBindings[keyCombo];
      if (prev === "chainKeys" && command != "chainKeys") {
        Object.keys(this.keyBindings).forEach(function (key) {
          if (key.startsWith(keyCombo)) delete _this5.keyBindings[key];
        });
      }

      if (!command) delete this.keyBindings[keyCombo];else this.keyBindings[keyCombo] = command;
      if (command !== "chainKeys") this.cleanupUnusedKeyChains();
    }
  }]);
  return KeyHandler;
}();

var placeholderValue = "\x01\x01";
var placeholderRe = new RegExp("\x01", "g");

var DOMInputCapture = function () {
  function DOMInputCapture(eventDispatcher) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, DOMInputCapture);

    this.eventDispatcher = eventDispatcher;

    this.keepTextNodeFocused = options.hasOwnProperty("keepTextNodeFocused") ? options.keepTextNodeFocused : false;

    this.domState = {
      rootNode: null,
      textareaNode: null,
      eventHandlers: [],
      isInstalled: false
    };

    this.inputState = {
      composition: null,
      manualCopy: null,
      manualPaste: null
    };
  }

  createClass(DOMInputCapture, [{
    key: "install",
    value: function install(newRootNode) {
      var _this = this;

      var domState = this.domState,
          doc = typeof window !== "undefined" && newRootNode === window ? window.document : newRootNode.ownerDocument,
          isInstalled = domState.isInstalled,
          rootNode = domState.rootNode;


      if (isInstalled) {
        if (rootNode === newRootNode) return;
        this.uninstall();
      }

      domState.isInstalled = true;
      domState.rootNode = newRootNode;

      newRootNode.tabIndex = 1; // focusable so that we can relay the focus to the textarea

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // textarea element that acts as an event proxy

      var textareaNode = domState.textareaNode = doc.createElement("textarea");

      textareaNode.setAttribute("style", "\n      position: absolute;\n      /*extent cannot be 0, input won't work correctly in Chrome 52.0*/\n      width: 20px; height: 20px;\n      z-index: 0;\n      opacity: 0;\n      background: transparent;\n      -moz-appearance: none;\n      appearance: none;\n      border: none;\n      resize: none;\n      outline: none;\n      overflow: hidden;\n      font: inherit;\n      padding: 0 1px;\n      margin: 0 -1px;\n      text-indent: -1em;\n      -ms-user-select: text;\n      -moz-user-select: text;\n      -webkit-user-select: text;\n      user-select: text;\n      /*with pre-line chrome inserts &nbsp; instead of space*/\n      white-space: pre!important;");

      if (bowser.tablet || bowser.mobile) textareaNode.setAttribute("x-palm-disable-auto-cap", true);

      textareaNode.setAttribute("wrap", "off");
      textareaNode.setAttribute("autocorrect", "off");
      textareaNode.setAttribute("autocapitalize", "off");
      textareaNode.setAttribute("spellcheck", false);
      textareaNode.className = "lively-text-input";
      textareaNode.value = "";
      doc.body.insertBefore(textareaNode, newRootNode.firstChild);

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // event handlers
      domState.eventHandlers = [{ type: "keydown", node: newRootNode, fn: function fn(evt) {
          return _this.onRootNodeKeyDown(evt);
        }, capturing: false }, { type: "keyup", node: newRootNode, fn: function fn(evt) {
          return _this.onRootNodeKeyUp(evt);
        }, capturing: false }, { type: "focus", node: newRootNode, fn: function fn(evt) {
          return _this.onRootNodeFocus(evt);
        }, capturing: true }, { type: "blur", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaBlur(evt);
        }, capturing: true }, { type: "keydown", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaKeyDown(evt);
        }, capturing: false }, { type: "keyup", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaKeyUp(evt);
        }, capturing: false }, { type: "cut", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaCut(evt);
        }, capturing: false }, { type: "copy", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaCopy(evt);
        }, capturing: false }, { type: "paste", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaPaste(evt);
        }, capturing: false }, { type: "compositionstart", node: textareaNode, fn: function fn(evt) {
          return _this.onCompositionStart(evt);
        }, capturing: false }, { type: "compositionend", node: textareaNode, fn: function fn(evt) {
          return _this.onCompositionEnd(evt);
        }, capturing: false }, { type: "compositionupdate", node: textareaNode, fn: function fn(evt) {
          return _this.onCompositionUpdate(evt);
        }, capturing: false }, { type: "input", node: textareaNode, fn: function fn(evt) {
          return _this.onTextareaInput(evt);
        }, capturing: false }];
      domState.eventHandlers.forEach(function (_ref) {
        var type = _ref.type,
            node = _ref.node,
            fn = _ref.fn,
            capturing = _ref.capturing;
        return node.addEventListener(type, fn, capturing);
      });

      return this;
    }
  }, {
    key: "uninstall",
    value: function uninstall() {
      var domState = this.domState;

      domState.isInstalled = false;

      domState.eventHandlers.forEach(function (_ref2) {
        var node = _ref2.node,
            type = _ref2.type,
            fn = _ref2.fn,
            capturing = _ref2.capturing;
        return node.removeEventListener(type, fn, capturing);
      });

      var n = domState.textareaNode;
      n && n.parentNode && n.parentNode.removeChild(n);
      domState.rootNode = null;

      return this;
    }
  }, {
    key: "resetValue",
    value: function resetValue() {
      var n = this.domState.textareaNode;
      n && (n.value = placeholderValue);
    }
  }, {
    key: "readValue",
    value: function readValue() {
      var n = this.domState.textareaNode;
      return n ? n.value.replace(placeholderRe, "") : "";

      //   if (!n) return "";
      //   var val = n.value;
      //   var placeholder1 = placeholderValue.charAt(0);
      // // if (val == placeholder1) return "DELETE";
      //   if (val.substring(0, 2) == placeholderValue)
      //     val = val.substr(2);
      //   else if (val.charAt(0) == placeholder1)
      //     val = val.substr(1);
      //   else if (val.charAt(val.length - 1) == placeholder1)
      //     val = val.slice(0, -1);
      //   // can happen if undo in textarea isn't stopped
      //   if (val.charAt(val.length - 1) == placeholder1)
      //     val = val.slice(0, -1);
      //   return val;
    }
  }, {
    key: "focus",
    value: function focus(morph, world) {
      var node = this.domState.textareaNode;
      if (!node) return;
      node.ownerDocument.activeElement !== node && node.focus();

      if (bowser.firefox) // FF needs an extra invitation...
        Promise.resolve().then(function () {
          return node.ownerDocument.activeElement !== node && node.focus();
        });

      if (morph && morph.isText) this.ensureBeingAtCursorOfText(morph);else if (world) this.ensureBeingInVisibleBoundsOfWorld(world);
    }
  }, {
    key: "focusTextareaNode",
    value: function focusTextareaNode(morph, world) {
      return this.focus(morph, world);
    }
  }, {
    key: "focusRootNode",
    value: function focusRootNode(morph, world) {
      var node = this.domState.rootNode;
      if (!node) return;
      node.ownerDocument.activeElement !== node && node.focus();
    }
  }, {
    key: "blur",
    value: function blur() {
      var node = this.domState.textareaNode;
      node && node.blur();
    }
  }, {
    key: "doCopyWithMimeTypes",
    value: function doCopyWithMimeTypes(dataAndTypes) {
      var _this2 = this;

      // dataAndTypes [{data: STRING, type: mime-type-STRING}]
      return this.execCommand("manualCopy", function () {
        var el = _this2.domState.textareaNode;
        var h = function h(evt) {
          el.removeEventListener('copy', h);
          evt.preventDefault();
          dataAndTypes.forEach(function (_ref3) {
            var data = _ref3.data,
                type = _ref3.type;
            return evt.clipboardData.setData(type, data);
          });
        };
        setTimeout(function () {
          return el.removeEventListener('copy', h);
        }, 300);
        el.addEventListener('copy', h);
        el.value = "";
        el.select();
        el.ownerDocument.execCommand("copy");
      });
    }
  }, {
    key: "doCopy",
    value: function doCopy(content) {
      var _this3 = this;

      // attempt to manually copy to the clipboard
      // this might fail for various strange browser reasons
      // also it will probably steal the focus...
      return this.execCommand("manualCopy", function () {
        var el = _this3.domState.textareaNode;
        el.value = content;
        el.select();
        el.ownerDocument.execCommand("copy");
      });
    }
  }, {
    key: "doPaste",
    value: function doPaste() {
      var _this4 = this;

      return this.execCommand("manualPaste", function () {
        var el = _this4.domState.textareaNode;
        el.value = "";
        el.select();
        el.ownerDocument.execCommand("paste");
      });
    }
  }, {
    key: "execCommand",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee(stateName, execFn) {
        var state, deferred, isDone;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (this.domState.isInstalled) {
                  _context.next = 2;
                  break;
                }

                throw new Error("Cannot copy to clipboard – input helper is not installed into DOM!");

              case 2:
                state = this.inputState;

                if (!state[stateName]) {
                  _context.next = 11;
                  break;
                }

                _context.prev = 4;
                _context.next = 7;
                return state[stateName].promise;

              case 7:
                _context.next = 11;
                break;

              case 9:
                _context.prev = 9;
                _context.t0 = _context["catch"](4);

              case 11:
                deferred = lively_lang.promise.deferred(), isDone = false;

                state[stateName] = {
                  onEvent: function onEvent(evt) {
                    if (isDone) return;
                    state[stateName] = null;
                    isDone = true;
                    deferred.resolve(evt);
                  },
                  promise: deferred.promise
                };

                execFn();

                _context.prev = 14;
                _context.next = 17;
                return lively_lang.promise.waitFor(1000, function () {
                  return isDone;
                });

              case 17:
                _context.next = 24;
                break;

              case 19:
                _context.prev = 19;
                _context.t1 = _context["catch"](14);

                state[stateName] = null;
                isDone = true;
                deferred.reject(_context.t1);

              case 24:
                return _context.abrupt("return", deferred.promise);

              case 25:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this, [[4, 9], [14, 19]]);
      }));

      function execCommand(_x2, _x3) {
        return _ref4.apply(this, arguments);
      }

      return execCommand;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // positioning
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "setPosition",
    value: function setPosition(pos) {
      var _ref5 = this.domState || {},
          textareaNode = _ref5.textareaNode;

      if (!textareaNode) return;
      textareaNode.style.left = pos.x + "px";
      textareaNode.style.top = pos.y + "px";
    }
  }, {
    key: "ensureBeingInVisibleBoundsOfWorld",
    value: function ensureBeingInVisibleBoundsOfWorld(world) {
      this.setPosition(world.visibleBounds().center());
    }
  }, {
    key: "ensureBeingAtCursorOfText",
    value: function ensureBeingAtCursorOfText(textMorph) {
      // move the textarea to the text cursor

      if (!textMorph.world()) return;

      var localCursorPos = textMorph.textLayout.pixelPositionFor(textMorph, textMorph.cursorPosition),
          posInClippedBounds = textMorph.innerBounds().constrainPt(localCursorPos),
          globalCursorPos = textMorph.worldPoint(posInClippedBounds.subPt(textMorph.scroll));
      this.setPosition(globalCursorPos);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // event handler
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "onRootNodeFocus",
    value: function onRootNodeFocus(evt) {
      var _ref6 = this.domState || {},
          textareaNode = _ref6.textareaNode,
          rootNode = _ref6.rootNode;

      if (this.keepTextNodeFocused && (evt.target === textareaNode || evt.target === rootNode)) this.focus();
      this.inputState.composition = null;
    }
  }, {
    key: "onTextareaBlur",
    value: function onTextareaBlur(evt) {
      var _this5 = this;

      setTimeout(function () {
        var _ref7 = _this5.domState || {},
            textareaNode = _ref7.textareaNode,
            rootNode = _ref7.rootNode;

        if (rootNode && document.activeElement === rootNode) rootNode && rootNode.focus();
      });
    }
  }, {
    key: "onRootNodeKeyUp",
    value: function onRootNodeKeyUp(evt) {
      this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onRootNodeKeyDown",
    value: function onRootNodeKeyDown(evt) {
      this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onTextareaKeyUp",
    value: function onTextareaKeyUp(evt) {
      this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onTextareaKeyDown",
    value: function onTextareaKeyDown(evt) {
      this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onTextareaInput",
    value: function onTextareaInput(evt) {
      if (this.inputState.composition) return;
      if (!evt.data) evt.data = this.readValue();
      this.resetValue();
      this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onCompositionStart",
    value: function onCompositionStart(evt) {
      this.inputState.composition = {};
    }
  }, {
    key: "onCompositionUpdate",
    value: function onCompositionUpdate(evt) {
      var c = this.inputState.composition,
          val = this.readValue();

      if (c.lastValue === val) return;
      c.lastValue = val;
    }
  }, {
    key: "onCompositionEnd",
    value: function onCompositionEnd(evt) {
      this.inputState.composition = null;
    }
  }, {
    key: "onTextareaPaste",
    value: function onTextareaPaste(evt) {
      this.inputState.manualPaste ? this.inputState.manualPaste.onEvent(evt) : this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onTextareaCopy",
    value: function onTextareaCopy(evt) {
      this.inputState.manualCopy ? this.inputState.manualCopy.onEvent(evt) : this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }, {
    key: "onTextareaCut",
    value: function onTextareaCut(evt) {
      this.eventDispatcher.dispatchDOMEvent(evt);
    }
  }]);
  return DOMInputCapture;
}();

var KeyBindingsTrait = {
  addKeyBindings: function addKeyBindings(bindings) {
    var _keybindings;

    if (!this._keybindings) this._keybindings = [];
    (_keybindings = this._keybindings).unshift.apply(_keybindings, toConsumableArray(bindings));
  },


  get keybindings() {
    return this._keybindings || [];
  },

  set keybindings(bndgs) {
    return this._keybindings = bndgs;
  },

  get keyhandlers() {
    // Note that reconstructing the keyhandler on every stroke might prove too
    // slow. On my machine it's currently around 10ms which isn't really noticable
    // but for snappier key behavior we might want to cache that. Tricky thing
    // about caching is to figure out when to invalidate... keys binding changes
    // can happen in a number of places
    return [KeyHandler.withBindings(this.keybindings)];
  },

  get keyCommandMap() {
    var platform = this.keyhandlers[0].platform;
    return this.keybindings.reduce(function (keyMap, binding) {
      var keys = binding.keys,
          platformKeys = findKeysForPlatform(keys, platform),
          command = binding.command,
          name = typeof command === "string" ? command : command.command || command.name;

      if (typeof platformKeys !== "string") return keyMap;

      return platformKeys.split("|").reduce(function (keyMap, combo) {
        return Object.assign(keyMap, defineProperty({}, combo, {
          name: name, command: command,
          prettyKeys: KeyHandler.prettyCombo(combo)
        }));
      }, keyMap);
    }, {});
  },

  keysForCommand: function keysForCommand(commandName) {
    var pretty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

    var map = this.keyCommandMap,
        rawKey = Object.keys(map).find(function (key) {
      return map[key].name === commandName;
    });
    return rawKey && pretty ? map[rawKey].prettyKeys : rawKey;
  },
  simulateKeys: function simulateKeys(keyString) {
    return KeyHandler.simulateKeys(this, keyString);
  }
};

var defaultCommandHandler = new CommandHandler();

var CommandTrait = {
  get commands() {
    return this._commands || [];
  },

  set commands(cmds) {
    if (this._commands) this.removeCommands(this._commands);
    this.addCommands(cmds);
  },

  get commandsIncludingOwners() {
    return lively.lang.arr.flatmap([this].concat(this.ownerChain()), function (morph) {
      return lively.lang.arr.sortByKey(morph.commands, "name").map(function (command) {
        return { target: morph, command: command };
      });
    });
  },

  addCommands: function addCommands(cmds) {
    this.removeCommands(cmds);
    this._commands = (this._commands || []).concat(cmds);
  },
  removeCommands: function removeCommands(cmdsOrNames) {
    var names = cmdsOrNames.map(function (ea) {
      return typeof ea === "string" ? ea : ea.name;
    }),
        commands = (this._commands || []).filter(function (_ref) {
      var name = _ref.name;
      return !names.includes(name);
    });
    if (!commands.length) delete this._commands;else this._commands = commands;
  },


  get commandHandler() {
    return this._commandHandler || defaultCommandHandler;
  },

  lookupCommand: function lookupCommand(commandOrName) {
    var result = this.commandHandler.lookupCommand(commandOrName, this);
    return result && result.command ? result : null;
  },
  execCommand: function execCommand(command, args, count, evt) {
    return this.commandHandler.exec(command, this, args, count, evt);
  }
};

exports.CommandHandler = CommandHandler;
exports.Keys = Keys;
exports.KeyHandler = KeyHandler;
exports.findKeysForPlatform = findKeysForPlatform;
exports.DOMInputCapture = DOMInputCapture;
exports.KeyBindingsTrait = KeyBindingsTrait;
exports.CommandTrait = CommandTrait;

}((this.lively.keyboard = this.lively.keyboard || {}),lively.lang,bowser));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();