/* global System, process, Buffer */
import { resource } from 'lively.resources';
import { string, promise, fun } from 'lively.lang';
import * as child from 'node:child_process';
const tar = System._nodeRequire('tar-fs');
import stream from 'stream';
import util from 'util';
import zlib from 'zlib';

const COMPRESSABLE_URLS = [
  'components_cache'
];

const compression = 'gzip'; // 'gzip';

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

// use Node.js Writable, otherwise load polyfill
let Writable = stream.Writable;

let memStore = { };

/* Writable memory stream */
function WMStrm (key, options) {
  // allow use without new operator
  if (!(this instanceof WMStrm)) {
    return new WMStrm(key, options);
  }
  Writable.call(this, options); // init super
  this.key = key; // save key
  memStore[key] = new Buffer(''); // empty
}
util.inherits(WMStrm, Writable);

WMStrm.prototype._write = function (chunk, enc, cb) {
  // our memory store stores things in buffers
  let buffer = (Buffer.isBuffer(chunk))
    ? chunk // already is Buffer use it
    : new Buffer(chunk, enc); // string, convert

  // concat to the buffer already there
  memStore[this.key] = Buffer.concat([memStore[this.key], buffer]);
  cb();
};

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

  setup ({ server, port }) {
    server.once('close', () => this.server = null);
    this.server = server;
    if (process.env.ENTR_SUPPORT === '1') {
      child.exec(`find ${process.env.lv_next_dir} | entr -n -r -d -s \'curl --header "x-lively-refresh-file-hashes: true" http://localhost:${port}/file-hash-regeneration.js\'`, () => { });
    }
    this.patchServerForJsDAV(server);
    this.fileHashes = {};
    this.computeFileHashes();
  }

  async computeFileHashes () {
    if (this._skipHashUpdate) {
      this._skipHashUpdate = false;
      return;
    }
    console.log('[lively.server] creating file hash map');
    const rootDir = resource('file://' + this.options.rootDirectory);
    const filesToHash = await rootDir.dirList('infinity', {
      exclude: (res) => {
        return res.url.includes('lively.next-node_modules') ||
               res.url.includes('.module_cache') ||
               !res.url.startsWith(System.baseURL + 'lively') && !res.url.includes('esm_cache') ||
               res.isFile() && !res.url.endsWith('.js') && !res.url.endsWith('.cjs');
      }
    });
    for (let file of filesToHash) {
      if (!file.isFile()) continue;
      this.fileHashes[file.url.replace(System.baseURL, '/').replace('/esm_cache', 'esm://cache')] = string.hashCode(await file.read());
    }
    console.log('[lively.server] finished file hash map');
  }

  compressLibraryCode () {
    if (this._curr) {
      console.log('[lively.server] already compressing library code!');
      return this._curr.promise;
    }
    const res = this._curr = promise.deferred();
    let compressedLibrary = new WMStrm('compressedLibrary');
    const cachedDirs = ['esm_cache', 'lively.morphic', 'lively.lang', 'lively.bindings', 'lively.ast', 'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.resources', 'lively.storage', 'lively.storage', 'lively.notifications', 'lively.modules', 'lively-system-interface', 'lively.installer', 'lively.serializer2', 'lively.graphics', 'lively.keyboard', 'lively.changesets', 'lively.2lively', 'lively.git', 'lively.traits', 'lively.components', 'lively.ide', 'lively.headless', 'lively.freezer', 'lively.collab', 'lively.project', 'lively.user'];

    const excludedDirs = ['lively.morphic/objectdb', 'lively.morphic/assets', 'lively.morphic/web', 'lively.ast/dist', 'lively.classes/build', 'lively.ide/jsdom.worker.js', 'lively.headless/chrome-data-dir', 'lively.freezer/landing-page', 'lively.freezer/loading-screen', 'lively.modules/dist'];
    tar.pack(System.baseURL.replace('file://', ''), {
      ignore (name) {
        if (excludedDirs.find(path => name.includes(path))) return true;
        else return false;
      },
      entries: cachedDirs
    }).pipe(compression === 'brotli' ? zlib.BrotliCompress() : zlib.Gzip()).pipe(compressedLibrary);
    console.log('waiting for result');
    compressedLibrary.on('finish', () => {
      res.resolve(compressedLibrary);
    });
    return res.promise;
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

  async handleRequest (req, res, next) {
    if (req.headers['x-lively-refresh-file-hashes']) {
      await this.computeFileHashes();
      res.writeHead(200);
      res.end();
      return;
    }

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

    if (req.url === '/compressed-sources') {
      res.setHeader('Content-Encoding', compression === 'brotli' ? 'br' : 'gzip');
      if (!memStore.compressedLibrary) {
        await this.compressLibraryCode();
      }
      res.write(memStore.compressedLibrary, 'binary');
      res.end(null, 'binary');
      return;
    }

    if (req.url == '/__JS_FILE_HASHES__') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(this.fileHashes));
      return;
    }

    if (req.url == '/livelyClassesRuntime.js') {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end(await resource(System.baseURL).join('lively.classes/build/runtime.js').read());
      return;
    }

    if (req.url.endsWith('.js') || req.url.endsWith('.cjs')) {
      if (req.method == 'PUT' || !this.fileHashes[req.url]) {
        this._skipHashUpdate = true;
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
