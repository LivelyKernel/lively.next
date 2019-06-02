import { Morph, GridLayout } from "lively.morphic";
import { Color } from "lively.graphics/index.js";
import { connect, signal } from "lively.bindings/index.js";
import ObjectPackage from "lively.classes/object-classes.js";
import { interactivelySaveObjectToPartsBinFolder, saveObjectToPartsbinFolder } from "lively.morphic/partsbin.js";
import { AbstractPrompt } from "lively.morphic/components/prompts.js";
import { promise } from "lively.lang/index.js";

export default class PublishPartDialog extends AbstractPrompt {

  static get properties() {  
    return {   
      canceled: {connection: {}},
      published: {connection: {}},

      target: {
        after: ["submorphs"],
        set(t) {
          this.setProperty("target", t);
          let titleLabel = this.getSubmorphNamed("titleLabel"),
              versionInput = this.getSubmorphNamed("versionInput"),
              nameInput = this.getSubmorphNamed("nameInput");
          titleLabel.value = `Publish ${t ? String(t) : "..."}`;
          nameInput.placeholder = t ? t.name : "...part name";
          versionInput.placeholder = "version";
        }
      }
    }
  }

  reset() {
    // this.target = this;
    let titleLabel = this.getSubmorphNamed("titleLabel"),
        nameInput = this.getSubmorphNamed("nameInput"),
        versionInput = this.getSubmorphNamed("versionInput"),
        publishButton = this.getSubmorphNamed("publishButton"),
        cancelButton = this.getSubmorphNamed("cancelButton");

    titleLabel.value = "Publish part"
    titleLabel.fontSize = 14
    nameInput.label = "Part name: ";
    versionInput.label = "Version: ";
    nameInput.placeholder = "name";
    versionInput.placeholder = "version";
    nameInput.updatePlaceholder()
    publishButton.label = "publish"
    cancelButton.label = "cancel";

    connect(cancelButton, 'fire', this, 'onCancel');
    connect(publishButton, 'fire', this, 'onPublish');

    this.layout = new GridLayout({
             rows: [0, {paddingTop: 5, fixed: 30},
                    3, {paddingBottom: 5, fixed: 30}],
             columns: [0, {paddingLeft: 5, paddingRight: 2.5},
                      1, {paddingLeft: 2.5, paddingRight: 5}],
             grid:[["titleLabel", "titleLabel"],
                   ["nameInput", "nameInput"],
                   ["versionInput", "versionInput"],
                   ["publishButton", "cancelButton"]]
           })

    // await $world.openPrompt(this)
  }

  partInfoOfTarget() {
    let t = this.target;
    ObjectPackage.lookupPackageForObject(t)
  }

  onCancel() {
    signal(this, "canceled");
    this.reject("canceled");
  }
  
  onPublish() {
    this.publishTarget();
  }

  async publishTarget() {
    let {target} = this;
    if (!target) { this.showError(new Error("no target")); return; }
    let {input: partName} = this.getSubmorphNamed("nameInput");
    if (!partName) partName = target.name;
    if (!partName) partName = "a" + target.constructor.name;
    try {
      let {url} = await saveObjectToPartsbinFolder(target, partName);
      this.setStatusMessage(`Published ${partName}`, Color.green);      
      this.resolve({partName, url});
      signal(this, "published", {partName, url});
    } catch (e) {
      this.showError(e);
      this.reject(e);
    }
  }
}

