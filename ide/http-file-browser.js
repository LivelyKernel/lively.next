import { show, Window, Morph, Label, Text } from "lively.morphic"
import { Tree, TreeData } from "lively.morphic/tree.js"
import TextEditor from "lively.morphic/ide/text-editor.js"

import { arr, fun, promise, num, date, string } from "lively.lang"

import { pt, Rectangle, rect, Color } from "lively.graphics"
import { connect, signal, once } from "lively.bindings"

import { resource } from "lively.resources";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// this.world().openInWindow(HTTPFileBrowser.forLocation(document.location.origin)).activate()

var browserCommands = [

  {
    name: "open selected file",
    exec: browser => {
      // Allow "Enter" inside location input
      if (browser.locationInput.isFocused()) return false;

      var sel = browser.selectedFile;
      if (!sel) {
        browser.setStatusMessage("No file selected");
      } else  if (sel.isDirectory()) {
        browser.execCommand("set location to selection");
      } else {
        var editor = TextEditor.openURL(sel.url, {extent: pt(600,800)});
        setTimeout(() => editor.activate(), 100);
      }
      return true;
    }
  },

  {
    name: "focus file tree",
    exec: browser => {
      var it = browser.fileTree;
      it.show(); it.focus();
      return true;
    }
  },

  {
    name: "focus location input",
    exec: browser => {
      var it = browser.locationInput;
      it.show(); it.focus();
      return true;
    }
  },

  {
    name: "set location to selection",
    exec: async browser => {
      var sel = browser.selectedFile;
      sel && await browser.keepFileTreeStateWhile(() =>
        browser.location = sel.isDirectory() ? sel : sel.parent());
      return true;
    }
  },

  {
    name: "set location to parent dir",
    exec: async browser => {
      var currentLoc = browser.location;
      if (currentLoc.isRoot()) return true;
      await browser.keepFileTreeStateWhile(async () => {
        await browser.openLocation(currentLoc.parent())
        browser.selectedFile = currentLoc;
        await browser.fileTree.execCommand("uncollapse selected node");
      });
      return true;
    }
  },

  {
    name: "copy file path to clipboard",
    exec: browser => {
      if (browser.locationInput.isFocused()) return false;

      if (browser.selectedFile) {
        var fnText = browser.get("selectedFileName");
        fnText.selectAll()
        fnText.execCommand("manual clipboard copy");
      }
      return true;
    }
  },

  {
    name: "refresh contents",
    exec: (browser, args, count, evt) => {
      // FIXME preserve scroll and expansion state
      // FIXME!
      if (evt && evt.keyCombo === "input-g" && browser.locationInput.isFocused()) return false;

      return (async () => {
        var scroll = browser.fileTree.scroll;
        await browser.keepFileTreeStateWhile(() => browser.location = browser.location);
        browser.fileTree.scroll = scroll;
        return true;
      })();
    }
  },

  {
    name: "set file filter",
    exec: async browser => {
      browser.excludeFiles = browser.excludeFiles || [];
      var excludeList = await browser.world().editListPrompt("Add or remove items to be excluded from the file list", browser.excludeFiles);
      if (excludeList) {
        browser.excludeFiles = excludeList;
        await browser.execCommand("refresh contents");
      }
      return true;
    }
  },

  {
    name: "add directory",
    exec: async browser => {
      var loc = browser.selectedFile || browser.location;
      if (!loc.isDirectory()) loc = loc.parent();
      var newDir = await browser.world().prompt("Enter name of new directory", {
        input: loc.url,
        historyId: "lively.morphic/ide/http-file-browser-file-name-query"
      });
      if (!newDir) {
        browser.world().inform("add directory canceled");
      } else {
        var res = resource(newDir);
        if (!res.isDirectory()) res = res.asDirectory();
        await res.ensureExistance();
        await browser.execCommand("refresh contents");
        browser.selectedFile = res;
      }

      return true;
    }
  },

  {
    name: "add file",
    exec: async browser => {
      var loc = browser.selectedFile || browser.location;
      if (!loc.isDirectory()) loc = loc.parent();
      var newFile = await browser.world().prompt("Enter name of new file", {
        input: loc.url,
        historyId: "lively.morphic/ide/http-file-browser-file-name-query"
      });
      if (!newFile) {
        browser.world().inform("add file canceled");
      } else {
        var res = resource(newFile);
        if (res.isDirectory()) res = res.asFile()
        await res.ensureExistance("");
        await browser.execCommand("refresh contents");
        browser.selectedFile = res;
      }

      return true;
    }
  },

  {
    name: "delete file or directory",
    exec: browser => {
      if (browser.locationInput.isFocused()) return false;

      if (!browser.selectedFile) {
        browser.setStatusMessage("Nothing selected");
        return true;
      }

      return (async () => {
        var really = await browser.world().confirm(`Really delete ${browser.selectedFile.url}?`);
        if (really) {
          var res = browser.selectedFile,
              i = browser.fileTree.selectedIndex;
          await res.remove();
          await browser.execCommand("refresh contents");
          await browser.whenFinishedLoading()
          browser.fileTree.selectedIndex = i;
        } else {
          browser.world().inform("delete canceled");
        }
      })()
    }
  },

  {
    name: "rename file",
    exec: browser => {
      if (!browser.selectedFile) {
        browser.setStatusMessage("Nothing selected");
        return true;
      }

      return (async () => {
        var newName = await browser.world().prompt(`Rename ${browser.selectedFile.url} to`, {
          input: browser.selectedFile.url,
          historyId: "lively.morphic/ide/http-file-browser-file-name-query",
        });
        if (!newName) {
          browser.world().inform("rename canceled");
          return true;
        }

        var res = browser.selectedFile,
            newRes = resource(newName);
        if (res.isDirectory()) {
          if (!newRes.isDirectory()) newRes = newRes.asDirectory();
          await newRes.ensureExistance();
        } else {
          var content = await res.read();
          if (newRes.isDirectory()) newRes = newRes.asFile();
          await newRes.ensureExistance(content);
        }
        await res.remove();
        await browser.execCommand("refresh contents");

        // var location = resource("http://localhost:9001/node_modules/lively.lang/lib/")
        // var res = resource("http://localhost:9001/node_modules/lively.lang/lib/sore.js")
        // var newRes = resource("http://localhost:9001/node_modules/lively.lang/sore.js")
        var location = browser.location;
        if (!location.isParentOf(newRes))
          await browser.keepFileTreeStateWhile(async () =>
            await browser.openLocation(location.commonDirectory(newRes)));

        try {
          await browser.gotoFile(newRes);
          browser.fileTree.centerSelection();
        } catch (e) {
          browser.showError(e);
          return true;
        }

      })()
    }
  },

  {
    name: "find file and select",
    handlesCount: true,
    exec: async (browser, _, count) => {
      var exclude = {exclude: browser.excludeFiles || []},
          loc = browser.location,
          items = (await loc.dirList(count || 'infinity', {exclude})).map(ea => ({
            isListItem: true,
            string: ea.url.slice(loc.url.length),
            value: ea.url
          })),
          {selected: [targetURL]} = await browser.world().filterableListPrompt(
            "Choose module to open", items, {
              historyId: "lively.morphic/ide/http-file-browser-find-file",
              requester: browser, width: 700, multiSelect: false})

      if (!targetURL) {
        browser.setStatusMessage("Canceled");
        return true;
      }

      try {
        await browser.gotoFile(targetURL);
        browser.fileTree.centerSelection();
      } catch (e) {
        browser.showError(e);
        return true;
      }
    }
  },


]

export default class HTTPFileBrowser extends Morph {

  static forLocation(urlOrResource, props) {
    var browser = new this(props)
    browser.location = urlOrResource;
    return browser;
  }

  static forFile(urlOrResource, location) {
    var res;
    try { res = resource(urlOrResource); } catch (e) {
      res = resource(string.joinPath(location || "", urlOrResource)); }
    var browser = this.forLocation(location || res.root());
    browser.gotoFile(res)
      .then(() => browser.fileTree.centerSelection());
    return browser;
  }

  constructor(props = {}) {
    super({
      name: "file browser",
      clipMode: "visible",
      extent: pt(500,500),
      excludeFiles: [".git", ".DS_Store"],
      ...props
      });

    this.build();
  }

  get isFileBrowser() { return true; }

  get excludeFiles() { return this.getProperty("excludeFiles"); }
  set excludeFiles(c) { this.addValueChange("excludeFiles", c); }

  build() {
    this.removeAllMorphs();

    var browser = this;
    var treeData = new (class extends TreeData {
      display({resource}) {
        var col1Size = 19, col2Size = 8,
            {lastModified, size} = resource,
            datePrinted = lastModified ?
              date.format(lastModified, "yyyy-mm-dd HH:MM:ss") : " ".repeat(col1Size),
            sizePrinted = size ? num.humanReadableByteSize(size) : "",
            printed = `${string.pad(datePrinted, col1Size-datePrinted.length, true)} ${string.pad(sizePrinted, Math.max(0, col2Size-sizePrinted.length), true)} ${resource.name()}`
        return printed
      }
      isCollapsed({isCollapsed}) { return isCollapsed; }
      async collapse(node, bool) {
        if (!node.resource) return;
        if (node === this.root) bool = false;
        if (!bool && !node.subResources) {
          var exclude = browser.excludeFiles || [];
          var [dirs, files] = arr.partition(await node.resource.dirList(1, {exclude}), ea => ea.isDirectory())
          dirs = arr.sortBy(dirs, ea => ea.name().toLowerCase());
          files = arr.sortBy(files, ea => ea.name().toLowerCase());
          node.subNodes = dirs.concat(files).map(res => ({isCollapsed: true, resource: res}))
        }
        node.isCollapsed = bool;
      }
      getChildren(parent) {
        var {resource, isCollapsed, subNodes} = parent,
            result = !resource ? [] : !resource.isDirectory() ? null : isCollapsed ? [] : subNodes || [];
        // cache for faster parent lookup
        result && result.forEach(n => this.parentMap.set(n, parent));
        return result
      }
      isLeaf({resource}) { return resource ? !resource.isDirectory() : true }
    })({
      resource: null,
      isCollapsed: true,
    });

    var fileTree = this.addMorph(new Tree({
      name: "fileTree", treeData,
      fill: Color.white, border: {color: Color.gray, width: 1},
      padding: Rectangle.inset(4)
    }))

    var locationInput = this.addMorph(Text.makeInputLine({
      name: "locationInput", textString: "",
      historyId: "http-file-browser-location-input-history",
      padding: Rectangle.inset(4, 2)
    }));

    this.addMorph({
      type: "text", name: "selectedFileName",
      fontSize: 14, fontFamily: "Inconsolata, monospace",
      readOnly: true, clipMode: "hidden"
    });

    var btnStyle = {
      type: "button", borderRadius: 5, padding: Rectangle.inset(0),
      fontSize: 12, grabbable: false, draggable: false
    }

    var searchButton =       this.addMorph({name: "searchButton",       ...btnStyle, label: Label.icon("search"), tooltip: "search for files"}),
        reloadButton =       this.addMorph({name: "reloadButton",       ...btnStyle, label: Label.icon("refresh"), tooltip: "reload list"}),
        filterButton =       this.addMorph({name: "filterButton",       ...btnStyle, label: Label.icon("filter"), tooltip: "set file filter"}),
        openFileButton =     this.addMorph({name: "openFileButton",     ...btnStyle, label: Label.icon("pencil-square-o"), tooltip: "open selected file"}),
        addDirectoryButton = this.addMorph({name: "addDirectoryButton", ...btnStyle, label: Label.icon("folder-o"), tooltip: "add directory"}),
        addFileButton =      this.addMorph({name: "addFileButton",      ...btnStyle, label: Label.icon("file-o"), tooltip: "add file"}),
        renameFileButton =   this.addMorph({name: "renameFileButton",   ...btnStyle, label: Label.icon("clone"), tooltip: "rename selected file"}),
        deleteFileButton =   this.addMorph({name: "deleteFileButton",   ...btnStyle, label: Label.icon("trash-o"), tooltip: "delete selected file"});

    connect(this, 'extent', this, 'relayout');
    connect(locationInput, 'input', this, 'onLocationChanged');
    connect(fileTree, 'selection', this, 'showSelectedFile');

    connect(searchButton,       'fire', this, 'execCommand', {converter: () => "find file and select"});
    connect(reloadButton,       'fire', this, 'execCommand', {converter: () => "refresh contents"});
    connect(filterButton,       'fire', this, 'execCommand', {converter: () => "set file filter"});
    connect(openFileButton,     'fire', this, 'execCommand', {converter: () => "open selected file"});
    connect(renameFileButton,   "fire", this, "execCommand", {converter: () => "rename file"});
    connect(deleteFileButton,   "fire", this, "execCommand", {converter: () => "delete file or directory"});
    connect(addFileButton,      "fire", this, "execCommand", {converter: () => "add file"});
    connect(addDirectoryButton, "fire", this, "execCommand", {converter: () => "add directory"});

    this.onLocationChanged();
    this.relayout();
  }

  relayout() {
    var selectedFileName = this.get('selectedFileName'),
        fileTree =         this.get("fileTree"),
        locationInput =    this.get('locationInput'),
        searchButton =     this.get('searchButton'),
        topButtons =      [this.get("searchButton"),
                           this.get("filterButton"),
                           this.get("reloadButton")],
        bottomButtons =   [this.get("openFileButton"),
                           this.get("addFileButton"),
                           this.get("addDirectoryButton"),
                           this.get("renameFileButton"),
                           this.get("deleteFileButton")],
        nButtons = 5,
        locationInputHeight = 20,
        selectedFileNameHeight = 20,
        buttonHeight = 20;

    locationInput.position = pt(0,0);
    locationInput.extent = pt(this.width-3*buttonHeight, locationInputHeight);

    topButtons.forEach(btn => btn.extent = pt(buttonHeight, buttonHeight));
    topButtons[0].topLeft = locationInput.topRight;
    for (var i = 1; i < topButtons.length; i++)
      topButtons[i].topLeft = topButtons[i-1].topRight;

    fileTree.topLeft = locationInput.bottomLeft;
    fileTree.extent = pt(this.width, this.height - locationInputHeight - selectedFileNameHeight - buttonHeight)
    selectedFileName.topLeft = fileTree.bottomLeft;
    selectedFileName.extent = pt(this.width, selectedFileNameHeight);

    bottomButtons.forEach(btn => btn.extent = pt(this.width/nButtons, buttonHeight));
    bottomButtons[0].topLeft = selectedFileName.bottomLeft;
    for (var i = 1; i < bottomButtons.length; i++)
      bottomButtons[i].topLeft = bottomButtons[i-1].topRight;
  }

  get fileTree() { return this.get("fileTree"); }
  get locationInput() { return this.get("locationInput"); }

  whenFinishedLoading() {
    return promise.waitFor(3000, () => this._isLoading === false).catch(_ => undefined);
  }

  openLocation(urlOrResource) {
    var res = typeof urlOrResource === "string" ?
      resource(urlOrResource) : urlOrResource;
    this.locationInput.input = res.url;
    this.locationInput.acceptInput();
    return this;
  }

  get location() {
    return resource(this.locationInput.input);
  }
  set location(urlOrResource) {
    this._isLoading = true;
    var res = typeof urlOrResource === "string" ?
      resource(urlOrResource) : urlOrResource;
    if (!res.isDirectory()) res = res.asDirectory();
    this.locationInput.input = res.url;
    this.locationInput.acceptInput();
  }

  get selectedFile() {
    var sel = this.fileTree.selection;
    return sel ? sel.resource : null;
  }
  set selectedFile(urlOrResource) {
    if (!urlOrResource) {
      this.fileTree.selection = null;
    } else {
      var res = typeof urlOrResource === "string" ?
        resource(urlOrResource) : urlOrResource;
      var node = this.fileTree.nodes.find(({resource}) => resource.url === res.url)
      this.fileTree.selection = node;
    }
    this.fileTree.focus();
  }

  showSelectedFile() {
    var sel = this.selectedFile;
    this.get("selectedFileName").textString =  sel ? sel.url : "";
  }

  async gotoFile(urlOrResource) {
    await this.whenFinishedLoading();
    var target = typeof urlOrResource === "string" ?
          resource(urlOrResource) : urlOrResource,
        path = target.parents().concat(target),
        td = this.fileTree.treeData,
        found = await td.followPath(path, (resource, node) => resource.equals(node.resource));
    return found ? this.selectedFile = found.resource : null;
  }

  async onLocationChanged() {
    var treeData = this.fileTree.treeData,
        url = this.locationInput.input;
    if (!url) { this._isLoading = false; return; }
    var loc = resource(url);
    if (!loc.isDirectory()) loc = loc.asDirectory();
    treeData.root = {
      resource: loc,
      isCollapsed: true,
    }
    var win = this.getWindow();
    if (win) win.title = "file browser – " + url;
    await this.fileTree.onNodeCollapseChanged({node: treeData.root, isCollapsed: false});
    this._isLoading = false;
    this.fileTree.focus();
  }

  keepFileTreeStateWhile(whileFn) {
    return this.fileTree.maintainViewStateWhile(() =>
      whileFn.call(this),
      ({resource: {url}}) => url);
  }

  focus() {
    this.fileTree.focus();
  }

  get commands() {
    return browserCommands.concat(super.commands);
  }

  get keybindings() {
    return [
      {keys: "Enter", command: "open selected file"},
      {keys: "Alt-Up", command: "focus location input"},
      {keys: "Alt-Down", command: "focus file tree"},
      {keys: "Alt-.", command: "set location to selection"},
      {keys: "Shift-6"/*^*/, command: "set location to parent dir"},
      {keys: {mac: "Meta-C|Alt-W", win: "Ctrl-C|Alt-W"}, command: "copy file path to clipboard"},
      {keys: "Shift-=", command: "add directory"},
      {keys: {mac: "Meta-Shift-=", win: "Ctrl-Shift-="}, command: "add file"},
      {keys: "F2", command: "set file filter"},
      {keys: "F3", command: "rename file"},
      {keys: "Backspace|Delete", command: "delete file or directory"},
      {keys: "g", command: "refresh contents"}
    ].concat(super.keybindings);
  }
}
