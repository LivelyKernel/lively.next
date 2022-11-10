import { ViewModel, Text, component } from 'lively.morphic';
import { obj, string } from 'lively.lang/index.js';
import { pt, Color } from 'lively.graphics';

const defaultConsoleMethods = ['log', 'group', 'groupEnd', 'warn', 'assert', 'error'];

// implements a subset of the string substitution patterns of `console`
// See: https://developer.mozilla.org/en-US/docs/Web/API/Console#using_string_substitutions
// Support `%s` only and simply converts everything into a string
function formatTemplateString (template = '', ...args) {
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

/**
 * @param {console} platformConsole - The `console` object to instrument/prepare
 * @param {string[]} consoleMethods - An array with the names of methods to instrument
 * @param {Window} _window - The window to which `platformConsole` belongs
 */
export function prepareConsole (platformConsole, consoleMethods = defaultConsoleMethods, _window = window) {
  // reset consumer to be notified when one of `consoleMethods` gets executed on `platformConsole`
  // for `simpleConsumer`, wrapped `console` functions (their equivalents on the consumer) get invoked with a single string (returned from @see { formatTemplateString }) as argument
  // for `consumers`, wrapped `console` functions (their equivalents on the consumer) get invoked with the same arguments as the original `console `function
  let consumers = platformConsole.consumers = [];
  let simpleConsumers = platformConsole.simpleConsumers = [];

  function emptyFunc () {}

  function addWrappers () {
    if (platformConsole.wasWrapped) return;
    platformConsole.wasWrapped = true;

    let exceptions = ['removeWrappers', 'addWrappers', 'addConsumer', 'removeConsumer'];
    // find all methods on `platformConsole` which need to be instrumented
    let methods = Object.keys(platformConsole)
      .filter(name => typeof platformConsole[name] === 'function' &&
                  // we back up the original function source of x() with $x() below
                  !name.startsWith('$') &&
                  !platformConsole.hasOwnProperty('$' + name) &&
                  !exceptions.includes(name));
    let activationState = {};

    methods.forEach(name => {
      // backup original function source
      platformConsole['$' + name] = platformConsole[name];
      platformConsole[name] = function () {
        if (activationState[name]) return;
        activationState[name] = true;
        try {
          // execute original method of `platformConsole`
          platformConsole['$' + name].apply(platformConsole, arguments);
          // call all consumer which implement the function with the same name as well
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

  // find backed up methods on `console` (we prefixed with $) and remove them while restoring the original function
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

  // in case one of `consoleMethods` is missing on `console`, stub with empty function
  // this way we cannot run into undefined functions when wrapping above
  for (let i = 0; i < consoleMethods.length; i++) {
    if (!platformConsole[consoleMethods[i]]) {
      platformConsole[consoleMethods[i]] = emptyFunc;
    }
  }

  platformConsole.wasWrapped = false;

  // install wrapping functions on `console`
  platformConsole.removeWrappers = removeWrappers;
  platformConsole.addWrappers = addWrappers;

  // install function to subscribe to method invocations on `console`
  platformConsole.addConsumer = function (c, simple = false) {
    let subscribers = simple ? simpleConsumers : consumers;
    if (!subscribers.includes(c)) {
      subscribers.push(c);
      // in case we are the first consumer, install wrappers on `console`
      // in case the wrappers are already installed, `addWrappers` will return early
      addWrappers();
    }
    // add event listener that takes care of printing errors that are announced in `console`
    // as those are not triggered by an explicit call to `console.XZY()`, we need to handle them separately
    installErrorCapture(c, _window);
  };

  platformConsole.removeConsumer = function (c) {
    let idx = consumers.indexOf(c);
    if (idx >= 0) consumers.splice(idx, 1);
    let idx2 = simpleConsumers.indexOf(c);
    if (idx2 >= 0) simpleConsumers.splice(idx2, 1);
    // remove wrappers in case we are the last consumer
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
          return ['onWindowClose', 'clear', 'commands', 'menuItems', 'keybindings'];
        }
      }
    };
  }

  reset () {
    this.logLimit = 1000;
    this.clear();
  }

  viewDidLoad () {
    console.wasWrapped = false;
    this.install();
  }

  // Make sure that we clean up after ourselves when closing
  onWindowClose () { this.uninstall(); }

  install () {
    if (!console.addConsumer) prepareConsole(console);
    console.addConsumer(this);
  }

  // Removes our patches from `console` if they are present
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

  /*
  We mirror the logging methods provided by `console` below.
  Those are called by the `console` methods after they have been instrumented to log into our own console.
  */
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

  get keybindings () {
    const viewKeybindings = this.withoutBindingsDo(() => { return this.view.keybindings; });
    return [
      { keys: { mac: 'Meta-K', win: 'Ctrl-Alt-K' }, command: '[console] clear' },
      ...viewKeybindings
    ];
  }

  get commands () {
    const viewCommands = this.withoutBindingsDo(() => { return this.view.commands; });
    return [
      {
        name: '[console] clear',
        exec: () => { this.clear(); return true; }
      },
      ...viewCommands
    ];
  }

  async menuItems () {
    const viewItems = await this.withoutBindingsDo(async () => await this.view.menuItems());
    debugger;
    return [
      { command: '[console] clear', target: this, alias: 'clear' },
      { isDivider: true },
      ...viewItems
    ];
  }

  /**
   * Appends `string` to the end of what is displayed in the console.
   * Formatting will was already taken care of by @see { maybeTemplateMessage }.
   * @param {String} string - The message to log into the console.
   * @param {object} attr - TextAttributes to style `string` with.
   */
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

const Console = component({
  type: Text,
  name: 'debug console',
  defaultViewModel: LocalJSConsoleModel,
  extent: pt(300, 400),
  fill: Color.black.withA(.9),
  fontColor: Color.white,
  clipMode: 'auto'
});

export { Console };
