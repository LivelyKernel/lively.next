// For getting a new Morphic world setup in old Lively
import { num, arr } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { morph, MorphicEnv } from "lively.morphic";
import { ObjectDrawer, Workspace } from "lively.morphic/tools.js";
import { Window } from "lively.morphic/widgets.js";

export function setupMorphicWorldOn(htmlMorph) {
  var rootNode = htmlMorph.renderContext().shapeNode,
      env = MorphicEnv.default(),
      world = morph({
        env, type: "world", extent: Point.ensure(htmlMorph.getExtent()),
        submorphs: [
          new ObjectDrawer({env, position: pt(20,10)}),
          {env, type: "List", items: Array.range(0,150).map(n => `item ${n}`), extent: pt(200, 300), position: pt(200,200), borderWidth: 1, borderColor: Color.gray},
          new Workspace({env, extent: pt(200, 300), position: pt(400,200)})
        ]});
  env.setWorldRenderedOn(world, rootNode)

  // FIXME currently used for show()
  window.$$world = world;
  return env;
}

function addMorphicSetupMethods(htmlMorph) {
  htmlMorph.doNotSerialize = ["env"];
  htmlMorph.addScript(function cleanupNewMorphicWorld() {
    if (this.env) {
      this.env.uninstall();
      this.env.constructor.reset();
    }
    this.setHTML('');
    this.env = null;
  });

  htmlMorph.addScript(function setupNewMorphicWorld() {
    this.cleanupNewMorphicWorld();
    return window.lively.next.bootstrapped
      .then(() => window.lively.modules.importPackage("node_modules/lively.morphic"))
      .then(() => window.System.import("lively.morphic/old-lively-helpers.js"))
      .then(helpers => this.env = helpers.setupMorphicWorldOn(this))
      .catch(err => window.$world.logError(err));
  });

  htmlMorph.addScript(function onShutdown() { this.cleanupNewMorphicWorld(); });
  htmlMorph.addScript(function onLoad() { this.setupNewMorphicWorld(); });
}

function createHtmlMorph() {
  var htmlMorph = new lively.morphic.HtmlWrapperMorph(pt(666,600));
  htmlMorph.removeStyleClassName("selectable");
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
  window.lively.bindings.connect(htmlMorph.getWindow().closeButton, 'fire', htmlMorph, 'cleanupNewMorphicWorld');

  return htmlMorph;
}

export function createWorld(world) {
  var htmlMorph = createHtmlMorph();
  htmlMorph.getWindow().openInWorldCenter()
  htmlMorph.onLoad()
  return htmlMorph;
}
