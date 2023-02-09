/*global System*/
// import 'systemjs';
import { resource, loadViaScript } from 'lively.resources';
import { promise, obj } from 'lively.lang';
import * as modulePackage from 'lively.modules';
import 'lively.modules/systemjs-init.js';

lively.modules = modulePackage; // temporary modules package used for bootstrapping
lively.FreezerRuntime = null;

if (document.location.host !== "lively-next.org")
  document.title = `lively.next (${document.location.host})`;
let status = document.getElementById("dom-loading-status");
function log() {
  console.log(...arguments);
  status.innerText = [...arguments].join(" ");
}
var loc = document.location,
    origin = loc.origin,
    query = resource(loc.href).query(),
    loadingIndicator = document.getElementById("dom-loading-indicator"),
    worldNameMatch = decodeURIComponent(loc.pathname).match(/\/worlds\/(.+)/),
    worldName = worldNameMatch
      ? worldNameMatch[1].replace(/(\.json)?($|\?.*)/, ".json$2")
      : "default",
    res = resource(origin + "/" + "lively.morphic/worlds/" + worldName),
    loginDone = false,
    worldLoaded = false,
    isBenchmark = worldNameMatch && worldNameMatch[1].startsWith("morph benchmark")/*FIXME!!!2017-11-15*/,
    doBootstrap = !query.quickload && !isBenchmark,
    askBeforeQuit = 'askBeforeQuit' in query ? !!query.askBeforeQuit : true;

Promise.resolve()
  .then(polyfills)
  .then(function() { return (doBootstrap) ? bootstrapLivelySystem() : fastPrepLivelySystem(); })
  .then(function() {
    let t = Date.now() - window._livelyLoadStart;
    log(`...lively systems are ready`);
    console.log(`load time ${t}ms`);
  })
  .then(function() {
    log("Loading lively.2lively...");
    return lively.modules.registerPackage('lively.2lively');
  })
  .then(function() {
    if (askBeforeQuit) {
      window.addEventListener('beforeunload', function(evt) {
        var msg = "Really?";
        evt.returnValue = msg;
        return msg;
      }, true);
    }
    return {
      resource: res,
      showWorldLoadDialog: !worldNameMatch,
    };
  })
  .then(function(worldLocation) {
    log("Loading lively.morphic...");
    return Promise.all([
      lively.modules.importPackage('lively.morphic'),
      promise.waitFor(function() { return loginDone; })
    ]).then(function([morphic]) {
      log("Loading world...");
      return morphic.World.loadWorldFromURL(worldLocation.resource, null, {
        verbose: true,
        localconfig: true,
        l2l: true,
        shell: true,
        worldLoadDialog: worldLocation.showWorldLoadDialog,
        browserURL: "/worlds/" + worldLocation.resource.name().replace(/\.json($|\?)/, "")
      });
    })
  })
  .then(function() {
    worldLoaded = true;
    let t = Date.now() - window._livelyLoadStart;
    log(`...lively.morphic world ready`);
    console.log(`load time ${t}ms`);
  })
  .catch(function(err) {
    //if (err.originalErr) err = err.originalErr;  // do not hide vital information!
    console.error(err);
    var printed = err.message;
    if (err.stack !== err.message) {
      printed += err.stack.includes(err.message) ? err.stack.replace(err.message, "\n") : err.stack;
      console.error(printed);
    }
    let pre = document.createElement("pre");
    pre.innerText = printed;
    document.body.appendChild(pre);
  });

function fastPrepLivelySystem() {
  return Promise.resolve()
    .then(function() { log("starting fast system preparation..."); })
    .then(function() { return resource(origin).join("package-registry.json").readJson(); })
    .then(function (packageCached) {
      System["__lively.modules__packageRegistry"] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      return System;
    })
}

function bootstrapLivelySystem() {
  // for loading an instrumented version of the packages comprising the lively.system
  return Promise.resolve()
    .then(function() { log("starting bootstrap process..."); })

    .then(function() { return resource(origin).join("package-registry.json").readJson(); })
    .then(function (packageCached) {
      var System = lively.modules.getSystem("bootstrapped", {baseURL: origin});
      // System.debug = true;
      lively.modules.changeSystem(System, true);
      System["__lively.modules__packageRegistry"] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      return System;
    })
    .then(function() {
      return importPackageAndDo(
        "lively.lang",
        function(m) { delete m._prevLivelyGlobal; }); })

    .then(function() {
      return importPackageAndDo(
        "lively.ast",
        function(m) { lively.ast = m; }); })

    .then(function() {
      return importPackageAndDo(
        "lively.source-transform",
        function(m) { lively.sourceTransform = m; }); })

    .then(function() {
      return importPackageAndDo(
        "lively.classes",
        function(m) { lively.classes = m; }); })

    .then(function() {
      return importPackageAndDo(
        "lively.vm",
        function(m) { lively.vm = m; }); })

    .then(function() {
      return importPackageAndDo(
        "lively.modules",
        function(m) {
          lively.modules = m;
          lively.modules.unwrapModuleLoad();
          lively.modules.unwrapModuleResolution();
          lively.modules.wrapModuleLoad();
          lively.modules.wrapModuleResolution();
          let oldRegistry = System["__lively.modules__packageRegistry"];
          delete System["__lively.modules__packageRegistry"];
          let newRegistry = System["__lively.modules__packageRegistry"] = m.PackageRegistry.ofSystem(System);
          Object.assign(newRegistry, obj.select(oldRegistry, ["packageMap", "individualPackageDirs", "devPackageDirs", "packageBaseDirs"]))
          newRegistry.resetByURL();
        })})

    .then(function() {
      return importPackageAndDo(
        "lively.storage",
        function(m) { lively.storage = m; })})
}

function importPackageAndDo(packageURL, doFunc) {
  var name = packageURL.split("/").slice(-1)[0];
  log(`...loading ${name}...`);
  return lively.modules.importPackage(packageURL)
    .then(doFunc || function() {});
}

function polyfills() {
  var loads = [];
  if (!("PointerEvent" in window))
    loads.push(loadViaScript(`${origin}/lively.next-node_modules/pepjs/dist/pep.js`));
  if (!("fetch" in window))
    loads.push(loadViaScript(`//cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.js`));
  return Promise.all(loads);
}