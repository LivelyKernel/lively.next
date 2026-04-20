// Parent-death watchdog for the server child process.
// If the NW.js parent dies (crash, SIGKILL, force-quit), exit this process too.
// Preloaded via `node -r watchdog.cjs`.

const parentPid = Number(process.env.LIVELY_APP_PARENT_PID);
if (!parentPid) return;

// On Linux, prctl(PR_SET_PDEATHSIG, SIGTERM) is the kernel-level solution,
// but it requires a native addon. Fall back to a polling watchdog (cross-platform).
setInterval(() => {
  try {
    // Signal 0 = existence check, doesn't actually send a signal.
    process.kill(parentPid, 0);
  } catch (_) {
    // Parent no longer exists — shut down.
    process.exit(0);
  }
}, 1000).unref();
