"format esm";

import { join,read } from "./helpers.js";
import { Package } from "./package.js";

var packageSpecFile = System.decanonicalize("lively.installer/packages-config.json");

export async function readPackageSpec() {
  return JSON.parse(System.get("@system-env").browser ?
    await (await fetch(packageSpecFile)).text() :
    await read(packageSpecFile));
}

function printSummaryFor(p, packages) {
  var report = `Package ${p.name} at ${p.directory}`
  if (!p.exists) return report + " does not exist"

  var deps = p.findDependenciesIn(packages);
  report += "\n  => dependencies:";
  if (!deps.length) report += " none";
  else report += "\n    " + deps.map(ea => ea.name).join("\n    ")

  report += "\n  => git status:\n";

  if (!p.branch) report += "    not on a branch\n"
  else report += `    on branch ${p.branch}\n`;

  report += `    local changes? ${(p.hasLocalChanges) ? "yes" : "no"}\n`;
  report += `    remote changes? ${(p.hasRemoteChanges) ? "yes" : "no"}\n`;

  return report;
}

export async function summaryForPackages(baseDir) {
  var packages = await Promise.all((await readPackageSpec()).map(spec =>
        new Package(join(baseDir, spec.name), spec).readConfig().readStatus())),
      summaries = await Promise.all(packages.map(ea => printSummaryFor(ea, packages)));
  return summaries.join("\n")
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class TextFlow {

  constructor() {
    this.br = {};
    this.nothing = {};
  }
  
  button(label, action, closureMapping) {
    var b = new lively.morphic.Button(rect(0,0, 100,20), label);
    b.setLabel(label);
    b.addScript(action, "doAction", closureMapping);
    b.applyStyle({fill: Color.white, cssStylingMode: false})
    lively.bindings.connect(b, 'fire', b, 'doAction');
    return b;
  }
  
  text(stringOrList) {
    var t = lively.morphic.newMorph({klass: lively.morphic.Text, extent: pt(20,20)})
    if (Array.isArray(stringOrList)) {
      if (!Array.isArray(stringOrList[0])) stringOrList = [stringOrList];
      t.setRichTextMarkup(stringOrList);
    }
    else t.textString = stringOrList;
    t.applyStyle({fixedWidth: false, fixedHeight: false, fill: null, borderWidth: 0, allowInput: false, whiteSpaceHandling: 'nowrap'});
    return t;
  }
  
  async add(target, morph, pos = pt(0,0)) {
    target.addMorph(morph);
    morph.setPosition(pos);
    if (morph.isText) await new Promise((resolve, reject) => morph.fitThenDo(() => resolve()));
    if (morph.isButton) {
      var measure = target.addMorph(this.text(morph.getLabel()));
      await new Promise((resolve, reject) => measure.fitThenDo(() => resolve()))
      measure.remove();
      morph.setExtent(measure.getExtent());
    }
    return morph;
  }
  
  async render(target, summary) {
    // render(that, [["hello world", {fontWeight: "bold"}], br, br, "test", button("test", () => show('hello'))])
    var pos = pt(0,0), maxY = 0;
    target.removeAllMorphs()
    target.applyStyle({beClip: true})
    for (let part of summary) {
      if (part === this.nothing) continue;
      if (part === this.br) {
        var bottomLeft = pt(0, maxY);
        pos = pos.eqPt(bottomLeft) ? pos.addXY(0, 20) : bottomLeft;
        maxY = pos.y;
        continue;
      }
      if (typeof part === "string" || Array.isArray(part)) part = this.text(part)
      if (part.isMorph) {
        await this.add(target, part, pos)
        pos = part.bounds().topRight();
        maxY = Math.max(maxY, pos.y + part.getExtent().y);
      }
    }
  }

}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// morphic status widget
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// new ReporterWidget("/Users/robert/Lively/lively-dev").morphicSummaryAsMorph()

export class ReporterWidget {

  constructor(baseDir) {
    this.baseDir = baseDir;
    this.textFlow = new TextFlow();
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
          .catch(err => {
            $world.inform(String(err.stack || err));
            console.log(p.printLog());
          })
          .then(() => indicator.remove());
      }, {p}) : this.textFlow.nothing, this.textFlow.br);

    return report.concat(this.textFlow.br, this.textFlow.br);
  }

  async morphicSummary(targetMorph) {
    var packages = await Promise.all(
      (await readPackageSpec()).map(spec =>
        new Package(join(this.baseDir, spec.name), spec)
        .readConfig()
        .then(p => p.readStatus())));
    packages = packages.sortBy(ea =>
      (!ea.exists ? 301 : 0) + (!ea.hasGitRepo ? 201 : 0) + (ea.hasRemoteChanges ? 100 : 0) + (ea.hasLocalChanges ? 100 : 0) + ea.name.charCodeAt(0)).reverse();

    var summaries = packages.map(p => this.renderMorphicSummaryForPackage(p, packages)),
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
    win.setTitle(`lively.installer status for ${this.baseDir}`);
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
