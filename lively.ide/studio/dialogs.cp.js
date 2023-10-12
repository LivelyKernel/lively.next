import { DarkPrompt, OKCancelButtonWrapper, ConfirmPromptModel } from 'lively.components/prompts.cp.js';
import { DarkDropDownList, DarkList } from 'lively.components/list.cp.js';
import { component, add, part } from 'lively.morphic/components/core.js';
import { pt, rect, Color } from 'lively.graphics';
import { TilingLayout, MorphicDB, ShadowObject, Text, Label } from 'lively.morphic';
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
    extent: pt(455.5, 258.5),
    fill: Color.transparent,
    layout: new TilingLayout({
      align: 'center',
      axis: 'column',
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(11, 11, 0, 0),
      spacing: 5
    }),
    submorphs: [
      {
        name: 'first row',
        extent: pt(450, 50),
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true
        }),
        submorphs: [
          {
            type: Label,
            name: 'storage label',
            fill: Color.rgba(255, 255, 255, 0),
            fontColor: Color.rgb(255, 255, 255),
            fontFamily: 'IBM Plex Sans',
            fontSize: 15,
            nativeCursor: 'pointer',
            position: pt(1.4, 3.4),
            textAndAttributes: ['store as:', null]
          },
          part(DarkDropDownList, {
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
          }),
          {
            type: Label,
            name: 'choose db button',
            fill: Color.rgba(255, 255, 255, 0),
            fontColor: Color.rgb(204, 204, 204),
            fontSize: 15,
            nativeCursor: 'pointer',
            extent: pt(234, 25),
            fixedHeight: true,
            fixedWidth: true,
            reactsToPointer: false,
            textAndAttributes: ['Change DB ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {
              backgroundColor: undefined,
              fontColor: Color.rgb(204, 204, 204),
              fontFamily: 'IBM Plex Sans',
              fontSize: 15,
              fontWeight: 'normal',
              letterSpacing: undefined,
              lineHeight: 1.4,
              nativeCursor: 'text',
              textAlign: undefined,
              textDecoration: 'none',
              textStyleClasses: undefined,
              wordSpacing: undefined
            }]

          }, part(InputLineDark, {
            name: 'file path input',
            visible: false,
            position: pt(211.2, 0.5),
            extent: pt(234, 25),
            fontSize: 15,
            highlightWhenFocused: true,
            historyId: 'lively.morphic-save-world-names',
            placeholder: './path/to/snapshot.json'
          })]
      },
      {
        name: 'second row',
        extent: pt(450, 50),
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true
        }),
        submorphs: [
          {
            type: Label,
            name: 'name label',
            fill: Color.rgba(255, 255, 255, 0),
            fontColor: Color.rgb(255, 255, 255),
            fontFamily: 'IBM Plex Sans',
            fontSize: 15,
            nativeCursor: 'pointer',
            position: pt(1, 40.1),
            textAndAttributes: ['save as: ', {}]
          }, part(InputLineDark, {
            name: 'name input',
            fontSize: 15,
            extent: pt(365, 27),
            padding: rect(4, 4, 0, 0),
            historyId: 'lively.morphic-save-world-names',
            position: pt(97, 38.4),
            submorphs: [{
              name: 'placeholder',
              extent: pt(48, 29),
              fontSize: 15,
              padding: rect(4, 4, 0, 0)
            }]
          })
        ]
      }, {
        name: 'third row',
        extent: pt(450, 50),
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true
        }),
        submorphs: [{
          type: Label,
          name: 'tag label',
          extent: pt(56, 16),
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontFamily: 'IBM Plex Sans',
          fontSize: 15,
          nativeCursor: 'pointer',
          position: pt(1, 79.8),
          textAndAttributes: ['tags:', null]
        }, part(InputLineDark, {
          name: 'tag input',
          fontSize: 15,
          placeholder: 'tag1 tag2 tag3 ...',
          extent: pt(365.5, 27),
          highlightWhenFocused: true,
          historyId: 'lively.morphic-save-world-names',
          padding: rect(4, 4, 0, 0),
          position: pt(97, 76),
          scroll: pt(0, 1),
          submorphs: [{
            name: 'placeholder',
            extent: pt(122, 29),
            fontFamily: 'IBM Plex Sans',
            fontSize: 15,
            nativeCursor: 'text',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['tag1 tag2 tag3 ...', null]
          }]
        })]
      },
      {
        name: 'fourth row',
        extent: pt(450, 115.3),
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'right',
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          padding: rect(0, 15, 0, -15)
        }),
        submorphs: [{
          type: Label,
          name: 'description label',
          extent: pt(84.5, 24.5),
          fontFamily: 'IBM Plex Sans',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontSize: 15,
          nativeCursor: 'pointer',
          position: pt(1, 116),
          textAndAttributes: ['Description:', null]
        }, {
          type: Text,
          name: 'description',
          textAndAttributes: ['', null],
          readOnly: false,
          borderRadius: 5,
          clipMode: 'auto',
          nativeCursor: 'text',
          dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
          extent: pt(365, 85.9),
          fill: Color.rgb(229, 231, 233),
          fixedHeight: true,
          fixedWidth: true,
          fontFamily: 'IBM Plex Sans',
          fontSize: 15,
          haloShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
          highlightWhenFocused: true,
          lineWrapping: 'by-words',
          padding: rect(4, 4, 0, 0),
          position: pt(97, 115)
        }]
      }
    ]
  }), add(part(OKCancelButtonWrapper))
  ]
});

export { SaveWorldDialog };
