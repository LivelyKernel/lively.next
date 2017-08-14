// This is a prototype implementation of a file-system based partsbin...
/* global System */
import { resource } from "lively.resources";
import { createMorphSnapshot } from "lively.morphic/serialization.js";
import { MorphicDB } from "./morphicdb/index.js";
import { Path, date, promise, string } from "lively.lang";
import { morph, HorizontalLayout, VerticalLayout } from "lively.morphic";
import { pt, Color, Rectangle } from "lively.graphics";
import { connect } from "lively.bindings";
import LoadingIndicator from "./components/loading-indicator.js";
import { pathForBrowserHistory } from "./world-loading.js";
import { emit } from "lively.notifications/index.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// deprecated

export function getAllPartResources(options) { return []; }


export async function loadPart(nameOrCommit, options = {}) {
  // let {morphicDB} = PartsBinInterface.default;
  let name;
  if (typeof nameOrCommit === "string") name = nameOrCommit;
  else name = nameOrCommit.name;
  let morphicDB = options.morphicDB || MorphicDB.default;
  let part = await morphicDB.load("part", name);

  // when window is automatically published we need to make sure that metadata
  // is re-attached to actual part
  if (part.isWindow && part.targetMorph && part.targetMorph.name === name) {
    let target = part.targetMorph;
    let commit = part.metadata && part.metadata.commit;
    if (commit) {
      target.changeMetaData("commit", commit, /*serialize = */false, /*merge = */false);
    }
  }

  return part;
}

// function save(nameOrCommitSpec, part, options) {
//
// }

export async function savePart(part, name, options, commitSpec, ref, expectedParentCommit) {

  try {
    if (part.isMorph) {
      let morphsToPrepare = [];
      part.withAllSubmorphsDo(ea => {
        if (typeof ea.beforePublish === "function")
          morphsToPrepare.push(ea);
      });
      for (var m of morphsToPrepare) {
        await m.beforePublish();
      }
    } else {
      if (typeof part.beforePublish === "function")
        await part.beforePublish(name, part);
    }

  } catch (e) {
    let msg = `Error in beforePublish of ${part}\n${e.stack}`;
    if (typeof part.world === "function" && part.world()) part.world().logError(new Error(msg));
    else console.error(msg);
  }

  let snapshotOptions = {
        previewWidth: 100,
        previewHeight: 100,
        previewType: "png",
        ...options
      },
      db = MorphicDB.default,
      commit = await db.snapshotAndCommit(
          "part", name, part, snapshotOptions,
          commitSpec, ref, expectedParentCommit);

  emit("lively.partsbin/partpublished", commit);

  return commit;
}

export async function interactivelySavePart(part, options = {}) {
  let {
    showPublishDialog = true,
    notifications = true,
    loadingIndicator = true,
    preferWindow = true
  } = options;

  let switchedToWindow, windowMetadata, actualPart = part;

  let name = part.name, tags = [], description = "",
      oldCommit = Path("metadata.commit").get(part) || Path("metadata.commit").get(actualPart),
      db = MorphicDB.default;

  if (!oldCommit) {
    oldCommit = {
      type: "part", name: part.name, author: $world.getCurrentUser(),
      tags: [], description: "no description"
    }
  }

  if (showPublishDialog) {
    let commit = await $world.openPrompt(await loadPart("publish part dialog"), {part})
    if (!commit.name) return null;
    ({name, tags, description} = commit);
  } else if (oldCommit) {
    ({name, tags, description} = oldCommit);
  }


  if (loadingIndicator) {
    var i = LoadingIndicator.open(`saving ${name}...`);
    await promise.delay(80);
  }

  try {
    let ref = "HEAD",
        oldName = oldCommit ? oldCommit.name : part.name,
        expectedParentCommit;

    if (oldName !== name) {
      let {exists, commitId: existingCommitId} = await db.exists("part", name);
      if (exists) {
        let overwrite = await $world.confirm(`A part "${name}" already exists, overwrite?`);
        if (!overwrite) return null;
        expectedParentCommit = existingCommitId;
      }
      actualPart.name = name;
    } else {
      expectedParentCommit = oldCommit ? oldCommit._id : undefined;
    }

    if (preferWindow && !part.isWindow) {
      var win = part.getWindow();
      if (win && win.targetMorph === part) {
        part = win;
        windowMetadata = win.metadata;
        switchedToWindow = true;
      }
    }

    let commitSpec = {
          author: part.world().getCurrentUser(),
          message: "published", tags, description},
        commit = await savePart(part, name, options, commitSpec, ref, expectedParentCommit);
    
    if (switchedToWindow) {
      if (actualPart.metadata) actualPart.metadata.commit = win.metadata.commit;
      else actualPart.metadata = {commit: win.metadata.commit};
      win.metadata = windowMetadata;
    }

    notifications && part.setStatusMessage(`saved part ${name}`);
    // part.get("world-list") && part.get("world-list").onWorldSaved(name);

    return commit;

  } catch (err) {
    let [_, typeAndName, expectedVersion, actualVersion] = err.message.match(/Trying to store "([^\"]+)" on top of expected version ([^\s]+) but ref HEAD is of version ([^\s\!]+)/) || [];
    if (expectedVersion && actualVersion) {
      let [newerCommit] = await db.log(actualVersion, 1, /*includeCommits = */true),
          {author: {name: authorName}, timestamp} = newerCommit,
          overwriteQ = `The current version of part ${name} is not the most recent!\n`
      + `A newer version by ${authorName} was saved on `
      + `${date.format(new Date(timestamp), "yyyy-mm-dd HH:MM")}. Overwrite?`,
          overwrite = await $world.confirm(overwriteQ);
      if (!overwrite) return null;
      actualPart.changeMetaData("commit", newerCommit, /*serialize = */false, /*merge = */false);
      return interactivelySavePart(actualPart, {...options, showPublishDialog: false});
    }

    console.error(err);
    notifications && $world.logError("Error saving part: " + err);
    throw err;

  } finally { i && i.remove(); }
}

export async function interactivelyLoadObjectFromPartsBinFolder(options = {}) {
  let morphicDB = options.morphicDB || MorphicDB.default,
      partSpecs = await morphicDB.latestCommits("part"),
      items = partSpecs.map(ea => ({isListItem: true, string: ea.name, value: ea})),
      {selected: [choice]} = await $world.filterableListPrompt(
        "select part to load", items, {fuzzy: true});
  return choice ? loadPart(choice) : null;
}

export async function interactivelySaveObjectToPartsBinFolder(obj) {
  var partName = await $world.prompt("Enter part name to publish object under", {
              input: obj.name || "part-name",
              historyId: "lively.partsbin-partname-publish-to-folder-input-hist",
            });
  if (!partName) throw "canceled";
  return saveObjectToPartsbinFolder(obj, partName, {previewWidth: obj.width, previewHeight: obj.height});
}

export async function saveObjectToPartsbinFolder(obj, partName, options = {}) {

  options = {
    preferWindow: true,
    ...options
  }

  if (options.preferWindow) {
    var win = obj.getWindow();
    obj = win && win.targetMorph === obj ? win : obj;
  }
  try {
    if (obj.isMorph) {
      let morphsToPrepare = [];
      obj.withAllSubmorphsDo(ea => {
        if (typeof ea.beforePublish === "function")
          morphsToPrepare.push(ea);
      });
      for (var m of morphsToPrepare) {
        await m.beforePublish();
      }
    } else {
      if (typeof obj.beforePublish === "function")
        await obj.beforePublish(partName, obj);
    }
  } catch (e) {
    let msg = `Error in beforePublish of ${obj}\n${e.stack}`;
    if (typeof obj.world === "function" && obj.world()) obj.world().logError(new Error(msg));
    else console.error(msg);
  }
  await resource(options.partsbinFolder).ensureExistance();
  let partResource = resource(options.partsbinFolder).join(partName + ".json"),
      snapshot = await createMorphSnapshot(obj, options);
  await partResource.write(JSON.stringify(snapshot, null, 2))
  return {partName, url: partResource.url}
}

export async function loadObjectFromPartsbinFolder(partName, options = {}) {
  return loadPart(partName, options);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// editing

export class SnapshotEditor {

  constructor(commit, snapshot) {
    this.commit = commit;
    this.snapshot = snapshot;
  }

  async saveModifiedSnapshot(newCommit, newSnapshot) {
    let {_id, name, type} = newCommit;
    if (!_id) throw new Error(`No id of commit, cannot save!`);
    newCommit = await MorphicDB.default.commit(type, name, newSnapshot, newCommit, undefined, _id);
    this.commit = newCommit;
    this.snapshot = newSnapshot;
    return newCommit;
  }

  async interactivelySaveModifiedSnapshot(newCommit, newSnapshot) {
    let {promise: prom, resolve, reject} = promise.deferred(), editor = this;
    Object.assign(buildCommitEditor(), {
      commit: {...this.commit, ...newCommit},
      cancel() { (this.getWindow() || this).remove(); reject("canceled"); },
      async accept() {
        try {
          let newCommit = await editor.saveModifiedSnapshot(this.commit, newSnapshot);
          (this.getWindow() || this).remove();
          resolve(this.commit = newCommit);
        } catch (err) { this.showError(err); reject(err); }
      }
    }).openInWindow({title: "commit"});
    return prom;
  }

  async interactivelyEditMetadata(onSave) {
    let newCommit = await this.interactivelySaveModifiedSnapshot(this.commit, this.snapshot);
    typeof onSave === "function" && onSave({commit: newCommit, snapshot: this.snapshot});
    return newCommit;
  }

  async interactivelyEditSnapshotJSON(onSave) {
    let {commit, snapshot} = this,
        {_id, name, type, author} = commit, origContent,
        { default: TextEditor } = await System.import("lively.morphic/ide/text-editor.js");

    TextEditor.openURL(`<${type}/${name}>`, {

      historyId: "object-serialization-debugger-editor",

      // fn that gets text editor and returns {saved: BOOLEAN, message: STRING}
      customSaveAction: async ed => {
        let snap = snapshot || await MorphicDB.default.fetchSnapshot(undefined, undefined, _id),
            oldContent = JSON.stringify(snap, null, 2);
        if (oldContent !== origContent) {
          let really = await $world.confirm("Content change since loading, save anyway");
          if (!really) return {saved: false, message: "canceled"};
        }

        let newSnapshot = JSON.parse(ed.ui.contentText.textString);
        commit = await this.interactivelySaveModifiedSnapshot(this.commit, newSnapshot);
        snapshot = newSnapshot;
        origContent = ed.ui.contentText.textString;
        let result = {saved: true, snapshot: newSnapshot, commit};
        if (typeof onSave === "function") onSave(result);
        return result;
      },

      customLoadContentAction: async (ed, url) => {
        let snap = snapshot || await MorphicDB.default.fetchSnapshot(undefined, undefined, _id);
        return {content: origContent = JSON.stringify(snap, null, 2), url: `${type}/${name}.json`}
      }
    });

  }


  async interactivelyEditPackageCode(onSave) {
    let {commit, snapshot} = this,
        {_id, author, name, type} = commit,
        snap = snapshot || await MorphicDB.default.fetchSnapshot(undefined, undefined, _id),
        filePaths = filesInPackages(snap.packages),
        items = filePaths.map(path => {
          let url = path.reduce((url, ea) => string.joinPath(url, ea));
          return {isListItem: true, string: url, value: {path, url}}
        })

    let {selected: [choice]} = await $world.filterableListPrompt("select file to edit",
      items,  {historyId: "object-serialization-debugger-hist"});

    if (!choice) return;

    let origContent = Path(choice.path).get(snap.packages),
        { default: TextEditor } = await System.import("lively.morphic/ide/text-editor.js");

    TextEditor.openURL(`<${type}/${name} - ${choice.path.slice(1).join("/")}>`, {

      historyId: "object-serialization-debugger-editor",

      // fn that gets text editor and returns {saved: BOOLEAN, message: STRING}
      customSaveAction: async ed => {
        let oldContent = Path(choice.path).get(snap.packages);
        if (oldContent !== origContent) {
          let really = await $world.confirm("Content change since loading, save anyway");
          if (!really) return {saved: false, message: "canceled"};
        }
        Path(choice.path).set(snap.packages, ed.ui.contentText.textString);
        commit = await this.interactivelySaveModifiedSnapshot(this.commit, snap);
        let result = {commit, snapshot: snap, saved: true};
        typeof onSave === "function" && onSave(result)
        return result;
      },

      customLoadContentAction: (ed, url) => {
        return {content: Path(choice.path).get(snap.packages), url: choice.url}
      }

    });

    function filesInPackages() {
      // returns array, that form js path to "files" inside snap.packages
      let result = [];
      lively.lang.tree.prewalk({obj: snap.packages, parents: []},
        node => result.push(...Object.keys(node.obj)
                            .map(key => typeof node.obj[key] === "string"
                                 ? node.parents.concat(key) : null)
                            .filter(Boolean)),
        node => Object.keys(node.obj).map(key => typeof node.obj[key] === "object"
                                          ? {parents: [...node.parents, key], obj: node.obj[key]}
                                          : null)
        .filter(Boolean))
      return result;
    }

  }

}


export function buildCommitEditor(props) {

  let inputStyle = {
    type: "input",
    extent: pt(420, 24),
    fixedWidth: true,
    fixedHeight: true,
    padding: Rectangle.inset(4,4),
    border: {color: Color.gray, width: 1}
  };

  return Object.assign(morph({

    extent: pt(420, 24),
    layout: new VerticalLayout({resizeSubmorphs: true, spacing: 3}),
    submorphs: [
      {...inputStyle, name: "name input", placeholder: "name"},
      {...inputStyle, name: "type input", placeholder: "type"},
      {...inputStyle, name: "timestamp input", placeholder: "timestamp"},
      {
        layout: new VerticalLayout({resizeSubmorphs: true, spacing: 3}),
        submorphs: [
          {...inputStyle, name: "author.name input", placeholder: "author name"},
          {...inputStyle, name: "author.email input", placeholder: "author email"},
          {...inputStyle, name: "author.realm input", placeholder: "author realm"},
        ]
      },
      {...inputStyle, name: "tags input", placeholder: "tags"},
      {...inputStyle, height: 70, name: "description input", type: "text"},
      {...inputStyle, height: 70, name: "message input", type: "text"},
      {...inputStyle, height: 70, name: "metadata input", type: "text"},
      {
        layout: new HorizontalLayout({spacing: 3, direction: "centered"}),
        submorphs: [
          {type: "button", name: "ok button", label: "OK"},
          {type: "button", name: "cancel button", label: "Cancel"},
        ]
      }
    ],

    name: "commit editor",
    get ui() {
      return {
        metadataInput: this.get("metadata input"),
        messageInput: this.get("message input"),
        descriptionInput: this.get("description input"),
        tagsInput: this.get("tags input"),
        authorRealmInput: this.get("author.realm input"),
        authorEmailInput: this.get("author.email input"),
        authorNameInput: this.get("author.name input"),
        timestampInput: this.get("timestamp input"),
        typeInput: this.get("type input"),
        nameInput: this.get("name input"),
        cancelButton: this.get("cancel button"),
        okButton: this.get("ok button"),
      }
    },

    set commit(commit) {
      this._commit = commit;
      let {name, type, timestamp, author, tags, description, metadata} = commit,
          {
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
        tagsInput.input = tags.join(" ");
        descriptionInput.textString = description;
        messageInput.textString = "";
        metadataInput.textString = metadata ? JSON.stringify(metadata, null, 2) : "";
    },

    get commit() {
      let commit = this._commit;
      if (!commit) throw new Error("commit editor does not have a _commit object");
      let {
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
          } = this.ui,
          name = nameInput.input, type = typeInput.input;
      if (commit.name !== name) throw new Error(`name does not match _commit.name: ${name} vs ${commit.name}`);
      if (commit.type !== type) throw new Error(`type does not match _commit.type: ${type} vs ${commit.type}`);
      commit.author.name = authorNameInput.input;
      commit.author.email = authorEmailInput.input;
      commit.author.realm = authorRealmInput.input;
      commit.tags = tagsInput.input.split(" ").map(ea => ea.trim()).filter(Boolean);
      commit.description = descriptionInput.textString;
      commit.message = messageInput.textString;
      commit.metadata = metadataInput.textString ? JSON.parse(metadataInput.textString) : null;
      return commit;
    },

    onLoad() {
      connect(this.ui.okButton, 'fire', this, 'accept');
      connect(this.ui.cancelButton, 'fire', this, 'cancel');
    },

    accept() {},
    cancel() {}

  }), props);
}
