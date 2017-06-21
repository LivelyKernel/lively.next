/*global System, declare, it, xit, describe, beforeEach, afterEach, before, after*/
import { StyleSheet } from "../style-rules.js";
import { Morph, MorphicEnv, HorizontalLayout, morph } from "../index.js";
import { expect } from "mocha-es6";
import { pt, rect, Color, Rectangle } from "lively.graphics";
import { Sizzle } from "../sizzle.js";
import { createDOMEnvironment } from "../rendering/dom-helper.js";

describe("Sizzle", () => {
  it("does not confuse AND-classes with structural class relation", () => {
    const m = new Morph({styleClasses: ["root", "child"]});
    expect(new Sizzle(m).select('.root .child')).to.be.empty;
  });
});

var env, world;

function createDummyWorld() {
  world = morph({type: 'world', name: "world"});
  return world;
}

describe("Style Rules", function() {

  if (System.get("@system-env").node)
    this.timeout(10000);

  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());

  it("applies a style to a morph", () => {
    const m1 = new Morph({
      styleClasses: ["root"],
      submorphs: [
        {
          styleClasses: ["bob"],
          submorphs: [
            {
              name: "A",
              styleClasses: ["alice"]
            }
          ]
        }
      ]
    }),
    m2 = m1.get('A');
    m1.styleSheets = new StyleSheet({
      ".root": {fill: Color.orange},
      ".bob": {fill: Color.red},
      ".alice": {fill: Color.yellow}
    });
    expect(m1.fill).equals(Color.orange);
    expect(m1._styleSheetsInScope).equals(m1.styleSheets);
    expect(m1._styleSheetProps.fill).not.undefined;
    expect(m2.fill).equals(Color.yellow);
  });

  it("applies a style once a morph is added to the hierarchy", () => {
    const m1 = new Morph({styleClasses: ["root"]}), m2 = new Morph({styleClasses: ["child"]});
    m1.styleSheets = new StyleSheet({
      ".root": {fill: Color.orange},
      ".child": {fill: Color.green}
    });
    m1.addMorph(m2);
    expect(m2.fill).equals(Color.green);
    m2.submorphs = [
      {
        styleClasses: ["child"],
        submorphs: [{styleClasses: ["child"]}]
      },
      {styleClasses: ["child"]},
      {styleClasses: ["root"]}
    ];
    expect(m2.submorphs.map(m => m.fill)).equals([Color.green, Color.green, Color.orange]);
    expect(m2.submorphs[0].submorphs[0].fill).equals(Color.green);
  });

  it("updates the style once a morph changes morphClass", () => {
    const m1 = new Morph({styleClasses: ["root"]}), m2 = new Morph({styleClasses: ["child"]});
    m1.styleSheets = new StyleSheet({
      ".root": {fill: Color.orange},
      ".child": {fill: Color.green}
    });
    m1.addMorph(m2);
    m1.styleClasses = ["child"];
    m2.styleClasses = ["root"];
    expect(m1.fill).equals(Color.green);
    expect(m2.fill).equals(Color.orange);
  });

  it("updates the style once a morph changes name", () => {
    const m1 = new Morph({styleClasses: ["root"]}), m2 = new Morph({styleClasses: ["child"]});
    m1.styleSheets = new StyleSheet({
      "[name=root]": {fill: Color.orange},
      "[name=child]": {fill: Color.green}
    });
    m1.addMorph(m2);
    m1.name = "child";
    m2.name = "root";
    expect(m1.fill).equals(Color.green);
    expect(m2.fill).equals(Color.orange);
  });

  it("updates the style once a morph is added", () => {
    const m0 = new Morph(),
          m1 = new Morph({styleClasses: ["root"]}),
          m2 = new Morph({styleClasses: ["child"]}),
          m3 = new Morph({styleClasses: ["leaf"]});
    m0.styleSheets = new StyleSheet({
      ".root": {fill: Color.orange},
      ".child": {fill: Color.brown},
      ".leaf": {fill: Color.green}
    });
    m1.addMorph(m2);
    m2.addMorph(m3);
    expect(m2.fill).not.equals(Color.brown);
    expect(m3.fill).not.equals(Color.green);
    m0.addMorph(m1);
    expect(m1.fill).equals(Color.orange);
    expect(m2.fill).equals(Color.brown);
    expect(m3.fill).equals(Color.green);
  });

  it("can be nested", () => {
    const m1 = new Morph({name: "m1", styleClasses: ["root"]}),
          m2 = new Morph({name: "m2", styleClasses: ["child"]}),
          m3 = new Morph({name: "m3", styleClasses: ["child"]});
    m2.styleSheets = new StyleSheet({".child": {fill: Color.black, borderColor: Color.red}});
    m1.styleSheets = new StyleSheet({
      ".root": {fill: Color.orange},
      ".child": {fill: Color.green}
    });
    m2.addMorph(m3);
    m1.addMorph(m2);
    expect(m1.fill).equals(Color.orange);
    expect(m2.fill).equals(Color.black);
    expect(m3.fill).equals(Color.black);
    expect(m3.borderColor.left).equals(Color.red);
  });

  it("updates layouts on changing submorphs", async () => {
    const m1 = new Morph({name: "m1", styleClasses: ["root"]}),
          m2 = new Morph({name: "m2", styleClasses: ["child"]}),
          m3 = new Morph({name: "m3", styleClasses: ["child"]});
    m1.styleSheets = new StyleSheet({
      ".root": {layout: new HorizontalLayout({resizeContainer: true})},
      ".child": {fill: Color.green},
      ".new": {extent: pt(100, 0)}
    });
    m1.addMorph(m3);
    m1.addMorph(m2);
    world.addMorph(m1);
    await m1.whenRendered();
    expect(m1.width).equals(m2.width + m3.width);
    m2.styleClasses = ["new"];
    await world.whenRendered();
    expect(m2.width).equals(100);
    expect(m1.width).equals(100 + m3.width);
  });
  
  it('results in the same transform behaviors as if morphs where directly set', () => {
    let hierarchy = new Morph({
      styleSheets: [
        new StyleSheet({
          ".root": {position: pt(20, 20)},
          ".bob": {position: pt(40, 40)},
          ".alice": {extent: pt(30, 30)}
        })
      ],
      styleClasses: ["root"],
      submorphs: [
        {
          styleClasses: ["bob"],
          submorphs: [
            {
              name: "A",
              styleClasses: ["alice"]
            }
          ]
        }
      ]
    });
      expect(hierarchy.styleSheets[0].sizzle.context).equals(hierarchy);
      expect(hierarchy.get('A').extent).equals(pt(30,30));
      expect(hierarchy.get('A').globalBounds()).equals(rect(60,60,30,30))
  })

  it('updates all affected morphs if style sheet rules are changed', () => {
    var sheet, hierarchy = new Morph({
      styleSheets: [
        sheet = new StyleSheet({
          ".root": {position: pt(20, 20)},
          ".bob": {position: pt(40, 40)},
          ".alice": {extent: pt(30, 30)}
        })
      ],
      styleClasses: ["root"],
      submorphs: [
        {
          name: 'B',
          styleClasses: ["bob"],
          submorphs: [
            {
              name: "A",
              styleClasses: ["alice"]
            }
          ]
        }
      ]
    });

    sheet.setRule('.bob', {fill: Color.red});
    sheet.removeRule('.alice');

    expect(hierarchy.get('A').position).equals(pt(0,0));
    expect(hierarchy.get('B').position).equals(pt(0,0));
    expect(hierarchy.get('B').fill).equals(Color.red);
  })
});
