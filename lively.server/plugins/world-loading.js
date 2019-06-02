/*global System,Buffer*/
import { resource } from "lively.resources";
import { ObjectDB } from "lively.storage";
import { parse as parseUrl } from "url";
import { readBody } from "../util.js";

const minute = 1000*60;
const useCache = true;

/*

import LivelyServer from "../server.js";
let s = LivelyServer.servers.values().next().value;
let p = s.findPlugin("world-loading");
p.resetHTMLCache();

*/

export default class WorldLoadingPlugin {

  constructor() {
    this.resetHTMLCache();
  }
  setOptions({route} = {}) {}

  get pluginId() { return "world-loading" }

  toString() { return `<${this.pluginId}>`; }

  get before() { return ["jsdav"]; }

  setup(livelyServer) {}

  async close() {}

  resetHTMLCache() { this.cachedHTML = {}; }

  readFile(path) {
    let htmlResource = resource(System.baseURL).join("lively.morphic/web/" + path);
    return htmlResource.read()
  }

  addMeta(html, worldName, parsedUrl) {
    let encodedName = encodeURIComponent(worldName),
        tags = [
          {property: "og:title", content: `lively.next - ${worldName}`},
          {property: "og:description", content: "lively.next is a personal programming kit. It emphasizes liveness, directness and interactivity."},
          {property: "og:image", content: `https://lively-next.org/object-preview-by-name/world/${encodedName}`},
          {property: "og:url", content: `https://lively-next.org/worlds/${encodedName}`},
          // {name: "twitter:card", content: "summary_large_image"},
        ], tagMarkup = [];

    for (let spec of tags) {
      let markup = "<meta"
      for (let prop in spec) markup += ` ${prop}="${spec[prop]}"`;
      markup += ">";
      tagMarkup.push(markup);
    }
    return html.replace("<!--META-->", tagMarkup.join("\n"));
  }

  async handleRequest(req, res, next) {
    let [url, query] = req.url.split("?");
    query = query ? "?" + query : "";

    if ((url === "/" || url === "/index.html") && req.method.toUpperCase() === "GET") {
      res.writeHead(301,  {location: "/worlds/" + query});
      res.end();
      return;
    }

    if (url.startsWith("/object-preview-by-name/")) {
      let [_, type, name] = url.match(/^\/object-preview-by-name\/([^\/]+)\/([^\/]+)$/) || [],
          err;
      if (!type || !name) {
        err = {code: 404, message: `Cannot find thumbnail for ${url.split("/").slice(2).join("/")}`};
      } else {
        name = decodeURIComponent(name);
        
        {
          // FIXME, support multiple DBs
          // FIXME, move somewhere else
          try {
            let db = await ObjectDB.find("lively.morphic/objectdb/morphicdb"),
                previewLoc = db.snapshotLocation.join(`../preview-cache/by-name/${type}/`).withRelativePartsResolved(),
                defaultImageFile = previewLoc.join(`${name}.png`).beBinary();
            
            // exists and is recent?
            if (await defaultImageFile.exists()) {
              if (Date.now() - (await defaultImageFile.readProperties()).lastModified < minute*10) {
                let buf = await defaultImageFile.read();
                res.writeHead(200); res.end(buf);
                return;
              } else {
                await defaultImageFile.remove();
              }
            }

            // otherwise read from snapshot.preview
            let commit = await db.getLatestCommit(type, name),
                snapshotResource = db.snapshotResourceFor(commit),
                {preview} = await snapshotResource.readJson(),
                [_, ext, data] = preview.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/) || [],
                imgFile = previewLoc.join(`${name}.${ext}`).beBinary(),
                buf = new Buffer(data, 'base64');

            // answer...
            res.writeHead(200); res.end(buf);

            // ...and cache
            Promise.resolve().then(async () => {
              await previewLoc.ensureExistance();
              await imgFile.write(buf);
            }).catch(err => console.error(`Error writing cached preview image for ${type}/${name}:\n${err}`));
            return;

          } catch (e) {
            err = {code: 500, message: String(e)};
          }
        }

        if (err) {
          res.writeHead(err.code,  {});
          res.end(err.message);
          return;
        }
      }

    } else if (url === "/report-world-load" && req.method.toUpperCase() === "POST") {
      let {message} = await readBody(req),
          ip = req.headers['x-forwarded-for'] || 
                req.connection.remoteAddress || 
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;
      console.log(`[report-world-load] ${message} ${ip}`);
      res.end();
      return;

    } else if (url.startsWith("/worlds")) {

      let parsedUrl = parseUrl(url, true),
          [_, worldName] = parsedUrl.pathname.match(/^\/worlds\/?(.*)/),
          htmlFile = worldName ? "morphic.html" : "static-world-listing.html",
          html = (useCache && this.cachedHTML[htmlFile]) || (this.cachedHTML[htmlFile] = await this.readFile(htmlFile));
      if (worldName) {
        let withMeta = `${htmlFile}-for-${worldName}`;
        html = (useCache && this.cachedHTML[withMeta]) || (this.cachedHTML[withMeta] = this.addMeta(html, worldName, parsedUrl));
      }

      res.setHeader('content-type', 'text/html');
      res.end(html);

    } else {
      next();
    }

  }

}
