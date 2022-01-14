/* global it, describe, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { CommentBrowser } from 'lively.collab';
import { Morph } from 'lively.morphic';
import { part } from 'lively.morphic/components/core.js';

let comment;

describe('comment browser', function () {
  let morph;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';
  let browser;

  beforeEach(async function () {
    morph = new Morph().openInWorld();
    morph.name = exampleName;
    browser = part(CommentBrowser).openInWindow().targetMorph;
    comment = await morph.addComment(exampleText);
  });

  it('may be opened', function () {
    expect($world.get('Comment Browser'));
  });

  it('has comments displayed', function () {
    let submorphFound = false;
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.viewModel && submorph.viewModel.comment && submorph.viewModel.comment.equals(comment)) {
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
      if (submorph.viewModel && submorph.viewModel.comment && submorph.viewModel.comment.equals(comment)) {
        username = submorph.viewModel.ui.userNameLabel.textString;
      }
    });
    expect(creatorUsername.startsWith(username)).to.be.ok;
    expect(username.length).to.be.above(0);
  });

  it('can resolve comment', function () {
    browser.withAllSubmorphsDo(submorph => {
      if (submorph.viewModel && submorph.viewModel.comment && submorph.viewModel.comment.equals(comment)) {
        submorph.viewModel.toggleResolveStatus();
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
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.viewModel && submorph.viewModel.comment) {
        submorph.viewModel.removeComment();
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
    morph.abandon();
    browser.owner.close();
  });
});

describe('comment indicator', function () {
  let morph, browser, indicatorCount;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';

  beforeEach(async function () {
    morph = new Morph();
    morph.name = exampleName;
    morph.openInWorld();
    browser = part(CommentBrowser).openInWindow().targetMorph;
    comment = await morph.addComment(exampleText);
    indicatorCount = 0;
  });

  it('is visible when browser is open', function () {
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length === indicatorCount + 1).to.be.ok;
  });

  it('is hidden when browser is not open', function () {
    browser.owner.close();
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length === 0).to.be.ok;
  });

  it('does not get copied when morph with comment is copied', function () {
    const copiedMorph = morph.copy(true);
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length === indicatorCount + 1).to.be.ok;
    copiedMorph.abandon();
  });

  afterEach(function () {
    morph.abandon();
    browser.owner.close();
  });
});

// Tests to add:
// Collapse
// Uncollapse
// Edit
// Badge counts resolved comments
