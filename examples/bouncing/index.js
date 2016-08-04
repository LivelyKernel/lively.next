import { pt, Color, Point } from "lively.graphics";
import { morph, Morph, MorphicEnv } from "lively.morphic";

var {scrollWidth: w, scrollHeight: h} = document.body,
    world = window.$world = morph({type: "world", extent: pt(w, h)});

MorphicEnv.default().setWorld(world);

Object.assign(Morph.prototype, {
  bounce() {
    var {x,y} = this.velocity,
        outer = this.owner.innerBounds(),
        inner = this.bounds();
    if (inner.right() > outer.right() || inner.left() < outer.left()) x = -x;
    if (inner.bottom() > outer.bottom() || inner.top() < outer.top()) y = -y;
    this.velocity = pt(x, y);
    this.time += 0.1;
    this.rotation += this.spin;
    this.scale = 1 + Math.abs(Math.sin(this.time));
    this.moveBy(this.velocity);
  }
});

var wbounds = world.bounds(), morphs = [];

for (var i = 0; i < 1000; i++) {

  var props = {
    time: Math.random()*10,
    position: wbounds.insetBy(10).randomPoint(),
    extent: Point.random(pt(20,20)).addXY(10,10),
    fill: Color.random(),
    velocity: Point.random(pt(10,10)),
    spin: Math.random()/10 - 0.05
  }

  var type = props.type = Math.random() < 0.1 ? "image" :
    Math.random() < 0.15 ? "text" :
      Math.random() < 0.3 ? "ellipse" : "morph";

  if (type === "image" || type === "text") {
    props.extent = Point.random(pt(20,20)).addXY(50,50);
    props.fill = Color.null;
  }

  if (type === "text") {
    props.textString = "Hello Lively!";
  }

  props.origin = props.extent.scaleBy(0.5),

  morphs.push(world.addMorph(props))
}

var time = Date.now();
(function loop() {
  morphs.forEach(ea => ea.bounce());

  var time2 = Date.now();
  if (time2-time > 10*1000) {
    time = time2;
    var rec = world.env.changeRecorder;
    console.log(`[changes] ${rec.revision} ${rec.changes.length}`);
    console.log(`${(rec.changes.length/30).toFixed(1)} changes/s`);
    rec.changes.length = 0;
  }

  requestAnimationFrame(loop);
})();
