function log(msg) {
  var stringified = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  document.querySelector("#log").insertAdjacentHTML("beforeend", '<li><pre>' + stringified + '</li>');
}

function get(url, thenDo) {
  var xhr = new XMLHttpRequest();
  xhr.onerror = function(err) { thenDo(err); };
  xhr.onreadystatechange = function() {
    if (xhr.readyState == XMLHttpRequest.DONE)
      thenDo(null, xhr.responseText)
  };
  xhr.open('GET', url, true); xhr.send(null);
}
