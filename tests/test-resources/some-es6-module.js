console.log("running some-es6-module");

function someFunction() { return 3 + 4; }

var internalState = 23,
    externalState = internalState*2-3;

export var x = internalState * 2 + 1;
