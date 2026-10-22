const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
if (process.platform === 'win32') {
  console.log('Bash launcher test is Unix-only');
} else {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively launch options '));
  try {
    fs.copyFileSync(path.join(__dirname, '../start.sh'), path.join(fixture, 'start.sh'));
    const launcher = path.join(fixture, 'node_modules/.bin/nw');
    fs.mkdirSync(path.dirname(launcher), {recursive: true});
    fs.writeFileSync(launcher, "#!/bin/bash\nprintf '%s\\n' \"$@\"\n", {mode: 0o755});
    const run = spawnSync('bash', [path.join(fixture, 'start.sh')], {
      env: {...process.env, LIVELY_APP_CDP_PORT: '9777'}, encoding: 'utf8'
    });
    assert.equal(run.status, 0, run.stderr);
    assert(run.stdout.split('\n').includes('--remote-debugging-port=9777'), 'The launcher must use the same CDP port as the scope reader and service');
    console.log('Configured NW.js CDP launch port passed');
  } finally { fs.rmSync(fixture, {recursive: true, force: true}); }
}
