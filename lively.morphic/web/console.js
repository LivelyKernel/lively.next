// hijack console.log immediately if lively_console is in the URL hash

if (!window.lively_console) {
  window.lively_console = {
    messages: [],
    original: {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    },
    install(notifyFn) {
      const record = function(type, args) {
        lively_console.original[type].apply(console, args);
        lively_console.messages.push({type, args, time: Date.now()});
        if (notifyFn) notifyFn(type, args);
      }
      console.log   = function() { record("log",   [...arguments]) };
      console.info  = function() { record("info",  [...arguments]) };
      console.warn  = function() { record("warn",  [...arguments]) };
      console.error = function() { record("error", [...arguments]) };
    },
    uninstall() {
      console.log   = lively_console.original.log;
      console.info  = lively_console.original.info;
      console.warn  = lively_console.original.warn;
      console.error = lively_console.original.error;
    },
  }
  if (location.hash.match(/\blively_console\b/)) {
    lively_console.install();
  }
}
