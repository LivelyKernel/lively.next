/* global require, process */
/*
 * For usage as EDITOR env variable.
 */
import execCommand from './commandline2lively.js';

execCommand({
  action: process.argv[2],
  data: { args: process.argv.slice(3) }
}, function (err, answer) {
  let isError = err || answer.data.error || answer.data.status === 'aborted';
  if (isError) process.stderr.write(String(err));
  else if (answer.data) {
    let out = typeof answer.data.result === 'string'
      ? answer.data.result
      : (typeof answer.data.status === 'string'
          ? answer.data.status
          : String(answer.data));
    process.stdout.write(out);
  }
  process.exit(isError ? 1 : 0);
});
