import { ViewModel } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
import { string } from 'lively.lang';
import { easings } from 'lively.morphic';

export class StatusMessage extends ViewModel {
  static get properties () {
    return {
      stayOpen: { defaultValue: false },
      slidable: { defaultValue: true }, // auto slide up on new message
      isMaximized: { defaultValue: false },
      expandable: {
        defaultValue: true
      },
      maxLines: { defaultValue: 3 },
      isCompact: {
        defaultValue: false
      },
      message: {
        after: ['view']
      },

      title: {
        isStyleProp: true,
        defaultValue: 'Something to think about...',
        set (t) {
          this.setProperty('title', this.sanitizeString(t));
        }
      },

      color: {
        derived: true,
        get () {
          return this.view.fill;
        },
        set (color = Color.rgba(209, 209, 209, 0.9)) {
          this.view.fill = color;
          if (!color) return;
          const l = color.luma();
          if (l > 0.5) this.fontColor = Color.rgb(66, 73, 73);
          else this.fontColor = Color.white;
        }
      },

      compactHeight: {
        readOnly: true,
        get () { return 55; }
      },

      fontColor: {
        after: ['view'],
        defaultValue: Color.rgb(66, 73, 73)
      },

      expose: {
        readOnly: true,
        get () {
          // we are also able to expose custom props/methods on the view root morph
          return ['isStatusMessage', 'isMaximized', 'slideTo', 'slidable', 'stayOpen', 'alignAtBottomOf'];
        }
      },

      bindings: {
        readOnly: true,
        get () {
          return [
            { model: 'close button', signal: 'fire', handler: 'close' },
            // view
            { signal: 'onMouseUp', handler: 'expand' },
            { signal: 'extent', handler: 'onViewResize' }
          ];
        }
      }
    };
  }

  sanitizeString (s) {
    if (Array.isArray(s)) s = s[0];
    return s.split('\n').join('');
  }

  alignAtBottomOf (forMorph) {
    const { view } = this;
    const world = this.world();
    if (!world) return;

    view.bringToFront();

    let targetBounds = forMorph.bounds();
    if (forMorph.isWindow) {
      targetBounds = targetBounds.insetBy(7.5);
    }

    view.width = targetBounds.width;

    if (forMorph.world()) {
      view.position = forMorph.owner.worldPoint(targetBounds.bottomLeft());
    }

    const visibleBounds = world.visibleBounds();
    const bounds = view.bounds();
    const overlapY = bounds.top() + view.height - visibleBounds.bottom();

    if (overlapY > 0) view.moveBy(pt(0, -overlapY));
  }

  close () { this.view.remove(); }

  onRefresh (prop) {
    if (!this.view) return;
    this.ui.messageText.isLayoutable = !this.isCompact;
    this.ui.messageText.visible = !this.isCompact;
    if (prop === 'message') this.updateMessage();
    if (prop === 'title') { this.updateTitle(); }
  }

  viewDidLoad () {
    this.updateMessage();
    this.updateTitle();
  }

  updateTitle () {
    this.ui.messageTitle.textString = this.title;
  }

  updateMessage () {
    const text = this.ui.messageText;
    const value = this.message;
    text.value = value;
    let textEnd = text.documentRange.end;
    if (textEnd.row > this.maxLines) {
      text.replace({ start: { row: this.maxLines, column: 0 }, end: textEnd }, '...\n');
      if (!this.expandedContent) this.expandedContent = value;
    }
    // also check for way too long lines
    // text.lines.filter(l => l.length);
    // this.updateMessage()

    const maxLineLength = 120;
    let hasOversizedLine = false;
    if (!this.isMaximized) {
      text.modifyLines(0, Math.min(text.lineCount(), this.maxLines) - 1, l => {
        hasOversizedLine = l.length > maxLineLength;
        return string.truncate(l, maxLineLength, '...');
      });
    }
    if (hasOversizedLine) this.expandedContent = value;
    // this.onRefresh();
    textEnd = text.documentEndPosition;
    if (textEnd.column !== 0) text.insertText('\n', textEnd);
    const f = 10;
    this.title = string.truncate(text.textString || '', (this.view.width / f).toFixed(), '...');
    this.updateTitle();
  }

  onViewResize () {
    this.onRefresh();
  }

  isEpiMorph () {
    return true;
  }

  isStatusMessage () {
    return true;
  }

  setMessage (msg, color = this.color) {
    this.message = msg;
    this.color = color;
  }

  async slideTo (pos) {
    const startPos = this.view.position;
    this.sliding = this.view.animate({
      customTween: p => {
        this.view.position = startPos.interpolate(p, pos);
      },
      duration: 500
    });
    await this.sliding;
    this.sliding = false;
  }

  async expand () {
    if (!this.expandable) return;
    if (this.sliding) await this.sliding;
    const world = this.view.world();
    if (!world || this.isMaximized) return;
    this.isMaximized = true;
    this.stayOpen = true;
    this.isCompact = false;
    const text = this.ui.messageText;
    text.lineWrapping = false;
    Object.assign(text, { clipMode: 'auto', readOnly: true, reactsToPointer: true });
    text.fixedWidth = false;
    if (this.expandedContent) text.value = this.expandedContent;
    text.document.getLine(0).hasEstimatedExtent = true;
    let ext = text.textBounds().extent();
    const visibleBounds = world.visibleBounds();
    if (ext.y > visibleBounds.extent().y) ext.y = visibleBounds.extent().y - 200;
    if (ext.x > visibleBounds.extent().x) ext.x = visibleBounds.extent().x - 200;
    text.animate({
      height: ext.y + 25,
      duration: 200,
      easing: easings.outExpo
    });
    this.view.animate({
      width: ext.x + 50,
      center: visibleBounds.center(),
      easing: easings.outExpo,
      duration: 200
    });
    this.focus();
  }

  fit () {
    const text = this.ui.messageText;
    if (!text) return;
    const minHeight = 55; const minWidth = 100;
    this.view.extent = pt(minWidth, minHeight).maxPt(text.textBounds().extent());
    this.relayout();
  }

  focus () {
    const text = this.ui.messageText;
    text && text.focus();
  }
}
