module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {sourceMap: true, sourceMapStyle: 'link', separator: ';\n'},
      livelyAST: {
        src: ["node_modules/escodegen/escodegen.browser.min.js",
              "node_modules/acorn/acorn.js",
              "node_modules/acorn/util/walk.js",
              "node_modules/acorn/acorn_loose.js",
              "node_modules/lively.lang/lively.lang.min.js",
              "env.js",
              "index.js",
              "lib/acorn-extension.js",
              "lib/mozilla-ast-visitors.js",
              "lib/mozilla-ast-visitor-interface.js"],
        dest: 'lively.ast.dev.js'
      }
    },

    uglify: {
      livelyAST: {
        options: {
          sourceMap: true,
          banner: '/*! <%= pkg.name %>-v<%= pkg.version %> '
                + '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        files: {'lively.ast.min.js': 'lively.ast.dev.js'}
      }
    }

  });

  grunt.registerTask('build', ['concat', 'uglify']);
};
