import { pt, Color, Point } from "lively.graphics";
import { EventDispatcher, Renderer, morph, Morph } from "lively.morphic";

var {scrollWidth: w, scrollHeight: h} = document.body,
    world = window.$world = morph({type: "world", extent: pt(w, h)});

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
    this.time += 0.1;
    // this.rotation += this.spin;
    // this.scale = 1 + Math.abs(Math.sin(this.time));
    this.moveBy(this.velocity);
    this._changes = [];
  }
});

var wbounds = world.bounds(), morphs = [];

for (var i = 0; i < 100; i++) {
  // var m = {
  //   type: "Ellipse",
  //   position: wbounds.insetBy(10).randomPoint(),
  //   extent: Point.random(pt(10,10)).addXY(10,10),
  //   fill: Color.random()
  // };

  var type = Math.random() < 0.1 ? "image" : "morph",
      ext = type === 'image' ?
        Point.random(pt(20,20)).addXY(50,50) :
        Point.random(pt(20,20)).addXY(10,10);
  var m = {
    time: 0,
    type: type,
    origin: ext.scaleBy(0.5),
    position: wbounds.insetBy(10).randomPoint(),
    extent: ext,
    fill: type === "image" ? null : Color.random()
  };
  m.velocity = Point.random(pt(10,10));
  m.spin = Math.random()/10 - 0.05
  morphs.push(world.addMorph(m))
}

(function loop() {
  morphs.forEach(ea => ea.bounce());
  requestAnimationFrame(loop);
})();
