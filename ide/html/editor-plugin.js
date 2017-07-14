/*global show*/
import EditorPlugin from "../editor-plugin.js";

import "./mode.js"
import { getMode } from "../editor-modes.js";

import { completers as jsCompleters } from "../js/completers.js";
import { snippets as jsSnippets } from "../js/snippets.js";

import {
  jsIdeCommands,
  jsEditorCommands,
  astEditorCommands as jsAstEditorCommands
} from "../js/commands.js";
import { localInterface, systemInterfaceNamed } from "lively-system-interface";
import { runCommand } from "../shell/shell-interface.js";
import HTMLNavigator from "./navigator.js";
import HTMLChecker from "./checker.js";
import parse5 from "lively.morphic/ide/html/parse5.browserified.js";
import { IFrameMorph } from "../../html-morph.js";
import { arr, string } from "lively.lang";
import { Color } from "lively.graphics";

// export async function tidyHtml(htmlSrc) {
//   let {stdout} = await runCommand("tidy --indent", {stdin: htmlSrc}).whenDone();
//   stdout = stdout.replace(/\s*<meta name="generator"[^>]+>/, "");
//   return stdout;  
// }


export async function tidyHtml(htmlSrc) {
  let {default: beautify} = await lively.modules.module("lively.morphic/ide/html/js-beautify-html.1.6.15.js").load({format: "global"});
  return beautify(htmlSrc);
}

var commands = [

  {
    name: "[HTML] cleanup",
    exec: async text => {
      /*global show*/
      let undo = text.undoManager.ensureNewGroup(text, "[HTML] cleanup");
      await text.saveExcursion(async () => {
        if (text.selection.isEmpty()) text.selectAll();
        let allText = text.textString,
            selectedText = text.selection.text;
        text.textString = await tidyHtml(text.textString);
        text.selectAll();
        text.execCommand("indent according to mode");
      });
      text.undoManager.group(undo);
      return true;
    }
  },

  {
    name: "[HTML] select open and close tag",
    exec: text => {
      let plugin = text.editorPlugin,
          sel = text._multiSelection || text.selection,
          nav = plugin.getNavigator(),
          ranges = nav.rangesForStartAndEndTag(text, text.cursorPosition, plugin.parse());
      if (ranges) {
        if (ranges.startTag) {
          // fit them to tag names
          ranges.startTag.start.column += 1;
          ranges.startTag.end = text.document.scanForward(
            ranges.startTag.start, (char, p) => (char === " " || char === ">") && p);
          sel.addRange(ranges.startTag);
        }
        if (ranges.endTag) {
          ranges.endTag.start.column += 2;
          ranges.endTag.end.column -= 1;
          sel.addRange(ranges.endTag);
        }
      }
      return true;
    }
  },

  {
    name: "[HTML] render in iframe",
    exec: text => {
      let iframeMorph = text._iframeMorph;
      if (!iframeMorph || !iframeMorph.world()) {
        iframeMorph = text._iframeMorph = new IFrameMorph()
        iframeMorph.openInWindow({title: "rendered HTML"});
      }

      let url, html, win = text.getWindow();
      // is it a html workspace?
      if (win && win.isHTMLWorkspace) url = win.file.url;
      // file editor?
      else if (text.owner && text.owner.isTextEditor) url = text.owner.location;

      if (url) { iframeMorph.loadURL(url); }
      else iframeMorph.displayHTML(text.textString);

      return iframeMorph;
    }
  },

  {
    name: "[HTML] interactively select HTML node",
    exec: async (editor, args = {}) => {

      let currentIndex = editor.positionToIndex(args.startPos || editor.cursorPosition),
          src = editor.textString,
          p = editor.editorPlugin,
          parsed = filterNodes(p.parse()),
          nodes = [],
          currentNodeIndex = 0,
          printedTree = string.printTree(
            parsed,
            n => { nodes.push(n); return `${n.nodeName}`; },
            n => n.childNodes),
          lines = printedTree.split("\n"),
          interstingNodes = nodes,
          counter = 0,
          items = interstingNodes.map((n, i) => {
            let index = `${i}\u2003\u2003\u2003`.slice(0, String(lines.length).length),
                preview,
                {startOffset, endOffset} = n.__location || {};
            if (typeof startOffset !== "number") {
              preview = " [virtual]"
            } else {
              if (startOffset <= currentIndex &&
                  currentIndex <= endOffset) currentNodeIndex = counter;
              preview = n.nodeName === "#text"
                ? n.value.trim() || "<empty>"
              : src.slice(startOffset, endOffset).replace(/\n/g, "");
            }
            counter++;

            return {
              isListItem: true,
              value: n,
              label: [
                `${index}`, {
                  fontSize: "80%",
                  textStyleClasses: ["v-center-text"],
                  paddingRight: "10px"
                },
                lines[i], null
              ],
              annotation: [
                preview, {
                  fontSize: "80%",
                  textStyleClasses: ["truncated-text"],
                  maxWidth: 180
                }
              ]
            }
          }), choice;

      await editor.saveExcursion(async () => {
        ({selected: [choice]} = await $world.filterableListPrompt(
          "Select node", items, {
            onSelection: node => {
              if (!node.__location) return;
              let {startOffset, endOffset} = node.__location;
              editor.removeMarker('selected tag');
              editor.flash({
                start: editor.indexToPosition(startOffset),
                end: editor.indexToPosition(endOffset),
              }, {id: 'selected tag', time: 1000, fill: Color.rgb(200,235,255)});
            },
            preselect: currentNodeIndex,
            historyId: "lively.morphic-ide-html-select-html-node"
          }));
      });

      if (typeof args.action === "function") {
        args.action(choice);
        return choice;
      }

      editor.focus();

      if (!choice) return null;

      let {startOffset, endOffset} = choice.__location || {};
      if (typeof startOffset === "number") {
        editor.saveMark();
        editor.selection = {
          end: editor.indexToPosition(startOffset),
          start: editor.indexToPosition(endOffset),
        }
        editor.scrollCursorIntoView();
      }
      return choice;


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function filterNodes(node) {
        if (node.nodeName !== "#document" && !node.__location) return null;
        if (node.nodeName === "#text" && !node.value.trim()) return null;
        let copy = lively.lang.obj.clone(node);
        if (node.childNodes)
          copy.childNodes = node.childNodes.slice().map(ea => filterNodes(ea)).filter(Boolean);
        return copy;
      }
    }

  }
]

export default class HTMLEditorPlugin extends EditorPlugin {

  static get shortName() { return "html"; }

  static get mode() { return getMode({}, {name: "htmlmixed"}); }

  constructor() {
    super()
    this.checker = new HTMLChecker();
    this.evalEnvironment = {format: "esm", targetModule: "lively://lively.next-html-workspace", context: null}
  }

  get isHTMLEditorPlugin() { return true }
  get isJSEditorPlugin() { return true }

  cmd_insertstring(string) {
    let {textMorph: morph} = this,
        handled = super.cmd_insertstring(string);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    let closeBracket = string === ">";
    if (closeBracket) {
      let pos = {...morph.cursorPosition};
      if (!handled) {
        morph.insertText(">", pos);
        pos.column++
        handled = true;
      }

      let matching = morph.findMatchingBackward(pos, "left", {">": "<"});
      if (matching) {
        let textInBetween = morph.textInRange({start: matching, end: pos}),
            match = textInBetween.match(/^\<([a-z0-9\$\!#_\-]+)\>$/i);
        if (match) {
          morph.insertText(`</${match[1]}>`, pos);
          morph.cursorPosition = pos;
        }
      }
      return true;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // inserts closing tag via multi selection
    let openBracket = string === "<";
    if (false && openBracket) {
      let {row, column} = morph.cursorPosition,
          lineString = morph.getLine(row);
      if ("<>" === lineString.slice(column-1, column+1)) {
        morph.insertText("</>", {row, column: column+1})
        morph.selection.addRange({start: {row, column: column+3}, end: {row, column: column+3}})
        morph.selection.selections = lively.lang.arr.rotate(morph.selection.selections, -1);
      }
    }

    return handled;
  }

  get openPairs() {
    return {...super.openPairs, "<": ">"}
  }

  get closePairs() {
    return {...super.closePairs, ">": "<"}
  }

  getNavigator(otherCommands) { return new HTMLNavigator(); }

  // getSnippets() {
  //   return jsSnippets.map(([trigger, expansion]) =>
  //     new Snippet({trigger, expansion}));
  // }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // js related stuff

  getCompleters(otherCompleters) { return jsCompleters.concat(otherCompleters); }

  getCommands(otherCommands) {
    return [
      ...otherCommands,
      ...jsIdeCommands,
      ...jsEditorCommands,
      ...commands
      // ...jsAstEditorCommands
    ];
  }

  getKeyBindings(other) {
    return [
      ...other,
      {command: "[HTML] cleanup", keys: "Shift-Tab"},
      {command: "[HTML] select open and close tag", keys: "Ctrl-Shift-'"},
      {command: "[HTML] render in iframe", keys: "Alt-G"},
      {command: "[HTML] interactively select HTML node", keys: "Alt-J"},
    ];
  }

  async getMenuItems(items) {
    var editor = this.textMorph,
        htmlItems = [
          {command: "[HTML] render in iframe", alias: "render in iframe", target: editor},
          ["selection", [
            {command: "expandRegion", alias: "expand", target: editor},
            {command: "contractRegion", alias: "contract", target: editor},
            {command: "[HTML] select open and close tag", alias: "select open/end tag", target: editor},
            {command: "[HTML] interactively select HTML node", alias: "select html node...", target: editor},
          ]],
          {isDivider: true},
        ];

    return htmlItems.concat(items);
  }

  sanatizedJsEnv(envMixin) {
    let env = this.evalEnvironment;
    if (!env.systemInterface) env.systemInterface = localInterface;
    return {...env, ...envMixin};
  }

  systemInterface(envMixin) {
    var env = this.sanatizedJsEnv(envMixin);
    return env.systemInterface || localInterface;
  }

  setSystemInterface(systemInterface) {
    return this.evalEnvironment.systemInterface = systemInterface;
  }

  setSystemInterfaceNamed(interfaceSpec) {
    return this.setSystemInterface(systemInterfaceNamed(interfaceSpec));
  }

  runEval(code, opts) {
    var env = this.sanatizedJsEnv(opts),
        endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }

  get parser() { return parse5; }

  parse() {
    // astType = 'FunctionExpression' || astType == 'FunctionDeclaration' || null
    if (this._ast) return this._ast;
    let {parser, textMorph: {textString: src}} = this;
    return parser ? this._ast = parser.parse(src, {locationInfo: true}) : null;
  }

}
