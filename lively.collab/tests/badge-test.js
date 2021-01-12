/* global System, declare, done, it, xit, describe, xdescribe, beforeEach, afterEach, before, after */
import { expect } from 'mocha-es6';
import { Badge } from 'lively.collab';
import { Morph } from 'lively.morphic';
import { pt } from 'lively.graphics';

describe('badge', function () {
  let badge;
  const testWorld = $world;

  beforeEach(function () {
    badge = new Badge();
  });

  it('can be incremented', function () {
    badge.setText('42');
    badge.incrementCounter();
    expect(badge.getText()).to.equal('43');
  });

  it('moves with morph', async function () {
    const morph = new Morph({ extent: pt(100, 100), position: pt(400, 400) });
    testWorld.addMorph(morph);
    badge.addToMorph(morph);
    await badge.whenRendered();

    badge.alignWithMorph();
    const initX = badge.globalPosition.x;
    const offset = 20;
    morph.position = morph.position.addPt(pt(offset, 0));

    expect(badge.globalPosition.x - initX).to.equal(offset);

    morph.abandon();
  });

  it('can be initiated with text', async function () {
    const textBadge = Badge.newWithText('Test');
    expect(textBadge.getText()).to.equal('Test');
  });

  afterEach(function () {
    if (badge) {
      badge.abandon();
    }
  });
});
