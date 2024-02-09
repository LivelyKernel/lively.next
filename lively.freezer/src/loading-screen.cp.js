import { Morph, World, MorphicDB, TilingLayout, part, Icon, Label, component } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { resource } from 'lively.resources';
import { Project } from 'lively.project';
import { LandingPageBG } from './landing-page.cp.js';
import { ProgressIndicator } from './progress-indicator.cp.js';

export class WorldLoadingScreen extends Morph {
  static get properties () {
    return {
      isFastLoad: {
        get () {
          return resource(document.location.href).query().fastLoad !== false;
        }
      },
      title: {
        derived: true,
        get () {
          return `lively.next (${document.location.hostname})`;
        }
      }
    };
  }

  async activate () {
    if (lively.FreezerRuntime) {
      const projectName = this.getProjectName();
      const worldName = this.getWorldName();
      const filePath = this.getFilePath();
      const snapshot = this.getSnapshot();
      const bg = this.get('background');
      let progressBar = this.get('loading indicator');

      bg.master.setState(2);
      document.body.style.backgroundColor = 'black';

      if (filePath) {
        this.get('json target indicator').animate({
          opacity: 1, duration: 300
        });
      }

      await this.transitionToLivelyWorld({ worldName, filePath, snapshot, projectName }, progressBar);
    }
  }

  async transitionToLivelyWorld ({ worldName, filePath, snapshot, projectName }, progress) {
    const serverURL = resource(window.SYSTEM_BASE_URL || document.location.origin).join('objectdb/').url;
    const { bootstrap } = await System.import('lively.freezer/src/util/bootstrap.js');

    // Preload emoji font to prevent flash of unstyled emojis falling back to system font.
    document.fonts.load('12px Noto Emoji');

    if (projectName) {
      const existingProjects = await Project.listAvailableProjects();
      const foundProject = existingProjects.filter(p => p._name === projectName);
      if (projectName !== '__newProject__' && !foundProject.length > 0) return this.indicateMissing(true);
    }

    if (worldName && worldName !== '__newWorld__' &&
        !(await MorphicDB.named('lively.morphic/objectdb/morphicdb', { serverURL }).exists('world', worldName)).exists) {
      return this.indicateMissing(false);
    }

    if (filePath && !await resource(document.location.origin).join(filePath).exists()) { return this.indicateMissing(false); }

    await bootstrap({ worldName, filePath, loadingIndicator: new Morph(), progress, snapshot, projectName });
  }

  getProjectName () {
    if (!document.location.href.includes('projects')) return false;
    const loc = document.location;
    const query = resource(loc.href).query();
    const projectNameMatch = query.name;
    const projectName = projectNameMatch || false;
    return projectName;
  }

  getWorldName () {
    if (!document.location.href.includes('worlds/')) return false;
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
    this.get('background').fit();
    // Hardcode the eventual width of the indicator, as the positioning will be off otherwise.
    this.get('json target indicator').position = pt(this.extent.x - 72 - 25, 25);
  }

  indicateMissing (project) {
    const ld = this.get('loading indicator');
    ld.visible = ld.isLayoutable = false;
    this.get('broken heart').visible = this.get('broken heart').isLayoutable = true;
    this.get('error text').textString = project ? 'Sorry, the project you requested cannot be found on this machine' : 'Sorry, the world you requested cannot be found on this machine';
  }
}

const ErrorIndicator = component({
  type: Label,
  fontColor: Color.rgba(0, 0, 0, 0.8),
  fontSize: 211,
  isLayoutable: false,
  submorphs: [{
    type: 'text',
    name: 'error text',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(345.1, 104.8),
    position: pt(-61.4, 273.6),
    fill: Color.rgba(0, 0, 0, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontSize: 22,
    fontWeight: 'bold',
    lineWrapping: 'by-words',
    nativeCursor: 'default',
    readOnly: true,
    textAlign: 'center',
    textAndAttributes: ['Sorry, the world you requested cannot be found on this machine.', null]
  }],
  textAndAttributes: Icon.textAttribute('heart-broken')
});

export const LoadingScreen = component({
  type: WorldLoadingScreen,
  name: 'loading screen',
  clipMode: 'hidden',
  extent: pt(1002.4, 598.4),
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 10
  }),
  submorphs: [
    part(LandingPageBG, {
      name: 'background',
      position: pt(-151, -130),
      isLayoutable: false
    }),
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
    part(ErrorIndicator, {
      name: 'broken heart',
      visible: false
    }),
    part(ProgressIndicator, {
      name: 'loading indicator'
    })
  ]
});

export async function main () {
  const ls = part(LoadingScreen, { respondsToVisibleWindow: true });
  $world.addMorph(ls);
  ls.activate();
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
