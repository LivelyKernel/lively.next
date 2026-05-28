// NW.js desktop app configuration.
// Excludes plugins that require puppeteer (test-runner, headless)
// since NW.js provides its own Chromium instance.

var config = {
  server: {
    authServerURL: "https://auth.lively-next.org",
    port: 9011,
    hostname: "127.0.0.1",
    plugins: [
      "lively.server/plugins/cors.js",
      "lively.server/plugins/dav.js",
      "lively.server/plugins/eval.js",
      "lively.server/plugins/l2l.js",
      "lively.server/plugins/lib-lookup.js",
      "lively.server/plugins/proxy.js",
      "lively.server/plugins/remote-shell.js",
      "lively.server/plugins/socketio.js",
      "lively.server/plugins/world-loading.js",
      "lively.server/plugins/file-upload.js",
      "lively.server/plugins/objectdb.js",
      "lively.server/plugins/subserver.js"
    ]
  }
}

export default config;
