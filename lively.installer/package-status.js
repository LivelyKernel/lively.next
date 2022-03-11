/* global System,$$world */
'format esm';

import { join } from './helpers.js';
import { Package } from './package.js';
import { TextFlow } from './morphic-helpers.js';
import { resource } from 'lively.resources';
import { runCommand } from '../lively.ide/shell/shell-interface.js';
import Terminal from '../lively.ide/shell/terminal.js';
import { pt } from 'lively.graphics';
import { arr } from 'lively.lang';

let packageSpecFile = System.decanonicalize('lively.installer/packages-config.json');

// await readPackageSpec()
export async function readPackageSpec () {
  return JSON.parse(await resource(packageSpecFile).read());
}

// await packages("/Users/robert/Lively/lively-dev/")
// var baseDir = "/Users/robert/Lively/lively-dev/"
export async function packages (baseDir) {
  let specs = await readPackageSpec();
  return await Promise.all(
    specs.map(spec =>
      new Package(join(baseDir, spec.name), spec)
        .readConfig()
        .then(p => p.readStatus())));
}

function printSummaryFor (p, packages) {
  let report = `Package ${p.name} at ${p.directory}`;
  if (!p.exists) return report + ' does not exist';

  let deps = p.findDependenciesIn(packages);
  report += '\n  => dependencies:';
  if (!deps.length) report += ' none';
  else report += '\n    ' + deps.map(ea => ea.name).join('\n    ');

  report += '\n  => git status:\n';

  if (!p.branch) report += '    not on a branch\n';
  else report += `    on branch ${p.branch}\n`;

  report += `    local changes to commit? ${(p.hasLocalChanges) ? 'yes' : 'no'}\n`;
  report += `    local changes to push? ${(p.hasLocalChangesToPush) ? 'yes' : 'no'}\n`;
  report += `    remote changes? ${(p.hasRemoteChanges) ? 'yes' : 'no'}\n`;

  return report;
}

export async function summaryForPackages (baseDir) {
  let packages = await Promise.all((await readPackageSpec()).map(spec =>
    new Package(join(baseDir, spec.name), spec).readConfig().readStatus()));
  let summaries = await Promise.all(packages.map(ea => printSummaryFor(ea, packages)));
  return summaries.join('\n');
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// morphic status widget
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// var reporter = new ReporterWidget("/Users/robert/Lively/lively-dev"); reporter.morphicSummaryAsMorph()
// var {remote, branch} = await reporter.packages[1].repo.localBranchInfo()

export class ReporterWidget {
  constructor (baseDir) {
    this.baseDir = baseDir;
    this.textFlow = new TextFlow();
    this.packages = [];
  }

  withLoadingIndicatorCatchingErrors (func, label = 'please wait') {
    let indicator;
    return lively.ide.withLoadingIndicatorDo(label)
      .then(i => indicator = i)
      .then(() => func())
      .then(out => { out && $$world.inform(out); })
      .catch(err => $$world.inform(String(err.stack || err)))
      .then(() => indicator.remove());
  }

  renderMorphicSummaryForPackage (p) {
    let reporter = this;
    let report = [[p.name, { fontWeight: 'bold' }], `at ${p.directory}`];

    // Package name + status
    if (!p.exists || !p.hasGitRepo) {
      return report.concat(
        this.textFlow.br,
        !p.exists ? '  does not exist!' : '  is not a git repository!',
        this.textFlow.button('install', () => {
          reporter.withLoadingIndicatorCatchingErrors(
            () => p.installOrUpdate(reporter.packages), `installing ${p.name}`);
        }, { p, reporter }), this.textFlow.br, this.textFlow.br); 
    }

    // cd button
    // report = report.concat(this.textFlow.button("cd", () => {
    //     lively.shell.setWorkingDirectory(p.directory);
    //   }, {p}));

    // more... button
    report = report.concat(this.textFlow.button('more...', () => {
      lively.morphic.Menu.openAtHand(null, [
        ['force re-install', () => {
          reporter.withLoadingIndicatorCatchingErrors(
            () => p.installOrUpdate(reporter.packages), `installing ${p.name}`);
        }],
        ['commit everything', () => {
          $$world.prompt('Enter a commit message', { historyId: 'lively.installer-commit-all-message' })
            .then(msg => p.repo.commit(msg, true))
            .then(cmd => $$world.inform(cmd.output))
            .catch(err => $$world.inform(err.stack || err));
        }],
        ['push', () => {
          Promise.resolve()
            .then(msg => p.repo.push())
            .then(cmd => $$world.inform(cmd.output))
            .catch(err => $$world.inform(err.stack || err));
        }]
      ]);
    }, { p, reporter }), this.textFlow.br);

    // branch info
    if (!p.currentBranch) report = report.concat('not on a branch');
    else report = report.concat(`on branch ${p.currentBranch}`);

    // log button
    report = report.concat(
      this.textFlow.button('log', () =>

        Promise.resolve()
          .then(() => p.hasRemoteChanges && runCommand(`cd ${p.directory};  git fetch --all`).whenDone())
          .then(() => runCommand(`cd ${p.directory};  git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative -n 200 --all;`).whenDone())
          .then(cmd =>
            $$world.execCommand('open text window', {
              title: `Commits of ${p.name}`,
              content: cmd.output,
              textMode: 'text',
              extent: pt(700, 600)
            })), { p }), this.textFlow.br);
    
    // local changes + diff button
    report = report.concat(
      'local changes to commit?',
      p.hasLocalChanges ? 'yes' : 'no',
      p.hasLocalChanges
        ? this.textFlow.button('diff', () =>
          runCommand(`cd ${p.directory}; git diff`).whenDone()
            .then(cmd =>
              $$world.execCommand('open text window', {
                title: `Diff ${p.name}`,
                content: cmd.output,
                textMode: 'diff',
                extent: pt(500, 600)
              }))
            .catch(err => $$world.logError(err)), { p })
        : this.textFlow.nothing, this.textFlow.br);

    report = report.concat(
      'local changes to push?',
      p.hasLocalChangesToPush ? 'yes' : 'no',
      p.hasLocalChangesToPush
        ? this.textFlow.button('push', () =>
          Terminal.runCommand(`cd! ${p.directory}; git push origin ${p.config.branch}`), { p })
        : this.textFlow.nothing, this.textFlow.br);

    // remote changes + update button
    report = report.concat(
      'remote changes?',
      p.hasRemoteChanges ? 'yes' : 'no',
      p.hasRemoteChanges
        ? this.textFlow.button('update', () => {
          reporter.withLoadingIndicatorCatchingErrors(
            () => p.installOrUpdate(reporter.packages), `updating ${p.name}`);
        }, { p, reporter })
        : this.textFlow.nothing,
      p.hasRemoteChanges
        ? this.textFlow.button('show changes', () => {
          p.repo.getRemoteAndLocalHeadRef(p.config.branch).then(({ local, remote }) =>
            Terminal.runCommand(`cd! ${p.directory}; git diff ${local}...${remote}`));
        }, { p })
        : this.textFlow.nothing,
      this.textFlow.br);

    // missing / outdated npm packages
    let missingNpmPackages = p._npmPackagesThatNeedFixing;
    if (missingNpmPackages && missingNpmPackages.length) {
      report = report.concat(
        'missing npm packages:',
        missingNpmPackages.join(', '),
        this.textFlow.button('update / install', () =>
          p.fixNPMPackages(missingNpmPackages)
            .then(() => p.linkToDependencies(packages)), { p, missingNpmPackages, packages }),
        this.textFlow.br);
    }

    return report.concat(this.textFlow.br, this.textFlow.br);
  }

  async morphicSummary (targetMorph) {
    // var pBar = $world.addProgressBar(null, "checking packages"), done = 0;
    try {
      let specs = await readPackageSpec();
      var packages = await Promise.all(
        specs.map(spec =>
          new Package(join(this.baseDir, spec.name), spec)
            .readConfig()
            .then(p => p.readStatus())
            .then(p => {
              // done++; pBar.setValue(done / specs.length);
              return p;
            })));
    } catch (e) {
      $$world.inform(String(e.stack || e));
    } finally {
      // pBar.remove();
    }

    this.packages = packages.sortBy(ea =>
      (!ea.exists ? 401 : 0) + (!ea.hasGitRepo ? 301 : 0) + (ea.hasRemoteChanges ? 200 : 0) + (ea.hasLocalChangesToPush ? 80 : 0) + (ea.hasLocalChanges ? 100 : 0) + (ea._npmPackagesThatNeedFixing && ea._npmPackagesThatNeedFixing.length ? 50 : 0) + ea.name.charCodeAt(0)).reverse();

    let summaries = this.packages.map(p => this.renderMorphicSummaryForPackage(p));
    let reporter = this;
    let report = [
      this.textFlow.button('refresh',
        function () { reporter.morphicSummary(this.owner); },
        { reporter }),
      this.textFlow.br, this.textFlow.br
    ].concat(summaries.flat());

    return this.textFlow.render(targetMorph, report);
  }

  summaryMorph () {
    let target = lively.morphic.newMorph({ extent: lively.pt(600, 440), style: { fill: lively.Color.white, borderWidth: 0 } });
    let win = target.openInWindow(target.getPosition()).openInWorldCenter();
    win.setTitle(`lively.installer status for ${this.baseDir}`);
    win.comeForward();
    return win;
  }

  async morphicSummaryAsMorph () {
    let indicator = await lively.ide.withLoadingIndicatorDo('loading');
    let morph = this.summaryMorph();
    try {
      await this.morphicSummary(morph.targetMorph);
    } catch (e) {
      $$world.inform(String(e.stack || e));
    } finally {
      indicator.remove();
    }
    return morph;
  }
}
