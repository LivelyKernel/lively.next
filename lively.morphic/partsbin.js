// This is a prototype implementation of a file-system based partsbin...
/* global System */
import { resource, Resource, registerExtension } from 'lively.resources';
import { Path, obj, date, promise } from 'lively.lang';
import { HorizontalLayout, VerticalLayout } from './layout.js';

import { Morph } from './morph.js';
import { pt, Color, Rectangle } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { emit } from 'lively.notifications';
import { SnapshotPackageHelper, ensureCommitInfo, default as MorphicDB } from './morphicdb/db.js';
import { createMorphSnapshot } from './serialization.js';
import { getClassName } from 'lively.serializer2';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// deprecated

export function getAllPartResources (options) { return []; }

export async function loadPart (nameOrCommit, options = {}) {
  // let {morphicDB} = PartsBinInterface.default;
  const morphicDB = options.morphicDB || MorphicDB.default;
  const part = await morphicDB.load(
    'part',
    typeof nameOrCommit === 'string' ? nameOrCommit : nameOrCommit.name,
    options,
    typeof nameOrCommit === 'string' ? undefined : nameOrCommit);

  // when window is automatically published we need to make sure that metadata
  // is re-attached to actual part
  if (part.isWindow && part.targetMorph/* && part.targetMorph.name === name */) {
    const target = part.targetMorph;
    const commit = await ensureCommitInfo(part.metadata && part.metadata.commit);

    if (commit) {
      target.changeMetaData('commit', commit, /* serialize = */true, /* merge = */false);
    }
  }

  return part;
}

// function save(nameOrCommitSpec, part, options) {
//
// }

export async function savePart (part, name, options, commitSpec, ref, expectedParentCommit) {
  try {
    if (part.isMorph) {
      const morphsToPrepare = [];
      part.withAllSubmorphsDo(ea => {
        if (typeof ea.beforePublish === 'function') { morphsToPrepare.push(ea); }
      });
      for (const m of morphsToPrepare) {
        await m.beforePublish();
      }
    } else {
      if (typeof part.beforePublish === 'function') { await part.beforePublish(name, part); }
    }
  } catch (e) {
    const msg = `Error in beforePublish of ${part}\n${e.stack}`;
    if (typeof part.world === 'function' && part.world()) part.world().logError(new Error(msg));
    else console.error(msg);
  }

  const snapshotOptions = {
    previewWidth: 100,
    previewHeight: 100,
    previewType: 'png',
    ...options
  };
  const morphicDB = options.morphicDB || MorphicDB.default;
  const commit = await morphicDB.snapshotAndCommit(
    'part', name, part, snapshotOptions,
    commitSpec, ref, expectedParentCommit);

  emit('lively.partsbin/partpublished', commit);

  return commit;
}

export async function interactivelySavePart (part, options = {}) {
  const {
    showPublishDialog = true,
    notifications = true,
    loadingIndicator = true,
    preferWindow = true
  } = options;

  let switchedToWindow; let windowMetadata;
  const actualPart = part;
  const world = part.world() || part.env.world;

  let name = part.name; let tags = []; let description = '';
  let oldCommit = await ensureCommitInfo(Path('metadata.commit').get(part) || Path('metadata.commit').get(actualPart));
  let morphicDB = options.morphicDB || MorphicDB.default;

  if (!oldCommit) {
    oldCommit = {
      type: 'part',
      name: part.name,
      author: world.getCurrentUser(),
      tags: [],
      description: 'no description'
    };
  }

  if (showPublishDialog) {
    const { db, commit } = await world.openPrompt(await loadPart('publish part dialog'), { part });
    if (!commit) return null;
    if (db) options.morphicDB = morphicDB = db;
    ({ name, tags, description } = commit);
  } else if (oldCommit) {
    ({ name, tags, description } = oldCommit);
  }

  let i;
  if (loadingIndicator) {
    i = $world.execCommand('open loading indicator', `saving ${name}...`);
    await promise.delay(80);
  }

  try {
    const ref = 'HEAD';
    const oldName = oldCommit ? oldCommit.name : part.name;
    let expectedParentCommit;

    if (oldName !== name) {
      const { exists, commitId: existingCommitId } = await morphicDB.exists('part', name);
      if (exists) {
        const overwrite = await world.confirm(`A part "${name}" already exists, overwrite?`);
        if (!overwrite) return null;
        expectedParentCommit = existingCommitId;
      }
      actualPart.name = name;
    } else {
      expectedParentCommit = oldCommit ? oldCommit._id : undefined;
    }

    if (preferWindow && !part.isWindow) {
      let win = part.getWindow();
      if (win && win.targetMorph === part) {
        part = win;
        windowMetadata = win.metadata;
        switchedToWindow = true;
      }
    }

    const commitSpec = {
      author: part.world().getCurrentUser(),
      message: 'published',
      tags,
      description
    };
    const commit = await savePart(part, name, options, commitSpec, ref, expectedParentCommit);

    if (switchedToWindow) {
      if (actualPart.metadata) actualPart.metadata.commit = await ensureCommitInfo(win.metadata.commit);
      else actualPart.metadata = { commit: await ensureCommitInfo(win.metadata.commit) };
      win.metadata = windowMetadata;
    }

    notifications && part.setStatusMessage(`saved part ${name}`);
    // part.get("world-list") && part.get("world-list").onWorldSaved(name);

    return commit;
  } catch (err) {
    /* eslint-disable no-unused-vars */
    const [_, typeAndName1, expectedVersion1, actualVersion1] = err.message.match(/Trying to store "([^\"]+)" on top of expected version ([^\s]+) but ref HEAD is of version ([^\s\!]+)/) || [];
    /* eslint-enable no-unused-vars */

    if (expectedVersion1 && actualVersion1) {
      const [newerCommit] = await morphicDB.log(actualVersion1, 1, /* includeCommits = */true);
      const { author: { name: authorName }, timestamp } = newerCommit;
      const overwriteQ = `The current version of part "${name}" is not the most recent!\n` +
                     `A newer version by ${authorName} was saved on ` +
                     `${date.format(new Date(timestamp), 'yyyy-mm-dd HH:MM')}. Overwrite?`;
      const overwrite = await world.confirm(['Version Mismatch\n', {}, overwriteQ, { fontWeight: 'normal', fontSize: 16 }]);
      if (!overwrite) return null;
      const commitMetaData = obj.dissoc(newerCommit, ['preview']);
      actualPart.changeMetaData('commit', commitMetaData, /* serialize = */true, /* merge = */false);
      return interactivelySavePart(actualPart, { ...options, morphicDB, showPublishDialog: false });
    }
    /* eslint-disable no-unused-vars */
    const [__, typeAndName2, expectedVersion2] = err.message.match(/Trying to store "([^\"]+)" on top of expected version ([^\s]+) but no version entry exists/) || [];
    /* eslint-enable no-unused-vars */
    if (expectedVersion2) {
      const overwriteQ = `Part ${name} no longer exist in the object database.\n` +
                     'Do you still want to publish it?';
      const overwrite = await world.confirm(overwriteQ);
      if (!overwrite) return null;
      actualPart.changeMetaData('commit', null, /* serialize = */true, /* merge = */false);
      return interactivelySavePart(actualPart, { ...options, morphicDB, showPublishDialog: false });
    }

    console.error(err);
    notifications && world.logError('Error saving part: ' + err);
    throw err;
  } finally { i && i.remove(); }
}

export async function interactivelyLoadObjectFromPartsBinFolder (options = {}) {
  const morphicDB = options.morphicDB || MorphicDB.default;
  const partSpecs = await morphicDB.latestCommits('part');
  const items = partSpecs.map(ea => ({ isListItem: true, string: ea.name, value: ea }));
  const { selected: [choice] } = await $world.filterableListPrompt(
    'Select part to load', items, { fuzzy: true });
  return choice ? loadPart(choice) : null;
}

export async function interactivelySaveObjectToPartsBinFolder (obj) {
  const partName = await $world.prompt('Enter part name to publish object under', {
    input: obj.name || 'part-name',
    historyId: 'lively.partsbin-partname-publish-to-folder-input-hist'
  });
  if (!partName) throw 'canceled';
  return saveObjectToPartsbinFolder(obj, partName, { previewWidth: obj.width, previewHeight: obj.height });
}

export async function saveObjectToPartsbinFolder (obj, partName, options = {}) {
  options = {
    preferWindow: true,
    ...options
  };

  if (options.preferWindow) {
    const win = obj.getWindow();
    obj = win && win.targetMorph === obj ? win : obj;
  }
  try {
    if (obj.isMorph) {
      const morphsToPrepare = [];
      obj.withAllSubmorphsDo(ea => {
        if (typeof ea.beforePublish === 'function') { morphsToPrepare.push(ea); }
      });
      for (const m of morphsToPrepare) {
        await m.beforePublish();
      }
    } else {
      if (typeof obj.beforePublish === 'function') { await obj.beforePublish(partName, obj); }
    }
  } catch (e) {
    const msg = `Error in beforePublish of ${obj}\n${e.stack}`;
    if (typeof obj.world === 'function' && obj.world()) obj.world().logError(new Error(msg));
    else console.error(msg);
  }
  await resource(options.partsbinFolder).ensureExistance();
  const partResource = resource(options.partsbinFolder).join(partName + '.json');
  const snapshot = await createMorphSnapshot(obj, options);
  await partResource.write(JSON.stringify(snapshot, null, 2));
  return { partName, url: partResource.url };
}

export async function loadObjectFromPartsbinFolder (partName, options = {}) {
  return loadPart(partName, options);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// editing

export class SnapshotEditor {
  constructor (commit, snapshot, db) {
    this.commit = commit;
    this.snapshot = snapshot;
    this._db = db;
  }

  get db () { return this._db || MorphicDB.default; }

  async saveModifiedSnapshot (newCommit, newSnapshot) {
    const { _id, name, type } = newCommit;
    if (!_id) throw new Error('No id of commit, cannot save!');
    newCommit = await this.db.commit(type, name, newSnapshot, newCommit, undefined, _id);
    this.commit = newCommit;
    this.snapshot = newSnapshot;
    return newCommit;
  }

  async interactivelySaveModifiedSnapshot (newCommit, newSnapshot) {
    const { promise: prom, resolve, reject } = promise.deferred(); const editor = this;
    Object.assign(buildCommitEditor(), {
      commit: { ...this.commit, ...newCommit },
      cancel () { (this.getWindow() || this).remove(); reject('canceled'); },
      async accept () {
        try {
          const newCommit = await editor.saveModifiedSnapshot(this.commit, newSnapshot);
          (this.getWindow() || this).remove();
          resolve(this.commit = newCommit);
        } catch (err) { this.showError(err); reject(err); }
      }
    }).openInWindow({ title: 'commit' });
    return prom;
  }

  async interactivelyEditMetadata (onSave) {
    const newCommit = await this.interactivelySaveModifiedSnapshot(this.commit, this.snapshot);
    typeof onSave === 'function' && onSave({ commit: newCommit, snapshot: this.snapshot });
    return newCommit;
  }

  async interactivelyEditSnapshotJSON (onSave) {
    let { commit, snapshot } = this;
    const { _id, name, type } = commit; let origContent;
    const { default: TextEditor } = await System.import('lively.ide/text-editor.js');

    TextEditor.openURL(`<${type}/${name}>`, {

      historyId: 'object-serialization-debugger-editor',

      // fn that gets text editor and returns {saved: BOOLEAN, message: STRING}
      customSaveAction: async ed => {
        const snap = snapshot || await this.db.fetchSnapshot(undefined, undefined, _id);
        const oldContent = JSON.stringify(snap, null, 2);
        if (oldContent !== origContent) {
          const really = await $world.confirm(['The content you are editing was changed in the mean time.\nDo you want to save anyway and overwrite those changes?', { fontWeight: 'normal' }]);
          if (!really) return { saved: false, message: 'canceled' };
        }

        const newSnapshot = JSON.parse(ed.ui.contentText.textString);
        commit = await this.interactivelySaveModifiedSnapshot(this.commit, newSnapshot);
        snapshot = newSnapshot;
        origContent = ed.ui.contentText.textString;
        const result = { saved: true, snapshot: newSnapshot, commit };
        if (typeof onSave === 'function') onSave(result);
        return result;
      },

      customLoadContentAction: async (ed, url) => {
        const snap = snapshot || await this.db.fetchSnapshot(undefined, undefined, _id);
        return { content: origContent = JSON.stringify(snap, null, 2), url: `${type}/${name}.json` };
      }
    });
  }

  async interactivelyEditPackageCode (onSaveFn) {
    const { commit, snapshot } = this;
    const { _id } = commit;
    const snap = snapshot || await this.db.fetchSnapshot(undefined, undefined, _id);
    const files = new SnapshotPackageHelper(snap).filesInPackages();
    const items = files.map(ea => ({ isListItem: true, string: ea.url, value: ea }));
    const { selected: [file] } = await $world.filterableListPrompt('Select file to edit',
      items, { historyId: 'object-serialization-debugger-hist' });

    if (!file) return;

    return this.interactivelyEditFileInSnapshotPackage(file, onSaveFn);
  }

  async interactivelyEditFileInSnapshotPackage (file, onSaveFn, textPos) {
    const { snapshot, commit: { _id, name, type } } = this;
    const snap = snapshot || await this.db.fetchSnapshot(undefined, undefined, _id);
    const origContent = file.get(snap);
    const { default: TextEditor } = await System.import('lively.ide/text-editor.js');

    const ed = TextEditor.openURL(`<${type}/${name} - ${file.path.slice(1).join('/')}>`, {

      historyId: 'interactivelyEditFileInSnapshotPackage-hist',

      // fn that gets text editor and returns {saved: BOOLEAN, message: STRING}
      customSaveAction: async ed => {
        const oldContent = file.get(snap);
        if (oldContent !== origContent) {
          const really = await $world.confirm(['The content you are editing was changed in the mean time.\nDo you want to save anyway and overwrite those changes?', { fontWeight: 'normal' }]);
          if (!really) return { saved: false, message: 'canceled' };
        }
        file.set(snap, ed.ui.contentText.textString);
        this.commit = await this.interactivelySaveModifiedSnapshot(this.commit, snap);
        const result = { commit: this.commit, snapshot: snap, saved: true };
        typeof onSaveFn === 'function' && onSaveFn(result);
        return result;
      },

      customLoadContentAction: (ed, url) => {
        return { content: file.get(snap), url: file.url };
      }

    });

    if (textPos) ed.whenRendered().then(() => ed.lineNumber = textPos.row);

    return ed;
  }
}

const partURLRe = /^part:\/\/([^\/]+)\/(.*)$/;

export class PartResource extends Resource {
  get canDealWithJSON () { return false; }
  // just is a small decoration on top of the styleguide resource
  // essentially fetch the master component and create an instance based off of it
  async dirList (depth, opts) {
    return await resource(this.url.replace('part://', 'styleguide://')).dirList(depth, opts);
  }

  async write (source) {
    throw Error('Part urls are ready only! Please go to the world they are defined in and change the exported component directly.');
  }

  async read () {
    const masterComponent = await resource(this.url.replace('part://', 'styleguide://')).read();
    if (masterComponent.master) { await masterComponent.master.whenReady(); } // ensure this master is ready
    const part = masterComponent.copy();
    part.isComponent = false;
    part.name = 'a' + getClassName(part);
    part.withAllSubmorphsDoExcluding(m => {
      if (m === part || !m.master) { delete m._parametrizedProps; }
    }, m => m.master && m !== part);
    const superMaster = part.master;
    part.master = masterComponent;
    if (part._pool.mastersInSubHierarchy) {
      // fixme: apply these in hierarchical order
      for (const subMaster of part._pool.mastersInSubHierarchy) {
        if (superMaster === subMaster) continue;
        await subMaster.applyIfNeeded(true);
        if (!subMaster.derivedMorph.ownerChain().includes(part)) {
          subMaster.derivedMorph.requestMasterStyling();
        }
      }
    }
    part.master.applyIfNeeded(true);
    delete part._pool;
    part.withAllSubmorphsDo(m => {
      // execute onLoad since that has not happened on the initial copy (component copy)
      if (typeof m.onLoad === 'function') m.onLoad();
    });
    return part;
  }
}

// part extension
export const resourceExtension = {
  name: 'part',
  matches: (url) => url.match(partURLRe),
  resourceClass: PartResource
};

registerExtension(resourceExtension);

class CommitEditor extends Morph {
  static get properties () {
    return {
      name: { defaultValue: 'commit editor' },
      extent: { defaultValue: pt(420, 24) },
      layout: {
        initialize () {
          this.layout = new VerticalLayout({ resizeSubmorphs: true, spacing: 3 });
        }
      },
      commit: {
        set  (commit) {
          this._commit = commit;
          const { name, type, timestamp, author, tags, description, metadata } = commit;
          const {
            nameInput,
            typeInput,
            timestampInput,
            authorNameInput,
            authorEmailInput,
            authorRealmInput,
            tagsInput,
            descriptionInput,
            messageInput,
            metadataInput
          } = this.ui;
          nameInput.input = name;
          typeInput.input = type;
          timestampInput.input = String(new Date(timestamp));
          authorNameInput.input = author.name;
          authorEmailInput.input = author.email;
          authorRealmInput.input = author.realm;
          tagsInput.input = tags.join(' ');
          descriptionInput.textString = description;
          messageInput.textString = '';
          metadataInput.textString = metadata ? JSON.stringify(metadata, null, 2) : '';
        },

        get () {
          const commit = this._commit;
          if (!commit) throw new Error('commit editor does not have a _commit object');
          const {
            nameInput,
            typeInput,
            authorNameInput,
            authorEmailInput,
            authorRealmInput,
            tagsInput,
            descriptionInput,
            messageInput,
            metadataInput
          } = this.ui;
          const name = nameInput.input; const type = typeInput.input;
          if (commit.name !== name) throw new Error(`name does not match _commit.name: ${name} vs ${commit.name}`);
          if (commit.type !== type) throw new Error(`type does not match _commit.type: ${type} vs ${commit.type}`);
          commit.author.name = authorNameInput.input;
          commit.author.email = authorEmailInput.input;
          commit.author.realm = authorRealmInput.input;
          commit.tags = tagsInput.input.split(' ').map(ea => ea.trim()).filter(Boolean);
          commit.description = descriptionInput.textString;
          commit.message = messageInput.textString;
          commit.metadata = metadataInput.textString ? JSON.parse(metadataInput.textString) : null;
          return commit;
        }
      },
      ui: {
        get () {
          return {
            metadataInput: this.get('metadata input'),
            messageInput: this.get('message input'),
            descriptionInput: this.get('description input'),
            tagsInput: this.get('tags input'),
            authorRealmInput: this.get('author.realm input'),
            authorEmailInput: this.get('author.email input'),
            authorNameInput: this.get('author.name input'),
            timestampInput: this.get('timestamp input'),
            typeInput: this.get('type input'),
            nameInput: this.get('name input'),
            cancelButton: this.get('cancel button'),
            okButton: this.get('ok button')
          };
        }
      },
      submorphs: {
        initialize () {
          const inputStyle = {
            type: 'input',
            extent: pt(420, 24),
            fixedWidth: true,
            fixedHeight: true,
            padding: Rectangle.inset(4, 4),
            border: { color: Color.gray, width: 1 }
          };
          this.submorphs = [
            { ...inputStyle, name: 'name input', placeholder: 'name' },
            { ...inputStyle, name: 'type input', placeholder: 'type' },
            { ...inputStyle, name: 'timestamp input', placeholder: 'timestamp' },
            {
              layout: new VerticalLayout({ resizeSubmorphs: true, spacing: 3 }),
              submorphs: [
                { ...inputStyle, name: 'author.name input', placeholder: 'author name' },
                { ...inputStyle, name: 'author.email input', placeholder: 'author email' },
                { ...inputStyle, name: 'author.realm input', placeholder: 'author realm' }
              ]
            },
            { ...inputStyle, name: 'tags input', placeholder: 'tags' },
            { ...inputStyle, height: 70, name: 'description input', type: 'text' },
            { ...inputStyle, height: 70, name: 'message input', type: 'text' },
            { ...inputStyle, height: 70, name: 'metadata input', type: 'text' },
            {
              layout: new HorizontalLayout({ spacing: 3, direction: 'centered' }),
              submorphs: [
                { type: 'button', name: 'ok button', label: 'OK' },
                { type: 'button', name: 'cancel button', label: 'Cancel' }
              ]
            }
          ];
        }
      }
    };
  }

  onLoad () {
    connect(this.ui.okButton, 'fire', this, 'accept');
    connect(this.ui.cancelButton, 'fire', this, 'cancel');
  }

  accept () {}
  cancel () {}
}

export function buildCommitEditor (props) {
  return new CommitEditor(props);
}
