// pre-loading the dependencies here so we don't have to configure SystemJS
// with all the sub-sub-sub packages

var path = require("path"),
    module = require("module"),
    lookupPaths = [path.join(require.resolve("lively.server"), "../node_modules")],
    socktioMain = module._resolveFilename("socket.io", {paths: lookupPaths});

require(socktioMain);
require("socket.io-client");
