import { promise } from "lively.lang";
import { Morph } from "lively.morphic";
import { Icon } from "./icons.js";
import { pt, Rectangle, Color } from "lively.graphics";
import { connect } from "lively.bindings";


// var i = LoadingIndicator.open("test")
// i.remove()

export default class LoadingIndicator extends Morph {

  static open(label, props) {
    return new this({...props, label}).openInWorld();
  }

  static forPromise(p, label, props) {
    var i = this.open(label, props);
    promise.finally(Promise.resolve(p), () => i.remove());
    return i;
  }

  static async runFn(fn, label, props) {
    var i = this.open(label, props);
    await i.whenRendered();
    try { return await fn(); } finally { i.remove(); }
  }

  static get properties() {
    return {
      fill:       {defaultValue: Color.rgbHex("#666")},
      fontSize:   {defaultValue: 16},
      fontFamily: {defaultValue: "Arial"},
      name:       {defaultValue: "LoadingIndicator"},

      label: {
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").value; },
        set(val) { this.getSubmorphNamed("label").value = val; }
      },

      fontFamily: {
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").fontFamily; },
        set(val) { this.getSubmorphNamed("label").fontFamily = val; }
      },

      fontSize: {
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").fontSize; },
        set(val) { this.getSubmorphNamed("label").fontSize = val; }
      },

      submorphs: {
        initialize() {
          this.submorphs = [

            Icon.makeLabel("spinner", {
              name: "spinner",
              fontColor: Color.white,
              value: [["", {
                fontFamily: "FontAwesome",
                textStyleClasses: ["fa", "fa-5x", "fa-pulse"]
              }]],
              autofit: false,
              origin: pt(30,30),
              extent: pt(60,60),
              topLeft: pt(0,0),
              halosEnabled: false
            }),

            {
              type: "label",
              name: "label",
              value: "",
              fontSize: 12, fontFamily: "Arial",
              fontColor: Color.white,
              styleClasses: ["center-text"],
              halosEnabled: false
            },

            {
              type: "button",
              name: "closeButton",
              label: "X",
              fontColor: Color.white,
              activeStyle: {fill: null, borderWidth: 0},
              extent: pt(20,20),
              visible: false
            }
          ];

        }
      }
    }
  }

  constructor(props = {}) {
    super(props);
    this.relayout();
    connect(this, 'extent', this, 'relayout');
    connect(this.get("label"), 'extent', this, "relayout");
    connect(this.get("label"), 'value', this, "updateLabel");
    connect(this.get("label"), 'fontSize', this, "updateLabel");
    connect(this.get("label"), 'fontFamily', this, "updateLabel");
    connect(this.get("closeButton"), 'fire', this, "remove");
  }

  get isEpiMorph() { return true }

  updateLabel() {
    var center = this.center; this.relayout();
    setTimeout(() => this.center = center, 0);
  }

  relayout() {
    var padding = Rectangle.inset(8, 4),
        [spinner, label, closeButton] = this.submorphs,
        w = Math.max(spinner.width, label.width) + padding.left() + padding.right(),
        h = spinner.height + label.height + padding.top() + padding.bottom();
    this.extent = pt(w,h);
    closeButton.topRight = this.innerBounds().topRight();
    spinner.topCenter = this.innerBounds().topCenter().addXY(0, padding.top());
    label.topCenter = spinner.bottomCenter.addXY(0, 4);
  }

  onHoverIn(evt) { this.get("closeButton").visible = true; }
  onHoverOut(evt) { this.get("closeButton").visible = false; }
}
