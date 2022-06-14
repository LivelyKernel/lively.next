// Required to ensure we run inside commonjs context which
// gives us access to require() and resolve().
module.exports = function runEval(code) { return eval(code) }
