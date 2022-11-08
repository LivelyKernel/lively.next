import { component } from './components/core.js';
import { pt, Color } from 'lively.graphics';
import { TilingLayout } from './layout.js';
import { ViewModel } from './components/core.js';
import { Label } from './text/label.js';

class Tooltip extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['description', 'softRemove', 'update'];
        }
      },
      description: {
        get () {
          return this.ui.label.value;
        },
        set (stringOrAttributes) {
          const { label } = this.ui;
          label.value = stringOrAttributes;
          label.fit();
        }
      }
    };
  }

  update (target) {
    this.view.position = target.globalBounds().bottomCenter().subPt(target.world().scroll).addPt(pt(0, 7));
    const visibleWorldBounds = target.world().visibleBoundsExcludingTopBar().insetBy(10);
    const adjustedLabelBounds = visibleWorldBounds.translateForInclusion(this.view.bounds());
    this.view.setBounds(adjustedLabelBounds.translatedBy(target.world().scroll.negated()));
  }

  async softRemove (cb) {
    await this.view.animate({ opacity: 0, duration: 300 });
    cb && cb(this);
    this.view.remove();
  }
}

const SystemTooltip = component({
  name: 'system/tooltip',
  epiMorph: true,
  defaultViewModel: Tooltip,
  borderRadius: 5,
  extent: pt(82, 26),
  fill: Color.rgba(0, 0, 0, 0.68),
  hasFixedPosition: true,
  layout: new TilingLayout({
    align: 'left',
    axis: 'row',
    axisAlign: 'left',
    wrapSubmorphs: false,
    hugContentsVertically: true,
    hugContentsHorizontally: true,
    autoResize: true,
    padding: 5,
    resizeSubmorphs: false
  }),
  position: pt(715, 460),
  reactsToPointer: false,
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    textAndAttributes: ['I am a tooltip', null]
  }]
});

export { SystemTooltip };
