// For getting a new Morphic world setup in old Lively
import { num, arr } from "lively.lang";
import { pt, Color, Point, Rectangle, Transform } from "lively.graphics";
import { Renderer, morph, Text, EventDispatcher, Menu } from "lively.morphic";
import { ObjectDrawer } from "lively.morphic/widgets.js";

export function setupMorphicWorldOn(htmlMorph, world) {

  var rootNode = htmlMorph.renderContext().shapeNode;
  if (!world) {
    world = morph({type: "world", extent: Point.ensure(htmlMorph.getExtent())});
    world.addMorph(new ObjectDrawer({position: pt(20,10)}));;
  }

  var renderer = new Renderer(world, rootNode).startRenderWorldLoop(),
      eventDispatcher = new EventDispatcher(window, world).install();

  // FIXME currently used for show()
  window.$$world = world;
  return {world, renderer, eventDispatcher};
}


function addMorphicSetupMethods(htmlMorph) {
  htmlMorph.doNotSerialize = ["state"];
  htmlMorph.addScript(function cleanupNewMorphicWorld() {
    if (this.state) {
      var {renderer, eventDispatcher} = this.state;
      renderer && renderer.clear();
      eventDispatcher && eventDispatcher.uninstall();
    }
    this.setHTML('');
    this.state = {};
  });

  htmlMorph.addScript(function setupNewMorphicWorld() {
    this.cleanupNewMorphicWorld();
    return window.lively.next.bootstrapped
      .then(() => window.lively.modules.importPackage("node_modules/lively.morphic"))
      .then(() => window.System.import("lively.morphic/old-lively-helpers.js"))
      .then(helpers => this.state = helpers.setupMorphicWorldOn(this))
      .catch(err => window.$world.logError(err));
  });

  htmlMorph.addScript(function onLoad() {
    this.setupNewMorphicWorld();
  });
}

function createHtmlMorph() {
  var htmlMorph = new lively.morphic.HtmlWrapperMorph(pt(666,600));
  htmlMorph.addScript(function onMouseDown() {});
  htmlMorph.addScript(function onContextMenu() {});
  htmlMorph.addScript(function onKeyDown() {});
  htmlMorph.name = "lively.morphic world"
  htmlMorph.setHTML("");
  htmlMorph.setFill(window.Color.white);
  addMorphicSetupMethods(htmlMorph);

  var win = htmlMorph.openInWindow();
  win.name = "window for lively.morphic world";

  var titleBar = htmlMorph.getWindow().titleBar;
  var resetButton = new lively.morphic.Button(window.rect(0,0,60,18), "reset");
  titleBar.addMorph(resetButton);
  var left = Math.min.apply(null, titleBar.buttons.invoke("getPosition").pluck("x"));
  resetButton.align(resetButton.bounds().topRight(), window.pt(left-10, 2))
  titleBar.buttons.push(resetButton);
  window.lively.bindings.connect(resetButton, 'fire', htmlMorph, 'setupNewMorphicWorld');

  return htmlMorph;
}

export function createWorld(world) {
  var htmlMorph = createHtmlMorph();
  htmlMorph.getWindow().openInWorldCenter()
  htmlMorph.onLoad()
  return htmlMorph;
}
