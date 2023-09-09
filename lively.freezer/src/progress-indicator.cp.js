import { component, easings, stringToEasing, Morph, part, Path, Ellipse, Icon, Label, TilingLayout } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { num, fun, promise } from 'lively.lang';

export default class ModuleProgress extends Morph {
  static get properties () {
    return {
      stages: {
        serialize: false,
        after: ['submorphs'],
        initialize () {
          this.whenRendered().then(() => {
            this.reset();
          });
        }
      }
    };
  }

  fadeIntoBack () {
    this.animate({
      blur: 5
    });
  }

  relayout () {
    if (this.isComponent || this.owner?.isWorld) return;
    this.bottomCenter = $world.visibleBounds().center().subXY(0, 100);
  }

  reset () {
    const stageMorphs = this.getAllNamed(/stage/);
    this.blur = 0;
    this.stages = new Map(stageMorphs.map(stage => [stage, 'not loaded']));
    this.updateProgressVisualization();
    this.getAllNamed(/label/).map(m => {
      m._cachedTextBounds = null;
      m.fit();
    });
  }

  updateProgressBar () {
    if (!this._lastWidth) return;
    this.relayout();
    const pb = this.get('progress path');
    const cm = this.get('stage lang').get('checkmark');
    const p = stringToEasing(easings.inOutExpo)(num.clamp(Date.now() - this._timeStamp, 0, 1000) / 1000);
    const targetWidth = this._currentProgress;
    pb.width = num.interpolate(p, this._lastWidth, targetWidth);
    pb.position = cm.transformPointToMorph(this, cm.extent.scaleByPt(pt(1, .5)));
  }

  async fastLoadTest () {
    this.reset();
    const mods = ['lively.lang', 'lively.ast', 'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.modules', 'lively.storage', 'lively.morphic'];
    for (const mod of mods) {
      this.finishPackage({ packageName: mod, loaded: true });
      await promise.delay(200);
    }
  }

  finishPackage ({
    packageName, frozen, loaded
  }) {
    const stageName = 'stage ' + packageName.replace('lively.', '');
    const stageMorph = this.get(stageName);
    if (frozen) this.stages.set(stageMorph, 'frozen');
    if (loaded) this.stages.set(stageMorph, 'loaded');
    fun.debounceNamed('update progress', 200, () => {
      this.updateProgressVisualization();
    })();
  }

  updateProgressVisualization () {
    const progressPath = this.getSubmorphNamed('progress path');
    const stages = this.getAllNamed(/stage/);

    let stop = stages[0];
    stages.forEach(stage => {
      const checkmark = stage.get('checkmark');
      const frozenIndicator = stage.get('frozen indicator');
      const icon = stage.get('icon');

      const state = this.stages.get(stage);
      if (state !== 'not loaded') {
        stop = checkmark;
        if (state === 'loaded') {
          if (checkmark.visible) return;
          checkmark.visible = true;
        }
        if (state === 'frozen') {
          if (frozenIndicator.visible) return;
          frozenIndicator.visible = true;
        }
        icon.opacity = 1;
      } else {
        checkmark.visible = false;
        frozenIndicator.visible = false;
        icon.opacity = 0.2;
      }
    });

    const progress = this.localizePointFrom(pt(-10, 0), stop).x;
    const dist = Math.max(20, progress - progressPath.left);

    this._lastWidth = progressPath.width;
    this._timeStamp = Date.now();
    this._currentProgress = dist;
  }
}

const Stage = component({
  name: 'stage',
  extent: pt(58, 119),
  fill: Color.rgba(46, 75, 223, 0),
  layout: new TilingLayout({
    orderByIndex: true,
    axis: 'column',
    align: 'center',
    axisAlign: 'center',
    spacing: 10
  }),
  submorphs: [{
    type: Label,
    name: 'icon',
    fontSize: 30.108,
    opacity: 0.2,
    lineHeight: 1,
    textAndAttributes: Icon.textAttribute('language')
  }, {
    type: Label,
    name: 'label',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(64, 64, 64),
    fontSize: 16,
    fontWeight: '500',
    nativeCursor: 'pointer',
    textAndAttributes: ['lang', null]
  }, {
    type: Ellipse,
    name: 'stop',
    borderColor: Color.rgb(127, 140, 141),
    borderWidth: 4,
    extent: pt(27, 27),
    fill: Color.rgb(253, 254, 254),
    submorphs: [{
      type: Label,
      name: 'checkmark',
      fontColor: Color.rgb(100, 221, 23),
      fontSize: 27,
      lineHeight: 1,
      textAndAttributes: Icon.textAttribute('check-circle'),
      visible: true
    }, {
      type: Label,
      name: 'frozen indicator',
      borderRadius: 30,
      fill: Color.rgb(0, 176, 255),
      fontColor: Color.rgb(255, 255, 255),
      fontSize: 20,
      lineHeight: 1,
      padding: rect(4, 3, 0, 0),
      textAndAttributes: Icon.textAttribute('snowflake'),
      visible: true
    }]
  }]
});

export const ProgressIndicator = component({
  type: ModuleProgress,
  borderRadius: 6,
  dropShadow: false,
  extent: pt(1003, 400),
  fill: Color.rgba(253, 254, 254, 0),
  name: 'progress indicator',
  layout: new TilingLayout({
    align: 'center',
    spacing: 23
  }),
  submorphs: [{
    type: Path,
    name: 'progress path',
    borderColor: Color.rgb(127, 140, 141),
    borderWidth: 3,
    endMarker: {
      children: [{
        d: 'M0,0 L10,5 L0,10 z',
        tagName: 'path'
      }],
      fill: 'rgba(127,140,141,1)',
      id: 'end-marker',
      markerHeight: '5',
      markerWidth: '5',
      orient: 'auto',
      refX: '5',
      refY: '5',
      tagName: 'marker',
      viewBox: '0 0 10 10'
    },
    extent: pt(20, 3),
    fill: Color.transparent,
    isLayoutable: false,
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(20, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })],
    visible: false
  }, part(Stage, {
    name: 'stage lang',
    extent: pt(58, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('language')
    }, {
      name: 'label',
      textString: 'lang'
    }]
  }), part(Stage, {
    name: 'stage ast',
    extent: pt(47, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('tree')
    }, {
      name: 'label',
      textAndAttributes: ['ast', null]
    }]
  }), part(Stage, {
    name: 'stage source-transform',
    extent: pt(149, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('retweet')
    }, {
      name: 'label',
      textAndAttributes: ['source transform', null]
    }]
  }), part(Stage, {
    name: 'stage classes',
    extent: pt(76, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('sitemap')
    }, {
      name: 'label',
      textAndAttributes: ['classes', null]
    }]
  }), part(Stage, {
    name: 'stage vm',
    extent: pt(58, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('cogs')
    }, {
      name: 'label',
      textAndAttributes: ['VM', null]
    }]
  }), part(Stage, {
    name: 'stage modules',
    extent: pt(85, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('box-open')
    }, {
      name: 'label',
      textAndAttributes: ['modules', null]
    }]
  }), part(Stage, {
    name: 'stage storage',
    extent: pt(77, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('database')
    }, {
      name: 'label',
      textAndAttributes: ['storage', null]
    }]
  }), part(Stage, {
    name: 'stage morphic',
    extent: pt(82, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('cube')
    }, {
      name: 'label',
      textAndAttributes: ['morphic', null]
    }]
  }), part(Stage, {
    name: 'stage world',
    extent: pt(64, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('globe-europe')
    }, {
      name: 'label',
      textAndAttributes: ['world', null]
    }]
  })]
});
