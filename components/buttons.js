import { pt, Color, Rectangle } from "lively.graphics";
import { Morph, StyleRules } from "lively.morphic";
import { signal, disconnect, connect } from "lively.bindings";
import { obj, arr } from "lively.lang/index.js";

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
            value: "no label yet", fill: Color.transparent,
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

      icon: {
        after: ['labelMorph'], derived: true,
        initialize() {
          this.iconMorph = this.addMorph({
            type: "label", name: "iconMorph",
            value: "", fill: Color.transparent,
            padding: Rectangle.inset(0)
          });
        },
        get() { return this.iconMorph.textString },
        set(codeOrIconMorph) {
          if (codeOrIconMorph.isMorph) {
            this.iconMorph = codeOrIconMorph;
          } else {
            this.labelMorph.value = codeOrIconMorph;
          }
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
        isStyleProp: true,
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontFamily; },
        set(fontFamily) {
          this.labelMorph.fontFamily = fontFamily;
        }
      },

      fontSize: {
        isStyleProp: true,
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontSize; },
        set(fontSize) {
          this.labelMorph.fontSize = fontSize;
        }
      },

      fontStyle: {
        isStyleProp: true,
        after: ["label"],
        derived: true,
        get() { return this.labelMorph.fontStyle; },
        set(fontStyle) {
          this.labelMorph.fontStyle = fontStyle;
        }
      },

      fontColor: {
        isStyleProp: true,
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
      
      styleRules: {
        after: ['activeStyle', 'triggerStyle', 'inactiveStyle'],
        initialize() {
          this.styleRules = this.styleRules;
        },
        get() {
          return new StyleRules({
             activeStyle: this.activeStyle,
             triggerStyle: this.triggerStyle,
             inactiveStyle: this.inactiveStyle
          }, this);
        }
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
        initialize() { this.activeStyle = {...this.defaultActiveStyle}; },
        set(value) {
          this.setProperty("activeStyle", {
            ...this.defaultActiveStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value
          });
          this.updateStyleSheets();
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
        initialize() { this.inactiveStyle = {...this.defaultInactiveStyle}; },
        set(value) {
          this.setProperty("inactiveStyle", {
            ...this.defaultInactiveStyle,
            ...obj.select(this, ["fontSize", "fontFamily", "fontColor"]),
            ...value,
          });
          this.updateStyleSheets();
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
          this.updateStyleSheets();
        }
      }

    }
  }

  updateStyleSheets() {
    if (this.triggerStyle && this.activeStyle && this.inactiveStyle) {
       this.styleRules = this.styleRules;
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

  activate() {
    let classes = arr.withoutAll(this.styleClasses, ['inactiveStyle', 'triggerStyle'])
    this.styleClasses = [...classes, 'activeStyle'];
  }

  deactivate() {
    let classes = arr.withoutAll(this.styleClasses, ['activeStyle', 'triggerStyle'])
    this.styleClasses = [...classes, 'inactiveStyle'];
  }

  perform() {
    let classes = arr.withoutAll(this.styleClasses, ['inactiveStyle', 'activeStyle'])
    this.styleClasses = [...classes, 'triggerStyle'];
  }

  enable() { this.activeMode = "active"; }

  disable() { this.activeMode = "inactive"; }

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
    if (this.isActive && this.innerBoundsContainsPoint(evt.positionIn(this)))
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
