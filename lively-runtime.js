lively.require("lively.lang.Runtime").toRun(function() {

  var r = lively.lang.Runtime;
  r.Registry.addProject(r.Registry.default(), {
    name: "lively.vm",
    rootDir: "/home/lively/expt/lively.vm/",

    reloadAll: function(project, thenDo) {
      // var project = r.Registry.default().projects["lively.vm"];
      // project.reloadAll(project, function(err) { err ? show(err.stack || String(err)) : alertOK("reloaded!"); })
      var files = ["env.js",
                   "index.js",
                   "tests/vm-test.js"
                  ];

      lively.lang.fun.composeAsync(
        function deps(n) { lively.requires("lively.MochaTests").toRun(function() { n(); }); },
        function readFiles(n) {
          lively.lang.arr.mapAsyncSeries(files,
            function(fn,_,n) {
              lively.shell.cat(fn, {cwd: project.rootDir},
              function(err, c) {
                show(c)
                n(err, {name: fn, content: c}); });
            }, n);
        },
        function(fileContents, next) {
debugger;
          lively.lang.arr.mapAsyncSeries(fileContents,
            function(ea,_,n) {
debugger;
show(lively.lang.string.joinPath(project.rootDir, ea.name))
              r.Project.processChange(
                project, lively.lang.string.joinPath(project.rootDir, ea.name),
                ea.content, n);
            },
            next);
        }
      )(thenDo);
    },

    resources: {

      "env.js": {
        matches: /lively.vm\/env.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state || (project.state = {
            lively: {
              lang: project.state ? project.state.lively.lang : lively.lang,
              ast: project.state ? project.state.lively.ast : lively.ast
            }
          });
show(state)
          evalCode(change.newSource, state, change.resourceId);
    	  	whenHandled();
        }
      },

      "interface code": {
        matches: /lively.vm\/(lib\/.*|index)\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state || {};
          evalCode(change.newSource, state, change.resourceId);
    	  	whenHandled();
        }
      },

      "tests": {
        matches: /lively.vm\/tests\/.*\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          if (!project.state) {
            var msg = "cannot update runtime for " + change.resourceId + "\n because the runtime state is undefined."
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
});
