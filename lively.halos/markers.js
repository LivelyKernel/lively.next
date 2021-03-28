/* global Element, Node */
import { obj, promise, string } from 'lively.lang';
import { pt, Color, Rectangle, rect } from 'lively.graphics';
import {
  morph,
  easings,
  Path,
  Icon,
  Morph,
  MorphicEnv
} from 'lively.morphic';
import { connect, once, disconnect } from 'lively.bindings';

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

// show(this)

function showRect (world, rect, loop) {
  const marker = BoundsMarker.highlightBounds(rect);
  if (loop) return showInLoop(world, marker, rect);
  return showThenHide(world, marker);
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

class BoundsMarker extends Morph {
  // creates a marker that looks like:
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

    // this.ignoreEvents();
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
    // b.isEpiMorph = true;
    // b.ignoreEvents();
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

// this.world().logError('hello')

export class StatusMessage extends Morph {
  static get properties () {
    return {
      extent: { defaultValue: pt(200, 100) },
      stayOpen: { defaultValue: false },
      slidable: { defaultValue: true }, // auto slide up on new message
      isMaximized: { defaultValue: false },
      expandable: {
        initialize () {
          this.expandable = true;
        }
      },
      maxLines: { defaultValue: Infinity },
      name: { defaultValue: 'messageMorph' },
      master: {
        initialize () {
          this.master = {
            auto: 'styleguide://System/message'
          };
        }
      },

      message: {
        after: ['submorphs', 'extent'],
        set (value) {
          this.setProperty('message', value);
          const text = this.getSubmorphNamed('message text');
          if (!text) return;
          // FIXME not yet initialized
          text.value = value;
          let textEnd = text.documentEndPosition;
          if (textEnd.row > this.maxLines) {
            text.replace({ start: { row: this.maxLines, column: 0 }, end: textEnd }, '...\n');
            if (!this.expandedContent) this.expandedContent = value;
          }
          textEnd = text.documentEndPosition;
          if (textEnd.column !== 0) text.insertText('\n', textEnd);
        }
      },

      title: {
        isStyleProp: true,
        derived: true,
        set (t) {
          this.getSubmorphNamed('message title').value = t;
        },
        get () {
          return this.getSubmorphNamed('message title').value;
        }
      },

      color: {
        after: ['submorphs'],
        derived: true,
        get () {
          return this.get('message icon').fontColor;
        },
        set (value) {
          this.get('message icon').fontColor = value;
          if (this.get('message icon')._parametrizedProps) { this.get('message icon')._parametrizedProps.fontColor = value; }
        }
      },

      submorphs: {
        after: ['extent'],
        initialize () {
          this.submorphs = [
            {
              name: 'message icon',
              type: 'label',
              value: Icon.textAttribute('check-circle')
            },
            {
              name: 'message text',
              type: 'text'
            }, {
              name: 'message title',
              type: 'label'
            },
            {
              name: 'close button',
              type: 'button'
            }
          ];
          connect(this.getSubmorphNamed('close button'), 'fire', this, 'remove');
          connect(this, 'extent', this, 'relayout');
        }
      }
    };
  }

  relayout () {
    this.title = string.truncate(this.message, (this.width / 15).toFixed(), '...');
  }

  isEpiMorph () {
    return true;
  }

  isStatusMessage () {
    return true;
  }

  setMessage (msg, color) {
    this.message = msg;
    this.color = color;
  }

  async slideTo (pos) {
    this.sliding = this.animate({
      position: pos,
      duration: 500
    });
    await this.sliding;
    this.sliding = false;
  }

  async expand () {
    if (!this.expandable) return;
    if (this.sliding) await this.sliding;
    const world = this.world();
    if (!world || this.isMaximized) return;
    this.isMaximized = true;
    this.stayOpen = true;
    const text = this.getSubmorphNamed('message text');
    text.lineWrapping = false;
    Object.assign(text, { clipMode: 'auto', fixedWidth: true, selectable: true });
    if (this.expandedContent) text.value = this.expandedContent;
    text.fit();
    let ext = text.textBounds().extent(); const visibleBounds = world.visibleBounds();
    if (ext.y > visibleBounds.extent().y) ext.y = visibleBounds.extent().y - 20;
    if (ext.x > visibleBounds.extent().x) ext.x = visibleBounds.extent().x - 20;
    ext = this.extent.maxPt(ext);
    this.animate({ extent: ext, center: visibleBounds.center(), duration: 200 });
    this.relayout();
    this.focus();
  }

  fit () {
    const text = this.getSubmorphNamed('message text');
    if (!text) return;
    const minHeight = 35; const minWidth = 100;
    this.extent = pt(minWidth, minHeight).maxPt(text.textBounds().extent());
    this.relayout();
  }

  focus () {
    const text = this.getSubmorphNamed('message text');
    text && text.focus();
  }

  onMouseUp (evt) {
    this.expand();
  }
}

// var m = new StatusMessageForMorph({message: "test"}).openInWorld();
// m.borderColorTop
// m.setMessage("???", Color.green)
// m.message = "foo"
// m.submorphs[0].value
// m.submorphs[0].textString
// m.remove()

export class StatusMessageForMorph extends StatusMessage {
  static get properties () {
    return {
      slidable: { defaultValue: false },
      renderOnGPU: { defaultValue: true },

      // should "internal" changes in the morph we are showing the message for
      // (like cursor changes in a text morph) make this message morph disappear?
      removeOnTargetMorphChange: { defaultValue: true },

      targetMorph: {
        defaultValue: null,
        get () {
          const id = this.getProperty('targetMorph');
          return id && $world.getMorphWithId(id);
        },
        set (morph) {
          this.setProperty('targetMorph', morph ? morph.id : null);
          this.alignAtBottomOf(morph);
        }
      },

      expandable: {
        after: ['submorphs'],
        set (val) {
          this.setProperty('expandable', val);
          if (val) {
            var btn = this.getSubmorphNamed('expand button') || this.addMorph({
              name: 'expand button',
              type: 'button'
            });
            connect(btn, 'fire', this, 'expand');
          } else {
            if (this.getSubmorphNamed('expand button')) {
              this.getSubmorphNamed('expand button').remove();
              disconnect(btn, 'fire', this, 'expand');
            }
          }
        }
      }
    };
  }

  alignAtBottomOf (forMorph) {
    const world = this.world();
    if (!world) return;

    this.bringToFront();

    this.fit();

    this.width = forMorph.bounds().width;
    this.relayout();

    if (forMorph.world()) { this.position = forMorph.owner.worldPoint(forMorph.bounds().bottomLeft()); }

    const visibleBounds = world.visibleBounds();
    const bounds = this.bounds();
    const overlapY = bounds.top() + this.height - visibleBounds.bottom();

    if (overlapY > 0) this.moveBy(pt(0, -overlapY));
  }

  onMouseUp (evt) {}
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

export async function showConnector (morph1, morph2, delay = 3000) {
  if (!morph1 || !morph1.world() || !morph2 || !morph2.world()) return null;

  const p1 = morph1.owner.worldPoint(morph1.center);
  const p2 = morph2.owner.worldPoint(morph2.center);
  const midPoint = p1.lineTo(p2).sampleN(2)[1];
  const marker = {
    tagName: 'marker',
    markerHeight: 5,
    markerWidth: 5,
    orient: 'auto',
    refX: 1,
    refY: 5,
    viewBox: '0 0 10 10',
    children: [{
      tagName: 'circle',
      stroke: Color.red,
      fill: Color.red,
      cx: 5,
      cy: 5,
      r: 4
    }]
  };

  const path = $world.addMorph(new Path({
    position: midPoint,
    renderOnGPU: true,
    vertices: [pt(0), pt(0)],
    borderWidth: 2,
    startMarker: marker,
    endMarker: marker,
    borderColor: Color.red
  }));
  await path.whenRendered();
  await path.animate({
    opacity: 1,
    customTween: (p) => {
      const center = path.center;
      path.vertices = [
        pt(0).interpolate(p, p1.subPt(midPoint)),
        pt(0).interpolate(p, p2.subPt(midPoint))
      ];
      path.center = center;
    },
    duration: 400
  });
  if (delay) setTimeout(() => path.fadeOut(), delay);
  return path;
}
