/* global it, describe, before, beforeEach, after, afterEach */
import { expect } from 'mocha-es6';
import { ResizeablePanel } from 'lively.components';
import { pt } from 'lively.graphics';

let panel;

async function setup () {
  panel = new ResizeablePanel({
    name: 'panel',
    position: pt(140, 140),
    extent: pt(20, 20)
  });
  panel.resizers = true;
  $world.addMorph(panel);
  await panel.whenRendered();
}

function teardown () {
  panel.remove();
}

describe('resizeable panel', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('has no resizers by default', () => {
    panel.ui.resizers.north.visible = false;
    panel.ui.resizers.south.visible = false;
    panel.ui.resizers.east.visible = false;
    panel.ui.resizers.west.visible = false;
  });

  describe('has resizers', () => {
    it('that can be enabled and disabled together', () => {
      panel.resizers = true;
      panel.ui.resizers.north.visible = true;
      panel.ui.resizers.south.visible = true;
      panel.ui.resizers.east.visible = true;
      panel.ui.resizers.west.visible = true;

      panel.resizers = false;
      panel.ui.resizers.north.visible = false;
      panel.ui.resizers.south.visible = false;
      panel.ui.resizers.east.visible = false;
      panel.ui.resizers.west.visible = false;
    });

    it('that can be enabled and disabled individually', () => {
      panel.resizers = {
        north: true,
        south: true
      };
      panel.ui.resizers.north.visible = true;
      panel.ui.resizers.south.visible = true;
      panel.ui.resizers.east.visible = false;
      panel.ui.resizers.west.visible = false;

      panel.resizers = {
        north: false,
        west: true
      };
      panel.ui.resizers.north.visible = false;
      panel.ui.resizers.south.visible = true;
      panel.ui.resizers.east.visible = false;
      panel.ui.resizers.west.visible = true;

      panel.resizers = {
        east: false
      };
      panel.ui.resizers.north.visible = false;
      panel.ui.resizers.south.visible = true;
      panel.ui.resizers.east.visible = false;
      panel.ui.resizers.west.visible = true;
    });
  });

  describe('can be resized via resizer', () => {
    beforeEach(() => {
      panel.resizers = true;
    });

    it('in east direction', () => {
      debugger;
      $world.env.eventDispatcher.simulateDOMEvents({
        type: 'pointerdown',
        target: panel.ui.resizers.east,
        position: pt(159, 150)
      });

      $world.env.eventDispatcher.simulateDOMEvents({
        type: 'pointermove',
        target: panel.ui.resizers.east,
        position: pt(180, 150)
      });

      $world.env.eventDispatcher.simulateDOMEvents({
        type: 'pointerup',
        target: panel.ui.resizers.east,
        position: pt(180, 150)
      });

      expect(panel.extent.x).to.be.equal(40);
      expect(panel.extent.y).to.be.equal(20);
    });
  });
});
