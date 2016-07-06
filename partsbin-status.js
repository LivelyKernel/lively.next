"format esm";

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
    this.baseDir = baseDir;
    this.partSpaceName = partSpaceName;
    this.fromURL = fromURL;
    this.toURL = toURL;
    this.textFlow = new TextFlow();
  }
  
  renderMorphicSummaryForPart(update) {
    var fromItem = update.fromItem,
        meta = fromItem.loadedMetaInfo,
        name = meta.partName,
        status = update.status,
        report = [[name, {fontWeight: "bold"}], this.textFlow.br],
        button, localStatus, remoteStatus;

    if (status === "unknown") {
      report = report.concat("status unknown (?)", this.textFlow.br);
    } else {
      if (status === "to-missing") {
        report = report.concat("doesn't exist locally",
          this.textFlow.button(button, () => {
            var indicator;
            lively.ide.withLoadingIndicatorDo(`installing ${name}`)
              .then(i => indicator = i)
              .then(() => update.runUpdate(this.baseDir))
              .then(out => { $world.inform(out); })
              .catch(err => $world.inform(String(err.stack || err)))
              .then(() => indicator.remove());
          }, {update}));
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
          this.textFlow.button(button, () => {
            var indicator;
            lively.ide.withLoadingIndicatorDo(`updating ${name}`)
              .then(i => indicator = i)
              .then(() => update.runUpdate(this.baseDir))
              .then(out => { $world.inform(out); })
              .catch(err => $world.inform(String(err.stack || err)))
              .then(() => indicator.remove());
          }, {update}));
          break;
        default:
          report = report.concat("remote changes? no");
      }
      report = report.concat(this.textFlow.br);
    }
  
    return report.concat(this.textFlow.br, this.textFlow.br);
  }

  renderMorphicSummaryForPackage(p, packages) {
    var report = [[p.name, {fontWeight: "bold"}], `at ${p.directory}`];
    if (!p.exists || !p.hasGitRepo) return report.concat(
      this.textFlow.br,
      !p.exists ? "  does not exist!" : "  is not a git repository!",
      this.textFlow.button("install", () => {
        var indicator;
        lively.ide.withLoadingIndicatorDo(`installing ${p.name}`)
          .then(i => indicator = i)
          .then(() => p.installOrUpdate(packages))
          .then(out => { $world.inform(out); })
          .catch(err => $world.inform(String(err.stack || err)))
          .then(() => indicator.remove());
      }, {p, packages}), this.textFlow.br, this.textFlow.br);

    report = report.concat(this.textFlow.button("cd", () => {
        lively.shell.setWorkingDirectory(p.directory);
      }, {p}), this.textFlow.br);

    if (!p.currentBranch) report = report.concat("not on a branch");
    else report = report.concat(`on branch ${p.currentBranch}`);

    report = report.concat(
      this.textFlow.button("log", () =>

        Promise.resolve()
        .then(() => p.hasRemoteChanges && lively.shell.run(`cd ${p.directory};  git fetch --all`))
        .then(() => lively.shell.run(`cd ${p.directory};  git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative -n 200 --all;`))
        .then(cmd =>
          $world.addCodeEditor({title: `Commits of ${p.name}`, content: cmd.output, textMode: "text", extent: pt(700,600)})
            .getWindow().comeForward()), {p}), this.textFlow.br);

    report = report.concat(
      "local changes?",
      p.hasLocalChanges ? "yes" : "no",
      p.hasLocalChanges ? this.textFlow.button("diff", () =>
        lively.shell.run(`cd ${p.directory}; git diff`).then(cmd =>
          $world.addCodeEditor({title: `Diff ${p.name}`,content: cmd.output,textMode: "diff", extent: pt(500,600)})
            .getWindow().comeForward()), {p}) : this.textFlow.nothing, this.textFlow.br);

    report = report.concat(
      "remote changes?",
      p.hasRemoteChanges ? "yes" : "no",
      p.hasRemoteChanges ? this.textFlow.button("update", () => {
        var indicator;
        lively.ide.withLoadingIndicatorDo(`updating ${p.name}`)
          .then(i => indicator = i)
          .then(() => p.installOrUpdate())
          .then(out => { $world.inform(out); })
          .catch(err => $world.inform(String(err.stack || err)))
          .then(() => indicator.remove());
      }, {p}) : this.textFlow.nothing, this.textFlow.br);

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