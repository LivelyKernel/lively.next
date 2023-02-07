/* global it, describe,beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { CommentData } from 'lively.collab';
import { Morph } from 'lively.morphic';

function morphHasNumberOfComments (morph, number) {
  if (number === 0) {
    if (!$world.morphCommentMap.has(morph)) return true;
  }
  return $world.morphCommentMap.get(morph).length === number;
}

function morphHasNoComments (morph) {
  return morphHasNumberOfComments(morph, 0);
}

describe('comment object', function () {
  let comment;
  const exampleText = 'Example text';

  beforeEach(function () {
    comment = new CommentData(exampleText);
  });

  it('has text', function () {
    expect(comment.text).equals(exampleText);
  });

  it('is different from comment with same text', function () {
    const comment2 = new CommentData(comment.text);
    expect(comment.text).equals(comment2.text);
    expect(comment.equals(comment2)).equals(false);
  });

  it('can toggle resolve status', function () {
    expect(comment.isResolved()).equals(false);
    comment.toggleResolveStatus();
    expect(comment.isResolved());
    comment.toggleResolveStatus();
    expect(comment.isResolved()).equals(false);
  });

  it('is saved with a user name', function () {
    expect(comment.username).to.equal($world.currentUser);
  });
});

describe('morph', function () {
  let morph;
  const exampleText = 'Example text';
  let comment;

  beforeEach(function () {
    morph = new Morph();
  });

  it('has no comment', function () {
    expect(morphHasNoComments(morph));
  });

  it('a comment may be added', function () {
    comment = $world.addCommentFor(morph, exampleText);
    expect(morphHasNumberOfComments(morph, 1));
    expect(morph.comments[0].text).equals(exampleText);
  });

  it('a comment may be removed', function () {
    comment = $world.addCommentFor(morph, exampleText);
    expect(morph.comments[0].equals(comment)).to.be.ok;
    $world.removeCommentFor(morph, comment);
    expect(morphHasNoComments(morph)).to.be.ok;
  });

  it('comments may be emptied', function () {
    $world.addCommentFor(morph, exampleText);
    $world.addCommentFor(morph, exampleText);
    expect(morphHasNumberOfComments(morph, 2)).to.be.ok;
    $world.emptyCommentsFor(morph);
    expect(morphHasNoComments(morph)).to.be.ok;
  });

  it('with comments can be copied to morph with empty comments', function () {
    comment = $world.addCommentFor(morph, exampleText);
    const morph2 = morph.copy(true);
    expect(morph2.comments.length === 0).to.be.ok;
    expect(morph.comments[0].equals(comment)).to.be.ok;
    morph2.remove();
  });

  afterEach(function () {
    $world.emptyCommentsFor(morph);
    morph.abandon();
  });
});
