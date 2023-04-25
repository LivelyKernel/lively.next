/* global fetch, DOMParser, XPathEvaluator, XPathResult, Namespace,System,global,process,XMLHttpRequest,Buffer */

import Resource from './resource.js';
import { applyExclude } from './helpers.js';
import { promise, num } from 'lively.lang';

class XPathQuery {
  constructor (expression) {
    this.expression = expression;
    this.contextNode = null;
    this.xpe = new XPathEvaluator();
  }

  establishContext (node) {
    if (this.nsResolver) return;
    const ctx = node.ownerDocument ? node.ownerDocument.documentElement : node.documentElement;
    if (ctx !== this.contextNode) {
      this.contextNode = ctx;
      this.nsResolver = this.xpe.createNSResolver(ctx);
    }
  }

  manualNSLookup () {
    this.nsResolver = function (prefix) {
      return Namespace[prefix.toUpperCase()] || null;
    };
    return this;
  }

  findAll (node, defaultValue) {
    this.establishContext(node);
    const result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null);
    const accumulator = [];
    let res = null;
    while (res = result.iterateNext()) accumulator.push(res);
    return accumulator.length > 0 || defaultValue === undefined ? accumulator : defaultValue;
  }

  findFirst (node) {
    this.establishContext(node);
    const result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null);
    return result.iterateNext();
  }
}

function davNs (xmlString) {
  // finds the declaration of the webdav namespace, usually "d" or "D"
  const davNSMatch = xmlString.match(/\/([a-z]+?):multistatus/i);
  return davNSMatch ? davNSMatch[1] : 'd';
}

function propfindRequestPayload () {
  return `<?xml version="1.0" encoding="utf-8" ?>
    <D:propfind xmlns:D="DAV:">
      <D:prop>
        <D:creationdate/>
        <D:getcontentlength/>
        <D:getcontenttype/>
        <D:getetag/>
        <D:getlastmodified/>
        <D:resourcetype/>
      </D:prop>
    </D:propfind>`;
}

const propertyNodeMap = {
  getlastmodified: 'lastModified',
  creationDate: 'created',
  getetag: 'etag',
  getcontentlength: 'size',
  resourcetype: 'type', // collection or file
  getcontenttype: 'contentType' // mime type
};
function readPropertyNode (propNode, result = {}) {
  const tagName = propNode.tagName.replace(/[^:]+:/, '');
  const key = propertyNodeMap[tagName];
  let value = propNode.textContent;
  switch (key) {
    case 'lastModified':
    case 'created': value = new Date(value); break;
    case 'size': value = Number(value); break;
    default:
    // code
  }
  result[key] = value;
  return result;
}

function readXMLPropfindResult (xmlString) {
  // the xmlString looks like this:
  // <?xml version="1.0" encoding="utf-8"?>
  // <d:multistatus xmlns:d="DAV:" xmlns:a="http://ajax.org/2005/aml">
  //   <d:response>
  //     <d:href>sub-dir/</d:href>
  //     <d:propstat>
  //       <d:prop>
  //         <d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">Fri, 24 Jun 2016 09:58:20 -0700</d:getlastmodified>
  //         <d:resourcetype>
  //           <d:collection/>
  //         </d:resourcetype>
  //       </d:prop>
  //       <d:status>HTTP/1.1 200 Ok</d:status>
  //     </d:propstat>
  //   </d:response>
  // ...
  // </d:multistatus>

  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const ns = davNs(xmlString);
  const nodes = new XPathQuery(`/${ns}:multistatus/${ns}:response`).findAll(doc.documentElement);
  const urlQ = new XPathQuery(`${ns}:href`);
  const propsQ = new XPathQuery(`${ns}:propstat/${ns}:prop`);

  return nodes.map(node => {
    const propsNode = propsQ.findFirst(node);
    const props = Array.from(propsNode.childNodes).reduce((props, node) =>
      readPropertyNode(node, props), {});
    const urlNode = urlQ.findFirst(node);
    props.url = urlNode.textContent || urlNode.text; // text is FIX for IE9+;
    return props;
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// MIT License Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>
// https://github.com/sindresorhus/binary-extensions
const binaryExtensions = ['3ds', '3g2', '3gp', '7z', 'a', 'aac', 'adp', 'ai', 'aif', 'aiff', 'alz', 'ape', 'apk', 'ar', 'arj', 'asf', 'au', 'avi', 'bak', 'bh', 'bin', 'bk', 'bmp', 'btif', 'bz2', 'bzip2', 'cab', 'caf', 'cgm', 'class', 'cmx', 'cpio', 'cr2', 'csv', 'cur', 'dat', 'deb', 'dex', 'djvu', 'dll', 'dmg', 'dng', 'doc', 'docm', 'docx', 'dot', 'dotm', 'dra', 'DS_Store', 'dsk', 'dts', 'dtshd', 'dvb', 'dwg', 'dxf', 'ecelp4800', 'ecelp7470', 'ecelp9600', 'egg', 'eol', 'eot', 'epub', 'exe', 'f4v', 'fbs', 'fh', 'fla', 'flac', 'fli', 'flv', 'fpx', 'fst', 'fvt', 'g3', 'gif', 'graffle', 'gz', 'gzip', 'h261', 'h263', 'h264', 'icns', 'ico', 'ief', 'img', 'ipa', 'iso', 'jar', 'jpeg', 'jpg', 'jpgv', 'jpm', 'jxr', 'key', 'ktx', 'lha', 'lvp', 'lz', 'lzh', 'lzma', 'lzo', 'm3u', 'm4a', 'm4v', 'mar', 'mdi', 'mht', 'mid', 'midi', 'mj2', 'mka', 'mkv', 'mmr', 'mng', 'mobi', 'mov', 'movie', 'mp3', 'mp4', 'mp4a', 'mpeg', 'mpg', 'mpga', 'mxu', 'nef', 'npx', 'numbers', 'o', 'oga', 'ogg', 'ogv', 'otf', 'pages', 'pbm', 'pcx', 'pdf', 'pea', 'pgm', 'pic', 'png', 'pnm', 'pot', 'potm', 'potx', 'ppa', 'ppam', 'ppm', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'pptx', 'psd', 'pya', 'pyc', 'pyo', 'pyv', 'qt', 'rar', 'ras', 'raw', 'rgb', 'rip', 'rlc', 'rmf', 'rmvb', 'rtf', 'rz', 's3m', 's7z', 'scpt', 'sgi', 'shar', 'sil', 'sketch', 'slk', 'smv', 'so', 'sub', 'swf', 'tar', 'tbz', 'tbz2', 'tga', 'tgz', 'thmx', 'tif', 'tiff', 'tlz', 'ttc', 'ttf', 'txz', 'udf', 'uvh', 'uvi', 'uvm', 'uvp', 'uvs', 'uvu', 'viv', 'vob', 'war', 'wav', 'wax', 'wbmp', 'wdp', 'weba', 'webm', 'webp', 'whl', 'wim', 'wm', 'wma', 'wmv', 'wmx', 'woff', 'woff2', 'wvx', 'xbm', 'xif', 'xla', 'xlam', 'xls', 'xlsb', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx', 'xm', 'xmind', 'xpi', 'xpm', 'xwd', 'xz', 'z', 'zip', 'zipx'];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const isNode = typeof System !== 'undefined'
  ? System.get('@system-env').node
  : (typeof global !== 'undefined' && typeof process !== 'undefined');

function defaultOrigin () {
  return System.baseURL || document.location.origin;
}

function makeRequest (resource, method = 'GET', body, headers = {}, onProgress = () => {}) {
  let url = resource.url;
  var { useCors, useProxy, headers: moreHeaders } = resource;
  var useCors = typeof useCors !== 'undefined' ? useCors : true;
  var useProxy = typeof useProxy !== 'undefined' ? useProxy : true;
  const fetchOpts = { method };

  if (useProxy) {
    Object.assign(headers, {
      // pragma: 'no-cache',
      'cache-control': 'no-cache',
      'x-lively-proxy-request': url
    });

    url = resource.proxyDomain || defaultOrigin();
  }

  if (useCors) fetchOpts.mode = 'cors';
  if (body) fetchOpts.body = body;
  fetchOpts.redirect = 'follow';
  fetchOpts.headers = { ...headers, ...moreHeaders };

  try {
    return fetch(url, fetchOpts);
  } catch (e) {
    return e;
  }
}

export function upload (resource, body) {
  let {
    useProxy = true, useCors = true, url,
    onLoad, headers, onProgress
  } = resource;
  const xhr = new XMLHttpRequest();
  const res = promise.deferred();

  xhr.open('PUT', url);

  if (useProxy) {
    Object.assign(headers, {
      pragma: 'no-cache',
      'cache-control': 'no-cache',
      'x-lively-proxy-request': url
    });

    url = resource.proxyDomain || defaultOrigin();
  }

  for (const header in headers) { xhr.setRequestHeader(header, headers[header]); }
  xhr.upload.addEventListener('progress', onProgress);
  xhr.responseType = 'json';
  xhr.onload = () => {
    onLoad(xhr.response);
    res.resolve(xhr);
  };

  if (useCors) xhr.withCredentials = true;
  xhr.send(body);
  return res.promise;
}

export default class WebDAVResource extends Resource {
  constructor (url, opts = {}) {
    super(url, opts);
    this.onLoad = opts.onLoad || (() => {});
    this.onProgress = opts.onProgress || (() => {});
    this.useProxy = opts.hasOwnProperty('useProxy') ? opts.useProxy : false;
    this.proxyDomain = opts.proxyDomain || undefined;
    this.useCors = opts.hasOwnProperty('useCors') ? opts.useCors : false;
    this.headers = opts.headers || {};
    this.binary = this.isFile() ? binaryExtensions.includes(this.ext()) : false;
    this.errorOnHTTPStatusCodes = opts.hasOwnProperty('errorOnHTTPStatusCodes')
      ? opts.errorOnHTTPStatusCodes
      : true;
  }

  get isHTTPResource () { return true; }

  join (path) {
    return Object.assign(
      super.join(path),
      { headers: this.headers, useCors: this.useCors, useProxy: this.useProxy, proxyDomain: this.proxyDomain });
  }

  makeProxied (proxyDomain) {
    if (proxyDomain !== undefined) this.proxyDomain = proxyDomain;
    return this.useProxy
      ? this
      : new this.constructor(this.url, { headers: this.headers, useCors: this.useCors, useProxy: true, proxyDomain: this.proxyDomain });
  }

  noErrorOnHTTPStatusCodes () { this.errorOnHTTPStatusCodes = false; return this; }

  async read () {
    const res = await makeRequest(this);
    if (!res.ok && this.errorOnHTTPStatusCodes) { throw new Error(`Cannot read ${this.url}: ${res.statusText} ${res.status}`); }
    if (!this.binary) return res.text();
    if (this.binary === 'blob') return res.blob();
    if (typeof res.arrayBuffer === 'function') return res.arrayBuffer();
    if (typeof res.buffer === 'function') return res.buffer(); // node only
    throw new Error(`Don't now how to read binary resource ${this}'`);
  }

  async write (content) {
    if (!this.isFile()) throw new Error(`Cannot write a non-file: ${this.url}`);
    const res = await upload(this, content);

    if (!num.between(res.status, 200, 300) && this.errorOnHTTPStatusCodes) { throw new Error(`Cannot write ${this.url}: ${res.statusText} ${res.status}`); }
    return this;
  }

  async mkdir () {
    if (this.isFile()) throw new Error(`Cannot mkdir on a file: ${this.url}`);
    const res = await makeRequest(this, 'MKCOL');
    if (!res.ok && this.errorOnHTTPStatusCodes) { throw new Error(`Cannot create directory ${this.url}: ${res.statusText} ${res.status}`); }
    return this;
  }

  async exists () {
    return this.isRoot() ? true : !!(await makeRequest(this, 'HEAD')).ok;
  }

  async remove () {
    await makeRequest(this, 'DELETE');
    return this;
  }

  async _propfind () {
    const res = await makeRequest(this, 'PROPFIND',
      null, // propfindRequestPayload(),
      {
        'Content-Type': 'text/xml'
        // rk 2016-06-24: jsDAV does not support PROPFIND via depth: 'infinity'
        // 'Depth': String(depth)
      });

    if (!res.ok && this.errorOnHTTPStatusCodes) { throw new Error(`Error in dirList for ${this.url}: ${res.statusText}`); }
    const xmlString = await res.text();
    const root = this.root();
    // list of properties for all resources in the multistatus list
    return readXMLPropfindResult(xmlString).map(props =>
      root.join(props.url).assignProperties(props));
  }

  async dirList (depth = 1, opts = {}) {
    // depth = number >= 1 or 'infinity'

    if (typeof depth !== 'number' && depth !== 'infinity') { throw new Error(`dirList – invalid depth argument: ${depth}`); }

    const { exclude } = opts;

    if (depth <= 0) depth = 1;

    if (depth === 1) {
      let resources = await this._propfind(); // request to set resources props...
      const self = resources.shift();
      if (exclude) resources = applyExclude(exclude, resources);
      return resources;
    } else {
      const subResources = await this.dirList(1, opts);
      const subCollections = subResources.filter(ea => ea.isDirectory());
      return Promise.all(subCollections.map(col =>
        col.dirList(typeof depth === 'number' ? depth - 1 : depth, opts)))
        .then(recursiveResult =>
          recursiveResult.reduce((all, ea) => all.concat(ea), subResources));
    }
  }

  async readProperties (opts) {
    const props = (await this._propfind())[0];
    return this.assignProperties(props); // lastModified, etag, ...
  }

  async post (body = null) {
    if (typeof body !== 'string') body = JSON.stringify(body);
    const res = await makeRequest(this, 'POST', body, {});
    let text; let json;
    try { text = await res.text(); } catch (err) {}
    if (text && res.headers.get('content-type') === 'application/json') {
      try { json = JSON.parse(text); } catch (err) {}
    }
    if (!res.ok && this.errorOnHTTPStatusCodes) {
      throw new Error(`Error in POST ${this.url}: ${text || res.statusText}`);
    } else return json || text;
  }

  async copyTo (otherResource, ensureParent = true) {
    if (this.isFile()) {
      const toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
      // optimized copy, using pipes, for HTTP
      if (isNode) {
        if (toFile.isHTTPResource) return this._copyTo_file_nodejs_http(toFile, ensureParent);
        if (toFile.isNodeJSFileResource) return this._copyTo_file_nodejs_fs(toFile, ensureParent);
      }
    }
    return super.copyTo(otherResource, ensureParent);
  }

  async _copyFrom_file_nodejs_fs (fromFile, ensureParent = true) {
    if (ensureParent) await this.parent().ensureExistance();
    let error;
    const stream = fromFile._createReadStream();
    stream.on('error', err => error = err);
    const toRes = await makeRequest(this, 'PUT', stream);
    if (error) throw error;
    if (!toRes.ok && this.errorOnHTTPStatusCodes) { throw new Error(`copyTo: Cannot GET: ${toRes.statusText} ${toRes.status}`); }
    return this;
  }

  async _copyTo_file_nodejs_fs (toFile, ensureParent = true) {
    if (ensureParent) await toFile.parent().ensureExistance();
    const fromRes = await makeRequest(this, 'GET');
    if (!fromRes.ok && this.errorOnHTTPStatusCodes) { throw new Error(`copyTo: Cannot GET: ${fromRes.statusText} ${fromRes.status}`); }
    let error;
    return new Promise((resolve, reject) =>
      fromRes.body.pipe(toFile._createWriteStream())
        .on('error', err => error = err)
        .on('finish', () => error ? reject(error) : resolve(this)));
  }

  async _copyTo_file_nodejs_http (toFile, ensureParent = true) {
    if (ensureParent) await toFile.parent().ensureExistance();
    const fromRes = await makeRequest(this, 'GET');
    if (!fromRes.ok && this.errorOnHTTPStatusCodes) { throw new Error(`copyTo: Cannot GET: ${fromRes.statusText} ${fromRes.status}`); }
    const toRes = await makeRequest(toFile, 'PUT', fromRes.body);
    if (!fromRes.ok && this.errorOnHTTPStatusCodes) { throw new Error(`copyTo: Cannot PUT: ${toRes.statusText} ${toRes.status}`); }
  }
}

export var resourceExtension = {
  name: 'http-webdav-resource',
  matches: (url) => url.startsWith('http:') || url.startsWith('https:'),
  resourceClass: WebDAVResource
};
