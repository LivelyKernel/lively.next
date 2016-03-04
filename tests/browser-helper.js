function log(msg) {
  var stringified = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  document.querySelector("#log").insertAdjacentHTML("beforeend", `<li><pre>${stringified}</li>`);
}

function get(url) {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    xhr.onerror = reject;
    xhr.onreadystatechange = () =>
      (xhr.readyState == XMLHttpRequest.DONE) && resolve(xhr.responseText);
    xhr.open('GET', url, true); xhr.send(null);
  });
}
