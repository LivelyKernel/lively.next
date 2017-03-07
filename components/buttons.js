import { pt, Color, Rectangle } from "lively.graphics";
import { Morph } from "lively.morphic";
import { signal, disconnect, connect } from "lively.bindings";
import { obj } from "lively.lang/index.js";

// var b = new Button({label: "test", extent: pt(22,18)}).openInWorld()
// b.scale = 10
// import { Icon } from "./icons.js";
// b.label = [Icon.textAttribute("plus")]
// b.padding = Rectangle.inset(2,4,2,5); b.fit()
// b.relayout()
// b.fit()

export class Button extends Morph {

  static get properties() {
    return {
      padding:      {defaultValue: Rectangle.inset(4,2)},
      borderWidth:  {defaultValue: 1},
      extent:       {defaultValue: pt(100,24)},
      borderRadius: {defaultValue: 15},
      borderColor:  {defaultValue: Color.rgb(204,204,204)},
      draggable:    {defaultValue: false},
 
      activeMode: {
        after: ["labelMorph", "activeStyle", "inactiveStyle"],
        get() {
           return this._buttonMode || 'active'
        },
        set(m) {
           switch(m) {
             case "active":
               this.activate();
               break;
             case "inactive":
               this.deactivate();
               break;
             case "triggered":
               this.perform();
               break;
           }
           this._buttonMode = m;
        }
      },
      // button label
      labelMorph: {
        after: ["submorphs"], derived: true,
        initialize() {
          this.labelMorph = this.addMorph({
            type: "label", name: "label",
            value: "no label yet", fill: Color.white.withA(0),
            padding: Rectangle.inset(0)
          });
        },
        get() { return this.getSubmorphNamed("label"); },
        set(labelMorph) {
          var existing = this.labelMorph;
          if (existing) {
            disconnect(this.labelMorph, "extent", this, "relayout");
            existing.remove();
          }
          labelMorph.name = "label";
          labelMorph.reactsToPointer = false;
          this.addMorphAt(labelMorph, 0);
          connect(this.labelMorph, 'extent', this, 'relayout');
        }
      },

      label: {
        after: ["labelMorph"], derived: true,
        get() { return this.labelMorph.textString; },
        set(stringOrAttributesOrMorph) {
          if (stringOrAttributesOrMorph.isMorph) {
            this.labelMorph = stringOrAttributesOrMorph;
          } else {
            this.labelMorph.value = stringOrAttributesOrMorph;
          }
        }
      },

      fontFamily: {
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontFamily; },
        set(fontFamily) {
          this.labelMorph.fontFamily = fontFamily;
        }
      },

      fontSize: {
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontSize; },
        set(fontSize) {
          this.labelMorph.fontSize = fontSize;
        }
      },

      fontStyle: {
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontStyle; },
        set(fontStyle) {
          this.labelMorph.fontStyle = fontStyle;
        }
      },

      fontColor: {
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontColor; },
        set(fontColor) {
          this.labelMorph.fontColor = fontColor;
        }
      },

      labelWithTextAttributes: {
        after: ["labelMorph"], derived: true,
        get() { return this.labelMorph.textAndAttributes; },
        set(val) { this.labelMorph.textAndAttributes = val; }
      },

      // button styles
      defaultActiveStyle: {
        defaultValue: {
          borderColor: Color.gray,
          fill: Color.rgb(240, 240, 240),
          fontColor: Color.almostBlack,
          nativeCursor: "pointer"
        }
      },
      activeStyle: {
        after: ["labelMorph", "fontSize", "fontColor", "fontFamily"],
        initialize() { this.activeStyle = obj.clone(this.defaultActiveStyle); },
        set(value) {
          this.setProperty("activeStyle", {
            ...this.defaultActiveStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
          if (this.isActive) this.updateButtonStyle(this.activeStyle);
        }
      },

      defaultInactiveStyle: {
        defaultValue: {
          borderColor: Color.gray.withA(0.5),
          fill: Color.rgba(240, 240, 240, 0.5),
          fontColor: Color.almostBlack.withA(0.5),
          nativeCursor: "not-allowed"
        }
      },
      inactiveStyle: {
        after: ["labelMorph", "fontSize", "fontColor", "fontFamily"],
        initialize() { this.inactiveStyle = obj.clone(this.defaultInactiveStyle); },
        set(value) {
          this.setProperty("inactiveStyle", {
            ...this.defaultInactiveStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
          if (this.activeMode == 'inactive') this.updateButtonStyle(this.inactiveStyle);
        }
      },

      defaultTriggerStyle: {
        defaultValue: {fill: Color.rgb(161,161,161)}
      },
      triggerStyle: {
        after: ["labelMorph", "fontSize", "fontColor", "fontFamily"],
        initialize() { this.triggerStyle = obj.clone(this.defaultTriggerStyle); },
        set(value) {
          this.setProperty("triggerStyle", {
            ...this.defaultTriggerStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
          if (this.activeMode == 'triggered') this.updateButtonStyle(this.triggerStyle);
        }
      }

    }
  }

  constructor(props) {
    super(props);
    this.updateButtonStyle(this.activeStyle)
    this.activeMode = 'active';
    this.relayout();
    connect(this, 'extent', this, 'relayout');
    connect(this, 'padding', this, 'relayout');
    connect(this, 'fontSize', this, 'relayout');
    connect(this, 'fontFamily', this, 'relayout');
  }

  get isButton() { return true }

  relayout() {
    var label = this.labelMorph;
    if (!label) return;
    var padding = this.padding,
        padT = padding.top(),
        padB = padding.bottom(),
        padL = padding.left(),
        padR = padding.right(),
        minHeight = label.height + padT + padB,
        minWidth = label.width + padL + padR;
    if (minHeight > this.height) this.height = minHeight;
    if (minWidth > this.width) this.width = minWidth;
    // label.center = pt(padL + label.width/2, padT + label.height/2);
    label.center = this.innerBounds().insetByRect(padding).center();
    return this;
  }

  updateButtonStyle(style) {
    Object.assign(this, style);
    this.labelMorph.nativeCursor = this.nativeCursor;
  }

  fit() {
    var padding = this.padding, label = this.labelMorph;
    label.fit();
    this.extent = padding.bottomLeft().addPt(padding.bottomRight()).addPt(label.extent);
    this.relayout();
    return this;
  }

  get isActive() {
    return this.activeMode == 'active'
  }

  get buttonStyleProps() {
    return ["fontStyle", "fontColor", "fontSize", "fontFamily", 
            ...Object.keys(obj.dissoc(Morph.properties, [
              'name', 'position', 'extent', 'scale', 'rotation', 'visible'
            ]))]
  }

  cacheStyle() {
     const modeToCache = {
             inactive: 'inactiveStyle',
             active: 'activeStyle',
             triggered: 'triggerStyle'
           },
           cachedStyle = obj.select(this, this.buttonStyleProps);
    this[modeToCache[this.activeMode]] = cachedStyle;
  }

  activate() {
    this.cacheStyle();
    this.updateButtonStyle(this.activeStyle)
  }

  deactivate() {
    this.cacheStyle();
    this.updateButtonStyle(this.inactiveStyle)
  }

  perform() {
    this.cacheStyle();
    this.updateButtonStyle(this.triggerStyle)
  }

  trigger() {
    try {
      signal(this, "fire");
      typeof this.action == "function" && this.action();
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown(evt) {
    if (this.isActive)
      this.activeMode = 'triggered'
  }

  onMouseUp(evt) {
    if (evt.isClickTarget(this) && this.activeMode == 'triggered') {
      this.activeMode = 'active';
      this.trigger();
    }
  }

  onHoverOut(evt) {
    // When leaving the button without mouse up, reset appearance
    if (this.activeMode == 'triggered' && evt.isClickTarget(this))
      this.activeMode = 'active';
  }

  onHoverIn(evt) {
    if (this.isActive && evt.isClickTarget(this))
      this.activeMode = 'triggered';
  }

}
