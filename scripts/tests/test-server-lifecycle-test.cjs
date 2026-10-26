const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-test-lifecycle-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const write = (name, source) => {
  const target = path.join(fixture, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
  fs.chmodSync(target, 0o755);
};
const pids = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map(Number).filter(Boolean) : [];
const running = pid => {
  try { return !execFileSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' }).trim().startsWith('Z'); }
  catch (_) { return false; }
};
async function waitFor (condition) {
  for (let i = 0; i < 100; i++) { if (condition()) return; await pause(50); }
  throw new Error('Fixture did not reach expected state');
}
const outsider = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
let child;
async function check () {
  write('scripts/test.sh', fs.readFileSync(process.env.LIVELY_TEST_SCRIPT_PATH || path.join(root, 'scripts/test.sh')));
  write('scripts/stop-process-tree.cjs', fs.readFileSync(path.join(root, 'scripts/stop-process-tree.cjs')));
  write('scripts/test-packages.json', '["pkg"]');
  write('bin/ss', '#!/bin/bash\nif [ "$FIXTURE_EXISTING" ]; then echo "LISTEN 0 0 127.0.0.1:9011"; fi\n');
  // Running the old script for the regression must never touch real browsers or servers.
  write('bin/pkill', '#!/bin/bash\necho "$*" >> "$FIXTURE_BROAD_KILLS"\n');
  write('start-server.sh', '#!/bin/bash\nnode server.cjs\n');
  write('server.cjs', `const fs = require('node:fs');
const { spawn } = require('node:child_process');
fs.appendFileSync(process.env.FIXTURE_PIDS, process.pid + '\\n');
spawn(process.execPath, ['descendant.cjs'], { detached: true, stdio: 'ignore' });
setInterval(() => {}, 1000);`);
  write('descendant.cjs', `const fs = require('node:fs');
fs.appendFileSync(process.env.FIXTURE_PIDS, process.pid + '\\n');
if (process.env.FIXTURE_STUBBORN) process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);`);
  write('scripts/wait-for-server.js', `const fs = require('node:fs');
const ready = () => {
  if (!fs.existsSync(process.env.FIXTURE_PIDS) || fs.readFileSync(process.env.FIXTURE_PIDS, 'utf8').trim().split('\\n').length < 2) return setTimeout(ready, 10);
  process.exit(process.env.FIXTURE_FAIL_READY ? 1 : 0);
}; ready();`);
  write('scripts/test.js', `const fs = require('node:fs');
fs.writeFileSync(process.env.FIXTURE_CLIENT, String(process.pid));
if (process.env.FIXTURE_FAIL_CLIENT) process.exit(1);
if (process.env.FIXTURE_HANG) setInterval(() => {}, 1000);
else if (process.env.FIXTURE_RETRY && !fs.existsSync('retried')) {
  fs.writeFileSync('retried', 'yes'); console.log('ECONNRESET SUMMARY-INDICATE-FAILURE');
} else console.log('SUMMARY-passed:1\\nSUMMARY-failed:0\\nSUMMARY-skipped:0');`);
  write('lively.headless/chrome-data-dir/user-profile', 'must survive');
  for (const [label, additions, expected, packages] of [
    ['local', {}, 0, ['pkg']],
    ['ci-restart', { CI: 'true' }, 0, ['one', 'two']],
    ['retry', { CI: 'true', FIXTURE_RETRY: 'true' }, 0, ['pkg']],
    ['client-error', { FIXTURE_FAIL_CLIENT: 'true' }, 1, ['pkg']],
    ['startup-error', { CI: 'true', FIXTURE_FAIL_READY: 'true' }, 1, ['pkg']],
    ['interrupt', { FIXTURE_HANG: 'true' }, 143, ['pkg']],
    ['existing', { FIXTURE_EXISTING: 'true' }, 0, ['pkg']],
    ['stubborn', { FIXTURE_STUBBORN: 'true' }, 0, ['pkg']]
  ]) {
    const log = path.join(fixture, `${label}-pids`);
    const client = path.join(fixture, `${label}-client`);
    const broad = path.join(fixture, 'broad-kills');
    const env = { ...process.env, CI: '', PATH: `${fixture}/bin:${process.env.PATH}`, FIXTURE_PIDS: log,
      FIXTURE_CLIENT: client, FIXTURE_BROAD_KILLS: broad, LIVELY_TEST_SERVER_START_MAX_ATTEMPTS: '1', ...additions };
    child = spawn('bash', ['scripts/test.sh', ...packages], { cwd: fixture, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    if (additions.FIXTURE_HANG) {
      await waitFor(() => fs.existsSync(client));
      child.kill('SIGTERM');
    }
    let timeout;
    const deadline = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${label} did not exit: ${output}`)), 15000); });
    const result = await Promise.race([exited, deadline]).finally(() => clearTimeout(timeout));
    assert.equal(result.code, expected, `${label}: ${output}`);
    assert.ok(!fs.existsSync(broad), `${label}: invoked global pkill`);
    assert.ok(fs.existsSync(path.join(fixture, 'lively.headless/chrome-data-dir/user-profile')), 'must preserve a different browser profile');
    for (const pid of pids(log)) await waitFor(() => !running(pid));
    if (fs.existsSync(client)) await waitFor(() => !running(Number(fs.readFileSync(client, 'utf8'))));
    assert.ok(running(outsider.pid), `${label}: must preserve unrelated process`);
    if (label === 'existing') assert.equal(pids(log).length, 0, 'must reuse existing local server');
    if (label === 'ci-restart' || label === 'retry') assert.equal(pids(log).length, 4, 'must start two owned server trees');
    console.log(`Owned test processes: ${label} passed`);
  }
}
check().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  child?.kill('SIGKILL'); outsider.kill('SIGTERM');
  for (const name of fs.readdirSync(fixture).filter(name => name.endsWith('-pids') || name.endsWith('-client'))) {
    for (const pid of pids(path.join(fixture, name))) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
  }
  fs.rmSync(fixture, { recursive: true, force: true });
});
