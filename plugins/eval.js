export default class EvalPlugin {

  constructor() {
    this.route = "/eval";
  }

  setOptions({route} = {}) {
    this.route = route;
  }

  get pluginId() { return "eval" }

  get after() { return ["cors"]; }

  handleRequest(req, res, next) {
    if (this.route !== req.url || req.method !== "POST")
      return next();

    var data = '';
    req.on('data', d => data += d.toString());
    req.on('end', () => {
      Promise.resolve().then(() => {
        var result = eval(data);
        if (!(result instanceof Promise)) {
          console.error("unexpected eval result:" + result)
          throw new Error("unexpected eval result:" + result);
        }
        return result;
      })
      .then(evalResult => JSON.stringify(evalResult))
      .then(stringifiedEvalResult => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(stringifiedEvalResult);
      })
      .catch(err => {
        console.error("eval error: " + err);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({isError: true, value: String(err.stack || err)}));
      });
    });
  }

}
