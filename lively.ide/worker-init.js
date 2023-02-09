/*global self,jsdom,System*/

if (typeof self.initialize === 'undefined') {
  self.initialized = false;
  init();
}

function init() {

  function log() {
    console.log(...arguments);
  }

  function filteredFetch(proceed, load) {
      if (self.excludedModules.has(load.name)) {
        load.metadata.format = 'defined';
        return '';
      } else
        return proceed(load)
  }

  function instantiate_triggerOnLoadCallbacks(proceed, load) {
    var System = this;
    return proceed(load).then(result => {
      let originalExecute = result.execute;
      result.execute = () => {
        var res;
        try {
          if (self.excludedModules.has(load.name))
            res = System.newModule({});
          else 
            res = originalExecute();
        } catch(e) {
          console.warn(`[Worker] ${load.name} could not be executed inside worker context!`);
          res = System.newModule({});
        }
        return res;
      }
      return result;
    });
  }

  let {document, DOMParser, XPathEvaluator, XPathResult} = (new jsdom.JSDOM(`...`)).window;
  self.document = document;
  self.DOMParser = DOMParser;
  self.XPathEvaluator = XPathEvaluator;
  self.XPathResult = XPathResult;
  
  Promise.resolve()
    //.then(polyfills)
    .then(function() { return bootstrapLivelySystem(); })
    .then(function(worldLocation) {
      return Promise.all([
        lively.modules.importPackage('lively.morphic')
      ])
    })
    .then(function() {
       self.initialized = true;
    })
    .catch(function(err) {
      console.error(err);
      var printed = err.message;
      if (err.stack !== err.message) {
        printed += err.stack.includes(err.message) ? err.stack.replace(err.message, "\n") : err.stack;
        console.error(printed);
       }
    });
  
  function bootstrapLivelySystem() {
    // for loading an instrumented version of the packages comprising the lively.system
    return Promise.resolve()
      .then(function() { return lively.resources.resource(self.origin).join("package-registry.json").readJson(); })
      .then(function (packageCached) {
        var System = lively.modules.getSystem("bootstrapped", {baseURL: self.origin});
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
            lively.modules.wrapModuleLoad();
            let oldRegistry = System["__lively.modules__packageRegistry"];
            delete System["__lively.modules__packageRegistry"];
            let newRegistry = System["__lively.modules__packageRegistry"] = m.PackageRegistry.ofSystem(System);
            Object.assign(newRegistry, lively.lang.obj.select(oldRegistry, ["packageMap", "individualPackageDirs", "devPackageDirs", "packageBaseDirs"]))
            newRegistry.resetByURL();
          })})
      .then(function () {
        self.excludedModules = new Set([
            'lively.next-node_modules/web-animations-js/2.3.1/web-animations.min.js',
            'lively.next-node_modules/svgjs/2.6.2/dist/svg.js',
            'lively.next-node_modules/svg.easing.js/1.0.0/svg.easing.js',
            'lively.next-node_modules/svg.pathmorphing.js/0.1.1/dist/svg.pathmorphing.js'
          ].map(url => System.baseURL + url));    
         return System.import('lively.modules/src/hooks.js').then(
              ({install}) => {
                   install(System, "instantiate", instantiate_triggerOnLoadCallbacks)
                   install(System, "fetch", filteredFetch)
              })})
      .then(function() {
        return importPackageAndDo(
          "lively.storage",
          function(m) { lively.storage = m; })})
  }
  
  function importPackageAndDo(packageURL, doFunc) {
    var name = packageURL.split("/").slice(-1)[0];
  //  log(`...loading ${name}...`);
    return lively.modules.importPackage(packageURL)
      .then(doFunc || function() {});
  }
}