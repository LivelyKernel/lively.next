import { Morph, VerticalLayout, StyleSheet, Icon, CustomLayout } from "lively.morphic";
import { Color, rect, pt } from "lively.graphics";
import { connect } from "lively.bindings";

let duration = 300;

export class Popover extends Morph {

  static get properties() {
    return {
      epiMorph: { defaultValue: true },
      hasFixedPosition: {defaultValue: true },
      popoverColor: {
        defaultValue: Color.rgbHex('c9c9c9'),
        set(v) {
          this.setProperty('popoverColor', v);
          this.updateStyleSheet();
        }
      },

      targetMorph: {
        derived: true,
        after: ['submorphs'],
        defaultValue: {
          extent: pt(200, 200),
          fill: Color.transparent,
          submorphs: [
            {
              name: "placeholder",
              type: "label",
              value: "No Target Specified"
            }
          ]
        },
        get() { return this.get('body').submorphs[0]; },
        set(m) {
          this.get('body').addMorph(m);
          this.whenRendered().then(() => this.relayout());
        }
      },

      styleSheets: {
        initialize() {
          this.updateStyleSheet();
        }
      },

      layout: {
        initialize() {
          this.layout = new CustomLayout({
            relayout(self, animated) { self.relayout(animated); }
          });
          this.whenRendered().then(() => {
            this.layout.reactToSubmorphAnimations = true
          })
        }
      },

      submorphs: {
        initialize() {
          this.submorphs = [
            {
              type: "polygon",
              name: "arrow",
              topCenter: pt(0,0),
              borderColor: Color.transparent,
              vertices: [pt(-10, 0), pt(0, -15), pt(10, 0)]
            },
            {name: "body"},
            {
              name: "close button",
              type: "button",
              label: Object.assign(Icon.makeLabel("times-circle"), {fontSize: 18}),
              tooltip: "close",
              fill: null,
              extent: pt(16,16),
              borderColor: Color.transparent,
            }
          ];
          let [_1, _2, btn] = this.submorphs;
          connect(btn, 'fire', this, 'close');
        }
      }
    };
  }

  relayout(animated) {
    let body = this.get("body"),
        arrow = this.get("arrow"),
        closeBtn = this.get("close button"),
        offset = arrow.height,
        padding = 8;

    if (animated) {
      body.animate({
        extent: body.submorphBounds().extent(), 
        topCenter: pt(0, offset),
        duration
      });
      closeBtn.animate({topRight: body.topRight.addXY(padding, -padding), duration});
    } else {
      body.extent = body.submorphBounds().extent();
      body.topCenter = pt(0, offset);
      closeBtn.topRight = body.topRight.addXY(padding, -padding);
    }
  }

  updateStyleSheet() {
    this.styleSheets = new StyleSheet({
      ".Popover": {
        //dropShadow: true,
        fill: Color.transparent,
        borderRadius: 4
      },
      "[name=body]": {
        layout: new VerticalLayout({resizeContainer: true, reactToSubmorphAnimations: true}),
        fill: this.popoverColor,
        dropShadow: true,
        borderRadius: 4,
        clipMode: "hidden"
      },
      ".controlName": {
          fontSize: 14,
          padding: rect(0, 3, 0, 0),
          opacity: 0.5,
          fontWeight: 'bold'
        },
      ".NumberWidget": {
        padding: rect(5, 3, 0, 0),
        borderRadius: 3,
        borderWidth: 1,
        borderColor: Color.gray
      },
      "[name=arrow]": {
        fill: this.popoverColor.isGradient ?
          this.popoverColor.stops[0].color : this.popoverColor,
        dropShadow: {blur: 3, color: Color.black.withA(0.4)},
        draggable: false
      },
    });
  }

  close() {
    this.fadeOut(300);
  }

}