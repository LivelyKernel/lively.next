/*global fetch, Headers, DOMParser, XPathEvaluator, XPathResult, Namespace*/

import Resource from "./resource.js";
import { applyExclude } from "./helpers.js";

class XPathQuery {

  constructor(expression) {
    this.expression = expression;
    this.contextNode = null;
    this.xpe = new XPathEvaluator()
  }

  establishContext(node) {
    if (this.nsResolver) return;
    var ctx = node.ownerDocument ? node.ownerDocument.documentElement : node.documentElement;
    if (ctx !== this.contextNode) {
      this.contextNode = ctx;
      this.nsResolver = this.xpe.createNSResolver(ctx);
    }
  }

  manualNSLookup() {
    this.nsResolver = function(prefix) {
      return Namespace[prefix.toUpperCase()] || null;
    }
    return this;
  }

  findAll(node, defaultValue) {
    this.establishContext(node);
    var result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null),
        accumulator = [],
        res = null;
    while (res = result.iterateNext()) accumulator.push(res);
    return accumulator.length > 0 || defaultValue === undefined ? accumulator : defaultValue;
  }

  findFirst(node) {
    this.establishContext(node);
    var result = this.xpe.evaluate(this.expression, node, this.nsResolver, XPathResult.ANY_TYPE, null);
    return result.iterateNext();
  }
}

function davNs(xmlString) {
  // finds the declaration of the webdav namespace, usually "d" or "D"
  var davNSMatch = xmlString.match(/\/([a-z]+?):multistatus/i);
  return davNSMatch ? davNSMatch[1] : "d";
}

function propfindRequestPayload() {
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
    </D:propfind>`
}

const propertyNodeMap = {
  getlastmodified: "lastModified",
  creationDate: "created",
  getetag: "etag",
  getcontentlength: "size",
  resourcetype: "type", // collection or file
  getcontenttype: "contentType" // mime type
}
function readPropertyNode(propNode, result = {}) {
  var tagName = propNode.tagName.replace(/[^:]+:/, ""),
      key = propertyNodeMap[tagName],
      value = propNode.textContent;
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

function readXMLPropfindResult(xmlString) {
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

  var doc = new DOMParser().parseFromString(xmlString, "text/xml"),
      ns = davNs(xmlString),
      nodes = new XPathQuery(`/${ns}:multistatus/${ns}:response`).findAll(doc.documentElement),
      urlQ = new XPathQuery(`${ns}:href`),
      propsQ = new XPathQuery(`${ns}:propstat/${ns}:prop`);

  return nodes.map(node => {
    var propsNode = propsQ.findFirst(node),
        props = Array.from(propsNode.childNodes).reduce((props, node) =>
          readPropertyNode(node, props), {}),
        urlNode = urlQ.findFirst(node);
    props.url = urlNode.textContent || urlNode.text; // text is FIX for IE9+;
    return props;
  });
}

export default class WebDAVResource extends Resource {

  async read() {
    var res = await fetch(this.url, {mode: 'cors'});
    if (!res.ok)
      throw new Error(`Cannot read ${this.url}: ${res.statusText} ${res.status}`);
    return res.text();
  }

  async write(content) {
    if (!this.isFile()) throw new Error(`Cannot write a non-file: ${this.url}`);
    var res = await fetch(this.url, {mode: 'cors', method: "PUT", body: content});
    if (!res.ok)
      throw new Error(`Cannot write ${this.url}: ${res.statusText} ${res.status}`);
    return this;
  }

  async mkdir() {
    if (this.isFile()) throw new Error(`Cannot mkdir on a file: ${this.url}`);
    var res = await fetch(this.url, {mode: 'cors', method: "MKCOL"});
    if (!res.ok)
      throw new Error(`Cannot create directory ${this.url}: ${res.statusText} ${res.status}`);
    return this;
  }

  async exists() {
    return this.isRoot() ? true : !!(await fetch(this.url, {mode: 'cors', method: "HEAD"})).ok;
  }

  async remove() {
    await fetch(this.url, {mode: 'cors', method: "DELETE"})
    return this;
  }

  async _propfind() {
    var res = await fetch(this.url, {
       method: "PROPFIND",
       mode: 'cors',
       redirect: 'follow',
       // body: propfindRequestPayload(),
       headers: new Headers({
         'Content-Type': 'text/xml',
        // rk 2016-06-24: jsDAV does not support PROPFIND via depth: 'infinity'
        // 'Depth': String(depth)
      })
    });

    if (!res.ok) throw new Error(`Error in dirList for ${this.url}: ${res.statusText}`);
    let xmlString = await res.text(),
        root = this.root();
    // list of properties for all resources in the multistatus list
    return readXMLPropfindResult(xmlString).map(props =>
      root.join(props.url).assignProperties(props));
  }

  async dirList(depth = 1, opts = {}) {
    // depth = number >= 1 or 'infinity'

    if (typeof depth !== "number" && depth !== 'infinity')
      throw new Error(`dirList – invalid depth argument: ${depth}`);

    var {exclude} = opts;

    if (depth <= 0) depth = 1;

    if (depth === 1) {
      var resources = await this._propfind(), // request to set resources props...
          self = resources.shift();
      if (exclude) resources = applyExclude(exclude, resources);
      return resources;

    } else {
      let subResources = await this.dirList(1, opts),
          subCollections = subResources.filter(ea => ea.isDirectory());
      return Promise.all(subCollections.map(col =>
            col.dirList(typeof depth === "number" ? depth - 1 : depth, opts)))
              .then(recursiveResult =>
                recursiveResult.reduce((all, ea) => all.concat(ea), subResources));
    }

  }

  async readProperties(opts) {
    var props = (await this._propfind())[0];
    return this.assignProperties(props); // lastModified, etag, ...
  }

}
