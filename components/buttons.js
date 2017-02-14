
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

      active: {
        after: ["labelMorph", "activeStyle", "inactiveStyle"],
        defaultValue: true
      },

      fontFamily: {
        after: ["active"],
        derived: true,
        get() { return this.labelMorph.fontFamily; },
        set(fontFamily) {
          var style = this.active ? this.activeStyle : this.inActiveStyle;
          style.fontFamily = fontFamily;
          this.labelMorph.fontFamily = fontFamily;
        }
      },

      fontSize: {
        after: ["active"],
        derived: true,
        get() { return this.labelMorph.fontSize; },
        set(fontSize) {
          var style = this.active ? this.activeStyle : this.inActiveStyle;
          style.fontSize = fontSize;
          this.labelMorph.fontSize = fontSize;
        }
      },

      fontColor: {
        after: ["active"],
        derived: true,
        get() { return this.labelMorph.fontColor; },
        set(fontColor) {
          var style = this.active ? this.activeStyle : this.inActiveStyle;
          style.fontColor = fontColor;
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
        after: ["labelMorph"],
        initialize() { this.activeStyle = obj.clone(this.defaultActiveStyle); },
        set(value) {
        console.log(value)
          this.setProperty("activeStyle", {
            ...this.defaultActiveStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
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
        after: ["labelMorph"],
        initialize() { this.inactiveStyle = obj.clone(this.defaultInactiveStyle); },
        set(value) {
          this.setProperty("inactiveStyle", {
            ...this.defaultInactiveStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
        }
      },

      defaultTriggerStyle: {
        defaultValue: {fill: Color.rgb(161,161,161)}
      },
      triggerStyle: {
        after: ["labelMorph"],
        initialize() { this.triggerStyle = obj.clone(this.defaultTriggerStyle); },
        set(value) {
          this.setProperty("triggerStyle", {
            ...this.defaultTriggerStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
        }
      }

    }
  }

  constructor(props) {
    super(props);
    this.updateButtonStyle();
    this.relayout();
    connect(this, 'extent', this, 'relayout');
    connect(this, 'padding', this, 'relayout');
    connect(this, 'fontSize', this, 'relayout');
    connect(this, 'fontFamily', this, 'relayout');
    connect(this, 'active', this, 'updateButtonStyle');
    connect(this, 'activeStyle', this, 'updateButtonStyle');
    connect(this, 'inactiveStyle', this, 'updateButtonStyle');
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

  updateButtonStyle() {
    var isActive = this.active;
    Object.assign(this, isActive ? this.activeStyle : this.inactiveStyle);
    this.labelMorph.nativeCursor = this.nativeCursor;
  }

  fit() {
    var padding = this.padding, label = this.labelMorph;
    label.fit();
    this.extent = padding.bottomLeft().addPt(padding.bottomRight()).addPt(label.extent);
    this.relayout();
    return this;
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
    if (this.active)
      Object.assign(this, this.triggerStyle);
  }

  onMouseUp(evt) {
    if (evt.isClickTarget(this) && this.active) {
      Object.assign(this, this.activeStyle);
      this.trigger();
    }
  }

  onHoverOut(evt) {
    // When leaving the button without mouse up, reset appearance
    if (this.active && evt.isClickTarget(this))
      Object.assign(this, this.activeStyle);
  }

  onHoverIn(evt) {
    if (this.active && evt.isClickTarget(this))
      Object.assign(this, this.triggerStyle);
  }

}
