/*global System, declare, it, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../../rendering/dom-helper.js";
import { MorphicEnv, Icon, Hand, show } from "../../index.js";
import { expect } from "mocha-es6";
import { morph, Button, World } from "../../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num, promise, fun } from "lively.lang";
import { styleHaloFor } from "../../halo/stylization.js";

var button, world, eventLog, env;
const inactiveColor = Color.blue, activeColor = Color.red, triggerColor = Color.green;

function installEventLogger(morph, log) {
  var loggedEvents = [
    "onMouseDown","onMouseUp","onMouseMove",
    "onDragStart", "onDrag", "onDragEnd",
    "onGrab", "onDrop",
    "onHoverIn", "onHoverOut",
    "onFocus", "onBlur",
    "onKeyDown", "onKeyUp"]
  loggedEvents.forEach(name => {
    morph[name] = function(evt) {
      log.push(name + "-" + morph.name);
      this.constructor.prototype[name].call(this, evt);
    }
  });
}

function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300)})
  world.submorphs = [new Button({
    activeStyle: {fill: activeColor},
    inactiveStyle: {fill: inactiveColor},
    triggerStyle: {fill: triggerColor},
    center: pt(150,150)
  }), new Hand()];

  button = world.submorphs[0];
  eventLog = [];
  [button].forEach(ea => installEventLogger(ea, eventLog));

  return world;
}

async function setup() {
  env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
  await env.setWorld(createDummyWorld());
}

function teardown() {
  MorphicEnv.popDefault().uninstall()
}

describe("buttons", function() {

    // jsdom sometimes takes its time to initialize...
  if (System.get("@system-env").node)
    this.timeout(10000);

  beforeEach(setup);
  afterEach(teardown);

  describe('button modes', () => {

     it ("allows to switch between modes", () => {
       button.activeMode = 'triggered';
       expect(button.fill).equals(triggerColor);
       button.activeMode = 'inactive';
       expect(button.fill).equals(inactiveColor);
       button.activeMode = 'active';
       expect(button.fill).equals(activeColor);
     })

     xit ("extracts the mode's style on mode change", () => {
       button.fontColor = Color.red
       button.fontStyle = 'bold';
       button.borderColor = Color.orange
       button.activeMode = 'triggered';
       expect(button.activeStyle.fontStyle).equals('bold');
       expect(button.activeStyle.fontColor).equals(Color.red);
       expect(button.activeStyle.borderColorLeft).equals(Color.orange);
       expect(button.activeStyle.borderColor).is.not.defined;
     })

     it ('leaving button on press releases', () => {
        env.eventDispatcher.simulateDOMEvents({type: "pointerdown", position: button.center, target: button});
        expect(button.activeMode).equals('triggered');
        env.eventDispatcher.simulateDOMEvents({type: "hoverout", target: button});
        expect(button.activeMode).equals('active');
     })
     
  });

  describe("button mode styles", () => {

    it('styles icon as labels correctly', () => {
       var b = new Button({label: Icon.makeLabel("times-circle-o")});
       b.activeStyle.fontSize = 22;
       b.activeStyle = b.activeStyle;
       expect(b.label).equals(Icon.makeLabel("times-circle-o").textString);
       expect(b.fontSize).equals(22);
       expect(b.labelMorph.fontSize).equals(22);
       b.activeMode = 'triggered';
       expect(b.activeStyle.fontSize).equals(22);
       expect(b.label).equals(Icon.makeLabel("times-circle-o").textString);
    });

    it('excludes position and extent from style modes', () => {
      button.extent = pt(100,100)
      button.position = pt(0,0);
      button.activeMode = 'triggered';
      expect(button.activeStyle.extent).to.be.undefined;
      expect(button.activeStyle.position).to.be.undefined;
    })

    it('allows to change the label', () => {
       button.label = "Hello!";
       button.activeMode = "triggered";
       expect(button.label).equals("Hello!");
    });
    
    it("active style restored on mouse up", () => {
     button.activeStyle = {
          fill: Color.orange, 
          fontSize: 15, 
          fontColor: Color.black,
          fontStyle: 'bold'
     };
     button.activeMode = 'active';
     button.triggerStyle = {
          fill: Color.red, fontSize: 50, 
          fontStyle: 'italic', fontColor: Color.blue
     };
     button.activeMode = 'triggered';
     expect(button.activeStyle.fontSize).equals(15, 'active font size');
     env.eventDispatcher.simulateDOMEvents({type: "pointerdown", target: button});
     expect(button.activeMode).equals('triggered');
     expect(button.fill).equals(Color.red);
     expect(button.fontStyle).equals('italic');
     expect(button.fontSize).equals(50);
     expect(button.fontColor).equals(Color.blue, "trigger font color")
     env.eventDispatcher.simulateDOMEvents({type: "pointerup", target: button});
     expect(button.activeMode).equals('active');
     expect(button.fontColor).equals(Color.black, "active font color")
     expect(button.fontSize).equals(15);
     expect(button.fontStyle).equals('bold');
     expect(button.fill).equals(Color.orange);
    });

   /* rms: We will be revising the style editors anyway, so
           will not yet try to fix these. 18/4/17 */
    xit("can be customized via style editor", () => {
       var styleEditor = styleHaloFor(button),
           borderEditor = styleEditor.get('borderStyler'),
           bodyEditor = styleEditor.get('bodyStyler');
       
       borderEditor.switchButtonMode(button, 'active');
       expect(borderEditor.buttonMode).equals('active');
       button.borderColor = Color.red;
       button.borderWidth = 4;
       expect(button.borderColor).equals(Color.red);
       expect(button.borderWidth).equals(4);
       borderEditor.switchButtonMode(button, 'triggered');
       expect(button.activeStyle.borderColor).equals(Color.red, 'cached active style');
       expect(button.activeStyle.borderWidth).equals(4, 'cached active style');
    })
    
  })
  
});