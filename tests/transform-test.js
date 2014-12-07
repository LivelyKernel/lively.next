/*global process, beforeEach, afterEach, describe, it*/

var expect = typeof module !== "undefined" && module.require ? module.require('chai').expect : chai.expect;
var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var lang = env['lively.lang'], ast = env.isCommonJS ? require('../index') : env['lively.ast'];

describe('ast.transform', function() {

  var acorn = ast.acorn;
  lively.ast = ast;
});
