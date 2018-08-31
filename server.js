/* global origin, System */
import { HeadlessSession } from "lively.headless";
import zlib from 'zlib';
import fs from 'fs';
import urlParser from "url";
import { obj } from "lively.lang";
import L2LClient from "lively.2lively/client.js";
import { ObjectDB } from "lively.storage";
import { join } from "path";
const packagePath = System.decanonicalize("lively.headless/").replace("file://", "");

var l2lClient;
var containers = containers || {};
var defaultDB = 'lively.morphic/objectdb/morphicdb';

var lastReq;
export default class FrozenPartsLoader {

  get pluginId() { return "FrozenPartsLoader" }

  get before() { return ['jsdav', "lib-lookup"] }
  
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
      .then(() => console.log("freezer service ready"))
      .catch(err => console.error(`freezer initialization failed`, err))
  }

  async refreshSession() {
    // over time pupeteer starts using up a lot of memory
    // this call restarts the pupeteer instance and
    // reinitializes the frozen parts
    await this.headlessSession.dispose();
    this.headlessSession = false;
    for (let container of Object.values(containers)) {
      await this.restart(container);
    }
  }

  async handleRequest(req, res, next) {
    if (!req.url.startsWith("/subserver/FrozenPartsLoader")) return next();

    let [_, id, ...op] = req.url.split("/subserver/FrozenPartsLoader")[1].split('/'),
        container = containers[id];

    if (container && op.join('/').endsWith('load.js')) {
      let userAgent = op[0];
      if (userAgent == 'mobile') container = containers[id + '.mobile'] || container;
      if (userAgent == 'tablet') container = containers[id + '.tablet'] || container;
      res.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8', 'Content-Encoding': 'gzip'});
      res.end(container._cachedScript);
      return;      
    }

    if (container && op.join('/').includes('prerender')) {
      let userAgent = 'default';
      let {height, width, pathname} = urlParser.parse(req.url, true).query;
      if (width < 600) userAgent = 'mobile';
      if (width > 600 && width < 1024) userAgent = 'tablet';
      res.writeHead(200, {'Content-Type': 'text/html'});
      try {
        lastReq = await this.prerender(id, width, height, pathname, userAgent);
      } catch (e) {
        res.end(e.message);
        return;
      }
      res.end(lastReq);
      return;
    }

    if (container && op.length > 1) {
      let newPath = join(this.fsRootDir, ...op);
      newPath = newPath.split('?')[0];
      req.url = req.url.replace('/subserver/FrozenPartsLoader/' + id, '');
      next(); // pass on request to jsdav
      return;
    }

    if (container) {
      // fixme: turn this into a proper transitioning not altering the URL
      const partsLoader = function () {
        var w = document.documentElement.clientWidth;
        var h = document.documentElement.clientHeight || window.innerHeight ;
        var path = document.location.pathname;
        if (path.endsWith('/')) {
            path = path.slice(0, path.length - 1)
        }
        var query = `/prerender?height=${h}&width=${w}&pathname=${path}`;
        var red = window.origin + path + query; 
        document.location.replace(red);
      };

      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(`<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
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
     if (userAgent == 'tablet' && containers[id + '.tablet']) {
        container = containers[id + '.tablet'];
     } else if (userAgent == 'mobile' && containers[id + '.mobile']) {
        container = containers[id + '.mobile'];
     } else {
        container = containers[id];
     }
     return await this.runEval(container, `
       const { prerender } = await System.import('lively.freezer/prerender.js');
       await prerender(${JSON.stringify(container._commit)}, ${width}, ${height}, "${pathname}", "${userAgent}");
     `);
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
    const script = await this.runEval(container, `
        const { refresh } = await System.import('lively.freezer/prerender.js');
        await refresh(${JSON.stringify(container._commit)});
    `);

    // store frozen version gzipped in server side cache
    container._cachedScript = zlib.gzipSync(script);
    // capture current screenshot
    container._preview = await this.screenshot(container);
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
    typeof ackFn === "function" && ackFn({success: true, status: "OK"})
  }

  async "[freezer] metrics"(tracker, {sender, data}, ackFn, socket) {
    let res;
    try {
      res = await this.headlessSession.page.getMetrics();
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