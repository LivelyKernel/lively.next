import { Morph, Icon } from "lively.morphic";
import { Rectangle, LinearGradient, Color, pt } from "lively.graphics";
import { signal } from "lively.bindings";

// let b = new Button().openInWorld()

export class Button extends Morph {

  static get properties() {

    return {
      padding: {isStyleProp: true, defaultValue: Rectangle.inset(4,2)},
      draggable: {defaultValue: false},
      extent: {defaultValue: pt(100,20)},
      borderColor: {defaultValue: Color.gray},
      borderWidth: {defaultValue: 1},
      borderRadius: {defaultValue: 5},
      nativeCursor: {defaultValue: "pointer"},

      fill: {
        defaultValue: new LinearGradient({
          stops: [
            {offset: 0, color: Color.white},
            {offset: 1, color: Color.rgb(236, 240, 241)}
          ], vector: 0})
      },

      deactivated: {
        group: "button",
        defaultValue: false,
        set(val) {
          this.setProperty("deactivated", val);
          this.nativeCursor = val ? "not-allowed" : "pointer";
          this.labelMorph.opacity = val ? 0.6 : 1;
        }
      },

      pressed: {
        group: "_internal",
        defaultValue: null,
        set(val) {
          let oldVal = this.getProperty("pressed");
          this.setProperty("pressed", val);
          let realFill = (!val && oldVal && oldVal.originalFill);
          this.fill = val && realFill ? realFill.darker() : realFill;
        }
      },

      fontSize: {
        group: "button styling",
        type: "Number", min: 4, isStyleProp: true, defaultValue: 12,
        after: ['labelMorph'],
        set(s) {
          this.setProperty('fontSize', s);
          this.labelMorph.fontSize = s;
        }
      },

      fontColor: {
        group: "button styling",
        isStyleProp: true, defaultValue: Color.almostBlack, after: ['labelMorph'],
        set(c) {
          this.setProperty('fontColor', c);
          this.labelMorph.fontColor = c;
        }
      },

      labelMorph: {
        group: "_internal",
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
          if (existing) existing.remove();
          labelMorph.name = "label";
          labelMorph.reactsToPointer = false;
          this.addMorphAt(labelMorph, 0);
        }
      },

      labelWithTextAttributes: {
        group: "_internal",
        after: ["labelMorph"], derived: true,
        get() { return this.labelMorph.textAndAttributes; },
        set(val) { this.labelMorph.textAndAttributes = val; }
      },

      icon: {
        group: "button",
        after: ['labelMorph'], derived: true, isStyleProp: true,
        showInInspector: true,
        type: "Icon", // "" -> no icon, else a valid font awesome icon code
        get() { return this.label[0]; },
        set(iconNameOrCode) {
          try {
            if (Array.isArray(iconNameOrCode)) this.label = iconNameOrCode;
            else this.label = Icon.textAttribute(iconNameOrCode);
          } catch (err) {}
        }
      },

      label: {
        group: "button",
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
          this.labelMorph.fit();
        }
      },

      fire: {
        group: "button", derived: true, readOnly: true, isSignal: true
      }

    }
  }

  get isButton() { return true }

  enable() { this.deactivated = false; }

  disable() { this.deactivated = true; }

  onChange(change) {
    let {prop} = change;
    if (this.label/*don't call too early*/) {
      switch (prop) {
        case 'extent':
        case 'padding':
        case 'fontSize':
        case 'fontFamily': this.relayout();
      }
    }
    return super.onChange(change);
  }

  onSubmorphChange(change, submorph) {
    if (submorph === this.labelMorph && change.prop === "extent") this.relayout();
    return super.onSubmorphChange(change, submorph);
  }

  relayout() {
    var label = this.labelMorph;
    if (!label || this._relayouting) return;
    this._relayouting = true;
    try {
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
    } finally { this._relayouting = false; }
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
    if (!evt.isAltDown() && !this.deactivated
     && this.innerBoundsContainsPoint(evt.positionIn(this)))
      this.pressed = {originalFill: this.fill};
  }

  onMouseUp(evt) {
    if (evt.isClickTarget(this) && this.pressed) {
      this.trigger();
      this.pressed = null;
    }
  }

  onHoverOut(evt) {
    // When leaving the button without mouse up, reset appearance
    if (this.pressed && evt.isClickTarget(this)) this.pressed = null;
  }
  
  onHoverIn(evt) {
    if (!this.deactivated && evt.isClickTarget(this))
      this.pressed = this.pressed = {originalFill: this.fill};
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
