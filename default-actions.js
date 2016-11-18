export var defaultActions = {

  "l2l-ping": (tracker, {sender, data: {timestamp}}, ackFn, socket) => {
    var t = Date.now();
    typeof ackFn === "function" && ackFn({timestamp: t});
    tracker.debug && console.log(`[${this}] got ping from ${sender}, time: ${t-timestamp}ms`);
  },

  "remote-eval": (tracker, {sender, data: {source}}, ackFn, socket) => {
      Promise.resolve().then(() => eval(source))
        .then(result => ackFn({value: result}))
        .catch(err => {
          // in case SystemJS wraps the error:
          if (err.originalErr) err = err.originalErr;
          console.error("eval error: " + err);
          ackFn({isError: true, value: String(err.stack || err)})
        });
  }

}
