import { HeadlessSession } from "lively.headless";
import L2LClient from "lively.2lively/client.js";
import { obj } from "lively.lang";
import LivelyServer from "lively.server/server.js";
var _l2lClient;

class HeadlessL2l {

  constructor(opts = {}) {
    var {hostname = "localhost", port = 9011} = opts;
    this.port = port;
    this.hostname = hostname;
    this.l2lClient = null;
  }

  async setup() {
    let {hostname, port, l2lClient, room} = this;
    if (!l2lClient) {
      l2lClient = this.l2lClient || (this.l2lClient = L2LClient.create({
        url: `http://${hostname}:${port}/lively-socket.io`,
        namespace: "l2l", info: {
          type: "headless-broker",
          location: "server"
        }
      }));
    }

    let services = Object.getOwnPropertyNames(HeadlessL2l.prototype)
      .filter(ea => ea.startsWith("[lively.headless]"));
    services.forEach(sel =>
      l2lClient.addService(sel,
         (tracker, msg, ackFn, socket) =>
           this[sel](tracker, msg, ackFn, socket)));
    
    await l2lClient.whenRegistered(null)
      .then(() => console.log("headless-broker ready"))
      .catch(err => console.error(`headless-broker failed...!`));

    return this;
  }

  async teardown() {
    if (this.l2lClient) this.l2lClient.remove();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // l2l services
  async "[lively.headless] open page"(tracker, msg, ackFn, socket) {
    let {url, id, aliveRepeatTimeout, aliveTimeout, screenshotPath, whenReadyTest} = msg.data;
    // url = "http://10.0.1.8:9011/worlds/lively%20headless?nologin=true"
    // url = "http://10.0.1.8:9011/worlds/default?nologin=true"
    // HeadlessSession.list().forEach(ea => ea.dispose())
    // await HeadlessSession.browser.close()
    // HeadlessSession.browser = null;

    let opts = {};
    if (aliveRepeatTimeout) opts.aliveRepeatTimeout = aliveRepeatTimeout;
    if (aliveTimeout) opts.aliveTimeout = aliveTimeout;
    if (screenshotPath) opts.screenshotPath = screenshotPath;
    let tester = sess => sess.runEval("typeof $world !== 'undefined'"),
        sess = id && HeadlessSession.findSessionById(id);
    try {
      if (sess) sess.options = opts;
      else sess = HeadlessSession.create(opts);
      await sess.open(url, tester);
      ackFn({id: sess.id, state: sess.state, url});
    } catch (err) { return ackFn({error: String(err)}); }
  }

  async "[lively.headless] dispose page"(tracker, msg, ackFn, socket) {
    let {id} = msg.data;
    let sess = await HeadlessSession.findSessionById(id);
    if (!sess) return ackFn({error: `Cannot find session ${id}`});
    try {
      await sess.dispose();
    } catch (err) { return ackFn({error: String(err)}); }
    ackFn({id: sess.id, state: sess.state});
  }

  async "[lively.headless] list pages"(tracker, msg, ackFn, socket) {
    let data = HeadlessSession.list().map(ea => obj.select(ea, ["state", "id", "url", "error"]));
    ackFn(data);
  }

  async "[lively.headless] screenshot"(tracker, msg, ackFn, socket) {
    let {id} = msg.data, sess = await HeadlessSession.findSessionById(id);
    if (!sess) return ackFn({error: `Cannot find session ${id}`});
    try {
      let data = await sess.screenshot()
      ackFn(data);
    } catch (err) { return ackFn({error: String(err)}); }
  }

  async "[lively.headless] save world"(tracker, msg, ackFn, socket) {
    let {id} = msg.data, sess = await HeadlessSession.findSessionById(id);
    if (!sess) return ackFn({error: `Cannot find session ${id}`});
    try {
      let saved = await sess.runEval(`await $world.execCommand("save world", {showSaveDialog: false});`)
      ackFn(saved);
    } catch (err) { return ackFn({error: String(err)}); }
  }

}

export default class LivelyHeadless {

  get pluginId() { return "lively.headless" }

  get after() { return ["l2l"]; }

  async setup(livelyServer) {
    // import LivelyServer from "lively.server/server.js";
    // let livelyServer = LivelyServer.servers.values().next().value
    // livelyServer.findPlugin("lively.headless").broker
    let {hostname, port} = livelyServer;
    this.broker = await new HeadlessL2l({hostname, port}).setup()
      .catch(err => console.error(`Error starting headless broker: `, err));
  }

  async close() {
    if (this.broker) this.broker.teardown();
  }

  handleRequest(req, res, next) {
    if (!req.url.startsWith("/subserver/LivelyHeadless")) return next();
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("LivelyHeadless is running!");
  }
}
