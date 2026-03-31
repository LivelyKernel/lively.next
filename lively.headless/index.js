/* global System */
import { promise } from 'lively.lang';
import { string } from 'lively.lang';
import { transform } from 'lively.ast';

let containerized = typeof process !== 'undefined' && process.env.CONTAINERIZED || false; // eslint-disable-line no-undef
let packagePath = System.decanonicalize('lively.headless/').replace('file://', '');
let puppeteer = typeof System._nodeRequire === 'function' ? System._nodeRequire('puppeteer') : null;

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
      maxConsoleEntries: 200,
      ...options
    };
    this.id = string.newUUID();
    if (options.browser)
       this.constructor.browser = browser;
    this.browser = options.browser || null;
    this.error = null;
    this.page = null;
    this.consoleEntries = [];
    this.state = SESSION_STATE.CLOSED;
  }

  async ensureBrowser () {
      const newBrowser = (this.constructor.browser = await puppeteer.launch({
         userDataDir: packagePath + 'chrome-data-dir',
         ...containerized ? { executablePath: 'chromium' } : {},
         headless: 'new',
         args: [
          // This is necessary to run headless chrome inside of docker containers.
          // Be aware, that disabling sand-boxing comes with heavy security implications!
          // UPDATE: 13.07.2023 We recently removed the docker setup for which this option was originally introduced.
          // However, removing this option lead to instant crashes of chromium on some of our machines and in CI.
          // Wo do not know why that is, since the flag was not necessary previous to the introduction of the docker setup.
          "--no-sandbox",
         ]
       }));
       return this.constructor.browser || newBrowser;
  }

  isReady () { return this.state === SESSION_STATE.OPEN; }

  get url () { return this.page ? this.page.url() : null; }
  set url (url) { this.open(url, () => {}); }

  recordConsoleEntry (entry) {
    const timestamp = new Date().toISOString();
    const normalized = { timestamp, ...entry };
    this.consoleEntries.push(normalized);
    const overflow = this.consoleEntries.length - this.options.maxConsoleEntries;
    if (overflow > 0) this.consoleEntries.splice(0, overflow);
    return normalized;
  }

  attachPageEventHandlers (page) {
    page.on('console', msg => {
      this.recordConsoleEntry({
        kind: 'console',
        level: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    page.on('pageerror', err => {
      this.recordConsoleEntry({
        kind: 'pageerror',
        level: 'error',
        text: err?.stack || String(err)
      });
    });
  }

  recentConsoleErrors () {
    return this.consoleEntries.filter(({ level }) => ['error', 'pageerror'].includes(level));
  }

  formatConsoleEntry (entry) {
    const parts = [`[${entry.timestamp}]`, entry.kind === 'pageerror' ? 'pageerror' : `console.${entry.level}`];
    if (entry.location?.url) {
      const { url, lineNumber, columnNumber } = entry.location;
      parts.push(`${url}:${lineNumber ?? 0}:${columnNumber ?? 0}`);
    }
    parts.push(entry.text);
    return parts.join(' ');
  }

  printRecentConsoleErrors (context = 'Headless session failed') {
    const recentErrors = this.recentConsoleErrors();
    if (!recentErrors.length) {
      console.error(`[lively.headless] ${context}. No browser console errors captured.`);
      return;
    }

    console.error(`[lively.headless] ${context}. Recent browser console errors:`);
    recentErrors.forEach(entry => console.error(`[lively.headless] ${this.formatConsoleEntry(entry)}`));
  }

  summarizeRecentConsoleErrors () {
    const recentErrors = this.recentConsoleErrors();
    if (!recentErrors.length) return null;
    return recentErrors.map(entry => this.formatConsoleEntry(entry)).join('\n');
  }

  async open (url, aliveTestFn) {
    this.state = SESSION_STATE.LOADING;
    if (this.page) await this.close();
    this.consoleEntries = [];

    const browser = await this.ensureBrowser();
    const page = this.page = await browser.newPage();
    this.attachPageEventHandlers(page);
    const { options: { aliveTimeout, aliveRepeatTimeout } } = this;

    try {
      await page.goto(url);
      let startTime = Date.now();
      while (true) {
        if (Date.now() - startTime > aliveTimeout) {
          const errorSummary = this.summarizeRecentConsoleErrors();
          const detail = errorSummary
            ? `\nBrowser console errors:\n${errorSummary}`
            : '\nNo browser console errors captured.';
          throw new Error(`page for ${url} failed to load (timed out after ${aliveTimeout / 1000}s)${detail}`);
        }
        if (await aliveTestFn(this)) break;
        await promise.delay(aliveRepeatTimeout);
      }
      this.state = SESSION_STATE.OPEN;
      return this;
    } catch (err) {
      if (String(err?.message || err).includes('failed to load')) {
        this.printRecentConsoleErrors(`Timed out loading ${url}`);
      }
      console.error(`[lively.headless] ${err.stack}`);
      try { await this.close(); } catch (err) {}
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
