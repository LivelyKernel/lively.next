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
