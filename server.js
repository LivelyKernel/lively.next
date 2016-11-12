import * as http from "http";
import socketio from "socket.io";

// Array.from(serverStateMap.keys())

const serverStateMap = new Map();

export const defaultOptions = {
  hostname: "localhost",
  port: 3000,
  socketIOPath: '/lively.com'
};

function serverKey(opts) {
  var {hostname, port} = {...defaultOptions, ...opts};
  return `${hostname}:${port}`;
}

export function find(options) {
  return serverStateMap.get(serverKey(options));
}

export function ensure(options) {
  return find(options) || start(options);
}

export function close(serverState = {}) {
  var {server, io, options} = serverState;

  if (options) {
    if (serverState !== find(options))
      console.warn("Stored server state does not match serverState passed to close()!");
    serverStateMap.delete(serverKey(options));
  }

  return new Promise((resolve, reject) => {
    serverState.server.close(resolve);
    serverState.io.close();
  });
}

export async function start(options) {
  var {hostname, port, socketIOPath} = {...defaultOptions, ...options},
      server = http.createServer(),
      io = socketio(server, {path: socketIOPath}),
			state = {server, io, options};

  serverStateMap.set(serverKey({hostname, port}), state);

  // we dance this little dance to ensure that our handlers are added before
  // the socket.io handler so we can inject cors headers. In newer nodes
  // emitter.prependListener can be used instead
  var listeners = server.listeners("request");
  server.removeAllListeners("request");
  server.on("request", (req, res) =>
    handlers(socketIOPath).reduceRight((next, handler) =>
      () => handler(req, res, next), () => {})());
  listeners.forEach(ea => server.on("request", ea));

  server.listen(port, hostname);

  return state;
}

function handlers(socketIOPath) {
  // late bound
  return [
    cors,
    ignoreSocketIO(socketIOPath),
    evalHandler("/eval"),
    defaultHandler("/")
  ]
}

function defaultHandler(route) {
  return function httpHandler(req, res, next) {
    res.writeHead(200);
    res.end("lively.server");
  }
}

function cors(req, res, next) {
  var allowOrigin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Depth, Cookie, Set-Cookie, Accept, Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization");
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS, PROPFIND, REPORT, MKCOL');
  res.setHeader("Access-Control-Expose-Headers", "Date, Etag, Set-Cookie");
  next();
}

function ignoreSocketIO(path = "/lively.com") {
  return function(req, res, next) {
    if (req.url.startsWith(path)) {
      // socket.io handles it
      // console.log(`[lively.server] request to ${req.url} ignored -> socket.io handles it`);
    } else next();
  }
}

function evalHandler(route) {
  return function postHandler(req, res, next) {
    if (route !== req.url || req.method !== "POST") return next();
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
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({isError: true, value: String(err.stack || err)}));
      });
    });
  }

}
