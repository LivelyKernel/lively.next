import { pt, Color, Point } from "lively.graphics";
import { Renderer } from "lively.morphic/renderer.js";
import { Morph, Ellipse, WorldMorph } from "lively.morphic/morph.js";
import { EventDispatcher } from "lively.morphic/events.js";

var {scrollWidth: w, scrollHeight: h} = document.body,
    world = window.$world = new WorldMorph({extent: pt(w, h)});
  
var renderer = new Renderer(world, document.body);
renderer.startRenderWorldLoop();

var eventDispatcher = new EventDispatcher(window, world);
eventDispatcher.install();

Object.assign(Morph.prototype, {
  bounce() {
    var {x,y} = this.velocity,
        outer = this.owner.innerBounds(),
        inner = this.bounds();
    if (inner.right() > outer.right() || inner.left() < outer.left()) x = -x;
    if (inner.bottom() > outer.bottom() || inner.top() < outer.top()) y = -y;
    this.velocity = pt(x,y);
    this.moveBy(this.velocity);
  }
});

var wbounds = world.bounds(), morphs = [];
for (var i = 0; i < 100; i++) {
  var m = new Ellipse({
    position: wbounds.insetBy(10).randomPoint(),
    extent: Point.random(pt(10,10)).addXY(10,10),
    fill: Color.random()
  });
  m.velocity = Point.random(pt(10,10));
  morphs.push(world.addMorph(m))
}

(function loop() {
  morphs.forEach(ea => ea.bounce());
  requestAnimationFrame(loop);
})();
