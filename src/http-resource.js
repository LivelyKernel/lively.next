/*global fetch, Headers, DOMParser, XPathEvaluator, XPathResult, Namespace*/

import { Resource } from "./resource.js";

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

function urlListFromPropfindDocument(xmlString) {
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
      urlQ = new XPathQuery(`${ns}:href`);
  return nodes.slice(1/*first node is source*/).map(node => {
    var urlNode = urlQ.findFirst(node);
    return urlNode.textContent || urlNode.text; // text is FIX for IE9+
  });
}

export class WebDAVResource extends Resource {

  async read() {
    return (await fetch(this.url, {mode: 'cors'})).text();
  }

  async write(content) {
    if (!this.isFile()) throw new Error(`Cannot write a non-file: ${this.url}`);
    await fetch(this.url, {mode: 'cors', method: "PUT", body: content});
    return this;
  }

  async mkdir() {
    if (this.isFile()) throw new Error(`Cannot mkdir on a file: ${this.url}`);
    await fetch(this.url, {mode: 'cors', method: "MKCOL"});
    return this;
  }

  async exists() {
    return this.isRoot() ? true : !!(await fetch(this.url, {mode: 'cors', method: "HEAD"})).ok;
  }

  async remove() {
    await fetch(this.url, {mode: 'cors', method: "DELETE"})
    return this;
  }

  async dirList(depth = 1) {
    // depth = number >= 1 or 'infinity'
    if (depth <= 0) depth = 1;
    if (typeof depth !== "number" && depth !== 'infinity')
      throw new Error(`dirList – invalid depth argument: ${depth}`);

    if (depth === 1) {
      if (!this.isDirectory())
        throw new Error(`dirList called on non-directory: ${this.path()}`)
      var res = await fetch(this.url, {
        method: "PROPFIND",
      	mode: 'cors',
      	redirect: 'follow',
      	headers: new Headers({
      		'Content-Type': 'text/xml',
      		// rk 2016-06-24: jsDAV does not support PROPFIND via depth: 'infinity'
      		// 'Depth': String(depth)
      	})
      })
      if (!res.ok) throw new Error(`Error in dirList for ${this.url}: ${res.statusText}`);
      var xmlString = await res.text(),
          root = this.root();
      return urlListFromPropfindDocument(xmlString).map(path => root.join(path));

    } else {
      var subResources = await this.dirList(1),
          subCollections = subResources.filter(ea => ea.isDirectory());
      return Promise.all(subCollections.map(col =>
            col.dirList(typeof depth === "number" ? depth - 1 : depth)))
              .then(recursiveResult =>
                recursiveResult.reduce((all, ea) => all.concat(ea), subResources));
    }

  }

}
