import { ViewModel, part, Text, component } from 'lively.morphic';
import { obj, string } from 'lively.lang/index.js';
import { pt, Color } from 'lively.graphics';

const defaultConsoleMethods = ['log', 'group', 'groupEnd', 'warn', 'assert', 'error'];

function formatTemplateString (template, ...args) {
  let string = template;
  for (let i = 0; i < args.length; i++) {
    let idx = string.indexOf('%s');
    if (idx > -1) string = string.slice(0, idx) + String(args[i]) + string.slice(idx + 2);
    else string = string + ' ' + String(args[i]);
  }
  return string;
}

function installErrorCapture (target, _window = window) {
  if (!target._errorHandler) {
    target._errorHandler = (function errorHandler (errEvent, url, lineNumber, column, errorObj) {
      let err = errEvent.error || errEvent; let msg;
      if (err.stack) msg = String(err.stack);
      else if (url) msg = `${err} ${url}:${lineNumber}`;
      else msg = String(err);
      if (typeof target.error === 'function') target.error(msg);
    });
    _window.addEventListener('error', target._errorHandler);
  }
  if (!target._errorHandlerForPromises) {
    target._errorHandlerForPromises = function unhandledPromiseRejection (evt) {
      if (typeof target.error === 'function') { target.error('unhandled promise rejection:\n' + evt.reason); }
    };
    _window.addEventListener('unhandledrejection', target._errorHandlerForPromises);
  }
}

function removeErrorCapture (target, _window = window) {
  if (target._errorHandler) {
    _window.removeEventListener('error', target._errorHandler);
    delete target._errorHandler;
  }
  if (!target._errorHandlerForPromises) {
    _window.removeEventListener('unhandledrejection', target._errorHandlerForPromises);
    delete target._errorHandlerForPromises;
  }
}

export function prepareConsole (platformConsole, consoleMethods = defaultConsoleMethods, _window = window) {
  let consumers = platformConsole.consumers = [];
  let simpleConsumers = platformConsole.simpleConsumers = [];

  function emptyFunc () {}

  function addWrappers () {
    if (platformConsole.wasWrapped) return;
    platformConsole.wasWrapped = true;

    let exceptions = ['removeWrappers', 'addWrappers', 'addConsumer', 'removeConsumer'];
    let methods = Object.keys(platformConsole)
      .filter(name => typeof platformConsole[name] === 'function' &&
                  !name.startsWith('$') &&
                  !platformConsole.hasOwnProperty('$' + name) &&
                  !exceptions.includes(name));
    let activationState = {};

    methods.forEach(name => {
      platformConsole['$' + name] = platformConsole[name];
      platformConsole[name] = function () {
        if (activationState[name]) return;
        activationState[name] = true;
        try {
          platformConsole['$' + name].apply(platformConsole, arguments);
          for (let i = 0; i < consumers.length; i++) {
            let consumerFunc = consumers[i][name];
            if (typeof consumerFunc === 'function') { consumerFunc.apply(consumers[i], arguments); }
          }
          for (let i = 0; i < simpleConsumers.length; i++) {
            let consumerFunc = simpleConsumers[i][name];
            if (typeof consumerFunc === 'function') { consumerFunc.call(simpleConsumers[i], formatTemplateString.apply(null, arguments)); }
          }
        } finally { activationState[name] = false; }
      };
    });
  }

  function removeWrappers () {
    for (let name in platformConsole) {
      if (name[0] !== '$') continue;
      let realName = name.substring(1, name.length);
      platformConsole[realName] = platformConsole[name];
      delete platformConsole[name];
    }
    platformConsole.wasWrapped = true;
  }

  if (platformConsole.wasPrepared) return;
  platformConsole.wasPrepared = true;

  for (let i = 0; i < consoleMethods.length; i++) {
    if (!platformConsole[consoleMethods[i]]) {
      platformConsole[consoleMethods[i]] = emptyFunc;
    }
  }

  platformConsole.wasWrapped = false;

  platformConsole.removeWrappers = removeWrappers;
  platformConsole.addWrappers = addWrappers;

  platformConsole.addConsumer = function (c, simple = false) {
    let subscribers = simple ? simpleConsumers : consumers;
    if (!subscribers.includes(c)) {
      subscribers.push(c);
      addWrappers();
    }
    installErrorCapture(c, _window);
  };

  platformConsole.removeConsumer = function (c) {
    let idx = consumers.indexOf(c);
    if (idx >= 0) consumers.splice(idx, 1);
    let idx2 = simpleConsumers.indexOf(c);
    if (idx2 >= 0) simpleConsumers.splice(idx2, 1);
    if (!consumers.length && !simpleConsumers.length) { removeWrappers(); }
    removeErrorCapture(c, _window);
  };
}

class LocalJSConsoleModel extends ViewModel {
  static get properties () {
    return {
      logLimit: { defaultValue: 1000 },
      expose: {
        get () {
          return ['onWindowClose', 'clear'];
        }
      }
    };
  }

  reset () {
    this.logLimit = 300;
    this.clear();
  }

  viewDidLoad () {
    console.wasWrapped = false;
    this.install();
  }

  onWindowClose () { this.uninstall(); }

  install () {
    if (!console.addConsumer) prepareConsole(console);
    console.addConsumer(this);
  }

  uninstall () {
    if (console.removeConsumer) { console.removeConsumer(this); }
  }

  maybeTemplateMessage (arg, ...args) {
    let msg;
    if (typeof arg !== 'string') {
      msg = obj.inspect(arg, { maxDepth: 2 });
    } else if (args.length) {
      msg = string.formatFromArray(Array.from(arguments));
    } else msg = String(arg);
    return msg;
  }

  clear () {
    this.view.textString = '';
  }

  log (/* args */) {
    this.addLog(this.maybeTemplateMessage.apply(this, arguments));
  }

  warn (template, ...args) {
    this.addLog(this.maybeTemplateMessage.apply(this, arguments),
      { fontColor: 'orange' });
  }

  error (template, ...args) {
    this.addLog(this.maybeTemplateMessage.apply(this, arguments),
      { fontColor: 'red', fontWeight: 'bold' });
  }

  group (msg) {
    this.addLog(`=> ${msg}`);
  }

  groupEnd (msg) {
    this.addLog(`<= ${msg}`);
  }

  assert (test, msg) {
    if (!test) this.error('Assert failed: ' + msg);
  }

  addLog (string, attr) {
    if (!string.endsWith('\n')) string += '\n';
    const t = this.view;
    let end = t.documentEndPosition;
    let scrollToEnd = t.cursorPosition.row === end.row;
    if (end.column > 0) end = { row: end.row + 1, column: 0 };
    t.insertText(attr ? [string, attr] : string, end, false);
    if (t.lineCount() > this.logLimit) {
      t.deleteText({
        start: { row: 0, column: 0 },
        end: { row: t.lineCount() - this.logLimit, column: 0 }
      });
    }
    if (scrollToEnd) {
      t.gotoDocumentEnd();
      t.scrollCursorIntoView();
    }
  }
}

class LocalJSConsole extends Text {
  get commands () {
    return [
      {
        name: '[console] clear',
        exec: () => { this.clear(); return true; }
      },
      ...super.commands
    ];
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-K', win: 'Ctrl-K' }, command: '[console] clear' },
      ...super.keybindings
    ];
  }

  async menuItems () {
    return [
      { command: '[console] clear', target: this, alias: 'clear' },
      { isDivider: true },
      ...await super.menuItems()
    ];
  }
}

const Console = component({
  type: LocalJSConsole,
  name: 'debug console',
  defaultViewModel: LocalJSConsoleModel,
  extent: pt(300, 400),
  fill: Color.black.withA(.9),
  fontColor: Color.white,
  clipMode: 'auto'
});

export { Console };
