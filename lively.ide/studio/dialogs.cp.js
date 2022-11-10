import { DarkPrompt, ConfirmPromptModel, RedButton, GreenButton } from 'lively.components/prompts.cp.js';
import { DarkDropDownList, DarkList } from 'lively.components/list.cp.js';
import { component, add, part } from 'lively.morphic/components/core.js';
import { pt, rect, Color } from 'lively.graphics';
import { ConstraintLayout, TilingLayout, MorphicDB, ShadowObject, Text, Label } from 'lively.morphic';
import { InputLineDark } from 'lively.components/inputs.cp.js';

import { interactivelyChooseMorphicDB, interactivelyChosenCurrentMorphicDB } from 'lively.morphic/morphicdb/tools.js';
import { ensureCommitInfo } from 'lively.morphic/morphicdb/db.js';
import { Path } from 'lively.lang';
import { resource } from 'lively.resources';

// await part(SaveWorldDialog, { viewModel: { description: 'hello world', worldName: 'default'}}).openInWorld().activate()

class SaveWorldDialogModel extends ConfirmPromptModel {
  static get properties () {
    return {

      morphicDBName: {},
      serverURL: {},
      snapshotLocation: {},
      worldName: {
        defaultValue: ''
      },
      tags: {
        defaultValue: ''
      },
      description: {
        defaultValue: ''
      },

      filePath: {
        derived: true,
        get () {
          return this.ui.filePathInput.input;
        }
      }

    };
  }

  get bindings () {
    return [
      ...super.bindings, {
        model: 'storage type selector',
        signal: 'selection',
        handler: 'refresh'
      }];
  }

  alignInWorld (world = this.world()) {
    world.addMorph(this);
    let { width, height } = world.visibleBounds();
    this.width = (width * 1 / 2) - 5;
    this.height = (height * 1 / 2) - 10;
    this.center = world.visibleBounds().center();
    return this;
  }

  viewDidLoad () {
    this.ui.nameInput.input = this.worldName;
    this.ui.tagInput.input = this.tags;
    this.ui.description.textString = this.description;
  }

  refresh () {
    this.setStorageMode(this.ui.storageTypeSelector.selection);
  }

  setStorageMode (mode) {
    if (mode === 'json') {
      this.ui.filePathInput.visible = true;
      this.ui.chooseDbButton.visible = false;
    }
    if (mode === 'db') {
      this.ui.filePathInput.visible = false;
      this.ui.chooseDbButton.visible = true;
    }
  }

  async activate (opts) {
    let { ui: { nameInput } } = this;

    // nameInput.showHistItem("prev"); // FIXME, last saved world name

    let storageMode = 'db';

    if (opts && opts.targetWorld) {
      nameInput.input = opts.targetWorld.name;
      let { tags, description } = await ensureCommitInfo(Path('metadata.commit').get(opts.targetWorld)) || {};
      let jsonPath = Path('metadata.file').get(opts.targetWorld) || resource(document.location).query().file;
      if (jsonPath) storageMode = 'json';
      this.ui.filePathInput.input = jsonPath;
      this.ui.tagInput.value = (tags || []).join(' ');
      this.ui.description.textString = description || '';
    }

    let { name: morphicDBName, serverURL, snapshotLocation } = await interactivelyChosenCurrentMorphicDB();
    this.morphicDBName = morphicDBName;
    this.serverURL = serverURL;
    this.snapshotLocation = snapshotLocation;

    this.ui.storageTypeSelector.selection = storageMode;

    return super.activate();
  }

  reject () {
    super.reject({ name: null });
  }

  resolve () {
    let name = this.ui.nameInput.input;
    if (!name) return this.reject();
    // this.view.remove(); // hard remove to not have save dialog in serialization
    this.ui.nameInput.acceptInput();
    let tags = this.ui.tagInput.input.split(' ').map(ea => ea.trim()).filter(Boolean);
    let description = this.ui.description.textString || 'no description yet';
    let db = this.morphicDB;
    let filePath = this.filePath;
    let mode = this.ui.storageTypeSelector.selection;
    return this.answer.resolve({ db, mode, filePath, commit: { name, tags, description } });
  }

  focus () {
    this.ui.nameInput.focus();
  }

  get morphicDB () {
    let { morphicDBName, serverURL } = this;
    if (!morphicDBName) return MorphicDB.default;
    if (!serverURL) serverURL = MorphicDB.default.serverURL;
    return MorphicDB.named(morphicDBName, { serverURL });
  }

  async changeDB () {
    let { db } = await interactivelyChooseMorphicDB();
    if (!db) return;
    let { name: morphicDBName, serverURL, snapshotLocation } = db;
    this.morphicDBName = morphicDBName;
    this.serverURL = serverURL;
    this.snapshotLocation = snapshotLocation;
  }
}

const SaveWorldDialog = component(DarkPrompt, {
  defaultViewModel: SaveWorldDialogModel,
  name: 'save world dialog',
  extent: pt(470, 320),
  submorphs: [{
    name: 'prompt title',
    textString: 'Save world'
  },
  add({
    name: 'prompt controls',
    clipMode: 'hidden',
    extent: pt(450, 210),
    fill: Color.transparent,
    layout: new ConstraintLayout({
      lastExtent: {
        x: 450,
        y: 210
      },
      reactToSubmorphAnimations: false,
      submorphSettings: [
        ['storage type', {
          x: 'fixed',
          y: 'fixed'
        }], ['storage type selector', {
          x: 'fixed',
          y: 'fixed'
        }], ['file path input', {
          x: 'fixed',
          y: 'fixed'
        }], ['name input', {
          x: 'resize',
          y: 'fixed'
        }], ['tag input', {
          x: 'resize',
          y: 'fixed'
        }], ['description', {
          x: 'resize',
          y: 'fixed'
        }], ['name label', {
          x: 'fixed',
          y: 'fixed'
        }], ['name label copy', {
          x: 'fixed',
          y: 'fixed'
        }], ['destination chooser label', {
          x: 'fixed',
          y: 'fixed'
        }], ['choose db button', {
          x: 'move',
          y: 'fixed'
        }]]
    }),
    submorphs: [{
      type: Label,
      name: 'name label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(255, 255, 255),
      fontFamily: 'IBM Plex Sans',
      fontSize: 15,
      nativeCursor: 'pointer',
      position: pt(1, 40.1),
      textAndAttributes: ['save as: ', {}]
    }, {
      type: Label,
      name: 'destination chooser label',
      fontFamily: 'IBM Plex Sans',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(255, 255, 255),
      fontSize: 15,
      nativeCursor: 'pointer',
      position: pt(1, 116),
      textAndAttributes: ['description:', null]
    }, part(InputLineDark, {
      name: 'name input',
      fontSize: 15,
      extent: pt(336.5, 24.6),
      padding: rect(4, 4, 0, 0),
      historyId: 'lively.morphic-save-world-names',
      position: pt(97, 38.4),
      submorphs: [{
        name: 'placeholder',
        extent: pt(48, 24.6),
        fontSize: 15,
        padding: rect(4, 4, 0, 0)
      }]
    }), {
      type: Text,
      name: 'description',
      readOnly: false,
      borderRadius: 5,
      clipMode: 'auto',
      nativeCursor: 'text',
      dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
      extent: pt(336.5, 89.9),
      fill: Color.rgb(229, 231, 233),
      fixedHeight: true,
      fixedWidth: true,
      fontFamily: 'IBM Plex Sans',
      fontSize: 15,
      haloShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
      highlightWhenFocused: true,
      lineWrapping: true,
      padding: rect(4, 4, 0, 0),
      position: pt(97, 115)
    }, part(InputLineDark, {
      name: 'tag input',
      fontSize: 15,
      placeholder: 'tag1 tag2 tag3 ...',
      extent: pt(336.5, 24.5),
      highlightWhenFocused: true,
      historyId: 'lively.morphic-save-world-names',
      padding: rect(4, 4, 0, 0),
      position: pt(97, 76),
      scroll: pt(0, 1)
    }), {
      type: Label,
      name: 'name label copy',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(255, 255, 255),
      fontFamily: 'IBM Plex Sans',
      fontSize: 15,
      nativeCursor: 'pointer',
      position: pt(1, 79.8),
      textAndAttributes: ['tags:', null]
    }, {
      type: Label,
      name: 'choose db button',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(204, 204, 204),
      fontSize: 15,
      fontStyle: 'bold',
      nativeCursor: 'pointer',
      padding: rect(0, 3, 0, -1),
      position: pt(250, 0),
      reactsToPointer: false,
      textAndAttributes: ['Change DB  ', {
        fontFamily: 'IBM Plex Sans'
      }, '', {
        fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
        paddingTop: '2px',
        textStyleClasses: ['fa']
      }]
    },
    {
      type: Label,
      name: 'storage type',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(255, 255, 255),
      fontFamily: 'IBM Plex Sans',
      fontSize: 15,
      nativeCursor: 'pointer',
      position: pt(1.4, 3.4),
      textAndAttributes: ['store as:', null]
    }, part(DarkDropDownList, {
      name: 'storage type selector',
      layout: new TilingLayout({
        axisAlign: 'center',
        orderByIndex: true,
        padding: rect(5, 0, -5, 0),
        wrapSubmorphs: false
      }),
      extent: pt(105.1, 23),
      position: pt(96, 3),
      viewModel: {
        listMaster: DarkList,
        openListInWorld: true,
        listAlign: 'selection',
        selection: 'Morphic DB',
        items: [{ string: 'JSON', value: 'json', isListItem: true }, { string: 'Morphic DB', value: 'db', isListItem: true }]
      }
    }), part(InputLineDark, {
      name: 'file path input',
      position: pt(211.2, 0.5),
      extent: pt(210, 25),
      fontSize: 15,
      highlightWhenFocused: true,
      historyId: 'lively.morphic-save-world-names',
      placeholder: './path/to/snapshot.json',
      visible: false
    })
    ]
  }), add({
    name: 'button wrapper',
    extent: pt(470.3, 61.1),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      axis: 'row',
      align: 'center',
      axisAlign: 'center',
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 12,
        y: 12
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      spacing: 12
    }),
    position: pt(-0.5, 251),
    submorphs: [part(GreenButton, {
      name: 'ok button',
      extent: pt(90, 38),
      label: 'OK'
    }), part(RedButton, {
      name: 'cancel button',
      extent: pt(94, 38),
      label: 'CANCEL'
    })]
  })]
});

export { SaveWorldDialog };
