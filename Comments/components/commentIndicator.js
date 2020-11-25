import { Morph, Icon, Label } from 'lively.morphic';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { CommentBrowser } from './commentBrowser.js';

export class CommentIndicator extends Label {
  static for (morph) {
    const indicator = new this({ morph });
    return indicator;
  }

  constructor (props = {}) {
    super(props);
    this.morph = props.morph;

    $world.addMorph(this);
    this.initStyling();

    this.alignWithMorph();
    connect(this.morph, 'onChange', this, 'alignWithMorph');
    // connect(this, 'onMouseDown', CommentBrowser.getInstance(), 'scrollToMorph', { converter: () => commentIndicator.morph, varMapping: { commentIndicator: this } });
  }

  initStyling () {
    Icon.setIcon(this, 'comment-alt');
    this.fontSize = 15;
    this.padding = new Rectangle(0, 2, 4, 0);
    this.width = this.fontSize + this.padding.width;
    this.fontColor = Color.rgbHex('#f1c40f');
  }

  alignWithMorph () {
    this.position = pt(this.morph.globalPosition.x + this.morph.width - this.width, this.morph.globalPosition.y + this.padding.y);
  }
}
