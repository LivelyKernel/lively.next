"format cjs";

require("socket.io");

if (typeof fetch === "undefined") {
  console.log("Installing fetch polyfill...")
  System.import("lively.resources")
    .then(function(res) { return res.ensureFetch(); })
    .then(function() { console.log("fetch polyfill installed"); })
    .catch(function(err) {
      console.error("Error installing fetch:");
      console.error(err);
    });
}
