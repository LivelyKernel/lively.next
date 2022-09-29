import { CodeMirrorEnabledEditorPlugin } from '../editor-plugin.js';
import { snippets as mdSnippets } from './snippets.js';
import './mode.js';
import { tokenizeDocument } from '../editor-modes.js';
import { arr, string } from 'lively.lang';

import { addOrChangeLinkedCSS } from 'lively.morphic/rendering/dom-helper.js';
import { mdCompiler } from './compiler.js';
import MarkdownNavigator from './navigator.js';
import { MarkdownPreviewMorph } from './morphs.js';
import { pt, Color } from 'lively.graphics';
import { Snippet } from '../text/snippets.js';

let commands = [

  {
    name: '[markdown] convert to html',
    exec: async (mdText, options = {}) => {
      options = {
        extent: pt(500, 800),
        openInWorld: { title: 'markdown rendering' },
        markdownPreviewMorphName: null,
        markdownPreviewMorph: null,
        ...options
      };

      let preview = options.markdownPreviewMorph || mdText._mdPreviewMorph;
      let world = mdText.world() || (preview && preview.world());
      let previewName = options.markdownPreviewMorphName || `markdown preview for "${mdText.name}"`;

      if (!preview && world) {
        preview = mdText._mdPreviewMorph = world.get(previewName);
      }
      if (!preview) {
        preview = mdText._mdPreviewMorph = new MarkdownPreviewMorph({
          name: previewName,
          markdownEditor: mdText,
          extent: options.extent,
          clipMode: 'auto'
        });
      }

      if (options.openInWorld && !preview.world()) {
        preview.openInWindow(options.openInWorld).activate();
      }

      if (preview.getWindow()) $world.addMorph(preview.getWindow()).activate();

      preview.renderMarkdown();

      return preview;
    }
  },

  {
    name: '[markdown] scroll to cursor position in preview',
    exec: async (mdText, opts = {}) => {
      let p = mdText.editorPlugin;
      let nav = p.getNavigator();
      let { headings } = p.parsedMarkdown();
      let heading = nav.headingOfLine(headings, mdText.cursorPosition.row);
      let range = nav.rangeOfHeading(mdText.textString, headings, heading);
      let srcInRange = mdText.textInRange(range.range);
      let html = mdCompiler.compileToHTML(srcInRange, { ...p.markdownOptions, markdownWrapperTemplate: null });
      let preview = mdText._mdPreviewMorph;
      preview.html.indexOf(html);
    }
  },

  {
    name: '[markdown] goto heading',
    exec: async (mdText, opts = {}) => {
      let { row } = mdText.cursorPosition;
      let { headings } = mdText.editorPlugin.parsedMarkdown();

      if (!headings.length) return true;

      let nextHeadingI = row >= arr.last(headings).line
        ? headings.length
        : headings.findIndex(ea => ea.line > row);
      if (nextHeadingI === -1) nextHeadingI = 0;

      let items = headings.map(ea => {
        return {
          isListItem: true,
          string: ea.line + ':' + string.indent(ea.string, ' ', ea.depth),
          value: ea
        };
      });

      let { choice } = opts;

      if (!choice) {
        ({ selected: [choice] } = await mdText.world().filterableListPrompt(
          'jump to heading', items, {
            requester: mdText,
            preselect: nextHeadingI - 1,
            multiSelect: false
          }));
      }

      if (choice) {
        mdText.saveMark();
        mdText.cursorPosition = { row: choice.line, column: 0 };
        mdText.flash(mdText.lineRange(choice.line), { id: 'md heading', time: 1000, fill: Color.rgb(200, 235, 255) });
      }

      return true;
    }
  }
];

export const defaultMarkdownOptions = {
  html: true,
  linkify: true,
  typographer: true,
  linkedCSS: { 'github-markdown': '/lively.ide/md/github-markdown.css' },
  markdownWrapperTemplate: '<div class="markdown-body" style="margin: 5px">\n%s\n</div>',
  addSourceLineMapping: true,
  externalizeLinks: {}
};

export default class MarkdownEditorPlugin extends CodeMirrorEnabledEditorPlugin {
  constructor () {
    super();
    this._markdownOptions = { ...defaultMarkdownOptions };
    this._html = '';
  }

  get markdownOptions () { return this._markdownOptions; }
  set markdownOptions (options) { this._ast = null; return this._markdownOptions = options; }

  get isMarkdownEditorPlugin () { return true; }
  get shortName () { return 'md'; }
  get longName () { return 'markdown'; }
  get openPairs () { return { '{': '}', '[': ']', '(': ')', '"': '"', "'": "'", '`': '`' }; }
  get closePairs () { return { '}': '{', ']': '[', ')': '(', '"': '"', "'": "'", '`': '`' }; }

  getNavigator () { return new MarkdownNavigator(); }

  getCommands (otherCommands) { return otherCommands.concat(commands); }

  getKeyBindings (other) {
    return other.concat([
      { keys: 'Alt-G', command: '[markdown] convert to html' },
      { keys: 'Alt-J', command: '[markdown] goto heading' }
    ]);
  }

  async getMenuItems (items) {
    return [
      { command: '[markdown] convert to html', alias: 'convert to html', target: this.textMorph },
      { command: '[markdown] goto heading', alias: 'goto heading', target: this.textMorph },
      { isDivider: true }
    ].concat(items);
  }

  getSnippets () {
    return mdSnippets.map(([trigger, expansion]) =>
      new Snippet({ trigger, expansion }));
  }

  onTextChange (change) {
    super.onTextChange(change);
    this._html = '';
  }

  highlight () {
    // 2017-07-20 rkrk: FIXME, currently need to re-implement b/c codemirror md
    // mode returns multiple tokens (space seperated) for a single thing.

    let { textMorph, theme, mode, _tokenizerValidBefore } = this;

    if (!theme || !textMorph || !textMorph.document || !mode) return;

    textMorph.fill = theme.background;

    let { firstVisibleRow, lastVisibleRow } = textMorph.renderingState;
    let { lines, tokens } = tokenizeDocument(
      mode,
      textMorph.document,
      firstVisibleRow,
      lastVisibleRow,
      _tokenizerValidBefore);

    if (lines.length) {
      let row = lines[0].row;
      let attributes = [];
      for (let i = 0; i < tokens.length; row++, i++) {
        let lineTokens = tokens[i];
        for (let i = 0; i < lineTokens.length; i = i + 5) {
          let startColumn = lineTokens[i];
          let endColumn = lineTokens[i + 1];
          let tokens = (lineTokens[i + 2] || '').split(' ');
          // style = theme[tokens[0]] || theme.default;

          let style;
          for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token) style = Object.assign({}, style, theme[token]);
          }
          if (!style) style = theme.default;
          style && attributes.push(
            { start: { row, column: startColumn }, end: { row, column: endColumn } },
            style);
        }
      }
      textMorph.setTextAttributesWithSortedRanges(attributes);
      this._tokenizerValidBefore = { row: arr.last(lines).row + 1, column: 0 };
    }

    if (this.checker) { this.checker.onDocumentChange({}, textMorph, this); }
  }

  parsedMarkdown () { return this._ast || (this._ast = this.parse()); }
  renderedMarkdown () { return this._html || (this._html = this.render()); }

  parse (opts) {
    opts = opts ? { ...this._markdownOptions, ...opts } : this._markdownOptions;
    return mdCompiler.parse(this.textMorph, opts);
  }

  render (opts) {
    opts = opts ? { ...this._markdownOptions, ...opts } : this._markdownOptions;
    if (opts.linkedCSS) {
      for (let id in opts.linkedCSS) { addOrChangeLinkedCSS(id, opts.linkedCSS[id]); }
    }
    let markdownSource = this.textMorph.textString;
    return mdCompiler.compileToHTML(markdownSource, opts);
  }
}
