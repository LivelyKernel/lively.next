module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-browserify');
  require("./grunt-browserify-inlinerequire")();

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {sourceMap: true, sourceMapStyle: 'link', separator: ';\n'},
      livelyASTBundle: {
        src: ["escodegen.browser.min.js",
              // "acorn-jsx-browser.js",
              "node_modules/acorn/dist/acorn.js",
              "node_modules/acorn/dist/walk.js",
              "node_modules/acorn/dist/acorn_loose.js",
              "node_modules/lively.lang/lively.lang.dev.js",
              "env.js",
              "index.js",
              "lib/acorn-extension.js",
              "lib/mozilla-ast-visitors.js",
              "lib/mozilla-ast-visitor-interface.js",
              "lib/query.js",
              "lib/transform.js",
              "lib/comments.js",
              "lib/code-categorizer.js"],
        dest: 'lively.ast.dev-bundle.js'
      },
      livelyAST: {
        src: [ //"acorn-jsx-browser.js",
              "node_modules/acorn/dist/acorn.js",
              "node_modules/acorn/dist/walk.js",
              "node_modules/acorn/dist/acorn_loose.js",
              "env.js",
              "index.js",
              "lib/acorn-extension.js",
              "lib/mozilla-ast-visitors.js",
              "lib/mozilla-ast-visitor-interface.js",
              "lib/query.js",
              "lib/transform.js",
              "lib/comments.js",
              "lib/code-categorizer.js"],
        dest: 'lively.ast.dev.js'
      },
      "mocha-bundle": {
        src: ["node_modules/mocha/mocha.js",
              "tests/chai-bundle.js"],
        dest: "tests/mocha-bundle.js"
      }
    },

    uglify: {
      livelyASTBundle: {
        options: {
          sourceMap: true,
          banner: '/*! <%= pkg.name %>-v<%= pkg.version %> '
                + '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        files: {'lively.ast.min-bundle.js': 'lively.ast.dev-bundle.js'}
      },
      livelyAST: {
        options: {
          sourceMap: true,
          banner: '/*! <%= pkg.name %>-v<%= pkg.version %> '
                + '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        files: {'lively.ast.min.js': 'lively.ast.dev.js'}
      },
      "mocha-bundle": {
        files: {"tests/mocha-bundle.min.js": "tests/mocha-bundle.js"}
      }
    },

    browserify: {
      "acorn-jsx": {
        src: [],
        dest: './acorn-jsx-browser.js',
        options: {
          inlineRequire: {
            tempFilename: './acorn-jsx-browser-pre.js',
            inlineCode: "module.exports = require('acorn-jsx');",
            requires: [{name: "acorn-jsx"}]
          },
          browserifyOptions: {standalone: 'acorn', debug: false}
        }
      },
      "chai-bundle": {
        src: [],
        dest: './tests/chai-bundle.js',
        options: {
          inlineRequire: {
            tempFilename: './tests/chai-bundle-pre.js',
            inlineCode: "var c = require('chai'), subset = require('chai-subset');"
                      + "c.use(subset); global.expect = c.expect;"
                      + "module.exports = c;",
            requires: [{name: "chai", basedir: '.', expose: 'chai'}]
          },
          browserifyOptions: {standalone: 'chai', debug: false}
        }
      }
    }

  });

  grunt.registerTask('build', ['browserify:acorn-jsx', 'concat', 'uglify']);

  // note that mocha isn't browserify compatible
  grunt.registerTask('mocha-bundle', ['browserify:chai-bundle', 'concat:mocha-bundle', 'uglify:mocha-bundle']);

};
