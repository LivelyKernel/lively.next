const path = require('node:path');
const { createRequire } = require('node:module');
const puppeteer = createRequire(path.join(__dirname, '../lively.headless/package.json'))('puppeteer');

const aliveTimeout = 300 * 1000;
const aliveRepeatTimeout = 300;
const bootURL = process.env.LIVELY_BOOT_URL || 'http://localhost:9011';

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);
    const externalDependencies = [];
    const serverOrigin = new URL(bootURL).origin;
    page.on('request', request => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== serverOrigin) {
        if (!['image', 'font', 'media'].includes(request.resourceType())) externalDependencies.push(request.url());
        return request.abort();
      }
      return request.continue();
    });
    console.log('ℹ️ Began Loading lively with external HTTP blocked.');
    await page.goto(new URL('/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=true', bootURL).href);
    const startTime = Date.now();
    while (!await page.evaluate(`typeof $world !== 'undefined' && $world.isWorld && $world._uiInitialized`)) {
      if (Date.now() - startTime > aliveTimeout) throw new Error('Timed out initializing the Lively UI');
      await new Promise(resolve => setTimeout(resolve, aliveRepeatTimeout));
    }
    if (externalDependencies.length) throw new Error('Uncached external dependencies: ' + externalDependencies.join(', '));
    console.log('✅ Lively loaded successfully offline.');
  } catch (err) {
    console.error(err);
    console.error('❌ Error loading lively.');
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
})();
