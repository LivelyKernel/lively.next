import { lessPosition, minPosition, maxPosition } from 'lively.morphic/text/position.js';
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finds string / regexp matches in text morphs
export class TextSearcher {
  constructor (morph) {
    this.morph = morph;
    this.STOP = {};
  }

  get doc () { return this.morph.document; }

  processFind (start, match) {
    const i = this.doc.positionToIndex(start);
    const end = this.doc.indexToPosition(i + match.length);
    return { range: { start, end }, match };
  }

  stringSearch (lines, needle, caseSensitive, nLines, inRange, char, pos) {
    if (inRange) {
      if (lessPosition(pos, inRange.start) || lessPosition(inRange.end, pos)) { return this.STOP; }
    }

    if (!caseSensitive) char = char.toLowerCase();
    if (char !== needle[0]) return null;

    const { row, column } = pos;
    /* FIXME rk 2017-04-06 while transitioning to new text: */
    const lineString = lines[row];
    const followingText = nLines <= 1 ? '' : '\n' + lines.slice(row + 1, (row + 1) + (nLines - 1)).join('\n');
    const chunk = lineString.slice(column) + followingText;
    const chunkToTest = caseSensitive ? chunk : chunk.toLowerCase();

    return chunkToTest.indexOf(needle) !== 0
      ? null
      : this.processFind({ row, column }, chunk.slice(0, needle.length));
  }

  reSearch (lines, needle, multiline, inRange, char, pos) {
    if (inRange) {
      if (lessPosition(pos, inRange.start) || lessPosition(inRange.end, pos)) { return this.STOP; }
    }

    const { row, column } = pos;
    const chunk = lines[row].slice(column) + (multiline ? '\n' + lines.slice(row + 1).join('\n') : '');
    const reMatch = chunk.match(needle);
    return reMatch ? this.processFind({ row, column }, reMatch[0]) : null;
  }

  search (options) {
    let { start, needle, backwards, caseSensitive, inRange } = {
      start: this.morph.cursorPosition,
      needle: '',
      backwards: false,
      caseSensitive: false,
      inRange: null,
      ...options
    };

    if (!needle) return null;

    if (inRange) {
      start = backwards
        ? minPosition(inRange.end, start)
        : maxPosition(inRange.start, start);
    }

    let search;
    if (needle instanceof RegExp) {
      const flags = (needle.flags || '').split('');
      const multiline = !!needle.multiline; flags.splice(flags.indexOf('m'), 1);
      if (!caseSensitive && !flags.includes('i')) flags.push('i');
      needle = new RegExp('^' + needle.source.replace(/^\^+/, ''), flags.join(''));
      search = this.reSearch.bind(this, this.doc.lineStrings, needle, multiline, inRange);
    } else {
      needle = String(needle);
      if (!caseSensitive) needle = needle.toLowerCase();
      const nLines = needle.split(this.doc.constructor.newline).length;
      search = this.stringSearch.bind(this,
        this.doc.lineStrings, needle, caseSensitive,
        nLines, inRange);
    }

    const result = this.doc[backwards ? 'scanBackward' : 'scanForward'](start, search);

    return result === this.STOP ? null : result;
  }

  searchForAll (options) {
    const results = [];
    let i = 0;
    while (true) {
      if (i++ > 10000) throw new Error('endless loop');
      const found = this.search(options);
      if (!found) return results;
      results.push(found);
      options = { ...options, start: options.backwards ? found.range.start : found.range.end };
    }
  }
}
