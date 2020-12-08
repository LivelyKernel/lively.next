/* global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after */
import { expect } from 'mocha-es6';
import { Comment } from 'lively.collab';

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
