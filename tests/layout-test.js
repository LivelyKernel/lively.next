/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { Morph, VerticalLayout, HorizontalLayout, TilingLayout, GridLayout, MorphicEnv } from "../index.js";
import { LayoutCell } from "../layout.js";
import { pt, Color, Rectangle, rect } from "lively.graphics";
import { num, arr } from "lively.lang";

var world, m, env, grid, layout;

function createDummyWorld() {
  world = new Morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [new Morph({
      layout: new VerticalLayout(),
      center: pt(150,150),
      extent: pt(200, 400),
      fill: Color.random(),
      submorphs: [
        new Morph({name: "m1", fill: Color.random(), extent: pt(100,75)}),
        new Morph({name: "m2", fill: Color.random(), extent: pt(50,50)}),
        new Morph({name: "m3", fill: Color.random(), extent: pt(100, 50)})
    ]})]
  });
  m = world.submorphs[0];
  return world;
}

function closeToPoint(p1,p2) {
  var {x,y} = p1;
  expect(x).closeTo(p2.x, 0.1, "x");
  expect(y).closeTo(p2.y, 0.1, "y");
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

    it("can leave the container extent untouched", () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout = new VerticalLayout({autoResize: false});
      var extentBefore = m.extent;
      item1.width = 10;
      item2.height = 10;
      expect(m.extent).equals(extentBefore);
    })

    it("will not resize the container if no submorphs present", () => {
      var extentBefore = m.extent;
      m.layout.autoResize = false;
      m.submorphs = [];
      m.layout.autoResize = true;
      expect(m.extent).equals(extentBefore);
    })

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
  
  describe("layout cells", () => {
    
    beforeEach((() => {
      m.layout = null;
      m.width = 300;
      m.height = 300;
      m.layout = new GridLayout({grid: [[null, "m1", null],
                                        ["m2", null, null],
                                        [null, null,"m3"]]});
      layout = m.layout;
      layout.apply()
      grid = m.layout.grid;
    }))
    
    it("connects cells in a grid", () => {
      expect(grid.right.bottom.right.bottom
                 .left.top.left.top).equals(grid);
    });
    
    it("computes its bounds", () => {
      expect(grid.row(1).col(2).bounds()).equals(pt(200, 100).extent(pt(100,100)));
    });
    
    it("connects cells to other cells", () => {
      var a = grid.row(2).col(2),
          b = grid.row(1).col(2),
          bGroup = b.group;
      expect(layout.cellGroups.length).equals(9);
      expect(a.group.cells).equals([a]);
      expect(layout.cellGroups.includes(bGroup)).to.be.true;
      a.group.connect(b);
      expect(a.group.cells).equals([a,b]);
      expect(a.group).equals(b.group);
      expect(bGroup.cells).equals([]);
      expect(layout.cellGroups.includes(bGroup)).to.be.false;
      expect(layout.cellGroups.length).equals(8);
    });
    
    it("assigns morph of connected cell to group if previously morphless", () => {
      var a = grid.row(2).col(2),
          b = grid.row(1).col(2),
          aGroup = a.group;
      expect(aGroup.morph).not.to.be.null;
      expect(b.group.morph).to.be.null;
      b.group.connect(a);
      expect(b.group.morph).not.to.be.null;
    })
    
    it("computes the group's bounds", () => {
      var a = grid.row(1).col(2),
          b = grid.row(0).col(2);
      a.group.connect(b);
      expect(a.group.bounds()).equals(rect(200,0,100,200));
    });
    
    it("inserts rows and columns of cells", () => {
      grid.row(0).addBefore();
      grid.col(1).addAfter();
      expect(grid.col(1).items.length).equals(4);
      expect(grid.row(1).items.length).equals(4);
    });
    
    it("can fix its height or width", () => {
      grid.col(1).fixed = true;
      grid.row(1).fixed = true;
      layout.container.resizeBy(pt(100,100))
      expect(grid.col(0).row(0).dynamicWidth).equals(300);
      expect(grid.col(0).row(0).width).equals(150);
      closeToPoint(grid.col(1).row(1).bounds().extent(), pt(100,100));
      closeToPoint(grid.col(0).row(0).bounds().extent(), pt(150,150));
    });
    
    it("can change its height or width proportion", () => {
      grid.col(1).width += 50;
      grid.row(1).height += 50;
      expect(grid.col(1).row(1).bounds().extent()).equals(pt(150,150));
      expect(grid.col(0).row(0).bounds().extent()).equals(pt(100,100));
      expect(grid.col(2).row(2).bounds().extent()).equals(pt(50,50), "steals from next flexible axis");
    });
    
    it("propagates sizing changes to neighbors", () => {
      grid.col(1).width += 50;
      expect(grid.col(0).width).equals(100);
      expect(grid.col(2).width).equals(50);
    });
  })

  describe("grid layout", () => {

     beforeEach(() => {
       m.layout = null
       m.width = 300;
       m.height = 300;
       m.layout = new GridLayout({
                          grid:
                          [[null, "m1", null],
                           ["m2", null, null],
                           [null, null,"m3"]]});
       m.layout.apply();
     });

    it("aligns submorphs along a grid", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it("aligns stores the dynamic proportions", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m.layout.col(0).proportion).equals(1/3);
      expect(m.layout.col(1).proportion).equals(1/3);
      expect(m.layout.col(2).proportion).equals(1/3);
      expect(m.layout.row(0).proportion).equals(1/3);
      expect(m.layout.row(2).proportion).equals(1/3);
      expect(m.layout.row(2).proportion).equals(1/3);
    });

    it("adjusts dynamic proportions on axis fixation", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).fixed = true;
      m.layout.row(1).fixed = true
      expect(m.layout.col(0).proportion).equals(1/2);
      expect(m.layout.col(2).proportion).equals(1/2);
      expect(m.layout.row(0).proportion).equals(1/2);
      expect(m.layout.row(2).proportion).equals(1/2);
      m.layout.col(1).fixed = false;
      m.layout.row(1).fixed = false
      expect(m.layout.col(0).proportion).equals(1/3);
      expect(m.layout.col(2).proportion).equals(1/3);
      expect(m.layout.row(0).proportion).equals(1/3);
      expect(m.layout.row(2).proportion).equals(1/3);
    });

    it("expands container when fixed size exceeds initial extent", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(0).fixed = 500;
      expect(m.extent).equals(pt(500,300));
    });

    it("adjusts dynamic proportions when one axis adjusts width or height", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).width += 100;
      m.layout.row(1).height += 100;
      expect(m.layout.col(0).proportion).equals(1/3);
      expect(m.layout.col(1).proportion).equals(2/3);
      expect(m.layout.col(2).proportion).equals(0);
      expect(m.layout.row(0).proportion).equals(1/3);
      expect(m.layout.row(1).proportion).equals(2/3);
      expect(m.layout.row(2).proportion).equals(0);
    });
    
    it("adjusts dynamic proportions when one axis reaches or leaves minimum", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).min = 50;
      m.layout.row(1).min = 50;
      m.extent = pt(25,25);
      expect(m.extent).equals(pt(50,50));
      expect(m.layout.col(0).proportion).equals(1/2);
      expect(m.layout.col(2).proportion).equals(1/2);
      expect(m.layout.row(0).proportion).equals(1/2);
      expect(m.layout.row(2).proportion).equals(1/2);
      m.extent = pt(200,200);
      expect(m.layout.col(1).proportion).equals(1/3, 'col 1');
      expect(m.layout.col(2).proportion).equals(1/3, 'col 3');
      expect(m.layout.col(0).proportion).equals(1/3, 'col 0');
      expect(m.layout.row(0).proportion).equals(1/3);
      expect(m.layout.row(2).proportion).equals(1/3);
    });

    it("appends missing cells", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
                          grid:
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
      m.layout = new GridLayout({
                          grid:
                          [[null, "m1", null],
                           ["m2", "m2", null],
                           [null, null,"m3"]]});
      expect(m2.position).equals(pt(0, 100));
    });

    it("allows morphs to be reassigned to cells", () => {
      const [m1, m2, m3] = m.submorphs;
      var group = m.layout.row(2).col(1).group;
      group.morph = m2;
      m.layout.apply()
      expect(m.layout.row(1).col(0).group.morph).equals(null);
      expect(m2.position).equals(pt(100, 200));
      group = m.layout.row(0).col(0).group;
      group.connect(m.layout.col(0).row(1));
      group.connect(m.layout.col(0).row(2));
      group.morph = m1;
      m.layout.apply()
      expect(m1.position).equals(pt(0,0));
      expect(m1.height).equals(300);
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
      m.layout = new GridLayout({
                          grid:
                               /* 50px */
                          [[null, "m1", null], /* 50 px*/
                           ["m2", null, null],
                           [null, null,"m3"]]});
      m.layout.col(1).width = 50;
      m.layout.row(0).height = 50;
      m.layout.row(0).fixed = true;
      m.layout.col(1).fixed = true;
      m.layout.apply();
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position.roundTo(.1)).equals(pt(150, 200));
      expect(m1.position).equals(pt(100,0));
      m.resizeBy(pt(100,100));
      m.layout.col(1).fixed = false;
      expect(m.layout.col(1).width).equals(50);
    });

    it("is numerically stable", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
                          grid:
                          [[null, "m1", null],
                           ["m2", null, null],
                           [null, null,"m3"]]});
      expect(m.layout.col(0).proportion).equals(1/3);
      m.extent = pt(0, 0);
      expect(m.layout.col(0).proportion).equals(1/3, 'preserve proportion');
      expect(m.extent).equals(pt(0,0));
      expect(m1.position).equals(pt(0, 0));
      expect(m2.position).equals(pt(0, 0));
      expect(m3.position).equals(pt(0, 0), "m3 position");
      m.extent = pt(300, 300);
      expect(m.layout.col(0).proportion).equals(1/3, 'preserve proportion');
      expect(m.layout.col(0).width).equals(100, 'proportion defines length');
      expect(m.extent).equals(pt(300,300));
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it("can set minimum spacing for columns and rows", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
                          grid:
                         /* 50px */
                          [[null, "m1", null], /* 50 px*/
                           ["m2", null, null],
                           [null, null,"m3"]]});
      m.layout.col(0).min = 50;
      m.layout.row(0).min = 50;
      m.extent = pt(25, 25); // too small!
      expect(m.extent).equals(pt(50,50), 'framed extent');
      expect(m.layout.col(0).proportion).equals(1/3);
      expect(m1.position).equals(pt(50, 0));
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position).equals(pt(50, 50), "m3 position");
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
      m.layout.col(0).width += 60;
      expect(m.layout.col(0).width).equals(160)
      expect(m.layout.col(1).width).equals(40)
      m.layout.row(0).height += 60;
      expect(m.layout.row(0).height).equals(160)
      expect(m.layout.row(1).height).equals(40)
      m.layout.col(0).width += 300;
      expect(m.layout.col(0).width).equals(200);
      expect(m.layout.col(1).width).equals(0);
      m.layout.row(0).height += 300;
      expect(m.layout.row(0).height).equals(200);
      expect(m.layout.row(1).height).equals(0);
      expect(m.layout.row(0).col(0).height).equals(200);
      expect(m.layout.row(1).col(0).height).equals(0);
    });
    
    it("can vary proportion of the last column", () => {
      m.layout.col(2).width += 100;
      expect(m.width).equals(300 + 100);
      expect(m.layout.col(0).width).equals(100);
      expect(m.layout.col(1).width).equals(100);
      expect(m.layout.col(2).width).equals(200);
    })
    
    it("widens container when varying fixed width column", () => {
      m.layout.col(2).fixed = true;
      m.layout.col(2).width += 100;
      expect(m.layout.col(2).width).equals(200);
      expect(m.width).equals(400);
    })
    
    it("can vary the fixed space of axis", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                               /* 50px */
                          [[null, "m1", null], /* 50 px*/
                           ["m2", null, null],
                           [null, null,"m3"]]});
      m.layout.col(1).fixed = true; 
      m.layout.col(1).width += 50;
      expect(m.width).equals(350);
      expect(m.layout.col(1).width).equals(150);
      expect(m.layout.col(0).width).equals(100);
      expect(m.layout.col(2).width).equals(100);
    })
    
    it("can vary proportions correctly in presence of fixed axis", () => {
      var [m1,m2,m3] = m.submorphs;
      m.layout = new GridLayout({grid:
                         /* 100px 100px */
                    [[null, "m1", null, null],
                     ["m2", null, null, null],
                     [null, null, null, "m3"]]});
      m.width = 400;
      m.layout.col(2).fixed = true;
      m.layout.col(1).fixed = true;
      expect(m.layout.col(3).width).equals(100)
      expect(m.layout.col(0).width).equals(100)
      m.layout.col(0).width += 50;
      m.layout.apply();
      expect(m2.width).equals(150);
      expect(m3.width).equals(50);
      m.layout.col(3).width += 60;
      m.layout.apply()
      expect(m2.width).equals(150);
      expect(m3.width).equals(110);
      m.layout.col(3).width -= 60;
      m.layout.apply();
      expect(m2.width).equals(150);
      expect(m3.width).equals(50);
      m.layout.col(3).width -= 50; // 0
      m.layout.apply();
      expect(m.layout.col(3).width).equals(0);
      expect(m.layout.col(0).width).equals(150);
      expect(m2.width).equals(150);
      expect(m3.width).equals(0);
      m.layout.col(3).width -= 50;
      m.layout.apply();
      expect(m3.width).equals(0, 'prevent negative widths');
      expect(m2.width).closeTo(150, 0.0001);
      expect(m.layout.col(3).width).equals(0);
      expect(m.layout.col(0).width).equals(150);
      m.layout.col(3).fixed = m.layout.col(2).fixed = m.layout.col(1).fixed = 100;
      m.width = 400;
      expect(m.layout.col(0).dynamicLength).equals(100);
      m.layout.col(0).width += 300;
      m.layout.apply();
      expect(m.layout.col(0).dynamicLength).equals(400);
      expect(m.layout.col(0).width).equals(400);
      expect(m.width).equals(700);
      expect(m2.width).closeTo(400, 0.001);
      expect(m3.width).closeTo(100, 0.0001);
      expect(m1.width).closeTo(100, 0.0001);
    })

    it("can add rows and columns", () => {
          // [[X, null, "m1", null],
          //  [X, X,     X,    X ]
          //  [X, "m2", null, null],
          //  [X, null, null, "m3"]]
      const [m1, m2, m3] = m.submorphs;
      m.layout.row(0).fixed = 75;
      m.height = 300;
      m.layout.row(0).addAfter();
      m.layout.col(0).addBefore();
      m.layout.apply();
      expect(m.layout.row(0).height).equals(300/4, 'row 0')
      expect(m.layout.row(1).proportion).closeTo(1/3, .0001, 'row 1')
      expect(m.layout.row(1).dynamicLength).closeTo(225, .0001, 'row 1 dyn length')
      expect(m.layout.row(1).length).closeTo(225/3, .0001, 'row 1 length')
      expect(m.layout.row(2).proportion).closeTo(1/3, .0001, 'row 2')
      expect(m.layout.row(3).proportion).closeTo(1/3, .0001, 'row 3')
      expect(m.layout.columnCount).equals(4);
      expect(m.layout.col(3)).to.not.be.null;
      expect(m.layout.rowCount).equals(4);
      expect(m1.position).equals(pt((300 / 2),0));
      expect(m2.position).equals(pt((300 / 4), 2 * (300 / 4)));
      expect(m3.position).equals(pt(3 * (300 / 4), 3 * (300 / 4)));
    });

    it("can remove rows and columns", () => {
          // [[null, null],
          //  [null, "m3"]]
       const [m1, m2, m3] = m.submorphs;
       m.layout.col(0).remove();
       m.layout.row(1).remove();
       m.layout.apply();
       expect(m.width).equals(300);
       expect(m3.position).equals(pt(150, 150));
       m.layout.col(1).remove();
       expect(m.layout.col(0).after).to.be.undefined;
    });
    
    it("removes removed submorphs from layout", () => {
      const [m1, m2, m3] = m.submorphs;
      m1.remove();
      expect(m.layout.row(0).col(1).group.morph).to.be.null;
    });

    it("can add a padding to different axis", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).paddingLeft = 10;
      m.layout.col(1).paddingRight = 10;
      m.layout.row(0).paddingTop = 5;
      m.layout.apply();
      expect(m2.position).equals(pt(0,100));
      expect(m1.position).equals(pt(110, 5));
      expect(m1.topRight).equals(pt(190, 5));
      expect(m1.width).equals(80);
      expect(m1.height).equals(95);
    });

    it("can compensate origin", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.compensateOrigin = true;
      m.adjustOrigin(pt(50,50));
      m.layout.apply();
      expect(m2.position).equals(pt(-50,50));
      expect(m1.position).equals(pt(50, -50));
    })

    it("allows submorphs to preserve their original extent", () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.fitToCell = false;
      m1.extent = pt(22,33);
      m.layout.apply();
      expect(m1.extent).equals(pt(22,33));
    })

    it("also layouts submorphs that are added afterwards", () => {
      m.layout = new GridLayout({grid:
                          [[null, "m1", null],
                           ["m2", "m2", "m4"],
                           [null, null, "m3"]]
                      });
      m.addMorph({name: "m4", extent: pt(22,22)});
      expect(m.getSubmorphNamed("m4").bounds()).equals(rect(200,100,100,100));
    })
  });
})
