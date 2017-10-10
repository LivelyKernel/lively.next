import { AbstractPrompt } from "lively.components/prompts.js";
import { Rectangle, pt, rect, Color } from "lively.graphics";
import { connect } from "lively.bindings";
import { ProportionalLayout } from "lively.morphic";


export class MorphicDBPrompt extends AbstractPrompt {

  static open(dbName, snapshotLocation, serverURL, opts, world = $world) {
    opts = {
      ...opts,
      serverURL,
      snapshotLocation,
      dbName
    }
    return world.openPrompt(new this(opts), opts)
  }

  build(props = {}) {
    let {serverURL, snapshotLocation, dbName, extent, historyId, alias} = props;

    this.submorphs = [
      {
        name: "alias label", type: "label", value: "alias",
        fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray
      },
      {
        name: "dbname label", type: "label", value: "db name",
        fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray
      },
      {
        name: "snapshot location label", type: "label", value: "snapshot location",
        fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray
      },
      {
        name: "server url label", type: "label", value: "server url",
        fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray
      },

      {
        name: "alias input", type: "input",
        historyId: historyId ? historyId + "-alias": null,
        padding: Rectangle.inset(3), fontSize: 11
      },
      {
        name: "dbname input", type: "input",
        historyId: historyId ? historyId + "-dbname": null,
        padding: Rectangle.inset(3), fontSize: 11
      },
      {
        name: "snapshot location input", type: "input",
        historyId: historyId ? historyId + "-snapshot": null,
        padding: Rectangle.inset(3), fontSize: 11
      },
      {
        name: "server url input", type: "input",
        historyId: historyId ? historyId + "-server": null,
        padding: Rectangle.inset(3), fontSize: 11
      },
      {
        styleClasses: ['ok'],
        name: "ok button", type: "button",
        label: "OK"
      },
      {
        styleClasses: ['cancel'],
        name: "cancel button", type: "button",
        label: "Cancel"
      }
    ];

    let [
      aliasLabel,
      dbnameLabel,
      snapshotLocationLabel,
      serverUrlLabel,
      aliasInput,
      dbnameInput,
      snapshotLocationInput,
      serverUrlInput,
      okButton,
      cancelButton,
    ] = this.submorphs;

    if (alias) aliasInput.input = alias;
    if (dbName) dbnameInput.input = dbName;
    if (snapshotLocation) snapshotLocationInput.input = snapshotLocation;
    if (serverURL) serverUrlInput.input = serverURL;

    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');
    this.extent = pt(600,128);
    this.initLayout(!!alias);
    if (extent) this.extent = extent;
  }

  resolve() {
    let aliasInput = this.get("alias input");
    let dbnameInput = this.get("dbname input");
    let snapshotLocationInput = this.get("snapshot location input");
    let serverUrlInput = this.get("server url input");
    serverUrlInput.acceptInput();
    snapshotLocationInput.acceptInput();
    dbnameInput.acceptInput();
    super.resolve({
      alias: aliasInput.input,
      dbName: dbnameInput.input,
      snapshotLocation: snapshotLocationInput.input,
      serverURL: serverUrlInput.input,
      status: "accepted"
    });
  }
  reject() { super.resolve({status: "rejected"}); }

  initLayout(showAlias = false) {
    let bounds = this.innerBounds(),
        relBounds = [
          rect(0.02,0.05,0.15,0.19),
          rect(0.02,0.23,0.22,0.19),
          rect(0.02,0.42,0.16,0.19),
          rect(0.02,0.60,0.16,0.19),
          rect(0.23,0.05,0.76,0.15),
          rect(0.23,0.23,0.76,0.15),
          rect(0.23,0.42,0.76,0.15),
          rect(0.23,0.60,0.76,0.15),
          rect(0.31,0.79,0.18,0.17),
          rect(0.51,0.80,0.18,0.16)
        ],
        realBounds = bounds.divide(relBounds);
    if (!showAlias) {
      relBounds.splice(3, 1);
      relBounds.splice(7, 1);
    }
    this.submorphs.map((ea, i) => ea.setBounds(realBounds[i]));
    this.layout = new ProportionalLayout({
      submorphSettings: [
        ["alias label", "fixed"],
        ["server url label", "fixed"],
        ["snapshot location label", "fixed"],
        ["dbname label", "fixed"],
        ["alias input", {x: "resize", y: "fixed"}],
        ["server url input", {x: "resize", y: "fixed"}],
        ["snapshot location input", {x: "resize", y: "fixed"}],
        ["dbname input", {x: "resize", y: "fixed"}],
      ]
    });
  }
}
