/* global System */
import { promise } from "lively.lang";
import { Icon, morph, Morph, StyleSheet, Image } from "lively.morphic";
import { pt, Rectangle, Color } from "lively.graphics";
import { connect } from "lively.bindings";

export default class LoadingIndicator extends Morph {

  static get styleSheet() {
    return new StyleSheet({
      ".LoadingIndicator [name=progressBar]": {
        clipMode: 'hidden',
        height: 4,
        borderRadius: 4,
        fill: Color.gray.darker()
      },
      ".LoadingIndicator [name=progressBar] [name=progress]": {
        height: 4,
        fill: Color.orange
      },
      ".LoadingIndicator [name=spinner]": {
        fill: Color.transparent,
        position: pt(0, 0),
        halosEnabled: false
      },
      ".LoadingIndicator .center-text": {
        fontSize: 16,
        fontColor: Color.white,
        halosEnabled: false
      },
      ".LoadingIndicator [name=closeButton] [name=label]": {
        fontColor: Color.white,
        fontFamily: "FontAwesome"
      },
      ".LoadingIndicator [name=closeButton]": {
        extent: pt(20, 20),
        fill: Color.transparent,
        borderWidth: 0,
        fontColor: Color.white,
      }
    });
  }

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
    try { return await fn(i); } finally { i.remove(); }
  }

  static get properties() {
    return {
      fill:       {defaultValue: Color.black.withA(.6)},
      name:       {defaultValue: "LoadingIndicator"},
      borderRadius: {defaultValue: 10},
      styleClasses: {defaultValue: ['Halo']},
      progress: {
        defaultValue: false,
        set(p) {
          this.animateProgress(p);
        }
      },
      label: {
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").value; },
        set(val) { this.getSubmorphNamed("label").value = val; }
      },

      fontFamily: {
        defaultValue: "Arial",
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").fontFamily; },
        set(val) { this.getSubmorphNamed("label").fontFamily = val; }
      },

      fontSize: {
        defaultValue: 16,
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").fontSize; },
        set(val) { this.getSubmorphNamed("label").fontSize = val; }
      },

      loadingImage: {
        defaultValue: System.decanonicalize("lively.morphic/") + "lively-web-logo-small-animate.svg"
      },

      submorphs: {
        initialize() {
          let spinner;
          this.submorphs = [
            spinner = new Image({
              extent: pt(100, 104),
              imageUrl: this.loadingImage,
              name: "spinner"
            }),
            {
              type: "label",
              name: "label",
              value: "",
              styleClasses: ["center-text"]
            },
            {
              type: "button",
              name: "closeButton",
              label: Icon.textAttribute("times")
            }
          ];
          // if (bowser.name == 'Firefox') {
          //   spinner.extent = pt(55,55);
          //   spinner.origin = pt(25,25);
          //   spinner.scale = 2;
          // }
        }
      }
    };
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
    this.get("closeButton").fit();
  }

  get isEpiMorph() { return true; }

  updateLabel() {
    var center = this.center; this.relayout();
    this.center = center;
  }

  animateProgress(p /* between 0-1*/) {
    let pb = this.get('progressBar') || this.addMorph({
      name: 'progressBar', submorphs: [{name: 'progress', width: 0}]
    })
    pb.get('progress').animate({width: p * pb.width, duration: 300});
    this.relayout();
  }

  relayout() {
    var padding = Rectangle.inset(20, 12),
        [spinner, label, closeButton, progressBar] = this.submorphs,
        w = Math.max(spinner.width, label.width, 120) + padding.left() + padding.right(),
        h = ((progressBar && progressBar.height + 5) || 0 )
            + spinner.bounds().height + label.height + padding.top() + padding.bottom();
    this.extent = pt(w,h);
    spinner.topCenter = this.innerBounds().topCenter().addXY(0, padding.top());
    label.topCenter = spinner.bottomCenter.addXY(0, 4);
    if (progressBar) {
      progressBar.topCenter = label.bottomCenter.addXY(0, 4);
      progressBar.width = this.width - 20;
    }
    closeButton.right = w;
  }
  
  onHoverIn(evt) { this.get("closeButton").visible = true; }
  onHoverOut(evt) { this.get("closeButton").visible = false; }
}
