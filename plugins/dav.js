/*global System, process*/

import { obj } from "lively.lang";

// FIXME...
var serverDir = System.decanonicalize("lively.server/").replace("file://", ""),
    DavHandler = System._nodeRequire(`${serverDir}/node_modules/jsDAV/lib/DAV/handler`),
    FsTree = System._nodeRequire(`${serverDir}/node_modules/jsDAV/lib/DAV/backends/fs/tree`),
    defaultPlugins = System._nodeRequire(`${serverDir}/node_modules/jsDAV/lib/DAV/server`).DEFAULT_PLUGINS;


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
    server.plugins = obj.select(defaultPlugins, ["browser"]);

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
    new DavHandler(this.server, req, res);
  }

  close() {
    this.server = null;
  }

}
