/* global Element, Node */
import {obj, arr, string} from "lively.lang";
import {pt, Color, Point, Rectangle, rect} from "lively.graphics";
import {morph, Path, Ellipse, Icon, StyleSheet, Morph, MorphicEnv, ShadowObject} from "lively.morphic";
import {connect, disconnect} from "lively.bindings";
import { MorphHighlighter } from "./morph.js";

export function show(target) {
  var world = MorphicEnv.default().world;

  if (target === null || target === undefined) target = String(target);
  if (target.isMorph) return showRect(target.world(), target.globalBounds());
  if (target.isPoint) return showRect(world, new Rectangle(target.x - 5, target.y - 5, 10, 10));
  if (target.isLine) return showLine(world, target);
  if (target.isRectangle) return showRect(world, target);
  if (typeof Element !== "undefined" && target instanceof Element)
    return showRect(world, Rectangle.fromElement(target));
  if (
    typeof target === "number" ||
    typeof target === "symbol" ||
    typeof target === "boolean" ||
    (typeof Node !== "undefined" && target instanceof Node) ||
    target instanceof RegExp
  ) target = String(target);
  if (typeof target === "object") target = obj.inspect(target, {maxDepth: 1});
  if (typeof target === "string" && arguments.length === 1) return world.setStatusMessage(target);

  return world.setStatusMessage(string.formatFromArray(Array.from(arguments)));
}

function showRect(world, rect) {
  var marker = BoundsMarker.highlightBounds(rect);
  return showThenHide(world, marker);
}

function showThenHide(world, morphOrMorphs, duration = 3) {
  if (!world) return;
  var morphs = Array.isArray(morphOrMorphs) ? morphOrMorphs : [morphOrMorphs];
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

  get isEpiMorph() {
    return true;
  }

  markerLength(forBounds) {
    forBounds = forBounds.insetBy(-2);
    var length = Math.min(forBounds.width, forBounds.height);
    return Math.max(4, Math.floor(length / 10 < 10 ? length / 2 - 5 : length / 10));
  }

  createMarkerEdge() {
    var b = morph({fill: Color.red, reactsToPointer: false});
    // b.isEpiMorph = true;
    // b.ignoreEvents();
    return b;
  }

  ensureMarkerCorners() {
    var topLeftH = this.topLeftH || (this.topLeftH = this.addMorph(this.createMarkerEdge())),
        topLeftV = this.topLeftV || (this.topLeftV = this.addMorph(this.createMarkerEdge())),
        topRightH = this.topRightH || (this.topRightH = this.addMorph(this.createMarkerEdge())),
        topRightV = this.topRightV || (this.topRightV = this.addMorph(this.createMarkerEdge())),
        bottomRightH =
          this.bottomRightH || (this.bottomRightH = this.addMorph(this.createMarkerEdge())),
        bottomRightV =
          this.bottomRightV || (this.bottomRightV = this.addMorph(this.createMarkerEdge())),
        bottomLeftH =
          this.bottomLeftH || (this.bottomLeftH = this.addMorph(this.createMarkerEdge())),
        bottomLeftV =
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

  alignWithMorph(otherMorph) {
    return this.alignWithBounds(otherMorph.globalBounds());
  }

  alignWithBounds(bounds) {
    this.alignWithRect(bounds.insetBy(-20));
    return this.alignWithRect(bounds, true);
  }

  alignWithRect(r, animated) {
    var markerWidth = 5,
        corners = this.ensureMarkerCorners(),
        markerLength = this.markerLength(r),
        boundsForMarkers = [
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
      this.animate({opacity: 1, scale: 1, duration: 300});
    }
    return this;
  }
}

// install style sheets in world when rendered

export class StatusMessage extends Morph {

  static get styleSheet() {
    return new StyleSheet("Status Message Style", {
      ".StatusMessage [name=messageText]": {
        draggable: false,
        readOnly: true,
        selectable: true,
        fixedWidth: false,
        fixedHeight: false,
        clipMode: "visible",
        fontSize: 14,
        fontFamily: "Monaco, 'DejaVu Sans Mono', monospace"
      },
      ".StatusMessage .Button": {
         borderRadius: 15
      },
      ".StatusMessage .Button.activeStyle": {
         fill: Color.white
      }
    });
  }

  static get properties() {
    return {
      stayOpen: {defaultValue: false},
      slidable: {defaultValue: true}, // auto slide up on new message
      isMaximized: {defaultValue: false},
      expandable: {
        initialize() {
          this.expandable = true;
        }
      },
      maxLines: {defaultValue: Infinity},
      name: {defaultValue: "messageMorph"},
      extent: {defaultValue: pt(240, 65)},
      clipMode: {defaultValue: "hidden"},
      grabbing: {defaultValue: false},
      dragging: {defaultValue: false},
      borderRadius: {defaultValue: 20},
      borderWidth: {defaultValue: 5},
      fill: {defaultValue: Color.white},
      dropShadow: {defaultValue: new ShadowObject(true)},

      message: {
        after: ["submorphs", "styleSheets"],
        set(value) {
          this.setProperty("message", value);
          var text = this.getSubmorphNamed("messageText");
          if (!text) return;
          // FIXME not yet initialized
          text.value = value;
          var textEnd = text.documentEndPosition;
          if (textEnd.row > this.maxLines) {
            text.replace({start: {row: this.maxLines, column: 0}, end: textEnd}, "...\n");
            if (!this.expandedContent) this.expandedContent = value;
          }
          textEnd = text.documentEndPosition;
          if (textEnd.column !== 0) text.insertText("\n", textEnd);
        }
      },

      color: {
        after: ["borderColor"],
        derived: true,
        get() {
          return this.borderColor;
        },
        set(value) {
          this.borderColor = value;
        }
      },

      submorphs: {
        after: ["extent"],
        initialize() {
          this.submorphs = [
            {
              name: "messageText",
              type: "text"
            },
            {
              name: "closeButton",
              type: "button",
              extent: pt(22, 22),
              label: Icon.makeLabel("close")
            }
          ];
          this.relayout();
          connect(this.getSubmorphNamed("closeButton"), "fire", this, "remove");
        }
      }
    };
  }

  relayout() {
    this.getSubmorphNamed("messageText").setBounds(this.innerBounds().insetBy(10));
    this.getSubmorphNamed("closeButton").topRight = this.innerBounds().topRight().addXY(-6, 6);
  }

  isEpiMorph() {
    return true;
  }
  isStatusMessage() {
    return true;
  }

  setMessage(msg, color) {
    this.message = msg;
    this.color = color;
  }

  async slideTo(pos) {
    this.sliding = this.animate({
      position: pos,
      duration: 500
    });
    await this.sliding;
    this.sliding = false;
  }

  async expand() {
    if (!this.expandable) return;
    if (this.sliding) await this.sliding;
    var world = this.world();
    if (!world || this.isMaximized) return;
    this.isMaximized = true;
    this.stayOpen = true;
    var text = this.getSubmorphNamed("messageText");
    Object.assign(text, {readOnly: false, fixedWidth: false, selectable: true});
    if (this.expandedContent) text.value = this.expandedContent;
    text.fit();
    var ext = text.extent.addXY(20, 20), visibleBounds = world.visibleBounds();
    if (ext.y > visibleBounds.extent().y) ext.y = visibleBounds.extent().y - 20;
    if (ext.x > visibleBounds.extent().x) ext.x = visibleBounds.extent().x - 20;
    ext = this.extent.maxPt(ext);
    this.animate({extent: ext, center: visibleBounds.center(), duration: 200});
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

  focus() {
    var text = this.getSubmorphNamed("messageText");
    text && text.focus();
  }

  onMouseUp(evt) {
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
  static get properties() {
    return {
      slidable: {defaultValue: false},

      // should "internal" changes in the morph we are showing the message for
      // (like cursor changes in a text morph) make this message morph disappear?
      removeOnTargetMorphChange: {defaultValue: true},

      targetMorph: {
        defaultValue: null,
        get() {
          var id = this.getProperty("targetMorph");
          return id && $world.getMorphWithId(id);
        },
        set(morph) {
          this.setProperty("targetMorph", morph ? morph.id : null);
          this.alignAtBottomOf(morph);
        }
      },

      expandable: {
        after: ["submorphs"],
        set(val) {
          this.setProperty("expandable", val);
          if (val) {
            if (!this.getSubmorphNamed("expandButton")) {
              var btn = this.addMorph({
                name: "expandButton",
                type: "button",
                extent: pt(22, 22),
                label: Icon.makeLabel("expand")
              });
              connect(btn, "fire", this, "expand");
            }
          } else {
            if (this.getSubmorphNamed("expandButton")) {
              this.getSubmorphNamed("expandButton").remove();
              disconnect(btn, "fire", this, "expand");
            }
          }
          this.relayout();
        }
      }
    };
  }

  relayout() {
    super.relayout();
    var expandBtn = this.getSubmorphNamed("expandButton");
    if (expandBtn) {
      expandBtn.topRight = this.getSubmorphNamed("closeButton").topLeft.addXY(-3, 0);
    }
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

function showLine(world, line, delay = 3000) {
  let {start, end} = line,
      vec = end.subPt(start),
      path = world.addMorph({
        position: start,
        rotation: vec.theta(),
        border: {width: 1, color: Color.red},
        width: vec.fastR(),
        height: 0
      })
  if (delay) setTimeout(() => path.fadeOut(), delay);
  return path;
}

export function showConnector(morph1, morph2, delay = 3000) {
  if (!morph1 || !morph1.world() ||!morph2 || !morph2.world()) return null;

  let p1 = morph1.owner.worldPoint(morph1.center),
      p2 = morph2.owner.worldPoint(morph2.center),
      midPoint = p1.lineTo(p2).sampleN(2)[1];

  let path = $world.addMorph(new Leash({
    vertices: [midPoint, midPoint], borderWidth: 2, 
    endpointStyle: {fill: Color.red}, borderColor: Color.red
  }))
  path.animate({vertices: [p1, p2], duration: 400});
  if (delay) setTimeout(() => path.fadeOut(), delay);
  return path;
}

class LeashEndpoint extends Ellipse {

  get dragTriggerDistance() { return this.connectedMorph ? 20 : 0 }

  onDragStart(evt) {
    let {lastDragPosition, clickedOnPosition} = evt.state;
    evt.state.dragDelta = lastDragPosition.subPt(clickedOnPosition);
    evt.state.endpoint = this;
    this.leash.onEndpointDrag(evt);
  }

  canConnectTo(m) {
    return !m.isWorld && !m.isHaloItem && this.leash.canConnectTo(m)
            && !m.isHighlighter && !m.ownerChain().some(m => m.isHaloItem)
  }
  
  onDrag(evt) {
    if (this.connectedMorph) {
      this.clearConnection();
    } else {
      var m = evt.hand.findDropTarget(
        evt.hand.position,
        [this.leash, this.leash.endPoint, this.leash.startPoint],
        m => this.canConnectTo(m)
      );
      if (this.possibleTarget != m && this.highlighter) this.highlighter.deactivate();
      this.possibleTarget = m;
      if (this.possibleTarget) {
         this.closestSide = this.possibleTarget
        .globalBounds()
        .partNameNearest(obj.keys(Leash.connectionPoints), this.globalPosition);
      this.highlighter = MorphHighlighter.for($world, this.possibleTarget, false, [this.closestSide]);
      this.highlighter.show(); 
      }
    }
    evt.state.endpoint = this;
    this.leash.onEndpointDrag(evt);
  }

  onDragEnd() {
    MorphHighlighter.removeHighlighters();
    if (this.possibleTarget && this.closestSide) {
      this.attachTo(this.possibleTarget, this.closestSide);
    }
  }

  getConnectionPoint() {
    const {isPath, isPolygon, vertices, origin} = this.connectedMorph,
          gb = this.connectedMorph.globalBounds();
    if ((isPath || isPolygon) && this.attachedSide != "center") {
      const vs = vertices.map(({x, y}) => pt(x, y).addPt(origin)),
            ib = Rectangle.unionPts(vs),
            side = ib[this.attachedSide](),
            center = ib.center().addPt(ib.center().subPt(side)),
            line = shape("line", {x1: side.x, y1: side.y, x2: center.x, y2: center.y}),
            path = shape("polyline", {points: vs.map(({x, y}) => `${x},${y}`).join(" ")}),
            {x, y} = arr.min(intersect(path, line).points, ({x, y}) => pt(x, y).dist(side));
      return pt(x, y).addPt(gb.topLeft());
    } else {
      return gb[this.attachedSide]();
    }
  }

  update(change) {
    if (change 
        && !["position", "extent", "rotation", "scale"].includes(change.prop) 
        && change.target != this.connectedMorph) return;
    if (!this.connectedMorph) return;
    const globalPos = this.getConnectionPoint(), pos = this.leash.localize(globalPos);
    this.vertex.position = pos;
    this.relayout();
  }

  clearConnection() {
    if (this.connectedMorph) {
      disconnect(this.connectedMorph, 'onChange', this, 'update');
      this.connectedMorph = null;
    }
  }

  relayout(change) {
    var anim;
    const {x, y} = this.vertex.position, bw = this.leash.borderWidth;
    //this.extent = this.pt((2*bw), (2 * bw));
    if (anim = change && change.meta.animation) {
      this.animate({center: pt(x + bw, y + bw), duration: anim.duration})
    } else {
      this.center = pt(x + bw, y + bw); 
    }
  }

  attachTo(morph, side) {
    this.clearConnection();
    this.leash.openInWorld(this.leash.position);
    this.connectedMorph = morph;
    this.attachedSide = side;
    this.vertex.controlPoints = this.leash.controlPointsFor(side, this);
    this.update();
    connect(this.connectedMorph, 'onChange', this, "update");
  }

  static get properties() {
    return {
      index: {},
      leash: {},
      nativeCursor: {defaultValue: '-webkit-grab'},
      attachedSide: {},
      connectedMorph: {},
      vertex: {
        after: ['leash'],
        get() {
          return this.leash.vertices[this.index];
        },
        set(v) {
          this.leash.vertices[this.index] = v;
          this.leash.vertices = this.leash.vertices; // this is a very akward interface
        }
      }
    };
  }
}

export class Leash extends Path {

  static get connectionPoints() {
    return {
      topCenter: pt(0, -1),
      topLeft: pt(-1, -1),
      rightCenter: pt(1, 0),
      bottomRight: pt(1, 1),
      bottomCenter: pt(0, 1),
      bottomLeft: pt(-1, 1),
      leftCenter: pt(-1, 0),
      topRight: pt(1, -1),
      center: pt(0, 0)
    }
  }
  
  static get properties() {
    return {
      start: {},
      end: {},
      canConnectTo: {
        defaultValue: m => true
      },
      reactsToPointer: {defaultValue: false},
      wantsDroppedMorphs: {defaultValue: false},
      direction: {
         type: 'Enum',
         values: ['unidirectional', 'outward', 'inward'],
         defaultValue: 'unidirectional'
      },
      endpointStyle: {
        isStyleProp: true,
        defaultValue: {
          fill: Color.black,
          origin: pt(3.5, 3.5),
          extent: pt(10, 10),
          nativeCursor: "-webkit-grab"
        }
      },
      borderWidth: {defaultValue: 2},
      borderColor: {defaultValue: Color.black},
      fill: {defaultValue: Color.transparent},
      vertices: {
        after: ["start", "end"],
        initialize() {
          this.vertices = [this.start, this.end];
        }
      },
      submorphs: {
        initialize() {
          this.submorphs = [
            (this.startPoint = this.endpoint(0)),
            (this.endPoint = this.endpoint(1))
          ];
          connect(this, "onChange", this, "relayout");
          this.updateEndpointStyles()
        }
      }
    };
  }

  onMouseDown(evt) {
    this.updateEndpointStyles();
  }

  updateEndpointStyles() {
    Object.assign(this.startPoint, this.getEndpointStyle(0));
    Object.assign(this.endPoint, this.getEndpointStyle(1));
    this.relayout();
  }

  remove() {
    super.remove();
    this.startPoint.clearConnection();
    this.endPoint.clearConnection();
  }

  onEndpointDrag(evt) {
    const pos = evt.state.endpoint.vertex.position;
    evt.state.endpoint.vertex.position = pos.addPt(evt.state.dragDelta);
    this.relayout();
  }

  getEndpointStyle(idx) {
    return {
      ...this.endpointStyle,
      ...(idx == 0 ? this.endpointStyle.start : this.endpointStyle.end)
    };
  }

  endpoint(idx) {
    const leash = this, {x, y} = leash.vertices[idx];
    return new LeashEndpoint({index: idx, leash: this, position: pt(x, y)});
  }

  controlPointsFor(side, endpoint) {
    var next = Leash.connectionPoints[side];
    next = (endpoint == this.startPoint ? next.negated() : next);
    return {previous: next.scaleBy(100), next: next.negated().scaleBy(100)};
  }

  relayout(change) {
    if (change && !['vertices', 'position'].includes(change.prop)) return;
    this.startPoint.relayout(change);
    this.endPoint.relayout(change);
  }
}


