/*global describe, it, beforeEach*/
import { expect, chai } from "mocha-es6";
import { arr } from "../index.js";
import { BTree, BPlusTree } from "../btree.js";

chai.Assertion.addChainableMethod('btreePrintsTo', function(obj) {
  var expected  = obj,
      btree     = this._obj;

  if (typeof btree === "string") [btree, expected] = [expected, btree];

  this.assert(!!btree, "btree is " + btree);
  // this.assert(btree instanceof BTree, "btree is not a but a " + btree.constructor.name);

  // remove leading whitespace

  expected = normalizeWhitespace(expected);
  var actual = normalizeWhitespace(String(btree.root));
  return expect(actual).stringEquals(expected);

  function normalizeWhitespace(string) {
    var lines = string.split("\n").filter(ea => !!ea.trim()),
        minIndent = Math.min(...lines.slice(1).map(line => line.match(/^\s*/)[0].length));
    return lines.map(line => line.replace(new RegExp(`^\\s{${minIndent}}`), "").trimRight()).join("\n");

  }
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function insertNumbers(...numbers) {
  numbers.forEach(ea => btree.insert(ea))
  return btree;
}

var btree;

describe("BTree", () => {

  beforeEach(() => {
    btree = new BTree(2);
  });

  it("1.", () =>

    expect(insertNumbers(1,2,3,4,5,6,7, 8, 9)).btreePrintsTo(`
                4
             •    •
          •••      •
         2         6, 8
                     •••
       •  ••      •  •  •
      1    3    5    7    9
    `));

  xit("2.", () =>
    expect(insertNumbers(2,3, 4,1)).btreePrintsTo(`[1-4]
                                                  |-[1-2]1,2
                                                  \-[3-4]3,4`));

});

describe("BPlusTree", () => {

  beforeEach(() => btree = new BPlusTree(4));

  describe("insertion", () => {
  
    it("sequential", () => {
      arr.range(1,30).forEach(n => btree.insert(n,n));                                                                                                                                   

      expect(btree).btreePrintsTo(`
                                                          •  1, 10, 19  •                                                              
                                            ••••••••••••••     •         ••••••••••••••                                                
                              ••••••••••••••               •••                         ••••••••••••••                                  
                 1, 4, 7  ••••                       10, 13, 16                                     19, 22, 25, 28                     
                    • ••••                             •  •  •••••                               •    ••••   •••••••••                 
           ••••     •     ••••                 ••••       •       ••••                    •••••••    •••       •••    •••••••          
      1, 2, 3    4, 5, 6    7, 8, 9    10, 11, 12    13, 14, 15    16, 17, 18    19, 20, 21    22, 23, 24    25, 26, 27    28, 29, 30  
      `);

    
    })
  
  })

})