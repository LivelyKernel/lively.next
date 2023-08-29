import { arr, date, string } from 'lively.lang';
import { connect, signal } from 'lively.bindings';
import { Color, pt } from 'lively.graphics';
import { localInterface } from 'lively-system-interface';
import { commit, branch, localBranchesOf, gitHubBranches } from 'lively.changesets';
import { activeCommit } from 'lively.changesets/src/commit.js';
import { getAuthor, setAuthor, getGitHubToken, setGitHubToken } from 'lively.changesets/src/settings.js';
import { subscribe, unsubscribe } from 'lively.notifications';
import { part } from 'lively.morphic';
import { morph, Morph } from '../index.js';
import { Window } from '../widgets.js';
import CodeEditor from './code-editor.js';
import { GridLayout, HorizontalLayout } from '../layout.js';

function pad (m) { // Morph -> Morph
  return {
    name: m.name + 'Padded',
    layout: new HorizontalLayout({ spacing: 6 }),
    submorphs: [m]
  };
}

class GridLayoutWithPadding extends GridLayout {
  constructor (grid) {
    super({
      grid: grid.reduce((rowCells, row) => {
        const r = row.reduce((cells, cell) => cells.concat([cell, null]), [null]);
        return rowCells.concat([r, Array(grid[0].length).map(_ => null)]);
      }, [Array(grid[0].length).map(_ => null)])
    });
  }

  setupPadding (padding) {
    for (let i = 0; i < this.rowCount; i += 2) {
      this.row(i).fixed = padding;
    }
    for (let j = 0; j < this.columnCount; j += 2) {
      this.col(j).fixed = padding;
    }
  }
}

class CommitGraph {
  constructor (pkg, numCommits) {
    this.pkg = pkg;
    this.numCommits = numCommits;

    this.queue = []; // Array<Commit>
    this.commits = {}; // { [Hash]: {commit: Commit, branches: Array<Branch> }

    this.nodes = []; // Array<{x, y, commit: Commit, branches: Array<Branch>, active: boolean }>
    this.layers = {}; // { [number]: Array<{commit: Commit, branches: Array<Branch> }>}
    this.edges = []; // Array<{x1, y1, x2, y2}>
  }

  addCommit (commit, branches = [], active = false) {
    if (commit.hash in this.commits) {
      const c = this.commits[commit.hash];
      c.branches = arr.union(c.branches, branches);
      if (active) c.active = true;
      return;
    }

    this.commits[commit.hash] = { commit, branches, active };
    this.queue.push(commit);
  }

  async gatherCommits () {
    // -> { [Hash]: Commit }
    const active = await activeCommit(this.pkg);
    const branches = await localBranchesOf(this.pkg);
    if (this.numCommits === null) {
      this.numCommits = 3 * branches.length;
    }
    for (let i = 0; i < branches.length; i++) {
      const branchHead = await branches[i].head();
      this.addCommit(branchHead, [branches[i]]);
    }
    if (active) this.addCommit(active, [], true);

    let toShow = this.numCommits;
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      for (let p of next.parents) {
        if (--toShow >= 0) {
          this.addCommit(await commit(this.pkg, p));
        }
      }
    }
  }

  networkFlow (commitEntry) {
    // { commit, y } -> Bool
    for (let hash of commitEntry.commit.parents) {
      if (!(hash in this.commits)) continue;
      if (this.networkFlow(this.commits[hash])) {
        return true;
      } else if (this.commits[hash].y <= commitEntry.y) {
        this.commits[hash].y++;
        return true;
      }
    }
    // maybe inc my own y
    let minY = Number.MAX_SAFE_INTEGER;
    for (let hash of commitEntry.commit.parents) {
      if (!(hash in this.commits)) {
        minY = 0;
        break;
      }
      minY = Math.min(minY, this.commits[hash].y);
    }
    if (commitEntry.commit.parents.length > 0 && commitEntry.y < minY - 1) {
      commitEntry.y = minY - 1;
      return true;
    }

    // no more flows possible
    return false;
  }

  determineLayers () {
    Object.keys(this.commits).forEach(hash => this.commits[hash].y = 0);
    const pseudoRoot = { commit: { parents: Object.keys(this.commits) }, y: 0 };
    while (this.networkFlow(pseudoRoot));
    this.nodes = Object.keys(this.commits).map(hash => this.commits[hash]);
    if (this.nodes.length === 0) return;
    const maxY = arr.max(this.nodes, ({ y }) => y).y;
    this.nodes.forEach(ce => ce.y = maxY - ce.y);
    this.layers = arr.groupBy(this.nodes, ce => ce.y);
  }

  determineColumns () {
    const assignedColumns = Object.keys(this.layers).map(x => ({}));
    for (let layerIdx = Object.keys(this.layers).length - 1; layerIdx >= 0; layerIdx--) {
      const layer = this.layers[layerIdx];
      // assign columns to non-assigned nodes in this layer
      for (let commitEntry of layer) {
        if (commitEntry.x !== undefined) continue;
        let idx = 0;
        while (assignedColumns[layerIdx][idx]) idx++;
        commitEntry.x = idx;
        assignedColumns[layerIdx][idx] = true;
      }
      // try to push column idx to direct parent, blocking column range
      for (let commitEntry of layer) {
        const pe = this.commits[commitEntry.commit.parents[0]];
        if (pe && pe.x === undefined) {
          pe.x = commitEntry.x;
          for (let bIdx = layerIdx - 1; bIdx >= pe.y; bIdx--) {
            assignedColumns[bIdx][pe.x] = true;
          }
        }
      }
    }
  }

  createEdges () {
    for (let node of this.nodes) {
      for (let pNodeHash of node.commit.parents) {
        if (pNodeHash in this.commits) {
          const pNode = this.commits[pNodeHash];
          this.edges.push({ x1: pNode.x, y1: pNode.y, x2: node.x, y2: node.y });
        }
      }
    }
  }

  doLayout () {
    this.determineLayers();
    this.determineColumns();
    this.createEdges();
  }

  buildGraph () {
    return this.gatherCommits().then(() => this.doLayout());
  }
}

class CommitNode extends Morph {
  constructor (props) {
    super({
      extent: pt(160, 40),
      borderWidth: 1,
      borderRadius: 5,
      fill: this.color(props.selected),
      borderColor: props.active ? Color.black : this.color(props.selected),
      tooltip: this.commitTooltip(props.commit),
      submorphs: [
        this.avatar(props.commit),
        this.description(props.commit, props.selected),
        ...this.branchTags(props.branches)
      ],
      ...props
    });
  }

  avatar (commit) {
    const hash = string.md5(commit.author.email);
    const imageUrl = `https://www.gravatar.com/avatar/${hash}?s=32`;
    return {
      type: 'image',
      position: pt(4, 4),
      extent: pt(32, 32),
      tooltip: this.commitTooltip(commit),
      imageUrl
    };
  }

  color (selected) {
    return selected ? Color.rgb(180, 210, 229) : Color.rgb(229, 229, 229);
  }

  description (commit, selected) {
    const d = new Date(commit.author.date.seconds * 1000);
    const relDate = date.relativeTo(d, new Date());
    const msg = string.truncate(commit.message.replace(/\n/g, ' '), 20);
    const from = { row: 0, column: 0 };
    const to = { row: 1, column: 0 };
    return {
      type: 'text',
      position: pt(38, 6),
      extent: pt(60, 18),
      fill: this.color(selected),
      tooltip: this.commitTooltip(commit),
      fontSize: 10,
      textString: `${msg}\n${commit.hash.substr(0, 8)} (${relDate})`
    };
  }

  branchTags (branches) {
    return branches.map((branch, idx) => ({
      position: pt(90 * idx + 5, -9),
      type: 'text',
      fontSize: 10,
      fontColor: Color.white,
      fill: Color.darkGray,
      textString: branch.name
    }));
  }

  commitTooltip (commit) {
    const d = new Date(commit.author.date.seconds * 1000);
    const humanDate = date.format(d);
    const relDate = date.relativeTo(d, new Date());
    return `${commit.message}\n${commit.hash}\n\n${commit.author.name} (${commit.author.email})\n${relDate} ago (${humanDate})`;
  }

  onMouseDown (evt) {
    if (!this.selected) this.owner.selectCommit(this);
  }
}

class CommitTree extends Morph {
  constructor (props) {
    super({
      clipMode: 'auto',
      ...props
    });
    this.toShow = null;
    this.selectedCommit = null;
    this.selectedBranch = null;
  }

  addNode (x, y, commit, branches, selected, active) {
    this.addMorph(new CommitNode({
      commit, branches, selected, active, position: pt(x * 180 + 10, y * 60 + 10)
    }));
  }

  addEdge (x1, y1, x2, y2) {
    const mx = (x2 - x1) * 180 + 3;
    const my = (y2 - y1) * 60 - 40;
    const topLeft = pt(Math.min(x1, x2) * 180 + 87, y1 * 60 + 50);
    const xOffset = Math.max(0, x1 - x2) * 180 + 3;
    this.addMorph(morph({
      type: 'path',
      position: topLeft,
      extent: pt(Math.abs(x2 - x1) * 180 + 3 + 6, my),
      borderColor: Color.rgb(112, 112, 112),
      borderWidth: 2,
      vertices: [{ x: xOffset, y: 0 }, { x: xOffset, y: 10 }, { x: mx, y: 10 }, { x: mx, y: my }, { x: mx + 3, y: my - 6 }, { x: mx, y: my }, { x: mx - 3, y: my - 6 }, { x: mx, y: my }]
    }));
  }

  addLoadMoreButton () {
    const btn = morph({
      type: 'button',
      label: 'load more',
      position: pt(0, 0),
      fontSize: 11,
      borderRadius: 0,
      extent: pt(70, 20)
    });
    this.addMorph(btn);
    connect(btn, 'fire', this, 'loadMore');
  }

  loadMore () {
    if (this.numCommits === null) return;
    this.numCommits += 10;
    return this.update();
  }

  async update (pkg = this.pkg) {
    if (this.pkg !== pkg) this.numCommits = null;
    this.pkg = pkg;
    const prevSelectedCommit = this.selectedCommit;
    const prevSelectedBranch = this.selectedBranch;
    this.selectedCommit = null;
    this.selectedBranch = null;
    this.removeAllMorphs();
    if (!pkg) return;
    this.addMorph({ type: 'text', textString: 'loading...' });
    const graph = new CommitGraph(pkg, this.numCommits);
    await graph.buildGraph();
    this.numCommits = graph.nodes.length;
    this.removeAllMorphs();
    for (let { x, y, commit, branches, active } of graph.nodes) {
      const selected = prevSelectedCommit && prevSelectedCommit.hash === commit.hash;
      this.addNode(x, y, commit, branches, selected, active);
      if (selected) {
        this.selectedCommit = commit;
        this.selectedBranch = branches[0] || null;
      }
    }
    for (let { x1, y1, x2, y2 } of graph.edges) {
      this.addEdge(x1, y1, x2, y2);
    }
    if (this.submorphs.length > 0) {
      this.addLoadMoreButton();
    }
  }

  selectCommit (node) {
    // CommitNode -> ()
    this.selectedCommit = node.commit;
    this.selectedBranch = node.branches[0] || null;
    this.update().then(() => signal(this, 'selection', node.commit));
  }
}

export default class VersionControl extends Window {
  constructor (props) {
    super({
      name: 'VersionControl',
      extent: pt(850, 600),
      ...props,
      targetMorph: this.content()
    });
    this.reset();
    this.updatePackageList();
    connect(this.get('packageList'), 'selection', this, 'updateCommitTree');
    connect(this.get('commitTree'), 'selection', this, 'updateCommitPanel');
    connect(this.get('allChkBox'), 'checked', this, 'toggleShowChanges');
    connect(this.get('changedChkBox'), 'checked', this, 'toggleShowChanges');
    connect(this.get('fileList'), 'selection', this, 'updateEditor');
    connect(this.get('loadBtn'), 'fire', this, 'loadCommit');
    connect(this.get('commitBtn'), 'fire', this, 'createCommit');
    connect(this.get('branchBtn'), 'fire', this, 'createBranch');
    connect(this.get('pushBtn'), 'fire', this, 'pushBranch');
    connect(this.get('pullBtn'), 'fire', this, 'pullBranch');
    connect(this.get('configBtn'), 'fire', this, 'config');
    this.subscribe(true);
  }

  content () {
    let style = { fill: Color.rgb(243, 243, 243), borderWidth: 6, borderColor: Color.rgb(243, 243, 243), borderRadius: 6 };
    const m = morph({
      fill: Color.white,
      layout: new GridLayoutWithPadding(
        [['packageList', 'commitTree'],
          ['filePanel', 'commitPanel'],
          ['fileList', 'sourceEditor']]),
      submorphs: [
        { name: 'packageList', type: 'list', ...style },
        { name: 'commitTree', type: CommitTree, ...style },
        this.filePanel(style),
        this.commitPanel(style),
        { name: 'fileList', type: 'list', ...style },
        { name: 'sourceEditor', type: CodeEditor }
      ]
    });
    m.layout.setupPadding(6);
    m.layout.col(1).fixed = 180;
    m.layout.row(3).fixed = 24;
    return m;
  }

  filePanel (style) {
    const labelStyle = { fontSize: 11 };
    return morph({
      name: 'filePanel',
      layout: new HorizontalLayout({ spacing: 6 }),
      submorphs: [
        { type: 'text', textString: 'show:', ...labelStyle },
        part(Checkbox, { name: 'allChkBox', viewModel: { checked: true } }),
        { type: 'text', textString: 'all', ...labelStyle },
        part(Checkbox, { name: 'changedChkBox', viewModel: { checked: true } }),
        { type: 'text', textString: 'changed', ...labelStyle }
      ]
    });
  }

  commitPanel (style) {
    const btnStyle = { fontSize: 11, borderRadius: 0, extent: pt(40, 20) };
    return morph({
      name: 'commitPanel',
      layout: new HorizontalLayout({ spacing: 6 }),
      submorphs: [
        { type: 'button', label: 'load', name: 'loadBtn', ...btnStyle },
        { type: 'button', label: 'commit', name: 'commitBtn', ...btnStyle },
        { type: 'button', label: 'branch', name: 'branchBtn', ...btnStyle },
        { type: 'button', label: 'push', name: 'pushBtn', ...btnStyle },
        { type: 'button', label: 'pull', name: 'pullBtn', ...btnStyle },
        { type: 'button', label: 'config', name: 'configBtn', ...btnStyle }
      ]
    });
  }

  reset () {
    this.subscribe(false);
    this.showChanges = true;
    this.get('packageList').items = [];
    this.get('fileList').items = [];
    this.get('sourceEditor').textString = '';
  }

  toggleShowChanges () {
    this.showChanges = !this.showChanges;
    this.get('allChkBox').checked = !this.showChanges;
    this.get('changedChkBox').checked = this.showChanges;
    return this.updateFileList();
  }

  loadCommit () {
    const selectedCommit = this.get('commitTree').selectedCommit;
    if (!selectedCommit) return;
    return selectedCommit.activate();
  }

  async createCommit () {
    const selectedBranch = this.get('commitTree').selectedBranch;
    if (!selectedBranch) return;
    const message = await this.world().prompt('Enter commit message', {
      historyId: 'ChangeSorter/message',
      useLastInput: false
    });
    return selectedBranch.commitChanges(message);
  }

  async createBranch () {
    const pkg = this.get('packageList').selection;
    const selectedCommit = this.get('commitTree').selectedCommit;
    if (!pkg || !selectedCommit) return;
    const branchName = await this.world().prompt('Enter branch name', {
      historyId: 'ChangeSorter/branch',
      useLastInput: false
    });
    const b = await branch(pkg.address, branchName);
    return b.createFrom(selectedCommit);
  }

  async config () {
    const name = await this.world().prompt('Enter author name for commits', {
      input: getAuthor().name,
      historyId: 'ChangeSorter/name',
      useLastInput: false
    });
    const email = await this.world().prompt('Enter author email for commits', {
      input: getAuthor().email,
      historyId: 'ChangeSorter/email',
      useLastInput: false
    });
    return setAuthor({ name, email });
  }

  async enableGitHub () {
    let token = getGitHubToken();
    if (token !== '<secret>') return;
    token = await this.world().prompt(
      'Please enter your Personal Access Token for interacting with GitHub', {
        historyId: 'lively.changesets/github-access-token',
        useLastInput: true
      });
    setGitHubToken(token);
  }

  pushBranch () {
    const selectedBranch = this.get('commitTree').selectedBranch;
    if (!selectedBranch) return;
    return this.enableGitHub().then(() => selectedBranch.pushToGitHub());
  }

  async pullBranch () {
    const pkg = this.get('packageList').selection;
    if (!pkg) return;
    await this.enableGitHub();
    const branches = await gitHubBranches(pkg.address);
    const { selected: [branchName] } = await this.world().filterableListPrompt(
      'Pull branch from GitHub',
      branches.map(branch => branch.name));
    const b = await branch(pkg.address, branchName);
    return b.pullFromGitHub();
  }

  updatePackageList () {
    this.get('packageList').items = localInterface.getPackages().map(p =>
      ({ isListItem: true, string: p.name, value: p }));
    return this.updateCommitTree();
  }

  updateCommitTree () {
    const pkg = this.get('packageList').selection || null;
    return this.get('commitTree').update(pkg && pkg.address)
      .then(() => this.updateCommitPanel());
  }

  async updateCommitPanel () {
    const selectedCommit = this.get('commitTree').selectedCommit;
    const selectedBranch = this.get('commitTree').selectedBranch;
    this.get('loadBtn').active = !!selectedCommit;
    this.get('commitBtn').active = !!selectedBranch;
    this.get('branchBtn').active = !!selectedCommit;
    this.get('pushBtn').active = !!selectedBranch;
    this.get('pullBtn').active = !!this.get('packageList').selection;
    return this.updateFileList();
  }

  async updateFileList () {
    const fileList = this.get('fileList');
    const selectedCommit = this.get('commitTree').selectedCommit;
    let files;
    if (!selectedCommit) {
      files = {};
    } else if (this.showChanges) {
      files = await selectedCommit.changedFiles();
    } else {
      files = await selectedCommit.files();
    }
    // FIXME work-around b/c list doesn't preserve selection when updating items
    const prevSelected = fileList.selection;
    fileList.items = Object.keys(files).map(fname => ({
      isListItem: true,
      string: fname,
      value: fname
    }));
    fileList.selection = fileList.items.find(i => i.value === prevSelected);
    return this.updateEditor();
  }

  async updateEditor () {
    const editor = this.get('sourceEditor');
    const selectedCommit = this.get('commitTree').selectedCommit;
    const selectedFile = this.get('fileList').selection;
    let content;
    if (!selectedCommit || !selectedFile) {
      content = '';
    } else if (this.showChanges) {
      content = await selectedCommit.diffFile(selectedFile);
    } else {
      content = await selectedCommit.getFileContent(selectedFile);
    }
    editor.textString = content;
    editor.mode = this.showChanges ? 'diff' : 'javascript';
  }

  subscribe (sub) {
    if (!this._update) {
      this._update = this.updatePackageList.bind(this);
    }
    unsubscribe('lively.changesets/branchadded', this._update);
    unsubscribe('lively.changesets/branchdeleted', this._update);
    unsubscribe('lively.changesets/branchpushed', this._update);
    unsubscribe('lively.changesets/branchpulled', this._update);
    unsubscribe('lively.changesets/activated', this._update);
    unsubscribe('lively.changesets/deactivated', this._update);
    unsubscribe('lively.changesets/changed', this._update);
    unsubscribe('lively.modules/packageregistered', this._update);
    unsubscribe('lively.modules/packageremoved', this._update);
    if (sub) {
      subscribe('lively.changesets/branchadded', this._update);
      subscribe('lively.changesets/branchdeleted', this._update);
      subscribe('lively.changesets/branchpushed', this._update);
      subscribe('lively.changesets/branchpulled', this._update);
      subscribe('lively.changesets/activated', this._update);
      subscribe('lively.changesets/deactivated', this._update);
      subscribe('lively.changesets/changed', this._update);
      subscribe('lively.modules/packageregistered', this._update);
      subscribe('lively.modules/packageremoved', this._update);
    }
  }
}
