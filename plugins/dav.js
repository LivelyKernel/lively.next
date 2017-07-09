/*global System, process*/

import { obj } from "lively.lang";

// FIXME...
var DavHandler, FsTree, jsDavPlugins = {};
(function loadJsDAV() {
  // jsDAV shows unimportant console logs while loading, hide those...
  let log = console.log;
  console.log = () => {}
  try {
    DavHandler = System._nodeRequire(`jsDAV/lib/DAV/handler`);
    FsTree = System._nodeRequire(`jsDAV/lib/DAV/backends/fs/tree`);
    jsDavPlugins.browser = System._nodeRequire(`jsDAV/lib/DAV/plugins/browser.js`);
  }
  catch (err) { console.error(`cannot load jsdav:` , err); }
  finally { console.log = log; }  
})();



export default class LivelyDAVPlugin {

  constructor() {
    this.options = {
      rootDirectory: process.cwd(),
      excludedDirectories: [],
      excludedFiles: ['.DS_Store'],
      includedFiles: undefined/*allow all*/,
    }
  }

  setOptions(opts) { Object.assign(this.options, opts); }

  get pluginId() { return "jsdav"; }

  get after() { return ["cors", "socketio", "eval"]; }

  setup({server}) {
    server.once("close", () => this.server = null);
    this.server = server;
    this.patchServerForJsDAV(server);
  }

  patchServerForJsDAV(server, thenDo) {
    // this is what jsDAV expects...
    server.tree = FsTree.new(this.options.rootDirectory);
    server.tmpDir = './tmp'; // httpPut writes tmp files
    server.options = {};
    // for showing dir contents
    server.plugins = {...jsDavPlugins};

    // https server has slightly different interface
    if (!server.baseUri) server.baseUri = '/';
    if (!server.getBaseUri) server.getBaseUri = () => server.baseUri;
  }

  handleRequest(req, res, next) {
    var path = '';
    // Fix URL to allow non-root installations
    // In Apache config, set:
    //   RequestHeader set x-lively-proxy-path /[your-path]
    if (req.headers['x-lively-proxy-path']) {
      path = req.headers['x-lively-proxy-path'];
      if (path.endsWith("/")) path = path.slice(0, -1);
    }
    this.server.baseUri = path + '/';
    req.url = path + req.url;
    this.callDAV(req, res);
  }

  callDAV(req, res) {
    var handler = new DavHandler(this.server, req, res);
    if (handler.plugins.browser) {
      var origGetAssetUrl = handler.plugins.browser.getAssetUrl;
      handler.plugins.browser.getAssetUrl = function (assetName) {
        if (assetName === "favicon.ico")
          return this.handler.server.getBaseUri() + assetName;
        return origGetAssetUrl.call(this, assetName)
      }
    }
  }

  close() {
    this.server = null;
  }

}
