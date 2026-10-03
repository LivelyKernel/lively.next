// Runs the CDP-backed inspector service outside NW.js's renderer isolate.
//
// The renderer pauses briefly when lively.context throws its halt unwind
// exception. This plain Node process handles the CDP event, captures the
// paused stack, then resumes the renderer so normal exception unwinding can
// return control to the Lively UI.

const { createInspectorService } = require('./inspector-service.cjs');

function parseArgs () {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

const args = parseArgs();
const cdpPort = Number(args.cdpPort || process.env.LIVELY_APP_CDP_PORT || 9222);
const service = createInspectorService({
  cdpPort: Number.isFinite(cdpPort) && cdpPort > 0 ? cdpPort : 9222,
  log: msg => console.log(msg)
});

function stop () {
  try { service.stop(); } catch (_) {}
  process.exit(0);
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

service.start().then(() => {
  // Keep the helper alive; the parent-death watchdog is preloaded by node-main.
  setInterval(() => {}, 1 << 30);
}).catch(err => {
  console.error(err && (err.stack || err.message) || String(err));
  process.exit(1);
});
