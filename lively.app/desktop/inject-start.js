// NW.js runs this before application scripts, including on later navigations.
(function () {
  const backend = typeof process !== 'undefined' && process.mainModule?.exports?.livelyNative;
  if (!backend || window.location.protocol !== 'file:') return;
  const fs = require('node:fs');
  const { fileURLToPath } = require('node:url');
  // Only the two packaged entry pages receive privileged backend access.
  const trusted = ['lively.freezer/landing-page/index.html', 'lively.freezer/loading-screen/index.html']
    .some(entry => fs.realpathSync(fileURLToPath(backend.baseURL + entry)) === fs.realpathSync(fileURLToPath(window.location.href)));
  if (!trusted) return;
  const localURLs = new Set([backend.legacyOrigin, 'http://127.0.0.1:9011', 'http://localhost:9011', window.location.origin, backend.baseURL.replace(/\/$/, '')]);
  window.livelyNative = Object.freeze({
    ...backend,
    isLocal (url, service) {
      try {
        const parsed = new URL(url);
        parsed.pathname = parsed.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
        return [...localURLs].some(base => parsed.href === base + '/' + service);
      } catch (_) { return false; }
    },
    route (route) {
      const url = new URL(route, 'http://desktop/');
      if (url.pathname === '/dashboard/') return backend.dashboardURL;
      url.searchParams.set('route', url.pathname.startsWith('/projects/') ? 'projects' : 'worlds');
      return backend.baseURL + 'lively.freezer/loading-screen/index.html' + url.search;
    }
  });
  window.SYSTEM_BASE_URL = backend.baseURL;
  window.SERVER_URL = backend.legacyOrigin;
})();
