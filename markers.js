import { obj, string } from "lively.lang";
import { pt, Color, Point, Rectangle, rect } from "lively.graphics";
import { morph, Morph, MorphicEnv } from "./index.js";
import { Icon } from "./icons.js";
import { connect } from "lively.bindings";


export function show(target) {

  var world = MorphicEnv.default().world;

  if (target === null || target === undefined) target = String(target);
  if (target.isMorph) return showRect(target.world(), target.globalBounds());
  if (target.isPoint) return showRect(world, new Rectangle(target.x-5, target.y-5, 10,10));
  if (target.isRectangle) return showRect(world, target);
  if (typeof Element !== "undefined" && target instanceof Element) return showRect(world, Rectangle.fromElement(target));
  if (typeof target === "number" || typeof target === "symbol" || typeof target === "boolean"
    || (typeof Node !== "undefined" && target instanceof Node)
    || target instanceof RegExp) target = String(target);
  if (typeof target === "object") target = obj.inspect(target, {maxDepth: 1})
  if (typeof target === "string" && arguments.length === 1) return world.setStatusMessage(target);

  return world.setStatusMessage(string.formatFromArray(Array.from(arguments)));
}

function showRect(world, rect) {
  var marker = BoundsMarker.highlightBounds(rect);
  return showThenHide(world, marker);
}

function showThenHide (world, morphOrMorphs, duration = 3) {
  if (!world) return;
  var morphs = Array.isArray(morphOrMorphs) ? morphOrMorphs : [morphOrMorphs];
  morphs.forEach(ea => world.addMorph(ea));
  if (duration) { // FIXME use scheduler
    setTimeout(() => morphs.forEach(ea => ea.fadeOut(2000)), duration*1000);
  }
  return morphOrMorphs;
}

class BoundsMarker extends Morph {

  // creates a marker that looks like:
  // xxxx     xxxx
  // x           x
  // x           x
  //
  // x           x
  // x           x
  // xxxx     xxxx


  static highlightMorph(morph) {
    return new this().alignWithMorph(morph);
  }

  static highlightBounds(bounds) {
    return new this().alignWithBounds(bounds);
  }

  constructor() {
    super({borderWidth: 0, fill: Color.transparent, reactsToPointer: false});

    // this.ignoreEvents();
  }

  get isEpiMorph() { return true }

  markerLength(forBounds) {
    forBounds = forBounds.insetBy(-2);
    var length = Math.min(forBounds.width, forBounds.height);
    return Math.max(4, Math.floor((length/10) < 10 ? (length / 2) - 5 : length / 10));
  }

  createMarkerEdge() {
      var b = morph({fill: Color.red, reactsToPointer: false});
      // b.isEpiMorph = true;
      // b.ignoreEvents();
      return b;
  }

  ensureMarkerCorners() {
    var topLeftH     = this.topLeftH     || (this.topLeftH     = this.addMorph(this.createMarkerEdge())),
        topLeftV     = this.topLeftV     || (this.topLeftV     = this.addMorph(this.createMarkerEdge())),
        topRightH    = this.topRightH    || (this.topRightH    = this.addMorph(this.createMarkerEdge())),
        topRightV    = this.topRightV    || (this.topRightV    = this.addMorph(this.createMarkerEdge())),
        bottomRightH = this.bottomRightH || (this.bottomRightH = this.addMorph(this.createMarkerEdge())),
        bottomRightV = this.bottomRightV || (this.bottomRightV = this.addMorph(this.createMarkerEdge())),
        bottomLeftH  = this.bottomLeftH  || (this.bottomLeftH  = this.addMorph(this.createMarkerEdge())),
        bottomLeftV  = this.bottomLeftV  || (this.bottomLeftV  = this.addMorph(this.createMarkerEdge()));
    return [
      topLeftH, topLeftV,
      topRightH, topRightV,
      bottomRightH, bottomRightV,
      bottomLeftH, bottomLeftV];
  }

  alignWithMorph(otherMorph) {
    return this.alignWithBounds(otherMorph.globalBounds());
  }

  alignWithBounds(bounds) {
    this.alignWithRect(bounds.insetBy(-20));
    return this.alignWithRect(bounds, true)
  }

  alignWithRect(r, animated) {
    var markerWidth = 5,
        corners = this.ensureMarkerCorners(),
        markerLength = this.markerLength(r),
        boundsForMarkers = [
          r.topLeft().    addXY(0,0).                        extent(pt(markerLength, markerWidth)),
          r.topLeft().    addXY(0,0).                        extent(pt(markerWidth, markerLength)),
          r.topRight().   addXY(-markerLength, 0).           extent(pt(markerLength, markerWidth)),
          r.topRight().   addXY(-markerWidth,0).             extent(pt(markerWidth, markerLength)),
          r.bottomRight().addXY(-markerWidth, -markerLength).extent(pt(markerWidth, markerLength)),
          r.bottomRight().addXY(-markerLength, -markerWidth).extent(pt(markerLength, markerWidth)),
          r.bottomLeft(). addXY(0,-markerWidth).             extent(pt(markerLength, markerWidth)),
          r.bottomLeft(). addXY(0, -markerLength).           extent(pt(markerWidth, markerLength))];
    corners.forEach((corner, i) => corner.setBounds(boundsForMarkers[i]));
    if (animated) {
       this.adjustOrigin(r.center());
       this.opacity = 0, this.scale = 1.5;
       this.animate({opacity: 1, scale: 1, duration: 300});
    }
    return this;
  }

}

export class StatusMessage extends Morph {

  constructor(props) {
    super(obj.dissoc(props, ["message", "color"]));
    if ("message" in props) this.message = props.message;
    if ("color" in props) this.color = props.color;
    this.relayout();
    connect(this.getSubmorphNamed("closeButton"), "fire", this, "remove");
  }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      stayOpen: false,
      slidable: true, // auto slide up on new message
      isMaximized: false,
      expandable: true,
      maxLines: Infinity,
      name: "messageMorph",
      extent: pt(240, 65),
      clipMode: "hidden",
      grabbing: false, dragging: true,
      borderRadius: 20, borderWidth: 5,
      fill: Color.white,
      dropShadow: true,
      submorphs: [
        {
          name: "messageText",
          type: "text",
          draggable: false, readOnly: true, selectable: true,
          fixedWidth: false, fixedHeight: false, clipMode: "visible",
          fontSize: 14, fontFamily: "Inconsolata, 'DejaVu Sans Mono', monospace"
        },

        {
          name: "closeButton", type: "button",
          extent: pt(22,22), activeStyle: {fill: Color.white},
          label: Icon.makeLabel("close")
        }]
    };
  }

  relayout() {
    this.getSubmorphNamed("messageText").setBounds(this.innerBounds().insetBy(10));
    this.getSubmorphNamed("closeButton").topRight = this.innerBounds().topRight().addXY(-6,6);
  }

  isEpiMorph() { return true }
  isStatusMessage() { return true }

  get message()         { return this.getProperty("message"); }
  set message(value)    {
    var text = this.getSubmorphNamed('messageText');
    if (!text) return; // FIXME not yet initialized
    text.value = value;
    var textEnd = text.documentEndPosition;
    if (textEnd.row > this.maxLines) {
      text.replace({start: {row: this.maxLines, column: 0}, end: textEnd}, "...\n");
      if (!this.expandedContent) this.expandedContent = value;
    }
  }
  get color()            { /*just an alias for now*/return this.borderColor; }
  set color(value)       { this.borderColor = value; }
  get stayOpen()         { return this.getProperty("stayOpen"); }
  set stayOpen(value)    { this.setProperty("stayOpen", value); }
  get slidable()         { return this.getProperty("slidable"); }
  set slidable(value)    { this.setProperty("slidable", value); }
  get expandable()       { return this.getProperty("expandable"); }
  set expandable(value)  { this.setProperty("expandable", value); }
  get isMaximized()      { return this.getProperty("isMaximized"); }
  set isMaximized(value) { this.setProperty("isMaximized", value); }
  get expandedContent()      { return this.getProperty("expandedContent"); }
  set expandedContent(value) { this.setProperty("expandedContent", value); }
  get maxLines()      { return this.getProperty("maxLines"); }
  set maxLines(value) { this.setProperty("maxLines", value); }

  setMessage(msg, color) {
    this.message = msg;
    this.color = color;
  }

  expand() {
    if (!this.expandable) return;
    var world = this.world();
    if (!world || this.isMaximized) return;
    this.isMaximized = true;
    this.stayOpen = true;
    var text = this.getSubmorphNamed('messageText');
    Object.assign(text, {readOnly: false, fixedWidth: false, selectable: true})
    if (this.expandedContent) text.value = this.expandedContent;
    text.fit();
    var ext = text.extent.addXY(20,20),
        visibleBounds = world.visibleBounds();
    if (ext.y > visibleBounds.extent().y) ext.y = visibleBounds.extent().y - 20;
    if (ext.x > visibleBounds.extent().x) ext.x = visibleBounds.extent().x - 20;
    ext = this.extent.maxPt(ext);
    this.animate({extent: ext, center: visibleBounds.center(), duration: 200})
    this.relayout();
    this.focus();
  }

  fit() {
    var text = this.getSubmorphNamed("messageText");
    if (!text) return;
    var minHeight = 40, minWidth = 100;
    this.extent = pt(minWidth, minHeight).maxPt(text.textBounds().extent());
    this.relayout();
  }

  focus() { var text = this.getSubmorphNamed("messageText"); text && text.focus(); }

  onMouseUp(evt) {
    this.expand();
  }
}


// var m = new StatusMessageForMorph({message: "test"})
// var m = that.setStatusMessage(lively.lang.arr.range(0,100).join("\n"), undefined, null, {maxLines: 4})
// m.en
// m.maxLines
// m.message = "test"
// m.remove()



export class StatusMessageForMorph extends StatusMessage {

  constructor(props) {
    super(props);
    if (this.expandable) {
      var btn = this.addMorph({
        name: "expandButton", type: "button",
        extent: pt(22,22), activeStyle: {fill: Color.white},
        label: Icon.makeLabel("expand")
      });
      connect(btn, "fire", this, "expand");
      this.relayout();
    }
  }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      slidable: false,
      removeOnTargetMorphChange: true,
      targetMorph: null // id!
    };
  }

  relayout() {
    super.relayout();
    var expandBtn = this.getSubmorphNamed("expandButton");
    if (expandBtn) {
      expandBtn.topRight = this.getSubmorphNamed("closeButton").topLeft.addXY(-3, 0);
    }
  }

  // should "internal" changes in the morph we are showing the message for
  // (like cursor changes in a text morph) make this message morph disappear?
  get removeOnTargetMorphChange()      { return this.getProperty("removeOnTargetMorphChange"); }
  set removeOnTargetMorphChange(value) { this.setProperty("removeOnTargetMorphChange", value); }

  get targetMorph()      {
    var id = this.getProperty("targetMorph");
    return id && $world.getMorphWithId(id);
  }
  set targetMorph(morph) {
    this.setProperty("targetMorph", morph ? morph.id : null);
    this.alignAtBottomOf(morph);
  }

  alignAtBottomOf(forMorph) {
    var world = this.world();
    if (!world) return;

    this.bringToFront();

    this.fit();

    this.width = forMorph.width;
    this.relayout();

    if (forMorph.world())
      this.position = forMorph.owner.worldPoint(forMorph.bounds().bottomLeft());

    var visibleBounds = world.visibleBounds(),
        bounds = this.bounds(),
        overlapY = bounds.top() + this.height - visibleBounds.bottom();

    if (overlapY > 0) this.moveBy(pt(0, -overlapY));
  }

  onMouseUp(evt) {}
}
