/* global System */
import { promise } from "lively.lang";
import { Icon, VerticalLayout, ShadowObject, HorizontalLayout, morph, Morph, StyleSheet, Image } from "lively.morphic";
import { pt, RadialGradient, rect, Rectangle, Color } from "lively.graphics";
import { connect } from "lively.bindings";
import { Line } from 'https://raw.githubusercontent.com/kimmobrunfeldt/progressbar.js/master/dist/progressbar.min.js'

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
        borderWidth: 0,
        fontColor: Color.white,
      }
    });
  }

  static open(label, props) {
    return morph({...loadingIndicatorSpec, ...props, label}).openInWorld();
    //return new this({...props, label}).openInWorld();
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
      layout: {
        initialize() {
          this.layout = new VerticalLayout({
            align: 'center', spacing: 10
          });
        }
      },
      ui: {
        derived: true,
        get() {
          return {
            progressBar: this.getSubmorphNamed('progressBar'),
            closeButton: this.getSubmorphNamed('closeButton'),
            spinner: this.getSubmorphNamed('spinner'),
            label: this.getSubmorphNamed('label'),
            status: this.getSubmorphNamed('status')
          }
        }
      },
      progress: {
        derived: true,
        set(p) {
          this.animateProgress(p);
        }
      },
      label: {
        derived: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label").value; },
        set(val) { this.getSubmorphNamed("label").value = val; }
      },
      status: {
        derived: true, after: ['submorphs'], defaultValue: false,
        get() { return this.getSubmorphNamed('status').value; },
        set(val) { 
          let { status, label } = this.ui;
          if (val) {
            status.visible = true;
            status.top = label.height;
            status.value = val;
          } else {
            status.visible = false;
            status.bottom = label.height;
            status.value = '';
          }
        }
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
              extent: pt(140, 104),
              imageUrl: this.loadingImage,
              name: "spinner"
            }),
            {
              type: "label",
              name: "label",
              value: "",
              fontColor: Color.white,
              fontFamily: 'Nunito'
            },
            {
              type: "button",
              name: "closeButton",
              isLayoutable: false,
              label: Icon.textAttribute("times")
            }
          ];
        }
      }
    };
  }

  constructor(props = {}) {
    super(props);
    let { label, closeButton, progressBar } = this.ui;
    if (progressBar) {
      progressBar.opacity = 0;
      progressBar.isLayoutable = false;
    }
    connect(this, 'extent', this, 'relayout');
    connect(label, 'extent', this, "relayout");
    connect(label, 'value', this, "updateLabel");
    connect(label, 'fontSize', this, "updateLabel");
    connect(label, 'fontFamily', this, "updateLabel");
    connect(closeButton, 'fire', this, "remove");
    closeButton.fit();
    this.relayout();
  }

  async animateProgress(p) {
    let pb = this.getSubmorphNamed('progressBar');
    if (!pb) {
      this.addMorph({
        name: 'progressBar', type: 'html', fill: Color.transparent, height: 5, borderRadius: 5,
        clipMode: 'hidden', opacity: 0
      });
      await pb.whenRendered();
    }
    if (!this.progressBar) {
      this.progressBar = new Line(pb.domNode, {
        strokeWidth: 4,
        easing: 'easeInOut',
        duration: 1400,
        color: Color.orange,
        trailColor: Color.darkGray,
        trailWidth: 4,
        svgStyle: {position: 'absolute', width: '100%', height: '100%'}
      });
    }
    let { progressBar } = this.ui;
    let center = this.center;
    if (p == false) {
      progressBar.isLayoutable = false;
      progressBar.opacity = 0;
    } else {
      progressBar.isLayoutable = true;
      progressBar.opacity = 1; 
    }
    if (this.progressBar) {
      if (this.progressBar.value() > p) this.progressBar.set(p);
      else this.progressBar.animate(p);
    }
    await this.whenRendered();
    this.center = center;
  }

  get isEpiMorph() { return true; }

  updateLabel() {
    var center = this.center; this.relayout();
    this.center = center;
  }

  relayout() {
    var padding = Rectangle.inset(20, 12),
        {spinner, label, closeButton, progressBar} = this.ui;
    closeButton.topRight = this.innerBounds().insetBy(2).topRight();
  }
  
  onHoverIn(evt) { this.ui.closeButton.visible = true; }
  onHoverOut(evt) { this.ui.closeButton.visible = false; }
}

let loadingIndicatorSpec = {
  dropShadow: new ShadowObject({
    distance:2,
    rotation:45,
    color:Color.rgba(0,0,0,0.62),
    inset:false,
    blur:28,
    spread:0,
    fast:true
  }),
  clipMode: 'hidden',
  extent: pt(309.625,89.96256321724826),
  fill: Color.rgba(0,0,0,0.65),
  layout: new VerticalLayout({
    spacing:15,
    resizeSubmorphs:false,
    autoResize:true,
    align:"left",
    direction:"topToBottom",
    reactToSubmorphAnimations:false
  }),
  name: "loading indicator",
  position: pt(193.6527343749999,341.3359375),
  submorphs: [{
      borderRadius: 6,
      clipMode: "hidden",
      extent: pt(279.625,6.99609375),
      fill: Color.rgba(255,255,255,0),
      html: "<svg viewBox=\"0 0 100 4\" preserveAspectRatio=\"none\" style=\"position: absolute; width: 100%; height: 100%;\"><path d=\"M 0,2 L 100,2\" stroke=\"#eee\" stroke-width=\"4\" fill-opacity=\"0\"></path><path d=\"M 0,2 L 100,2\" stroke=\"rgb(255,153,0)\" stroke-width=\"4\" fill-opacity=\"0\" style=\"stroke-dasharray: 100, 100; stroke-dashoffset: 100;\"></path></svg>",
      name: "progressBar",
      isLayoutable: false,
      position: pt(15,67.96646946724826),
      type: "html"
    }, {
      draggable: false,
      extent: pt(153.1222655103119,37.96646946724826),
      fill: Color.rgba(46,75,223,0),
      layout: new HorizontalLayout({"spacing":0,"resizeSubmorphs":false,"autoResize":true,"align":"center","direction":"leftToRight","reactToSubmorphAnimations":false}),
      name: "rectangle",
      position: pt(15,15),
      submorphs: [{
          cssDeclaration: `
           .lds-spinner {
            color: official;
            display: inline-block;
            position: relative;
            width: 64px;
            height: 64px;
          }
          .lds-spinner div {
            transform-origin: 32px 32px;
            animation: lds-spinner .6s linear infinite;
          }
          .white-spinner div:after {
            content: " ";
            display: block;
            position: absolute;
            top: 3px;
            left: 29px;
            width: 5px;
            height: 14px;
            border-radius: 20%;
            background: white;
          }
          .lds-spinner div:nth-child(1) {
            transform: rotate(0deg);
            animation-delay: -.55s;
          }
          .lds-spinner div:nth-child(2) {
            transform: rotate(30deg);
            animation-delay: -.5s;
          }
          .lds-spinner div:nth-child(3) {
            transform: rotate(60deg);
            animation-delay: -0.45s;
          }
          .lds-spinner div:nth-child(4) {
            transform: rotate(90deg);
            animation-delay: -0.4s;
          }
          .lds-spinner div:nth-child(5) {
            transform: rotate(120deg);
            animation-delay: -0.35s;
          }
          .lds-spinner div:nth-child(6) {
            transform: rotate(150deg);
            animation-delay: -0.3s;
          }
          .lds-spinner div:nth-child(7) {
            transform: rotate(180deg);
            animation-delay: -0.25s;
          }
          .lds-spinner div:nth-child(8) {
            transform: rotate(210deg);
            animation-delay: -0.2s;
          }
          .lds-spinner div:nth-child(9) {
            transform: rotate(240deg);
            animation-delay: -0.15s;
          }
          .lds-spinner div:nth-child(10) {
            transform: rotate(270deg);
            animation-delay: -0.1s;
          }
          .lds-spinner div:nth-child(11) {
            transform: rotate(300deg);
            animation-delay: -0.05s;
          }
          .lds-spinner div:nth-child(12) {
            transform: rotate(330deg);
            animation-delay: 0s;
          }
          @keyframes lds-spinner {
            0% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }`,
          extent: pt(86.24453102062381,70.22525286899308),
          fill: Color.rgba(255,255,255,0),
          html: "<div class=\"white-spinner lds-spinner\"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>",
          name: "spinner",
          position: pt(0,1.4269215163758595),
          scale: 0.5,
          type: 'html'
        }, {
          extent: pt(110,22),
          fill: Color.rgba(255,255,255,0),
          fontColor: Color.rgb(253,254,254),
          fontFamily: "Nunito",
          fontSize: 16,
          fontWeight: "bold",
          name: "label",
          nativeCursor: "pointer",
          position: pt(43.122265510311905,3.552713678800501e-15),
          submorphs: [{
              extent: pt(83,16),
              fill: Color.rgba(255,255,255,0),
              fontColor: Color.rgb(253,254,254),
              fontFamily: "Nunito",
              fontWeight: "bold",
              name: "status",
              nativeCursor: "pointer",
              opacity: 0.65,
              position: pt(0.3464844896881232,21.96646946724826),
              textAndAttributes: ["Loading World", null],
              type: 'label'
            }],
          textAndAttributes: ["Loading World", null],
          type: 'label'
        }],
    }, {
      borderRadius: 22,
      borderWidth: 0,
      dropShadow: new ShadowObject({
        distance:3,
        rotation:45,
        color:Color.rgba(0,0,0,0.26),
        inset:false,
        blur:10,
        spread:0,
        fast:true
      }),
      extent: pt(21.603125000000006,21.0703125),
      fill: new RadialGradient({
        stops: [{
          offset: 0, 
          color: Color.rgb(153,163,164)
        }, {
          offset: 1,
          color: Color.rgb(112,123,124)
        }],
        bounds: rect(0,0,20,20),
        focus: pt(0.5,0.5)
      }),
      fontColor: Color.rgb(253,254,254),
      isLayoutable: false,
      name: "closeButton",
      position: pt(276.8734375,8.8515625),
      submorphs: [{
          extent: pt(8,16),
          fontColor: Color.rgb(253,254,254),
          fontWeight: "bolder",
          name: "label",
          position: pt(6.801562500000003,2.53515625),
          reactsToPointer: false,
          textAndAttributes: Icon.textAttribute("times"),
          type: "label"
        }],
      type: "button",
      visible: false
    }],
  type: LoadingIndicator
};
