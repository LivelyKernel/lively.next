import { AbstractPrompt } from "lively.morphic/components/prompts.js";
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
    let {serverURL, snapshotLocation, dbName, extent, historyId} = props;

    this.submorphs = [
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
    ]
    let [
      dbnameLabel,
      snapshotLocationLabel,
      serverUrlLabel,
      dbnameInput,
      snapshotLocationInput,
      serverUrlInput,
      okButton,
      cancelButton,
    ] = this.submorphs;

    if (dbName) dbnameInput.input = dbName;
    if (snapshotLocation) snapshotLocationInput.input = snapshotLocation;
    if (serverURL) serverUrlInput.input = serverURL;

    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');
    this.extent = pt(600,128);
    this.initLayout();
    if (extent) this.extent = extent;
  }

  resolve() {
    let dbnameInput = this.get("dbname input");
    let snapshotLocationInput = this.get("snapshot location input");
    let serverUrlInput = this.get("server url input");
    serverUrlInput.acceptInput();
    snapshotLocationInput.acceptInput();
    dbnameInput.acceptInput();
    super.resolve({
      dbName: dbnameInput.input,
      snapshotLocation: snapshotLocationInput.input,
      serverURL: serverUrlInput.input,
      status: "accepted"
    });
  }
  reject() { super.resolve({status: "rejected"}); }

  initLayout() {
    let bounds = this.innerBounds(),
        relBounds = [
          rect(0.0171875,0.0546875,0.1512109375,0.171875),
          rect(0.0171875,0.25,0.22075520833333334,0.171875),
          rect(0.0171875,0.44921875,0.1608984375,0.171875),
          rect(0.2337760416666667,0.0546875,0.7558333333333334,0.15625),
          rect(0.2337760416666667,0.265625,0.7558333333333334,0.15625),
          rect(0.2337760416666667,0.47265625,0.7558333333333334,0.15625),
          rect(0.23,0.78125,0.25,0.15625),
          rect(0.5175,0.78125,0.25,0.15625)
        ],
        realBounds = bounds.divide(relBounds);
    this.submorphs.map((ea, i) => ea.setBounds(realBounds[i]));
    this.layout = new ProportionalLayout({
      submorphSettings: [
        ["server url label", "fixed"],
        ["snapshot location label", "fixed"],
        ["dbname label", "fixed"],
        ["server url input", {x: "resize", y: "fixed"}],
        ["snapshot location input", {x: "resize", y: "fixed"}],
        ["dbname input", {x: "resize", y: "fixed"}],
      ]
    });
  }
}
