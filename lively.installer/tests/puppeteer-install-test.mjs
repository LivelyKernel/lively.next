// Runs the Puppeteer browser step of install.sh in a fixture checkout and checks that
// a missing or failing browser installation warns without stopping the installation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const installer = fs.readFileSync(new URL('../../install.sh', import.meta.url), 'utf8');
assert.match(installer, /PUPPETEER_SKIP_DOWNLOAD=true "\$BUN_PATH" install --frozen-lockfile/,
  'the package installation leaves the browser download to the browser step');
const browserStep = installer.split('section "Installing Puppeteer browser"')[1]?.split('\nsection ')[0];
assert.ok(browserStep, 'install.sh has a Puppeteer browser step');

const require = createRequire(new URL('../../lively.headless/package.json', import.meta.url));
const puppeteerDirectory = path.dirname(require.resolve('puppeteer/install.mjs'));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively puppeteer install-'));
const dependency = path.join(fixture, 'lively.headless', 'node_modules', 'puppeteer');
const executable = path.join(fixture, 'test chrome');

function runBrowserStep () {
  const result = spawnSync('bash', ['-c', `step() { echo "$1"; }\nwarn() { echo "[!] $1"; }\n${browserStep}`], {
    cwd: fixture,
    encoding: 'utf8',
    input: '',
    timeout: 20000,
    env: {
      ...process.env,
      PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
      lv_next_dir: fixture,
      PUPPETEER_SKIP_DOWNLOAD: 'true',
      PUPPETEER_EXECUTABLE_PATH: executable
    }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, 'the browser step never stops the installation\n' + result.stderr);
  return result.stdout;
}

try {
  fs.mkdirSync(path.dirname(dependency), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'lively.headless', 'package.json'), '{}');
  fs.symlinkSync(puppeteerDirectory, dependency, process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(executable, '');
  assert.match(runBrowserStep(), /Chrome for headless tests is ready/);

  fs.rmSync(executable);
  assert.match(runBrowserStep(), /\[!\] Chrome for headless tests is unavailable/, 'a missing browser warns');

  fs.rmSync(dependency);
  assert.match(runBrowserStep(), /\[!\] Chrome for headless tests is unavailable/, 'a missing Puppeteer warns');

  fs.mkdirSync(dependency);
  fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ name: 'puppeteer', main: 'index.cjs' }));
  fs.writeFileSync(path.join(dependency, 'install.mjs'), 'throw new Error("download failed");');
  assert.match(runBrowserStep(), /\[!\] Chrome for headless tests is unavailable/, 'a failed download warns');
  console.log('Puppeteer browser installation checks passed.');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
