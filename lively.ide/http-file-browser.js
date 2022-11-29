/* global System */
import { Morph, Image, Label, InputLine } from 'lively.morphic';
import { Tree, TreeData } from 'lively.components';
import { arr, fun, promise, num, date, string } from 'lively.lang';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { resource } from 'lively.resources';
import TextEditor from './text-editor.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// this.world().openInWindow(HTTPFileBrowser.forLocation(document.location.origin)).activate()

let browserCommands = [

  {
    name: 'open selected file',
    exec: (browser, opts = { openInNewBrowser: false }) => {
      // Allow "Enter" inside location input
      if (browser.ui.locationInput.isFocused()) return false;

      let sel = browser.selectedFile;
      if (!sel) {
        browser.setStatusMessage('No file selected');
      } else if (opts.openInNewBrowser) {
        let viewState = browser.ui.fileTree.buildViewState(({ resource: { url } }) => url);
        let newBrowser = HTTPFileBrowser.forFile(browser.selectedFile, browser.location);
        let position = browser.getWindow().position.addXY(10, 10);
        browser.world().openInWindow(newBrowser, { position }).activate();
        return newBrowser.whenFinishedLoading()
          .then(() => newBrowser.ui.fileTree.applyViewState(viewState, ({ resource: { url } }) => url))
          .then(() => newBrowser);
      } else if (sel.isDirectory()) {
        browser.execCommand('set location to selection');
      } else if (sel.url.endsWith('.svg') || sel.url.endsWith('.png')) {
        let image = new Image({ name: sel.url, imageUrl: sel.url });
        image.openInWorld();
      } else {
        let editor = TextEditor.openURL(sel.url, { extent: pt(600, 800) });
        setTimeout(() => editor.getWindow().activate(), 100);
      }
      return true;
    }
  },

  {
    name: 'focus file tree',
    exec: browser => {
      let it = browser.ui.fileTree;
      it.show(); it.focus();
      return true;
    }
  },

  {
    name: 'focus location input',
    exec: browser => {
      let it = browser.ui.locationInput;
      it.show(); it.focus();
      return true;
    }
  },

  {
    name: 'set location to selection',
    exec: async browser => {
      let sel = browser.selectedFile;
      sel && await browser.keepFileTreeStateWhile(() =>
        browser.location = sel.isDirectory() ? sel : sel.parent());
      return true;
    }
  },

  {
    name: 'set location to parent dir',
    exec: async browser => {
      let currentLoc = browser.location;
      if (currentLoc.isRoot()) return true;
      await browser.keepFileTreeStateWhile(async () => {
        await browser.openLocation(currentLoc.parent());
        browser.selectedFile = currentLoc;
        await browser.ui.fileTree.execCommand('uncollapse selected node');
      });
      return true;
    }
  },

  {
    name: 'copy file path to clipboard',
    exec: async browser => {
      if (browser.ui.locationInput.isFocused()) return false;

      if (browser.selectedFile) {
        let fnText = browser.get('selectedFileName');
        browser.env.eventDispatcher.doCopy(fnText.textString);
        fnText.fontColor = Color.rgb(52, 152, 219);
        await fnText.animate({
          customTween: p => fnText.fontColor = Color.rgb(52, 152, 219).interpolate(p, Color.black)
        });
      }
      return true;
    }
  },

  {
    name: 'refresh contents',
    exec: (browser, args, count, evt) => {
      // FIXME preserve scroll and expansion state
      // FIXME!
      if (evt && evt.keyCombo === 'input-g' && browser.ui.locationInput.isFocused()) return false;

      return (async () => {
        let scroll = browser.ui.fileTree.scroll;
        await browser.keepFileTreeStateWhile(() => browser.location = browser.location);
        browser.ui.fileTree.scroll = scroll;
        return true;
      })();
    }
  },

  {
    name: 'set file filter',
    exec: async browser => {
      browser.excludeFiles = browser.excludeFiles || [];
      let { list: excludeList } = await browser.world().editListPrompt('Add or remove items to be excluded from the file list', browser.excludeFiles, {
        requester: browser
      });
      if (excludeList) {
        browser.excludeFiles = excludeList;
        await browser.execCommand('refresh contents');
      }
      return true;
    }
  },

  {
    name: 'add directory',
    exec: async browser => {
      let loc = browser.selectedFile || browser.location;
      if (!loc.isDirectory()) loc = loc.parent();
      let newDir = await browser.world().prompt('Enter name of new directory:', {
        input: loc.url,
        requester: browser,
        historyId: 'lively.ide/http-file-browser-file-name-query'
      });
      if (!newDir) {
        browser.world().inform('Add directory canceled', { requester: browser });
      } else {
        let res = resource(newDir);
        if (!res.isDirectory()) res = res.asDirectory();
        await res.ensureExistance();
        await browser.execCommand('refresh contents');
        browser.selectedFile = res;
      }

      return true;
    }
  },

  {
    name: 'add file',
    exec: async browser => {
      let loc = browser.selectedFile || browser.location;
      if (!loc.isDirectory()) loc = loc.parent();
      let newFile = await browser.world().prompt('Enter name of new file:', {
        input: loc.url,
        requester: browser,
        historyId: 'lively.ide/http-file-browser-file-name-query'
      });
      if (!newFile) {
        browser.world().inform('Add file canceled', { requester: browser });
      } else {
        let res = resource(newFile);
        if (res.isDirectory()) res = res.asFile();
        await res.ensureExistance('');
        await browser.execCommand('refresh contents');
        browser.selectedFile = res;
      }

      return true;
    }
  },

  {
    name: 'delete file or directory',
    exec: browser => {
      if (browser.ui.locationInput.isFocused()) return false;

      if (!browser.selectedFile) {
        browser.setStatusMessage('Nothing selected');
        return true;
      }

      return (async () => {
        let really = await browser.world().confirm(
          ['Confirm Delete\n', {}, 'Do you really want to remove\n', { fontWeight: 'normal', fontSize: 16 },
           `${browser.selectedFile.url}?`, { fontStyle: 'italic', fontWeight: 'normal', fontSize: 16 }], {
            requester: browser,
            lineWrapping: false
          });
        if (really) {
          let res = browser.selectedFile;
          let i = browser.ui.fileTree.selectedIndex;
          await res.remove();
          await browser.execCommand('refresh contents');
          await browser.whenFinishedLoading();
          browser.ui.fileTree.selectedIndex = i;
        } else {
          browser.world().inform('Delete canceled', { requester: browser });
        }
      })();
    }
  },

  {
    name: 'rename file',
    exec: browser => {
      if (!browser.selectedFile) {
        browser.setStatusMessage('Nothing selected');
        return true;
      }

      return (async () => {
        let newName = await browser.world().prompt(['Rename\n', {}, `${browser.selectedFile.url}`, {
          fontStyle: 'italic', fontWeight: 'normal', fontSize: 16
        }], {
          input: browser.selectedFile.url,
          requester: browser,
          historyId: 'lively.ide/http-file-browser-file-name-query'
        });
        if (!newName) {
          browser.world().inform('Rename canceled', { requester: browser });
          return true;
        }

        let res = browser.selectedFile;
        let newRes = resource(newName);
        if (res.isDirectory()) {
          if (!newRes.isDirectory()) newRes = newRes.asDirectory();
          await newRes.ensureExistance();
        } else {
          let content = await res.read();
          if (newRes.isDirectory()) newRes = newRes.asFile();
          await newRes.ensureExistance(content);
        }
        await res.remove();
        await browser.execCommand('refresh contents');

        // var location = resource("http://localhost:9001/node_modules/lively.lang/lib/")
        // var res = resource("http://localhost:9001/node_modules/lively.lang/lib/sore.js")
        // var newRes = resource("http://localhost:9001/node_modules/lively.lang/sore.js")
        let location = browser.location;
        if (!location.isParentOf(newRes)) {
          await browser.keepFileTreeStateWhile(async () =>
            await browser.openLocation(location.commonDirectory(newRes)));
        }

        try {
          await browser.gotoFile(newRes);
          browser.ui.fileTree.centerSelection();
        } catch (e) {
          browser.showError(e);
          return true;
        }
      })();
    }
  },

  {
    name: 'find file and select',
    handlesCount: true,
    exec: async (browser, _, count) => {
      let opts = { exclude: browser.excludeFiles || [] };
      let loc = browser.location;
      let items = (await loc.dirList(count || 'infinity', opts)).map(ea => ({
        isListItem: true,
        string: ea.url.slice(loc.url.length),
        value: ea.url
      }));
      let { selected: [targetURL] } = await browser.world().filterableListPrompt(
        'Choose module to open', items, {
          historyId: 'lively.ide/http-file-browser-find-file',
          requester: browser,
          width: 700,
          multiSelect: false
        });

      if (!targetURL) {
        browser.setStatusMessage('Canceled');
        return true;
      }

      try {
        await browser.gotoFile(targetURL);
        browser.ui.fileTree.centerSelection();
      } catch (e) {
        browser.showError(e);
        return true;
      }
    }
  }

];

export class HTTPFileBrowserNode extends TreeData {
  display ({ resource }) {
    let col1Size = 19; let col2Size = 8;
    let browser = this.root.browser;
    let { lastModified, size } = resource;
    let datePrinted = lastModified
      ? date.format(lastModified, 'yyyy-mm-dd HH:MM:ss')
      : ' '.repeat(col1Size);
    let sizePrinted = size ? num.humanReadableByteSize(size) : '';
    let displayedName = browser.truncateNameIfNeeded(resource.name());

    return [
      displayedName, null,
      `\t${sizePrinted} ${datePrinted}`, {
        paddingTop: '3px',
        opacity: 0.5,
        fontSize: '70%',
        textStyleClasses: ['annotation']
      }
    ];
  }

  isCollapsed ({ isCollapsed }) { return isCollapsed; }

  async collapse (node, bool) {
    if (!node.resource) return;
    if (node === this.root) bool = false;
    if (!bool && !node.subResources) {
      let exclude = this.root.browser.excludeFiles || [];
      let [dirs, files] = arr.partition(await node.resource.dirList(1, { exclude }), ea => ea.isDirectory());
      dirs = arr.sortBy(dirs, ea => ea.name().toLowerCase());
      files = arr.sortBy(files, ea => ea.name().toLowerCase());
      node.subNodes = dirs.concat(files).map(res => ({ isCollapsed: true, resource: res }));
    }
    node.isCollapsed = bool;
  }

  getChildren (parent) {
    let { resource, isCollapsed, subNodes } = parent;
    let result = !resource ? [] : !resource.isDirectory() ? null : isCollapsed ? [] : subNodes || [];
    // cache for faster parent lookup
    result && result.forEach(n => this.parentMap.set(n, parent));
    return result;
  }

  isLeaf ({ resource }) { return resource ? !resource.isDirectory() : true; }
}


export default class HTTPFileBrowser extends Morph {
  static forLocation (urlOrResource, props) {
    const browser = new this(props);
    browser.location = urlOrResource;
    return browser;
  }

  static forFile (urlOrResource, location) {
    let res;
    try { res = resource(urlOrResource); } catch (e) {
      res = resource(string.joinPath(location || '', urlOrResource));
    }
    const browser = this.forLocation(location || res.root());
    browser.gotoFile(res)
      .then(() => browser.ui.fileTree.centerSelection());
    return browser;
  }

  static get properties () {
    return {
      name: { defaultValue: 'file browser' },
      clipMode: { defaultValue: 'visible' },
      extent: { defaultValue: pt(500, 500) },
      excludeFiles: { defaultValue: ['.git', '.DS_Store'] },
      draggable: { defaultValue: false },

      submorphs: {
        initialize () {
          const btnStyle = {
            type: 'button',
            borderRadius: 5,
            padding: Rectangle.inset(0),
            fontSize: 12,
            grabbable: false,
            draggable: false
          };

          this.submorphs = [
            new Tree({
              name: 'fileTree',
              treeData: new HTTPFileBrowserNode({
                browser: this,
                resource: null,
                isCollapsed: true
              }),
              extent: this.extent,
              lineHeight: 1.6,
              fontSize: 14,
              activateOnHover: false,
              clipMode: 'auto',
              resizeNodes: true/* for right align size + date */,
              fill: Color.white,
              borderWidth: { top: 1, bottom: 1, right: 0, left: 0 },
              borderColor: Color.gray,
              padding: Rectangle.inset(4)
            }),

            new InputLine({
              name: 'locationInput',
              textString: '',
              historyId: 'http-file-browser-location-input-history',
              padding: Rectangle.inset(4, 2)
            }),

            {
              type: 'label',
              name: 'selectedFileName',
              padding: Rectangle.inset(2, 2),
              fontSize: 14,
              fontFamily: 'Inconsolata, monospace',
              readOnly: true,
              clipMode: 'hidden',
              nativeCursor: 'pointer',
              tooltip: 'click to copy',
              fontWeight: 'bold'
            },

            { name: 'searchButton', ...btnStyle, label: Label.icon('search'), tooltip: 'search for files' },
            { name: 'reloadButton', ...btnStyle, label: Label.icon('redo'), tooltip: 'reload list' },
            { name: 'filterButton', ...btnStyle, label: Label.icon('filter'), tooltip: 'set file filter' },
            { name: 'openFileButton', ...btnStyle, label: Label.icon('edit', { textStyleClasses: ['far'] }), tooltip: 'open selected file' },
            { name: 'addDirectoryButton', ...btnStyle, label: Label.icon('folder', { textStyleClasses: ['far'] }), tooltip: 'add directory' },
            { name: 'addFileButton', ...btnStyle, label: Label.icon('file', { textStyleClasses: ['far'] }), tooltip: 'add file' },
            { name: 'renameFileButton', ...btnStyle, label: Label.icon('clone', { textStyleClasses: ['far'] }), tooltip: 'rename selected file' },
            { name: 'deleteFileButton', ...btnStyle, label: Label.icon('trash-alt', { textStyleClasses: ['far'] }), tooltip: 'delete selected file' }
          ];

          const {
            fileTree,
            locationInput,
            searchButton,
            reloadButton,
            filterButton,
            openFileButton,
            addDirectoryButton,
            addFileButton,
            renameFileButton,
            deleteFileButton,
            selectedFileName
          } = this.ui;

          connect(this, 'extent', this, 'relayout');
          connect(locationInput, 'inputAccepted', this, 'onLocationChanged');
          connect(fileTree, 'selectedNode', this, 'showSelectedFile');
          connect(fileTree, 'contextMenuRequested', this, 'showMenuFor');

          connect(searchButton, 'fire', this, 'execCommand', { converter: () => 'find file and select' });
          connect(reloadButton, 'fire', this, 'execCommand', { converter: () => 'refresh contents' });
          connect(filterButton, 'fire', this, 'execCommand', { converter: () => 'set file filter' });
          connect(openFileButton, 'fire', this, 'execCommand', { converter: () => 'open selected file' });
          connect(renameFileButton, 'fire', this, 'execCommand', { converter: () => 'rename file' });
          connect(deleteFileButton, 'fire', this, 'execCommand', { converter: () => 'delete file or directory' });
          connect(addFileButton, 'fire', this, 'execCommand', { converter: () => 'add file' });
          connect(addDirectoryButton, 'fire', this, 'execCommand', { converter: () => 'add directory' });
          connect(selectedFileName, 'onMouseDown', this, 'execCommand', { converter: () => 'copy file path to clipboard' });
          connect(this, 'onMouseMove', this, 'hideBaseURL');

          this.onLocationChanged();
          this.relayout();
        }

      },

      ui: {
        derived: true,
        readOnly: true,
        after: ['submorphs'],
        get () {
          return {
            fileTree: this.getSubmorphNamed('fileTree'),
            locationInput: this.getSubmorphNamed('locationInput'),
            searchButton: this.getSubmorphNamed('searchButton'),
            reloadButton: this.getSubmorphNamed('reloadButton'),
            filterButton: this.getSubmorphNamed('filterButton'),
            openFileButton: this.getSubmorphNamed('openFileButton'),
            addDirectoryButton: this.getSubmorphNamed('addDirectoryButton'),
            addFileButton: this.getSubmorphNamed('addFileButton'),
            renameFileButton: this.getSubmorphNamed('renameFileButton'),
            deleteFileButton: this.getSubmorphNamed('deleteFileButton'),
            selectedFileName: this.getSubmorphNamed('selectedFileName')
          };
        }
      },

      location: {
        derived: true,
        after: ['submorphs'],
        get () {
          return resource(this.ui.locationInput.input);
        },
        set (urlOrResource) {
          this._isLoading = true;
          let res = typeof urlOrResource === 'string'
            ? resource(urlOrResource)
            : urlOrResource;
          if (!res.isDirectory()) res = res.asDirectory();
          this.ui.locationInput.input = res.url;
          this.ui.locationInput.acceptInput();
        }
      },

      selectedFile: {
        derived: true,
        after: ['submorphs'],
        get () {
          const sel = this.ui.fileTree.selectedNode;
          return sel ? sel.resource : null;
        },
        set (urlOrResource) {
          if (!urlOrResource) {
            this.ui.fileTree.selectedNode = null;
          } else {
            const res = typeof urlOrResource === 'string'
              ? resource(urlOrResource)
              : urlOrResource;
            const node = this.ui.fileTree.nodes.find(({ resource }) => resource.url === res.url);
            this.ui.fileTree.selectedNode = node;
          }
          this.ui.fileTree.focus();
        }
      },

      treeState: {
        derived: true,
        after: ['submorphs'],
        get () {
          return this.ui.fileTree.buildViewState(resource => resource.url);
        },
        set (viewState) {
          this.ui.fileTree.applyViewState(viewState, resource => resource.url);
        }
      }
    };
  }

  get isFileBrowser () { return true; }

  relayout () {
    if (this.height <= 0) return;

    const {
      selectedFileName,
      deleteFileButton,
      renameFileButton,
      addFileButton,
      addDirectoryButton,
      openFileButton,
      filterButton,
      reloadButton,
      searchButton,
      locationInput,
      fileTree
    } = this.ui;
    const topButtons = [searchButton,
      filterButton,
      reloadButton];
    const bottomButtons = [openFileButton,
      addFileButton,
      addDirectoryButton,
      renameFileButton,
      deleteFileButton];
    const nButtons = 5;
    const locationInputHeight = 20;
    const selectedFileNameHeight = 20;
    const buttonHeight = 20;

    locationInput.position = pt(0, 0);
    locationInput.extent = pt(this.width - 3 * buttonHeight, locationInputHeight);

    topButtons.forEach(btn => btn.extent = pt(buttonHeight, buttonHeight));
    topButtons[0].topLeft = locationInput.topRight;
    for (var i = 1; i < topButtons.length; i++) { topButtons[i].topLeft = topButtons[i - 1].topRight; }

    fileTree.topLeft = locationInput.bottomLeft;
    fileTree.extent = pt(this.width, this.height - locationInputHeight - selectedFileNameHeight - buttonHeight);
    selectedFileName.topLeft = fileTree.bottomLeft;
    selectedFileName.extent = pt(this.width, selectedFileNameHeight);

    bottomButtons.forEach(btn => btn.extent = pt(this.width / nButtons, buttonHeight));
    bottomButtons[0].topLeft = selectedFileName.bottomLeft;
    for (var i = 1; i < bottomButtons.length; i++) { bottomButtons[i].topLeft = bottomButtons[i - 1].topRight; }
  }

  truncateNameIfNeeded (displayedName) {
    const ft = this.ui.fileTree;
    let renderedLength = ft.env.fontMetric.sizeFor(ft.defaultTextStyle, displayedName, true).width;
    if (renderedLength > ft.width - 200) {
      let avgCharLength = renderedLength / displayedName.length;
      let charsToRemove = (renderedLength - (ft.width - 200)) / avgCharLength;
      if (charsToRemove >= 1) displayedName = displayedName.slice(0, -charsToRemove) + '...';
    }
    return displayedName;
  }

  whenFinishedLoading () {
    return promise.waitFor(3000, () => this._isLoading === false).catch(_ => undefined);
  }

  hideBaseURL (evt) {
    const fnText = this.ui.selectedFileName;
    if (evt.isShiftDown()) {
      fnText.textString = fnText.textString.replace(System.baseURL, '/');
    } else {
      this.showSelectedFile();
    }
  }

  openLocation (urlOrResource) {
    const res = typeof urlOrResource === 'string'
      ? resource(urlOrResource)
      : urlOrResource;
    const { locationInput } = this.ui;
    locationInput.input = res.url;
    locationInput.acceptInput();
    return this;
  }

  async showMenuFor ({ node, evt }) {
    evt.stop();
    const items = [];
    if (node.resource.isFile()) {
      items.push({
        alias: 'Open File in Text Editor',
        command: 'open file',
        target: this.world(),
        args: {
          url: node.resource.url
        }
      });
    }
    return this.world().openWorldMenu(evt, items);
  }

  showSelectedFile () {
    const sel = this.selectedFile;
    this.get('selectedFileName').textString = sel ? sel.url : '';
  }

  async gotoFile (urlOrResource) {
    await this.whenFinishedLoading();
    const target = typeof urlOrResource === 'string'
      ? resource(urlOrResource)
      : urlOrResource;
    const path = target.parents().concat(target);
    const td = this.ui.fileTree.treeData;
    const found = await td.followPath(path, (resource, node) => resource.equals(node.resource));
    return found ? this.selectedFile = found.resource : null;
  }

  async onLocationChanged () {
    const treeData = this.ui.fileTree.treeData;
    const url = this.ui.locationInput.input;
    if (!url) { this._isLoading = false; return; }
    let loc = resource(url);
    if (!loc.isDirectory()) loc = loc.asDirectory();
    treeData.root = {
      browser: this,
      resource: loc,
      isCollapsed: true
    };
    const win = this.getWindow();
    if (win) win.title = 'file browser – ' + url;
    await this.ui.fileTree.uncollapse(treeData.root);
    this._isLoading = false;
    this.ui.fileTree.focus();
  }

  keepFileTreeStateWhile (whileFn) {
    return this.ui.fileTree.maintainViewStateWhile(() =>
      whileFn.call(this),
    ({ resource: { url } }) => url);
  }

  focus () { this.ui.fileTree.focus(); }

  get commands () { return browserCommands.concat(super.commands); }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'open selected file' },
      { keys: { mac: 'Meta-Enter', win: 'Ctrl-Enter' }, command: { command: 'open selected file', args: { openInNewBrowser: true } } },
      { keys: 'Alt-Up', command: 'focus location input' },
      { keys: 'Alt-Down', command: 'focus file tree' },
      { keys: 'Alt-.', command: 'set location to selection' },
      { keys: 'Shift-6'/* ^ */, command: 'set location to parent dir' },
      { keys: { mac: 'Meta-C|Alt-W', win: 'Ctrl-C|Alt-W' }, command: 'copy file path to clipboard' },
      { keys: 'Shift-=', command: 'add directory' },
      { keys: { mac: 'Meta-Shift-=', win: 'Ctrl-Shift-=' }, command: 'add file' },
      { keys: 'F2', command: 'set file filter' },
      { keys: 'F3', command: 'rename file' },
      { keys: 'Backspace|Delete', command: 'delete file or directory' },
      { keys: 'g', command: 'refresh contents' }
    ].concat(super.keybindings);
  }
}
