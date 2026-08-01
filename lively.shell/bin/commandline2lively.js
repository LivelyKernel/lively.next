/* global process, require */

/*
 * This script conforms to and can be used as SSH_ASKPASS / GIT_ASKPASS tool.
 * It will be called by ssh/git with a query string as process.argv[2]. This
 * script will then connect to a Lively session via socket.io/lively-json
 * protocol and prompt the query. The prompt input will be written to stdout.
 */

import io from 'socket.io-client';
let debug = false;
let debugOut = debug && require('fs').createWriteStream(process.env.HOME + '/.commandline2lively-debug.log');
let env = typeof process !== 'undefined' ? process.env : {};

function log (/* args */) {
  if (!debug) return;
  let args = Array.prototype.slice.call(arguments);
  args[0] = '[cmdline2lv] ' + args[0];
  debugOut.write(args.join(' ') + '\n');
  // console.log.apply(console, arguments);
}

function createConnection (thenDo, connect) {
  let url = env.L2L_SESSIONTRACKER_SERVER || 'http://localhost:9001';
  let ioPath = env.L2L_SESSIONTRACKER_PATH || '/lively-socket.io';
  ioPath = ioPath.startsWith('/') ? ioPath : '/' + ioPath;
  let ns = env.L2L_SESSIONTRACKER_NS || 'l2l';
  let auth = env.L2L_ASKPASS_AUTH_HEADER;
  let ioURL = url.replace(/\/$/, '') + ns.replace(/^\/?/, '/');
  let ioOpts = {
    path: ioPath,
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: false,
    timeout: 5000
  };
  let secure = !!url.match(/https:/);

  if (!url) { thenDo(new Error('No L2L_SESSIONTRACKER_SERVER provided for creating connection from shell to Lively!')); }

  if (auth) ioOpts.extraHeaders = { AUTHORIZATION: auth };

  try {
    if (secure || env.L2L_ASKPASS_SSL_KEY_FILE) {
      // SSL requires to pass in certificates to establish the L2L session
      let fs = require('fs');
      let caFile = env.L2L_ASKPASS_SSL_CA_FILE;
      let keyFile = env.L2L_ASKPASS_SSL_KEY_FILE;
      let certFile = env.L2L_ASKPASS_SSL_CERT_FILE;
  
      ioOpts.tlsOptions = { rejectUnauthorized: false };
      if (caFile) ioOpts.ca = fs.readFileSync(caFile);
      if (keyFile) ioOpts.key = fs.readFileSync(keyFile);
      if (certFile) ioOpts.cert = fs.readFileSync(certFile);
    }
  
    log('Creating %ssocket.io connection to %s', secure ? 'secure ' : '', ioURL);

    thenDo(null, connect(ioURL, ioOpts));
  } catch (e) { thenDo(e); }
}

export default function queryLively (msg, thenDo, connect = io) {
  // lively-2-lively session id to be used to ask for password:
  let clientSessionId = env.L2L_EDITOR_SESSIONID || env.ASKPASS_SESSIONID;
  if (clientSessionId && !msg.target) msg.target = clientSessionId;
  if (!msg.n) msg.n = 0;
  if (!msg.ackTimeout) msg.ackTimeout = 0;
  if (!msg.sender) msg.sender = 'OS shell';
  if (!msg.action) {
    thenDo(new Error('Cannot send an L2L message without an action'));
    return;
  }

  log('Sending ', msg);

  createConnection(function (err, ioSocket) {
    if (err || !ioSocket) {
      thenDo('Lively askpass: unable to create socket.io connection ' + err);
      ioSocket && ioSocket.close();
      return;
    }

    let finished = false;
    const finish = (err, answer) => {
      if (finished) return;
      finished = true;
      ioSocket.close();
      thenDo(err, answer);
    };

    ioSocket.once('connect', function () {
      log('Connected');
      ioSocket.emit(msg.action, msg, function (answer) {
        debug && console.error('[cmdline2lv] got answer', answer);
        finish(null, answer);
      });
    });

    const fail = function (err) {
      debug && console.error('[cmdline2lv] ', err);
      finish('Error in askpass websocket client:\n' + (err?.stack || String(err)));
    };

    ioSocket.once('connect_error', fail);
    ioSocket.once('error', fail);
    ioSocket.once('disconnect', function (reason) {
      log('disconnected');
      if (!finished) fail(new Error(`Disconnected before receiving an answer: ${reason}`));
    });

    ioSocket.connect();
  }, connect);
}
