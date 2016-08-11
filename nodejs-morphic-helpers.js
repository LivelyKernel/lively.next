import { evalStrategies } from "lively.vm";
import { obj, string, promise } from "lively.lang";


var shell = lively.shell;

// var state = await startMorphicNodejsProcessAndWorld()
// state.workspace.targetMorph.

export async function startMorphicNodejsProcessAndWorld() {
  await shell.writeFile(string.joinPath(shell.WORKSPACE_LK, ".lively-morphic-nodejs-server.js"), serverSource);
  var win = shell.runInWindow("node .lively-morphic-nodejs-server.js", {cwd: shell.WORKSPACE_LK, group: "lively.morphic-nodejs-world"}),
      cmd = win.targetMorph.currentCommand;

  await promise.waitFor(20*1000, () => !cmd.isRunning() || cmd.output.includes("lively-system-interface imported"));

  if (!cmd.isRunning())
    throw new Error("Failed starting server: " + cmd.output)

  var evalURL = evalStrategies.HttpEvalStrategy.defaultURL,
      evalStrategy = new evalStrategies.HttpEvalStrategy(evalURL);

  var workspace = await new Promise((resolve, reject) =>
    lively.ide.commands.byName["lively.ide.openWorkspace"].exec({
      thenDo: (err, workspace) => err ? reject(err) : resolve(workspace),
      title: "workspace for lively.morphic nodejs world at " + evalURL,
      content: `import { MorphicEnv } from "lively.morphic/index.js";
var env = MorphicEnv.default();
var world = env.world`}));

  var serverView = await openServerView(evalStrategy);

  workspace.targetMorph.state = {evalStrategy};

  return {workspace, serverView, serverCommandWindow: win, serverCommand: cmd};
}

async function openServerView(evalStrategy) {
  var wrapper = new lively.morphic.HtmlWrapperMorph(pt(550,550))
  wrapper.state = {evalStrategy};

  var win = wrapper.openInWindow({title: "nodejs morphic world"})

  wrapper.addScript(function update() {
    var cmd = lively.shell.getGroupCommandQueue("lively.morphic-nodejs-world").first();
    if (!cmd || !cmd.isRunning()) return this.stopStepping();

    var options = {asString: false, targetModule: "lively://nodejs-morphic-world/"}
    this.state.evalStrategy.runEval('import { MorphicEnv } from "lively.morphic/index.js"; MorphicEnv.default().domEnv.document.documentElement.outerHTML;', options)
      .then(evalResult => this.setHTML(evalResult.value))
      .catch(err => this.setHTML(String(err)))
  });

  wrapper.addScript(function onShutdown() {
    var cmd = lively.shell.getGroupCommandQueue("lively.morphic-nodejs-world").first();
    return cmd && cmd.kill("SIGTERM");
  });

  var btn = win.addMorph(new lively.morphic.Button(lively.rect(0,0,100,20), "update"));
  btn.align(btn.bounds().topLeft(), wrapper.bounds().topLeft().addXY(4,4));
  lively.bindings.connect(btn, 'fire', wrapper, 'update');

  wrapper.setHTML("<h1>Please wait, loading morphic, creating world...</h1>");

  await createMorphicWorld(evalStrategy);

  wrapper.update();
  wrapper.startStepping(900, "update");

  return win;
}

async function createMorphicWorld(evalStrategy) {
  var options = {asString: true, targetModule: "lively://nodejs-morphic-world/"},
      evalResult = await evalStrategy.runEval(`await lively.modules.importPackage("file://${shell.WORKSPACE_LK}/node_modules/lively.morphic/");`, options)

  if (evalResult.isError) throw new Error(evalResult.value);

  evalResult = await evalStrategy.runEval(worldCreationSource, options);
  if (evalResult.isError) throw new Error(evalResult.value);
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME this should go in some module...

var worldCreationSource = `
import { createDOMEnvironment } from "lively.morphic/rendering/dom-helper.js";
import { morph, MorphicEnv } from "lively.morphic/index.js";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { num } from "lively.lang";
import { ObjectDrawer, Workspace } from "lively.morphic/tools.js";

var env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()))
env.setWorld

var world = morph({
    env, type: "world", extent: pt(500,500),
    submorphs: [
      new ObjectDrawer({env, position: pt(20,10)}),
      {env, type: "List", items: lively.lang.arr.range(0,150).map(n => "item " + n), extent: pt(200, 300), position: pt(200,200), borderWidth: 1, borderColor: Color.gray},
      new Workspace({env, extent: pt(200, 300), position: pt(400,200)})
    ]});
env.setWorld(world);
`

var serverSource = `
require("systemjs");
require("lively.modules");
require("lively.lang");
require("lively.vm");
var http = require("http");

process.on('uncaughtException', function(err) { console.error(err); });

Promise.resolve()
  .then(() => new Promise((resolve, reject) =>
    // http2.createServer(options, function(req, res) {
    http.createServer(function(req, res) {
      cors(req, res, () => {
        evalHandler("/lively")(req, res, () => {
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end('not supported: ' + req.url);
        });
      });
    }).listen(3000, resolve)))
  .then(() => console.log("lively.system running at http://localhost:3000/lively"))
  .then(() => lively.modules.importPackage("file:///Users/robert/Lively/LivelyKernel2/node_modules/lively-system-interface"))
  .then((system) => { global.livelySystem = system; console.log("lively-system-interface imported"); })
  .catch(err => console.error("Error starting HTTPS server: " + err.stack || err));

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports

function cors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS, PROPFIND, REPORT, MKCOL');
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Depth, Cookie, Set-Cookie, Accept, Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Date, Etag, Set-Cookie");
  next();
}


function evalHandler(route) {

  return function postHandler(req, res, next) {
    if (route !== req.url || req.method !== "POST") return next();
    var data = '';
    req.on('data', d => data += d.toString());
    req.on('end', () => {
      Promise.resolve().then(() => {
        var result = eval(data);
        if (!(result instanceof Promise)) {
          console.error("unexpected eval result:" + result)
          throw new Error("unexpected eval result:" + result);
        }
        return result;
      })
      .then(evalResult => {
        evalResult = lively.lang.obj.dissoc(evalResult, ["promisedValue"])
        // console.log(evalResult)
        try { return JSON.stringify(evalResult); } catch (e) {
          evalResult.printed({asString: true})
          return JSON.stringify(evalResult)
        }
      })
      .then(stringifiedEvalResult => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(stringifiedEvalResult);
      })
      .catch(err => {
        console.error("eval error: " + err);
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({isError: true, value: String(err.stack || err)}));
      });
    });
  }

}`