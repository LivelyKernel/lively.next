/* global it, describe, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { CommentBrowser } from 'lively.collab';
import { Morph } from 'lively.morphic';
import { part } from 'lively.morphic/components/core.js';

describe('comment browser', function () {
  let morph, browser, comment;
  const exampleText = 'Example text';
  const exampleName = 'a test morph';

  beforeEach(function () {
    morph = new Morph().openInWorld();
    morph.name = exampleName;
    browser = part(CommentBrowser).openInWindow().targetMorph;
    comment = $world.addCommentFor(morph, exampleText);
  });

  it('may be opened', function () {
    expect($world.get('Comment Browser'));
  });

  it('has comments displayed', function () {
    let submorphFound = false;
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.isComment && submorph.viewModel.comment.equals(comment)) {
        submorphFound = true;
      }
    });
    expect(submorphFound).to.be.ok;
  });

  it('has idempotent structure', function () {
    const beforeStructure = [];
    browser.withAllSubmorphsDo((submorph) => {
      beforeStructure.push(submorph.name);
    });
    browser.getWindow().close();
    browser = part(CommentBrowser).openInWindow().targetMorph;
    const afterStructure = [];
    browser.withAllSubmorphsDo((submorph) => {
      afterStructure.push(submorph.name);
    });
    expect(beforeStructure).to.deep.equal(afterStructure);
    $world.withAllSubmorphsDo(m => { if (m.isCommentIndicator) m.remove(); });
  });

  it('keeps collapsed comment groups collapsed', function () {
    browser.withAllSubmorphsDo(m => {
      if (m.viewModel && m.viewModel.isCommentGroupModel) m.viewModel.toggleExpanded();
    });
    browser.getWindow().close();

    browser = part(CommentBrowser).openInWindow().targetMorph;
    let isCollapsed = false;
    browser.withAllSubmorphsDo(m => {
      if (m.viewModel && m.viewModel.isCommentGroupModel) isCollapsed = !m.viewModel.isExpanded;
    });
    $world.withAllSubmorphsDo(m => { if (m.isCommentIndicator) m.remove(); });
    expect(isCollapsed).to.be.ok;
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
    const comment2 = $world.addCommentFor(morph, exampleText);
    let label = getCommentCountLabelString();
    expect(label).equals('2');
    $world.removeCommentFor(morph, comment2);
    label = getCommentCountLabelString();
    expect(label).equals('1');
  });

  it('comment may be removed', function () {
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.isComment) {
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

  afterEach(async function () {
    morph.abandon();
    await browser.getWindow().close();
  });
});

describe('comment indicator', function () {
  let morph, browser, indicatorCount;
  const exampleName = 'a test morph';
  const exampleText = 'Example text';

  beforeEach(async function () {
    morph = new Morph().openInWorld();
    morph.name = exampleName;
    browser = part(CommentBrowser).openInWindow().targetMorph;
    $world.addCommentFor(morph, exampleText);
    indicatorCount = 0;
  });

  it('is visible when browser is open', function () {
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length === indicatorCount + 1).to.be.ok;
  });

  it('is hidden when browser is not open', async function () {
    await browser.getWindow().close();
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length === 0).to.be.ok;
  });

  it('does not get copied when morph with comment is copied', function () {
    const copiedMorph = morph.copy(true);
    expect($world.submorphs.filter((submorph) => submorph.isCommentIndicator).length === indicatorCount + 1).to.be.ok;
    copiedMorph.abandon();
  });

  afterEach(async function () {
    morph.abandon();
    if (browser.world()) await browser.getWindow().close();
  });
});

// Tests to add:
// Collapse
// Uncollapse
// Edit
// Badge counts resolved comments
