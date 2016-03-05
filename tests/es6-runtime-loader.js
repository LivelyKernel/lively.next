function log(msg) {
  var stringified = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  document.querySelector("#log").insertAdjacentHTML("beforeend", '<li><pre>' + stringified + '</li>');
}

function get(url, thenDo) {
  var res, rej, p;
  if (typeof Promise === "function") p = new Promise(function(resolve, reject) { res = resolve; rej = reject; });
  var xhr = new XMLHttpRequest();
  xhr.onerror = function(err) { thenDo && thenDo(err); rej && rej(err); };
  xhr.onreadystatechange = function() {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      thenDo && thenDo(null, xhr.responseText)
      res && res(xhr.responseText)
    }
  };
  xhr.open('GET', url, true); xhr.send(null);
  return p;
}


var root = (function() {
  var l = document.location;
  return `${l.protocol}//${l.hostname}:${l.port}`
})();

get("../dist/es6-runtime-config-browser.json")
  .then(conf => {
    conf = JSON.parse(conf);
    conf.baseURL = root;
    conf.map["lively.vm"] = root;
    System.config(conf);
  })
  .then(() => System.import("lively.vm"))
  .then(vm =>
    vm.runEval("'DO' + 'NE'")
      .then(r => { if (r.error) throw r.error; console.log(r.value)}))
  .catch(err => console.error(err));
