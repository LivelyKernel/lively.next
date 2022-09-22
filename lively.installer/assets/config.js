var config = {
  remoteCommitDB: "https://sofa.lively-next.org/objectdb-morphicdb-commits",
  remoteVersionDB: "https://sofa.lively-next.org/objectdb-morphicdb-version-graph",
  remoteSnapshotLocation: "https://lively-next.org/lively.morphic/objectdb/morphicdb/snapshots/",
  pythonServer: {
    port: 9942,
    hostname: "127.0.0.1",
    path: "/",
    ssl: false,
  },
  server: {
    authServerURL: "https://auth.lively-next.org",
    port: 9011,
    hostname: "0.0.0.0",
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
      "lively.server/plugins/subserver.js",
      "lively.server/plugins/test-runner.js",
      "lively.headless/subserver.js"
    ]
  }
}

export default config;
