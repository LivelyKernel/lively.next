lively.require("lively.lang.Runtime").toRun(function() {

  lively.lang.Runtime.Registry.addProject({
    name: "lively.vm",
    state: {},

    reloadAll: function(project, thenDo) {
      var files = ["env.js", "index.js", "tests/vm-test.js"];
      lively.lang.Runtime.loadFiles(project, files, thenDo);
    },

    resources: {

      "env.js": {
        matches: /env.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state || (project.state = {
            lively: {
              lang: project.state ? project.state.lively.lang : lively.lang,
              ast: project.state ? project.state.lively.ast : lively.ast
            }
          });
          lively.lang.Runtime.evalCode(project, change.newSource, state, change.resourceId, whenHandled);
        }
      },

      "interface code": {
        matches: /(lib\/.*|index)\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          whenHandled();
          // var state = project.state || {};
          // lively.lang.Runtime.evalCode(project, change.newSource, state, change.resourceId, whenHandled);
          // if (state.vm) lively.vm = state.vm;
        }
      },

      "tests": {
        matches: /tests\/.*\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          whenHandled();
          // if (!project.state) {
          //   var msg = "cannot update runtime for " + change.resourceId + "\n because the runtime state is undefined."
          //   show(msg); whenHandled(new Error(msg)); return;
          // }
          // lively.requires("lively.MochaTests").toRun(function() {
          //   lively.lang.obj.extend(project.state, {mocha: Global.mocha, chai: Global.chai, expect: Global.expect});
          //   lively.lang.Runtime.evalCode(project, change.newSource, project.state, change.resourceId, whenHandled);
          // });
        }
      }
    }
  });

});
