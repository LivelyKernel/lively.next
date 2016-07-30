/*global declare, it, describe, beforeEach, afterEach, before, after*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { morph, Menu } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }


var world;
function createDummyWorld() {
  return world = morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: []
  });
}


describe("menus", () => {

  beforeEach(async () => MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());

  inBrowser("appear with title and items", () => {
    var item1Activated = 0,
        menu = new Menu({title: "Test", items: [["item 1", () => item1Activated++]]});

    world.addMorph(menu);
    expect(menu.submorphs[0].textString).equals("Test");
    expect(menu.submorphs[1].textString).equals("item 1");
    expect(menu.width).within(40,55, "menu width");
    expect(menu.height).within(40,55, "menu height");
  });

});



// AsyncTestCase.subclass('lively.morphic.tests.MenuTests',
// 'testing', {
//     testWrongSubMenuItems: function() {
//         var menu = lively.morphic.Menu.openAt(pt(0,0), 'test', [['foo', ['bar']], ['foo2', ['bar2']]]),
//             item = menu.submorphs[1]; // 0 is title, 1 is first item
//         this.doMouseEvent({type: 'mouseover', pos: pt(5,5), target: item.renderContext().getMorphNode()});
//         this.delay(function() {
//             this.assertEquals('bar', menu.subMenu.items[0].string, 'sub menu is wrong');
//             this.done();
//         }, 200)
//     },

//     testTransformMenuBoundsForVisibility: function() {
//         var ownerBounds = new Rectangle(0,0, 300, 100),
//             menuBounds, result, expected;

//         // nothing to do when rect opens in visible range
//         menuBounds = new Rectangle(0,0, 30, 20);
//         expected = menuBounds;
//         result = lively.morphic.Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds)
//         this.assertEquals(expected, result, 1);

//         // move bounds left besides opening point (hand) so that no accidental clicks occur
//         menuBounds = new Rectangle(290,0, 30, 20);
//         expected = new Rectangle(260,0, 30, 20);
//         result = lively.morphic.Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds)
//         this.assertEquals(expected, result, 2);

//         // if bottom of menu would be lower than bottom of visble bounds, translate it
//         menuBounds = new Rectangle(0,90, 30, 20);
//         expected = menuBounds.translatedBy(pt(0,-10));
//         result = lively.morphic.Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds)
//         this.assertEquals(expected, result, 3);
//         this.done();
//     },

//     testTransformSubMenuBoundsForVisibility: function() {
//         var ownerBounds = new Rectangle(0,0, 300, 100),
//             mainMenuItemBounds, subMenuBounds, result, expected;

//         // move rect so that it is next to menu item
//         mainMenuItemBounds = new Rectangle(0,0, 10, 10);
//         subMenuBounds = new Rectangle(0,0, 30, 20);
//         expected = new Rectangle(10,0, 30, 20);
//         result = lively.morphic.Menu.prototype.moveSubMenuBoundsForVisibility(
//             subMenuBounds, mainMenuItemBounds, ownerBounds);
//         this.assertEquals(expected, result, 1);

//         // when too far right, move the submenu to the left
//         mainMenuItemBounds = new Rectangle(290,0, 10, 10);
//         subMenuBounds = new Rectangle(0,0, 30, 20);
//         expected = new Rectangle(290-30,0, 30, 20);
//         result = lively.morphic.Menu.prototype.moveSubMenuBoundsForVisibility(
//             subMenuBounds, mainMenuItemBounds, ownerBounds);
//         this.assertEquals(expected, result, 2);

//         // when too far below move the submenu up
//         mainMenuItemBounds = new Rectangle(0,90, 10, 10);
//         subMenuBounds = new Rectangle(0,0, 30, 20);
//         expected = new Rectangle(10,90-10, 30, 20);
//         result = lively.morphic.Menu.prototype.moveSubMenuBoundsForVisibility(
//             subMenuBounds, mainMenuItemBounds, ownerBounds);
//         this.assertEquals(expected, result, 3);

//         // when owner bounds to small align at top
//         mainMenuItemBounds = new Rectangle(0,0, 10, 10);
//         subMenuBounds = new Rectangle(0,0, 10, 200);
//         expected = new Rectangle(10,0, 10, 200);
//         result = lively.morphic.Menu.prototype.moveSubMenuBoundsForVisibility(
//             subMenuBounds, mainMenuItemBounds, ownerBounds);
//         this.assertEquals(expected, result, 4);
//         this.done();
//     },

//     testTransformMenuBoundsForVisibility: function() {
//         var ownerBounds = new Rectangle(0,0, 20, 20),
//             menuBounds = new Rectangle(10,10, 30, 30),
//             // move 1px to right so hand is out of bounds
//             expected = new Rectangle(1,0, 30, 30),
//             result = lively.morphic.Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds);
//         this.assertEquals(expected, result, 'transformed when onerBounds smaller');
//         this.done();
//     }

// });
