module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {sourceMap: true, sourceMapStyle: 'link', separator: ';\n'},
      "lively.vm-bundle": {
        src: ["node_modules/lively.ast/lively.ast.dev-bundle.js",
              "env.js", "index.js"],
        dest: 'lively.vm.dev-bundle.js'
      },
      "lively.vm": {
        src: ["env.js", "index.js"],
        dest: 'lively.vm.dev.js'
      }
    },

    uglify: {
      "lively.vm-bundle": {
        options: {
          sourceMap: true,
          banner: '/*! <%= pkg.name %>-v<%= pkg.version %> '
                + '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        files: {'lively.vm.min-bundle.js': 'lively.vm.dev-bundle.js'}
      },
      "lively.vm": {
        options: {
          sourceMap: true,
          banner: '/*! <%= pkg.name %>-v<%= pkg.version %> '
                + '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        files: {'lively.vm.min.js': 'lively.vm.dev.js'}
      }
    }

  });

  grunt.registerTask('build', ['concat', 'uglify']);

};
