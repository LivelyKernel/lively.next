import { mdCompiler } from "./compiler.js";
import { string, arr } from "lively.lang";

export class MarkdownModifier {

  changeHeadingDepthAt(editor, pos, delta) {
    var cursor = editor.cursorPosition,
        src = editor.textString,
        {headings} = mdCompiler.parse(src, editor.markdownOptions),
        h = editor.editorPlugin.getNavigator().headingOfLine(headings, pos.row),
        sub = editor.editorPlugin.getNavigator().rangeOfHeading(src, headings, h),
        changes = this.headingsDepthChanges(src, headings, h, h.depth + delta);
    editor.applyChanges(changes, cursor, true);
  }

  headingsDepthChanges(markdownSrcOrLines, headings, heading, newDepth) {
    var lines = Array.isArray(markdownSrcOrLines) ?
          markdownSrcOrLines : string.lines(markdownSrcOrLines),
        subheadings = this.rangeOfHeading(lines, headings, heading),
        depth = heading.depth,
        delta = newDepth - depth,
        newHeadings = subheadings.subheadings.map(h => ({
          ...h,
          depth: h.depth + delta,
          lineString: string.times("#", h.depth + delta) + " " + h.string
        })),
        changes = arr.flatmap(newHeadings, h => [
          ["remove", {row: h.line, column: 0}, {row: h.line, column: lines[h.line].length}],
          ["insert", {row: h.line, column: 0}, h.lineString],
        ]);
    return changes;
  }

}

var mdModifer = new MarkdownModifier();
export { mdModifer }