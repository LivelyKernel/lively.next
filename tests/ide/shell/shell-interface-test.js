/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { parseCommand } from "lively.morphic/ide/shell/shell-interface.js";

describe("command parsing", () => {

  it("works", function() {
    var commandParseData = [
        ["foo", ["foo"]],
        ["foo -bar", ["foo", "-bar"]],
        ["foo -bar 3", ["foo", "-bar", "3"]],
        ["foo --bar=123", ["foo", "--bar=123"]],
        ["foo -x --bar", ["foo", "-x", "--bar"]],
        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
        ["foo --bar \"to ge ther\"", ["foo", "--bar", 'to ge ther']],
        ["foo --bar \"to ge\\\"ther\"", ["foo", "--bar", 'to ge"ther']],
        ["foo 'bar baz'", ['foo', "bar baz"]],
        ["foo 'bar \\\'baz'", ['foo', "bar 'baz"]],
        ["foo 'bar \"baz zork\"'", ['foo', "bar \"baz zork\""]],
        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
        ["foo -- bar", ['foo', '--', 'bar']]
    ];
  
    commandParseData.forEach(([cmd, expected]) => {
      var result = parseCommand(cmd);
      expect(expected).equals(result, `\n${cmd}\n${expected} vs ${result}`);
    });

  });

});
