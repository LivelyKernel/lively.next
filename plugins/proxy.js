import LivelyServer from "../server.js";
var { createProxy } = System._nodeRequire("http-proxy")

/*
  Usage from client a la

var res = await fetch("http://localhost:9011", {
  headers: {
    'pragma': 'no-cache',
    'cache-control': 'no-cache',
    "x-lively-proxy-request": "http://marvl.infotech.monash.edu/webcola/cola.v3.js",
  }
})

var content = await res.text(); content.slice(0,200)

*/


// var server = LivelyServer.servers.get("0.0.0.0:9011")
// var p = server.findPlugin("proxy")

var proxyURLRe = /^\/proxy(-ssl)?\/([^\/]+)/,
    redirectRe = /^201|30(1|2|7|8)$/;

export default class ProxyPlugin {

  constructor() {}

  setOptions({route} = {}) {}

  get pluginId() { return "proxy" }

  get before() { return ["jsdav"]; }

  setup(livelyServer) {}
  async close() {}

  handleRequest(req, res, next) {
    var proxyHeader = req.headers["x-lively-proxy-request"],
        proxyMatch = !proxyHeader && req.url.match(proxyURLRe);

    if (!proxyHeader && !proxyMatch) return next();

    var opts;

    if (proxyHeader) {
      delete req.headers["x-lively-proxy-request"];

      opts = {
        target: proxyHeader,
        ignorePath: true, // don't use path from req.url
        changeOrigin: true,
        autoRewrite: true // doesn't seem to work???
      }


    } else {
      var [prefix, ssl, domain] = proxyMatch,
          target = `http${ssl ? "s" : ""}://${domain}`;

      opts = {
        target,
        ignorePath: true, // don't use path from req.url
        changeOrigin: true,
        pathRewrite: {['^' + prefix] : ''},
        // autoRewrite: true
      }
    }

    var proxy = createProxy({});

    // for custom responses on "proxyRes" see
    // https://github.com/nodejitsu/node-http-proxy/pull/850

    proxy.on('proxyRes', function (proxyRes, req, res) {
      var {statusMessage, statusCode, headers} = proxyRes;
      console.log(`[lively.server proxy] <proxy response>`)
      console.log(`=> ${proxyRes.req.path} ${JSON.stringify(proxyRes.req._headers, true, 2)}`)
      console.log(`<= ${statusCode}/${statusMessage} ${JSON.stringify(headers, true, 2)}`);
      console.log(`[lively.server proxy] </proxy response>`)
    });

    console.log(`[lively.server proxy] Proxying request to ${opts.target}`);

    proxy.web(req, res, opts, function(e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end("Error in proxy: " + String(e));
    });

  }

}