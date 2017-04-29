/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { StyleSheet } from "../style-rules.js";
import { Morph, HorizontalLayout } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle } from "lively.graphics";
import { Sizzle } from "../sizzle.js";

describe("Sizzle", () => {
  it("does not confuse AND-classes with structural class relation", () => {
    const m = new Morph({styleClasses: ["root", "child"]});
    expect(new Sizzle(m).select('.root .child')).to.be.empty;
  });
});

describe("Style Rules", () => {

   it("applies a style to a morph", () => {
       const m1 = new Morph({styleClasses: ['root']});
       m1.styleSheets = new StyleSheet({'.root': {fill: Color.orange}})
       expect(m1._styleSheets).equals(m1.styleSheets)
       expect(m1.fill).equals(Color.orange);
       expect(m1._styleSheetProps.fill).not.undefined
   });

   it("applies a style once a morph is added to the hierarchy", () => {
       const m1 = new Morph({styleClasses: ['root']}),
             m2 = new Morph({styleClasses: ['child']})
       m1.styleSheets = new StyleSheet({'.root': {fill: Color.orange}, 
                                       '.child': {fill: Color.green}})
       m1.addMorph(m2);
       expect(m2.fill).equals(Color.green);
       m2.submorphs = [{styleClasses: ['child'], 
                        submorphs: [{styleClasses: ['child']}]}, 
                       {styleClasses: ['child']},  {styleClasses: ['root']}]
       expect(m2.submorphs.map(m => m.fill)).equals([Color.green, Color.green, Color.orange]);
       expect(m2.submorphs[0].submorphs[0].fill).equals(Color.green);
   });

   it("updates the style once a morph changes morphClass", () => {
       const m1 = new Morph({styleClasses: ['root']}),
             m2 = new Morph({styleClasses: ['child']})
       m1.styleSheets = new StyleSheet({'.root': {fill: Color.orange}, 
                                       '.child': {fill: Color.green}})
       m1.addMorph(m2);
       m1.styleClasses = ['child'];
       m2.styleClasses = ['root']
       expect(m1.fill).equals(Color.green);
       expect(m2.fill).equals(Color.orange);
   });

   it("updates the style once a morph changes name", () => {
       const m1 = new Morph({styleClasses: ['root']}),
             m2 = new Morph({styleClasses: ['child']})
       m1.styleSheets = new StyleSheet({'[name=root]': {fill: Color.orange}, 
                                        '[name=child]': {fill: Color.green}})
       m1.addMorph(m2);
       m1.name = 'child';
       m2.name = 'root';
       expect(m1.fill).equals(Color.green);
       expect(m2.fill).equals(Color.orange);
   });

   it("can be nested", () => {
       const m1 = new Morph({name: "m1", styleClasses: ['root']}),
             m2 = new Morph({name: "m2", styleClasses: ['child']}),
             m3 = new Morph({name: "m3", styleClasses: ['child']})
       m2.styleSheets = new StyleSheet({'.child': {fill: Color.black, borderColor: Color.red}})
       m1.styleSheets = new StyleSheet({'.root': {fill: Color.orange}, 
                                        '.child': {fill: Color.green}})
       m2.addMorph(m3)
       m1.addMorph(m2);
       expect(m1.fill).equals(Color.orange);
       expect(m2.fill).equals(Color.black);
       expect(m3.fill).equals(Color.black);
       expect(m3.borderColor).equals(Color.red);
   });

   it("updates layouts on changing submorphs", () => {
       const m1 = new Morph({name: "m1", styleClasses: ['root']}),
             m2 = new Morph({name: "m2", styleClasses: ['child']}),
             m3 = new Morph({name: "m3", styleClasses: ['child']})
       m1.styleSheets = new StyleSheet({'.root': {layout: new HorizontalLayout({resizeContainer: true})}, 
                                        '.child': {fill: Color.green},
                                        '.new': {extent: pt(100, 0)}})
       m1.addMorph(m3)
       m1.addMorph(m2);
       expect(m1.width).equals(m2.width + m3.width)
       let l = m1.layout;
       m2.styleClasses = ['new'];
       expect(l).to.not.equals(m1.layout);
       expect(m2.width).equals(100);
       expect(m1.width).equals(100 + m3.width)
   });
   
});
