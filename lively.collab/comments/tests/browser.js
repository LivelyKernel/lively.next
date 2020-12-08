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
  let env;
  beforeEach(async function () {
    morph = new Morph();
    morph.name = exampleName;
    // env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    new CommentBrowser();
    browser = CommentBrowser.instance; // This shouldn't be neccessary
    await CommentBrowser.whenRendered();
  });

  it('may be opened', function () {
    expect($world.get('comment browser'));
  });

  it('has only one instance', function () {
    const browser2 = new CommentBrowser();
    expect(browser === browser2);
  });

  it('has comment displayed', async function (done) {
    const comment = await morph.addComment(exampleText);
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        done();
      }
    });
    throw new Error('Failed');
  });

  it('has name of morph displayed', async function (done) {
    const comment = await morph.addComment(exampleText);
    browser.withAllSubmorphsDo((submorph) => {
      if (submorph.textString && submorph.textString.includes(exampleName)) {
        done();
      }
    });
    throw new Error('Failed');
  });

  it('can resolve comment', async function () {
    const comment = await morph.addComment(exampleText);
    comment.unresolve();
    browser.withAllSubmorphsDo(async (submorph) => {
      if (submorph.comment && submorph.comment.equals(comment)) {
        // await env.eventDispatcher.simulateDOMEvents({ type: 'pointerdown', position: submorph.ui.resolveButton, target: submorph });
        submorph.performClickAction('resolve');
      }
    });
    expect(comment.isResolved()).to.be.ok;
  });

  afterEach(function () {
    CommentBrowser.close();
    morph.emptyComments();
    morph.remove();
  });
});

// Tests to add:
// Collapse
// Uncollapse
// Remove with remove button
// Edit
// Unresolved comment count
