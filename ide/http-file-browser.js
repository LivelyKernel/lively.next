import { show, Window, Morph, Text } from "lively.morphic"
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
      if (browser.get("locationInput").isFocused()) return false;

      var sel = browser.selectedFile;
      if (!sel) {
        browser.setStatusMessage("No file selected");
      } else  if (sel.isDirectory()) {
        browser.execCommand("set location to selection");
      } else {
        var editor = TextEditor.openURL(sel.url);
        setTimeout(() => editor.activate(), 100);
      }
      return true;
    }
  },

  {
    name: "focus file tree",
    exec: browser => {
      var it = browser.get("fileTree");
      it.show(); it.focus();
      return true;
    }
  },

  {
    name: "focus location input",
    exec: browser => {
      var it = browser.get("locationInput");
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
        browser.location = currentLoc.parent();
        await browser.whenFinishedLoading();
        browser.selectedFile = currentLoc;
        await browser.get("fileTree").execCommand("uncollapse selected node");
      });
      return true;
    }
  },

  {
    name: "copy file path to clipboard",
    exec: browser => {
      if (browser.get("locationInput").isFocused()) return false;

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
    exec: async browser => {
      // FIXME preserve scroll and expansion state
      var scroll = browser.get("fileTree").scroll;
      await browser.keepFileTreeStateWhile(() => browser.location = browser.location);
      browser.get("fileTree").scroll = scroll;
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
        historyId: "http-file-browser-new-directory-input-history"
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
        historyId: "http-file-browser-new-file-input-history"
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
      if (browser.get("locationInput").isFocused()) return false;

      if (!browser.selectedFile) {
        browser.setStatusMessage("Nothing selected");
        return true;
      }

      return (async () => {
        var really = await browser.world().confirm(`Really delete ${browser.selectedFile.url}?`);
        if (really) {
          var res = browser.selectedFile;
          await res.remove();
          await browser.execCommand("refresh contents");        
          browser.selectedFile = res.parent();
        } else {
          browser.world().inform("delete canceled");
        }
      })()
    }
  },

  {
    name: "find file and select",
    handlesCount: true,
    exec: async (browser, _, count) => {
      var exclude = [".git", "node_modules"],
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
        browser.fileTree.centerSelection()
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

  constructor(props = {}) {
    super({
      name: "file browser",
      clipMode: "auto",
      extent: pt(500,400),
      ...props
      });

    this.build();
  }

  build() {
    this.removeAllMorphs();

    var browser = this;
    var treeData = new (class extends TreeData {
      nameOfNode({resource}) {
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
          var [dirs, files] = arr.partition(await node.resource.dirList(1), ea => ea.isDirectory())
          dirs = arr.sortBy(dirs, ea => ea.name().toLowerCase());
          files = arr.sortBy(files, ea => ea.name().toLowerCase());
          node.subNodes = dirs.concat(files).map(res => ({isCollapsed: true, resource: res}))
        }
        node.isCollapsed = bool;
      }
      getChildren({resource, isCollapsed, subNodes}) {
        return !resource ? [] : !resource.isDirectory() ? null : isCollapsed ? [] : subNodes || [];
      }
      isLeaf({resource}) { return resource ? !resource.isDirectory() : true }
    })({
      resource: null,
      isCollapsed: true,
    })

    var tree = this.addMorph(new Tree({
      name: "fileTree", fill: Color.white, border: {color: Color.gray, width: 1}, padding: Rectangle.inset(4), treeData}))


    var locationInput = this.addMorph(Text.makeInputLine({name: "locationInput", textString: "", historyId: "http-file-browser-location0input-history", padding: Rectangle.inset(4, 2)}));

    this.addMorph({type: "text", name: "selectedFileName", fontSize: 14, fontFamily: "Inconsolata, monospace", readOnly: true, clipMode: "hidden"});


    var btnStyle = {
      type: "button", borderRadius: 5, padding: Rectangle.inset(0),
      grabbable: false, draggable: false
    }

    var makeIconStyle = name => [
      ["\u200C", {
        fontSize: 12, fontFamily: "",
        textStyleClasses: ["fa", "fa-" + name]}]];

    var reloadButton = this.addMorph({name: "reloadButton",      ...btnStyle, labelWithTextAttributes: makeIconStyle("refresh"), tooltip: "reload list"});
    var openFileButton = this.addMorph({name: "openFileButton",      ...btnStyle, labelWithTextAttributes: makeIconStyle("pencil-square-o"), tooltip: "open selected file"});
    var addDirectoryButton = this.addMorph({name: "addDirectoryButton",      ...btnStyle, labelWithTextAttributes: makeIconStyle("folder-o"), tooltip: "add directory"});
    var addFileButton = this.addMorph({name: "addFileButton",      ...btnStyle, labelWithTextAttributes: makeIconStyle("file-o"), tooltip: "add file"});
    var deleteFileButton = this.addMorph({name: "deleteFileButton",      ...btnStyle, labelWithTextAttributes: makeIconStyle("trash-o"), tooltip: "delete selected file"});


    connect(this, 'extent', this, 'relayout');
    connect(locationInput, 'input', this, 'onLocationChanged');
    connect(tree, 'selection', this, 'showSelectedFile');

    connect(openFileButton,     'fire', this, 'execCommand', {converter: () => "open selected file"});
    connect(reloadButton,       'fire', this, 'execCommand', {converter: () => "refresh contents"});    
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
        buttons =   [this.get("reloadButton"),
                     this.get("openFileButton"),
                     this.get("addFileButton"),
                     this.get("addDirectoryButton"),
                     this.get("deleteFileButton")],
        nButtons = 5,
        locationInputHeight = 20,
        selectedFileNameHeight = 20,
        buttonHeight = 20;

    locationInput.position = pt(0,0);
    locationInput.extent = pt(this.width, locationInputHeight);
    fileTree.topLeft = locationInput.bottomLeft;
    fileTree.extent = pt(this.width, this.height - locationInputHeight - selectedFileNameHeight - buttonHeight)
    selectedFileName.topLeft = fileTree.bottomLeft;
    selectedFileName.extent = pt(this.width, selectedFileNameHeight);

    buttons[0].topLeft = selectedFileName.bottomLeft;
    for (var i = 1; i < buttons.length; i++)
      buttons[i].topLeft = buttons[i-1].topRight;
    buttons.forEach(btn => btn.extent = pt(this.width/nButtons, buttonHeight));
  }

  whenFinishedLoading() {
    return promise.waitFor(3000, () => this._isLoading === false).catch(_ => undefined);
  }

  openLocation(urlOrResource) {
    var res = typeof urlOrResource === "string" ?
      resource(urlOrResource) : urlOrResource;
    this.get("locationInput").input = res.url;
    this.get("locationInput").acceptInput();
    return this;
  }

  get location() {
    return resource(this.get("locationInput").input);
  }
  set location(urlOrResource) {
    this._isLoading = true;
    var res = typeof urlOrResource === "string" ?
      resource(urlOrResource) : urlOrResource;
    if (!res.isDirectory()) res = res.asDirectory();
    this.get("locationInput").input = res.url;
    this.get("locationInput").acceptInput();
  }

  get selectedFile() {
    var sel = this.get("fileTree").selection;
    return sel ? sel.resource : null;
  }
  set selectedFile(urlOrResource) {
    if (!urlOrResource) {
      this.get("fileTree").selection = null;
    } else {
      var res = typeof urlOrResource === "string" ?
        resource(urlOrResource) : urlOrResource;
      var node = this.get("fileTree").nodes.find(({resource}) => resource.url === res.url)
      this.get("fileTree").selection = node;
    }
    this.get("fileTree").focus();
  }

  showSelectedFile() {
    var sel = this.selectedFile;
    this.get("selectedFileName").textString =  sel ? sel.url : "";
  }

  async gotoFile(urlOrResource) {
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
    await this.get("fileTree").onNodeCollapseChanged({node: treeData.root, isCollapsed: false});
    this._isLoading = false;
    this.get("fileTree").focus();
  }

  keepFileTreeStateWhile(whileFn) {
    return this.get("fileTree").maintainViewStateWhile(() =>
      whileFn.call(this),
      ({resource: {url}}) => url);
  }

  focus() {
    this.get("fileTree").focus();
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
      {keys: "Backspace|Delete", command: "delete file or directory"},
    ].concat(super.keybindings);
  }
}
