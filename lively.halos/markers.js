/* global Element, Node */
import { obj, promise, string } from 'lively.lang';
import { pt, Color, Rectangle } from 'lively.graphics';
import {
  morph,
  easings,
  Morph,
  MorphicEnv
} from 'lively.morphic';
import { once } from 'lively.bindings';

class BoundsMarker extends Morph {
  // creates a marker that looks like this:
  // xxxx     xxxx
  // x           x
  // x           x
  //
  // x           x
  // x           x
  // xxxx     xxxx

  static highlightMorph (morph) {
    return new this().alignWithMorph(morph);
  }

  static highlightBounds (bounds) {
    return new this().alignWithBounds(bounds);
  }

  constructor () {
    super({ borderWidth: 0, fill: Color.transparent, reactsToPointer: false, hasFixedPosition: true });
  }

  get isEpiMorph () {
    return true;
  }

  markerLength (forBounds) {
    forBounds = forBounds.insetBy(-2);
    const length = Math.min(forBounds.width, forBounds.height);
    return Math.max(4, Math.floor(length / 10 < 10 ? length / 2 - 5 : length / 10));
  }

  createMarkerEdge () {
    const b = morph({ fill: Color.red, reactsToPointer: false, borderRadius: 10 });
    return b;
  }

  ensureMarkerCorners () {
    const topLeftH = this.topLeftH || (this.topLeftH = this.addMorph(this.createMarkerEdge()));
    const topLeftV = this.topLeftV || (this.topLeftV = this.addMorph(this.createMarkerEdge()));
    const topRightH = this.topRightH || (this.topRightH = this.addMorph(this.createMarkerEdge()));
    const topRightV = this.topRightV || (this.topRightV = this.addMorph(this.createMarkerEdge()));
    const bottomRightH =
          this.bottomRightH || (this.bottomRightH = this.addMorph(this.createMarkerEdge()));
    const bottomRightV =
          this.bottomRightV || (this.bottomRightV = this.addMorph(this.createMarkerEdge()));
    const bottomLeftH =
          this.bottomLeftH || (this.bottomLeftH = this.addMorph(this.createMarkerEdge()));
    const bottomLeftV =
          this.bottomLeftV || (this.bottomLeftV = this.addMorph(this.createMarkerEdge()));
    return [
      topLeftH,
      topLeftV,
      topRightH,
      topRightV,
      bottomRightH,
      bottomRightV,
      bottomLeftH,
      bottomLeftV
    ];
  }

  alignWithMorph (otherMorph) {
    return this.alignWithBounds(otherMorph.globalBounds().translatedBy($world.scroll.negated()));
  }

  alignWithBounds (bounds) {
    this.alignWithRect(bounds.insetBy(-20));
    return this.alignWithRect(bounds, true);
  }

  alignWithRect (r, animated) {
    const markerWidth = 5;
    const corners = this.ensureMarkerCorners();
    const markerLength = this.markerLength(r);
    const boundsForMarkers = [
      r.topLeft().addXY(0, 0).extent(pt(markerLength, markerWidth)),
      r.topLeft().addXY(0, 0).extent(pt(markerWidth, markerLength)),
      r.topRight().addXY(-markerLength, 0).extent(pt(markerLength, markerWidth)),
      r.topRight().addXY(-markerWidth, 0).extent(pt(markerWidth, markerLength)),
      r.bottomRight().addXY(-markerWidth, -markerLength).extent(pt(markerWidth, markerLength)),
      r.bottomRight().addXY(-markerLength, -markerWidth).extent(pt(markerLength, markerWidth)),
      r.bottomLeft().addXY(0, -markerWidth).extent(pt(markerLength, markerWidth)),
      r.bottomLeft().addXY(0, -markerLength).extent(pt(markerWidth, markerLength))
    ];
    corners.forEach((corner, i) => corner.setBounds(boundsForMarkers[i]));
    if (animated) {
      this.adjustOrigin(r.center());
      (this.opacity = 0), (this.scale = 1.5);
      this.animate({ opacity: 1, scale: 1, duration: 300 });
    }
    return this;
  }

  async retract (r) {
    await this.animate({
      scale: Math.max(30 / r.width, 1.05) // easing: easings.inOutExpo,
    });
    const center = this.center;
    await this.animate({
      center,
      scale: 1,
      duration: 300,
      easing: easings.inOutExpo
    });
  }
}

function showThenHide (world, morphOrMorphs, duration = 3) {
  if (!world) return;
  const morphs = Array.isArray(morphOrMorphs) ? morphOrMorphs : [morphOrMorphs];
  morphs.forEach(ea => world.addMorph(ea));
  if (duration) {
    // FIXME use scheduler
    setTimeout(() => morphs.forEach(ea => ea.fadeOut(2000)), duration * 1000);
  }
  return morphOrMorphs;
}

async function showInLoop (world, marker, rect) {
  showThenHide(world, marker, false);
  await promise.delay(300);
  let requestRemove = false;
  once(world, 'onMouseDown', () => requestRemove = true);
  once(world, 'hideMarkers', () => requestRemove = true);
  while (!requestRemove) {
    await marker.retract(rect);
  }
  marker.fadeOut(2000);
}

function showRect (world, rect, loop) {
  const marker = BoundsMarker.highlightBounds(rect);
  if (loop) return showInLoop(world, marker, rect);
  return showThenHide(world, marker);
}

function showLine (world, line, delay = 3000) {
  const { start, end } = line;
  const vec = end.subPt(start);
  const path = world.addMorph({
    position: start,
    rotation: vec.theta(),
    border: { width: 1, color: Color.red },
    width: vec.fastR(),
    height: 0
  });
  if (delay) setTimeout(() => path.fadeOut(), delay);
  return path;
}

export function show (target, loop = false) {
  const world = MorphicEnv.default().world;

  if (target === null || target === undefined) target = String(target);
  if (target.isMorph) return showRect(target.world(), target.globalBounds().translatedBy(world.scroll.negated()), loop);
  if (target.isPoint) return showRect(world, new Rectangle(target.x - 5, target.y - 5, 10, 10));
  if (target.isLine) return showLine(world, target);
  if (target.isRectangle) return showRect(world, target);
  if (typeof Element !== 'undefined' && target instanceof Element) { return showRect(world, Rectangle.fromElement(target)); }
  if (
    typeof target === 'number' ||
    typeof target === 'symbol' ||
    typeof target === 'boolean' ||
    (typeof Node !== 'undefined' && target instanceof Node) ||
    target instanceof RegExp
  ) target = String(target);
  if (typeof target === 'object') target = obj.inspect(target, { maxDepth: 1 });
  if (typeof target === 'string' && arguments.length === 1) return world.setStatusMessage(target);

  return world.setStatusMessage(string.formatFromArray(Array.from(arguments)));
}
