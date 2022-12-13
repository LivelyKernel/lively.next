/* global it, describe, beforeEach, afterEach,System,xit */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { pt, Color } from 'lively.graphics';
import { morph, World } from '../index.js';
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { MorphicEnv } from '../index.js';

let inBrowser = System.get('@system-env').browser
  ? it
  : (title) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xit(title); };

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

let env; let world; let submorph1; let submorph2; let submorph3; let submorph4; let eventLog = [];
function createDummyWorld () {
  world = new World({ name: 'world', extent: pt(300, 300) });
  world.submorphs = [{
    name: 'submorph1',
    extent: pt(100, 100),
    position: pt(10, 10),
    fill: Color.red,
    submorphs: [{ name: 'submorph2', extent: pt(20, 20), position: pt(5, 10), fill: Color.green }]
  },
  { name: 'submorph3', extent: pt(50, 50), position: pt(200, 20), fill: Color.yellow },
  { name: 'submorph4', extent: pt(50, 50), position: pt(200, 200), fill: Color.blue }];

  submorph1 = world.submorphs[0];
  submorph2 = world.submorphs[0].submorphs[0];
  submorph3 = world.submorphs[1];
  submorph4 = world.submorphs[2];

  [world, submorph1, submorph2, submorph3, submorph4].forEach(ea => installEventLogger(ea, eventLog));

  return world;
}

async function setup () {
  env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
  await env.setWorld(createDummyWorld());
  env.forceUpdate();
  env.eventDispatcher.eventState.focusedMorph = null;
  eventLog.length = 0;
}

function teardown () {
  MorphicEnv.popDefault().uninstall();
}

function assertEventLogContains (stuff) {
  expect(stuff).equals(eventLog);
  eventLog.length = 0;
}

describe('event basics', function () {
  // jsdom sometimes takes its time to initialize...
  if (System.get('@system-env').node) { this.timeout(10000); }

  beforeEach(setup);
  afterEach(teardown);

  it('stop event', () => {
    submorph1.onMouseDown = function (evt) {
      evt.stop();
      eventLog.push('onMouseDown-submorph1');
    };
    env.eventDispatcher.simulateDOMEvents({ type: 'pointerdown', target: submorph2 });
    assertEventLogContains([
      'onFocus-submorph2',
      'onMouseDown-world',
      'onMouseDown-submorph1']);
  });
});

describe('pointer event related', function () {
  beforeEach(setup);
  afterEach(teardown);

  it('mousedown on submorph', () => {
    env.eventDispatcher.simulateDOMEvents({ type: 'pointerdown', target: submorph2 });
    assertEventLogContains([
      'onFocus-submorph2',
      'onMouseDown-world',
      'onMouseDown-submorph1',
      'onMouseDown-submorph2']);
  });

  it('world has hand and moves it', () => {
    env.eventDispatcher.simulateDOMEvents({ type: 'pointermove', target: submorph2, position: pt(120, 130), isPrimary: true });
    expect(world.submorphs[0]).property('isHand', true);
  });

  describe('drag', () => {
    it('morph', () => {
      submorph2.grabbable = false;
      submorph2.draggable = true;
      env.eventDispatcher.simulateDOMEvents({ type: 'pointerdown', target: submorph2, position: pt(20, 25), isPrimary: true });
      assertEventLogContains(['onFocus-submorph2', 'onMouseDown-world', 'onMouseDown-submorph1', 'onMouseDown-submorph2']);

      env.eventDispatcher.simulateDOMEvents({ type: 'pointermove', target: submorph2, position: pt(30, 33) });
      assertEventLogContains(['onMouseMove-world', 'onDragStart-submorph2']);

      env.eventDispatcher.simulateDOMEvents({ type: 'pointermove', target: submorph2, position: pt(34, 36), isPrimary: true });
      assertEventLogContains(['onMouseMove-world', 'onDrag-submorph2']);

      env.eventDispatcher.simulateDOMEvents({ type: 'pointerup', target: submorph2, position: pt(34, 36), isPrimary: true });
      assertEventLogContains(['onMouseUp-world', 'onMouseUp-submorph1', 'onMouseUp-submorph2', 'onDragEnd-submorph2']);
    });

    it('computes drag delta', async () => {
      let m = world.addMorph(morph({ extent: pt(50, 50), fill: Color.pink, grabbable: false, draggable: true }));
      env.forceUpdate();
      let dragStartEvent, dragEvent, dragEndEvent; // eslint-disable-line no-unused-vars
      m.onDragStart = evt => dragStartEvent = evt;
      m.onDrag = evt => dragEvent = evt;
      m.onDragEnd = evt => dragEndEvent = evt;
      env.eventDispatcher.simulateDOMEvents(
        { type: 'pointerdown', position: pt(20, 25), isPrimary: true },
        { type: 'pointermove', position: pt(20, 25) },
        { type: 'pointermove', position: pt(30, 35) },
        { type: 'pointermove', position: pt(40, 50) });
      expect(dragEvent.state.dragDelta).equals(pt(10, 15));
      env.eventDispatcher.simulateDOMEvents({ type: 'pointerup', target: m, position: pt(40, 51) });
      expect(dragEndEvent.state.dragDelta).equals(pt(0, 0));
    });
  });

  describe('click counting', () => {
    function click (type = 'pointerdown', position = pt(20, 25)) {
      return env.eventDispatcher.simulateDOMEvents({ type, target: submorph2, position, isPrimary: true });
    }

    it('accumulates and is time based', async () => {
      let state = env.eventDispatcher.eventState;
      expect(state.clickCount).equals(0);
      await click(); expect(state.clickCount).equals(1);
      await click('pointerup'); expect(state.clickCount).equals(0);
      await click(); expect(state.clickCount).equals(2);
      await click('pointerup'); expect(state.clickCount).equals(0);
      await promise.delay(400);
      await click(); expect(state.clickCount).equals(1);
    });
  });

  describe('grab / drop', () => {
    it('morph', async () => {
      submorph2.grabbable = true;
      let morphPos = submorph2.globalPosition;

      // grab
      await env.eventDispatcher.simulateDOMEvents(
        { type: 'pointerdown', target: submorph2, position: morphPos.addXY(5, 5), isPrimary: true },
        { type: 'pointermove', target: submorph2, position: morphPos.addXY(15, 15) });

      assertEventLogContains([
        'onFocus-submorph2',
        'onMouseDown-world', 'onMouseDown-submorph1', 'onMouseDown-submorph2',
        'onMouseMove-world',
        'onGrab-submorph2'
      ]);
      expect(world.hands[0].carriesMorphs()).equals(true);

      // drop
      env.eventDispatcher.simulateDOMEvents(
        { type: 'pointermove', target: submorph2, position: morphPos.addXY(15, 15) },
        { type: 'pointermove', target: submorph2, position: morphPos.addXY(25, 25) },
        { type: 'pointerup', target: world, position: morphPos.addXY(20, 20) });
      assertEventLogContains(['onMouseMove-world', 'onMouseMove-world',
        'onMouseUp-world', 'onDrop-submorph1']);
      expect(world.hands[0].carriesMorphs()).equals(false);
      expect(submorph2.owner).equals(submorph1);
      expect(submorph2.position).equals({ x: 15, y: 20 });
    });

    it('dropped morph has correct position', async () => {
      world.submorphs = [
        {
          position: pt(10, 10),
          extent: pt(100, 100),
          fill: Color.red,
          rotation: -45,
          origin: pt(50, 50)
        },
        { position: pt(60, 60), extent: pt(20, 20), fill: Color.green, grabbable: true, origin: pt(10, 10) }];
      let [m1, m2] = world.submorphs;
      let prevGlobalPos = m2.globalPosition;

      env.forceUpdate();
      env.eventDispatcher.simulateDOMEvents(
        { type: 'pointerdown', target: m2, position: pt(60, 60), isPrimary: true },
        { type: 'pointermove', target: m2, position: pt(70, 70) });
      expect(m2.globalPosition).equals(prevGlobalPos);
      expect(m2.owner).not.equals(world);
      env.eventDispatcher.simulateDOMEvents(
        { type: 'pointermove', target: m2, position: pt(50, 50) },
        { type: 'pointerup', target: m2, position: pt(50, 50) });
      expect(m2.globalPosition).equals(pt(40, 40));
      env.eventDispatcher.simulateDOMEvents(
        { type: 'pointerdown', target: m1, position: (pt(2, 2)) });
      expect(m2.owner).equals(world);
      expect(m2.globalPosition).equals(pt(40, 40));
    });
  });

  describe('hover', () => {
    it('into world', async () => {
      await env.eventDispatcher.simulateDOMEvents({ target: world, type: 'pointerover', position: pt(50, 50) });
      assertEventLogContains(['onHoverIn-world']);
    });

    it('in and out world', async () => {
      await env.eventDispatcher.simulateDOMEvents(
        { target: world, type: 'pointerover', position: pt(50, 50) },
        { target: world, type: 'pointerout', position: pt(50, 50) });
      await env.eventDispatcher.whenIdle();
      assertEventLogContains(['onHoverIn-world', 'onHoverOut-world']);
    });

    it('in and out single morph', async () => {
      await env.eventDispatcher.simulateDOMEvents(
        { target: submorph3, type: 'pointerover', position: pt(50, 50) },
        { target: submorph3, type: 'pointerout', position: pt(50, 50) });
      await env.eventDispatcher.whenIdle();
      assertEventLogContains(['onHoverIn-world', 'onHoverIn-submorph3', 'onHoverOut-world', 'onHoverOut-submorph3']);
    });

    it('hover in and out with submorph', async () => {
      // simulate the over/out dom events when moving
      // - into submorph1 => into submorph2 (contained in 1) => out of submorph2 => out of submorph1
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerover', target: submorph1, position: pt(10, 10) });
      await env.eventDispatcher.whenIdle();

      await env.eventDispatcher.simulateDOMEvents(
        { type: 'pointerout', target: submorph1, position: pt(15, 20) },
        { type: 'pointerover', target: submorph2, position: pt(15, 20) });
      await env.eventDispatcher.whenIdle();

      await env.eventDispatcher.simulateDOMEvents(
        { type: 'pointerout', target: submorph2, position: pt(15, 41) },
        { type: 'pointerover', target: submorph1, position: pt(15, 41) });
      await env.eventDispatcher.whenIdle();

      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerout', target: submorph1, position: pt(9, 9) });

      await env.eventDispatcher.whenIdle();
      assertEventLogContains([
        'onHoverIn-world', 'onHoverIn-submorph1', 'onHoverIn-submorph2', 'onHoverOut-submorph2', 'onHoverOut-world', 'onHoverOut-submorph1']);
    });

    it('hover in and out with submorph sticking out', async () => {
      submorph1.topLeft;
      submorph2.topRight = pt(submorph1.width + 10, 0);
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerover', target: submorph2, position: pt(109, 10) });
      await env.eventDispatcher.simulateDOMEvents({ type: 'pointerout', target: submorph2, position: pt(111, 10) });
      await env.eventDispatcher.whenIdle();
      assertEventLogContains([
        'onHoverIn-world', 'onHoverIn-submorph1', 'onHoverIn-submorph2', 'onHoverOut-world', 'onHoverOut-submorph1', 'onHoverOut-submorph2']);
    });
  });
});

describe('scroll events', () => {
  beforeEach(async () => {
    await setup();
    submorph1.clipMode = 'auto';
    submorph2.extent = pt(200, 200);
    env.forceUpdate();
  });
  afterEach(teardown);

  it('has correct scroll after scroll event and onScroll is triggered', async () => {
    let called = false;
    submorph1.onScroll = () => called = true;
    await env.eventDispatcher.simulateDOMEvents({ type: 'scroll', target: submorph1, scrollLeft: 20, scrollTop: 100 });
    expect(submorph1.scroll).equals(pt(20, 100));
    expect().assert(called, 'onScroll not called');
  });
});

describe('key events', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('focus + blur', async () => {
    await env.eventDispatcher.simulateDOMEvents({ target: submorph1, type: 'focus' });
    assertEventLogContains(['onFocus-submorph1']);
    expect().assert(submorph1.isFocused(), 'submorph1 not focused');
    expect().assert(!submorph2.isFocused(), 'submorph2 focused');

    await env.eventDispatcher.simulateDOMEvents({ target: submorph1, type: 'blur' });
    assertEventLogContains(['onBlur-submorph1']);
    expect().assert(!submorph1.isFocused(), 'submorph1 still focused');
    expect().assert(!submorph2.isFocused(), 'submorph2 focused 2');
  });

  it('key down', async () => {
    submorph2.focus();
    await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', ctrlKey: true, keyCode: 65 });
    assertEventLogContains([
      'onFocus-submorph2',
      'onKeyDown-world',
      'onKeyDown-submorph1',
      'onKeyDown-submorph2'
    ]);
  });

  it('key down keyCombo', async () => {
    submorph1.focus();
    let pressed; submorph1.onKeyDown = evt => pressed = evt.keyCombo;
    env.eventDispatcher.simulateDOMEvents({ type: 'keydown', ctrlKey: true, key: 'A' });
    expect(pressed).equals('Ctrl-A');
  });

  it('key up keyCombo', async () => {
    submorph1.focus();
    let pressed; submorph1.onKeyUp = evt => pressed = evt.keyCombo;
    env.eventDispatcher.simulateDOMEvents({ type: 'keyup', altKey: true, shiftKey: true, key: 'X' });
    expect(pressed).equals('Alt-Shift-X');
  });

  describe('command key invocation', () => {
    it('command is captured by first morph that handles key', async () => {
      let log = '';
      submorph2.focus();
      submorph1.addCommands([{ name: 'test', exec: () => { log += '1'; return true; } }]);
      submorph2.addCommands([{ name: 'test', exec: () => { log += '2'; return true; } }]);
      submorph1.addKeyBindings([{ keys: 'x', command: 'test' }]);
      submorph2.addKeyBindings([{ keys: 'x', command: 'test' }]);
      await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', key: 'x' });
      expect(log).equals('1');
    });

    it('allows key chains', async () => {
      let log = '';
      submorph1.focus();
      submorph1.addCommands([{ name: 'test', exec: () => { log += '!'; return true; } }]);
      submorph1.addKeyBindings([{ keys: 'x y', command: 'test' }]);
      await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', key: 'x' });
      await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', key: 'y' });
      expect(log).equals('!');
      expect(env).deep.property('eventDispatcher.eventState.keyInputState')
        .deep.equals({ count: undefined, keyChain: '' });
    });

    it('allows similar key chain prefixes in multiple morphs', async () => {
      let log = '';
      submorph1.addCommands([{ name: 'test', exec: () => { log += '1'; return true; } }]);
      submorph1.addKeyBindings([{ keys: 'Ctrl-X y', command: 'test' }]);
      submorph1.addCommands([{ name: 'test', exec: () => { log += '2'; return true; } }]);
      submorph1.addKeyBindings([{ keys: 'Ctrl-X Ctrl-X', command: 'test' }]);
      submorph2.focus();
      await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', ctrlKey: true, key: 'x' });
      await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', ctrlKey: true, key: 'x' });
      expect(log).equals('2');
      expect(env).deep.property('eventDispatcher.eventState.keyInputState')
        .deep.equals({ count: undefined, keyChain: '' });
    });

    inBrowser('dispatches keychained input events correctly', async () => {
      let submorph5 = world.addMorph({
        name: 'submorph5',
        type: 'text',
        readOnly: false,
        extent: pt(50, 50),
        position: pt(300, 300),
        fill: Color.orange,
        textString: 'text',
        cursorPosition: { row: 0, column: 0 }
      });

      let log = '';
      world.addCommands([{ name: 'test', exec: () => { log += '!'; return true; } }]);
      world.addKeyBindings([{ keys: 'x y', command: 'test' }]);
      submorph5.focus();
      let [e] = await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', key: 'x', isPrimary: true });
      !e.propagationStopped && await env.eventDispatcher.simulateDOMEvents({ type: 'input', key: 'x', isPrimary: true });
      [e] = await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', key: 'y' });
      !e.propagationStopped && await env.eventDispatcher.simulateDOMEvents({ type: 'input', key: 'y', isPrimary: true });
      [e] = await env.eventDispatcher.simulateDOMEvents({ type: 'keydown', key: 'z' });
      !e.propagationStopped && await env.eventDispatcher.simulateDOMEvents({ type: 'input', key: 'z', isPrimary: true });
      expect(log).equals('!');
      expect(submorph5.textString).equals('ztext');
      expect(env).deep.property('eventDispatcher.eventState.keyInputState')
        .deep.equals({ count: undefined, keyChain: '' });
    });
  });
});

describe('event simulation', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('click', async () => {
    await env.eventDispatcher.simulateDOMEvents({ type: 'click', position: pt(25, 25), isPrimary: true });
    assertEventLogContains([
      'onFocus-submorph2',
      'onMouseDown-world', 'onMouseDown-submorph1', 'onMouseDown-submorph2',
      'onMouseUp-world', 'onMouseUp-submorph1', 'onMouseUp-submorph2']);
  });
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import KillRing from '../events/KillRing.js';

describe('kill ring', () => {
  it('max size', async () => {
    let kr = new KillRing(3);
    kr.add('a');
    kr.add('b');
    kr.add('c');
    kr.add('d');
    expect(kr.buffer).equals(['b', 'c', 'd']);
  });

  it('rotates', async () => {
    let kr = new KillRing(3);
    kr.add('a');
    kr.add('b');
    kr.add('c');
    expect(kr.yank()).equals('c');
    kr.back();
    kr.back();
    expect(kr.yank()).equals('a');
    kr.back();
    expect(kr.yank()).equals('c');
  });

  it('add resets rotate', async () => {
    let kr = new KillRing(5);
    kr.add('a');
    kr.add('b');
    kr.add('c');
    kr.back();
    kr.back();
    kr.add('d');
    expect(kr.yank()).equals('d');
    kr.back();
    expect(kr.yank()).equals('c');
  });
});
