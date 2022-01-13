import { Morph, HTMLMorph, MorphicDB, World, easings, morph } from 'lively.morphic';
import { promise, string, date } from 'lively.lang';
import { Color, pt } from 'lively.graphics';
import { LoadingIndicator } from 'lively.components';
import { resource } from 'lively.resources';
import { component } from 'lively.morphic/components/core.js';
import { Canvas } from 'lively.components/canvas.js';
import { WebGLCanvas } from 'lively.components/webgl-canvas.js';

class Globe extends Canvas {
  async fullyLoaded () {
    let canvas = this.get('webgl canvas');
    return await promise.waitFor(5000, () => canvas.firstFrameRendered);
  }
  
  async onLoad () {
    if (navigator.webdriver || !lively.FreezerRuntime) return;
    await this.whenRendered();
    let canvas = this.get('webgl canvas');
    canvas.renderGlobe();
    await this.fullyLoaded();
    await promise.delay(500);
    this.get('cover').animate({
      opacity: 0,
      easing: easings.inOutCubic
    });
    canvas.relayout();
  }

  beforePublish () {
    this.get('cover').opacity = 1;
  }

  onExtentChanged () {
    super.onExtentChanged();
    this.get('webgl canvas').extent = this.extent;
    this.get('cover').extent = this.extent;
  }
}

export class TitleWrapper extends Morph {
  static get properties () {
    return {
      title: {
        derived: true,
        set (title) {
          this.setProperty('title', title);
          if (title) { this.submorphs[0].textString = string.truncate(title, 18, '...'); }
        }
      }
    };
  }

  startMovingRight () {
    this.animate({
      customTween: p => { this._hoverDelta = p; }
    });
  }

  stopMovingRight () {
    this.animate({
      customTween: p => { this._hoverDelta = 1 - p; }
    });
  }

  startMovingLeft () {
    this.animate({
      customTween: p => { this._hoverDelta = -p; }
    });
  }

  stopMovingLeft () {
    this.animate({
      customTween: p => { this._hoverDelta = -1 + p; }
    });
  }

  async startOnce (fn) {
    if (this._fn) return;
    this._fn = fn;
    await fn();
    this._fn = null;
  }

  updateTitle () {
    if (!this.title) return;
    const [title] = this.submorphs;
    title.left += this._hoverDelta;
    if (title.right < this.width - 20 && this._hoverDelta === -1) {
      // do not enter this block twice
      this.startOnce(async () => {
        await this.stopMovingLeft();
        await this.startMovingRight();
      });
    } else if (title.left > 20 && this._hoverDelta === 1) {
      // do not enter this block twice
      this.startOnce(async () => {
        await this.stopMovingRight();
        await this.startMovingLeft();
      });
    }
  }

  async startShowingFullTitle () {
    if (!this.title) return;
    const [title] = this.submorphs;
    title.textString = this.title;
    await title.whenRendered();
    this._hoverDelta = 0;
    this.startStepping('updateTitle');
    if (title.right > this.width) { this.startMovingLeft(); }
  }

  stopShowingFullTitle () {
    if (!this.title) return;
    const title = this.submorphs[0];
    title.textString = string.truncate(this.title, 18, '...');
    this.stopStepping('updateTitle');
    this._hoverDelta = 0;
    title.left = 0;
  }

  onHoverIn (evt) {
    super.onHoverIn(evt);
    this.startShowingFullTitle();
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    this.stopShowingFullTitle();
  }
}

export class WorldPreview extends Morph {
  static get properties () {
    return {
      ui: {
        readOnly: true,
        get () {
          return {
            previewContainer: this.getSubmorphNamed('preview container'),
            versionContainer: this.getSubmorphNamed('version container'),
            preview: this.getSubmorphNamed('preview'),
            timestamp: this.getSubmorphNamed('timestamp'),
            title: this.getSubmorphNamed('title wrapper'),
            description: this.getSubmorphNamed('description'),
            openButton: this.getSubmorphNamed('open button'),
            versionButton: this.getSubmorphNamed('version button'),
            spinner: this.getSubmorphNamed('spinner'),
            deleteButton: this.getSubmorphNamed('delete button'),
            closeVersionsButton: this.getSubmorphNamed('close versions button'),
            versionList: this.getSubmorphNamed('version list'),
            deleteWorldPrompt: this.getSubmorphNamed('delete world prompt'),
            cancelDeleteButton: this.getSubmorphNamed('cancel delete button'),
            confirmDeleteButton: this.getSubmorphNamed('confirm delete button')
          };
        }
      }
    };
  }

  relayout () {
    // fit to world
    this.setBounds(this.world().visibleBounds());
  }

  onLoad () {
    this.ui.spinner.visible = false; // this causes the fan to spin
  }

  async displayPreview () {
    await this.initWithCommit(this._commit);
  }

  async initWithCommit (commit) {
    const {
      preview, timestamp, title, description,
      previewContainer
    } = this.ui;
    this.opacity = 0.5;
    previewContainer.opacity = 0;
    await this.whenRendered();
    this._commit = commit;
    preview.imageUrl = commit.preview; // || missingSVG;
    let { name: authorName } = commit.author;
    authorName = authorName.startsWith('guest-') ? 'guest' : authorName;
    timestamp.value = [authorName, { fontSize: 13, fontWeight: 'bold', paddingTop: '1px' }, date.format(commit.timestamp, ' - d.m.yy HH:MM'), {
      fontWeight: 'bold', fontSize: 12, paddingTop: '2px'
    }];
    title.title = commit.name;
    description.value = commit.description;
    await this.whenRendered();
    previewContainer.opacity = 1;
    this.animate({ opacity: 1, duration: 300 });
  }

  async openAnimated (targetBounds = $world.visibleBounds()) {
    const copy = morph({
      ...this.spec(),
      reactsToPointer: false,
      renderOnGPU: true,
      submorphs: [this.ui.spinner.spec()]
    }).openInWorld();
    copy.hasFixedPosition = true;
    copy.globalPosition = this.globalPosition;
    copy.opacity = 0;
    await copy.whenRendered();
    await copy.animate({ opacity: 1, duration: 300 });
    const duration = 500;
    copy.dropShadow = false;
    copy.animate({
      bounds: targetBounds,
      borderRadius: 0,
      duration,
      easing: easings.inOutQuint
    });
    copy.respondsToVisibleWindow = true;
    await copy.ui.spinner.animate({
      center: copy.innerBounds().center(),
      duration,
      easing: easings.inOutQuint
    });
    await promise.delay(1000);
    return copy;
  }

  async openWorld () {
    await this.openAnimated();
    this.loadWorld();
  }

  async loadWorld () {
    const { _id, name } = this._commit;
    if (lively.FreezerRuntime) {
      // open the world via url redirect
      // rms: instead of redirect load within world
      // window.location = `/worlds/${name}${dbQuery}`;
      const li = LoadingIndicator.open('...starting bootstrap process...', {
        animated: true, delay: 1000
      });
      this.transitionToLivelyWorld(
        document.location.origin,
        this._commit,
        li
      );
    } else {
      const li = LoadingIndicator.open('loading ' + name);
      await World.loadFromCommit(_id, undefined, { morphicDB: MorphicDB.default });
      li.remove();
    }
  }

  async transitionToLivelyWorld (baseURL, commit, loadingIndicator) {
    const progress = await resource('part://partial freezing/package loading progress indicator').read();
    const { bootstrap } = await System.import('local://lively-object-modules/PartialFreezing/bootstrap.js');
    await bootstrap({ commit, loadingIndicator, progress });
  }

  async showVersions () {
    const duration = 200; const easing = easings.inOutExpo;
    const { previewContainer } = this.ui;
    const versionContainer = await resource('part://partial freezing/version container').read();
    versionContainer.name = 'version container';
    versionContainer.position = pt(0, 0);
    this.addMorph(versionContainer);
    versionContainer.reactsToPointer = versionContainer.visible = true;
    versionContainer.initializeFromStartCommit(this._commit);
    this.animate({
      width: 515, duration, easing
    });
    previewContainer.animate({
      opacity: 0, duration
    });
    await versionContainer.animate({
      opacity: 1, duration
    });
    previewContainer.reactsToPointer = previewContainer.visible = false;
  }

  async hideVersions () {
    const duration = 200; const easing = easings.inOutExpo;
    const { previewContainer, versionContainer } = this.ui;
    previewContainer.reactsToPointer = previewContainer.visible = true;
    this.animate({
      width: 245, duration, easing
    });
    previewContainer.animate({
      opacity: 1, duration
    });
    await versionContainer.animate({
      opacity: 0, duration
    });
    versionContainer.reset();
    versionContainer.remove();
  }

  toggleDeleteButton (active) {
    this.ui.deleteButton.visible = active;
  }

  onHoverIn (evt) {
    this.toggleDeleteButton(true);
  }

  onHoverOut (evt) {
    this.toggleDeleteButton(false);
  }

  async tryToDelete () {
    const duration = 300;
    const { previewContainer } = this.ui;
    const deleteWorldPrompt = await resource('part://partial freezing/delete world prompt').read();
    Object.assign(deleteWorldPrompt, {
      name: 'delete world prompt',
      position: pt(0, 0),
      opacity: 0
    });
    this.addMorph(deleteWorldPrompt);
    deleteWorldPrompt.visible = true;
    await this.withAnimationDo(() => {
      deleteWorldPrompt.opacity = 1;
      this.dropShadow = this.dropShadow.with({
        color: Color.black.withA(0.5),
        blur: 50
      });
      previewContainer.opacity = 0.3;
      previewContainer.blur = 1;
    }, { duration });
  }

  async confirmDelete () {
    await MorphicDB.default.commit({ ...this._commit, content: undefined, snapshot: null });
    if (!this.isComponent && !this.owner.isWorld) this.owner.remove();
  }

  async cancelDelete () {
    const duration = 300;
    const { previewContainer, deleteWorldPrompt } = this.ui;
    await this.withAnimationDo(() => {
      Object.assign(previewContainer, {
        opacity: 1, blur: 0
      });
      this.dropShadow = this.dropShadow.with({ color: Color.rgba(0, 0, 0, 0.11) });
      deleteWorldPrompt.opacity = 0;
    }, { duration });
    deleteWorldPrompt.remove();
  }

  onMouseUp (evt) {
    const {
      openButton, versionButton, deleteButton,
      closeVersionsButton, cancelDeleteButton,
      confirmDeleteButton
    } = this.ui;
    // we want to initialize this from the spec, so we dont use connections
    switch (evt.targetMorph) {
      case openButton:
        this.openWorld();
        break;
      case versionButton:
        this.showVersions();
        break;
      case deleteButton:
        this.tryToDelete();
        break;
      case closeVersionsButton:
        this.hideVersions();
        break;
      case confirmDeleteButton:
        this.confirmDelete();
        break;
      case cancelDeleteButton:
        this.cancelDelete();
        break;
    }
  }
}

export class WorldLandingPage extends Morph {
  static get properties () {
    return {
      title: {
        derived: true,
        get () {
          return `lively.next (${document.location.hostname})`;
        }
      },
      loadingScreen: {}
    };
  }

  get __loading_html__ () {
    return `
      <style>
        ${this.loadingScreen.cssDeclaration}
      </style>
      ${this.loadingScreen.html}
    `;
  }

  get __head_html__ () {
    return `
<script> window.AUTH_SERVER_URL; </script>
<link type="text/css" rel="stylesheet" id="lively-font-awesome" href="/lively.morphic/assets/font-awesome/css/font-awesome.css">
<link type="text/css" rel="stylesheet" id="lively-font-inconsolata" href="/lively.morphic/assets/inconsolata/inconsolata.css">
<style type="text/css" id="WorldLandingPage_7068CDA9_749E_4EC1_9BC4_50DF06EAA2BA-Nunito">@import url("https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i&display=swap");</style>`;
  }

  get commands () {
    return [
      {
        name: 'resize on client',
        exec: () => {
          $world._cachedWindowBounds = null;
          document.body.style.overflowY = 'hidden';
          this.setBounds($world.windowBounds());
          this.getSubmorphNamed('globe').extent = this.extent;
          this.ensureUserFlap();
          const worldList = this.getSubmorphNamed('a project browser');
          if (worldList) worldList.center = this.extent.scaleBy(0.5);
        }
      }
    ];
  }

  async ensureUserFlap () {
    if ($world.get('user flap')) return;
    const flap = await resource('part://SystemIDE/user flap master/dark').read();
    flap.name = 'user flap';
    flap.showMorphControls = false;
    flap.hasFixedPosition = true;
    flap.openInWorld();
    flap.opacity = 0;
    flap.alignInWorld();
    flap.get('fast load toggler').refresh();
    await promise.delay(1000);
    flap.animate({ opacity: 1 });
  }

  beforePublish () {
    const worldList = this.getSubmorphNamed('a project browser');
    if (worldList) worldList.remove();
  }

  async onLoad () {
    await this.whenRendered();
    if (!lively.FreezerRuntime) return;
    $world.fill = Color.black;
    document.documentElement.style.background = Color.black;
    this.showWorldList().then(() => document.getElementById('loading-screen').remove());
    this.getSubmorphNamed('globe').fullyLoaded();
    const ld = document.getElementById('loading screen');
    if (ld) ld.remove();
  }

  async showWorldList () {
    const dashboard = this.getSubmorphNamed('a poject browser') || this.addMorph(await resource('part://partial freezing/project browser').read());
    dashboard.name = 'a project browser';
    this.reset();
    dashboard.showCloseButton = false;
    dashboard.extent = pt(1110, 800).minPt(this.extent.subPt(pt(50, 150)));
    dashboard.center = this.innerBounds().center();
    dashboard.animate({
      opacity: 1, duration: 300
    });
    dashboard.displayWorlds();
    dashboard.hasFixedPosition = false;
  }

  reset () {
    const dashboard = this.getSubmorphNamed('a project browser');
    dashboard.opacity = 0;
    // dashboard.scale = 1.2;
    dashboard.center = this.innerBounds().center();
  }
}

const LandingPage = component({
  type: WorldLandingPage,
  name: 'world landing page',
  clipMode: 'hidden',
  draggable: true,
  extent: pt(1003, 594.6),
  fill: Color.rgb(0, 0, 0),
  grabbable: true,
  loadingScreen: {
    type: HTMLMorph,
    name: 'loading screen',
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
    extent: pt(485.3, 274.3),
    html: '<div style="position: fixed; z-index: 1; height: 100%; width: 100%; background-color: black">\n\
  <div id="loading-bar">\n\
     <div id="progress" style="width: 100%;">\n\
  </div>\n\
</div></div>',
    position: pt(0, 25)
  },
  position: pt(65.6, 36.5),
  reactsToPointer: false,
  submorphs: [{
    type: Globe,
    name: 'globe',
    borderColor: Color.rgb(0, 0, 0),
    canvasExtent: pt(1508, 971),
    extent: pt(1508.9, 971.6),
    fill: Color.rgb(0, 0, 0),
    position: pt(-1.3, 0.1),
    reactsToPointer: false,
    submorphs: [{
      type: WebGLCanvas,
      name: 'webgl canvas',
      borderColor: Color.rgb(231, 76, 60),
      canvasExtent: pt(1508, 971),
      contextType: 'webgl',
      extent: pt(1508.9, 971.6),
      fps: 15,
      reactsToPointer: false
    }, {
      name: 'cover',
      draggable: true,
      extent: pt(1508.9, 971.6),
      fill: Color.rgb(0, 0, 0),
      grabbable: true,
      reactsToPointer: false
    }]
  }]
});

export { LandingPage };
