import { FilePatch } from './file-patch.js';

export default class DiffTokenizer {
  tokenize (string) {
    let patches = FilePatch.readAll(string);
    let start = { row: 0, column: 0 };
    let tokens = [];

    let patchI = 0;
    for (let patch of patches) {
      // patch header
      let end = { column: 0, row: start.row + patch.headerLines.length };
      let token = {
        patch: patchI,
        string: patch.headerLines.join('\n') + '\n',
        type: 'diff-file-header',
        start,
        end
      };
      tokens.push(token); patch.tokens = [token];
      start = end;

      let hunkI = 0;
      for (let hunk of patch.hunks) {
        // hunk header
        end = { column: 0, row: start.row + 1 };
        token = {
          patch: patchI,
          hunk: hunkI,
          string: hunk.header + '\n',
          type: 'diff-hunk-header',
          start,
          end
        };
        tokens.push(token); patch.tokens.push(token); hunk.tokens = [token];
        start = end;

        // hunk lines
        for (let line of hunk.lines) {
          end = { column: 0, row: start.row + 1 };
          let type = line.startsWith('+') ? 'inserted' : line.startsWith('-') ? 'deleted' : 'default';
          token = {
            patch: patchI,
            hunk: hunkI,
            string: line + '\n',
            type,
            start,
            end
          };
          tokens.push(token); patch.tokens.push(token); hunk.tokens.push(token);
          start = end;
        }
        hunkI++;
      }
      patchI++;
    }

    return { tokens, patches };
  }
}
