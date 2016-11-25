/*
 * For usage as EDITOR env variable.
 */
require("./commandline2lively")({
  action: 'open editor',
  data: {args: process.argv.slice(2)}
}, function(err, answer) {
  var aborted = err || answer.data.error || answer.data.status === "aborted";
  console.log("Lively EDITOR session done, result: %s", aborted ? "aborted" : answer.data.status);
  process.exit(aborted ? 1 : 0);
});
