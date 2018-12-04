/* global origin, System */
import { HeadlessSession } from "lively.headless";
import zlib from 'zlib';
import fs from 'fs';
import urlParser from "url";
import { obj, date } from "lively.lang";
import L2LClient from "lively.2lively/client.js";
import { ObjectDB } from "lively.storage";
import { join } from "path";
import { resource } from "lively.resources";
import * as uglifier from 'uglify-es';
const packagePath = System.decanonicalize("lively.headless/").replace("file://", "");

var l2lClient;
// store containers inside directory instead
var containers = containers || {};
var defaultDB = 'lively.morphic/objectdb/morphicdb';

var lastReq;

// {
//   cachedScript.js
//   preview.png
//   dynamicParts/
//   config.json {
//   _autoUpdate: true, 
//   _commit: {/*...*/},
//   _dbName: "lively.morphic/objectdb/morphicdb", // dynamicParts/ populated during build process
//   }
//   _lastChange: {/*...*/}, // synthesized from folder file timestamps
//   _timestamp: {/*...*/}, // synthesized from folder timestamp
//     
//   error: null, // just a state variable held in memory not needed for folder structure
//   status: undefined // likewise
// }

// r = resource(System.decanonicalize('lively.freezer/dynamicParts/'))

// containers.robin.dynamicParts

const noScriptTag = `
<noscript>
   <meta http-equiv="refresh" content="0;url=/noscript.html">
</noscript>
`
export default class FrozenPartsLoader {

  get pluginId() { return "FrozenPartsLoader" }

  get before() { return ['jsdav', "lib-lookup"] }

  get production() { return true }
  
  async setup(livelyServer) {
    if (!l2lClient) {
      let {hostname, port} = livelyServer
      l2lClient = this.l2lClient = L2LClient.ensure({
        url: `http://${hostname}:${port}/lively-socket.io`,
        namespace: "l2l", info: {
          type: "lively.next.org freezer service",
          location: "server"
        }
      });
      this.fsRootDir = livelyServer.options.jsdav.rootDirectory;
      l2lClient.options.ackTimeout = 1000*60*3;
    }
   
    ["[freezer] register part",
     "[freezer] update part",
     "[freezer] remove part",
     "[freezer] status",
     "[freezer] refresh",
     "[freezer] metrics"
    ].forEach(sel => l2lClient.addService(sel, this[sel].bind(this)));

    l2lClient.whenRegistered()
      .then(() => console.log('reading buckets from filesystem...'))
      .then(() => this.readBucketsFromFS())
      .then(() => console.log("freezer service ready"))
      .catch(err => console.error(`freezer initialization failed`, err))
  }

  async refreshSession() {
    // over time pupeteer starts using up a lot of memory
    // this call restarts the pupeteer instance and
    // reinitializes the frozen parts
    this.headlessSession && await this.headlessSession.dispose();
    this.headlessSession = false;
    for (let container of Object.values(containers)) {
      await this.restart(container);
    }
  }

  async handleRequest(req, res, next) {
    if (!req.url.startsWith("/subserver/FrozenPartsLoader")) return next();

    let sanitizedUrl = req.url.split('//').join('/');
    let [_, id, ...op] = sanitizedUrl.split("/subserver/FrozenPartsLoader")[1].split('/'),
        container = containers[id];
    if (container && op.join('/').endsWith('load.js')) {
      let userAgent = op.slice(-2)[0];
      if (userAgent == 'mobile') container = containers[id + '.mobile'] || container;
      if (userAgent == 'tablet') container = containers[id + '.tablet'] || containers[id + '.mobile'] || container;
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8', 
        'Content-Encoding': 'gzip', 
        'Vary': 'Accept-Encoding',
        'Cache-Control':' max-age=31536000',
        'Last-Modified': container._lastChange.toGMTString()
      });
      res.end(this.production ? container._minifiedCompressedScript : container._compressedScript);
      return;      
    }

    if (container && op.join('/').includes('prerender')) {
      let userAgent = 'default';
      let {height, width, pathname} = urlParser.parse(sanitizedUrl, true).query;
      if (width < 600) userAgent = 'mobile';
      if (width >= 600 && width < 1024) userAgent = 'tablet';
      res.writeHead(200, {'Content-Type': 'text/html'});
      try {
        lastReq = await this.prerender(id, width, height, pathname, userAgent);
        lastReq = '<!DOCTYPE html>\n' + lastReq; 
      } catch (e) {
        res.end(e.message);
        return;
      }
      res.end(lastReq);
      return;
    }

    if (container && op.length > 0) {
      let newPath = join(this.fsRootDir, ...op);
      newPath = newPath.split('?')[0];
      if (newPath != this.fsRootDir) {
        req.url = sanitizedUrl.replace('/subserver/FrozenPartsLoader/' + id, '');
        // fixme: dynamically create whitelist for each part, only grant access to all defined resources
        let whitelist = [...(this.production ? [] : [
                           'lively.lang', 
                           'lively.notifications',
                           'lively.classes',
                           'lively.resources',
                           'lively.storage',
                           'lively.bindings',
                           'lively.graphics',
                           'lively.source-transform',
                           'lively.serializer2']),
                         'users',
                         'noscript.html',
                         'objectdb',
                         'lively.freezer',
                         'resources', 
                         'lively.morphic', 
                         'subserver/MailService', 
                         'lively.next-node_modules'];
        if (whitelist.find(dir => req.url.startsWith('/' + dir))) {
          console.log(req.url);
          next(); // pass on request to jsdav
        } else {
          res.writeHead(403, {'Content-Type': 'text/plain'});
          res.end();
        }
        return;
      }
    }

    if (container) {
      // fixme: turn this into a proper transitioning not altering the URL
      const partsLoader = function () {
        if (!window.location.origin) {
          window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
        }
        var w = document.documentElement.clientWidth;
        var h = document.documentElement.clientHeight || window.innerHeight ;
        var path = document.location.pathname;
        if (path.endsWith('/')) {
            path = path.slice(0, path.length - 1)
        }
        var query = `/prerender?height=${h}&width=${w}&pathname=${path}`;
        var red = window.location.origin + path + query; 
        document.location.replace(red);
      };

      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(`<!DOCTYPE html><html><head>
<meta content="text/html;charset=utf-8" http-equiv="Content-Type">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  ${noScriptTag}
<script>(${partsLoader})()</script></head><body style="height: 100%; width: 100%;"></body></html>`);
      return;
    }
    
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(`Did not find part for ${id}!`);
  }

  async ensureHeadless() {
    if (this.headlessSession) return this.headlessSession;
    this.headlessSession = await HeadlessSession.open("http://localhost:9011/worlds/default?nologin", (sess) =>
      sess.runEval("typeof $world !== 'undefined'"));
    return this.headlessSession;
  }

  async prerender(id, width, height, pathname, userAgent) {
    let container;
     if (userAgent == 'tablet') {
        container = containers[id + '.tablet'] || containers[id + '.mobile'] || containers[id];
     } else if (userAgent == 'mobile') {
        container = containers[id + '.mobile'] || containers[id];
     } else {
        container = containers[id];
     }
     let html = await this.runEval(container, `
       const { prerender } = await System.import('lively.freezer/prerender.js');
       await prerender(${JSON.stringify(container._commit)}, ${width}, ${height}, "${pathname}", "${userAgent}", ${container._lastChange.getTime()}, ${this.production});
     `);
     return html.replace(`dynamicPartsDir = "/lively.freezer/frozenParts/$id/dynamicParts/";`, `dynamicPartsDir = "/lively.freezer/frozenParts/${id}/dynamicParts/";`);
  }

  async screenshot(container, screenshotPath) {
    if (!screenshotPath) screenshotPath = packagePath + "screenshots/test.png";
    await this.runEval(container, `
       const { show } = await System.import('lively.freezer/prerender.js');
       await show(${JSON.stringify(container._commit)});
    `);
    await this.headlessSession.page.setViewport({
        width: 800, height: 800
    });
    return this.headlessSession.screenshot(screenshotPath);
  }

  async runEval(container, expr) {
    const sess = await this.ensureHeadless(),
          res = sess.runEval(expr);
    container.status = sess.status;
    container.error = sess.error;
    return res;    
  }

  async restart(container) {
    await this.runEval(container, `
        const { refresh } = await System.import('lively.freezer/prerender.js');
        await refresh(${JSON.stringify(container._commit)}, false);
    `);
  }

  async refresh(container) {
    const { body: script, dynamicParts } = await this.runEval(container, `
        const { refresh } = await System.import('lively.freezer/prerender.js');
        await refresh(${JSON.stringify(container._commit)});
    `);

    container._dynamicParts = dynamicParts;
    container._script = script;
    container._minifiedScript = uglifier.minify(script).code || script;
    // store frozen version gzipped in server side cache
    container._compressedScript = zlib.gzipSync(script);
    container._minifiedCompressedScript = zlib.gzipSync(container._minifiedScript);
    // capture current screenshot
    container._preview = await this.screenshot(container);
    container._lastChange = new Date();
  }

  async configure(container, commit, autoUpdate, dbName) {
    container._timestamp = new Date();
    container._dbName = dbName;
    container._commit = commit;
    container._autoUpdate = autoUpdate;
    if (autoUpdate) {
       // overrides commit to latest version
       const db = await ObjectDB.find(dbName);
       container._commit = await db.getLatestCommit('part', commit.name)
    }
  }

  async close(container) {
    await this.runEval(container, `
       const { dispose } = await System.import('lively.freezer/prerender.js');
       dispose(${JSON.stringify(container._commit)});
    `);
  }

  getConfig(id) {
    const {
      _autoUpdate: autoUpdate,
      _timestamp: timestamp,
      _preview: preview,
      error,
      state,
      _commit: commit,
      _dbName: dbName
    } = containers[id];
    return {
      id, preview, error, state, commit, dbName, timestamp, autoUpdate
    }
  }

  async readBucketsFromFS() {
    // populate the container mapping with the information stored inside the file system
    let bucketDir = resource(System.decanonicalize('lively.freezer/frozenParts/'));
    if (!await bucketDir.exists()) return false;
    for (let bucket of await bucketDir.dirList()) {
      let container = containers[bucket.name()] = {},
          { commit, autoUpdate, dbName } = await bucket.join('config.json').readJson();
      await this.configure(container, commit, autoUpdate, dbName || defaultDB);
      await this.refresh(container); 
    }
  }

  async removeFromFS(id) {
    await resource(System.decanonicalize('lively.freezer/frozenParts/')).join(id + '/').remove();
  }

  async storeInFS(id) {
    let container = containers[id];
    let bucketDir = await resource(System.decanonicalize('lively.freezer/frozenParts/')).join(id + '/').ensureExistance();
    let dynamicPartDir = await bucketDir.join('dynamicParts/').ensureExistance();
    await resource(System.decanonicalize('lively.freezer/runtime-deps.js')).copyTo(bucketDir.join('runtime-deps.js'));
    await bucketDir.join('load.js').write(container._script);
    await bucketDir.join('load.min.js').write(container._minifiedScript);
    await bucketDir.join('config.json').writeJson({
      autoUpdate: container._autoUpdate,
      commit: container._commit,
      dbName: container._dbName
    }, true);
    // write into dynamicParts (uncompressed)
    for (let dynamicPartName in container._dynamicParts) {
       await dynamicPartDir.join(dynamicPartName + '.json').writeJson(container._dynamicParts[dynamicPartName]);
    }
    let prerender = await this.prerender(id, 0, 0, '/', 'static');
    prerender = prerender.replace('/lively.freezer/runtime-deps.js', 'runtime-deps.js')
                         .replace(`/static/${container._lastChange.getTime()}-load.js`, 'load.js')
                         .replace(`dynamicPartsDir = "/lively.freezer/frozenParts/${id}/dynamicParts/";`, `dynamicPartsDir = window.document.location.pathname.replace('index.html', 'dynamicParts')
;`)
                         .replace(`history.replaceState(null, '', (new URL(location.href)).searchParams.get('pathname') || window.location.origin);`, '');
    await bucketDir.join('index.html').write(prerender);
  }
  
  // l2l services

  async "[freezer] refresh"(tracker, {sender, data}, ackFn, socket) {
    try {
      await this.refreshSession();
    } catch(e) {
      typeof ackFn === "function" && ackFn({
        error: e.message
      });
      return;
    }
    typeof ackFn === "function" && ackFn({success: true, status: "OK"});
  }

  async "[freezer] register part"(tracker, {sender, data: {commit, id, autoUpdate, dbName}}, ackFn, socket) {
    // register part entry (partName, id=[defaults to Part name])
    // fire up a headless lively (turn off change tracking)
    // ensure that id is not yet used!
    try {
      if (containers[id]) {
        throw Error("Id already taken! Please choose another identifier for this deployment.")
      }
      let container = containers[id] = {};
      await this.configure(container, commit, autoUpdate, dbName || defaultDB);
      await this.refresh(container);
      await this.storeInFS(id);
    } catch (e) {
      typeof ackFn === "function" && ackFn({
        error: e.message
      });
      return;
    }
    typeof ackFn === "function" && ackFn(this.getConfig(id));
  }

  async "[freezer] update part"(tracker, {sender, data: {id, commit, autoUpdate, dbName}}, ackFn, socket) {
     let container;
     try {
       container = containers[id];
       if (!container) {
         throw new Error(`No deployment found for id: ${id}`);
       }
       await this.configure(container, commit, autoUpdate, dbName);
       await this.refresh(container);
       await this.storeInFS(id);
     } catch (e) {
       typeof ackFn === "function" && ackFn({
        error: e.message
      });
      return;
     }
     typeof ackFn === "function" && ackFn(this.getConfig(id));
  }

  async "[freezer] remove part"(tracker, {sender, data: {id}}, ackFn, socket) {
    await this.close(containers[id]);
    delete containers[id];
    await this.removeFromFS(id);
    typeof ackFn === "function" && ackFn({success: true, status: "OK"})
  }

  async "[freezer] metrics"(tracker, {sender, data}, ackFn, socket) {
    let res;
    try {
      res = this.headlessSession ? await this.headlessSession.page.getMetrics() : {JSHeapTotalSize: 0};
    } catch (e) {
      typeof ackFn === "function" && ackFn({error: e.message});
      return;
    }
    typeof ackFn === "function" && ackFn(res)
  }
  
  async "[freezer] status"(tracker, {sender, data: {id}}, ackFn, socket) {
    // return a status overview of all running instances or of single id
    let res, mem;
    try {
      res = id ? this.getConfig(id) : obj.keys(containers).map(c => this.getConfig(c));
      //enter = 'hello'
    } catch (e) {
      typeof ackFn === "function" && ackFn({error: e.message});
      return;
    }
    typeof ackFn === "function" && ackFn(res)
  }


}