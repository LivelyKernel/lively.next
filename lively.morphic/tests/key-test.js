/* global it, describe, beforeEach */
import { expect } from 'mocha-es6';

import Keys from '../events/Keys.js';
let {
  keyComboToEventSpec: evt,
  computeHashIdOfEvent: hash,
  eventToKeyCombo: stringify,
  canonicalizeKeyCombo: canonicalize
} = Keys;

describe('Keys', () => {
  describe('key string -> event', () => {
    it('char', () =>
      expect(evt('a'))
        .containSubset({ isModified: false, key: 'a', shiftKey: false }));

    it('upper case char', () =>
      expect(evt('A'))
        .containSubset({ isModified: false, key: 'A', shiftKey: false }));

    it('shifted', () =>
      expect(evt('Shift-a'))
        .containSubset({ isModified: true, key: 'A', shiftKey: true }));

    it('esc key', () =>
      expect(evt('Esc'))
        .containSubset({ isModified: false, key: 'Escape', shiftKey: false, isFunctionKey: true }));

    it('modified esc key', () =>
      expect(evt('Shift-Alt-Esc'))
        .containSubset({ isModified: true, isFunctionKey: true, key: 'Escape', shiftKey: true, altKey: true }));

    it('function key', () =>
      expect(evt('F1'))
        .containSubset({ isModified: false, isFunctionKey: true, key: 'F1' }));

    it('meta key', () =>
      expect(evt('cmd'))
        .containSubset({ isModified: true, isFunctionKey: false, key: 'Meta', metaKey: true }));

    it('modified function key', () =>
      expect(evt('cmd-F1'))
        .containSubset({ isModified: true, isFunctionKey: true, key: 'F1', metaKey: true }));

    it('space', () =>
      expect(evt(' '))
        .containSubset({ isModified: false, isFunctionKey: true, key: ' ', keyCombo: 'Space' }));

    it('modified space', () =>
      expect(evt('Alt- '))
        .containSubset({ isModified: true, isFunctionKey: true, key: ' ', altKey: true }));

    it('just modified', () =>
      expect(evt('Shift'))
        .containSubset({ isModified: true, isFunctionKey: false, key: 'Shift', shiftKey: true }));

    it('just modified 2', () =>
      expect(evt('Ctrl-Shift'))
        .containSubset({ isModified: true, isFunctionKey: false, key: 'Shift', shiftKey: true, ctrlKey: true }));
  });

  describe('modifier hash', () => {
    it('non modified (space)', () => expect(hash(evt(' '))).equals(0));
    it('non modified (char)', () => expect(hash(evt('a'))).equals(-1));
    it('enter', () => expect(hash(evt('Enter'))).equals(0));
    it('single modifier 1', () => expect(hash(evt('alt-a'))).equals(2));
    it('single modifier 2', () => expect(hash(evt('shift-a'))).equals(4));
    it('single modifier 3', () => expect(hash(evt('cmd-a'))).equals(8));
    it('single modifier 4', () => expect(hash(evt('ctrl-a'))).equals(1));
    it('shift+cmd', () => expect(hash(evt('shift-cmd-a'))).equals(12));
    it('ctrl+shift 1', () => expect(hash(evt('ctrl-shift-a'))).equals(5));
    it('ctrl+shift 2', () => expect(hash(evt('ctrl-shift-a'))).equals(5));
    it('only modifier 1', () => expect(hash(evt('ctrl'))).equals(1));
    it('only modifier 2', () => expect(hash(evt('ctrl-shift'))).equals(5));
  });

  describe('canonicalize keys', () => {
    it('ctrl-shift', () => expect(canonicalize('ctrl-shift')).equals('Ctrl-Shift'));
    it('shift-control', () => expect(canonicalize('shift-control')).equals('Ctrl-Shift'));
    it('shift-control-a', () => expect(canonicalize('shift-control-a')).equals('Ctrl-Shift-A'));
    it('A', () => expect(canonicalize('A')).equals('input-A'));
    it('a', () => expect(canonicalize('a')).equals('input-a'));
    it('esc', () => expect(canonicalize('esc')).equals('Escape'));
    it('Escape', () => expect(canonicalize('Escape')).equals('Escape'));
  });

  describe('evt => key string', () => {
    it('char', () => expect(stringify(evt('s'))).equals('input-s'));
    it('modified + shifted', () => expect(stringify(evt('Shift-cmd-s'))).equals('Meta-Shift-S'));
    it('modified', () => expect(stringify(evt('Command-s'))).equals('Meta-S'));
    it('ctrl+meta', () => expect(stringify(evt('ctrl-Command-s'))).equals('Ctrl-Meta-S'));
    it('only modified', () => expect(stringify(evt('alt'))).equals('Alt'));
    it('only modifier again', () => expect(stringify(evt('Alt'))).equals('Alt'));
  });

  describe('input evt => key string', () => {
    it('s', () => expect(stringify({ type: 'input', data: 's' })).equals('input-s'));
    it('S', () => expect(stringify({ type: 'input', data: 'S' })).equals('input-S'));
    it('multiple chars', () => expect(stringify({ type: 'input', data: 'Test' })).equals('input-Test'));
  });

  describe('key evt => key spec', () => {
    it('s', () => expect(stringify({ type: 'keydown', key: 's' })).equals('input-s'));
    it('S', () => expect(stringify({ type: 'keydown', key: 'S' })).equals('input-S'));
    it('meta-S', () => expect(stringify({ type: 'keydown', metaKey: true, key: 's' })).equals('Meta-S'));
    it('shift-S', () => expect(stringify({ type: 'keydown', shiftKey: true, key: 's' })).equals('Shift-S'));
    it('shift-alt-S', () => expect(stringify({ type: 'keydown', altKey: true, shiftKey: true, key: 's' })).equals('Alt-Shift-S'));
  });

  // for Safari, doesn't support key standard
  describe('key evt with keyIdentifier => key spec', () => {
    it('s', () => expect(stringify({ type: 'keydown', keyIdentifier: 'U+0053' })).equals('input-s'));
    it('S', () => expect(stringify({ type: 'keydown', shiftKey: true, keyIdentifier: 'U+0053' })).equals('Shift-S'));
    it('Meta', () => expect(stringify({ type: 'keydown', keyIdentifier: 'Meta' })).equals('Meta'));
    it('Meta-s', () => expect(stringify({ type: 'keydown', metaKey: true, keyIdentifier: 'U+0053' })).equals('Meta-S'));
  });
});

import KeyHandler from '../events/KeyHandler.js';

describe('key bindings', () => {
  let handler;
  beforeEach(() => handler = new KeyHandler());

  it('binds and looks up commands', () => {
    handler.bindKey('a', 'test');
    handler.bindKey('ctrl-a', { command: 'test-2', prop: 23 });
    expect(handler.lookup('a')).deep.equals({ command: 'test' });
    expect(handler.lookup('control-a')).deep.equals({ command: 'test-2', prop: 23 });
    expect(handler.lookup('b')).equals(undefined);
  });

  it('removes commands', () => {
    handler.bindKey('a', 'test');
    handler.unbindKey('a');
    expect(handler.lookup('a')).equals(undefined);
  });

  it('binds commands to platforms', () => {
    handler = new KeyHandler('windows');
    handler.bindKey({ win: 'ctrl-a', mac: 'cmd-a' }, 'test');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'test' }, 'win matching');
    expect(handler.lookup('cmd-a')).equals(undefined, 'win not matching');
    handler = new KeyHandler('mac');
    handler.bindKey({ win: 'ctrl-a', mac: 'cmd-a' }, 'test');
    expect(handler.lookup('ctrl-a')).equals(undefined, 'mac not matching');
    expect(handler.lookup('cmd-a')).deep.equals({ command: 'test' }, 'mac matching');
    handler = new KeyHandler('mac');
    handler.bindKey({ win: 'ctrl-a' }, 'test');
    expect(handler.lookup('ctrl-a')).equals(undefined, 'single 1');
    expect(handler.lookup('cmd-a')).equals(undefined, 'single 2');
  });

  it('defines multiple bindings via |', () => {
    handler.bindKey('ctrl-a|shift-a', 'test');
    expect(handler.lookup('cmd-a')).equals(undefined, '1');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'test' }, '2');
    expect(handler.lookup('shift-a')).deep.equals({ command: 'test' }, '3');
    expect(handler.lookup('shift-b')).equals(undefined, '4');
  });

  it('defines multiple bindings via array', () => {
    handler.bindKey(['ctrl-b', 'shift-b'], 'test');
    expect(handler.lookup('cmd-b')).equals(undefined, '5');
    expect(handler.lookup('ctrl-b')).deep.equals({ command: 'test' }, '6');
    expect(handler.lookup('shift-b')).deep.equals({ command: 'test' }, '7');
  });

  it('defines multiple bindings for platform', () => {
    handler = new KeyHandler('windows');
    handler.bindKey({ win: 'ctrl-a|shift-a' }, 'test');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'test' }, '8');
    expect(handler.lookup('shift-a')).deep.equals({ command: 'test' }, '9');
  });

  it('defines key chains', () => {
    handler.bindKey('ctrl-a ctrl-b', 'test');
  });

  it('adds bindings to key chain', () => {
    handler = new KeyHandler();

    handler.bindKey('ctrl-a ctrl-b', 'test');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'null', keyChain: canonicalize('ctrl-a') }, '1');
    expect(handler.lookup('ctrl-b', { keyChain: canonicalize('ctrl-a') })).deep.equals({ command: 'test' }, '2');
    handler.bindKey('ctrl-a ctrl-c', 'test-2');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'null', keyChain: canonicalize('ctrl-a') }, '3');
    expect(handler.lookup('ctrl-c', { keyChain: canonicalize('ctrl-a') })).deep.equals({ command: 'test-2' }, '4');
  });

  it('defines command and then key chains it over', () => {
    handler.bindKey('ctrl-a', 'test-1');
    handler.bindKey('ctrl-a ctrl-b', 'test-2');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'null', keyChain: canonicalize('ctrl-a') }, '1');
    expect(handler.lookup('ctrl-b', { keyChain: canonicalize('ctrl-a') })).deep.equals({ command: 'test-2' }, '2');
  });

  it('defines command that removes key chains', () => {
    handler.bindKey('ctrl-a ctrl-b', 'test-1');
    handler.bindKey('ctrl-a', 'test-2');
    expect(handler.lookup('ctrl-a')).deep.equals({ command: 'test-2' }, '1');
    expect(handler.lookup('ctrl-b', { keyChain: canonicalize('ctrl-a') })).equals(undefined, '2');
  });

  it('removes key chain entirely 1', () => {
    handler.bindKey('ctrl-a ctrl-b', 'test');
    handler.bindKey('ctrl-a ctrl-c', 'test-2');
    handler.unbindKey('ctrl-a');
    expect(handler.keyBindings).deep.equals({});
  });

  it('removes key chain entirely 2', () => {
    handler.bindKey('ctrl-a ctrl-b', 'test');
    handler.unbindKey('ctrl-a ctrl-b');
    expect(handler.keyBindings).deep.equals({});
  });

  it('keeps key chain on removal when other chained commands exist', () => {
    handler.bindKey('ctrl-a ctrl-b', 'test');
    handler.bindKey('ctrl-a ctrl-c', 'test');
    handler.unbindKey('ctrl-a ctrl-b');
    expect(handler.lookup('ctrl-b', { keyChain: canonicalize('ctrl-a') })).equals(undefined, '1');
    expect(handler.lookup('ctrl-c', { keyChain: canonicalize('ctrl-a') })).deep.equals({ command: 'test' }, '2');
  });

  it('transparently looks up input keys', () => {
    handler.bindKey('Alt-G G', 'test');
    expect(handler.lookup('g', { keyChain: canonicalize('alt-g') })).deep.equals({ command: 'test' });
    expect(handler.lookup('G', { keyChain: canonicalize('alt-g') })).deep.equals({ command: 'test' });
  });

  it('adds count on ctrl-number press', () => {
    expect(handler.lookup('Ctrl-1')).deep.equals({ command: 'null', count: 1 });
    expect(handler.lookup('Ctrl-2', { count: 1 })).deep.equals({ command: 'null', count: 12 });
  });

  it('maps ctrl-u as universal argument = count 4', () => {
    expect(handler.lookup('Ctrl-U')).deep.equals({ command: 'null', count: 4, keyChain: 'Ctrl-U' });
  });
});
