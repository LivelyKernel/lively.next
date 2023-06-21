import { HTMLMorph, Morph } from 'lively.morphic';
import { mdCompiler } from './compiler.js';
import { connect } from 'lively.bindings/index.js';
import { fun } from 'lively.lang/index.js';
import { rect } from 'lively.graphics/index.js';

export class MarkdownPreviewMorph extends HTMLMorph {
  static get properties () {
    return {

      markdownEditor: {},

      markdownSource: {
        after: ['markdownEditor'],
        get () {
          return this.markdownEditor.textString || this.getProperty('markdownSource');
        },
        set (src) {
          this.setProperty('markdownSource', src);
          let ed = this.markdownEditor;
          if (ed) this.markdownEditor.textString = src;
        }
      },

      markdownOptions: {
        after: ['markdownEditor'],
        get () {
          let ed = this.markdownEditor;
          return (ed && ed.editorPlugin.markdownOptions) || this.getProperty('markdownOptions');
        },
        set (options) {
          let ed = this.markdownEditor;
          if (ed) {
            ed.editorPlugin.markdownOptions = options;
            this.setProperty('markdownOptions', null);
          } else {
            this.setProperty('markdownOptions', options);
          }
        }
      },

      markdownToHTMLPositionMap: {
        // array that maps md lines to the y position in the rendered html
        get () {
          let map = this.getProperty('markdownToHTMLPositionMap');
          if (map) return map;
          this.setProperty('markdownToHTMLPositionMap', map = this.computeMarkdownToHTMLPositionMap());
          return map;
        }
      }
    };
  }

  reset () {
    this.disconnectMarkdownScrollToHTMLScroll();
    this.disconnectHTMLScrollToMarkdownScroll();
    this.connectMarkdownScrollToHTMLScroll(true);
    this.connectHTMLScrollToMarkdownScroll(true);
    // this.attributeConnections
    // this.markdownEditor.attributeConnections
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // scroll syncing

  ___ () {
    // this.debug = true;
    // this.debug = false;
    this.markdownToHTMLPositionMap.map((ea, i) => `${i}: ${Math.round(ea)}`).join('\n');
  }

  smoothScrollStart (morph, scrollToY, scrollDeltaY, startTime = Date.now()) {
    this.debug && console.log('[smoothScroll] start', scrollToY);
    // basically a queue for scroll processing
    if (!this._smoothScroll) this._smoothScroll = [];
    for (let i = this._smoothScroll.length; i--;) {
      if (this._smoothScroll[i][0] === morph) { this._smoothScroll.splice(i, 1); }
    }
    this._smoothScroll.push([morph, scrollToY, scrollDeltaY, startTime]);
    this.startStepping('smoothScrollStep');
  }

  smoothScrollStep () {
    if (!this._smoothScroll) {
      this.debug && console.log('[smoothScroll] stop');
      this.stopSteppingScriptNamed('smoothScrollStep');
      return;
    }

    const maxTime = 1000;
    for (let i = this._smoothScroll.length; i--;) {
      let spec = this._smoothScroll[i];
      let [m, scrollToY, scrollDeltaY, startTime] = spec;
      let node = m.env.renderer.getNodeForMorph(m);
      let deltaY = Math.abs(node.scrollTop - scrollToY);
      if (deltaY < 1 || Date.now() - startTime > maxTime) { this._smoothScroll.splice(i, 1); continue; }
      if (!scrollDeltaY) scrollDeltaY = spec[2] = deltaY / 10;
      if (deltaY < scrollDeltaY) scrollDeltaY = deltaY;

      if (node.scrollTop > scrollToY) scrollDeltaY = -scrollDeltaY;
      node.scrollTop = node.scrollTop + scrollDeltaY;

      this.debug && console.log('[smoothScroll] step', node.scrollTop + scrollDeltaY);
    }

    if (!this._smoothScroll.length) this._smoothScroll = null;
  }

  computeMarkdownToHTMLPositionMap () {
    let lineEls = this.domNode.querySelectorAll('.markdown-line-marker');
    if (!lineEls.length) return [];

    let lastMdLine = this.markdownSource.split('\n').length;
    let parent = lineEls[0].parentElement;
    let { top: parentTop, height: parentHeight } = parent.getBoundingClientRect();
    // get the relative DOM position for each HTML element with a data-mdline attribute:
    let lineElsByMdLines = Array.from(lineEls).reduce((heightMap, el) => {
      let line = Number(el.getAttribute('data-mdline'));
      heightMap[line] = el.getBoundingClientRect().top - parentTop;
      return heightMap;
    }, []);

    // not for everything in the markdown content we render a
    // markdown-line-marker, so simple use max HTML height as last marker
    // if (lineElsByMdLines.length < lastMdLine)
    // lineElsByMdLines[lastMdLine] = parentHeight - (this.isClip() ? this.height : 0);
    lineElsByMdLines[lastMdLine] = parentHeight;

    lineElsByMdLines.join('\n');
    lineElsByMdLines.slice(-15).join('\n');

    // linear interpolate the y vals for the lines inebtween that have no line marker
    for (let nextMdLine, mdLine = 0; mdLine < lineElsByMdLines.length - 1; mdLine++) {
      for (let j = mdLine + 1; j < lineElsByMdLines.length; j++) { if (undefined !== lineElsByMdLines[j]) { nextMdLine = j; break; } }
      let steps = nextMdLine - mdLine;
      let heightDiff = lineElsByMdLines[nextMdLine] - lineElsByMdLines[mdLine];
      let step = heightDiff / steps;
      for (let j = mdLine + 1; j < nextMdLine; j++) { lineElsByMdLines[j] = (lineElsByMdLines[j - 1] || 0) + step; }
      mdLine = nextMdLine - 1;
    }

    return lineElsByMdLines;
  }

  syncMarkdownScrollToHTMLScroll (editor = this.markdownEditor) {
    if (!editor) return;

    let { whatsVisible: { startRow, endRow } } = editor;
    let nLines = editor.lineCount();
    let nRowsVisible = endRow - startRow;
    let centerRow = Math.round(startRow + (endRow - startRow) / 2);
    let { markdownToHTMLPositionMap } = this;
    let debug = this.debug;
    let targetRow;

    function sigmoid (x) {
      let L = nRowsVisible; let k = .7; let x0 = nLines / 2;
      return L / (1 + Math.pow(Math.E, -k * (x - x0)));
    }

    // ramp up to center row
    if (startRow < nRowsVisible / 2) {
      targetRow = startRow * 2;
      debug && console.log(`[start] ${centerRow} => ${targetRow}`);

      // // if cursor is visible
      // } else if (cursorPosition.row >= startRow && cursorPosition.row <= endRow) {
      //   targetRow = cursorPosition.row;

    // before and after center
    } else if (centerRow < nLines / 2 - (nRowsVisible / 4) || centerRow > nLines / 2 + (nRowsVisible / 4)) {
      targetRow = centerRow;
      debug && console.log(`[just centerRow] ${centerRow} => ${targetRow}`);

    // around center, s-shape
    } else {
      targetRow = Math.round((nLines / 2 - nRowsVisible / 4) + sigmoid(centerRow));
      debug && console.log(`[sigmoid center] ${centerRow} => ${targetRow}`);
    }

    if (typeof markdownToHTMLPositionMap[targetRow] !== 'number') return;

    this.htmlScrollToMarkdownScrollConnections().forEach(ea => ea.deactivate());
    // fun.debounceNamed("syncScroll_connection_activator1" + this.id, 300, () =>
    //   this.htmlScrollToMarkdownScrollConnections().forEach(ea => ea.deactivate()))();

    this.smoothScrollStart(this, markdownToHTMLPositionMap[targetRow]);
    // this.domNode.parentNode.scrollTop = markdownToHTMLPositionMap[targetRow];
    fun.waitFor(() => !this._smoothScroll, () => this.htmlScrollToMarkdownScrollConnections().forEach(ea => ea.activate()));
  }

  syncHTMLScrollToMarkdownScroll (editor = this.markdownEditor) {
    if (!editor) return;

    // map scroll to max height so that when scrolled to bottom we get the last markdown line

    let { markdownToHTMLPositionMap } = this;

    // var {scrollTop, scrollHeight, clientHeight} = this.domNode.parentNode,
    //     percentScrolled = scrollTop / (scrollHeight - clientHeight),
    //     mdLineIndex = Math.round((markdownToHTMLPositionMap.length-1) * percentScrolled),
    //     mdLineClosest = {line: mdLineIndex};

    let t = this.domNode.parentNode.scrollTop;
    let mdLineClosest = markdownToHTMLPositionMap.reduce((min, height, i) => {
      let delta = Math.abs(height - t);
      if (min.delta < delta) return min;
      return { delta, height, line: i };
    }, { delta: Infinity, line: -1 });

    this.markdownScrollToHTMLScrollConnections(editor).forEach(ea => ea.activate());
    // fun.debounceNamed("syncScroll_connection_activator2" + this.id, 300, () =>
    //   this.markdownScrollToHTMLScrollConnections(editor).forEach(ea => ea.deactivate()))();

    let { y } = editor.charBoundsFromTextPosition({ row: mdLineClosest.line, column: 0 });
    // editor.env.renderer.getNodeForMorph(editor).scrollTop = y;
    this.smoothScrollStart(editor, y);
    fun.waitFor(() => !this._smoothScroll, () => this.markdownScrollToHTMLScrollConnections(editor).forEach(ea => ea.deactivate()));
  }

  syncHTMLScrollToMarkdownScrollDebounced (editor) {
    requestAnimationFrame(() => this.syncHTMLScrollToMarkdownScroll(editor));
  }

  syncMarkdownScrollToHTMLScrollDebounced (editor) {
    requestAnimationFrame(() => this.syncMarkdownScrollToHTMLScroll(editor));
  }

  htmlScrollToMarkdownScrollConnections () {
    if (!this.attributeConnections) return [];
    return this.attributeConnections.filter(ea => ea.targetMethodName.startsWith('syncHTMLScrollToMarkdownScroll'));
  }

  markdownScrollToHTMLScrollConnections (editor = this.markdownEditor) {
    if (!editor.attributeConnections) return [];
    return editor.attributeConnections.filter(ea => ea.targetMethodName.startsWith('syncMarkdownScrollToHTMLScroll'));
  }

  autoRenderConnections (editor = this.markdownEditor) {
    if (!editor.attributeConnections) return [];
    return editor.attributeConnections.filter(ea => ea.targetMethodName.startsWith('autoRender'));
  }

  connectHTMLScrollToMarkdownScroll (debounced = false) {
    connect(this, 'scroll', this, 'syncHTMLScrollToMarkdownScroll' + (debounced ? 'Debounced' : ''), { converter: () => undefined });
  }

  disconnectHTMLScrollToMarkdownScroll () {
    this.htmlScrollToMarkdownScrollConnections().forEach(ea => ea.disconnect());
  }

  connectMarkdownScrollToHTMLScroll (debounced = false, editor = this.markdownEditor) {
    connect(editor, 'scroll', this, 'syncMarkdownScrollToHTMLScroll' + (debounced ? 'Debounced' : ''), { converter: () => undefined });
  }

  disconnectMarkdownScrollToHTMLScroll (editor = this.markdownEditor) {
    this.markdownScrollToHTMLScrollConnections(editor).forEach(ea => ea.disconnect());
  }

  enableAutoRender (editor = this.markdownEditor) {
    // this.enableAutoRender()
    connect(editor, 'textChange', this, 'autoRender', { converter: () => undefined });
  }

  disableAutoRender (editor = this.markdownEditor) {
    this.autoRenderConnections(editor).forEach(ea => ea.disconnect());
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  autoRender () {
    fun.throttleNamed('autoRender' + this.id, 300, () => this.renderMarkdown())();
  }

  renderMarkdown (editor = this.markdownEditor) {
    this.markdownToHTMLPositionMap = null; // reset cache
    let ed = this.markdownEditor;
    if (ed) {
      // this.markdownOptions = {...this.markdownOptions, linkedCSS: false}
      this.html = ed.editorPlugin.renderedMarkdown();
    } else {
      let { markdownSource, markdownOptions } = this;
      let html = mdCompiler.compileToHTML(markdownSource, markdownOptions);
      this.html = html;
    }

    this._smoothScroll = null;
    this.submorphs = [];
    // this.submorphs = this.computeMarkdownToHTMLPositionMap().map((ea, i) => {
    //   return {width: this.width, height: 3, top: ea, fill: Color.orange,
    //                 submorphs: [{type: "text", textString: String(i)}]}
    // });

    return this.html;
  }
}

export class MarkdownEditor extends Morph {
  static get properties () {
    return {

      showPreview: {
        derived: true,
        set (val) {
          this.get('show preview checkbox').checked = val;
          if (!val) this.removePreview();
          else this.addPreview();
        },
        get () { return !!this.mdPreviewMorph; }
      },

      linkScroll: {
        after: ['showPreview'],
        derived: true,
        set (val) {
          this.get('link scroll checkbox').checked = val;
          let p = this.mdPreviewMorph;
          if (!p) return;
          if (val) {
            p.connectHTMLScrollToMarkdownScroll();
            p.connectMarkdownScrollToHTMLScroll();
          } else {
            p.disconnectHTMLScrollToMarkdownScroll();
            p.disconnectMarkdownScrollToHTMLScroll();
          }
        },
        get () { return this.get('link scroll checkbox').checked; }
      },

      autoRender: {
        after: ['showPreview'],
        derived: true,
        set (val) {
          this.get('render while typing checkbox').checked = val;
          let p = this.mdPreviewMorph;
          if (!p) return;
          if (val) p.enableAutoRender();
          else p.disableAutoRender();
        },
        get () { return this.get('render while typing checkbox').checked; }
      },

      css: {
        after: ['showPreview'],
        set (val) {
          this.setProperty('css', val);
          let p = this.mdPreviewMorph;
          if (p) p.cssDeclaration = val;
        }
      }

    };
  }

  onFocus () {
    this.mdEditorMorph.focus();
  }

  reset () {
    connect(this.get('edit css button'), 'fire', this, 'editCSS');
    connect(this.get('link scroll checkbox'), 'checked', this, 'linkScroll');
    connect(this.get('render while typing checkbox'), 'checked', this, 'autoRender');
    connect(this.get('show preview checkbox'), 'checked', this, 'showPreview');
    this.showPreview = false;
    this.showPreview = true;
    this.mdPreviewMorph.show();
  }

  get mdEditorMorph () { return this.getSubmorphNamed('editor'); }

  get mdPreviewMorph () { return this.getSubmorphNamed(/markdown preview .*/); }

  async addPreview () {
    if (this.mdPreviewMorph) return;

    let preview = await this.mdEditorMorph.execCommand('[markdown] convert to html', { openInWorld: false });
    this.addMorph(preview);
    preview.border = this.mdEditorMorph.border;

    this.mdEditorMorph.setBounds(rect(
      this.get('show preview checkbox').bottomLeft.addXY(0, 5),
      this.innerBounds().bottomCenter().addXY(-2, -5)));

    preview.setBounds(rect(
      this.mdEditorMorph.topRight.addXY(4, 0),
      this.innerBounds().bottomRight().addXY(-5, -5)));

    this.autoRender = this.autoRender;
    this.linkScroll = this.linkScroll;
    preview.cssDeclaration = this.css || '';
  }

  removePreview () {
    let p = this.mdPreviewMorph;
    p && p.remove();
    this.mdEditorMorph.setBounds(rect(
      this.get('show preview checkbox').bottomLeft.addXY(0, 5),
      this.innerBounds().bottomRight().addXY(-5, -5)));
  }

  async editCSS () {
    let result = await $world.editPrompt('edit css for markdown', {
      requester: this,
      input: this.css || '',
      historyId: 'markdowneditor-css-history',
      mode: 'css'
    });
    if (result === undefined) return;
    this.css = result;
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-S', win: 'Control-S' }, command: 'save' }
    ];
  }

  get commands () {
    return [

      {
        name: 'save',
        exec: () => {
          let p = this.mdPreviewMorph;
          p && p.renderMarkdown();
          return true;
        }
      }

    ];
  }
}
