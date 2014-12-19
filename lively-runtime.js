lively.require("lively.lang.Runtime").toRun(function() {

  var r = lively.lang.Runtime;
  r.Registry.addProject(r.Registry.default(), {
    name: "lively.ast",
    rootDir: "/home/lively/expt/lively.ast/",

    reloadAll: function(project, thenDo) {
      // var project = r.Registry.default().projects["lively.ast"];
      // project.rootDir = "/Users/robert/Lively/lively.ast"
      // project.reloadAll(project, function(err) { err ? show(err.stack || String(err)) : alertOK("reloaded!"); })
      var files = ["./env.js",
                   "./index.js",
                   "./lib/acorn-extension.js",
                   "./lib/mozilla-ast-visitors.js",
                   "./lib/mozilla-ast-visitor-interface.js",
                   "./lib/query.js",
                   "./lib/transform.js",
                   "./tests/interface-test.js",
                   "./tests/acorn-extension-test.js",
                   "./tests/query-test.js",
                   "./tests/transform-test.js"
                   ];

      lively.lang.fun.composeAsync(
        function deps(n) { lively.requires("lively.MochaTests").toRun(function() { n(); }); },
        function readFiles(n) {
          lively.lang.arr.mapAsyncSeries(files,
            function(fn,_,n) {
              lively.shell.cat(fn, {cwd: project.rootDir},
              function(err, c) { n(err, {name: fn, content: c}); });
            }, n);
        },
        function(fileContents, next) {
          lively.lang.arr.mapAsyncSeries(fileContents,
            function(ea,_,n) { r.Project.processChange(project, ea.name, ea.content, n); },
            next);
        }
      )(thenDo);
    },

    resources: {

      "env.js": {
        matches: /env.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state || {};
          var withAcornLibDo = state.acorn ?
            function(thenDo) { thenDo(null, state.acorn); } :
            loadFreshAcorn.curry(project.rootDir);
          withAcornLibDo(function(err, acorn) {
            if (err) return whenHandled(err);
            state = project.state = {
              acorn: acorn, escodegen: escodegen,
              lively: {
                lang: lively.lang,
                ast: lively.lang.Path("state.lively.ast").get(project) || {},
                'lively.lang_env': null
              }
            }
            state.window = state;
            evalCode(change.newSource, state, change.resourceId);
      	  	whenHandled();
          });
        }
      },

      "interface code": {
        matches: /(lib\/.*|index)\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state || {};
          evalCode(change.newSource, state, change.resourceId);
    	  	whenHandled();
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
  
  function loadFreshAcorn(livelyAstDir, thenDo) {
    var oldAcorn = Global.acorn;
    delete Global.acorn;
    lively.lang.arr.mapAsyncSeries(
      ['acorn.js','acorn_loose.js','util/walk.js'],
       function(fn,_,n) {
         lively.shell.cat(
           lively.lang.string.joinPath(livelyAstDir, "node_modules/acorn/", fn),
           function(err, src) {
             if (err) return n(err, null);
             try { eval(src+"\n//# sourceURL="+fn); } catch (e) {
               show("error getting " + fn + "\n" + e);
               return n(e); }
             n(); });
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
