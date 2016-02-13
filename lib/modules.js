function VMModule() {
  this.id = null;
  this.isInstrumented = false;
  this.isLoaded = false;
  this.loadError = null;
  this.recorderName = null;
  this.recorder = {};
}

exports.VMModule = VMModule;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function test() {
  var commonjsInterface = require("commonjs-interface");

  
}