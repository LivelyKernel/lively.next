/* global it, describe, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { Morph } from 'lively.morphic';
import { pt } from 'lively.graphics';
import { part } from 'lively.morphic/components/core.js';
import { CommentCountBadge } from '../comments/components/comment-count-badge.cp.js';

describe('badge', function () {
  let badge;
  const testWorld = $world;

  beforeEach(function () {
    badge = part(CommentCountBadge);
  });

  it('can be incremented', function () {
    badge.text = '42';
    badge.incrementCounter();
    expect(badge.text).to.equal('43');
  });

  it('moves with morph', async function () {
    const morph = new Morph({ extent: pt(100, 100), position: pt(400, 400) });
    testWorld.addMorph(morph);
    badge.addToMorph(morph);

    badge.alignWithMorph();
    const initX = badge.globalPosition.x;
    const offset = 20;
    morph.position = morph.position.addPt(pt(offset, 0));

    expect(badge.globalPosition.x - initX).to.equal(offset);

    morph.abandon();
  });

  afterEach(function () {
    if (badge) {
      badge.abandon();
    }
  });
});
