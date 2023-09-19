/* global System, declare, it, describe, beforeEach, afterEach, before, after, xit, $$world */

import { MorphicEnv, morph } from 'lively.morphic';
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';
import { Menu } from 'lively.components/menus.js';
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { pt, Color, Rectangle, Transform, rect } from 'lively.graphics';

let inBrowser = System.get('@system-env').browser
  ? it
  : (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); };

function wait (n) {
  return n ? promise.delay(n * 1000) : Promise.resolve();
}

let env;
async function setup () {
  env = new MorphicEnv(await createDOMEnvironment());
  MorphicEnv.pushDefault(env);
  await env.setWorld(createDummyWorld());
}

function teardown () {
  MorphicEnv.popDefault().uninstall();
}

let world;
function createDummyWorld () {
  return world = morph({
    type: 'world',
    name: 'world',
    extent: pt(300, 300),
    submorphs: []
  });
}

describe('menus', () => {
  beforeEach(() => setup());
  afterEach(() => teardown());

  inBrowser('appear with title and items', async () => {
    let item1Activated = 0;
    let menu = new Menu({ title: 'Test', items: [['item 1', () => item1Activated++]] });

    world.addMorph(menu);
    // Wait for the text fitting of the menu items
    await menu.whenRendered();
    expect(menu.submorphs[0].textString).equals('Test');
    expect(menu.submorphs[1].textString).equals('item 1');
    expect(menu.width).within(40, 70, 'menu width');
    expect(menu.height).within(40, 70, 'menu height');
  });

  it('shows submenu', async () => {
    let menu = Menu.openAt(pt(0, 0), [['foo', [['bar']]], ['foo2', [['bar2']]]], { title: 'test' });
    let item = menu.submorphs[1]; // 0 is title, 1 is first item

    await menu.whenRendered();
    await env.eventDispatcher.simulateDOMEvents({
      target: menu.itemMorphs[0],
      type: 'pointerover',
      position: menu.itemMorphs[0].globalBounds().center()
    });
    await wait(0.2);

    expect(menu.submenu.items[0].label).equals('bar', 'sub menu is wrong');
  });

  it('transform menu bounds for visibility', function () {
    let ownerBounds = new Rectangle(0, 0, 300, 100);
    let menuBounds; let result; let expected;

    // nothing to do when rect opens in visible range
    menuBounds = new Rectangle(0, 0, 30, 20);
    expected = menuBounds;
    result = Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds);
    expect(result).equals(result, 1);

    // move bounds left besides opening point (hand) so that no accidental clicks occur
    menuBounds = new Rectangle(290, 0, 30, 20);
    expected = new Rectangle(260, 0, 30, 20);
    result = Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds);
    expect(result).equals(result, 2);

    // if bottom of menu would be lower than bottom of visble bounds, translate it
    menuBounds = new Rectangle(0, 90, 30, 20);
    expected = menuBounds.translatedBy(pt(0, -10));
    result = Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds);
    expect(result).equals(result, 3);
  });

  it('transform sub menu bounds for visibility', function () {
    let ownerBounds = new Rectangle(0, 0, 300, 100);
    let mainMenuItemBounds; let subMenuBounds; let result; let expected;

    // move rect so that it is next to menu item
    mainMenuItemBounds = new Rectangle(0, 0, 10, 10);
    subMenuBounds = new Rectangle(0, 0, 30, 20);
    expected = new Rectangle(10, 0, 30, 20);
    result = Menu.prototype.moveSubMenuBoundsForVisibility(
      subMenuBounds, mainMenuItemBounds, ownerBounds);
    expect(result).equals(expected, 1);

    // when too far right, move the submenu to the left
    mainMenuItemBounds = new Rectangle(290, 0, 10, 10);
    subMenuBounds = new Rectangle(0, 0, 30, 20);
    expected = new Rectangle(290 - 30, 0, 30, 20);
    result = Menu.prototype.moveSubMenuBoundsForVisibility(
      subMenuBounds, mainMenuItemBounds, ownerBounds);
    expect(result).equals(expected, 2);

    // when too far below move the submenu up
    mainMenuItemBounds = new Rectangle(0, 90, 10, 10);
    subMenuBounds = new Rectangle(0, 0, 30, 20);
    expected = new Rectangle(10, 90 - 10, 30, 20);
    result = Menu.prototype.moveSubMenuBoundsForVisibility(
      subMenuBounds, mainMenuItemBounds, ownerBounds);
    expect(result).equals(expected, 3);

    // when owner bounds to small align at top
    mainMenuItemBounds = new Rectangle(0, 0, 10, 10);
    subMenuBounds = new Rectangle(0, 0, 10, 200);
    expected = new Rectangle(10, 0, 10, 200);
    result = Menu.prototype.moveSubMenuBoundsForVisibility(
      subMenuBounds, mainMenuItemBounds, ownerBounds);
    expect(result).equals(expected, 4);
  });

  it('transform menu bounds for visibility 2', function () {
    let ownerBounds = new Rectangle(0, 0, 20, 20);
    let menuBounds = new Rectangle(10, 10, 30, 30);
    // move 1px to right so hand is out of bounds
    let expected = new Rectangle(1, 0, 30, 30);
    let result = Menu.prototype.moveBoundsForVisibility(menuBounds, ownerBounds);
    expect(result).equals(expected, 'transformed when onerBounds smaller');
  });
});
