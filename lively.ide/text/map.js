import { Canvas } from 'lively.components/canvas.js';
import { connect } from 'lively.bindings';
import { fun, promise } from 'lively.lang';
import { pt, Color } from 'lively.graphics';
import { addClassMappings } from 'lively.morphic/helpers.js';

export default class TextMap extends Canvas {
  static openInside (textMorph) {
    let map = new TextMap();
    map.attachTo(textMorph);
    // map.remove()
    // map.detachFromCurrentTextMorph()
    return map;
  }

  static get properties () {
    return {
      textMorph: {},
      relativeBoundsInTextMorph: {},
      extent: { defaultValue: pt(60, 50) },
      markers: {},
      draggable: { defaultValue: true }
    };
  }

  onChange (change) {
    if (change.prop === 'extent') this.update();
    return super.onChange(change);
  }

  reset () {
    this.border = { width: 0 };
    this.preserveContents = true;

    // this.remove()
    // this.openInWorld()
    // this.update()
    // this.remove()

    // this.attachTo(that);
    // this.detachFromCurrentTextMorph()
    // this.update()
  }

  attachTo (textMorph, add = false) {
    if (this.textMorph) this.detachFrom(this.textMorph);
    this.textMorph = textMorph;
    connect(textMorph, 'viewChange', this, 'updateDebounced');
    connect(textMorph, 'textChange', this, 'updateDebounced');
    connect(textMorph, 'selectionChange', this, 'updateDebounced');

    if (add) {
      this.textMorph.addMorph(this);
      this.height = this.textMorph.height - this.textMorph.padding.top();
    }
    this.update();
    this.makeDirty();
  }

  detachFromCurrentTextMorph () {
    this.detachFrom(this.textMorph);
    this.textMorph = null;
  }

  detachFrom (textMorph) {
    if (!textMorph) return;
    textMorph.attributeConnections.forEach(
      con => con.targetObj === this && con.disconnect());
  }

  updateDebounced () {
    if (this.owner === this.textMorph) {
      this.topRight = this.textMorph.innerBounds().topRight().addPt(this.textMorph.scroll);
    }
    fun.throttleNamed('update-' + this.id, 100, () => this.update())();
  }

  get measure () {
    let { width, height, textMorph } = this;
    let { document: doc } = textMorph;
    let heightPerLine = Math.min(2, height / doc.lines.length);
    let widthPerChar = 0.5;
    return { width, height, heightPerLine, widthPerChar };
  }

  update () {
    let {
      context: ctx,
      textMorph,
      measure: { width, height, heightPerLine, widthPerChar }
    } = this;
    let { document: doc, textLayout, markers, selections } = textMorph;
    let { startRow, endRow } = textLayout.whatsVisible(textMorph);

    if (this.owner === textMorph) {
      this.topRight = this.textMorph.innerBounds().topRight().addPt(this.textMorph.scroll).subXY(this.textMorph.padding.top());
    }

    if (!ctx) return;

    this.clear(null);

    // visible area
    ctx.fillStyle = 'rgba(0,0,0, 0.1)';
    ctx.fillRect(0, 0, width, startRow * heightPerLine);
    ctx.fillStyle = 'rgba(0,0,0, 0.1)';
    ctx.fillRect(0, endRow * heightPerLine, width, height - endRow * heightPerLine);

    // draw the lines
    let x = 0; let y = 0;
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, heightPerLine - 0.3);
    ctx.strokeStyle = 'gray';
    for (let line of doc.lines) {
      let text = line.text;
      let length = text.length;
      let lengthNoTrailingSpace = text.trimLeft().length;
      let x = (length - lengthNoTrailingSpace);
      ctx.moveTo(x, y);
      ctx.lineTo(x + lengthNoTrailingSpace * widthPerChar, y);
      // ctx.moveTo(x, y);
      // ctx.lineTo(x + line.text.length*widthPerChar, y);
      x = 0;
      y += heightPerLine;
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'black';
    ctx.moveTo(0, startRow * heightPerLine);
    ctx.lineTo(width, startRow * heightPerLine);
    ctx.moveTo(0, endRow * heightPerLine);
    ctx.lineTo(width, endRow * heightPerLine);
    ctx.stroke();

    // ctx.fillStyle = "rgba(255,255,255,0.6)";
    // ctx.fillRect(0, startRow*heightPerLine, width, endRow*heightPerLine-startRow*heightPerLine);

    // selections
    ctx.fillStyle = 'blue';
    for (let sel of selections) {
      if (!sel.isEmpty()) { highlighRange(sel, 'blue', true); }
    }

    for (let marker of markers) {
      let color = marker.style['background-color'] || 'red';
      if (typeof color === 'string') {
        let col = Color.fromString(color);
        if (col && col.a < 0.5) { col.a = 0.9; color = col.toRGBAString(); }
      }
      highlighRange(marker.range, color, true);
    }

    function highlighRange (range, color, fullLine = false) {
      let { start, end } = range;
      let selHeight = Math.max((end.row - start.row + 1) * heightPerLine, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, start.row * heightPerLine, width, selHeight);
    }
  }

  onMouseDown (evt) {
    let { textMorph, measure: { width, height, heightPerLine } } = this;
    // evt = this.LastEvent;
    // this.LastEvent = evt;
    let pos = evt.positionIn(this);
    let row = Math.round(pos.y / heightPerLine);
    textMorph.scrollPositionIntoView({ row, column: 0 });
    promise.delay(100).then(() => this.update());
  }

  onDrag (evt) {
    this.onMouseDown(evt);
  }
}

addClassMappings({
  textmap: TextMap
});
