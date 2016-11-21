/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { arr } from "lively.lang";
import { FilePatch, FilePatchHunk } from "lively.morphic/ide/diff/file-patch.js";

describe("diff and patch", () => {

  it("returns hunk for row", function() {
    var patchString = "diff --git a/test.txt b/test.txt\n"
            + "index e42fd89..581f1fd 100644\n"
            + "--- a/test.txt\n"
            + "+++ b/test.txt\n"
            + "@@ -2,3 +2,3 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + " d\n"
            + "@@ -5,3 +5,4 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + "+c\n"
            + " d\n";

    var patch = FilePatch.read(patchString);
    expect(null).equals(patch.hunkForRow(3));
    expect(patch.hunks[0]).equals(patch.hunkForRow(4));
    expect(patch.hunks[0]).equals(patch.hunkForRow(8));
    expect(patch.hunks[1]).equals(patch.hunkForRow(9));
  });
  
  it("returns hunk for row of multiple patched", function() {
    var patchString = "diff --git a/test.txt b/test.txt\n"
                    + "index e42fd89..581f1fd 100644\n"
                    + "--- a/test.txt\n"
                    + "+++ b/test.txt\n"
                    + "@@ -2,3 +2,3 @@\n"
                    + " a\n"
                    + "-b\n"
                    + "+c\n"
                    + " d\n"
                    + "@@ -5,3 +5,4 @@\n"
                    + " a\n"
                    + "-b\n"
                    + "+c\n"
                    + "+c\n"
                    + " d\n"
                    + "diff --git a/test.txt b/test.txt\n"
                    + "--- a/test.txt\n"
                    + "+++ b/test.txt\n"
                    + "@@ -3,1 +3,2 @@\n"
                    + "+capitalization of $3.5 billion\n"
                    + " economies such as the U.S.\n"
                    + "@@ -20,2 +20,3 @@\n"
                    + " diff could be considered\n"
                    + "+123\n"
                    + " can be followed by the heading\n";

    var patches = FilePatch.readAll(patchString);
    expect(patches[0]).equals(FilePatch.hunkOrPatchForRow(patches, 3));
    expect(patches[0].hunks[0]).equals(FilePatch.hunkOrPatchForRow(patches, 4));
    expect(patches[0].hunks[1]).equals(FilePatch.hunkOrPatchForRow(patches, 14));
    expect(patches[1]).equals(FilePatch.hunkOrPatchForRow(patches, 15));
    expect(patches[1].hunks[0]).equals(FilePatch.hunkOrPatchForRow(patches, 30));
  });
  
  it("get line of file", function() {
    var patchString = "diff --git a/test.txt b/test.txt\n"
            + "index e42fd89..581f1fd 100644\n"
            + "--- a/test.txt\n"
            + "+++ b/test.txt\n"
            + "@@ -2,3 +2,3 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + " d\n"
            + "@@ -5,3 +5,4 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + "+c\n"
            + " d\n";

    var patch = FilePatch.read(patchString);
    expect(4).equals(patch.hunks[1].relativeOffsetToFileLine(0));
    expect(4).equals(patch.hunks[1].relativeOffsetToFileLine(1));
    expect(4).equals(patch.hunks[1].relativeOffsetToFileLine(2));
    expect(5).equals(patch.hunks[1].relativeOffsetToFileLine(3));
    expect(6).equals(patch.hunks[1].relativeOffsetToFileLine(4));
    expect(7).equals(patch.hunks[1].relativeOffsetToFileLine(5));
  });

  it("parse patch", function() {
    var patchString = "diff --git a/test.txt b/test.txt\n"
      + "index bb53c45..3b6c223 100644\n"
      + "--- a/test.txt\n"
      + "+++ b/test.txt\n"
      + "@@ -2,3 +2,3 @@ Bitcoins are used in a small, open, pure-exchange economy embedded within many\n"
      + " of the world's largest, open, production economies. Even with a market\n"
      + "-capitalization of $2.5 billion, the bitcoin economy is dwarfed by $15 trillion\n"
      + "+capitalization of $2.5 billion, the bitcoin economy is dwarfed hey by $15 trillion\n"
      + " economies such as the U.S. Therefore, sudden and large increases in the user\n"
      + "@@ -20,2 +20,3 @@ information does not correspond with the number of lines in the hunk, then the\n"
      + " diff could be considered invalid and be rejected. Optionally, the hunk range\n"
      + "+123\n"
      + " can be followed by the heading of the section or function that the hunk is\n"
      + "@@ -25,3 +26,3 @@ matching.[8] If a line is modified, it is represented as a deletion and\n"
      + " addition. Since the hunks of the original and new file appear in the same\n"
      + "-hunk, such changes would appear adjacent to one another.[9] An occurrence of\n"
      + "+hunk, foo such changes would appear adjacent to one another.[9] An occurrence of\n"
      + " this in the example below is:";
    var patch = FilePatch.read(patchString);

    // header
    expect('diff --git a/test.txt b/test.txt').equals(patch.command);
    expect('test.txt').equals(patch.fileNameA);
    expect('test.txt').equals(patch.fileNameB);
    expect('a/test.txt').equals(patch.pathOriginal);
    expect('b/test.txt').equals(patch.pathChanged);

    // hunks
    var hunks = patch.hunks;
    expect(3).equals(hunks.length);

    // hunnk 0
    expect(2).equals(hunks[0].originalLine);
    expect(3).equals(hunks[0].originalLength);
    expect(2).equals(hunks[0].changedLine);
    expect(3).equals(hunks[0].changedLength);
    expect(5).equals(hunks[0].length);
    var expectedHunkString = "@@ -2,3 +2,3 @@\n"
      + " of the world's largest, open, production economies. Even with a market\n"
      + "-capitalization of $2.5 billion, the bitcoin economy is dwarfed by $15 trillion\n"
      + "+capitalization of $2.5 billion, the bitcoin economy is dwarfed hey by $15 trillion\n"
      + " economies such as the U.S. Therefore, sudden and large increases in the user"
    expect(expectedHunkString).equals(hunks[0].createPatchString());
  });

  it("hunks have right file name", function() {
    var patchString = "diff --git a/test.txt b/test.txt\n"
            + "index e42fd89..581f1fd 100644\n"
            + "--- a/test.txt\n"
            + "+++ b/test.txt\n"
            + "@@ -2,3 +2,3 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + " d\n"
            + "@@ -2,3 +2,3 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + " d\n"
            + "diff --git a/test2.txt b/test2.txt\n"
            + "index e42fd89..581f1fd 100644\n"
            + "--- a/test2.txt\n"
            + "+++ b/test2.txt\n"
            + "@@ -2,3 +2,3 @@\n"
            + " a\n"
            + "-b\n"
            + "+c\n"
            + " d\n";

    var patch = FilePatch.read(patchString);
    expect("test.txt").equals(patch.hunks[0].fileNameA);
    expect("test.txt").equals(patch.hunks[0].fileNameB);
    expect("test.txt").equals(patch.hunks[1].fileNameA);
    expect("test.txt").equals(patch.hunks[1].fileNameB);
    expect("test2.txt").equals(patch.hunks[2].fileNameA);
    expect("test2.txt").equals(patch.hunks[2].fileNameB);
  });

  it("create hunk from selected rows", function() {
    var origHunk = "@@ -2,4 +2,5 @@ xxx yyy\n"
           + " hello world\n"
           + "-this lines is removed\n"
           + "+this lines is added\n"
           + "+this line as well\n"
           + " foo bar baz\n"
           + " har har har";
    var hunk = new FilePatchHunk().read(origHunk.split('\n'));
    var result, expected;

    result = hunk.createPatchStringFromRows(4,6);
    expected = "@@ -3,2 +3,3 @@\n"
         + "+this line as well\n"
         + " foo bar baz\n"
         + " har har har";
    expect(expected).equals(result, 'at end');

    result = hunk.createPatchStringFromRows(2,3);
    expected = "@@ -2,2 +2,2 @@\n"
        + " hello world\n"
        + "-this lines is removed\n"
        + "+this lines is added";
    expect(expected).equals(result, 'add and remove');

    result = hunk.createPatchStringFromRows(3,3);
    expected = "@@ -3,0 +3,1 @@\n"
        + "+this lines is added"
    expect(expected).equals(result, 'just add');

    result = hunk.createPatchStringFromRows(7,9);
    expected = null;
    expect(expected).equals(result, 'outside');

    result = hunk.createPatchStringFromRows(4,9);
    expected = "@@ -3,2 +3,3 @@\n"
        + "+this line as well\n"
        + " foo bar baz\n"
        + " har har har";
    expect(expected).equals(result, 'too long');
  });
  
  it("create patch from selected rows", function() {
    var patchString = "diff --git a/test.txt b/test.txt\n"
            + "--- a/test.txt\n"
            + "+++ b/test.txt\n"
            + "@@ -2,3 +2,3 @@ Bitcoins are used in a small, open, pure-exchange economy embedded within many\n"
            + " of the world's largest\n"
            + "-capitalization of $2.5 billion\n"
            + "+capitalization of $3.5 billion\n"
            + " economies such as the U.S.\n"
            + "@@ -20,2 +20,3 @@ information does not\n"
            + " diff could be considered\n"
            + "+123\n"
            + " can be followed by the heading\n"
            + "@@ -25,3 +26,3 @@ matching.[8]\n"
            + " addition. Since the hunks\n"
            + "-hunk, such changes\n"
            + "+hunk, foo such changes\n"
            + " this in the";
    var patch = FilePatch.read(patchString);
    var result, expected;

    // just the hunk header
    result = patch.createPatchStringFromRows(3,3);
    expected = null;
    expect(expected).equals(result, "just the hunk header");

    result = patch.createPatchStringHeader();
    result = patch.createPatchStringFromRows(3,4);
    expected = "diff --git a/test.txt b/test.txt\n"
         + "--- a/test.txt\n"
         + "+++ b/test.txt\n"
         + "@@ -2,1 +2,1 @@\n"
         + " of the world's largest\n";
    expect(result).equals(expected, "just the hunk header and one context line");

    result = patch.createPatchStringFromRows(3,7);
    expected = "diff --git a/test.txt b/test.txt\n"
         + "--- a/test.txt\n"
         + "+++ b/test.txt\n"
         + "@@ -2,3 +2,3 @@\n"
         + " of the world's largest\n"
         + "-capitalization of $2.5 billion\n"
         + "+capitalization of $3.5 billion\n"
         + " economies such as the U.S.\n";
    expect(expected).equals(result, "first hunk");

    result = patch.createPatchStringFromRows(6, 10);
    expected = "diff --git a/test.txt b/test.txt\n"
         + "--- a/test.txt\n"
         + "+++ b/test.txt\n"
         + "@@ -3,1 +3,2 @@\n"
         + "+capitalization of $3.5 billion\n"
         + " economies such as the U.S.\n"
         + "@@ -20,2 +20,3 @@\n"
         + " diff could be considered\n"
         + "+123\n"
         + " can be followed by the heading\n";
    expect(expected).equals(result, "first two hunks overlapping");
  });

  it("patch string from rows for reverse", function() {
    var patch, result, expected, patchString;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    patchString = "diff --git a/test.txt b/test.txt\n"
      + "index bb53c45..3b6c223 100644\n"
      + "--- a/test.txt\n"
      + "+++ b/test.txt\n"
      + "@@ -2,5 +2,2 @@\n"
      + " a\n"
      + "-b\n"
      + "-c\n"
      + "-d\n"
      + " e\n";
    patch = FilePatch.read(patchString);
    result = patch.createPatchStringFromRows(7,8, true/*reverse*/); // -c,-d
    expected = "diff --git a/test.txt b/test.txt\n"
        + "index bb53c45..3b6c223 100644\n"
         + "--- b/test.txt\n"
         + "+++ a/test.txt\n"
         + "@@ -3,3 +3,1 @@\n"
         + "+c\n"
         + "+d\n"
         + " e\n"
    expect(result).equals(expected, "1");

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    patchString = "diff --git a/test.txt b/test.txt\n"
                + "index bb53c45..3b6c223 100644\n"
                + "--- a/test.txt\n"
                + "+++ b/test.txt\n"
                + "@@ -2,5 +2,3 @@\n"
                + " a\n"
                + "-b\n"
                + "-c\n"
                + "-d\n"
                + " e\n"
                + "+f\n";
    patch = FilePatch.read(patchString);
    result = patch.createPatchStringFromRows(7,8, true/*reverse*/); // -c,-d
    expected = "diff --git a/test.txt b/test.txt\n"
             + "index bb53c45..3b6c223 100644\n"
             + "--- b/test.txt\n"
             + "+++ a/test.txt\n"
             + "@@ -3,3 +3,1 @@\n"
             + "+c\n"
             + "+d\n"
             + " e\n"
    expect(result).equals(expected, "2");

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    patchString = "diff --git a/test.txt b/test.txt\n"
                + "index bb53c45..3b6c223 100644\n"
                + "--- a/test.txt\n"
                + "+++ b/test.txt\n"
                + "@@ -2,2 +2,5 @@\n"
                + "+b\n"
                + "+c\n"
                + "+d\n"
                + " e\n";
    patch = FilePatch.read(patchString);
    result = patch.createPatchStringFromRows(7,7, true/*reverse*/); // +c
    expected = "diff --git a/test.txt b/test.txt\n"
             + "index bb53c45..3b6c223 100644\n"
             + "--- b/test.txt\n"
             + "+++ a/test.txt\n"
             + "@@ -2,1 +2,2 @@\n"
             + "-d\n"
             + " e\n"
    expect(result).equals(expected, "3");

    patchString = "diff --git a/test.txt b/test.txt\n"
                + "index bb53c45..3b6c223 100644\n"
                + "--- a/test.txt\n"
                + "+++ b/test.txt\n"
                + "@@ -2,2 +2,3 @@\n"
                + " a\n"
                + "-b1\n"
                + "+b2\n"
                + "+c\n";
    patch = FilePatch.read(patchString);
    result = patch.createPatchStringFromRows(7,7, true/*reverse*/); // +b2
    expected = "diff --git a/test.txt b/test.txt\n"
             + "index bb53c45..3b6c223 100644\n"
             + "--- b/test.txt\n"
             + "+++ a/test.txt\n"
             + "@@ -3,0 +3,1 @@\n"
             + "-b2\n"
    expect(result).equals(expected, "4");

    patchString = "diff --git a/test.txt b/test.txt\n"
                + "index bb53c45..3b6c223 100644\n"
                + "--- a/test.txt\n"
                + "+++ b/test.txt\n"
                + "@@ -2,3 +2,3 @@\n"
                + " a\n"
                + "-b1\n"
                + "-c1\n"
                + "+b2\n"
                + "+c2\n";
    patch = FilePatch.read(patchString);
    result = patch.createPatchStringFromRows(7,8, true/*reverse*/); // -c1, +b2
    expected = "diff --git a/test.txt b/test.txt\n"
             + "index bb53c45..3b6c223 100644\n"
             + "--- b/test.txt\n"
             + "+++ a/test.txt\n"
             + "@@ -3,1 +3,1 @@\n"
             + "+c1\n"
             + "-b2\n"
    expect(result).equals(expected, "5");
  });

  it("get changed lines", function() {
    var diff = "Index: no file\n"
         + "===================================================================\n"
         + "--- no file\n"
         + "+++ no file\n"
         + "@@ -97,9 +97,7 @@\n"
         + " 96\n"
         + "-97\n"
         + " 98\n"
         + " 99\n"
         + "-100\n"
         + " 101\n"
         + " 102\n"
         + " 103\n"
         + " 104\n"
         + "@@ -197,9 +195,11 @@\n"
         + " 196\n"
         + " 197\n"
         + " 198\n"
         + " 199\n"
         + "+XXX\n"
         + "+YYY\n"
         + "+ZZZ\n"
         + "-200\n"
         + " 201\n"
         + " 202\n"
         + " 203\n"
         + " 204\n"
         + "@@ -297,9 +297,9 @@\n"
         + " 296\n"
         + " 297\n"
         + " 298\n"
         + " 299\n"
         + "+300X\n"
         + "-300\n"
         + " 301\n"
         + " 302\n"
         + " 303\n"
         + " 304\n";

    var patch = FilePatch.read(diff);
    var lines = patch.changesByLines();
    var expected = [
      {lineNoRemoved: 98, lineNoAdded: 98, removed: "97\n", added: ""},
      {lineNoRemoved: 100, lineNoAdded: 100, removed: "100\n", added: ""},
      {lineNoRemoved: 201, lineNoAdded: 199, removed: "200\n", added: "XXX\nYYY\nZZZ\n"},
      {lineNoRemoved: 301, lineNoAdded: 301, removed: "300\n", added: "300X\n"}
    ]
    expect(expected).deep.equals(lines);
  });

  it("successful patch", function() {
    var diff = "Index: no file\n"
         + "===================================================================\n"
         + "--- no file\n"
         + "+++ no file\n"
         + "@@ -97,9 +97,7 @@\n"
         + " 96\n"
         + "-97\n"
         + " 98\n"
         + " 99\n"
         + "-100\n"
         + " 101\n"
         + " 102\n"
         + " 103\n"
         + " 104\n"
         + "@@ -197,9 +195,11 @@\n"
         + " 196\n"
         + " 197\n"
         + " 198\n"
         + " 199\n"
         + "+XXX\n"
         + "+YYY\n"
         + "+ZZZ\n"
         + "-200\n"
         + " 201\n"
         + " 202\n"
         + " 203\n"
         + " 204\n"
         + "@@ -297,9 +297,9 @@\n"
         + " 296\n"
         + " 297\n"
         + " 298\n"
         + " 299\n"
         + "+300X\n"
         + "-300\n"
         + " 301\n"
         + " 302\n"
         + " 303\n"
         + " 304\n";

    var patch = FilePatch.read(diff),
      a = arr.range(0,400).join("\n") + "\n",
      b = a.replace("\n97\n", "\n")
         .replace("\n100\n", "\n")
         .replace("\n200\n", "\nXXX\nYYY\nZZZ\n")
         .replace("\n300\n", "\n300X\n"),
      result = patch.patch(a);
    expect(b).equals(result);
  });

  it("unsuccessful patch", function() {
    var diff = "Index: no file\n"
         + "===================================================================\n"
         + "--- no file\n"
         + "+++ no file\n"
         + "@@ -97,9 +97,7 @@\n"
         + " 96\n"
         + "-97\n"
         + " 98\n"
         + " 99\n"
         + "-100\n"
         + " 101\n"
         + " 102\n"
         + " 103\n"
         + " 104\n"
         + "@@ -197,9 +195,11 @@\n"
         + " 196\n"
         + " 197\n"
         + " 198\n"
         + " 199\n"
         + "+XXX\n"
         + "+YYY\n"
         + "+ZZZ\n"
         + "-AAA\n"
         + " 201\n"
         + " 202\n"
         + " 203\n"
         + " 204\n"
         + "@@ -297,9 +297,9 @@\n"
         + " 296\n"
         + " 297\n"
         + " 298\n"
         + " 299\n"
         + "+300X\n"
         + "-300\n"
         + " 301\n"
         + " 302\n"
         + " 303\n"
         + " 304\n";

    var patch = FilePatch.read(diff),
      a = arr.range(0,400).join("\n") + "\n";
    try { patch.patch(a); } catch (e) {
      expect("Change 3 not matching: Expected \"AAA\", got \"200\"").equals(e.message);
      return;
    }
    expect().assert(false, "patch successful?")
  });

  it("print diff reverse", function() {
    var orig = arr.range(0,10).join("\n") + "\n";
    var changed = orig.replace("\n5\n", "\nHello\nWorld\n");
    var diff = "Index: foo\n"
           + "--- foo\n"
           + "+++ foo\n"
           + "@@ -2,9 +2,10 @@\n"
           + " 1\n"
           + " 2\n"
           + " 3\n"
           + " 4\n"
           + "+Hello\n"
           + "+World\n"
           + "-5\n"
           + " 6\n"
           + " 7\n"
           + " 8\n"
           + " 9\n"

    var reverseDiff = "Index: foo\n"
            + "--- foo\n"
            + "+++ foo\n"
            + "@@ -2,10 +2,9 @@\n"
            + " 1\n"
            + " 2\n"
            + " 3\n"
            + " 4\n"
            + "-Hello\n"
            + "-World\n"
            + "+5\n"
            + " 6\n"
            + " 7\n"
            + " 8\n"
            + " 9\n"

    var patch = FilePatch.read(diff);

    patch
    // lively.ide.diff(orig, changed)
    // lively.ide.diff(changed, orig)

    var resultForward = patch.createPatchString();
    expect(diff).equals(resultForward, "normal diff");

    var resultReverse = patch.createPatchString(true)
    expect(reverseDiff).equals(resultReverse, "reverse");

  });

  it("successful patch reverse", function() {
    var orig = arr.range(0,10).join("\n") + "\n";
    var changed = orig.replace("\n5\n", "\nHello\nWorld\n");
    var diff = "Index: foo\n"
           + "--- foo\n"
           + "+++ foo\n"
           + "@@ -2,9 +2,10 @@\n"
           + " 1\n"
           + " 2\n"
           + " 3\n"
           + " 4\n"
           + "+Hello\n"
           + "+World\n"
           + "-5\n"
           + " 6\n"
           + " 7\n"
           + " 8\n"
           + " 9\n"

    var patch = FilePatch.read(diff).reverse(),
      result = patch.patch(changed);
    expect(orig).equals(result);
  });

});