function loadUncached(urls, thenDo) {
  if (!urls.length) { thenDo && thenDo(); return; }
  var url = urls.shift();
  loadViaScript(url, urls, thenDo)
}

function loadUncached_es5Compat(urls, thenDo) {
  if (!urls.length) { thenDo && thenDo(); return; }
  babel.load(urls[0], function() { loadUncached_es5Compat(urls.slice(1), thenDo); });
}

function loadViaScript(url, urls, thenDo) {
  var script = document.createElement('script');
  script.src = url + (url.indexOf('?') > -1 ? '&' : '?' + Date.now());
  script.type = "application/javascript";
  document.head.appendChild(script);
  script.addEventListener('load', function() { loadUncached(urls, thenDo); });
}