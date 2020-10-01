import { Morph, VerticalLayout, StyleSheet, Icon, CustomLayout } from "lively.morphic";
import { Color, rect, pt } from "lively.graphics";
import { connect } from "lively.bindings";
import { Path } from "lively.lang";

let duration = 300;

export class Popover extends Morph {

  static get properties() {
    return {
      epiMorph: { defaultValue: true },
      hasFixedPosition: {defaultValue: true },
      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemWidgets/popover/light'
          }
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
          let [_1, body, btn] = this.submorphs;
          connect(btn, 'fire', this, 'close');
          connect(body, 'extent', this, 'relayout', {
            converter: '() => target.animated'
          });
          setTimeout(() => this.animated = true, 1000);
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
        topCenter: pt(0, offset),
        duration: 200,
      });
      closeBtn.animate({topRight: body.topRight.addXY(padding, -padding), duration: 200 });
    } else {
      body.topCenter = pt(0, offset);
      closeBtn.topRight = body.topRight.addXY(padding, -padding);
    }
  }

  

  close() {
    this.fadeOut(300);
  }

}