/* global it, describe, beforeEach, afterEach, before */
import { Text } from '../../text/morph.js';
import { expect, chai } from 'mocha-es6';
import { pt, Color, Rectangle } from 'lively.graphics';
import { expectSelection } from '../test-helpers.js';
import { Range } from '../../text/range.js';

expectSelection(chai);

const defaultStyle = {
  fontFamily: 'monospace',
  fontSize: 10,
  fontWeight: 'normal',
  fontColor: 'black',
  fontStyle: 'normal',
  textDecoration: 'none',
  fixedCharacterSpacing: false
};

let fontMetric; // eslint-disable-line no-unused-vars

function text (string, props) {
  let t = new Text({
    name: 'text',
    readOnly: false,
    textString: string,
    extent: pt(100, 100),
    padding: Rectangle.inset(3),
    ...defaultStyle,
    ...props
  });
  fontMetric = t.fontMetric;
  return t;
}

function range (startRow, startCol, endRow, endCol) {
  return { start: { row: startRow, column: startCol }, end: { row: endRow, column: endCol } };
}

let sut, env;
function createSut () {
  sut = text('text\nfor tests', {
    position: pt(10.10),
    readOnly: false,
    fill: Color.gray.lighter(2),
    cursorPosition: { row: 0, column: 0 }
  }).openInWorld();
  env = sut.env;
}
function removeSut () {
  sut && sut.remove();
}

describe('text attributes', () => {
  beforeEach(() => sut = text('hello', {}));

  it('addTextAttribute merges style ranges', () => {
    let style_a = { fontSize: 12, fontStyle: 'italic' };
    let style_b = { fontSize: 14, fontWeight: 'bold' };

    sut.addTextAttribute(style_a, Range.create(0, 1, 0, 3));
    let textAttributes = sut.document.lines[0].textAttributes;
    expect(textAttributes).deep.equals([style_a]);

    sut.addTextAttribute(style_b, Range.create(0, 2, 0, 4));
    textAttributes = sut.document.lines[0].textAttributes;
    expect(textAttributes).deep.equals([style_a, { ...style_a, ...style_b }, style_b]);
  });

  it('attributes at position', () => {
    let t = text('abcdef', { padding: Rectangle.inset(0), borderWidth: 0 });
    let attr = t.addTextAttribute({ fontColor: 'green' }, Range.create(0, 0, 0, 6));
    expect(t.textAttributeAtPoint(pt(3, 3))).deep.equals(attr);
  });

  describe('bulk changes', () => {
    it('applyTextChanges', () => {
      let t = text('abcdef');
      t.applyTextChanges(
        [['insert', 0, 'Hello\nWorld'],
          ['remove', 5, 8],
          ['insert', 5, '\n']]);
      expect(t.textString).equals('Hello\nrldabcdef');
      t.applyTextChanges([['insert', { row: 1, column: 1 }, 'xxx']]);
      expect(t.textString).equals('Hello\nrxxxldabcdef');
      t.applyTextChanges([['delete', { row: 0, column: 6 }, { row: 2, column: 0 }]]);
      expect(t.textString).equals('Hello');
    });
  });

  describe('text range styling', () => {
    it('creates text attributes', () => {
      sut.setStyleInRange({ fontSize: 40 }, range(0, 1, 0, 3));
      expect(sut.textAndAttributes).deep.equals(['h', null, 'el', { fontSize: 40 }, 'lo', null]);
    });

    it('replaces text attributes', () => {
      sut.setStyleInRange({ fontSize: 40 }, range(0, 1, 0, 3));
      sut.setStyleInRange({ fontWeight: 'bold' }, range(0, 1, 0, 3));
      expect(sut.textAndAttributes).deep.equals(['h', null, 'el', { fontWeight: 'bold' }, 'lo', null]);
    });

    it('resets text attributes in range', () => {
      sut.setStyleInRange({ fontSize: 40 }, range(0, 1, 0, 3));
      sut.resetStyleInRange(range(0, 1, 0, 2));
      expect(sut.textAndAttributes).deep.equals(['he', null, 'l', { fontSize: 40 }, 'lo', null]);
    });

    it('style attributes are cleaned up / coalesced', () => {
      sut.addTextAttribute({ fontWeight: 'bold' }, range(0, 1, 0, 3));
      sut.addTextAttribute({ fontSize: 40 }, range(0, 2, 0, 5));
      sut.addTextAttribute({ fontSize: 10 }, range(0, 2, 0, 5));
      expect(sut.textAndAttributes).deep.equals([
        'h', null,
        'e', { fontWeight: 'bold' },
        'l', { fontSize: 10, fontWeight: 'bold' },
        'lo', { fontSize: 10 }
      ]);
    });

    it('line-wise', () => {
      // sut.openInWorld();
      // sut.remove();
      sut.textAndAttributes = ['xxx\nyyy\nfooo\n', null];
      sut.addTextAttribute({ fontFamily: 'Arial' }, range(0, 0, 2, 0));
      expect(sut.textAndAttributes).deep.equals([
        'xxx\nyyy\n', { fontFamily: 'Arial' },
        'fooo\n', null
      ]);
    });
  });

  describe('insertText with attributes', () => {
    it('extends attributes on insertion by default', () => {
      sut.textAndAttributes = ['hello', { fontSize: 10 }, ' world', {}];
      sut.insertText([' foo', { fontFamily: 'Arial' }], { row: 0, column: 5 });
      expect(sut.textAndAttributes).deep.equals([
        'hello', { fontSize: 10 },
        ' foo', { fontSize: 10, fontFamily: 'Arial' },
        ' world', {}
      ]);
    });

    it('does not extend attributes on insertion when told so', () => {
      sut.textAndAttributes = ['hello', { fontSize: 10 }, ' world', {}];
      sut.insertText([' foo', { fontWeight: 'bold' }], { row: 0, column: 5 }, false);
      expect(sut.textAndAttributes).deep.equals([
        'hello', { fontSize: 10 },
        ' foo', { fontWeight: 'bold' },
        ' world', {}
      ]);
    });
  });

  describe('are undoable', () => {
    it('textAndAttributes setter', () => {
      let original = sut.textAndAttributes.slice();
      sut.undoManager.group();
      sut.textAndAttributes = ['xxx\nyyy\nfooo\n', { fontFamily: 'Arial' }];
      sut.undoManager.group();
      sut.textUndo();
      expect(sut.textAndAttributes).deep.equals(original);
    });

    it('textAndAttributes setter with previous attributes', () => {
      sut.textAndAttributes = ['xxx\nyyy', { textDecoration: 'underline' }];
      sut.undoManager.group();
      sut.textAndAttributes = ['xxx\nyyyfooo\n', { fontFamily: 'Arial' }];
      sut.undoManager.group();
      sut.textUndo();
      expect(sut.textAndAttributes)
        .deep.equals(['xxx\nyyy', { textDecoration: 'underline' }]);
    });

    it('add attribute', () => {
      // sut.openInWorld();
      // sut.remove();
      sut.textAndAttributes = ['xxx\nyyy\nfooo', { textDecoration: 'underline' }];
      sut.undoManager.reset();
      sut.undoManager.group();

      sut.addTextAttribute({ fontFamily: 'Arial' }, range(0, 0, 2, 0));
      sut.undoManager.group();
      sut.undoManager.undos;

      sut.textUndo();

      expect(sut.textAndAttributes)
        .deep.equals(['xxx\nyyy\nfooo', { textDecoration: 'underline' }]);
    });

    it('overwrite attributes', () => {
      // sut.openInWorld();
      // sut.remove();
      sut.textAndAttributes = ['xxx\n', { y: 24 }, 'yyy\nfooo', { x: 23 }];
      sut.undoManager.group();
      sut.setStyleInRange({ z: 99 }, range(0, 2, 1, 1));
      sut.undoManager.group();
      sut.textUndo();
      expect(sut.textAndAttributes).deep.equals(['xxx\n', { y: 24 }, 'yyy\nfooo', { x: 23 }]);
    });
  });
});

describe('anchors', () => {
  it('adds anchor by id', () => {
    let t = text('hello\nworld', {});
    let nAnchors = t.anchors.length;
    let a = t.addAnchor({ id: 'test', column: 1, row: 1 });
    expect(t.anchors).to.have.length(nAnchors + 1);
    expect(t.addAnchor({ id: 'test' })).equals(a);
    expect(t.anchors).to.have.length(nAnchors + 1);
    t.removeAnchor(a);
    expect(t.anchors).to.have.length(nAnchors);
    t.addAnchor({ id: 'test' });
    expect(t.anchors).to.have.length(nAnchors + 1);
    t.removeAnchor('test');
    expect(t.anchors).to.have.length(nAnchors);
  });

  it('insert moves anchors around', () => {
    let t = text('hello\nworld', {});
    let a = t.addAnchor({ id: 'test', column: 1, row: 1 });
    t.insertText('abc', { row: 1, column: 0 });
    expect(a.position).deep.equals({ row: 1, column: 4 }, '1 before anchor');
    t.insertText('xy', { row: 1, column: 4 });
    expect(a.position).deep.equals({ row: 1, column: 6 }, '2 directly before anchor');
    t.insertText('123', { row: 1, column: 7 });
    expect(a.position).deep.equals({ row: 1, column: 6 }, '3 after anchor');
    t.insertText('123', { row: 0, column: 0 });
    expect(a.position).deep.equals({ row: 1, column: 6 }, '4 line before anchor');
    t.insertText('123\n456', { row: 0, column: 0 });
    expect(a.position).deep.equals({ row: 2, column: 6 }, '5 new line before anchor');
  });

  it('insertion stay behavior', () => {
    let t = text('hello\nworld', {});
    let a = t.addAnchor({ id: 'test', column: 1, row: 1, insertBehavior: 'stay' });
    t.insertText('abc', { row: 1, column: 0 });
    expect(a.position).deep.equals({ row: 1, column: 4 }, '1 before anchor');
    t.insertText('xy', { row: 1, column: 4 });
    expect(a.position).deep.equals({ row: 1, column: 4 }, '2 directly before anchor');
  });

  it('delete moves anchors around', () => {
    let t = text('hello\nworld', {});
    let a = t.addAnchor({ id: 'test', column: 1, row: 1 });
    t.deleteText(range(1, 0, 1, 1));
    expect(a.position).deep.equals({ row: 1, column: 0 }, '1 before anchor');
    t.deleteText(range(0, 2, 1, 0));
    expect(a.position).deep.equals({ row: 0, column: 2 }, '2 line before');
    t.deleteText(range(0, 2, 0, 5));
    expect(a.position).deep.equals({ row: 0, column: 2 }, '3 after anchor');
    t.deleteText(range(0, 1, 0, 5));
    expect(a.position).deep.equals({ row: 0, column: 1 }, '4 crossing anchor');
  });

  it('setting anchors', () => {
    let t = text('hello\nworld', {});
    let { startAnchor, endAnchor } = t.selections[0];
    t.anchors = [startAnchor, endAnchor];
    expect(t.anchors).equals([startAnchor, endAnchor]);
  });

  it('anchor with backspace', () => {
    let t = text('hello\nworld', {});
    let a = t.addAnchor({ id: 'test', column: 0, row: 1, insertBehavior: 'move' });
    t.cursorPosition = { row: 1, column: 0 };
    t.execCommand('delete backwards');
    expect(a.position).deep.equals({ column: 5, row: 0 });
    t.execCommand('insertstring', { string: '\n' });
    expect(a.position).deep.equals({ column: 0, row: 1 });
  });
});

describe('scroll', () => {
  beforeEach(() => createSut());
  afterEach(() => removeSut());

  it('cursor into view', () => {
    let lineHeight = sut.textLayout.defaultCharExtent(sut).height;
    let padTop = sut.padding.top();
    let padBot = sut.padding.bottom();
    Object.assign(sut, {
      clipMode: 'auto',
      borderWidth: 0,
      extent: pt(100, 2 * lineHeight),
      textString: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].join('\n')
    });
    expect(sut.scrollExtent.x).equals(100 + 15, 'scrollExtent x not as expected');
    expect(sut.scrollExtent.y).closeTo(
      sut.document.lines.length * lineHeight + padTop + padBot + 15, 3,
      'scrollExtent y not as expected');
    sut.cursorPosition = { column: 0, row: 3 };
    sut.scrollCursorIntoView();
    expect(sut.scroll.x).equals(0, 'scroll x');
    expect(sut.scroll.y).closeTo(2 * lineHeight + padTop + 3, 3, 'scroll y');
    sut.cursorPosition = { column: 0, row: 0 };
    sut.scrollCursorIntoView();
    expect(sut.scroll).equals(pt(0, 1));
  });
});

describe('text key events', () => {
  beforeEach(() => createSut());
  afterEach(() => removeSut());

  it('text entry via keydown', async () => {
    sut.focus();
    await env.eventDispatcher.simulateDOMEvents(
      { type: 'input', data: 'l' },
      { type: 'input', data: 'o' },
      { type: 'input', data: 'l' },
      { type: 'keydown', key: 'Enter' });
    expect(sut).property('textString').equals('text\nfor testslol\n');
  });

  it('backspace', async () => {
    sut.focus();
    env.eventDispatcher.simulateDOMEvents(
      { type: 'input', data: 'l' },
      { type: 'input', data: 'o' },
      { type: 'input', data: 'l' },
      { type: 'input', data: 'w' },
      { type: 'input', data: 'u' },
      { type: 'input', data: 't' });

    expect(sut).property('textString').equals('text\nfor testslolwut');
    env.eventDispatcher.simulateDOMEvents(
      { type: 'keydown', key: 'Backspace' },
      { type: 'keydown', key: 'Backspace' },
      { type: 'keydown', key: 'Backspace' },
      { type: 'input', data: ' ' });

    expect(sut).property('textString').equals('text\nfor testslol ');
  });

  it('entry clears selection', async () => {
    sut.focus();
    sut.selection = range(0, 0, 0, 4);
    env.eventDispatcher.simulateDOMEvents(
      { type: 'input', data: 'w' },
      { type: 'input', data: 'o' },
      { type: 'input', data: 'w' });
    expect(sut).property('textString').equals('wow\nfor tests');
  });
});

describe('text mouse events', () => {
  let padLeft, padTop,
    h, w;
  beforeEach(async () => {
    await createSut();
    padLeft = sut.padding.left();
    padTop = sut.padding.top();
    ({ height: h, width: w } = sut.textLayout.defaultCharExtent(sut));
    await sut.whenRendered();
  });
  afterEach(() => removeSut());

  it('click sets cursor', () => {
    let { position: { x, y } } = sut;
    let clickPos = pt(x + w * 3 + 2 + padLeft, y + h * 2 - 5 + padTop); // second line

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');
    env.eventDispatcher.simulateDOMEvents({ target: sut, type: 'click', position: clickPos });

    let clickIndex = sut.document.positionToIndex({ row: 1, column: 3 });
    expect(clickIndex).equals(8);
    expect(sut.selection).selectionEquals('Selection(1/3 -> 1/3)');
  });

  it('double-click selects word', () => {
    let { position: { x, y } } = sut;
    let clickPos = pt(x + w * 2 + 2 + padLeft, y + h * 2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');

    env.eventDispatcher.simulateDOMEvents(
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos });

    expect(sut.selection).selectionEquals('Selection(1/0 -> 1/3)');
  });

  it('triple-click selects line', () => {
    let { position: { x, y } } = sut;
    let clickPos = pt(x + w * 2 + 2 + padLeft, y + h * 2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');

    env.eventDispatcher.simulateDOMEvents(
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos });

    expect(sut.selection).selectionEquals('Selection(1/0 -> 1/9)');
  });

  it('4-click sets cursor', () => {
    let { position: { x, y } } = sut;
    let clickPos = pt(x + w * 2 + 2 + padLeft, y + h * 2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');

    env.eventDispatcher.simulateDOMEvents(
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos });

    expect(sut.selection).selectionEquals('Selection(1/2 -> 1/2)');
  });

  it('5-click selects word', () => {
    let { position: { x, y } } = sut;
    let clickPos = pt(x + w * 2 + 2 + padLeft, y + h * 2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');

    env.eventDispatcher.simulateDOMEvents(
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos });

    expect(sut.selection).selectionEquals('Selection(1/0 -> 1/3)');
  });

  it('6-click selects line', () => {
    let { position: { x, y } } = sut;
    let clickPos = pt(x + w * 2 + 2 + padLeft, y + h * 2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');

    env.eventDispatcher.simulateDOMEvents(
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos },
      { target: sut, type: 'click', position: clickPos });

    expect(sut.selection).selectionEquals('Selection(1/0 -> 1/9)');
  });

  it('drag sets selection', () => {
    let { globalPosition: p } = sut;

    let dragStartPos = p.addPt(pt(padLeft + 1, padTop + 2));
    let dragOvershotPos = p.addPt(pt(3 * w + padLeft + 10, h * 2 + padTop + 10));
    let dragEndPos = p.addPt(pt(3 * w + padLeft + 2, h * 2 + padTop - h / 2));

    expect(sut.selection).selectionEquals('Selection(0/0 -> 0/0)');

    env.eventDispatcher.simulateDOMEvents(
      { type: 'pointerdown', buttons: 1, target: sut, position: dragStartPos },
      { type: 'pointermove', buttons: 1, target: sut, position: dragOvershotPos }, // simulate overshoot
      { type: 'pointermove', buttons: 1, target: sut, position: dragEndPos },
      { type: 'pointerup', buttons: 1, target: sut, position: dragEndPos }
    );

    expect(sut.selection).selectionEquals('Selection(0/0 -> 1/3)');
  });
});

describe('saved marks', () => {
  let t; beforeEach(() => t = text('hello\n world', { cursorPosition: { row: 0, column: 0 } }));
  // t.openInWorld(); t.focus();

  it('activates mark to select', () => {
    t.cursorPosition = t.activeMark = { row: 0, column: 1 };
    t.execCommand('go right'); t.execCommand('go right');
    expect(t.selection).selectionEquals('Selection(0/1 -> 0/3)');
  });

  it('reverse selection with mark', () => {
    t.saveMark({ row: 0, column: 1 });
    t.cursorPosition = { row: 0, column: 4 };
    t.execCommand('reverse selection');
    expect(t.selection).selectionEquals('Selection(0/4 -> 0/1)');
  });

  it('activate mark by setting mark', () => {
    t.execCommand('go right'); t.execCommand('toggle active mark');
    t.execCommand('go right'); t.execCommand('go right');
    expect(t.activeMarkPosition).deep.equals({ row: 0, column: 1 });
    expect(t.selection).selectionEquals('Selection(0/1 -> 0/3)');
  });

  it('toggle active mark deactivates selection', () => {
    t.selection = range(0, 1, 0, 4);
    t.execCommand('toggle active mark');
    expect(t.activeMark).equals(null);
    expect(t.selection).selectionEquals('Selection(0/4 -> 0/4)');
    expect(t.lastSavedMark.position).deep.equals({ row: 0, column: 1 });
  });
});

describe('clipboard buffer / kill ring', () => {
  let t, browserExtension;
  beforeEach(async () => {
    await createSut();
    t = sut;
    t.textString = 'a\nb\nc\n ';
    browserExtension = lively.browserExtension;
    delete lively.browserExtension;
  });
  afterEach(() => {
    lively.browserExtension = browserExtension;
    return removeSut();
  });

  it('copy saves to clipboard buffer', async () => {
    t.selection = range(0, 0, 0, 1);
    t.execCommand('manual clipboard copy');
    t.selection = range(1, 0, 1, 1);
    t.execCommand('manual clipboard copy');
    t.selection = range(2, 0, 2, 1);
    t.execCommand('manual clipboard copy');

    t.selection = range(3, 0, 3, 0);
    await t.execCommand('manual clipboard paste');
    expect(t.selection.text).equals('c');
    await t.execCommand('manual clipboard paste', { killRingCycleBack: true });
    expect(t.selection.text).equals('b');
    await t.execCommand('manual clipboard paste', { killRingCycleBack: true });
    expect(t.selection.text).equals('a');
    await t.execCommand('manual clipboard paste');
    expect(t.selection.text).equals('a');

    t.selection = range(2, 0, 2, 1);
    t.execCommand('manual clipboard copy');
    await t.execCommand('manual clipboard paste');
    expect(t.selection.text).equals('c');
  });
});

describe('text movement and selection commands', () => {
  it('selection / line string', () => {
    let t = text('hello\n world', {});
    t.selection = range(0, 2, 0, 4);
    t.withSelectedLinesDo((line, range) => t.insertText(' ', range.start));
    expect(t.textString).equals(' hello\n world');
    expect(t.selection.text).equals('ll');
  });

  describe('saveExcursion', () => {
    it('insert moves saved selections using anchors', async () => {
      let t = text('hello\n world', {});
      t.selection = range(0, 2, 0, 4);
      let nAnchors = t.anchors.length;
      await t.saveExcursion(() => {
        t.insertText('foo', { row: 0, column: 1 });
        t.selectAll();
      }, { useAnchors: true });
      expect(t.textString).equals('hfooello\n world');
      expect(t.selection.text).equals('ll');
      expect(nAnchors).equals(t.anchors.length, 'anchor cleanup failed');
    });

    it('textString change', async () => {
      let t = text('hello\n world', {});
      t.selection = range(0, 2, 0, 4);
      await t.saveExcursion(() => {
        t.textString = 'hello\n world';
      });
      expect(t.textString).equals('hello\n world');
      expect(t.selection.text).equals('ll');
    });
  });

  describe('paragraphs', () => {
    let t;
    beforeEach(() => t = text('\n\naaa\n\nbbbb\n\n\n\nccc\nccc\n\n\n'));
    // 0 = empty
    // 1 = empty
    // 2 = aaa
    // 3 = empty
    // 4 = bbbb
    // 5 = empty
    // 6 = empty
    // 7 = empty
    // 8 = ccc
    // 9 = ccc
    // 10-12 = empty

    it('moves to paragraph borders', () => {
      t.cursorPosition = { row: 0, column: 0 };
      t.execCommand('goto paragraph above');
      expect(t.selection).selectionEquals('Selection(0/0 -> 0/0)');
      t.execCommand('goto paragraph below');
      expect(t.selection).selectionEquals('Selection(3/0 -> 3/0)');
    });
  });

  describe('get position above and below', () => {
    let t;
    before(async () => {
      t = text('a\ncdefg\n', { extent: pt(500, 500), lineWrapping: 'by-chars', fontFamily: 'monospace' });
      // t.editorModeName = 'js';
      t.textString = 'a\ncdefg\n';
      t.textLayout.resetLineCharBoundsCache(t);
      t.document.lines[0].__defineGetter__('height', () => 30);
      t.document.lines[1].__defineGetter__('height', () => 60);
      t.document.lines[2].__defineGetter__('height', () => 30);
      t.debug = false;
      let charBounds = [
        [{ height: 30, width: 10, x: 0, y: 0 }],
        [{ height: 30, width: 10, x: 0, y: 0 },
          { height: 30, width: 10, x: 10, y: 0 },
          { height: 30, width: 10, x: 20, y: 0 },
          { height: 30, width: 10, x: 0, y: 30 },
          { height: 30, width: 10, x: 10, y: 30 }],
        [{ height: 30, width: 10, x: 0, y: 0 }]
      ];
      t.textLayout.charBoundsOfRow = function (morph, row) {
        let result = charBounds[row] || [];
        morph.textLayout.lineCharBoundsCache.set(morph.document.getLine(row), result);
        return result;
      };
      // await promise.waitFor(() => t.editorPlugin);
      // t.openInWorld();
      // t=that
    });

    it('with line wrapping', async () => {
      t.cursorPosition = { column: 5, row: 1 };
      expect(t.screenLineRange().start).deep.equals({ row: 1, column: 3 }, 'before 1');

      t.selection.goUp(1, true);
      expect(t.screenLineRange().start).deep.equals({ row: 1, column: 0 }, 'up wrapped line 1');
      expect(t.cursorPosition).deep.equals({ row: 1, column: 2 }, 'up wrapped line 2');

      t.selection.goUp(1, true);
      expect(t.screenLineRange().start).deep.equals({ row: 0, column: 0 }, 'upped simple line ');
      expect(t.cursorPosition).deep.equals({ row: 0, column: 1 }, 'upped');

      t.selection.goDown(3, true);
      expect(t.cursorPosition).deep.equals({ column: 0, row: 2 }, 'down into wrapped');
      t.selection.goUp(1, true);
      expect(t.cursorPosition).deep.equals({ row: 1, column: 5 }, 'up again from empty line');

      t.cursorPosition = { row: 1, column: 5 };
      t.selection.goUp(1, true);
      expect(t.cursorPosition).deep.equals({ row: 1, column: 2 }, 'up from empty line with goal column set to it');

      t.cursorPosition = { row: 1, column: 1 };
      t.selection.goUp(1, true);
      expect(t.cursorPosition).deep.equals({ row: 0, column: 1 }, 'up from wrapped line with goal column set to it');
    });
  });
});

describe('morph inside textAndAttributes', () => {
  let m;
  beforeEach(() => {
    sut = text('text\nfor tests', {
      fill: Color.gray.lighter(2),
      extent: pt(400, 400),
      fixedWidth: true,
      fixedHeight: true,
      cursorPosition: { row: 0, column: 0 }
    }).openInWorld(pt(100, 100));
    m = $world.addMorph({ extent: pt(200, 100), fill: Color.blue });
  });

  afterEach(() => { sut.remove(); m.remove(); });

  it('new morph gets embedded', async () => {
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    expect(m.owner).equals(sut);
    expect(sut.embeddedMorphs).includes(m);
    await m.whenRendered();
    expect(sut.env.domEnv.document.querySelectorAll('#' + m.id)).length(1);
  });

  it('morph that already is submorph gets embedded', async () => {
    sut.addMorph(m);
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    expect(m.owner).equals(sut);
    expect(sut.embeddedMorphs).includes(m);
    await m.whenRendered();
    expect(sut.env.domEnv.document.querySelectorAll('#' + m.id)).length(1);
  });

  it('remove removes morph from text', async () => {
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    expect(sut.textString).equals('text\n�\nfor tests');
    m.remove();
    expect(sut.textString).equals('text\n\nfor tests');
    expect(sut.embeddedMorphs).not.includes(m);
    expect(sut.anchors.filter(ea => !ea.id.includes('selection-'))).length(0);
  });

  it('text deletion removes morph from text', async () => {
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    expect(sut.textString).equals('text\n�\nfor tests');
    sut.deleteText({ start: { row: 1, column: 0 }, end: { row: 1, column: 1 } });
    expect(sut.textString).equals('text\n\nfor tests');
    expect(sut.embeddedMorphs).not.includes(m);
    expect(sut.submorphs).not.includes(m);
  });

  it('position of embedded morph is correct', async () => {
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    expect(m.position).equals(sut.charBoundsFromTextPosition({ column: 0, row: 1 }).topLeft(), '1');
    sut.cursorPosition = { column: 0, row: 1 };
    sut.execCommand('insertstring', { string: '\n' });
    expect(m.position).equals(sut.charBoundsFromTextPosition({ column: 0, row: 2 }).topLeft(), '2');
    sut.execCommand('delete backwards');
    expect(m.position).equals(sut.charBoundsFromTextPosition({ column: 0, row: 1 }).topLeft(), '3');

    let { anchor } = sut.embeddedMorphMap.get(m);
    let oldPos = m.position;
    m.remove();
    expect(anchor.attributeConnections).equals(undefined);
    sut.insertText('\n', { column: 0, row: 1 });
    expect(m.position).equals(oldPos, '4');
  });

  it('position of embedded morph is enforced', () => {
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    m.moveBy(pt(100, 100));
    expect(m.position).equals(sut.charBoundsFromTextPosition({ column: 0, row: 1 }).topLeft());
  });

  it('layout is updated on morph resize', async () => {
    sut.insertText([m, null, '\n', null], { column: 0, row: 1 });
    m.resizeBy(pt(100, 100));
    await m.whenRendered(); // instead of having to wait for a render pass, make the text morph inject a synchronous forced render and remeasure in order to allow the code to continue with synchronously with the propert values
    expect(m.extent).equals(sut.charBoundsFromTextPosition({ column: 0, row: 1 }).extent());
  });
});
