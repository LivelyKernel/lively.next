/* global System, process, Buffer */
import { resource } from 'lively.resources';
import { string, promise } from 'lively.lang';
import * as child from 'node:child_process';
const tar = System._nodeRequire('tar-fs');
import stream from 'stream';
import util from 'util';
import zlib from 'zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeSourceHashes } from '../source-hashes.js';
import { handleDAVRequest, contentType } from '../dav-handler.js';

const COMPRESSABLE_URLS = [
  'components_cache'
];

const compression = 'gzip'; // can be either 'gzip' or 'brotli' where 'brotli' takes drastically longer to compress but yields slightly smaller bundles;

/** The desktop app serves precompressed bundles without a content encoding. */
function staticContentType (filePath) {
  return contentType(/\.(js|css)\.(br|gz)$/.test(filePath) ? filePath.slice(0, -3) : filePath);
}

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
      child.execFile('sh', ['-c', `find "$1" | entr -n -r -d -s 'curl --header "x-lively-refresh-file-hashes: true" http://localhost:${port}/file-hash-regeneration.js'`, 'sh', this.options.rootDirectory], () => { });
    }
    this.fileHashes = {};
    this.computeFileHashes();
  }

  async computeFileHashes () {
    if (this._skipHashUpdate) {
      this._skipHashUpdate = false;
      return;
    }
    console.log('[lively.server] creating file hash map');
    this.fileHashes = await computeSourceHashes(pathToFileURL(this.options.rootDirectory).href);
    console.log('[lively.server] finished file hash map');

    // Skip the tar+gzip step when a pre-built snapshot is available
    // (bundled distributions set LIVELY_PREBUILT_LIBRARY_SNAPSHOT so the
    // server doesn't re-generate the blob on every launch).
    const prebuiltSnapshot = process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT;
    if (prebuiltSnapshot && fs.existsSync(prebuiltSnapshot)) {
      try {
        console.log('[lively.server] loading pre-built library snapshot: ' + prebuiltSnapshot);
        memStore.compressedLibrary = fs.readFileSync(prebuiltSnapshot);
        console.log('[lively.server] pre-built library snapshot loaded');
        return;
      } catch (err) {
        console.warn('[lively.server] failed to load pre-built snapshot, regenerating:', err.message);
      }
    }

    console.log('[lively.server] creating library snapshot...');
    await this.compressLibraryCode();
    console.log('[lively.server] finished library snapshot');
  }

  compressLibraryCode () {
    if (this._curr) {
      console.log('[lively.server] already compressing library code!');
      return this._curr.promise;
    }
    const res = this._curr = promise.deferred();
    let compressedLibrary = new WMStrm('compressedLibrary');
    const cachedDirs = ['esm_cache', 'lively.morphic', 'lively.lang', 'lively.bindings', 'lively.ast', 'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.resources', 'lively.storage', 'lively.storage', 'lively.notifications', 'lively.modules', 'lively-system-interface', 'lively.installer', 'lively.serializer2', 'lively.graphics', 'lively.keyboard', 'lively.changesets', 'lively.2lively', 'lively.git', 'lively.traits', 'lively.components', 'lively.ide', 'lively.headless', 'lively.freezer', 'lively.collab', 'lively.project', 'lively.user'];

    const excludedDirs = [
      'lively.morphic/objectdb',
      'lively.morphic/assets',
      'lively.morphic/web',
      'lively.classes/build',
      'lively.ide/jsdom.worker.js',
      'lively.headless/chrome-data-dir',
      'lively.freezer/landing-page',
      'lively.freezer/loading-screen',
      'lively.freezer/.swc',
      'lively.freezer/swc-plugin/target',
      'lively.modules/dist'
    ];
    tar.pack(fileURLToPath(System.baseURL), {
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

  /** A no-op; part of the plugin API that the DAV tests call. */
  patchServerForJsDAV (server) {}

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
    const baseURI = path + '/';
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

    if (process.env.LIVELY_DESKTOP_APP === '1' && await this.tryServeStaticFile(req, res)) return;

    const hashedURL = req.url;
    const updatesHash = (hashedURL.endsWith('.js') || hashedURL.endsWith('.cjs')) &&
      (req.method == 'PUT' || !this.fileHashes[hashedURL]);
    if (updatesHash) this._skipHashUpdate = true;

    if (req.method == 'GET' &&
        req.url.endsWith('.json') &&
        req.headers['accept-encoding']?.includes('br') &&
        // fixme
        COMPRESSABLE_URLS.find(url => req.url.includes(url))) {
      // check if there is a brotli compressed version persent and serve that instead
      req.url = req.url.replace('.json', '.br.json');
      res.setHeader('content-encoding', 'br');
    }

    const target = await handleDAVRequest(req, res, { rootDirectory: this.options.rootDirectory, baseURI });

    // Only if no error was thrown, so never for files outside the root,
    // and after a PUT has been written, not the content it replaces.
    if (updatesHash && target) {
      fs.promises.readFile(target.file, 'utf8').then(source => {
        this.fileHashes[hashedURL] = string.hashCode(source);
      }, () => { /* removed meanwhile */ });
    }
  }

  async tryServeStaticFile (req, res) {
    if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) return false;

    let pathname;
    try {
      pathname = decodeURIComponent(String(req.url || '').split('?')[0]);
    } catch (_) {
      return false;
    }
    if (!pathname || pathname.includes('\0')) return false;

    const root = path.resolve(this.options.rootDirectory);
    const target = path.resolve(root, pathname.replace(/^[/\\]+/, ''));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return true;
    }

    let stat;
    try {
      stat = await fs.promises.stat(target);
    } catch (_) {
      return false;
    }
    if (!stat.isFile()) return false;

    res.writeHead(200, {
      'content-type': staticContentType(target),
      'content-length': stat.size,
      'last-modified': stat.mtime.toUTCString()
    });
    if (req.method.toUpperCase() === 'HEAD') {
      res.end();
      return true;
    }

    const readStream = fs.createReadStream(target);
    readStream.on('error', err => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(err.stack || String(err));
      } else {
        res.destroy(err);
      }
    });
    readStream.pipe(res);
    return true;
  }

  close () {
    this.server = null;
  }
}
