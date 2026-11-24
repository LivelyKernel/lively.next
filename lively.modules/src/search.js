import { regExpEscape } from 'lively.lang/string.js';

/**
 * The global RegExp that `searchInSource` matches with. A RegExp `needle`
 * keeps its case and multiline flags; a string is matched literally unless
 * `regexMode` is set, and ignores case unless `caseSensitive` is set.
 */
export function searchRegExp (needle, { caseSensitive = false, regexMode = false } = {}) {
  if (needle instanceof RegExp) {
    let flags = 'g';
    if (needle.ignoreCase) flags += 'i';
    if (needle.multiline) flags += 'm';
    return RegExp(needle.source, flags);
  }
  return RegExp(regexMode ? needle : regExpEscape(needle), caseSensitive ? 'g' : 'gi');
}

/**
 * The matches of `needle` (see `searchRegExp`) in `source`, each with its
 * 1-based line, the column and length of the match, and the text of its line.
 * Lines longer than 1000 characters are shortened around the match.
 */
export function searchInSource (source, needle, options) {
  const re = searchRegExp(needle, options);
  const matches = [];
  let match;
  while ((match = re.exec(source)) !== null) {
    matches.push([match.index, match[0].length]);
    // An empty match leaves lastIndex in place.
    if (match[0].length === 0) re.lastIndex++;
  }
  let line = 1; let lineStart = 0; let counted = 0;
  return matches.map(([index, length]) => {
    // A newline at the match itself already counts toward its line.
    for (let i = source.indexOf('\n', counted); i !== -1 && i <= index; i = source.indexOf('\n', i + 1)) {
      line++;
      lineStart = i + 1;
      counted = i + 1;
    }
    let lineEnd = source.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = source.length;
    return {
      length,
      line,
      column: index - lineStart,
      lineString: lineEnd - lineStart > 1000
        ? `...${source.slice(index - 10, index + 100)}...`
        : source.slice(lineStart, lineEnd)
    };
  });
}
