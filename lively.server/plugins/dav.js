/* global System, process */

import { resource } from 'lively.resources';
import { string } from 'lively.lang';

const COMPRESSABLE_URLS = [
  'components_cache'
];

// FIXME...
let DavHandler; let FsTree;
const jsDavPlugins = {};
(function loadJsDAV () {
  // jsDAV shows unimportant console logs while loading, hide those...
  const log = console.log;
  const error = console.error;
  console.error = (...err) => {
    // jsDav just deliberately logs erros, and can not be turned silent
    // so we will do that here:
    if (typeof err[1] === 'object' && err[1].type == 'FileNotFound') {
      console.log('[jsDav] 404 - ', err[1].message);
    } else {
      error(...err);
    }
  };
  console.log = () => {};
  try {
    DavHandler = System._nodeRequire('jsDAV/lib/DAV/handler');
    FsTree = System._nodeRequire('jsDAV/lib/DAV/backends/fs/tree');
    jsDavPlugins.browser = System._nodeRequire('jsDAV/lib/DAV/plugins/browser.js');
  } catch (err) { console.error('cannot load jsdav:', err); } finally { console.log = log; }
})();

export default class LivelyDAVPlugin {
  constructor () {
    this.options = {
      rootDirectory: process.cwd(),
      excludedDirectories: [],
      excludedFiles: ['.DS_Store'],
      includedFiles: undefined/* allow all */
    };
  }

  setOptions (opts) { Object.assign(this.options, opts); }

  get pluginId () { return 'jsdav'; }

  toString () { return `<${this.pluginId}>`; }

  get after () { return ['cors', 'socketio', 'eval']; }

  setup ({ server }) {
    server.once('close', () => this.server = null);
    this.server = server;
    this.patchServerForJsDAV(server);
    this.fileHashes = {};
    this.computeFileHashes();
  }

  async computeFileHashes() {
    console.log('[lively.server] creating file hash map')
    const rootDir = resource('file://' + this.options.rootDirectory);
    const filesToHash = await rootDir.dirList('infinity', {
      exclude: (res) => {
	return res.url.includes('lively.next-node_modules') ||
               res.url.includes('.module_cache') || 
               !res.url.startsWith(System.baseURL + 'lively') && !res.url.includes('esm_cache') || 
               res.isFile() && !res.url.endsWith('.js' ) && !res.url.endsWith('.cjs')
        }
      });
    for (let file of filesToHash) {
      if (!file.isFile()) continue;
      this.fileHashes[file.url.replace(System.baseURL, '/').replace('/esm_cache', 'esm://cache')] = string.hashCode(await file.read());
    }
    console.log('[lively.server] finished file hash map')
 }

  patchServerForJsDAV (server, thenDo) {
    // this is what jsDAV expects...
    server.tree = FsTree.new(this.options.rootDirectory);
    server.tmpDir = './tmp'; // httpPut writes tmp files
    server.options = {};
    // for showing dir contents
    server.plugins = { ...jsDavPlugins };

    // https server has slightly different interface
    if (!server.baseUri) server.baseUri = '/';
    if (!server.getBaseUri) server.getBaseUri = () => server.baseUri;
  }

  handleRequest (req, res, next) {
    let path = '';
    // Fix URL to allow non-root installations
    // In Apache config, set:
    //   RequestHeader set x-lively-proxy-path /[your-path]
    if (req.headers['x-lively-proxy-path']) {
      path = req.headers['x-lively-proxy-path'];
      if (path.endsWith('/')) path = path.slice(0, -1);
    }
    this.server.baseUri = path + '/';
    req.url = path + req.url;

    if (req.url == '/__JS_FILE_HASHES__') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(this.fileHashes));
      return;
    }

    if (req.url.endsWith('.js') || req.url.endsWith('.cjs')) {
      if (req.method == 'PUT' || !this.fileHashes[req.url]) {
        resource('file://' + this.options.rootDirectory).join(decodeURIComponent(req.url)).read().then(source => {
          this.fileHashes[req.url.replace('/esm_cache', 'esm://cache')] = string.hashCode(source);
        }).catch(err => {
          // ignore
        });
      }
    }

    if (req.method == 'GET' &&
        req.url.endsWith('.json') &&
        req.headers['accept-encoding'].includes('br') &&
        // fixme
        COMPRESSABLE_URLS.find(url => req.url.includes(url))) {
      // check if there is a brotli compressed version persent and serve that instead
      req.url = req.url.replace('.json', '.br.json');
      res.setHeader('content-encoding', 'br');
    }

    this.callDAV(req, res);
  }

  callDAV (req, res) {
    const handler = new DavHandler(this.server, req, res);
    if (handler.plugins.browser) {
      const origGetAssetUrl = handler.plugins.browser.getAssetUrl;
      handler.plugins.browser.getAssetUrl = function (assetName) {
        if (assetName === 'favicon.ico') { return this.handler.server.getBaseUri() + assetName; }
        return origGetAssetUrl.call(this, assetName);
      };
    }
  }

  close () {
    this.server = null;
  }
}
