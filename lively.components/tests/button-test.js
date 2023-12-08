/* global System, declare, it, describe, beforeEach, afterEach, before, after, xit */
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';
import {
  MorphicEnv,
  Icon,
  Hand,
  World, part
} from 'lively.morphic';
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { SystemButton } from 'lively.components/buttons.cp.js';

let button, world, eventLog, env;
const inactiveColor = Color.blue; const activeColor = Color.red; const triggerColor = Color.green;

function installEventLogger (morph, log) {
  let loggedEvents = [
    'onMouseDown', 'onMouseUp', 'onMouseMove',
    'onDragStart', 'onDrag', 'onDragEnd',
    'onGrab', 'onDrop',
    'onHoverIn', 'onHoverOut',
    'onFocus', 'onBlur',
    'onKeyDown', 'onKeyUp'];
  loggedEvents.forEach(name => {
    morph[name] = function (evt) {
      log.push(name + '-' + morph.name);
      this.constructor.prototype[name].call(this, evt);
    };
  });
}

function createDummyWorld () {
  world = new World({ name: 'world', extent: pt(300, 300) });
  world.submorphs = [part(SystemButton, {
    center: pt(150, 150)
  }), new Hand()];

  button = world.submorphs[0];
  eventLog = [];
  [button].forEach(ea => installEventLogger(ea, eventLog));

  return world;
}

async function setup () {
  env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
  await env.setWorld(createDummyWorld());
  env.forceUpdate();
}

function teardown () {
  MorphicEnv.popDefault().uninstall();
}

describe('buttons', function () {
  // jsdom sometimes takes its time to initialize...
  if (System.get('@system-env').node) { this.timeout(10000); }

  beforeEach(setup);
  afterEach(teardown);

  describe('press', () => {
    it('is pressed', async () => {
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerover', position: button.center, target: button });
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerdown', position: button.center, target: button });
      button.master.applyIfNeeded(true);
      expect(button.fill).equals(SystemButton.stylePolicy._clickMaster.spec.fill);
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerup', position: button.center, target: button });
      button.master.applyIfNeeded(true);
      expect(button.fill).equals(SystemButton.stylePolicy._autoMaster.spec.fill);
    });

    it('leaving button on press releases', async () => {
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerover', position: button.center, target: button });
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerdown', position: button.center, target: button });
      button.master.applyIfNeeded(true);
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerover', position: button.bottomRight.addPt(pt(10, 10)), target: button.owner });
      button.master.applyIfNeeded(true);
      expect(button.fill).equals(SystemButton.stylePolicy._autoMaster.spec.fill);
    });
  });

  describe('button mode styles', () => {
    it('styles icon as labels correctly', () => {
      let b = part(SystemButton, { submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('times-circle') }] });
      expect(b.submorphs[0].value[0]).equals(Icon.textAttribute('times-circle')[0]);
    });

    it('allows to change the label', () => {
      button.label = 'Hello!';
      button.pressed = {};
      expect(button.label).equals('Hello!');
    });
  });
});
