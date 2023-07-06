/* global System */
import { promise } from 'lively.lang';
import { string } from 'lively.lang';
import { transform } from 'lively.ast';

let containerized = process.env.CONTAINERIZED || false;
let packagePath = System.decanonicalize('lively.headless/').replace('file://', '');
let puppeteer = System._nodeRequire('puppeteer');

var headlessSessions = headlessSessions || new Set();

async function test () {
  let url = 'http://10.0.1.8:9011/worlds/default?nologin';
  let sess = await HeadlessSession.open(url, sess => sess.runEval('!!$world'));
  await sess.screenshot();
  await sess.dispose();
}

const SESSION_STATE = {
  CLOSED: 'closed', ERRORED: 'errored', LOADING: 'loading', OPEN: 'open'
};

export class HeadlessSession {
  static list () { return Array.from(headlessSessions); }

  static findSessionById (id) { return this.list().find(ea => ea.id === id); }

  static create (opts) {
    const sess = new this(opts);
    headlessSessions.add(sess);
    return sess;
  }

  static open (url, aliveTestFn, opts) { return this.create(opts).open(url, aliveTestFn); }

  constructor (options = {}) {
    this.options = {
      screenshotPath: packagePath + 'screenshots/test.png',
      aliveTimeout: 300 * 1000,
      aliveRepeatTimeout: 300,
      ...options
    };
    this.id = string.newUUID();
    if (options.browser)
       this.constructor.browser = browser;
    this.browser = options.browser || null;
    this.error = null;
    this.page = null;
    this.state = SESSION_STATE.CLOSED;
  }

  async ensureBrowser () {
      const newBrowser = (this.constructor.browser = await puppeteer.launch({
         userDataDir: packagePath + 'chrome-data-dir',
         ...containerized ? { executablePath: 'chromium' } : {},
         // headless: false,
         // args: ["--disk-cache-dir", packagePath + "chrome-cache-dir"]
       }));
       return this.constructor.browser || newBrowser;
  }

  isReady () { return this.state === SESSION_STATE.OPEN; }

  get url () { return this.page ? this.page.url() : null; }
  set url (url) { this.open(url, () => {}); }

  async open (url, aliveTestFn) {
    this.state = SESSION_STATE.LOADING;
    if (this.page) await this.close();

    const browser = await this.ensureBrowser();
    const page = this.page = await browser.newPage();
    const { options: { aliveTimeout, aliveRepeatTimeout } } = this;

    try {
      await page.goto(url);
      let startTime = Date.now();
      while (true) {
        if (Date.now() - startTime > aliveTimeout) {
          throw new Error(`page for ${url} failed to load`);
        }
        if (await aliveTestFn(this)) break;
        await promise.delay(aliveRepeatTimeout);
      }
      this.state = SESSION_STATE.OPEN;
      return this;
    } catch (err) {
      console.error(`[lively.headless] ${err.stack}`);
      try { this.close(); } catch (err) {}
      this.state = SESSION_STATE.ERRORED;
      this.error = String(err.stack);
      throw err;
    }
  }

  async close () {
    this.error = null;
    if (!this.page) return false;
    await this.page.close();
    this.page = null;
    return true;
  }

  async dispose () {
    await this.close();
    headlessSessions.delete(this);
    let b = this.constructor.browser;
    if (headlessSessions.size === 0 && b) {
      b.close();
      this.constructor.browser = null;
    }
  }

  async screenshot (screenshotPath) {
    if (!screenshotPath) screenshotPath = this.options.screenshotPath;
    return await this.page ? this.page.screenshot({ path: screenshotPath }) : null;
  }

  async runEval (expr) {
    if (!this.page) throw new Error('No page loaded');
    let fnExpr = '(async ' + transform.wrapInFunction(expr) + ')';
    let fn = eval(fnExpr);
    return this.page.evaluate(fn);
  }
}
