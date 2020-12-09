/* global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after */
import { expect } from 'mocha-es6';
import { Comment } from 'lively.collab';
import { Morph } from 'lively.morphic';

describe('comment object', function () {
  let comment;
  const exampleText = 'Example text';

  beforeEach(function () {
    comment = new Comment(exampleText);
  });

  it('has text', function () {
    expect(comment.text).equals(exampleText);
  });

  it('is different from comment with same text', function () {
    const comment2 = new Comment(comment.text);
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

  it('a comment may be added', async function () {
    comment = await morph.addComment(exampleText);
    expect(morphHasNumberOfComments(morph, 1));
    expect(morph.comments[0].text).equals(exampleText);
  });

  it('a comment may be removed', async function () {
    comment = await morph.addComment(exampleText);
    expect(morph.comments[0].equals(comment)).to.be.ok;
    await morph.removeComment(comment);
    expect(morphHasNoComments(morph)).to.be.ok;
  });

  it('comments may be emptied', async function () {
    await morph.addComment(exampleText);
    await morph.addComment(exampleText);
    expect(morphHasNumberOfComments(morph, 2)).to.be.ok;
    morph.emptyComments();
    expect(morphHasNoComments(morph)).to.be.ok;
  });

  it('can be cloned to with equal comment', async function () {
    comment = await morph.addComment(exampleText);
    const morph2 = morph.copy();
    expect(morph.comments[0].equals(morph2.comments[0])).to.be.ok;
  });

  afterEach(async function () {
    morph.emptyComments();
    morph.remove();
  });

  function morphHasNoComments (morph) {
    return morphHasNumberOfComments(morph, 0);
  }

  function morphHasNumberOfComments (morph, number) {
    return morph.comments.length === number;
  }
});
