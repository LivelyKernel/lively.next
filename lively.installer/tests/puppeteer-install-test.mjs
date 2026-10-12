import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../../lively.headless/package.json', import.meta.url));
const puppeteerDirectory = path.dirname(require.resolve('puppeteer/install.mjs'));
const installer = fs.readFileSync(new URL('../../install.sh', import.meta.url), 'utf8');
const browserStep = installer.split('section "Installing Puppeteer browser"')[1]?.split('section "Building SWC plugin"')[0];
assert.ok(browserStep, 'The browser installation phase must be exercised');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively puppeteer install-'));
try {
  const owner = path.join(fixture, 'lively.headless');
  const dependency = path.join(owner, 'node_modules', 'puppeteer');
  const executable = path.join(fixture, 'test chrome');
  fs.mkdirSync(path.dirname(dependency), {recursive: true});
  fs.writeFileSync(path.join(owner, 'package.json'), '{}');
  fs.symlinkSync(puppeteerDirectory, dependency, process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(executable, 'fixture: browser download is skipped');
  const run = () => spawnSync('bash', ['-c', `lv_next_dir="$LIVELY_INSTALL_FIXTURE"\nstep() { :; }\n${browserStep}`], {
    cwd: fixture, encoding: 'utf8', timeout: 5000,
    env: {...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
      LIVELY_INSTALL_FIXTURE: fixture, PUPPETEER_SKIP_DOWNLOAD: 'true', PUPPETEER_EXECUTABLE_PATH: executable}
  });
  assert.equal(fs.existsSync(path.join(fixture, 'node_modules', 'puppeteer')), false);
  const installed = run();
  assert.equal(installed.status, 0, installed.stderr || installed.error?.message);
  assert.ok(installed.stdout.includes(`Puppeteer Chrome ready at ${executable}`));
  fs.rmSync(executable);
  const missingBrowser = run();
  assert.equal(missingBrowser.error, undefined);
  assert.notEqual(missingBrowser.status, 0, 'A missing browser must fail installation');
  fs.rmSync(dependency);
  const missingDependency = run();
  assert.equal(missingDependency.error, undefined, 'A missing dependency must exit without waiting for stdin');
  assert.notEqual(missingDependency.status, 0);
  console.log('Workspace-owned Puppeteer installation and failure checks passed.');
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
