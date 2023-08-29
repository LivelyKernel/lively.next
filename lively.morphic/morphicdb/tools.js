import { Rectangle, pt, rect, Color } from 'lively.graphics';
import { connect, noUpdate, signal } from 'lively.bindings';
import { ConstraintLayout, Icon, HorizontalLayout, VerticalLayout, Morph, part } from 'lively.morphic';
import { Checkbox } from 'lively.components';

import MorphicDB from './db.js';

function lastChoiceFromLocalStorage () {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage['lively.morphic-morphicdb/current']; } catch (e) { return null; }
}

function currentMorphicDBConsideringLocalStorage (wellKnownMorphicDBs) {
  let alias = lastChoiceFromLocalStorage();
  return (alias && wellKnownMorphicDBs[alias]) || wellKnownMorphicDBs.default;
}

export async function interactivelyChosenCurrentMorphicDB () {
  return currentMorphicDBConsideringLocalStorage(await MorphicDB.wellKnownMorphicDBs());
}

export async function interactivelyChooseMorphicDB () {
  let dbs = await MorphicDB.wellKnownMorphicDBs();
  let lastDBAlias = lastChoiceFromLocalStorage() || 'default';
  let dbList = Object.keys(dbs).map(alias => {
    let { name, serverURL, snapshotLocation } = dbs[alias];
    return { alias: alias, name, serverURL, snapshotLocation, selected: alias === lastDBAlias };
  });
  let { selectedDBs: [db] } = await MorphicDBSelectionPrompt.open(dbList, {});
  if (db) {
    if (db.alias === 'default') { delete localStorage['lively.morphic-morphicdb/current']; } else { localStorage['lively.morphic-morphicdb/current'] = db.alias; }
  } else {
    delete localStorage['lively.morphic-morphicdb/current'];
  }
  return { db, dbs };
}

export class MorphicDBPrompt extends Morph {
  static open (dbName, snapshotLocation, serverURL, opts, world = $world) {
    opts = {
      ...opts,
      serverURL,
      snapshotLocation,
      dbName
    };
    return world.openPrompt(new this(opts), opts);
  }

  build (props = {}) {
    let { serverURL, snapshotLocation, dbName, extent, historyId, alias } = props;

    this.submorphs = [
      {
        name: 'alias label',
        type: 'label',
        value: 'alias',
        fill: null,
        padding: Rectangle.inset(3),
        fontSize: 14,
        fontColor: Color.gray
      },
      {
        name: 'dbname label',
        type: 'label',
        value: 'db name',
        fill: null,
        padding: Rectangle.inset(3),
        fontSize: 14,
        fontColor: Color.gray
      },
      {
        name: 'snapshot location label',
        type: 'label',
        value: 'snapshot location',
        fill: null,
        padding: Rectangle.inset(3),
        fontSize: 14,
        fontColor: Color.gray
      },
      {
        name: 'server url label',
        type: 'label',
        value: 'server url',
        fill: null,
        padding: Rectangle.inset(3),
        fontSize: 14,
        fontColor: Color.gray
      },

      {
        name: 'alias input',
        type: 'input',
        historyId: historyId ? historyId + '-alias' : null,
        padding: Rectangle.inset(3),
        fontSize: 11
      },
      {
        name: 'dbname input',
        type: 'input',
        historyId: historyId ? historyId + '-dbname' : null,
        padding: Rectangle.inset(3),
        fontSize: 11
      },
      {
        name: 'snapshot location input',
        type: 'input',
        historyId: historyId ? historyId + '-snapshot' : null,
        padding: Rectangle.inset(3),
        fontSize: 11
      },
      {
        name: 'server url input',
        type: 'input',
        historyId: historyId ? historyId + '-server' : null,
        padding: Rectangle.inset(3),
        fontSize: 11
      },
      {
        master: { 
          auto: 'styleguide://SystemPrompts/prompts/buttons/ok/default',
          click: 'styleguide://SystemPrompts/prompts/buttons/ok/pressed'
        },
        name: 'ok button',
        type: 'button'
      },
      {
        master: { 
          auto: 'styleguide://SystemPrompts/prompts/buttons/cancel/default',
          click: 'styleguide://SystemPrompts/prompts/buttons/cancel/pressed'
        },
        name: 'cancel button',
        type: 'button'
      }
    ];

    let [
      aliasInput,
      dbnameInput,
      snapshotLocationInput,
      serverUrlInput,
      okButton,
      cancelButton
    ] = this.submorphs;

    if (alias) aliasInput.input = alias;
    if (dbName) dbnameInput.input = dbName;
    if (snapshotLocation) snapshotLocationInput.input = snapshotLocation;
    if (serverURL) serverUrlInput.input = serverURL;

    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');
    this.extent = pt(600, 128);
    this.initLayout(!!alias);
    if (extent) this.extent = extent;
  }

  resolve () {
    let aliasInput = this.get('alias input');
    let dbnameInput = this.get('dbname input');
    let snapshotLocationInput = this.get('snapshot location input');
    let serverUrlInput = this.get('server url input');
    serverUrlInput.acceptInput();
    snapshotLocationInput.acceptInput();
    dbnameInput.acceptInput();
    super.resolve({
      alias: aliasInput.input,
      dbName: dbnameInput.input,
      snapshotLocation: snapshotLocationInput.input,
      serverURL: serverUrlInput.input,
      status: 'accepted'
    });
  }

  reject () { super.resolve({ status: 'rejected' }); }

  initLayout (showAlias = false) {
    let bounds = this.innerBounds();
    let relBounds = [
      rect(0.02, 0.05, 0.15, 0.19),
      rect(0.02, 0.23, 0.22, 0.19),
      rect(0.02, 0.42, 0.16, 0.19),
      rect(0.02, 0.60, 0.16, 0.19),
      rect(0.23, 0.05, 0.76, 0.15),
      rect(0.23, 0.23, 0.76, 0.15),
      rect(0.23, 0.42, 0.76, 0.15),
      rect(0.23, 0.60, 0.76, 0.15),
      rect(0.31, 0.79, 0.18, 0.17),
      rect(0.51, 0.80, 0.18, 0.16)
    ];
    let realBounds = bounds.divide(relBounds);
    if (!showAlias) {
      relBounds.splice(3, 1);
      relBounds.splice(7, 1);
    }
    this.submorphs.map((ea, i) => ea.setBounds(realBounds[i]));
    this.layout = new ConstraintLayout({
      submorphSettings: [
        ['alias label', 'fixed'],
        ['server url label', 'fixed'],
        ['snapshot location label', 'fixed'],
        ['dbname label', 'fixed'],
        ['alias input', { x: 'resize', y: 'fixed' }],
        ['server url input', { x: 'resize', y: 'fixed' }],
        ['snapshot location input', { x: 'resize', y: 'fixed' }],
        ['dbname input', { x: 'resize', y: 'fixed' }]
      ]
    });
  }
}

export class MorphicDBSelectionPrompt extends Morph {
  static open (dbList, opts = {}, world = $world) {
    opts = {
      allowMultipleSelections: false,
      dbList,
      ...opts
    };
    return world.openPrompt(new this(opts), opts);
  }

  build (props = {}) {
    let { allowMultipleSelections, dbList, extent } = props;

    let dbListMorph = new MorphicDBList({
      itemSettings: { showSelect: true },
      allowMultipleSelections,
      dbInfos: dbList,
      draggable: false
    });
    this.submorphs = [dbListMorph];
    dbListMorph.fill = null;

    connect(dbListMorph, 'closed', this, 'reject');
    connect(dbListMorph, 'accepted', this, 'resolve');
    if (extent) this.extent = extent;
    else connect(dbListMorph, 'extent', this, 'extent');
  }

  resolve () {
    let dbListMorph = this.submorphs[0];
    super.resolve({
      dbs: dbListMorph.dbs(),
      selectedDBs: dbListMorph.selectedDBs(),
      status: 'accepted'
    });
  }

  reject () { super.resolve({ status: 'rejected', dbs: [], selectedDBs: [] }); }
}

class MorphicDBWidget extends Morph {
  static get properties () {
    return {
      extent: { defaultValue: pt(120, 90) },
      fill: { defaultValue: Color.rgb(230, 230, 230) },
      dbInfo: { defaultValue: null },
      showSelect: { defaultValue: true },
      showEdit: { defaultValue: true },
      showRemove: { defaultValue: true },
      selected: {
        after: ['submorphs'],
        derived: true,
        get () {
          let cb = this.getSubmorphNamed('selected');
          return cb && cb.checked;
        },
        set (val) {
          let cb = this.getSubmorphNamed('selected');
          if (cb) cb.checked = val;
        }
      },
      submorphs: {
        after: ['showSelect', 'showEdit', 'showRemove', 'dbInfo'],
        initialize () { this.updateView(); }
      }
    };
  }

  get isMorphicDBWidget () { return true; }

  updateView () {
    let controls = [];
    let { showEdit, showRemove, showSelect, dbInfo } = this;
    let { alias = '', serverURL = '', snapshotLocation = '', removable, editable } = dbInfo || {};
    if (!editable) showEdit = false;
    if (!removable) showRemove = false;
    if (showEdit) {
      controls.push({
        master: { 
          auto: 'styleguide://SystemPrompts/prompts/buttons/ok/default',
          click: 'styleguide://SystemPrompts/prompts/buttons/ok/pressed'
        },
        type: 'button',
        name: 'edit button',
        label: 'edit'
      }); 
    }
    if (showRemove) {
      controls.push({
        master: { 
          auto: 'styleguide://SystemPrompts/prompts/buttons/cancel/default',
          click: 'styleguide://SystemPrompts/prompts/buttons/cancel/pressed'
        },
        type: 'button',
        name: 'remove button',
        label: 'remove'
      }); 
    }

    this.submorphs = [
      { type: 'label', name: 'alias', value: ['alias: ', null, alias, { fontWeight: 'bold' }] },
      { type: 'label', name: 'snapshotLocation', value: `snapshots: ${snapshotLocation}` },
      { type: 'label', name: 'serverURL', value: `backend: ${serverURL}` },
      ...!controls.length
        ? []
        : [{
            name: 'controls',
            layout: new HorizontalLayout({ spacing: 2 }),
            fill: null,
            submorphs: controls
          }]
    ];

    if (showEdit) {
      let editBtn = this.getSubmorphNamed('edit button');
      connect(editBtn, 'fire', this, 'triggerDBEdit');
    }
    if (showRemove) {
      let removeBtn = this.getSubmorphNamed('remove button');
      connect(removeBtn, 'fire', this, 'triggerDBRemove');
    }

    if (showSelect) {
      let cb = part(Checkbox, {
        name: 'selected',
        viewModel: { checked: false },
        isLayoutable: false,
        leftCenter: pt(5, this.height / 2 - (showRemove || showEdit ? 10 : 20))
      });
      connect(cb, 'checked', this, 'onDBSelectionChange');
    }
  }

  onDBSelectionChange (selected) { signal(this, 'selected', this, selected); }
  triggerDBEdit () { signal(this, 'edit', this); }
  triggerDBRemove () { signal(this, 'remove', this); }
}

export class MorphicDBList extends Morph {
  static get properties () {
    return {
      dbInfos: {
        after: ['itemSettings', 'showAddButton'],
        set (val) { this.setProperty('dbInfos', val); this.updateView(); }
      },
      allowMultipleSelections: { defaultValue: false },
      showCloseButton: { defaultValue: true },
      showOKButton: { defaultValue: true },
      showAddButton: { defaultValue: true },
      itemSettings: {},
      name: { defaultValue: 'db list' },
      extent: { defaultValue: pt(400, 300) }
    };
  }

  updateView () {
    let {
      layout, itemSettings, dbInfos, showAddButton, showCloseButton, showOKButton
    } = this;
    if (!layout) { layout = this.layout = new VerticalLayout({ align: 'center', spacing: 4 }); }
    this.submorphs = dbInfos.map(info => new MorphicDBWidget({ ...itemSettings, selected: info.selected, dbInfo: info }));
    this.submorphs.forEach(ea => connect(ea, 'selected', this, 'onDBSelected'));

    if (showAddButton || showOKButton) {
      let addBtn = showAddButton && this.addMorph({ type: 'button', label: Icon.makeLabel('plus') });
      let okBtn = showOKButton && this.addMorph({ type: 'button', label: Icon.makeLabel('check') });
      this.addMorph({
        name: 'buttons',
        fill: null,
        layout: new HorizontalLayout({ spacing: 5 }),
        submorphs: [okBtn, addBtn].filter(Boolean)
      });
      addBtn && connect(addBtn, 'fire', this, 'interactivelyAddDB');
      okBtn && connect(okBtn, 'fire', this, 'accept');
    }

    if (showCloseButton) {
      let closeBtn = this.addMorph({
        name: 'close button',
        type: 'button',
        label: Object.assign(Icon.makeLabel('times-circle'), { fontSize: 18 }),
        tooltip: 'close',
        fill: null,
        extent: pt(16, 16),
        borderColor: Color.transparent,
        isLayoutable: false
      });
      connect(this, 'extent', closeBtn, 'center', { converter: ext => ext.withY(0).addXY(-3, 3) });
      closeBtn.center = this.innerBounds().topRight();
      connect(closeBtn, 'fire', this, 'close');
    }
    
    this.whenRendered(50).then(() => layout.apply());
  }

  close () {
    signal(this, 'closed', this);
    this.remove();
  }

  accept () {
    signal(this, 'accepted', this);
    this.remove();
  }

  dbs () {
    return this.submorphs
      .map(m => m.isMorphicDBWidget && m.dbInfo)
      .filter(Boolean);
  }

  selectedDBs () {
    return this.submorphs
      .map(m => m.isMorphicDBWidget && m.selected && m.dbInfo)
      .filter(Boolean);
  }

  onDBSelected (dbMorph, selected) {
    selected && !this.allowMultipleSelections && noUpdate(() => {
      for (let m of this.submorphs) { m.isMorphicDBWidget && m !== dbMorph && (m.selected = false); }
    });
    signal(this, 'dbSelected', dbMorph);
  }

  interactivelyAddDB () {}
}
