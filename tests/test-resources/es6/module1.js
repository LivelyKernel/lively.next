console.log("running es6 module1");

function someFunction() { return 3 + internalState; }

var internalState = 1;

export var x = internalState * 2 + 1;
