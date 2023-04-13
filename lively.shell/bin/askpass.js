/* global process, require, __dirname */
/*
 * This script conforms to and can be used as SSH_ASKPASS / GIT_ASKPASS tool.
 * It will be called by ssh/git with a query string as process.argv[2]. This
 * script will then connect to a Lively session via websocket/lively-json
 * protocol and prompt the query. The prompt input will be written to stdout.
 */

// Example:

// ASKPASS_SESSIONID="B82DA844-65D7-4E34-86E7-C41CCBB070DA" \
// L2L_SESSIONTRACKER_SERVER="http://localhost:9010" \
// node askpass.js "Someone there"

import { join } from "path";
import cmd from './commandline2lively.js';

// control stdout/err output, silence the node process:
let stdoutWrite = process.stdout.write;
let stderrWrite = process.stderr.write;
process.stderr.write = function () {};
process.stdout.write = function () {};

if (!process.env.WORKSPACE_LK) { process.env.WORKSPACE_LK = join(__dirname, '..'); }

cmd({
  action: 'ask for',
  data: {
    query: process.argv[2] || 'No query from ASKPASS invocation',
    requiredUser: process.env.L2L_ASKPASS_USER
  }
}, function (err, answer) {
  if (err) {
    stderrWrite.call(process.stderr, String(err));
    process.exit(1);
  } else {
    stdoutWrite.call(
      process.stdout, 
      answer && answer.data.answer ? answer.data.answer + '\n' : '');
    process.exit(0);
  }
});
