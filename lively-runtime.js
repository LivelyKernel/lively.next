lively.require("lively.lang.Runtime").toRun(function() {

  var r = lively.lang.Runtime.Registry;
  r.addProject(r.default(), {
    name: "lively.ast",
    rootDir: "/home/lively/expt/lively.ast/",

    resources: {

      "interface code": {
        matches: /(lib\/.*\.js|index\.js)$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state || {};
          var withAcornLibDo = state.acorn ?
            function(thenDo) { thenDo(null, state.acorn); } :
            loadFreshAcorn;
          withAcornLibDo(function(err, acorn) {
            if (err) return whenHandled(err);
            state = project.state = lively.lang.obj.extend(state, {
              acorn: acorn,
              escodegen: Global.escodegen,
              lively: {
                lang: lively.lang,
                ast: lively.lang.Path("state.lively.ast").get(project) || {}
              }
            });
            evalCode(change.newSource, state, change.resourceId);
            lively.ast2 = state.lively.ast;
      	  	whenHandled();
          });
        }
      },

      "tests": {
        matches: /tests\/.*\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          if (!project.state) {
            var msg = "cannot update runtime state for " + change.resourceId + "\n because the lib code wasn't loaded."
            show(msg); whenHandled(new Error(msg)); return;
          }
          lively.requires("lively.MochaTests").toRun(function() {
            evalCode(change.newSource, project.state, change.resourceId);
            lively.MochaTests.runAll();
      	  	whenHandled();
          })
        }
      }
    }
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function evalCode(code, state, resourceName) {
    lively.lang.VM.runEval(code,
      {topLevelVarRecorder: state, context: state, sourceURL: resourceName},
      function(err, _result) {
    		err && show("error when updating the runtime for " + resourceName + "\n" + (err.stack || err));
    		!err && alertOK("updated");
    	});
  }
  
  function loadFreshAcorn(thenDo) {
    var baseURL = URL.root.withFilename("node_modules/lively.ast/node_modules/acorn/");
    var oldAcorn = Global.acorn;
    delete Global.acorn;
    lively.lang.arr.mapAsyncSeries(
      ['acorn.js','acorn_loose.js','util/walk.js'],
       function(fn,_,n) {
         baseURL.withFilename(fn).asWebResource().beAsync()
           .get().whenDone(function(content, status) {
             try { eval(content+"\n//# sourceURL="+fn); } catch (e) {
               show("error getting " + fn + "\n" + e);
               return n(e);
             }
             n();
           })
       },
       function(err) {
         if (err) show("could not load acorn: " + (err.stack || err));
         else alertOK("acorn freshly loaded");
         var newAcorn = Global.acorn;
         Global.acorn = oldAcorn;
         thenDo && thenDo(err, newAcorn);
       });
  }
});
