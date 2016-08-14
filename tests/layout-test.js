/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { Morph, VerticalLayout, HorizontalLayout, TilingLayout, GridLayout, MorphicEnv } from "../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num, arr } from "lively.lang";

var world, m, env;

function createDummyWorld() {
  world = new Morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [new Morph({
      layout: new VerticalLayout(),
      center: pt(150,150),
      extent: pt(200, 400),
      submorphs: [
        new Morph({name: "m1", extent: pt(100,75)}),
        new Morph({name: "m2", extent: pt(50,50)}),
        new Morph({name: "m3", extent: pt(100, 50)})
    ]})]
  });
  m = world.submorphs[0];
  return world;
}

describe("layout", () => {

  before(async () => env = await MorphicEnv.pushDefault(new MorphicEnv()))
  after(() =>  MorphicEnv.popDefault().uninstall());
  beforeEach(() => env.setWorld(createDummyWorld()));

  describe("vertical layout", () => {

    it("renders submorphs vertically", () => {
      const [item1, item2, item3] = m.submorphs;
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.bottomLeft);
      expect(item3.position).equals(item2.bottomLeft);
    });

    it("adjusts layout when submorph changes extent", () => {
      const [item1, item2, item3] = m.submorphs;
      item2.extent = pt(100,100);
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.bottomLeft);
      expect(item3.position).equals(item2.bottomLeft);
    });

    it("adjusts layout when submorph is removed", () => {
      const [item1, item2, item3] = m.submorphs;
      item2.remove();
      expect(item3.position).equals(item1.bottomLeft);
    });

    it("adjusts layout when submorph is inserted", () => {
      const [item1, item2, item3] = m.submorphs,
            item4 = new Morph({extent: pt(200,200)});
      m.addMorphAt(item4, 1);
      expect(item4.position).equals(item1.bottomLeft);
      expect(item2.position).equals(item4.bottomLeft);
    });

    it("can vary the spacing between submorphs", () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout = new VerticalLayout({spacing: 10});
      expect(item2.position).equals(item1.bottomLeft.addPt(pt(0,10)));
      expect(item3.position).equals(item2.bottomLeft.addPt(pt(0,10)));
    });

    it("adjusts width to widest item", () => {
      const maxWidth = arr.max(m.submorphs.map( m => m.width ));
      expect(m.width).equals(maxWidth);
    });

    it("adjusts height to number of items", () => {
      const totalHeight = m.submorphs.reduce((h, m) => h + m.height, 0)
      expect(m.height).equals(totalHeight);
    });

  });


  describe("horizontal layout", () => {

     beforeEach(() => {
       m.layout = new HorizontalLayout();
     });

    it("renders submorphs horizontally", () => {
      const [item1, item2, item3] = m.submorphs;
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.topRight);
      expect(item3.position).equals(item2.topRight);
    });

    it("adjusts width to number of items", () => {
      const totalWidth = m.submorphs.reduce( (w,m) => w + m.width, 0);
      expect(m.width).equals(totalWidth);
    });

    it("adjusts height to highest item", () => {
      const maxHeight = arr.max(m.submorphs.map(m => m.height))
      expect(m.height).equals(maxHeight);
    });

    it("enforces minimum height and minimum width", () => {
      m.extent = pt(50,50);
      expect(m.height).equals(75);
      expect(m.width).equals(250);
    });

  });

  describe("tiling layout", () => {

     beforeEach(() => {
       m.layout = new TilingLayout();
       m.width = 200;
     });

    it("tiles submorphs to fit the bounds", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.position).equals(pt(0,0));
      expect(m2.position).equals(m1.topRight);
      expect(m3.position).equals(m1.bottomLeft);
    });

    it("updates layout on changed extent", () => {
      const [m1, m2, m3] = m.submorphs;
      m.extent = pt(400, 100);
      expect(m1.position).equals(pt(0,0));
      expect(m2.position).equals(m1.topRight);
      expect(m3.position).equals(m2.topRight);
    });

  });

  describe("grid layout", () => {

     beforeEach(() => {
       m.layout = null
       m.width = 300;
       m.height = 300;
       m.layout = new GridLayout({grid:
                          [[null, "m1", null],
                           ["m2", null, null],
                           [null, null,"m3"]]});
     });

    it("aligns submorphs along a grid", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it("appends missing cells", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                          [[null, "m1"],
                           ["m2"],
                           [null, null,"m3"]]});
      expect(m.layout.rowCount).equals(3);
      expect(m.layout.columnCount).equals(3);
      expect(m3.position).equals(pt(200, 200));
    });

    it("can create an empty grid and auto assign submorphs to closest cell", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = null;
      m1.position = pt(288, 20);
      m2.position = pt(15,20);
      m3.position = pt(10, 220);
      m.layout = new GridLayout({columnCount: 3, rowCount: 3});
      expect(m2.position).equals(pt(0,0));
      expect(m3.position).equals(pt(0, 200));
      expect(m1.position).equals(pt(200,0));
    })

    it("allows morphs to take up multiple cells", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                          [[null, "m1", null],
                           ["m2", "m2", null],
                           [null, null,"m3"]]});
      expect(m2.position).equals(pt(0, 100));
    });

    it("allows morphs to be reassigned to cells", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.assign(m2, {row: 2, col: 1});
      expect(m.layout.grid[1][0]).equals(null);
      expect(m2.position).equals(pt(100, 200));
      m.layout.assign(m1, {row: 0, col: [0,1,2]});
      expect(m1.position).equals(pt(0,0));
      expect(() => m.layout.assign(m3, {row: [0,2], col: 1})).to.throw(RangeError);
    });

    it("updates layout on changed extent", () => {
      const [m1, m2, m3] = m.submorphs;
      m.resizeBy(pt(300,300));
      expect(m1.position).equals(pt(200, 0));
      expect(m2.position).equals(pt(0, 200));
      expect(m3.position).equals(pt(400, 400));
      m.resizeBy(pt(-300,0));
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 200));
      expect(m3.position).equals(pt(200, 400));
      m.resizeBy(pt(0,-300));
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it("allows rows and columns to be fixed", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                               /* 50px */
                          [[null, "m1", null], /* 50 px*/
                           ["m2", null, null],
                           [null, null,"m3"]],
                           colSizing: {1: {fixed: 50}},
                           rowSizing: {0: {fixed: 50}}});
      expect(m1.position).equals(pt(125, 0));
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position).equals(pt(175, 175));
    });

    it("can set minimum spacing for columns and rows", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                               /* 50px */
                          [[null, "m1", null], /* 50 px*/
                           ["m2", null, null],
                           [null, null,"m3"]],
                           colSizing: {0: {min: 50}},
                           rowSizing: {0: {min: 50}}});
      m.extent = pt(25, 25); // too small!
      expect(m.extent).equals(pt(50,50));
      expect(m1.position).equals(pt(50, 0));
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position).equals(pt(50, 50));
      m.extent = pt(100, 100);
      expect(m.extent).equals(pt(100,100));
      expect(m1.position).equals(pt(50, 0));
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position).equals(pt(75, 75));
    });

    it("by default enforces the cell's extent upon the contained morph", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.extent).equals(pt(100, 100));
      expect(m2.extent).equals(pt(100, 100));
      expect(m3.extent).equals(pt(100, 100));
      m.layout = new GridLayout({grid:
                          [[null, "m1", null],
                          ["m2", "m2", "m3"],
                          [null, null, "m3"]]});
      expect(m1.extent).equals(pt(100, 100));
      expect(m2.extent).equals(pt(200, 100));
      expect(m3.extent).equals(pt(100, 200));
    });

    it("can vary the proportional width and height of rows and columns", () => {
      m.layout.adjustColumnStretch(0, 60);
      expect(m.layout.colSizing[0].proportion).equals(1/3 + 0.2)
      expect(m.layout.colSizing[1].proportion).equals(1/3 - 0.2)
      m.layout.adjustRowStretch(0, 60);
      expect(m.layout.rowSizing[0].proportion).equals(1/3 + 0.2)
      expect(m.layout.rowSizing[1].proportion).equals(1/3 - 0.2)
      m.layout.adjustColumnStretch(0, 300)
      expect(m.layout.colSizing[0].proportion).equals(2/3);
      expect(m.layout.colSizing[1].proportion).equals(0);
      m.layout.adjustRowStretch(0, 300)
      expect(m.layout.rowSizing[0].proportion).equals(2/3);
      expect(m.layout.rowSizing[1].proportion).equals(0);
      expect(m.layout.rowHeights[0]).equals(m.layout.rowSizing[0].proportion * 300);
      expect(m.layout.rowHeights[1]).equals(m.layout.rowSizing[1].proportion * 300);
    });
    
    it("can vary proportion of the last column", () => {
      m.layout.adjustColumnStretch(2, 100);
      expect(m.layout.colSizing[0].proportion).equals(1/4);
      expect(m.layout.colSizing[1].proportion).equals(1/4);
      expect(m.layout.colSizing[2].proportion).equals(1/2);
      expect(m.width).equals(4/3 * 300);
    })
    
    it("widens container when varying fixed width column", () => {
      m.layout.setFixed({col: 2, fixed: true});
      m.layout.adjustColumnStretch(2, 100);
      expect(m.layout.colSizing[2].fixed).equals(200);
      expect(m.width).equals(400);
    })
    
    it("can vary the fixed space of axis", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                               /* 50px */
                          [[null, "m1", null], /* 50 px*/
                           ["m2", null, null],
                           [null, null,"m3"]],
                           colSizing: {1: {fixed: 50}},
                           rowSizing: {0: {fixed: 50}}});
      m.layout.adjustColumnStretch(1, 50);
      expect(m.layout.colSizing[1].fixed).equals(100);
      expect(m.layout.colSizing[0].proportion).equals(1/2);
      expect(m.layout.colSizing[2].proportion).equals(1/2);
      m.layout.setFixed({col: 0, fixed: true});
      expect(m.layout.colSizing[0].fixed).equals(125);
      expect(m.layout.colSizing[2].proportion).equals(1);
    })
    
    it("can vary proportions correctly in presence of fixed axis", () => {
      var [m1,m2,m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                         /* 50px */
                    [[null, "m1", null, null], /* 50 px*/
                     ["m2", null, null, null],
                     [null, null,"m3",  null]]});
      m.layout.setFixed({col: 2, fixed: 100});
      m.layout.setFixed({col: 1, fixed: 100});
      m.layout.adjustColumnStretch(0, 60);
      expect(m.layout.colSizing[0].proportion).equals(1/2 + 0.2)
      expect(m.layout.colSizing[3].proportion).closeTo(1/2 - 0.2, 0.01)
      var m2Width = m2.width;
      m.layout.adjustColumnStretch(3, 60);
      expect(m2.width).equals(m2Width);
      m.layout.adjustColumnStretch(3, -160);
      expect(m2.width).equals(m2Width);
    })

    it("can add rows and columns", () => {
          // [[null, "m1", X, null],
          //  [X,    X,    X,   X ]
          //  ["m2", null, X, null],
          //  [null, null, X,"m3"]]
      const [m1, m2, m3] = m.submorphs;
      m.layout.addRowBefore(1);
      m.layout.addColumnBefore(2);
      expect(m1.position).equals(pt((300 / 4),0));
      expect(m2.position).equals(pt(0, 2 * (300 / 4)));
      expect(m3.position).equals(pt(3 * (300 / 4), 3 * (300 / 4)));
    });

    it("can remove rows and columns", () => {
          // [[null, null],
          //  ["m2", null]]
       const [m1, m2, m3] = m.submorphs;
       m.layout.removeColumn(1);
       m.layout.removeRow(2);
       expect(m2.position).equals(pt(0, 150));
    });
    
    it("removes removed submorphs from layout", () => {
      const [m1, m2, m3] = m.submorphs;
      m1.remove();
      expect(m.layout.grid[0][1]).to.be.null;
    });
  });
})