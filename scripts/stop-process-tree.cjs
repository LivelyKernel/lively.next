const { execFileSync } = require('node:child_process');

const root = Number(process.argv[2]);
if (!Number.isInteger(root) || root <= 1) throw new Error('Expected an owned server process ID');
function processes () {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,stat='], { encoding: 'utf8' }).trim().split('\n').map(line => {
    const [pid, parent, group, state] = line.trim().split(/\s+/);
    return { pid: Number(pid), parent: Number(parent), group: Number(group), state };
  });
}
function signal (pid, name) {
  try { process.kill(pid, name); } catch (err) { if (err.code !== 'ESRCH') throw err; }
}
async function stop () {
  const table = processes();
  const owned = new Set([root]);
  // The launcher's process group survives its exit; also collect detached browsers.
  for (const proc of table) if (proc.group === root) owned.add(proc.pid);
  let size;
  do {
    size = owned.size;
    for (const proc of table) if (owned.has(proc.parent)) owned.add(proc.pid);
  } while (owned.size !== size);
  const pids = [...owned].reverse();
  for (const pid of pids) signal(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!processes().some(proc => owned.has(proc.pid) && !proc.state.startsWith('Z'))) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  for (const pid of pids) signal(pid, 'SIGKILL');
}
stop().catch(err => { console.error(err); process.exitCode = 1; });
