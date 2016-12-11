import { promise, arr, obj } from "lively.lang";
import * as http from "http";

// Array.from(LivelyServer.servers.keys())
// var s = LivelyServer.ensure({hostname: "0.0.0.0", port: "9011"})
// var s = LivelyServer.ensure({hostname: "localhost", port: "9010"})
// global.server = s
// s.server.listeners("request")
// s.findPlugin("l2l").l2lNamespace
// s.findPlugin("socketio").io.path()


import CorsPlugin from "./plugins/cors.js";
import ProxyPlugin from "./plugins/proxy.js";
import SocketioPlugin from "./plugins/socketio.js";
import EvalPlugin from "./plugins/eval.js";
import L2lPlugin from "./plugins/l2l.js";
import ShellPlugin from "./plugins/remote-shell.js";
import LivelyDAVPlugin from "./plugins/dav.js";


export async function start(opts = {}) {
  // opts = {port, hostname, ...}

  opts = {plugins: [], ...opts};

  var server = LivelyServer.ensure(opts);
  await server.whenStarted();

  server.addPlugins([
    new CorsPlugin(),
    new ProxyPlugin(),
    new SocketioPlugin(opts),
    new L2lPlugin(),
    new ShellPlugin(opts),
    new EvalPlugin(),
    new LivelyDAVPlugin()
  ]);

  return server;
}

export default class LivelyServer {

  static canonicalizeOptions(opts) {
    return {
      hostname: "localhost",
      port: 9101,
      debug: true,
      ...opts
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // server instance storage
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  static get servers() {
    return this._servers || (this._servers = new Map());
  }

  static _key(opts) {
    var {hostname, port} = this.canonicalizeOptions(opts);
    return `${hostname}:${port}`;
  }

  static _register(server) { this.servers.set(this._key(server), server); }
  static _unregister(server) { this.servers.delete(this._key(server)); }

  static find(opts) { return this.servers.get(this._key(opts)); }
  static ensure(opts) { return this.find(opts) || new this(opts).start(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  constructor(opts) {
    opts = this.constructor.canonicalizeOptions(opts);
    this.hostname = opts.hostname;
    this.port = opts.port;
    this.debug = opts.debug;
    this.plugins = opts.plugins || [];
    this.options = opts;

    // state = "not started", "listening", "starting", "closed"
    this._state = "not started";
    this._requestFn = null;
  }

  isListening() { return this._state === "listening"; }

  isClosed() { return this._state !== "starting" && this._state !== "listening"; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lifetime
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  whenStarted(timeout = 1000) {
    return promise.waitFor(timeout, () => this.isListening()).then(() => this);
  }

  whenClosed(timeout = 1000) {
    return promise.waitFor(timeout, () => this.isClosed()).then(() => this);
  }

  start() {
    if (this._state === "starting") { console.log(`${this} already starting`); return this; }
    if (this.isListening()) return this;

    this.constructor._register(this);

    this._state = "starting";

    var {debug, hostname, port} = this,
    server = http.createServer();

    this.server = server;

    this._requestFn = (req, res) => this.handleRequest(req, res);
    server.on("request", this._requestFn);

    server.listen(port, hostname, () => {
      this._state = "listening";
      this.debug && console.log(`[lively.server] ${this} listening`);
    });

    server.once("close", () => {
      this._state = "closed";
      this.debug && console.log(`[lively.server] ${this} closed`);
    });

    return this
  }

  async close(serverState = {}) {
    if (this.isClosed()) return this;

    debug && console.log(`[lively.server] initialize shutdown of ${this}`)

    var {debug, server} = this;

    server.removeListener("request", this._requestFn);

    this.whenClosed(() => this.constructor._unregister(this));

    server.close();

    for (let p of this.plugins) {
      try { typeof p.close === "function" && await p.close(); } catch (e) {
        console.error(`[ ${this}] Error in shutdown of plugin ${p.pluginId}:\n${e.stack}`);
      }
    }

    return this;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // http handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  handleRequest(req, res) {
    var handlers = this.plugins.filter(ea => typeof ea.handleRequest === "function");
    handlers.reduceRight(
      (next, plugin) => () => {
	try {
	  plugin.handleRequest(req, res, next);
	} catch (e) {
	  var msg = `Error in handleRequest of ${plugin.pluginId}:\n${e.stack}`;
	  console.error(msg);
	  res.writeHead(500);
	  res.end(msg);
	}
      }, () => this.defaultHandleRequest(req, res))();
  }

  defaultHandleRequest(req, res) {
    res.writeHead(200);
    res.end("lively.server");
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // plugin helpers
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  findPlugin(id) {
    return this.plugins.find(ea => ea.pluginId === id || ea.constructor.name === id);
  }

  async addPlugin(plugin) { await this.addPlugins([plugin]); return plugin; }

  async addPlugins(plugins) {
    if (!plugins.length) return;

    if (!plugins.every(p => p.pluginId))
      throw new Error("Plugin needs pluginId!");

    // 1. Find plugins that are new
    var toInstall = plugins.filter(p => !this.plugins.includes(p));

    // 2. if plugins with same id are isntalled, remove those
    var ids = toInstall.map(ea => ea.pluginId),
	toRemove = this.plugins.filter(ea => ids.includes(ea.pluginId));

    this.removePlugins(toRemove);

    // 3. Determine right order depending on plugin requirements
    this.plugins = this.orderPlugins([...this.plugins, ...toInstall]);

    // 4. ensure that setup callback of plugins gets called
    var toInstallOrdered = this.plugins.filter(p => toInstall.includes(p));
    for (let p of toInstallOrdered) {
      try {
        if (typeof p.setOptions === "function" && this.options.hasOwnProperty(p.pluginId))
          p.setOptions(this.options[p.pluginId])
        if (typeof p.setup === "function")
        	 await promise.timeout(300, Promise.resolve(p.setup(this)));
      } catch (e) {
       console.error(`Error in setup of plugin ${p.pluginId}:\n${e.stack}`)
      }
    }

    this.debug && console.log(`[${this}] Installed plugins: ${toInstallOrdered.map(ea => ea.pluginId).join(", ")}`);
  }

  removePlugin(plugin) {
    this.removePlugins([plugin]);
  }

  removePlugins(pluginsOrIds) {
    if (!pluginsOrIds.length) return;

    var ids = pluginsOrIds.map(ea => typeof ea === "string" ? ea : ea.pluginId),
    toRemove = this.plugins.filter(ea => ids.includes(ea.pluginId));

    toRemove.forEach(p => {
      try { typeof p.close === "function" && p.close(); }
      catch (e) { console.error(`Error when shutting down plugin ${p.pluginId}:\n${e.stack}`)}
    });

    this.plugins = arr.withoutAll(this.plugins, toRemove);

    this.debug && console.log(`[${this}] Removed plugins: ${toRemove.map(ea => ea.pluginId).join(", ")}`);
  }

  orderPlugins(plugins) {
    // Orders a list of handlers like
    //   {pluginId: "foo", after: ["bar"], before: ["zork"]}
    // so that before / after requirements are fullfilled

    // 1. Group handlers by pluginId
    var byId = arr.groupByKey(plugins, "pluginId");
    // Multiple handlers with same name not allowed!
    var nonUniqId = byId.toArray().find(ea => ea.length !== 1);
    if (nonUniqId)
      throw new Error(`Found non-uniquely named handlers: ${obj.inspect(nonUniqId, {maxDepth: 2})}`)
    byId = byId.mapGroups((id, [plugin]) => plugin);

    // 2. convert "before" requirement into "after" and check if all plugins
    // mentioned in after/before are actually there
    var requirements = byId.mapGroups((id, {before, after}) => {
    	  before = before || [];
    	  after = after || [];
    	  var missing = before.concat(after).filter(id => !byId[id]);
    	  if (missing.length)
    	    throw new Error(`Error in ${this} orderPlugins: Plugin ${id} requires ${missing.join(", ")} but ${missing.length === 1 ? "this plugin" : "those plugins"} cannot be found.`)
    	  return {before, after}
    	});

    var remaining = obj.values(byId);
    remaining.forEach(({pluginId, before}) =>
      requirements[pluginId].before.forEach(otherId =>
      	 requirements[otherId].after.push(pluginId)));

    // compute order
    var resolvedGroups = [],
        resolvedIds = [],
        lastLength = remaining.length + 1;

    while (remaining.length) {
      if (lastLength === remaining.length)
        throw new Error("Circular dependencies in handler order, could not resolve handlers "
			  + remaining.map(ea => ea.pluginId).join(", "))
      lastLength = remaining.length;
      var resolvedNow = remaining.filter(({pluginId}) => isSubset(requirements[pluginId].after, resolvedIds));

      resolvedIds.push(...resolvedNow.map(ea => ea.pluginId));
      resolvedGroups.push(resolvedNow);
      remaining = arr.withoutAll(remaining, resolvedNow);
    }

    return arr.flatten(resolvedGroups, 1);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function isSubset(list1, list2) {
      // are all elements in list1 in list2?
      for (var i = 0; i < list1.length; i++)
	if (!list2.includes(list1[i]))
	  return false;
      return true;
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  toString() {
    var {_state, hostname, port} = this;
    return `LivelyServer(${hostname}:${port} ${_state})`;
  }

}
