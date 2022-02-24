import { arr, string } from 'lively.lang';

export class FilePatch {
  static read (patchString) { return new this().read(patchString); }

  static readAll (patchString) {
    // read a patch string that contains multiple patches to files
    let patchLines = string.lines(patchString).reduce((patchLines, line) => {
      // A typical patch looks like
      // diff --git a/foo.js b/foo.js
      // index eff30c3..49a21ef 100644
      // --- a/foo.js
      // +++ b/foo.js
      // @@ -781,5 +781,5 @@ ...
      //    a
      // -  b
      // +  c
      // split it at diff ... index
      let last = arr.last(patchLines);
      if (!last) patchLines.push([line]);
      else if (line.match(/^(---|\+\+\+|@@|-|\+|\\| )/)) last.push(line);
      else if (last.length === 1) {
        // if we have just read the command the next line is probably an index...
        last.push(line);
      } else if (line === '') { /* ignore */ } else patchLines.push([line]);
      return patchLines;
    }, []);

    return patchLines.map(ea => FilePatch.read(ea));
  }

  static hunkOrPatchForRow (patches, row = 0) {
    let patchStartRow = 0; let patchEndRow = 0; let patch;
    for (patch of patches) {
      patchEndRow += patch.length();
      if (row < patchEndRow) break;
      patchStartRow = patchEndRow;
    }
    row -= patchStartRow;
    return !patch ? null : patch.hunkForRow(row) || patch;
  }

  constructor () {
    this.lines = [];
    this.headerLines = [];
    this.hunks = [];
    this.pathOriginal = '';
    this.pathChanged = '';
    this.fileNameA = '';
    this.fileNameB = '';
    this.command = '';
  }

  copy () {
    return Object.assign(new this.constructor(), this);
  }

  get isFilePatch () { return true; }

  read (patchStringOrLines) {
    // simple parser for unified patch format;

    this.lines = Array.isArray(patchStringOrLines)
      ? patchStringOrLines
      : string.lines(patchStringOrLines);

    let lines = this.lines.slice();
    let line; let hunks = this.hunks;
    let pathOriginal; let pathChanged;
    if (lines[lines.length - 1] === '') lines.pop();

    // 1: parse header
    // line 0 like: "diff --git a/test.txt b/test.txt\n". Also support
    // directly parse hunks if we see no header.

    let headerLines = this.headerLines = arr.takeWhile(
      lines, (line) => !line.startsWith('---'));

    if (headerLines.length && !headerLines[0].match(/^index/i)) { this.command = headerLines[0]; }

    lines = lines.slice(headerLines.length);
    let [headerFileA, headerFileB] = lines; // extract files from first hunk

    if (headerFileA && headerFileA.startsWith('---')) {
      var [_, name] = headerFileA.match(/^---\s*([^\s]+)/);
      this.pathOriginal = name;
      this.fileNameA = name.replace(/^a\//, '');
      headerLines.push(headerFileA);
    }

    if (headerFileB && headerFileB.startsWith('+++')) {
      var [_, name] = headerFileB.match(/^\+\+\+\s*([^\s]+)/);
      this.pathChanged = name;
      this.fileNameB = name.replace(/^b\//, '');
      headerLines.push(headerFileB);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // parse hunks

    while (lines.length > 0) {
      let hunk = FilePatchHunk.read(lines, pathOriginal, pathChanged);
      pathOriginal = hunk.pathOriginal;
      pathChanged = hunk.pathChanged;
      hunk.patch = this;
      hunks.push(hunk);
    }

    return this;
  }

  reverse () {
    return FilePatch.read(this.createPatchString(true));
  }

  createPatchStringHeader (reverse) {
    return arr.takeWhile(this.headerLines, line => !line.startsWith('---')).join('\n');
  }

  createPatchString (reverse) {
    return this.createPatchStringHeader(reverse) + '\n' +
         this.hunks.map((hunk, i) => hunk.createPatchString(reverse, i === 0)).join('\n') +
         '\n';
  }

  createPatchStringFromRows (startRow, endRow, forReverseApply) {
    let { hunks, headerLines: { length: nHeaderLines } } = this;
    var hunkPatches = [];

    startRow = Math.max(startRow, nHeaderLines) - nHeaderLines;
    endRow -= nHeaderLines;

    let fileInfoIncluded = false;
    var hunkPatches = hunks.map((hunk, i) => {
      let patch = hunk.createPatchStringFromRows(
        startRow, endRow, forReverseApply, !fileInfoIncluded);
      fileInfoIncluded = fileInfoIncluded || !!patch;
      startRow -= hunk.length;
      endRow -= hunk.length;
      return patch;
    }).filter(Boolean);
    return hunkPatches.length === 0
      ? null
      : this.createPatchStringHeader() + '\n' + hunkPatches.join('\n') + '\n';
  }

  changesByLines () {
    return arr.invoke(this.hunks, 'changesByLines').flat();
  }

  length () {
    return this.lines.length;
  }

  patch (s) {
    return this.changesByLines().reduce(function (patchedLines, change, i) {
      let startAddition = change.lineNoAdded - 1;
      let removed = change.removed.replace(/\n$/, '');
      let noLinesRemoved = removed ? string.lines(removed).length : 0;
      let reallyRemoved = patchedLines.slice(startAddition, startAddition + noLinesRemoved).join('\n');

      if (removed !== reallyRemoved) {
        let msg = string.format('Change %s not matching: Expected "%s", got "%s"',
          i + 1, removed, reallyRemoved);
        throw new Error(msg);
      }

      let added = change.added ? change.added : '';
      let endAddition = startAddition + noLinesRemoved;
      let result = patchedLines.slice(0, startAddition)
        .concat(added ? string.lines(added.replace(/\n$/, '')) : [])
        .concat(patchedLines.slice(endAddition));

      // show("%o", result.slice(startAddition-10, endAddition+10));
      return result;
    }, string.lines(s)).join('\n');
  }

  hunkForRow (row) {
    row -= this.headerLines.length;
    if (row < 0) return null;
    return this.hunks.find(({ header, lines }) => {
      row -= (header ? 1 : 0) + lines.length;
      if (row < 0) return true;
    });
  }
}

export class FilePatchHunk {
  static read (patchString, optOriginalPath, optChangedPath) {
    return new this().read(patchString, optOriginalPath, optChangedPath);
  }

  constructor () {
    this.patch = null;
    this.pathOriginal = '';
    this.pathChanged = '';
    this.fileNameA = '';
    this.fileNameB = '';
    this.header = '';
    this.originalLine = -1;
    this.originalLength = -1;
    this.changedLine = -1;
    this.changedLength = -1;
    this.lines = [];
  }

  get isFilePatchHunk () { return true; }

  read (lines, optPathOriginal, optPathChanged) {
    this.pathOriginal = optPathOriginal || '';
    this.pathChanged = optPathChanged || '';
    let length = 0; let line = lines.shift();

    // parse header
    // line 1 customized, depending on tool like "======" or "index zyx...abc"
    while (!line.startsWith('---') && !line.startsWith('@@')) { line = lines.shift(); }

    // lines 2,3 file name removed, file name added
    if (line.startsWith('---')) {
      this.pathOriginal = line.split(' ')[1] || this.pathOriginal;
      line = lines.shift();
    }
    this.fileNameA = this.pathOriginal.replace(/^a\//, '');

    if (line.startsWith('+++')) {
      this.pathChanged = line.split(' ')[1] || this.pathChanged;
      line = lines.shift();
    }
    this.fileNameB = this.pathChanged.replace(/^b\//, '');

    // position in file, like @@ -781,7 +781,7 @@ ...
    let headerMatch = line.match(/^@@\s*-([0-9]+),?([0-9]*)\s*\+([0-9]+),?([0-9]*)\s*@@/);
    console.assert(headerMatch, 'hunk header ' + line);
    this.header = headerMatch[0];
    this.originalLine = Number(headerMatch[1]);
    this.originalLength = Number(headerMatch[2]);
    this.changedLine = Number(headerMatch[3]);
    this.changedLength = Number(headerMatch[4]);

    // parse context/addition/deletions
    while (lines[0] && lines[0].match(/^[\+\-\s\\]/)) {
      this.lines.push(lines.shift());
    }
    this.length = this.lines.length + 1; // for header
    return this;
  }

  createPatchString (reverse, includeOriginalChangedFile) {
    return this.printHeader(reverse, includeOriginalChangedFile) +
         '\n' + this.printLines(reverse);
  }

  createPatchStringFromRows (startRow, endRow, forReverseApply, includeOriginalChangedFile) {
    // this methods takes the diff hunk represented by "this" and produces
    // a new hunk (as a string) that will change only the lines from startRow
    // to endRow. For that it is important to consider whether this patch
    // should be applied to add the patch to a piece if code (forReverseApply
    // = false) or if the code already has the change described by the patch
    // and the change should be removed from the code (forReverseApply = true)
    // Example with forReverseApply = false, startRow: 4, endRow: 5 (-c1, +b2)
    // @@ -1,2 +1,2 @@ -> @@ -1,2 +1,2 @@
    // +a              ->  b1
    // -b1             -> -c1
    // -c1             -> +b2
    // +b2             ->
    // (the existing code does not have line a and we don't want it so
    // simply remove, it has b1 but we don't select so don't remove it, we
    // choose the last two lines, just apply them normally)
    // Example with forReverseApply = true, startRow: 4, endRow: 5 (-c1, +b2)
    // @@ -1,2 +1,2 @@ -> @@ -1,2 +1,2 @@
    // +a              ->  a
    // -b1             -> -c1
    // -c1             -> +b2
    // +b2             ->
    // (the existing code does have a already and we don't want to reverse
    // the add so keep it, the patch removed b1 and we don't want to add it so
    // leave it out, use the rest normally (not inverted!) because patch
    // programs can calculate the revers themselves)

    if (endRow < 1 || startRow >= this.lines.length) return null;

    // row 0 is the header
    let origLine = this.originalLine;
    let changedLine = this.changedLine;
    let origLength = 0;
    let changedLength = 0;
    let header; let copyOp = forReverseApply ? '+' : '-';

    let selection = this.lines.reduce(function (akk, line, i) {
      if (akk.atEnd) return akk;
      i++; // compensate for header
      if (i < startRow) {
        switch (line[0]) {
          case '+':
          case '-': origLine = origLine + akk.lines.length;
            changedLine = changedLine + akk.lines.length;
            changedLength = 0; origLength = 0;
            akk.lines = [];
            return akk;
          case ' ': changedLength++; origLength++; break;
        }
      } else if (i > endRow) {
        switch (line[0]) {
          case ' ': changedLength++; origLength++; break;
          default : akk.atEnd = true; return akk;
        }
      } else {
        switch (line[0]) {
          case ' ': changedLength++; origLength++; break;
          case '-': origLength++; break;
          case '+': changedLength++; break;
        }
      }
      if (forReverseApply) {
        switch (line[0]) {
          case '-': line = '+' + line.slice(1); break;
          case '+': line = '-' + line.slice(1); break;
        }
      }
      akk.lines.push(line);
      return akk;
    }, { atEnd: false, lines: [] });

    let lines = selection.lines;

    if (lines.length === 0) return null;
    let fileHeader = '';
    if (includeOriginalChangedFile) {
      fileHeader = '--- ' + (forReverseApply ? this.pathChanged : this.pathOriginal) +
                 '\n' +
                 '+++ ' + (forReverseApply ? this.pathOriginal : this.pathChanged) +
                 '\n';
    }
    header = string.format('%s@@ -%s,%s +%s,%s @@',
      fileHeader, origLine, origLength, changedLine, changedLength);
    return [header].concat(lines).join('\n');
  }

  changesByLines () {
    let self = this;
    let baseLineAdded = this.changedLine;
    let baseLineRemoved = this.originalLine;
    let lineDiff = 0;
    let result = this.lines.reduce((result, line, i) => {
      if (line[0] === ' ') {
        if (result.current) {
          result.changes.push(result.current);
          result.current = null;
        }
        return result;
      }

      let change = result.current ||
                   (result.current = {
                     lineNoAdded: baseLineAdded + i + lineDiff,
                     lineNoRemoved: baseLineRemoved + i + lineDiff,
                     added: '',
                     removed: ''
                   });

      if (line[0] === '+') { change.added += line.slice(1) + '\n'; lineDiff++; } else if (line[0] === '-') { change.removed += line.slice(1) + '\n'; lineDiff--; }
      return result;
    }, { changes: [], current: null });
    if (result.current) result.changes.push(result.current);
    return result.changes;
  }

  relativeOffsetToFileLine (offset) {
    // given a line offset into the hunk, to which line no of the patched
    // file does it translate?
    return offset <= 0
      ? this.changedLine - 1
      : this.lines.slice(0, offset).reduce((lineNo, line) => {
        let c = line[0];
        return (c === '+' || c === ' ') ? lineNo + 1 : lineNo;
      }, this.changedLine - 2);
  }

  printHeader (reverse, includeOriginalChangedFile) {
    let fileHeader = '';
    if (includeOriginalChangedFile) {
      fileHeader = '--- ' + (reverse ? this.pathChanged : this.pathOriginal) +
                 '\n' +
                 '+++ ' + (reverse ? this.pathOriginal : this.pathChanged) +
                 '\n';
    }
    let sub = reverse
      ? this.changedLine + ',' + this.changedLength
      : this.originalLine + ',' + this.originalLength;
    let add = reverse
      ? this.originalLine + ',' + this.originalLength
      : this.changedLine + ',' + this.changedLength;
    return string.format('%s@@ -%s +%s @@', fileHeader, sub, add);
  }

  printLines (reverse) {
    return (reverse
      ? this.lines.map(function (line) {
        switch (line[0]) {
          case ' ': return line;
          case '+': return '-' + line.slice(1);
          case '-': return '+' + line.slice(1);
        }
      })
      : this.lines).join('\n');
  }
}
