import { readBody } from "../util.js";
import { resource } from "lively.resources";
/*global System*/

function errorResponse(res, err) {
  res.writeHead(400,  {"content-type": "application/json"});
  res.end(JSON.stringify({error: String(err)}));
}

function successResponse(res, message, mixin) {
  res.writeHead(200,  {"content-type": "application/json"});
  res.end(JSON.stringify({status: message, ...mixin}));
}

export default class SubserverPlugin {

  constructor() {
    this.server = null;
    this.defaultSubserverDir = "subservers/";
  }

  setOptions() {}
  get pluginId() { return "subserver" }
  get before() { return ["jsdav"]; }

  setup(server) {
    this.server = server;
    this.startAllSubservers(server);
  }

  async close() {
    this.server = null;
  }

  async startAllSubservers(server) {
    let dir = System.decanonicalize(this.defaultSubserverDir)
    if (!await resource(dir).exists()) return;
    let files = await resource(dir).dirList(1, {exclude: ea => ea.ext() !== "js"});
    try {
      let subservers = await server.addSubservers(files.map(ea => ea.url));
      console.log(`[subserver] Started ${subservers.map(ea => ea.pluginId).join(", ")}`);
    } catch (err) {
      console.error(`[subserver] Error starting subservers:\n${err}`);
      return;
    }
  }

  async listSubservers(req, res) {
    let subservers = this.server.plugins.filter(ea => ea.isSubserver),
        data = subservers.map(ea => {
          let meta = ea.constructor[Symbol.for("lively-module-meta")],
              moduleId = meta.package && meta.package.name ?
                meta.package.name + "/" + meta.pathInPackage :
                meta.pathInPackage;
          if (moduleId.startsWith(System.baseURL))
            moduleId = moduleId.slice(System.baseURL.length).replace(/^\//, "");
          return {id: ea.pluginId, module: moduleId};
        });
    successResponse(res, `found ${subservers.length} subservers`, {subservers: data});
  }

  async addSubserver(req, res, body) {
    if (!body.subserverModule) throw new Error("no body.subserverModule");
    let action = body.action || "add"
    let subserver = await this.server.addSubserver(body.subserverModule);
    console.log(`[subserver] ${action} ${subserver.pluginId}`);
    successResponse(res, `added subserver ${subserver.pluginId}`, {id: subserver.pluginId});
  }

  async removeSubserver(req, res, body) {
    if (!body.subserverModule && !body.id)
      throw new Error("no body.subserverModule nor body.id");
    let {removed, subserver} = await this.server.removeSubserver(body.subserverModule || body.id),
        msg = removed ? `subserver ${subserver.pluginId} removed`
                      : `no such subserver installed`;
    console.log(`[subserver] ${subserver.pluginId} removed`);
    successResponse(res, msg, {id: subserver ? subserver.pluginId : null});
  }

  async handleRequest(req, res, next) {
    let [url, query] = req.url.split("?"),
        method = req.method.toUpperCase();
    if (!url.startsWith("/subserver-control/")) return next();

    try {
      if (!this.server) throw new Error("Subserver control has no server");
      if (url === "/subserver-control/list" && method === "GET")
        return await this.listSubservers(req, res);
      let body = await readBody(req, true);
      if (!body) throw new Error("no body");
      if (url === "/subserver-control/add" && method === "POST")
        return await this.addSubserver(req, res, body);
      if (url === "/subserver-control/remove" && method === "POST")
        return await this.removeSubserver(req, res, body);
      return errorResponse(res, `Cannot deal with ${url} / ${method}`);
    } catch (err) {
      console.error(err);
      return errorResponse(res, err);
    }
  }

}