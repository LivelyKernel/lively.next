import { component } from 'lively.morphic/components/core.js';
import { pt, rect, Color } from 'lively.graphics';
import { HorizontalLayout, easings, stringToEasing, Morph, Ellipse, Icon, Label, VerticalLayout, Path } from 'lively.morphic';
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
    if (this.isComponent || !Path('owner.isWorld').get(this)) return;
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
    const p = stringToEasing(easings.inOutExpo)(num.clamp(Date.now() - this._timeStamp, 0, 1000) / 1000);
    const targetWidth = this._currentProgress;
    pb.width = num.interpolate(p, this._lastWidth, targetWidth);
  }

  async fastLoadTest () {
    this.reset();
    const mods = ['lively.lang', 'lively.ast', 'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.modules', 'lively.user', 'lively.storage', 'lively.morphic'];
    for (const mod of mods) {
      this.finishPackage({ packageName: mod, loaded: true });
      await promise.delay(200);
    }
  }

  // this.finishPackage({ packageName: 'lively.classes', loaded: true });
  // this.reset()

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
      if (state != 'not loaded') {
        stop = checkmark;
        if (state == 'loaded') {
          if (checkmark.visible) return;
          checkmark.animate({
            duration: 300,
            visible: true
          });
        }
        if (state == 'frozen') {
          if (frozenIndicator.visible) return;
          frozenIndicator.animate({
            duration: 300,
            visible: true
          });
        }
        icon.opacity = 1;
      } else {
        checkmark.visible = false;
        frozenIndicator.visible = false;
        icon.opacity = 0.2;
      }
    });

    const progress = this.localizePointFrom(pt(-20, 0), stop).x;
    const dist = Math.max(20, progress - progressPath.left);
    const currentWidth = progressPath.width;

    if (dist == 20) {
      progressPath.visible = false;
    } else {
      progressPath.visible = true;
    }

    this._lastWidth = progressPath.width;
    this._timeStamp = Date.now();
    this._currentProgress = dist;
  }
}

// LoadingProgress.openInWorld()
const LoadingProgress = component({
  // type: ModuleProgress,
  name: 'package loading progress indicator',
  borderRadius: undefined,
  dropShadow: false,
  extent: pt(1003, 164),
  fill: Color.rgba(253, 254, 254, 0),
  layout: new HorizontalLayout({
    align: 'top',
    autoResize: true,
    direction: 'leftToRight',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 23,
      y: 23
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
    spacing: 23
  }),
  position: pt(1177.3, 1118.6),
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
    fill: null,
    isLayoutable: false,
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(20, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })],
    visible: false
  }, {
    name: 'stage lang',
    extent: pt(58, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('language')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['lang', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }],
    tooltip: ''
  }, {
    name: 'stage ast',
    extent: pt(47, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('tree')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['ast', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage source-transform',
    extent: pt(149, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('retweet')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['source transform', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage classes',
    extent: pt(76, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('sitemap')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['classes', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage vm',
    extent: pt(58, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('cogs')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['VM', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage modules',
    extent: pt(85, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('box-open')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['modules', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      installedFonts: {
        _rev: 0
      },
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage user',
    extent: pt(54, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('user-circle')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['user', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage storage',
    extent: pt(77, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('database')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['storage', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage morphic',
    extent: pt(82, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('cube')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['morphic', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }, {
    name: 'stage world',
    extent: pt(64, 118),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new VerticalLayout({
      align: 'center',
      autoResize: true,
      direction: 'topToBottom',
      orderByIndex: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [{
      type: Label,
      name: 'icon',
      fontSize: 30.108,
      opacity: 0.2,
      textAndAttributes: Icon.textAttribute('globe-europe')
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(64, 64, 64),
      fontSize: 16,
      fontWeight: 'Medium',
      nativeCursor: 'pointer',
      textAndAttributes: ['world', null]
    }, {
      type: Ellipse,
      name: 'stop',
      borderColor: Color.rgb(127, 140, 141),
      borderWidth: 4,
      extent: pt(24.3, 24.3),
      fill: Color.rgb(253, 254, 254),
      isEllipse: true,
      submorphs: [{
        type: Label,
        name: 'checkmark',
        fontColor: Color.rgb(100, 221, 23),
        fontSize: 26,
        origin: pt(13, 13),
        position: pt(12.1, 12.1),
        textAndAttributes: Icon.textAttribute('check-circle'),
        visible: false
      }, {
        type: Label,
        name: 'frozen indicator',
        borderRadius: undefined,
        fill: Color.rgb(0, 176, 255),
        fontColor: Color.rgb(255, 255, 255),
        fontSize: 20,
        padding: rect(4, 3, 0, 0),
        textAndAttributes: Icon.textAttribute('snowflake'),
        visible: false
      }]
    }]
  }]
});

export { LoadingProgress };
