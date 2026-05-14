const puppeteer = require('puppeteer');

const url = process.argv[2] || 'http://localhost:9011/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=true';
const timeoutMs = Number(process.argv[3] || process.env.LIVELY_BOOT_TIMEOUT || 60000);
const isLoadRoute = /\/(?:worlds|projects)\/load/.test(url);
const requireWorld = process.argv.includes('--require-world') || isLoadRoute;
const proveEdit = process.argv.includes('--prove-edit') || requireWorld;
const pollMs = 500;

/**
 * Determines whether a Puppeteer request is part of the boot-critical page or
 * bundle surface.
 * @param {import('puppeteer').HTTPRequest} request - Request observed by the page.
 * @returns {boolean} True when a failed request should be included in diagnostics.
 */
function isBundleResource (request) {
  const type = request.resourceType();
  return ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type);
}

/**
 * Classifies failed requests that should stop the boot proof immediately.
 * @param {{type: string, failure: string}} entry - Normalized failed request record.
 * @returns {boolean} True when the failure likely blocks the page from booting.
 */
function isFatalFailedRequest (entry) {
  /*
   * During world/project transitions the browser can cancel in-flight fetches
   * from the loading screen once the new world takes over. Those aborted
   * background fetches are useful diagnostics, but treating them as fatal makes
   * a healthy transition look broken.
   */
  if (entry.failure === 'net::ERR_ABORTED' && ['xhr', 'fetch'].includes(entry.type)) return false;
  return true;
}

/**
 * Reads the current browser-side boot state in one serialized page evaluation.
 * @param {import('puppeteer').Page} page - Puppeteer page under test.
 * @returns {Promise<object>} Snapshot of DOM visibility, world state, and load errors.
 */
async function pageState (page) {
  return page.evaluate(() => {
    const hasWorld = typeof globalThis.$world !== 'undefined' && !!globalThis.$world;
    const hasLoadingScreen = hasWorld &&
      typeof globalThis.$world.get === 'function' &&
      !!globalThis.$world.get('loading screen');
    const loadError = globalThis.__loadError__;
    const visibleContent = !!document.body && Array.from(document.body.children).some(el => {
      const style = globalThis.getComputedStyle(el);
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        el.getBoundingClientRect().width > 0 &&
        el.getBoundingClientRect().height > 0;
    });
    let morphCount = null;
    if (hasWorld && globalThis.$world.withAllSubmorphsDo) {
      morphCount = 0;
      globalThis.$world.withAllSubmorphsDo(() => morphCount++);
    }
    return {
      href: location.href,
      title: document.title,
      bodyText: document.body && document.body.innerText && document.body.innerText.slice(0, 300),
      visibleContent,
      hasWorld,
      hasLoadingScreen,
      worldName: hasWorld && globalThis.$world.name,
      morphCount,
      loadError: loadError && (loadError.stack || loadError.message || String(loadError)),
      livelyKeys: Object.keys(globalThis.lively || {}).slice(0, 40)
    };
  });
}

/**
 * Proves the loaded world is editable by adding and updating a label morph.
 * @param {import('puppeteer').Page} page - Puppeteer page with a completed world load.
 * @returns {Promise<object>} Counts and ownership/value checks for the inserted morph.
 */
async function runEditProof (page) {
  return page.evaluate(async () => {
    if (!globalThis.$world) throw new Error('No world is available for edit proof');
    if (typeof globalThis.$world.get === 'function' && globalThis.$world.get('loading screen')) {
      throw new Error('World transition did not complete before edit proof');
    }
    /**
     * Looks up exports from either the freezer runtime or the live SystemJS
     * registry after the loading screen has transitioned into the real world.
     * @param {string} packageName - Package id, such as "lively.morphic".
     * @returns {object} Loaded module exports for the requested package.
     */
    const loadedPackage = packageName => {
      const rootURL = globalThis.SYSTEM_BASE_URL || location.origin;
      const baseURL = rootURL.endsWith('/') ? rootURL : `${rootURL}/`;
      const decanonicalized = System.decanonicalize(packageName);
      const candidates = [
        packageName,
        `${packageName}/index.js`,
        decanonicalized,
        new URL(decanonicalized, baseURL).href
      ];
      for (const moduleId of candidates) {
        const frozenExports = globalThis.lively &&
          globalThis.lively.FreezerRuntime &&
          globalThis.lively.FreezerRuntime.exportsOf(moduleId);
        if (frozenExports && Object.keys(frozenExports).length) return frozenExports;
        const registeredExports = System.get && System.get(moduleId);
        if (registeredExports && Object.keys(registeredExports).length) return registeredExports;
      }
      throw new Error(`No loaded exports found for ${packageName}`);
    };
    const { morph } = loadedPackage('lively.morphic');
    const { pt } = loadedPackage('lively.graphics');
    const before = globalThis.$world.submorphs.length;
    const label = morph({
      type: 'label',
      name: 'docker compose edit proof',
      value: 'boot proof',
      position: pt(40, 40)
    });
    globalThis.$world.addMorph(label);
    label.value = 'boot proof updated';
    if (label.whenRendered) {
      try { await label.whenRendered(); } catch (err) {}
    }
    return {
      before,
      after: globalThis.$world.submorphs.length,
      added: label.world && label.world() === globalThis.$world,
      value: Array.isArray(label.value) ? label.value[0] : label.value,
      ownerName: label.owner && label.owner.name
    };
  });
}

/**
 * Runs the browser boot proof as a command-line program.
 * @returns {Promise<void>} Resolves after diagnostics are printed and the process exits.
 */
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const diagnostics = {
    url,
    status: null,
    pageErrors: [],
    failedRequests: [],
    httpFailures: [],
    consoleErrors: [],
    consoleWarnings: [],
    state: null,
    editProof: null
  };

  page.on('pageerror', err => diagnostics.pageErrors.push(err.stack || err.message));
  page.on('requestfailed', request => {
    if (!isBundleResource(request)) return;
    diagnostics.failedRequests.push({
      url: request.url(),
      type: request.resourceType(),
      failure: request.failure() && request.failure().errorText
    });
  });
  page.on('response', response => {
    const request = response.request();
    if (response.status() < 400 || !isBundleResource(request)) return;
    diagnostics.httpFailures.push({
      url: response.url(),
      status: response.status(),
      type: request.resourceType()
    });
  });
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text() };
    if (msg.type() === 'error') diagnostics.consoleErrors.push(entry);
    if (msg.type() === 'warning' || msg.type() === 'warn') diagnostics.consoleWarnings.push(entry);
  });

  let success = false;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    diagnostics.status = response && response.status();
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      diagnostics.state = await pageState(page);
      const fatal = diagnostics.pageErrors.length ||
        diagnostics.failedRequests.some(isFatalFailedRequest) ||
        diagnostics.httpFailures.length ||
        diagnostics.consoleErrors.length ||
        diagnostics.state.loadError;
      if (fatal) break;
      const worldReady = diagnostics.state.hasWorld &&
        (!isLoadRoute || !diagnostics.state.hasLoadingScreen);
      if (requireWorld ? worldReady : diagnostics.state.visibleContent) {
        success = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }

    if (success && proveEdit) {
      diagnostics.editProof = await runEditProof(page);
      success = diagnostics.editProof.added &&
        diagnostics.editProof.value === 'boot proof updated' &&
        diagnostics.editProof.after > diagnostics.editProof.before;
      diagnostics.state = await pageState(page);
    }
  } catch (err) {
    diagnostics.pageErrors.push(err.stack || err.message || String(err));
    success = false;
  } finally {
    await browser.close();
  }

  diagnostics.success = success;
  console.log(JSON.stringify(diagnostics, null, 2));
  process.exit(success ? 0 : 1);
})();
