/*global process, require, __dirname, module*/

/*
 * This script conforms to and can be used as SSH_ASKPASS / GIT_ASKPASS tool.
 * It will be called by ssh/git with a query string as process.argv[2]. This
 * script will then connect to a Lively session via socket.io/lively-json
 * protocol and prompt the query. The prompt input will be written to stdout.
 */

var path = require("path"),
    util = require('util'),
    io = require("socket.io-client"),
    debug = false,
    env = process.env;

function log(/*args*/) {
  if (!debug) return;
  var args = Array.prototype.slice.call(arguments);
  args[0] = '[cmdline2lv] ' + args[0];
  console.log.apply(console, arguments);
}

env
function createConnection(thenDo) {
  var url =    env.L2L_SESSIONTRACKER_SERVER || "http://localhost:9001",
      ioPath = env.L2L_SESSIONTRACKER_PATH || "/lively-socket.io",
      ioPath = ioPath.startsWith("/") ? ioPath : "/" + ioPath,
      ns =     env.L2L_SESSIONTRACKER_NS || "l2l",
      auth =   env.L2L_ASKPASS_AUTH_HEADER,
      ioURL =  url.replace(/\/$/, "") + ns.replace(/^\/?/, "/"),
      ioOpts = {path: ioPath, transports: ['websocket', 'polling']},
      secure = !!url.match(/https:/);


  if (!url)
    thenDo(new Error("No L2L_SESSIONTRACKER_SERVER provided for creating connection from shell to Lively!"));

  if (auth) ioOpts.extraHeaders = {AUTHORIZATION: auth};

  try {
    if (secure || env.L2L_ASKPASS_SSL_KEY_FILE) {
      // SSL requires to pass in certificates to establish the L2L session
      var fs = require("fs"),
          caFile = env.L2L_ASKPASS_SSL_CA_FILE,
          keyFile = env.L2L_ASKPASS_SSL_KEY_FILE,
          certFile = env.L2L_ASKPASS_SSL_CERT_FILE;
  
      ioOpts.tlsOptions = {rejectUnauthorized: false};
      if (caFile) ioOpts.ca = fs.readFileSync(caFile);
      if (keyFile) ioOpts.key = fs.readFileSync(keyFile);
      if (certFile) ioOpts.cert = fs.readFileSync(certFile);
    }
  
    log("Creating %ssocket.io connection to %s", secure ? "secure " : "", ioURL);

    thenDo(null, io(ioURL, ioOpts));
  } catch (e) { thenDo(e); }
}

function queryLively(msg, thenDo) {
  // lively-2-lively session id to be used to ask for password:
  var clientSessionId = env.L2L_EDITOR_SESSIONID || env.ASKPASS_SESSIONID;
  if (clientSessionId && !msg.target) msg.target = clientSessionId;
  if (!msg.n) msg.n = 0;
  if (!msg.ackTimeout) msg.ackTimeout = 0;
  if (!msg.sender) msg.sender = 'OS shell';

  log("Sending ", msg);

  createConnection(function(err, ioSocket) {
  // socket.on("connect", () => {
    if (err || !ioSocket) {
      thenDo("Lively askpass: unable to create socket.io connection " + err);
      ioSocket && ioSocket.close();
      return;
    }

    ioSocket.on('connect', function() {
      log("Connected");
      ioSocket.emit(msg, function(answer) {
        debug && console.error("[cmdline2lv] got answer", answer);
        ioSocket && ioSocket.close();
        thenDo(null, answer);
      });
    });

    ioSocket.on('error', function(err) {
      debug && console.error("[cmdline2lv] ", err);
      thenDo("Error in askpass websocket client:\n" + util.inspect(err));
    });

    ioSocket.on('disconnect', function() { log("disconnected"); });
    ioSocket.on('reconnect', function() { log("reconnected"); });
    ioSocket.on('reconnecting', function() { log("reconnecting"); });
    ioSocket.on('reconnect_error', function(err) { log("reconnect_error " + err); });
    ioSocket.on('reconnect_failed', function(err) { log("reconnect_failed"); });


    ioSocket.connect();
  });

}

module.exports = queryLively;
