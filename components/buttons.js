import { pt, LinearGradient, Color, Rectangle } from "lively.graphics";
import { Morph, StyleSheet } from "lively.morphic";
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

  static get styleSheet() {
    return new StyleSheet('Button Style', {
      ".Button": {borderWidth: 1, borderRadius: 5, padding: Rectangle.inset(4,2)},
      ".Button.activeStyle": {
        borderColor: Color.gray,
        fill: new LinearGradient({
          stops: [{offset: 0, color: Color.white}, {offset: 1, color: new Color.rgb(236, 240, 241)}]
        }),
        nativeCursor: "pointer"
      },
      ".Button.triggerStyle": {
        borderColor: Color.gray,
        fill: Color.rgb(161, 161, 161),
        nativeCursor: "pointer"
      },
      ".Button.inactiveStyle": {
        borderColor: Color.gray,
        opacity: .5,
        fill: new LinearGradient({
          stops: [{offset: 0, color: Color.white}, {offset: 1, color: new Color.rgb(236, 240, 241)}]
        }),
        nativeCursor: "not-allowed"
      },
      ".Button.activeStyle [name=label]": {fontSize: 12, fontColor: Color.almostBlack},
      ".Button.triggerStyle [name=label]": {fontSize: 12, fontColor: Color.almostBlack},
      ".Button.inactiveStyle [name=label]": {fontSize: 12, fontColor: Color.almostBlack.withA(0.5)}
    });
  }

  static get properties() {
    return {
      padding: {isStyleProp: true, defaultValue: Rectangle.inset(4,2)},
      draggable:    {defaultValue: false},
      extent: {defaultValue: pt(100,20)},
      
      fontSize: {
        type: "Number",
        min: 0,
        isStyleProps: true,
        defaultValue: 12,
        after: ['labelMorph', 'iconMorph'],
        set(s) {
          this.setProperty('fontSize', s);
          this.labelMorph.fontSize = s;
          this.iconMorph && (this.iconMorph.fontSize = s);
        }
      },

      fontColor: {
        isStyleProps: true,
        defaultValue: Color.black,
        after: ['labelMorph', 'iconMorph'],
        set(c) {
          this.setProperty('fontColor', c);
          this.labelMorph.fontColor = c;
          this.iconMorph && (this.iconMorph.fontColor = c);
        }
      },

      activeMode: {
        after: ["labelMorph"],
        type: 'Enum',
        values: ['active', 'inactive', 'triggered'],
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
      iconMorph: {
        after: ['submorphs'],
        initialize() {
          this.iconMorph = this.addMorph({
            type: "label", name: "icon",
            value: ""
          });
        },
        get() { return this.getSubmorphNamed('icon') },
        set(iconMorph) {
          var existing = this.iconMorph;
          if (existing) {
            disconnect(this.iconMorph, "extent", this, "relayout");
            existing.remove();
          }
          if (!iconMorph) return;
          iconMorph.name = "icon";
          iconMorph.reactsToPointer = false;
          this.addMorphAt(iconMorph, 0);
          connect(this.iconMorph, 'extent', this, 'relayout');
        }
      },
      // button label
      labelMorph: {
        after: ["submorphs"],
        initialize() {
          this.labelMorph = this.addMorph({
            type: "label", name: "label",
            value: "no label yet"
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
        after: ['labelMorph', 'iconMorph'], 
        isStyleProp: true,
        type: "Icon", // "" -> no icon, else a valid font awesome icon code
        initialize() {
          this.icon = "";
        },
        set(codeOrIconMorph) {
          this.setProperty('icon', codeOrIconMorph);
          if (!this.iconMorph) {
            this.iconMorph = this.addMorph({
              type: "label",
              name: "icon",
              value: ""
            });
          }
          if (codeOrIconMorph && codeOrIconMorph.isMorph) {
            this.iconMorph = codeOrIconMorph;
          } else {
            this.iconMorph.value = codeOrIconMorph || "";
          }
        }
      },

      iconPosition: {
        defaultValue: "left",
        type: "Enum",
        values: ["left", "right", "bottom", "top"]
      },

      label: {
        after: ["labelMorph"], 
        isStyleProp: true,
        type: "RichText", // this includes an attributes Array
        set(stringOrAttributesOrMorph) {
          if (stringOrAttributesOrMorph.isMorph) {
            this.setProperty('label', stringOrAttributesOrMorph.value)
            this.labelMorph = stringOrAttributesOrMorph;
          } else {
            this.setProperty('label', stringOrAttributesOrMorph)
            this.labelMorph.value = stringOrAttributesOrMorph;
          }
        }
      },

      labelWithTextAttributes: {
        after: ["labelMorph"], derived: true,
        get() { return this.labelMorph.textAndAttributes; },
        set(val) { this.labelMorph.textAndAttributes = val; }
      }
    }
  }

  constructor(props) {
    super(props);
    this.activeMode = 'active';
    this.relayout();
    connect(this, 'extent', this, 'relayout');
    connect(this, 'iconPosition', this, 'relayout');
    connect(this, 'padding', this, 'relayout');
    connect(this, 'fontSize', this, 'relayout');
    connect(this, 'fontFamily', this, 'relayout');
  }

  get isButton() { return true }

  relayout() {
    var label = this.labelMorph,
        icon = this.iconMorph;
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
    let innerPadding = this.innerBounds().insetByRect(padding);
    label.center = innerPadding.center();
    if (!icon || !this.iconMorph.value) return this;
    switch (this.iconPosition) {
      case 'left':
        label.rightCenter = innerPadding.rightCenter();
        icon.rightCenter = label.leftCenter;
        return this;
      case 'right':
        label.leftCenter = innerPadding.leftCenter();
        icon.leftCenter = label.rightCenter;
        return this;
      case 'top':
        label.bottomCenter = innerPadding.bottomCenter();
        icon.bottomCenter = label.topCenter;
        return this;
      case 'bottom':
        label.topCenter = innerPadding.topCenter();
        icon.topCenter = label.bottomCenter;  
        return this;        
    }
    return this;
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

  async interactivelyChangeLabel() {
    let newLabel = await this.world().prompt("edit button label", {
      input: this.labelMorph.textString,
      historyId: "lively.morphic-button-edit-label-hist"
    });
    if (typeof newLabel === "string")
      this.label = newLabel;
  }

  menuItems() {
    let items = super.menuItems();

    items.unshift({isDivider: true});
    items.unshift(["change label", () => this.interactivelyChangeLabel()]);

    return items;
  }
}
