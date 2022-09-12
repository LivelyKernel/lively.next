import { Morph, World, MorphicDB, TilingLayout, Path, part, Ellipse, Icon, Label, component, stringToEasing, easings } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { num, promise, fun } from 'lively.lang';
import { resource } from 'lively.resources';
import { LoadingIndicator } from 'lively.components';

export class WorldLoadingScreen extends Morph {
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

  get commands () {
    return [
      {
        name: 'resize on client',
        exec: () => {
          this.relayout();
        }
      }
    ];
  }

  get __head_html__ () {
    return `<script> window.AUTH_SERVER_URL; </script>`;
  }

  async onLoad () {
    if (lively.FreezerRuntime) {
      const progressBar = this.get('package loading indicator');
      const cssLoadingScreen = this.get('css loading screen');
      const worldName = this.getWorldName();
      const filePath = this.getFilePath();
      const snapshot = this.getSnapshot();

      if (snapshot) {
        progressBar.isLayoutable = progressBar.visible = false;
        cssLoadingScreen.isLayoutable = cssLoadingScreen.visible = true;
      } else {
        progressBar.startStepping('updateProgressBar');
        document.body.style.backgroundColor = 'black';
      }

      if (filePath) {
        this.get('json target indicator').animate({
          opacity: 1, duration: 300
        });
      }
      await this.transitionToLivelyWorld({ worldName, filePath, snapshot }, progressBar);
      progressBar.stopStepping();
    }
  }

  async transitionToLivelyWorld ({ worldName, filePath, snapshot }, progress) {
    const serverURL = resource(window.SYSTEM_BASE_URL || document.location.origin).join('objectdb/').url;
    const { bootstrap } = await System.import('lively.freezer/src/util/bootstrap.js');

    if (worldName && worldName !== '__newWorld__' &&
        !(await MorphicDB.named('lively.morphic/objectdb/morphicdb', { serverURL }).exists('world', worldName)).exists) {
      return this.indicateMissingWorld(true);
    }

    if (filePath && !await resource(document.location.origin).join(filePath).exists()) { return this.indicateMissingWorld(true); }

    const loadingIndicator = LoadingIndicator.open('...starting bootstrap process...', {
      animated: true, delay: 1000
    });
    if (snapshot) loadingIndicator.visible = false;

    await bootstrap({ worldName, filePath, loadingIndicator, progress, snapshot });
  }

  getWorldName () {
    if (document.location.href.endsWith('worlds/new')) return '__newWorld__';
    const loc = document.location;
    const query = resource(loc.href).query();
    const worldNameMatch = query.name || window.WORLD_NAME;
    const worldName = worldNameMatch || false;
    return worldName;
  }

  getFilePath () {
    const loc = document.location;
    const query = resource(loc.href).query();
    return query.file || false;
  }

  getSnapshot () {
    const loc = document.location;
    const query = resource(loc.href).query();
    return query.snapshot || window.SNAPSHOT_PATH || false;
  }

  relayout () {
    $world._cachedWindowBounds = null;
    this.setBounds($world.windowBounds());
    this.get('json target indicator').topRight = this.innerBounds().insetBy(25).topRight();
  }

  indicateMissingWorld (active) {
    this.get('package loading indicator').visible = !active;
    this.get('broken heart').visible = this.get('broken heart').isLayoutable = active;
  }
}

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
    const mods = ['lively.lang', 'lively.ast', 'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.modules', 'lively.user', 'lively.storage', 'lively.morphic'];
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
          checkmark.animate({
            duration: 300,
            visible: true
          });
        }
        if (state === 'frozen') {
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

    const progress = this.localizePointFrom(pt(-10, 0), stop).x;
    const dist = Math.max(20, progress - progressPath.left);

    if (dist === 20) {
      progressPath.visible = false;
    } else {
      progressPath.visible = true;
    }

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
    direction: 'topToBottom',
    orderByIndex: true,
    align: 'center',
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
    extent: pt(27, 27),
    fill: Color.rgb(253, 254, 254),
    submorphs: [{
      type: Label,
      name: 'checkmark',
      fontColor: Color.rgb(100, 221, 23),
      fontSize: 26,
      padding: rect(0.5, 0, 0, 0),
      textAndAttributes: Icon.textAttribute('check-circle'),
      visible: true
    }, {
      type: Label,
      name: 'frozen indicator',
      borderRadius: 30,
      fill: Color.rgb(0, 176, 255),
      fontColor: Color.rgb(255, 255, 255),
      fontSize: 20,
      padding: rect(4, 3, 0, 0),
      textAndAttributes: Icon.textAttribute('snowflake'),
      visible: true
    }]
  }]
});

const ProgressIndicator = component({
  type: ModuleProgress,
  borderRadius: 6,
  dropShadow: false,
  extent: pt(1003, 300),
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
    name: 'stage user',
    extent: pt(54, 119),
    submorphs: [{
      name: 'icon',
      textAndAttributes: Icon.textAttribute('user-circle')
    }, {
      name: 'label',
      textAndAttributes: ['user', null]
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

const ErrorIndicator = component({
  type: Label,
  fontColor: Color.rgb(231, 76, 60),
  fontSize: 211,
  isLayoutable: false,
  submorphs: [{
    type: 'text',
    name: 'error text',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(345.1, 104.8),
    position: pt(-67, 206),
    fill: Color.rgba(0, 0, 0, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontSize: 22,
    fontWeight: 'bold',
    lineWrapping: true,
    nativeCursor: 'default',
    readOnly: true,
    textAlign: 'center',
    textAndAttributes: ['Sorry, the world you requested can not be found on the server.', null]
  }],
  textAndAttributes: Icon.textAttribute('heart-broken')
});

const LoadingScreen = component({
  type: WorldLoadingScreen,
  name: 'loading screen',
  extent: pt(1000, 600),
  layout: new TilingLayout({
    direction: 'topToBottom',
    orderByIndex: true,
    axisAlign: 'center',
    align: 'center',
    spacing: 10
  }),
  submorphs: [
    {
      type: Label,
      name: 'json target indicator',
      borderColor: Color.rgb(0, 0, 0),
      borderRadius: 6,
      borderWidth: 2,
      fontSize: 20,
      fontWeight: 'bold',
      isLayoutable: false,
      opacity: 0,
      padding: rect(5, 2, 5, 2),
      textAndAttributes: ['JSON', null]
    },
    part(ErrorIndicator, { name: 'broken heart', visible: false }),
    part(ProgressIndicator, { name: 'package loading indicator', opacity: 0 }), {
      type: 'html',
      name: 'css loading screen',
      cssDeclaration: '#loading-bar {\n\
  height: 20px;\n\
  width: 400px;\n\
  color: gray;\n\
  border-style: solid;\n\
  border-color: gray;\n\
  border-width: 2px;\n\
  border-radius: 10px;\n\
  position: absolute;\n\
  top: 50%;\n\
  left: 50%;\n\
  overflow: hidden;\n\
  margin: 0px 0 0 -202px;\n\
}\n\
\n\
#progress {\n\
  background-color: gray;\n\
  height: 100%;\n\
  animation: load 5s;\n\
}\n\
\n\
@keyframes load {\n\
  from { width: 0% }\n\
  to { width: 100% }\n\
}',
      extent: pt(940, 274.3),
      html: '<div style="position: fixed; z-index: 1; height: 100%; width: 100%; background-color: transparent">\n\
  <div id="loading-bar">\n\
     <div id="progress" style="width: 100%;">\n\
  </div>\n\
</div></div>',
      isLayoutable: false,
      visible: false
    }
  ]
});

export async function main () {
  const ls = part(LoadingScreen);
  await ls.get('icon').whenFontLoaded();
  ls.respondsToVisibleWindow = true;
  $world.addMorph(ls);
  ls.relayout();
}

export const TITLE = 'lively.next';

export const WORLD_CLASS = World;

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

export { ProgressIndicator };
