/* global System, declare, done, it, xit, describe, xdescribe, beforeEach, afterEach, before, after */
import { expect } from 'mocha-es6';
import { CommentBrowser } from 'lively.collab';
import { Morph } from 'lively.morphic';

describe('comment browser', function () {
  let morph;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';
  let browser;
  let comment;

  beforeEach(async function () {
    morph = new Morph();
    morph.name = exampleName;
    browser = CommentBrowser.instance; // This shouldn't be neccessary
    await CommentBrowser.whenRendered();
    comment = await morph.addComment(exampleText);
  });

  it('may be opened', function () {
    expect($world.get('comment browser'));
  });

  it('has only one instance', function () {
    const browser2 = CommentBrowser.open();
    expect(browser === browser2);
  });

  it('has comment displayed', function () {
    let submorphFound = false;
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        submorphFound = true;
      }
    });
    expect(submorphFound).to.be.ok;
  });

  it('has name of morph displayed', function () {
    let submorphFound = false;
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.textString && submorph.textString.includes(exampleName)) {
        submorphFound = true;
      }
    });
    expect(submorphFound).to.be.ok;
  });

  it('displays user name', function () {
    let username;
    const creatorUsername = comment.username;
    browser.withAllSubmorphsDo(submorph => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        username = submorph.ui.usernameLabel.textString;
      }
    });
    expect(creatorUsername.startsWith(username)).to.be.ok;
    expect(username.length).to.be.above(0);
  });

  it('can resolve comment', function () {
    comment.unresolve();
    browser.withAllSubmorphsDo(submorph => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        submorph.performClickAction('resolve');
      }
    });
    expect(comment.isResolved()).to.be.ok;
  });

  function getCommentCountLabelString () {
    let label;
    browser.withAllSubmorphsDo(submorph => {
      if (submorph.name === 'comment count label') {
        label = submorph.textString;
      }
    });
    return label;
  }

  it('comment count label counts comments', async function () {
    const comment2 = await morph.addComment(exampleText);
    let label = await getCommentCountLabelString();
    expect(label).equals('2');
    await morph.removeComment(comment2);
    label = await getCommentCountLabelString();
    expect(label).equals('1');
  });

  it('comment may be removed', async function () {
    browser.withAllSubmorphsDo(async (submorph) => {
      if (submorph.comment) {
        await submorph.performClickAction('remove');
      }
    });
    let commentMorphLabel;
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.textString && submorph.textString.includes(exampleName)) {
        commentMorphLabel = submorph;
      }
    });

    expect(commentMorphLabel).to.be.not.ok;
  });

  afterEach(function () {
    morph.emptyComments();
    morph.abandon();
    CommentBrowser.close();
  });
});

describe('comment indicator', function () {
  let morph, browser, comment, indicatorCount;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';

  beforeEach(async function () {
    morph = new Morph();
    morph.name = exampleName;
    morph.openInWorld();
    browser = CommentBrowser.instance; // This shouldn't be neccessary
    CommentBrowser.open();
    await CommentBrowser.whenRendered();
    indicatorCount = browser.getUnresolvedCommentCount();
    comment = await morph.addComment(exampleText);
  });

  it('is visible when browser is open', function () {
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length == indicatorCount + 1).to.be.ok;
  });

  it('is hidden when browser is not open', function () {
    CommentBrowser.close();
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length == 0).to.be.ok;
  });

  it('does not get copied when morph with comment is copied', function () {
    const copiedMorph = morph.copy(true);
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length == indicatorCount + 1).to.be.ok;
    copiedMorph.abandon();
  });

  afterEach(function () {
    morph.abandon();
    CommentBrowser.close();
  });
});

// Tests to add:
// Collapse
// Uncollapse
// Edit
// Badge counts resolved comments
