lively.require("lively.lang.Runtime", "lively.ide.CommandLineInterface").toRun(function() {

  lively.lang.Runtime.Registry.addProject({

    name: "lively.ast",
    
    state: {},

    reloadAll: function(project, thenDo) {
      // var project = lively.lang.Runtime.Registry.current().projects["lively.ast"]
      // project.reloadAll(project, show.curry("%s %s"))
      var dist = lively.lang.string.joinPath(project.rootDir, "dist/lively.ast.js"),
          indicator,
          cat = lively.lang.promise(lively.shell.cat.bind(lively.shell)),
          run = lively.lang.promise(lively.shell.run.bind(lively.shell));
      return lively.ide.withLoadingIndicatorDo("loading lively.ast")
        .then(_indicator => (indicator = _indicator) && run("npm run build", {cwd: project.rootDir}))
        .then(() => cat(dist))
        .then((code) => lively.lang.Runtime.evalCode(project, code, project.state, dist, () => {}))
        .then(() => {
          indicator.remove();
          typeof thenDo === "function" && thenDo();
          $world.alertOK("lively.ast loaded");
          return project;
        })
        .catch((err) => {
          indicator.remove();
          typeof thenDo === "function" && thenDo(err);
          $world.logError("Error loading lively.ast: " + err);
          return err;
        });
    },

    resources: {

      "env.js": {
        matches: /env.js$/,
        changeHandler: function(change, project, resource) {
          var s = project.state;
          lively.lang.obj.extend(s, {
            window: s,
            acorn: window.acorn,
            escodegen: window.escodegen,
            lively: {
              lang: lively.lang,
              ast: lively.lang.Path("state.lively.ast").get(project) || {},
              'lively.lang_env': null
            }
          });
  				lively.lang.Runtime.evalCode(project, change.newSource, project.state, change.resourceId);
        }
      },

      "interface code": {
        matches: /(lib\/.*|index)\.js$/,
        changeHandler: function(change, project, resource) {
          lively.lang.Runtime.evalCode(project, change.newSource, project.state, change.resourceId);
        }
      },

      "tests": {
        matches: /tests\/.*\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          // since the tests depend on mocha we make sure this is loaded:
          lively.lang.fun.composeAsync(
            function(next) {
              lively.require("lively.MochaTests").toRun(function() { next(); });
            },
            function(next) {
              lively.lang.obj.extend(project.state, {mocha: Global.mocha, chai: Global.chai, expect: Global.expect});
              lively.lang.Runtime.evalCode(project, change.newSource, project.state, change.resourceId, next);
            }
          )(function(err) {
            whenHandled(err);
            if (err) show(String(err));
            else lively.lang.fun.debounceNamed("lively.ast-runtime-test-load", 300,
              () => $world.alertOK("lively.ast tests loaded"))();
          });
        }
      }
    }
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function loadFreshAcorn(livelyAstDir, thenDo) {
    var oldAcorn = Global.acorn;
    delete Global.acorn;
    lively.lang.arr.mapAsyncSeries(
      ['acorn.js','acorn_loose.js','walk.js'],
       function(fn,_,n) {
         lively.shell.cat(
           lively.lang.string.joinPath(livelyAstDir, "node_modules/acorn/dist", fn),
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
