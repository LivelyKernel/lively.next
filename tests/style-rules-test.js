/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { StyleRules } from "../style-rules.js";
import { Morph } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle } from "lively.graphics";


describe("Style Rules", () => {

   it("applies a style to a morph", () => {
       const m1 = new Morph({morphClasses: ['root'], fill: Color.blue});
       m1.styleRules = new StyleRules({root: {fill: Color.orange}})
       expect(m1.fill).equals(Color.orange);
   });

   it("applies a style once a morph is added to the hierarchy", () => {
       const m1 = new Morph({morphClasses: ['root'], fill: Color.blue}),
             m2 = new Morph({morphClasses: ['child'], fill: Color.blue})
       m1.styleRules = new StyleRules({root: {fill: Color.orange}, 
                                       child: {fill: Color.green}})
       m1.addMorph(m2);
       expect(m2.fill).equals(Color.green);
       m2.submorphs = [{morphClasses: ['child'], 
                        submorphs: [{morphClasses: ['child']}]}, 
                       {morphClasses: ['child']},  {morphClasses: ['root']}]
       expect(m2.submorphs.map(m => m.fill)).equals([Color.green, Color.green, Color.orange]);
       expect(m2.submorphs[0].submorphs[0].fill).equals(Color.green);
   });

   it("updates the style once a morph changes morphClass", () => {
       const m1 = new Morph({morphClasses: ['root'], fill: Color.blue}),
             m2 = new Morph({morphClasses: ['child'], fill: Color.blue})
       m1.styleRules = new StyleRules({root: {fill: Color.orange}, 
                                       child: {fill: Color.green}})
       m1.addMorph(m2);
       m1.morphClasses = ['child'];
       m2.morphClasses = ['root']
       expect(m1.fill).equals(Color.green);
       expect(m2.fill).equals(Color.orange);
   });

   it("updates the style once a morph changes name", () => {
       const m1 = new Morph({morphClasses: ['root'], fill: Color.blue}),
             m2 = new Morph({morphClasses: ['child'], fill: Color.blue})
       m1.styleRules = new StyleRules({root: {fill: Color.orange}, 
                                       child: {fill: Color.green}})
       m1.addMorph(m2);
       m1.name = 'child';
       m2.name = 'root';
       expect(m1.fill).equals(Color.green);
       expect(m2.fill).equals(Color.orange);
   });

   it("can be nested", () => {
       const m1 = new Morph({name: "m1", morphClasses: ['root']}),
             m2 = new Morph({name: "m2", morphClasses: ['child']}),
             m3 = new Morph({name: "m3", morphClasses: ['child']})
       m2.styleRules = new StyleRules({child: {fill: Color.black, borderColor: Color.red}})
       m1.styleRules = new StyleRules({root: {fill: Color.orange}, 
                                       child: {fill: Color.green}})
       m2.addMorph(m3)
       m1.addMorph(m2);
       expect(m1.styleRules.getShadowedProps(m3)).equals(["layout", "fill", "borderColor"]);
       expect(m1.fill).equals(Color.orange);
       expect(m2.fill).equals(Color.black);
       expect(m3.fill).equals(Color.black);
       expect(m3.borderColor).equals(Color.red);
   });
   
   
});
