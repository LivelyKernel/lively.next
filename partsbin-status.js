"format esm";

import { join } from "./helpers.js";
import { createPartSpaceUpdate } from "./partsbin-update.js";
import { TextFlow } from "./morphic-helpers.js";

export async function summaryForPartsBin(partSpaceName, fromURL, toURL) {
  // getPartsBinSummary("PartsBin/lively.modules", "https://dev.lively-web.org/", URL.root)
  var update = createPartSpaceUpdate(partSpaceName, fromURL, toURL)
  var summaries = await Promise.all(update.computeUpdates().map(ea => getSummaryFor(ea)));
  return summaries.join("\n")
}


function getSummaryFor(update) {
  var {fromItem, status} = update;
  var report = `Part '${fromItem.name}'\n  => `;
  if (status === 'to-missing') {
    report += "doesn't exist locally!";
  } else if (status === 'from-missing') {
    report += "doesn't exist remotely!";
  } else {
    let localChanges  = status === "to-changed" || status === "both-changed",
        remoteChanges =  status === "from-changed" || status === "both-changed";
    report += "change status:" +
              `\n    local changes: ${ localChanges ? 'yes' : 'no' }` +
              `\n    remote changes: ${ remoteChanges ? 'yes' : 'no' }`;
  }
  return report;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// morphic status widget
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class ReporterWidget {

  constructor(baseDir, partSpaceName, fromURL, toURL) {
    this.livelyDir = join(baseDir, "LivelyKernel")
    this.partSpaceName = partSpaceName;
    this.fromURL = fromURL;
    this.toURL = toURL;
    this.textFlow = new TextFlow();
  }
  
  renderMorphicSummaryForPart(update) {
    var fromItem = update.fromItem,
        meta = fromItem.getMetaInfo(),
        name = meta.partName,
        status = update.status,
        report = [[name, {fontWeight: "bold"}], this.textFlow.br],
        button, localStatus, remoteStatus,
        widget = this;

    if (status === "unknown") {
      report = report.concat("status unknown (?)", this.textFlow.br);
    } else {
      if (status === "to-missing") {
        report = report.concat("doesn't exist locally",
          this.textFlow.button("install", () => {
            var indicator;
            lively.ide.withLoadingIndicatorDo(`installing ${name}`)
              .then(i => indicator = i)
              .then(() => update.runUpdate(widget.livelyDir))
              .catch(err => $world.inform(String(err.stack || err)))
              .then(() => indicator.remove());
          }, {update, name, widget}));
      } else {
        report = report.concat(`local changes? ${ status === "to-changed" || status === "both-changed" ? "yes" : "no"}`);
      }
      report = report.concat(this.textFlow.br);
      switch (status) {
        case "from-missing":
          report = report.concat("doesn't exist remotely");
          break;
        case "from-changed":
        case "both-changed":
          report = report.concat("remote changes? yes",
          this.textFlow.button("update", () => {
            var indicator;
            lively.ide.withLoadingIndicatorDo(`updating ${name}`)
              .then(i => indicator = i)
              .then(() => update.runUpdate(widget.livelyDir))
              .catch(err => $world.inform(String(err.stack || err)))
              .then(() => indicator.remove());
          }, {update, name, widget}));
          break;
        default:
          report = report.concat("remote changes? no");
      }
      report = report.concat(this.textFlow.br);
    }
  
    return report.concat(this.textFlow.br, this.textFlow.br);
  }

  async morphicSummary(targetMorph) {
    var partSpaceUpdate = createPartSpaceUpdate(this.partSpaceName, this.fromURL, this.toURL);
    var partUpdates = partSpaceUpdate.computeUpdates();
    
    var summaries = partUpdates.map(u => this.renderMorphicSummaryForPart(u)),
        reporter = this,
        report = [
          this.textFlow.button("refresh",
            function() { reporter.morphicSummary(this.owner); },
            {reporter}),
          this.textFlow.br, this.textFlow.br
        ].concat(lively.lang.arr.flatten(summaries, 1));

    return this.textFlow.render(targetMorph, report);
  }

  summaryMorph() {
    var target = lively.morphic.newMorph({extent: pt(600, 440), style: {fill: Color.white, borderWidth: 0}});
    var win = target.openInWindow(target.getPosition()).openInWorldCenter();
    win.setTitle(`lively.installer status for ${this.toURL + this.partSpaceName}`);
    win.comeForward();
    return win;
  }

  async morphicSummaryAsMorph() {
    var indicator = await lively.ide.withLoadingIndicatorDo("loading"),
        morph = this.summaryMorph();
    try {
      await this.morphicSummary(morph.targetMorph);
    } catch (e) {
      $world.inform(String(e.stack || e));
    } finally {
      indicator.remove();
    }
    return morph;
  }
}