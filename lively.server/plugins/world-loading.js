/* global System,Buffer */
import { resource } from 'lively.resources';
import { ObjectDB } from 'lively.storage';
import { parse as parseUrl } from 'url';
import { readBody } from '../util.js';

const minute = 1000 * 60;

/*

import LivelyServer from "../server.js";
let s = LivelyServer.servers.values().next().value;
let p = s.findPlugin("world-loading");
p.resetHTMLCache();

p.handleRequest

*/

export default class WorldLoadingPlugin {
  constructor (config) {
    this.authServerURL = config.authServerURL;
    this.resetHTMLCache();
  }

  setOptions ({ route } = {}) {}

  get pluginId () { return 'world-loading'; }

  toString () { return `<${this.pluginId}>`; }

  get before () { return ['jsdav']; }

  setup (livelyServer) {}

  async close () {}

  resetHTMLCache () { this.cachedHTML = {}; }

  readFile (path) {
    const htmlResource = resource(System.baseURL).join('lively.morphic/web/' + path);
    return htmlResource.read();
  }

  addMeta (html, worldName, parsedUrl) {
    const encodedName = encodeURIComponent(worldName);
    const tags = [
      { property: 'og:title', content: `lively.next - ${worldName}` },
      { property: 'og:description', content: 'lively.next is a personal programming kit. It emphasizes liveness, directness and interactivity.' },
      { property: 'og:image', content: `https://lively-next.org/object-preview-by-name/world/${encodedName}` },
      { property: 'og:url', content: `https://lively-next.org/worlds/${encodedName}` }
      // {name: "twitter:card", content: "summary_large_image"},
    ]; const tagMarkup = [];

    for (const spec of tags) {
      let markup = '<meta';
      for (const prop in spec) markup += ` ${prop}="${spec[prop]}"`;
      markup += '>';
      tagMarkup.push(markup);
    }
    return html.replace('<!--META-->', tagMarkup.join('\n'));
  }

  async handleRequest (req, res, next) {
    let [url, query] = req.url.split('?');
    query = query ? '?' + query : '';

    if ((url === '/' || url === '/index.html') && req.method.toUpperCase() === 'GET') {
      res.writeHead(301, { location: '/worlds/' + query });
      res.end();
      return;
    }

    if (url.startsWith('/object-preview-by-name/')) {
      let [_, type, name] = url.match(/^\/object-preview-by-name\/([^\/]+)\/([^\/]+)$/) || [];
      let err;
      if (!type || !name) {
        err = { code: 404, message: `Cannot find thumbnail for ${url.split('/').slice(2).join('/')}` };
      } else {
        name = decodeURIComponent(name);

        {
          // FIXME, support multiple DBs
          // FIXME, move somewhere else
          try {
            const db = await ObjectDB.find('lively.morphic/objectdb/morphicdb');
            const previewLoc = db.snapshotLocation.join(`../preview-cache/by-name/${type}/`).withRelativePartsResolved();
            const defaultImageFile = previewLoc.join(`${name}.png`).beBinary();

            // exists and is recent?
            if (await defaultImageFile.exists()) {
              if (Date.now() - (await defaultImageFile.readProperties()).lastModified < minute * 10) {
                const buf = await defaultImageFile.read();
                res.writeHead(200); res.end(buf);
                return;
              } else {
                await defaultImageFile.remove();
              }
            }

            // otherwise read from snapshot.preview
            const commit = await db.getLatestCommit(type, name);
            const snapshotResource = db.snapshotResourceFor(commit);
            const { preview } = await snapshotResource.readJson();
            const [_, ext, data] = preview.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/) || [];
            const imgFile = previewLoc.join(`${name}.${ext}`).beBinary();
            const buf = new Buffer(data, 'base64');

            // answer...
            res.writeHead(200); res.end(buf);

            // ...and cache
            Promise.resolve().then(async () => {
              await previewLoc.ensureExistance();
              await imgFile.write(buf);
            }).catch(err => console.error(`Error writing cached preview image for ${type}/${name}:\n${err}`));
            return;
          } catch (e) {
            err = { code: 500, message: String(e) };
          }
        }

        if (err) {
          res.writeHead(err.code, {});
          res.end(err.message);
        }
      }
    } else if (url === '/report-world-load' && req.method.toUpperCase() === 'POST') {
      const { message } = await readBody(req);
      const ip = req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;
      console.log(`[report-world-load] ${message} ${ip}`);
      res.end();
    } else if (url.startsWith('/worlds')) {
      if (['/worlds', '/worlds/'].includes(url) && req.method.toUpperCase() === 'GET') {
        res.writeHead(301, { location: '/dashboard/' });
        res.end();
        return;
      }

      if (url.endsWith('worlds/__JS_FILE_HASHES__')) {
        req.url = '/__JS_FILE_HASHES__';
        next();
        return;
      }

      // if there is stuff after this, it has got to be a request by the loaded frozen part
      const parsedUrl = parseUrl(url, true);
      const [_, sub] = parsedUrl.pathname.match(/^\/worlds\/?(.*)/);
      req.url = sub == 'load'
        ? url.replace('/worlds/load', '/lively.freezer/loading-screen/index.html')
        : url.replace('/worlds', '/lively.freezer/loading-screen');

      if (req.url.endsWith('/lively.freezer/loading-screen/index.html')) {
        const s = await resource(System.baseURL).join('lively.freezer/loading-screen/index.html').read();
        res.writeHead(200);
        res.end(s);
        return;
      }
      // redirect to world loading screen. set SERVER_URL ?
      next();
    } else if (url.startsWith('/dashboard')) {
      if (url === '/dashboard' && req.method.toUpperCase() === 'GET') {
        res.writeHead(301, { location: '/dashboard/' });
        res.end();
        return;
      }

      const parsedUrl = parseUrl(url, true);
      const [_, sub] = parsedUrl.pathname.match(/^\/dashboard\/?(.*)/);
      req.url = url.replace('/dashboard', '/lively.freezer/landing-page');
      if (!sub) {
        req.url += '/index.html';
        const s = await resource(System.baseURL).join('lively.freezer/landing-page/index.html').read();
        res.writeHead(200);
        res.end(s);
        return;
      }
      // return html but inject the auth server url
      // redirect to dashboard
      next();
    } else {
      next();
    }
  }
}
