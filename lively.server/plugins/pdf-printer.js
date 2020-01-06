import { HeadlessSession } from "lively.headless";
import L2LClient from "lively.2lively/client.js";
import { promise } from "lively.lang";
import PDFRStreamForBuffer from 'hummus/PDFRStreamForBuffer.js';
import pdftk from 'node-pdftk';
import { obj } from "lively.lang";

export default class PDFPrinter {

  get pluginId() { return "PDFPrinter" }

  handleRequest(req, res, next) {
    if (!req.url.startsWith("/subserver/PDFPrinter")) return next();
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("PDFPrinter is running!");
  }

  async setup(livelyServer) {
    if (!this.l2lClient) {
      let {hostname, port} = livelyServer
      this.l2lClient = L2LClient.ensure({
        url: `http://${hostname}:${port}/lively-socket.io`,
        namespace: "l2l", info: {
          type: "pdf printer",
          location: "server"
        }
      })
      this.l2lClient.options.ackTimeout = 1000*60*3;
    }
   
    [
      "[PDF printer] print"
    ].forEach(sel => this.l2lClient.addService(sel, this[sel].bind(this)));

    this.l2lClient.whenRegistered()
      .then(() => console.log('[PDF printer] loading...'))
      .then(() => this.ensureHeadless())
      .then(() => console.log("[PDF printer] printer ready!"))
      .catch(err => console.error(`printer initialization failed`, err))
  }

  async ensureHeadless() {
    if (this.headlessSession) return this.headlessSession;
    this.headlessSession = await HeadlessSession.open("http://localhost:9011/worlds/default?nologin", (sess) =>
      sess.runEval("typeof $world !== 'undefined'"));
    await this.headlessSession.runEval(`if ($world.get('user flap')) $world.get('user flap').remove();`);
    return this.headlessSession;
  }

  async printFromSnapshot(snapshot) {
    let sess = await this.ensureHeadless();
    // deserailize the snapshot, and wait until rendered
    let { x: width, y: height } = await sess.runEval(`
       const { loadMorphFromSnapshot } = await System.import("lively.morphic/serialization.js");
       $world.submorphs = [];
       $world._objectToPrint = await loadMorphFromSnapshot(${JSON.stringify(snapshot)});
       $world._objectToPrint.openInWorld();
       // resize the world to fit 
       $world._objectToPrint.top = $world._objectToPrint.left = 0;
       $world.extent = $world._objectToPrint.extent;
       await $world.whenRendered();
       $world.extent;
    `);
    await sess.page.emulateMedia('screen');
    return await sess.page.pdf({ width: width, height: height + 1, printBackground: true });
  }

  async "[PDF printer] print"(tracker, {sender, data }, ackFn, socket) {
    // FIXME: if printing is already in progress? add monitor
    // get the headless session
    let buffer;
    if (obj.isArray(data)) {
      let pages = [];
      for (let snapshot of data) {
        pages.push(await this.printFromSnapshot(snapshot));
      }
      buffer = await pdftk.input(pages).output()
    } else buffer = await this.printFromSnapshot(data.snapshot)
    ackFn(buffer);
  }
}
