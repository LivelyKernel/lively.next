const puppeteer = require('puppeteer');

const aliveTimeout = 300 * 1000;
const aliveRepeatTimeout = 300;
let page;

(async () => {
  const browser = await puppeteer.launch({args: [
    '--no-sandbox',
  ]});
  page = await browser.newPage();

  try {
    console.log('ℹ️ Began Loading lively.');
    await page.goto('http://localhost:9011/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=true');
    const startTime = Date.now();
    while (true) {
      if (Date.now() - startTime > aliveTimeout) {
        process.exit(1);
      }
      if (await page.evaluate(`typeof $world !== 'undefined' && $world.name == 'aLivelyWorld'`)) break;
      await new Promise((resolve) => setTimeout(resolve, aliveRepeatTimeout));
    };
    console.log('✅ Lively loaded successfully.');
    process.exit(0);
  } catch (err) {
    console.log(err);
    console.log('❌ Error loading lively.');
    process.exit(1);
  }
})();

