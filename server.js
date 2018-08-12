/* global origin */
import { HeadlessSession } from "lively.headless";
import zlib from 'zlib';
import urlParser from "url";
import { obj } from "lively.lang";
import L2LClient from "lively.2lively/client.js";
import { ObjectDB } from "lively.storage";
import LivelyServer from "lively.server/server.js";
import { fun } from "lively.lang";
import uglify from 'uglify-es';

var l2lClient;
var containers = containers || {};
var defaultDB = 'lively.morphic/objectdb/morphicdb';

var lastReq;
export default class FrozenPartsLoader {

  get pluginId() { return "FrozenPartsLoader" }

  setup(livelyServer) {
    if (!l2lClient) {
      let {hostname, port} = livelyServer
      l2lClient = this.l2lClient = L2LClient.ensure({
        url: `http://${hostname}:${port}/lively-socket.io`,
        namespace: "l2l", info: {
          type: "lively.next.org freezer service",
          location: "server"
        }
      });
      l2lClient.options.ackTimeout = 1000*60*3;
    }
    
    
    ["[freezer] register part",
     "[freezer] update part",
     "[freezer] remove part",
     "[freezer] status"
    ].forEach(sel => l2lClient.addService(sel, this[sel].bind(this)));

    l2lClient.whenRegistered()
      .then(() => console.log("freezer service ready"))
      .catch(err => console.error(`freezer initialization failed`, err))
  }

  async handleRequest(req, res, next) {
    if (!req.url.startsWith("/subserver/FrozenPartsLoader")) return next();

    let [_, id, op] = req.url.split("/subserver/FrozenPartsLoader")[1].split('/'),
        container = containers[id];

    if (container && op == 'load.js') {
      res.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8', 'Content-Encoding': 'gzip'});
      res.end(container._cachedScript);
      return;      
    }


    if (container && op && op.includes('prerender')) {
      let {height, width, pathname} = urlParser.parse(req.url, true).query;
      if (width < 600 && containers[id + '.mobile']) {
        // try to fetch the mobile version if present: {id}-mobile
        // hacky but works for now
        container = containers[id + '.mobile'];
        pathname = pathname.replace(id, id + '.mobile');
      }

      if (width > 600 && width < 1024 && containers[id + '.tablet']) {
        // try to fetch the mobile version if present: {id}-mobile
        // hacky but works for now
        container = containers[id + '.tablet'];
        pathname = pathname.replace(id, id + '.tablet');
      }
      res.writeHead(200, {'Content-Type': 'text/html'});
      try {
        lastReq = await this.prerender(container, width, height, pathname);
      } catch (e) {
        res.end(e.message);
        return;
      }
      res.end(lastReq);
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

  async prerender(container, width, height, pathname) {
    const addScripts = `
        <style>
          #prerender {
             position: absolute
          }
        </style> 
        <script>
          lively = {};
          System = {};
        </script>
        <script id="system" src="/lively.freezer/runtime-deps.js" defer></script>
        <script id="loader" src="${pathname}/load.js" defer></script>
        <script>
          history.replaceState(null, '', (new URL(location.href)).searchParams.get('pathname'));
          document.querySelector('#system').addEventListener('load', function() {
              window.prerenderNode = document.getElementById("${await container.runEval('$world.id')}");
          });
          document.querySelector('#loader').addEventListener('load', function() {
              System.baseURL = origin;
              if (!("PointerEvent" in window))
                lively.resources.loadViaScript(\`\${origin}/lively.next-node_modules/pepjs/dist/pep.js\`);
              if (!("fetch" in window))
                lively.resources.loadViaScript(\`//cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.js\`);
          });
         </script>`,
         morphHtml = await container.runEval(`
       const { generateHTML } = await System.import('lively.morphic/rendering/html-generator.js'),
              part = $world.submorphs[0];
       $world.dontRecordChangesWhile(() => {
         part.width = ${width};
         part.height = ${height};
         $world.width = ${width};
         $world.height = ${height};
       });
       await $world.whenRendered();
       $world.dontRecordChangesWhile(() => {
         if (part.onWorldResize) part.onWorldResize();
       });
       await $world.whenRendered();
       await generateHTML($world, {
          container: false,
          addMetaTags: [{
            name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1"
          }],
          addScripts: ${JSON.stringify(addScripts)}});`);

    return morphHtml;
  }

  async refresh(container) {
    HeadlessSession.list().filter(s => !Object.values(containers).includes(s)).map(m => m.dispose());
    const script = await container.runEval(`
      const { Morph, MorphicDB } = await System.import("lively.morphic/index.js"),
            { loadMorphFromSnapshot } = await System.import("lively.morphic/serialization.js"),
            { freezeSnapshot } = await System.import("lively.freezer/part.js"),
            snapshot = await MorphicDB.default.fetchSnapshot(${JSON.stringify(container._commit)}),
            part = await loadMorphFromSnapshot(snapshot),
            {file: body} = await freezeSnapshot({
              snapshot: JSON.stringify(snapshot)
            }, {
              notifications: false,
              loadingIndicator: false,
              includeRuntime: false,
              addRuntime: false,
              includeDynamicParts: true
            });
      $world.submorphs = [];
      part.openInWorld();
      part.left = part.top = 0;
      part.extent = $world.extent;
      body;
    `);
    // store frozen version gzipped in server side cache
    container._cachedScript = zlib.gzipSync(script);
    // capture current screenshot
    container._preview = await container.screenshot();
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

  async "[freezer] register part"(tracker, {sender, data: {commit, id, autoUpdate, dbName}}, ackFn, socket) {
    // register part entry (partName, id=[defaults to Part name])
    // fire up a headless lively (turn off change tracking)
    // ensure that id is not yet used!
    try {
      if (containers[id]) {
        throw Error("Id already taken! Please choose another identifier for this deployment.")
      }
      const tester = sess => sess.runEval("typeof $world !== 'undefined'"),
            container = await HeadlessSession.open("http://localhost:9011/worlds/default?nologin", tester);
      // use this format for proper screenshots
      containers[id] = container;
      await container.page.setViewport({
        width: 800, height: 800
      });
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
    await containers[id].dispose();
    delete containers[id];
    typeof ackFn === "function" && ackFn({success: true, status: "OK"})
  }
  
  async "[freezer] status"(tracker, {sender, data: {id}}, ackFn, socket) {
    // return a status overview of all running instances or of single id
    let res;
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