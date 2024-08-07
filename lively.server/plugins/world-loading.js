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
      // TODO: Fix this up, we can probably at least provide better defaults/customizability!
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
      res.writeHead(301, { location: '/worlds/' + query }); // might get redirected further below
      res.end();
      return;
    }

    if (url === '/report-world-load' && req.method.toUpperCase() === 'POST') {
      const { message } = await readBody(req);
      const ip = req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;
      console.log(`[report-world-load] ${message} ${ip}`);
      res.end();
    } else if (url.startsWith('/projects') && req.method.toUpperCase() === 'GET') {
      const parsedUrl = parseUrl(url, true);
      const [_, sub] = parsedUrl.pathname.match(/^\/projects\/?(.*)/);
      req.url = sub == 'load'
        ? url.replace('/projects/load', '/lively.freezer/loading-screen/index.html') // "redirect" to the loading screen which handles loading in bootstrap method
        : url.replace('/projects', '/lively.freezer/loading-screen'); // "redirect" for resources required by the loading screen so that they get loaded from the bundled version

      if (req.url.endsWith('/lively.freezer/loading-screen/index.html')) {
        const s = await resource(System.baseURL).join('lively.freezer/loading-screen/index.html').read();
        res.writeHead(200);
        res.end(s);
        return;
      }
      next();
    } else if (url.startsWith('/worlds') || url.startsWith('/projects') ) {
      if (['/worlds', '/worlds/', '/projects', '/projects/'].includes(url) && req.method.toUpperCase() === 'GET') {
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
        ? url.replace('/worlds/load', '/lively.freezer/loading-screen/index.html') // "redirect" to the loading screen which handles loading in bootstrap method
        : url.replace('/worlds', '/lively.freezer/loading-screen'); // "redirect" for resources required by the loading screen so that they get loaded from the bundled version

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
