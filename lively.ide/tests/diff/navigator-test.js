/* global it, describe, before, after */
import { expect } from 'mocha-es6';

import { Text } from 'lively.morphic';
import DiffNavigator from 'lively.ide/diff/navigator.js';
import DiffEditorPlugin from 'lively.ide/diff/editor-plugin.js';

let editor;

async function setup () {
  let patchString = 'diff --git a/test.txt b/test.txt\n' +
                   'index e42fd89..581f1fd 100644\n' +
                   '--- a/test.txt\n' +
                   '+++ b/test.txt\n' +
                   '@@ -2,3 +2,3 @@\n' +
                   ' a\n' +
                   '-b\n' +
                   '+c\n' +
                   ' d\n' +
                   '@@ -2,3 +2,3 @@\n' +
                   ' a\n' +
                   '-b\n' +
                   '+c\n' +
                   ' d\n' +
                   'diff --git a/test2.txt b/test2.txt\n' +
                   'index e42fd89..581f1fd 100644\n' +
                   '--- a/test2.txt\n' +
                   '+++ b/test2.txt\n' +
                   '@@ -2,3 +2,3 @@\n' +
                   ' a\n' +
                   '-b\n' +
                   '+c\n' +
                   ' d\n' +
                   'diff --git a/test3.txt b/test3.txt\n' +
                   'index e42fd89..581f1fd 100644\n' +
                   '--- a/test3.txt\n' +
                   '+++ b/test3.txt\n' +
                   '@@ -2,3 +2,3 @@\n' +
                   ' u\n' +
                   '-v\n' +
                   '+w\n' +
                   ' x\n';
  editor = new Text({
    textString: patchString,
    lineWrapping: false,
    plugins: [new DiffEditorPlugin()],
    readOnly: false
  });
  editor.openInWorld();
  await editor.whenRendered();
}

function teardown (whenDone) {
  editor.remove();
}

let r = (startRow, startCol, endRow, endCol) => ({
  start: { row: startRow, column: startCol },
  end: { row: endRow, column: endCol }
});

describe('diff navigator', () => {
  before(() => setup());
  after(() => teardown());

  it('find hunk start end', function () {
    let nav = new DiffNavigator(); let result;

    result = nav.findContainingHunkOrPatchRange(editor, r(0, 0, 0, 0));
    expect(r(0, 0, 14, 0)).deep.equals(result);

    result = nav.findContainingHunkOrPatchRange(editor, r(11, 0, 11, 0));
    expect(r(9, 0, 14, 0)).deep.equals(result);
    result = nav.findContainingHunkOrPatchRange(editor, r(4, 0, 4, 0));
    expect(r(4, 0, 9, 0)).deep.equals(result);
    result = nav.findContainingHunkOrPatchRange(editor, r(4, 0, 4, 0));
    expect(r(4, 0, 9, 0)).deep.equals(result);

    // ranges
    result = nav.findContainingHunkOrPatchRange(editor, r(6, 0, 8, 0));
    expect(r(4, 0, 9, 0)).deep.equals(result);
    result = nav.findContainingHunkOrPatchRange(editor, r(7, 2, 11, 2));
    expect(r(0, 0, 14, 0)).deep.equals(result);
    result = nav.findContainingHunkOrPatchRange(editor, r(9, 0, 13, 0));
    expect(r(9, 0, 14, 0)).deep.equals(result);
    result = nav.findContainingHunkOrPatchRange(editor, r(9, 0, 14, 0));
    expect(null).deep.equals(result); // overlaps to next
    result = nav.findContainingHunkOrPatchRange(editor, r(15, 0, 17, 0));
    expect(r(14, 0, 23, 0)).deep.equals(result);
  });
});
