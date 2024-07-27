import { Morph, component, config, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { LivelyWorld } from 'lively.ide/world.js';
import { PropertyLabel } from 'lively.ide/studio/shared.cp.js';
// this pulls in a bunch of code
import { WorldBrowser } from 'lively.ide/studio/world-browser.cp.js';
import { UserFlap } from 'lively.user/user-flap.cp.js';
import { ViewModel } from 'lively.morphic/components/core.js';

import { TilingLayout } from 'lively.morphic/layout.js';
import { OfflineToggleLight } from 'lively.ide/offline-mode-toggle.cp.js';
import { LinearGradient } from 'lively.graphics/color.js';
import { rect } from 'lively.graphics/geometry-2d.js';
import { Polygon } from 'lively.morphic/morph.js';
import { connect } from 'lively.bindings';
import { ProgressIndicator } from './progress-indicator.cp.js';

class LandingPageWorld extends LivelyWorld {
  showHaloFor () {
    // noop
  }

  onContextMenu (evt) {
    evt.stop();
  }

  onLoad () {
    // noop
  }
}

class WorldLandingPage extends Morph {
  static get properties () {
    return {
      title: {
        derived: true,
        get () {
          return `lively.next (${document.location.hostname})`;
        }
      }
    };
  }

  relayout () {
    this.setBounds($world.windowBounds());
    this.getSubmorphNamed('background').fit();
    const worldList = this.getSubmorphNamed('a project browser');
    const padding = 50;
    const maxWidth = 1100;
    if (worldList) {
      worldList.width = Math.min(this.world().visibleBounds().width - 2 * padding, maxWidth);
      worldList.center = this.extent.scaleBy(0.5);
    }
  }

  async onLoad () {
    await this.whenRendered();
    if (!lively.FreezerRuntime) return;
    $world.fill = Color.black;
    document.body.style.background = Color.black;
    this.showWorldList();
  }

  async showWorldList () {
    await WorldBrowser.loadAllFonts(); // force the fonts to be loaded
    const dashboard = this.getSubmorphNamed('a project browser') ||
          this.addMorph(part(WorldBrowser, {
            name: 'a project browser',
            isLayoutable: false,
            viewModel: { showCloseButton: false, progressIndicator: this.get('loading indicator') }
          }));
    this.reset();
    dashboard.showCloseButton = false;
    dashboard.extent = pt(1110, 800).minPt(this.extent.subPt(pt(50, 150)));
    dashboard.center = this.innerBounds().center();

    await dashboard.allFontsLoaded();
    dashboard.animate({
      opacity: 1, duration: 300
    });
    dashboard.hasFixedPosition = false;
    connect(dashboard, 'fadingOut', this, 'showProgressBar');
  }

  showProgressBar () {
    const bg = this.getSubmorphNamed('background');
    const ld = this.getSubmorphNamed('loading indicator');
    bg.zoomIn();
    bg.step = 2;
    ld.animate({ visible: true });
  }

  reset () {
    const dashboard = this.getSubmorphNamed('a project browser');
    dashboard.opacity = 0;
    dashboard.center = this.innerBounds().center();
  }
}

export class ShapeMorpher extends ViewModel {
  static get properties () {
    return {
      isZoomed: { defaultValue: false },
      expose: {
        get () { return ['fit', 'step', 'zoomIn']; }
      },
      step: {
        defaultValue: 1,
        set (s) {
          this.setProperty('step', s);
          this.update();
        }
      }
    };
  }

  viewDidLoad () {
    this.view.master.setState(this.step);
  }

  zoomIn () {
    this.isZoomed = true;
    this.view.withAnimationDo(() => {
      this.fit();
    });
  }

  fit () {
    const { view } = this;
    const owner = view.owner;
    const f = this.isZoomed ? 1.3 : 1;
    view.scale = Math.max(owner.width / view.width, owner.height / view.height) * f;
    view.center = owner.extent.scaleBy(0.5);
  }

  morphShapes () {
    this.step = this.step % 3 + 1;
  }

  update () {
    if (!this.view) return;
    this.view.master.setState(this.step);
    this.view.master.applyAnimated();
  }
}

const Step1 = component({
  clipMode: 'hidden',
  extent: pt(1320.3, 829.3),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(241, 196, 15) }, { offset: 1, color: Color.rgb(243, 156, 18) }], vector: rect(0.18831659137345552, 0.10903522820215822, 0.623366817253089, 0.7819295435956836) }),
  position: pt(132.7, 143),
  renderOnGPU: true,
  submorphs: [{
    type: Polygon,
    name: 'triangle 1',
    vertices: [({ position: pt(310.1325, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(728.6366, 867.3553), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 869.1404), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })],
    borderColor: Color.rgb(204, 0, 0),
    extent: pt(728.6, 869.1),
    fill: Color.rgba(230, 126, 34),
    opacity: 0.6,
    position: pt(110.4, 8.1)
  }, {
    type: Polygon,
    name: 'triangle 2',
    vertices: [({ position: pt(75.729, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(868.2498, 709.1216), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 708.8307), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })],
    borderColor: Color.rgb(204, 0, 0),
    extent: pt(868.2, 709.1),
    fill: Color.rgb(230, 126, 34),
    opacity: 0.6,
    position: pt(575.6, 210.3)
  }, {
    type: Polygon,
    name: 'triangle 3',
    vertices: [({ position: pt(115.663, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(868.2498, 642.4119), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 642.121), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })],
    borderColor: Color.rgb(204, 0, 0),
    extent: pt(868.2, 642.4),
    fill: Color.rgb(230, 126, 34),
    opacity: 0.6,
    position: pt(792.8, 338.2)
  }]
});

const Step2 = component(Step1, {
  submorphs: [
    {
      name: 'triangle 1',
      extent: pt(728.6, 1003.9),
      position: pt(110.4, -126.7),
      vertices: [({ position: pt(723.5352, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(728.6366, 1002.1034), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 1003.8885), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    },
    {
      name: 'triangle 2',
      extent: pt(1198.6, 1159.7),
      position: pt(138.5, -71.9),
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1198.6375, 392.015), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(259.7853, 1159.6876), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }, {
      name: 'triangle 3',
      extent: pt(1915.5, 788.6),
      position: pt(-10.8, 126.3),
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1915.5068, 788.5901), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1047.257, 788.2993), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }
  ]
});

const Step3 = component(Step1, {
  submorphs: [
    {
      name: 'triangle 1',
      extent: pt(1756.6, 697.5),
      position: pt(-811, 1.9),
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1756.6094, 205.8496), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(510.9803, 697.5155), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    },
    {
      name: 'triangle 2',
      extent: pt(753.5, 422),
      position: pt(291.8, 421.5),
      vertices: [({ position: pt(338.1243, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(753.5427, 422.0051), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 409.0511), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    },
    {
      name: 'triangle 3',
      extent: pt(1374.1, 799.2),
      position: pt(953.8, 58.4),
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1374.1132, 766.3091), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(263.9232, 799.2007), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }
  ]
});

export const LandingPageBG = component(Step1, {
  defaultViewModel: ShapeMorpher,
  master: {
    states: {
      1: Step1,
      2: Step2,
      3: Step3
    }
  }
});

const LandingPage = component({
  type: WorldLandingPage,
  name: 'landing page',
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center'
  }),
  extent: pt(1319.9, 829.4),
  fill: Color.black,
  submorphs: [
    part(LandingPageBG, {
      name: 'background',
      position: pt(0, 0),
      isLayoutable: false
    }),
    part(ProgressIndicator, { name: 'loading indicator', visible: false })
  ]
});

class WorldAligningLandigPageUIElements extends ViewModel {
  get expose () {
    return ['relayout'];
  }

  get bindings () {
    return [
      { target: 'top side', signal: 'extent', handler: 'relayout' }
    ];
  }

  async relayout () {
    this.view.position = pt(0, 0);
    $world._cachedWindowBounds = null;
    document.body.style.overflowY = 'hidden';
    this.ui.topSide.topRight = $world.visibleBounds().insetBy(10).topRight();
    this.ui.fastLoadToggler.bottomRight = $world.visibleBounds().insetBy(10).bottomRight();
    return this.view;
  }
}

class FastLoadTogglerModel extends ViewModel {
  static get properties () {
    return {
      fastMode: {
        defaultValue: true
      },
      expose: {
        get () {
          return ['onMouseDown'];
        }
      }
    };
  }

  onMouseDown () {
    if (this.fastMode) {
      this.fastMode = false;
      this.view.textAndAttributes = ['🐢', { fontFamily: 'Noto Emoji' }];
      this.view.tooltip = 'Activate Fast Load (Recommended)';
      lively.doNotUseFastLoad = true;
    } else {
      this.fastMode = true;
      this.view.textAndAttributes = ['🐇', { fontFamily: 'Noto Emoji' }],
      this.view.tooltip = 'Deactivate Fast Load (Advanced Operation)';
      delete lively.doNotUseFastLoad;
    }
  }
}

const FastLoadToggler = component(PropertyLabel, {
  name: 'fast load toggler',
  defaultViewModel: FastLoadTogglerModel,
  fontSize: 14,
  borderRadius: 5,
  fill: Color.rgba(0, 0, 0, 0.3772),
  textAndAttributes: ['🐇', { fontFamily: 'Noto Emoji' }],
  tooltip: 'Deactivate Fast Load (Advanced Operation)'
});

const LandingPageUI = component(
  {
    name: 'landing page ui elements',
    defaultViewModel: WorldAligningLandigPageUIElements,
    fill: Color.transparent,
    clipMode: 'visible',
    position: pt(0, 0),
    submorphs: [
      {
        name: 'top side',
        borderRadius: 5,
        extent: pt(286, 52.7),
        fill: Color.rgba(0, 0, 0, 0.3772),
        layout: new TilingLayout({
          axisAlign: 'center',
          hugContentsHorizontally: true,
          padding: rect(10, 5, -5, 0),
          spacing: 5
        }),
        submorphs: [part(OfflineToggleLight),
          part(UserFlap, {
            name: 'user flap',
            submorphs: [{
              name: 'left user label',
              fontColor: Color.rgb(255, 255, 255)
            }, {
              name: 'right user label',
              fontColor: Color.rgb(255, 255, 255)
            }, {
              name: 'spinner',
              viewModel: { color: 'white' }
            }]
          })]
      },
      part(FastLoadToggler, {
        name: 'fast load toggler'
      })
    ]
  });

export async function main () {
  config.altClickDefinesThat = false;
  config.ide.studio.canvasModeEnabled = false;

  part(LandingPage, { respondsToVisibleWindow: true }).openInWorld().relayout();
  part(LandingPageUI, { respondsToVisibleWindow: true }).openInWorld().relayout();
}

export const TITLE = 'lively.next';

export const WORLD_CLASS = LandingPageWorld;

export const EXCLUDED_MODULES = [
  'lively.collab',
  'mocha-es6', 'mocha', 'picomatch', // references old lgtg that breaks the build
  'path-is-absolute', 'fs.realpath', 'rollup', // has a dist file that cant be parsed by rollup
  '@babel/preset-env',
  '@babel/plugin-syntax-import-meta',
  '@rollup/plugin-json',
  '@rollup/plugin-commonjs',
  'rollup-plugin-polyfill-node',
  'babel-plugin-transform-es2015-modules-systemjs'
];
