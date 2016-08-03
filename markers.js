import { pt, Color, Point, Rectangle, rect } from "lively.graphics";
import { morph, Morph, MorphicEnv } from "./index.js";


export function show(target) {

  var world = MorphicEnv.default().world;

  if (target === null || target === undefined) return;
  if (target.isMorph) return showRect(target.world(), target.globalBounds());
  if (target.isPoint) return showRect(world, new Rectangle(target.x-5, target.y-5, 10,10));
  if (target.isRectangle) return showRect(world, target);
  if (typeof Element !== "undefined" && target instanceof Element) return showRect(world, Rectangle.fromElement(target));

  return world.setStatusMessage(String(target));
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
    setTimeout(() => morphs.forEach(ea => ea.remove()), duration*1000);
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
    return new this().alignWithRect(bounds);
  }

  constructor() {
    super({borderWidth: 0, fill: null, reactsToPointer: false});

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
    return this.alignWithRect(otherMorph.globalBounds());
  }

  alignWithRect(r) {
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
    return this;
  }

}

export class StatusMessage extends Morph {

  constructor(msg, color = Color.gray, props = {}) {

    super({

      name: 'messageMorph',
      extent: pt(240, 65),
      clipMode: 'hidden',
      grabbing: false, dragging: true,
      borderRadius: 20, borderWidth: 5,
      fill: null,
      stayOpen: false,
      isMaximized: false,
      ...props,


      submorphs: [
      {
        name: 'messageText',
        type: "text",
        draggable: false,
        bounds: pt(240, 65).extentAsRectangle().insetBy(10),
        fixedWidth: false, fixedHeight: false, clipMode: 'visible',
        fontSize: 14, fontFamily: "Monaco, Inconsolata, 'DejaVu Sans Mono', monospace"
      },

      {
        name: 'closeButton',
        topRight: pt(240-15, 12), extent: pt(20,20),
        fill: null,
        styleClasses: ["center-text", "fa", "fa-close"],
        nativeCursor: "pointer",
        onMouseUp(evt) { this.owner.remove(); evt.stop(); }
      }]

    });


    this.setMessage(msg, color);
  }

  isEpiMorph() { return true }
  isStatusMessage() { return true }

  get stayOpen()         { return this.getProperty("stayOpen"); }
  set stayOpen(value)    { this.recordValueChange("stayOpen", value); }
  get isMaximized()      { return this.getProperty("isMaximized"); }
  set isMaximized(value) { this.recordValueChange("isMaximized", value); }

  setMessage(msg, color) {
    var textMsg = this.get('messageText');
    textMsg.textString = msg;
    this.borderColor = color;
  }

  expand() {
    var world = this.world();
    if (!world || this.isMaximized) return;
    this.isMaximized = true;
    this.stayOpen = true;
    var text = this.get('messageText');
    Object.assign(text, {readOnly: false, fixedWidth: false, selectable: true})
    text.fit();
    var ext = text.extent.addXY(20,20),
        visibleBounds = world.visibleBounds();
    if (ext.y > visibleBounds.extent().y) ext.y = visibleBounds.extent().y - 20;
    if (ext.x > visibleBounds.extent().x) ext.x = visibleBounds.extent().x - 20;
    ext = this.extent.maxPt(ext);
    this.extent = ext;
    this.center = visibleBounds.center();
  }

  onMouseDown(evt) {
    this.expand();
  }

}
