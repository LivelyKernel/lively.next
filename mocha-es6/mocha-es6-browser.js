/*global mochaEs6, System*/

(function mochaEs6BrowserSetup() {

  ensureHTMLAndCSS();
  window.mochaEs6RunBrowserTests = runBrowserTests;

  var myName = "mocha-es6-browser.js",
      mainLibName = "mocha-es6.js";

  function loadMochaEs6(thenDo) {

    if (typeof mochaEs6 !== "undefined") { whenLoaded(); return; }

    var scripts = document.getElementsByTagName("script"),
        thisScript = [].slice.call(scripts).filter(function(script) {
          return script.src && script.src.match(new RegExp(myName + "$"))})[0];

    var i = setInterval(function() {
      if (typeof mochaEs6 === "undefined") {
        log("waiting for " + mainLibName)
      } else { whenLoaded(); clearInterval(i); }
    }, 20);

    var dir = thisScript ?
      thisScript.src.split("/").slice(0,-1).join("/") + "/" :
      String(document.location).replace(/\/[^\/]+/, "");

    var el = addTag("mocha-script", "script", document.head);
    el.src = dir + mainLibName;

    function whenLoaded() {
      cacheMocha(dir);
      thenDo();
    }
  }

  function runBrowserTests(tests, options) {
    log("[mocha-es6] loading mochaEs6");
    loadMochaEs6(function() {
      options = options || {};
      if (!options.hasOwnProperty("reporter")) options.reporter = "html";

      var query = (window.location.search || '').replace(/^\?/, "").split("&").map(ea => ea.split("=")).reduce(function(q, kv) {
        q[kv[0]] = decodeURIComponent(kv[1]); return q; }, {});

      if (query.grep) options.grep = new RegExp(query.grep);
      if (query.fgrep) options.grep = query.fgrep;
      if (query.invert) options.invert = true;

      options.logger = {log: log};

      log("[mocha-es6] start loading %s test modules", tests.length);
      mochaEs6.runTestFiles(tests, options);
    })
  }

  function log(/*args*/) {
    console.log.apply(console, arguments);
    var msg = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
      msg = msg.replace("%s", arguments[i])
    }
    document.getElementById("mocha-es6-logger").innerHTML += "<li><pre>" + msg + "</pre></li>";
  }

  function cacheMocha(mochaDirURL) {
    var mochaBundleURL = mochaDirURL.replace(/\/$/, "") + "/mocha-es6.js";
    if (typeof System !== "undefined" && !System.get(mochaBundleURL)) {
      System.config({map: {"mocha-es6": mochaBundleURL}});
      System.set(mochaDirURL + "index.js", System.newModule(mochaEs6));
      System.set(mochaDirURL + "mocha-es6.js", System.newModule(mochaEs6));
    }
  }

  function ensureHTMLAndCSS() {
    var el = addTag("mocha-css", "style", document.head);
    el.textContent = mochaCSS();
    addTag("mocha-es6-logger", "ul", document.body)
    addTag("mocha", "div", document.body);
  }

  function addTag(id, tag, parentEl) {
    var existing = document.getElementById(id);
    if (existing) return existing;
    var el = document.createElement(tag);
    el.setAttribute("id", id);
    if (parentEl) parentEl.appendChild(el);
    return el;
  }

  function mochaCSS() {
    return "@charset \"utf-8\";\n"
    + ""
    + "body {\n"
    + "  margin:0;\n"
    + "}\n"
    + ""
    + "#mocha {\n"
    + "  font: 20px/1.5 \"IBM Plex Sans\";\n"
    + "  margin: 60px 50px;\n"
    + "}\n"
    + ""
    + "#mocha ul,\n"
    + "#mocha li {\n"
    + "  margin: 0;\n"
    + "  padding: 0;\n"
    + "}\n"
    + ""
    + "#mocha ul {\n"
    + "  list-style: none;\n"
    + "}\n"
    + ""
    + "#mocha h1,\n"
    + "#mocha h2 {\n"
    + "  margin: 0;\n"
    + "}\n"
    + ""
    + "#mocha h1 {\n"
    + "  margin-top: 15px;\n"
    + "  font-size: 1em;\n"
    + "  font-weight: 200;\n"
    + "}\n"
    + ""
    + "#mocha h1 a {\n"
    + "  text-decoration: none;\n"
    + "  color: inherit;\n"
    + "}\n"
    + ""
    + "#mocha h1 a:hover {\n"
    + "  text-decoration: underline;\n"
    + "}\n"
    + ""
    + "#mocha .suite .suite h1 {\n"
    + "  margin-top: 0;\n"
    + "  font-size: .8em;\n"
    + "}\n"
    + ""
    + "#mocha .hidden {\n"
    + "  display: none;\n"
    + "}\n"
    + ""
    + "#mocha h2 {\n"
    + "  font-size: 12px;\n"
    + "  font-weight: normal;\n"
    + "  cursor: pointer;\n"
    + "}\n"
    + ""
    + "#mocha .suite {\n"
    + "  margin-left: 15px;\n"
    + "}\n"
    + ""
    + "#mocha .test {\n"
    + "  margin-left: 15px;\n"
    + "  overflow: hidden;\n"
    + "}\n"
    + ""
    + "#mocha .test.pending:hover h2::after {\n"
    + "  content: '(pending)';\n"
    + "  font-family: 'IBM Plex Sans';\n"
    + "}\n"
    + ""
    + "#mocha .test.pass.medium .duration {\n"
    + "  background: #c09853;\n"
    + "}\n"
    + ""
    + "#mocha .test.pass.slow .duration {\n"
    + "  background: #b94a48;\n"
    + "}\n"
    + ""
    + "#mocha .test.pass::before {\n"
    + "  content: '✓';\n"
    + "  font-size: 12px;\n"
    + "  display: block;\n"
    + "  float: left;\n"
    + "  margin-right: 5px;\n"
    + "  color: #00d6b2;\n"
    + "}\n"
    + ""
    + "#mocha .test.pass .duration {\n"
    + "  font-size: 9px;\n"
    + "  margin-left: 5px;\n"
    + "  padding: 2px 5px;\n"
    + "  color: #fff;\n"
    + "  -webkit-box-shadow: inset 0 1px 1px rgba(0,0,0,.2);\n"
    + "  -moz-box-shadow: inset 0 1px 1px rgba(0,0,0,.2);\n"
    + "  box-shadow: inset 0 1px 1px rgba(0,0,0,.2);\n"
    + "  -webkit-border-radius: 5px;\n"
    + "  -moz-border-radius: 5px;\n"
    + "  -ms-border-radius: 5px;\n"
    + "  -o-border-radius: 5px;\n"
    + "  border-radius: 5px;\n"
    + "}\n"
    + ""
    + "#mocha .test.pass.fast .duration {\n"
    + "  display: none;\n"
    + "}\n"
    + ""
    + "#mocha .test.pending {\n"
    + "  color: #0b97c4;\n"
    + "}\n"
    + ""
    + "#mocha .test.pending::before {\n"
    + "  content: '◦';\n"
    + "  color: #0b97c4;\n"
    + "}\n"
    + ""
    + "#mocha .test.fail {\n"
    + "  color: #c00;\n"
    + "}\n"
    + ""
    + "#mocha .test.fail pre {\n"
    + "  color: black;\n"
    + "}\n"
    + ""
    + "#mocha .test.fail::before {\n"
    + "  content: '✖';\n"
    + "  font-size: 12px;\n"
    + "  display: block;\n"
    + "  float: left;\n"
    + "  margin-right: 5px;\n"
    + "  color: #c00;\n"
    + "}\n"
    + ""
    + "#mocha .test pre.error {\n"
    + "  color: #c00;\n"
    + "  max-height: 300px;\n"
    + "  overflow: auto;\n"
    + "}\n"
    + ""
    + "#mocha .test .html-error {\n"
    + "  overflow: auto;\n"
    + "  color: black;\n"
    + "  line-height: 1.5;\n"
    + "  display: block;\n"
    + "  float: left;\n"
    + "  clear: left;\n"
    + "  font: 12px/1.5 monaco, monospace;\n"
    + "  margin: 5px;\n"
    + "  padding: 15px;\n"
    + "  border: 1px solid #eee;\n"
    + "  max-width: 85%; /*(1)*/\n"
    + "  max-width: calc(100% - 42px); /*(2)*/\n"
    + "  max-height: 300px;\n"
    + "  word-wrap: break-word;\n"
    + "  border-bottom-color: #ddd;\n"
    + "  -webkit-border-radius: 3px;\n"
    + "  -webkit-box-shadow: 0 1px 3px #eee;\n"
    + "  -moz-border-radius: 3px;\n"
    + "  -moz-box-shadow: 0 1px 3px #eee;\n"
    + "  border-radius: 3px;\n"
    + "}\n"
    + ""
    + "#mocha .test .html-error pre.error {\n"
    + "  border: none;\n"
    + "  -webkit-border-radius: none;\n"
    + "  -webkit-box-shadow: none;\n"
    + "  -moz-border-radius: none;\n"
    + "  -moz-box-shadow: none;\n"
    + "  padding: 0;\n"
    + "  margin: 0;\n"
    + "  margin-top: 18px;\n"
    + "  max-height: none;\n"
    + "}\n"
    + ""
    + "/**\n"
    + " * (1): approximate for browsers not supporting calc\n"
    + " * (2): 42 = 2*15 + 2*10 + 2*1 (padding + margin + border)\n"
    + " *      ^^ seriously\n"
    + " */\n"
    + "#mocha .test pre {\n"
    + "  display: block;\n"
    + "  float: left;\n"
    + "  clear: left;\n"
    + "  font: 12px/1.5 monaco, monospace;\n"
    + "  margin: 5px;\n"
    + "  padding: 15px;\n"
    + "  border: 1px solid #eee;\n"
    + "  max-width: 85%; /*(1)*/\n"
    + "  max-width: calc(100% - 42px); /*(2)*/\n"
    + "  word-wrap: break-word;\n"
    + "  border-bottom-color: #ddd;\n"
    + "  -webkit-border-radius: 3px;\n"
    + "  -webkit-box-shadow: 0 1px 3px #eee;\n"
    + "  -moz-border-radius: 3px;\n"
    + "  -moz-box-shadow: 0 1px 3px #eee;\n"
    + "  border-radius: 3px;\n"
    + "}\n"
    + ""
    + "#mocha .test h2 {\n"
    + "  position: relative;\n"
    + "}\n"
    + ""
    + "#mocha .test a.replay {\n"
    + "  position: absolute;\n"
    + "  top: 3px;\n"
    + "  right: 0;\n"
    + "  text-decoration: none;\n"
    + "  vertical-align: middle;\n"
    + "  display: block;\n"
    + "  width: 15px;\n"
    + "  height: 15px;\n"
    + "  line-height: 15px;\n"
    + "  text-align: center;\n"
    + "  background: #eee;\n"
    + "  font-size: 15px;\n"
    + "  -moz-border-radius: 15px;\n"
    + "  border-radius: 15px;\n"
    + "  -webkit-transition: opacity 200ms;\n"
    + "  -moz-transition: opacity 200ms;\n"
    + "  transition: opacity 200ms;\n"
    + "  opacity: 0.3;\n"
    + "  color: #888;\n"
    + "}\n"
    + ""
    + "#mocha .test:hover a.replay {\n"
    + "  opacity: 1;\n"
    + "}\n"
    + ""
    + "#mocha-report.pass .test.fail {\n"
    + "  display: none;\n"
    + "}\n"
    + ""
    + "#mocha-report.fail .test.pass {\n"
    + "  display: none;\n"
    + "}\n"
    + ""
    + "#mocha-report.pending .test.pass,\n"
    + "#mocha-report.pending .test.fail {\n"
    + "  display: none;\n"
    + "}\n"
    + "#mocha-report.pending .test.pass.pending {\n"
    + "  display: block;\n"
    + "}\n"
    + ""
    + "#mocha-error {\n"
    + "  color: #c00;\n"
    + "  font-size: 1.5em;\n"
    + "  font-weight: 100;\n"
    + "  letter-spacing: 1px;\n"
    + "}\n"
    + ""
    + "#mocha-stats {\n"
    + "  position: fixed;\n"
    + "  top: 15px;\n"
    + "  right: 10px;\n"
    + "  font-size: 12px;\n"
    + "  margin: 0;\n"
    + "  color: #888;\n"
    + "  z-index: 1;\n"
    + "}\n"
    + ""
    + "#mocha-stats .progress {\n"
    + "  float: right;\n"
    + "  padding-top: 0;\n"
    + "}\n"
    + ""
    + "#mocha-stats em {\n"
    + "  color: black;\n"
    + "}\n"
    + ""
    + "#mocha-stats a {\n"
    + "  text-decoration: none;\n"
    + "  color: inherit;\n"
    + "}\n"
    + ""
    + "#mocha-stats a:hover {\n"
    + "  border-bottom: 1px solid #eee;\n"
    + "}\n"
    + ""
    + "#mocha-stats li {\n"
    + "  display: inline-block;\n"
    + "  margin: 0 5px;\n"
    + "  list-style: none;\n"
    + "  padding-top: 11px;\n"
    + "}\n"
    + ""
    + "#mocha-stats canvas {\n"
    + "  width: 40px;\n"
    + "  height: 40px;\n"
    + "}\n"
    + ""
    + "#mocha code .comment { color: #ddd; }\n"
    + "#mocha code .init { color: #2f6fad; }\n"
    + "#mocha code .string { color: #5890ad; }\n"
    + "#mocha code .keyword { color: #8a6343; }\n"
    + "#mocha code .number { color: #2f6fad; }\n"
    + ""
    + "@media screen and (max-device-width: 480px) {\n"
    + "  #mocha {\n"
    + "    margin: 60px 0px;\n"
    + "  }\n"
    + ""
    + "  #mocha #stats {\n"
    + "    position: absolute;\n"
    + "  }\n"
    + "}\n";
  }

})();
