export default class CorsPlugin {

  get pluginId() { return "cors" }

  handleRequest(req, res, next) {
    var allowOrigin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Depth, Cookie, Set-Cookie, Accept, Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization");
    res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS, PROPFIND, REPORT, MKCOL');
    res.setHeader("Access-Control-Expose-Headers", "Date, Etag, Set-Cookie");
    next();
  }

}
