import { promise } from 'lively.lang';
import { HTMLMorph } from 'lively.morphic';
'format esm';

// IFrameMorph.printTextMorph(that)

// var im = IFrameMorph.open({src: "http://localhost:9011/test.html"})
// var im = IFrameMorph.open({src: "http://spiegel.de"})
// var im = IFrameMorph.open({src: "http://localhost:9011/proxy/www.spiegel.de"})
// var im = IFrameMorph.open({srcdoc: that.env.renderer.getNodeForMorph(that).innerHTML})
// await im.whenLoaded()
// Array.from(im.innerWindow.document.querySelectorAll(".article-title"))
//   .map(ea => ea.textContent).join("\n")
// im.innerWindow
// window.print()

export class IFrameMorph extends HTMLMorph {
  static async printTextMorph (textMorph) {
    // textMorph.clipMode = "visible";

    textMorph.env.renderer.renderStep();

    let el = textMorph.env.renderer.getNodeForMorph(textMorph);
    let im = IFrameMorph.open({ srcdoc: el.outerHTML });

    await im.whenLoaded();

    let doc = im.innerWindow.document;
    doc.body.style.whiteSpace = 'normal';
    doc.body.style.margin = '0.5cm';

    doc.querySelector('.Text').style.width = '100%';
    doc.querySelector('.Text').style.overflow = 'visible';
    doc.querySelectorAll('.marker-layer-part').forEach(ea => ea.parentNode.removeChild(ea));

    let textLayer = doc.querySelector('.text-layer');
    textLayer.style.whiteSpace = 'pre-wrap';

    // remove the rigid line breaks
    let lines = Array.from(textLayer.querySelectorAll('div'));
    lines.forEach(line => {
      if (!line.childNodes[0]) return;
      Array.from(line.childNodes).forEach(ea => textLayer.insertBefore(ea, line));
      textLayer.insertBefore(doc.createElement('br'), line);
      textLayer.removeChild(line);
    });

    im.innerWindow.print();
    im.getWindow().remove();
  }

  static open (props = {}) {
    return new this(props).openInWindow({ title: props.title || 'iframe' }).targetMorph;
  }

  static get properties () {
    return {

      iframe: {
        after: ['domNode'],
        readOnly: true,
        get () { return this.domNode; }
      },

      innerWindow: {
        after: ['iframe'],
        readOnly: true,
        get () { return this.iframe.contentWindow; }
      },

      innerWorld: {
        after: ['innerWindow'],
        readOnly: true,
        get () { return this.innerWindow.$world; }
      },

      src: {
        after: ['domNode'],
        set (src) { this.changeSrc(src, null); }
      },

      srcdoc: {
        after: ['domNode'],
        set (srcdoc) { this.changeSrc(null, srcdoc); }
      },

      domNode: {
        get () {
          if (!this._domNode) {
            this._domNode = this.document.createElement('iframe');
            this._domNode.setAttribute('style', 'position: absolute; width: 100%; height: 100%;');
            this._domNode.setAttribute('allowfullscreen', true);
          }
          return this._domNode;
        },
        set (node) { return this._domNode = node; }
      }

    };
  }

  constructor (props) {
    if (!props.src && !props.srcdoc) props.srcdoc = '<p>Empty iframe</p>';
    super(props);
  }

  changeSrc (src, srcDoc) {
    let { iframe, _loadPromise: p } = this;
    if (p && !p.loaded) p.reject();
    this._loadPromise = promise.deferred();
    this._loadPromise.loaded = false;
    iframe.onload = evt => {
      this._loadPromise.loaded = true;
      this._loadPromise.resolve(evt);
    };
    let val = src || srcDoc;
    let set = src ? 'src' : 'srcdoc';
    let remove = src ? 'srcdoc' : 'src';
    this.addValueChange(remove, null);
    this.addValueChange(set, val);
    iframe.removeAttribute(remove);
    iframe.setAttribute(set, val);
    this._loadPromise[set] = val;
  }

  whenLoaded () { return this._loadPromise.promise; }

  reload () { return this.iframe.src = this.src; }
  run (func) { return this.innerWindow.eval('(' + func + ')();'); }

  // onIFrameLoad(func) {
  //   this.attachSystemConsole();
  // }

  // attachSystemConsole() {
  //   var c = this.get("SystemConsole");
  //   if (!c) return;
  //   c.targetMorph.reset();
  //   var iframeGlobal = this.getGlobal();
  //   c.targetMorph.install(iframeGlobal.console, iframeGlobal);
  //   c.targetMorph.installConsoleWrapper(iframeGlobal.console);
  // }

  // makeEditorEvalInIframe(editor) {
  //   editor.iframe = this;
  //   editor.addScript(function boundEval(__evalStatement) {
  //       var ctx = this.getDoitContext() || this;
  //       var vm = lively.lang.VM;
  //       __evalStatement = vm.evalCodeTransform(__evalStatement, {
  //         context: ctx,
  //         topLevelVarRecorder: Global,
  //         varRecorderName: "window"
  //       })
  //       __evalStatement = lively.ast.transform.returnLastStatement(__evalStatement);
  //       var interactiveEval = new Function(__evalStatement);
  //       return this.iframe.run(interactiveEval);
  //   });
  //   editor.addScript(function getDoitContext() { return this.iframe.getGlobal(); });
  // }

  // morphMenuItems() {
  //   var target = this;
  //   return $super().concat([
  //       ['Reload', function() { target.reload(); }],
  //       ['Open workspace', function() {
  //           var workspace = $world.addCodeEditor({title: String(target.url)});
  //           target.makeEditorEvalInIframe(workspace);
  //       }],
  //       ['Open console', function() {
  //         lively.require("lively.ide.tools.SystemConsole").toRun(function() {
  //           lively.ide.tools.SystemConsole.openInContext(target.getGlobal());
  //         });
  //       }],
  //       ['Edit page', function() {
  //           module('lively.ide.tools.TextEditor').load(true);
  //           var textEd = lively.BuildSpec('lively.ide.tools.TextEditor').createMorph().openInWorldCenter();
  //           target.makeEditorEvalInIframe(textEd.get('editor'));
  //           textEd.openURL(target.url);
  //           lively.bindings.connect(textEd, 'contentStored', target, 'reload');
  //       }],
  //       ['Change URL', function() {
  //           $world.prompt("Enter URL for iframe", function(input) {
  //               if (!input) return;
  //               target.setURL(input);
  //           }, target.getURL());
  //       }]
  //   ]);
  // }
}
