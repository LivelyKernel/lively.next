const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const root = process.env.LIVELY_TEST_RUNTIME_ROOT || path.resolve(__dirname, '../..');
const packageRoot = path.join(root, 'lively.headless');
const packageRequire = createRequire(path.join(packageRoot, 'index.js'));
const source = fs.readFileSync(path.resolve(__dirname, '../../lively.headless/index.js'), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export class HeadlessSession', 'class HeadlessSession');
const Session = vm.runInNewContext(`${source}\nHeadlessSession`, {
  process, console,
  string: { newUUID: require('node:crypto').randomUUID },
  System: { decanonicalize: () => pathToFileURL(packageRoot + '/').href, _nodeRequire: packageRequire }
});
const browsers = [];
(async () => {
  for (let i = 0; i < 2; i++) browsers.push(await new Session().ensureBrowser());
  const profiles = browsers.map(browser => browser.process().spawnargs.find(arg => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length));
  assert.notEqual(profiles[0], profiles[1], 'sessions must have independent profiles');
  assert.ok(profiles.every(profile => !profile.startsWith(packageRoot)), 'profiles belong to Puppeteer, not the package checkout');
  await Promise.all(browsers.map(browser => browser.close()));
  assert.ok(profiles.every(profile => !fs.existsSync(profile)), 'Puppeteer removes temporary profiles when closed');
  console.log('Headless sessions use independent temporary profiles and remove them on close');
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  await Promise.all(browsers.map(browser => browser.close()));
});
