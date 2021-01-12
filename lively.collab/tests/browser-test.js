/* global System, declare, done, it, xit, describe, xdescribe, beforeEach, afterEach, before, after */
import { expect } from 'mocha-es6';
import { Comment, CommentBrowser } from 'lively.collab';
import { Morph, MorphicEnv } from 'lively.morphic';
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';

describe('comment browser', function () {
  let morph;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';
  let browser;
  let comment;

  beforeEach(async function () {
    morph = new Morph();
    morph.name = exampleName;
    new CommentBrowser();
    browser = CommentBrowser.instance; // This shouldn't be neccessary
    await CommentBrowser.whenRendered();
    comment = await morph.addComment(exampleText);
  });

  it('may be opened', function () {
    expect($world.get('comment browser'));
  });

  it('has only one instance', function () {
    const browser2 = new CommentBrowser();
    expect(browser === browser2);
  });

  it('has comment displayed', async function (done) {
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        done();
      }
    });
    throw new Error('Failed');
  });

  it('has name of morph displayed', async function (done) {
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.textString && submorph.textString.includes(exampleName)) {
        done();
      }
    });
    throw new Error('Failed');
  });

  it('displays user name', async function () {
    let username;
    const creatorUsername = comment.username;
    browser.withAllSubmorphsDo(async (submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        username = submorph.ui.usernameLabel.textString;
      }
    });
    expect(creatorUsername.startsWith(username)).to.be.ok;
    expect(username.length).to.be.above(0);
  });

  it('can resolve comment', async function () {
    comment.unresolve();
    browser.withAllSubmorphsDo(async (submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        submorph.performClickAction('resolve');
      }
    });
    expect(comment.isResolved()).to.be.ok;
  });

  async function getCommentCountLabelString () {
    let label;
    browser.withAllSubmorphsDo(async (submorph) => {
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
    morph.removeComment(comment2);
    label = await getCommentCountLabelString();
    expect(label).equals('1');
  });

  it('comment may be removed', async function () {
    await browser.withAllSubmorphsDo(async (submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        submorph.performClickAction('remove');
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
    CommentBrowser.close();
    morph.emptyComments();
    morph.abandon();
  });
});

describe('comment indicator', function () {
  let morph, browser, comment, indicatorCount;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';

  beforeEach(async function () {
    morph = new Morph();
    morph.name = exampleName;
    new CommentBrowser();
    browser = CommentBrowser.instance; // This shouldn't be neccessary
    await CommentBrowser.whenRendered();
    indicatorCount = browser.getUnresolvedCommentCount();
    comment = await morph.addComment(exampleText);
  });

  it('is visible when browser is open', function () {
    CommentBrowser.open();
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length == indicatorCount + 1).to.be.ok;
  });

  it('is hidden when browser is not open', function () {
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length == 0).to.be.ok;
  });

  it('does not get copied when morph with comment is copied', function () {
    CommentBrowser.open();
    const copiedMorph = morph.copy(true);
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length == indicatorCount + 1).to.be.ok;
    copiedMorph.abandon();
  });

  afterEach(function () {
    CommentBrowser.close();
    morph.emptyComments();
    morph.abandon();
  });
});

// Tests to add:
// Collapse
// Uncollapse
// Edit
// Badge counts resolved comments
