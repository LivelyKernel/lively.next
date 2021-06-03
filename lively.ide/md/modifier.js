import { mdCompiler } from './compiler.js';
import { string, arr } from 'lively.lang';

export class MarkdownModifier {
  changeHeadingDepthAt (editor, pos, delta) {
    let cursor = editor.cursorPosition;
    let src = editor.textString;
    let { headings } = mdCompiler.parse(src, editor.markdownOptions);
    let h = editor.editorPlugin.getNavigator().headingOfLine(headings, pos.row);
    let sub = editor.editorPlugin.getNavigator().rangeOfHeading(src, headings, h);
    let changes = this.headingsDepthChanges(src, headings, h, h.depth + delta);
    editor.applyChanges(changes, cursor, true);
  }

  headingsDepthChanges (markdownSrcOrLines, headings, heading, newDepth) {
    let lines = Array.isArray(markdownSrcOrLines)
      ? markdownSrcOrLines
      : string.lines(markdownSrcOrLines);
    let subheadings = this.rangeOfHeading(lines, headings, heading);
    let depth = heading.depth;
    let delta = newDepth - depth;
    let newHeadings = subheadings.subheadings.map(h => ({
      ...h,
      depth: h.depth + delta,
      lineString: string.times('#', h.depth + delta) + ' ' + h.string
    }));
    let changes = arr.flatmap(newHeadings, h => [
      ['remove', { row: h.line, column: 0 }, { row: h.line, column: lines[h.line].length }],
      ['insert', { row: h.line, column: 0 }, h.lineString]
    ]);
    return changes;
  }
}

let mdModifer = new MarkdownModifier();
export { mdModifer };
