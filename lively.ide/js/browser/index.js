/* global System */
import { Color, pt } from 'lively.graphics';
import { arr, tree, num, date, Path, obj, fun, promise, string } from 'lively.lang';

import {
  Morph,
  easings,
  config,
  Icon
} from 'lively.morphic';

import { TreeData } from 'lively.components/tree.js';

import './tree.js';
import { editableFiles } from './tree.js';
import JavaScriptEditorPlugin from '../editor-plugin.js';
import JSONEditorPlugin from '../../json/editor-plugin.js';
import JSXEditorPlugin from '../../jsx/editor-plugin.js';
import EvalBackendChooser from '../eval-backend-ui.js';
import browserCommands from './commands.js';

// -=-=-=-=-=-
// Browser UI
// -=-=-=-=-=-

import { categorizer, fuzzyParse } from 'lively.ast';
import { testsFromSource } from '../../test-runner.js';
import * as modules from 'lively.modules/index.js';
import DarkTheme from '../../themes/dark.js';
import DefaultTheme from '../../themes/default.js';
import { objectReplacementChar } from 'lively.morphic/text/document.js';
import { loadPart } from 'lively.morphic/partsbin.js';
import { serverInterfaceFor, localInterface } from 'lively-system-interface/index.js';

import lint from '../linter.js';

import { mdCompiler } from '../../md/compiler.js';
import MarkdownEditorPlugin from '../../md/editor-plugin.js';
import LESSEditorPlugin from '../../css/less/editor-plugin.js';
import { ComponentChangeTracker } from '../../component/editor.js';
import { ViewModel, part } from 'lively.morphic/components/core.js';
import { ColumnListDefault, ColumnListDark } from 'lively.components/muller-columns.cp.js';
import { joinPath } from 'lively.lang/string.js';
import * as LoadingIndicator from 'lively.components/loading-indicator.cp.js';
import { noUpdate } from 'lively.bindings';

export const COLORS = {
  js: Color.rgb(46, 204, 113),
  json: Color.rgb(128, 139, 150),
  md: Color.rgb(142, 68, 173),
  less: Color.rgbHex('1D365E'),
  cp: Color.rgbHex('E67E22')
};

export class PackageControls extends Morph {
  focusOn (browser) {
    this._browser = browser;
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    switch (evt.targetMorph.name) {
      case 'run all pkg tests':
        this._browser.execCommand('run all tests in package');
        break;
      case 'add pkg':
        this._browser.execCommand('add package');
        break;
      case 'remove pkg':
        this._browser.execCommand('remove package');
        break;
    }
  }
}

export class DirectoryControls extends Morph {
  focusOn (browser, dir) {
    this._browser = browser;
    this._dir = dir;
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    if (evt.targetMorph.name === 'remove selected') {
      this.removeSelected();
    }
    if (evt.targetMorph.name === 'add file') {
      this.addFile(evt);
    }
    if (evt.targetMorph.name === 'add folder') {
      this.addFolder();
    }
  }

  // this is new behavior, that is not yet implemented on the browser
  // the browser currently just knows how to remove/add modules
  // there is no directory/file concept

  addFolder () {
    this._browser.execCommand('create new folder', { dir: this._dir });
  }

  async addFile (evt) {
    let type;
    const style = { paddingTop: '4px', fontSize: 14 };
    const menu = await this.world().openWorldMenu(evt, [
      { title: 'Select file type:' },
      { isDivider: true },
      [[...Icon.textAttribute('js-square', { ...style, fontColor: COLORS.js }), '  Javascript'], () => { type = 'js'; }],
      [[...Icon.textAttribute('shapes', { ...style, fontColor: COLORS.cp }), '  Component'], () => { type = 'cp.js'; }],
      [[...Icon.textAttribute('code', { ...style, fontColor: COLORS.json }), ' JSON'], () => { type = 'json'; }],
      [[...Icon.textAttribute('markdown', { ...style, fontColor: COLORS.md }), ' Markdown'], () => { type = 'md'; }],
      [[...Icon.textAttribute('less', { ...style, fontColor: COLORS.less }), ' Less (CSS)'], () => { type = 'less'; }]
    ]);
    await menu.whenFinished();
    if (!type) return;
    this._browser.execCommand('create new module', { dir: this._dir, type });
  }

  removeSelected () {
    this._browser.execCommand('remove selected entity', { dir: this._dir });
  }
}

export class PackageTreeData extends TreeData {
  get columnView () {
    return this.root.browser.ui.columnView;
  }

  get systemInterface () {
    return this.root.browser.systemInterface;
  }

  get editorPlugin () {
    return this.root.browser.editorPlugin;
  }

  display (node) {
    const { type, pkg, isCollapsed, isDeclaration, lastModified, size, name } = node;
    if (type === 'package') {
      return this.displayPackage(pkg);
    } else if (isDeclaration) {
      return this.displayDeclaration(node);
    } else {
      let col1Size = 19;
      let datePrinted = lastModified
        ? date.format(lastModified, 'yyyy-mm-dd HH:MM:ss')
        : ' '.repeat(col1Size);
      let sizePrinted = size ? num.humanReadableByteSize(size) : '';
      let displayedName;
      const isSelected = this.columnView.isSelected(node);
      switch (type) {
        case 'md':
          displayedName = this.displayMarkdown(name, isSelected);
          break;
        case 'js':
          displayedName = this.displayModule(name, isSelected, node.isLoaded);
          break;
        case 'json':
          displayedName = this.displayJson(name, isSelected);
          break;
        case 'directory':
          displayedName = this.displayDirectory(name, !isCollapsed);
          break;
        case 'less':
          displayedName = this.displayLess(name, isSelected);
          break;
        case 'css':
          displayedName = this.displayCSS(name, isSelected);
          break;
      }

      return [
        ...displayedName,
        `\t${sizePrinted} ${datePrinted}`, {
          paddingTop: '3px',
          opacity: 0.5,
          fontSize: '70%',
          textStyleClasses: ['annotation']
        }
      ];
    }
  }

  displayDeclaration (decl) {
    let icon = [];
    switch (decl.type) {
      case 'class-class-method':
        icon = ['static ', {}];
        break;
      case 'class-instance-method':
      case 'function-decl':
        icon = Icon.textAttribute('dice-d6', {
          paddingLeft: '3px',
          paddingRight: '3px'
        });
        break;
      case 'class-decl':
        icon = Icon.textAttribute('sitemap');
        break;
      case 'object-decl':
        icon = Icon.textAttribute('atom', {
          paddingLeft: '2px',
          paddingRight: '2px'
        });
        break;
      case 'array-decl':
        icon = Icon.textAttribute('list-ol', {
          paddingLeft: '2px',
          paddingRight: '2px'
        });
        break;
      case 'var-decl':
        icon = Icon.textAttribute('asterisk', {
          paddingLeft: '2px',
          paddingRight: '2px'
        });
        break;
      case 'class-class-getter':
        icon = Icon.textAttribute('arrow-right', {
          paddingLeft: '2px',
          paddingRight: '2px'
        });
        break;
      case 'class-instance-getter':
        icon = ['get ', null];
        break;
      case 'class-instance-setter':
        icon = ['set ', null];
        break;
      case 'describe':
        icon = Icon.textAttribute('vials');
        break;
      case 'xdescribe':
        icon = Icon.textAttribute('vials', { opacity: 0.5 });
        break;
      case 'it':
        icon = Icon.textAttribute('vial');
        break;
      case 'xit':
        icon = Icon.textAttribute('vial', { opacity: 0.5 });
        break;
      case 'before':
      case 'beforeEach':
      case 'after':
      case 'afterEach':
        icon = Icon.textAttribute('hammer');
        break;
    }
    return [...icon, ' ' + string.truncate(decl.name || '[PARSE_ERROR]', 18, '…'), null];
  }

  displayPackage (pkg) {
    return [
      ...Icon.textAttribute('cube'),
      ' ' + string.truncate(pkg.name, 26, '…'), {
        fontStyle: pkg.kind === 'git' ? 'italic' : 'normal'
      },
      `\t${pkg.kind}`, {
        paddingTop: '3px',
        opacity: 0.5,
        fontSize: '70%',
        textStyleClasses: ['annotation']
      }
    ];
  }

  displayDirectory (dir, isOpen) {
    return [
      ...Icon.textAttribute(isOpen ? 'folder-open' : 'folder', {
        textStyleClasses: ['far']
      }),
      ' ' + dir, null
    ];
  }

  displayModule (mod, isSelected, isLoaded) {
    return [
      ...Icon.textAttribute(mod.endsWith('.cp.js') ? 'shapes' : 'js-square', {
        fontColor: isSelected ? Color.white : mod.endsWith('.cp.js') ? COLORS.cp : COLORS.js,
        opacity: isLoaded ? 1 : 0.5
      }),
      ' ' + string.truncate(mod, 24, '…'), null
    ];
  }

  displayJson (json, isSelected) {
    return [
      ...Icon.textAttribute('cog', {
        fontColor: isSelected ? Color.white : COLORS.json
      }),
      ' ' + json, null
    ];
  }

  displayMarkdown (md, isSelected) {
    return [
      ...Icon.textAttribute('markdown', {
        fontColor: isSelected ? Color.white : COLORS.md
      }),
      ' ' + md, null
    ];
  }

  displayLess (less, isSelected) {
    return [
      ...Icon.textAttribute('less', {
        fontColor: isSelected ? Color.white : COLORS.less
      }),
      ' ' + less, null
    ];
  }
  
  displayCSS (css, isSelected) {
    return [
      ...Icon.textAttribute('css3-alt', {
        fontColor: isSelected ? Color.white : COLORS.less
      }),
      ' ' + css, null
    ];
  }
  
  async listModuleScope (moduleName) {
    const source = await this.systemInterface.moduleRead(moduleName);
    const parsed = fuzzyParse(source);
    return categorizer.findDecls(parsed).filter(ea => !ea.parent && ea.name).map(ea => {
      ea.isDeclaration = true;
      ea.isCollapsed = true;
      return ea;
    });
  }

  async listJSONScope (jsonLocation) {
    // replace with abstraction that can respond efficiently to frequent updates
    return (await this.systemInterface.runEval(`
      await listJSONScope('${jsonLocation}');
    `, {
      targetModule: 'lively.ide/js/browser/tree.js',
      ackTimeout: 30 * 1000
    })).value;
  }

  async listMarkdownHeadings (mdFile) {
    const { headings } = mdCompiler.parse({ textString: await this.systemInterface.moduleRead(mdFile) });
    return headings.map(heading => {
      heading.isDeclaration = true;
      heading.isCollapsed = true;
      heading.name = heading.string.replace(/^#+\s?/, '');
      return heading;
    });
  }

  async listAllPackages () {
    const pkgs = await this.systemInterface.getPackages();
    return arr.sortBy(pkgs.map(pkg => {
      let kind = 'git';
      if (pkg.url.startsWith('local')) kind = 'local';
      if (pkg.name.startsWith('lively')) kind = 'core';
      pkg.kind = kind;
      return {
        url: pkg.url + (pkg.url.endsWith('/') ? '' : '/'),
        isCollapsed: true,
        type: 'package',
        name: pkg.name,
        tooltip: pkg.name,
        pkg
      };
    }), ({ pkg }) => ({ core: 1, local: 2, git: 3 }[pkg.kind]));
  }

  async listEditableFilesInPackage (pkg) {
    return await this.listEditableFilesInDir(pkg);
  }

  async getLoadedModuleUrls () {
    const selectedPkg = this.root.subNodes.find(pkg => !pkg.isCollapsed);
    // this is super slow. Fix me!
    const files = await this.systemInterface.resourcesOfPackage(selectedPkg.url, ['assets', 'objectdb', '.git']);
    await this.systemInterface.getPackage(selectedPkg.url);
    const loadedModules = {};
    files.forEach(file => {
      loadedModules[file.url] = file;
    });
    return loadedModules;
  }

  async listEditableFilesInDir (folderLocation) {
    // fixme: dir only works locally
    // replace with systemInterface approach
    const files = (await this.systemInterface.runEval(`
      await listEditableFilesInDir('${folderLocation}');
    `, {
      targetModule: 'lively.ide/js/browser/tree.js',
      ackTimeout: 30 * 1000
    })).value;
    const loadedModules = await this.getLoadedModuleUrls();
    return files.map(file => {
      Object.assign(file, loadedModules[file.url] || {});
      return file;
    });
  }

  isCollapsed ({ isCollapsed }) { return isCollapsed; }

  async collapse (node, bool) {
    if (node === this.root) {
      bool = false; // never collapse root
      node.subNodes = await this.listAllPackages();
      node.listControl = node.listControl || await System.import('lively.ide/js/browser/ui.cp.js').then(b => part(b.BrowserPackageControls));
      node.listControl.focusOn(this.root.browser);
    }
    node.isCollapsed = bool;
    node.isDirty = true;
    if (!bool) {
      if (node.type === 'package') {
        node.subNodes = await this.listEditableFilesInPackage(node.url);
        node.listControl = node.listControl || await System.import('lively.ide/js/browser/ui.cp.js').then(b => part(b.BrowserDirectoryControls));
        node.listControl.focusOn(this.root.browser, node.url);
      }

      if (node.children) {
        node.children.forEach(child => {
          child.isDeclaration = true;
          child.isCollapsed = true;
          child.parent = node;
        });
        node.subNodes = node.children;
      }

      if (node.type === 'directory') {
        node.subNodes = await this.listEditableFilesInDir(node.url);
        node.listControl = node.listControl || await System.import('lively.ide/js/browser/ui.cp.js').then(b => part(b.BrowserDirectoryControls));
        node.listControl.focusOn(this.root.browser, node.url);
      }

      if (node.type === 'js') {
        node.subNodes = await this.listModuleScope(node.url);
      }

      if (node.type === 'md') {
        try {
          node.subNodes = await this.listMarkdownHeadings(node.url); 
        } catch (err) {
          node.subNodes = [];
        }
      }

      if (node.type === 'json') {
        node.subNodes = await this.listJSONScope(node.url);
      }
    }
  }

  getChildren (parent) {
    let { subNodes } = parent;
    let result = subNodes || [];
    // cache for faster parent lookup
    result && result.forEach(n => this.parentMap.set(n, parent));
    return result;
  }

  isLeaf ({ type, isDeclaration, children }) {
    if (isDeclaration) return !children;
    return !['package', 'directory', 'js', 'json', 'md'].includes(type);
  }
}

export class CodeDefTreeData extends TreeData {
  constructor (defs) {
    // defs come from lively.ast.categorizer.findDecls()
    defs.forEach(ea => ea.children && (ea.isCollapsed = true));
    super({
      name: 'root',
      isCollapsed: false,
      children: defs.filter(ea => !ea.parent)
    });
    this.defs = defs;
  }

  display (node) {
    let string = String(node.name);
    if (node.type === 'class-instance-getter') string = 'get ' + string;
    if (node.type === 'class-instance-setter') string = 'set ' + string;
    return string;
  }

  isLeaf (node) { return !node.children; }
  isCollapsed (node) { return node.isCollapsed; }
  collapse (node, bool) { node.isCollapsed = bool; }
  getChildren (node) {
    return this.isLeaf(node)
      ? null
      : this.isCollapsed(node)
        ? []
        : node.children;
  }
}

export class BrowserModel extends ViewModel {
  static get properties () {
    return {
      systemInterface: {
        derived: true,
        readOnly: true,
        after: ['editorPlugin'],
        get () {
          const env = this.editorPlugin.evalEnvironment;
          try {
            return this.editorPlugin.systemInterface();
          } catch (err) {
            return env.systemInterface;
          }
        },
        set (systemInterface) {
          this.editorPlugin.setSystemInterfaceNamed(systemInterface);
        }
      },

      associatedSearchPanel: {
        derived: true,
        get () { return this.state.associatedSearchPanel; },
        set (panel) { this.state.associatedSearchPanel = panel; }
      },

      editorPlugin: {
        readOnly: true,
        derived: true,
        get () {
          return this.ui.sourceEditor.pluginFind(p => p.isEditorPlugin);
        }
      },

      expose: {
        get () {
          return [
            'isBrowser', 
            'focus',
            'keybindings',
            'browse',
            'browserFromSpec',
            'browseSnippetForSelection',
            'commands',
            'systemInterface',
            'selectedModule',
            'selectedPackage',
            'selectedCodeEntity',
            'selectCodeEntity',
            'selectPackageNamed',
            'editorPlugin',
            'isTestModule',
            'reloadModule',
            'renderedCodeEntities',
            'focusSourceEditor',
            'historyBackward',
            'historyForward',
            'save',
            'hasUnsavedChanges',
            'interactivelyBrowseHistory',
            'interactivelyAddNewModule',
            'interactivelyCreateNewFolder',
            'interactivelyRemoveSelectedItem',
            'searchForModuleAndSelect',
            'updateModuleList',
            'onWindowClose',
            { method: 'serializeBrowser', as: '__serialize__' }
          ];
        }
      },

      bindings: {
        get () {
          return [
            { signal: 'extent', handler: 'relayout' },
            { model: 'global search', signal: 'fire', handler: 'execCommand', converter: () => 'open code search' },
            { model: 'go back', signal: 'fire', handler: 'execCommand', converter: () => 'browser history backward' },
            { model: 'go forward', signal: 'fire', handler: 'execCommand', converter: () => 'browser history forward' },
            { model: 'browse history', signal: 'fire', handler: 'execCommand', converter: () => 'browser history browse' },
            { model: 'browse modules', signal: 'fire', handler: 'execCommand', converter: () => 'choose and browse module' },
            { model: 'add tab', signal: 'fire', handler: 'execCommand', converter: () => 'open new tab' },

            { target: 'run tests in module', signal: 'onMouseDown', handler: 'execCommand', converter: () => 'run all tests in module' },
            { target: 'jump to entity', signal: 'onMouseDown', handler: 'execCommand', converter: () => 'jump to codeentity' },
            { target: 'export to html', signal: 'onMouseDown', handler: 'renderMarkdown' },
            { target: 'copy to clipboard', signal: 'onMouseDown', handler: 'execCommand', converter: () => 'open browse snippet' },
            { target: 'open in editor', signal: 'onMouseDown', handler: 'execCommand', converter: () => 'open selected module in text editor' },
            { target: 'close button', signal: 'onMouseDown', handler: 'closeStatusMessage' },
            { target: 'open in workspace', signal: 'onMouseDown', handler: 'openStatusMessage' },

            { model: 'column view', signal: 'selectionChange', handler: 'onListSelectionChange' },
            { target: 'source editor', signal: 'textChange', handler: 'updateUnsavedChangeIndicatorDebounced' },
            { target: 'source editor', signal: 'onMouseDown', handler: 'updateFocusedCodeEntity' },
            { model: 'tabs', signal: 'onSelectedTabChange', handler: 'browsedTabChanged' },
            { model: 'tabs', signal: 'oneTabRemaining', handler: 'makeTabsNotCloseable' },
            { model: 'tabs', signal: 'becameVisible', handler: 'relayout' },
            { model: 'tabs', signal: 'becameInvisible', handler: 'relayout' }
          ];
        }
      }
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initialization & serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  serializeBrowser ($serialize) {
    const browserSpec = this.browserSpec();
    const scrollPlaceholder = '__LIVELY-SCROLL-PLACEHOLDER__';
    const interfacePlaceholder = '__LIVELY-INTERFACE-PLACEHOLDER__';
    let stringifiedSpec = browserSpec.map((spec) => {
      return JSON.stringify(spec, (key, value) => {
        if (key === 'systemInterface') return interfacePlaceholder; // always resort to local...
        if (key === 'scroll') return scrollPlaceholder;
        if (key === 'module') return obj.select(value, ['pathInModule', 'packageName', 'name']);
        return value;
      }).replace(JSON.stringify(scrollPlaceholder), spec.content.spec.scroll.toString())
        .replace(JSON.stringify(interfacePlaceholder), 'localInterface');
    });
    stringifiedSpec = '[' + stringifiedSpec.join(',') + ']';
    return {
      __expr__: `let b = part(SystemBrowser); b.browserFromSpec(${stringifiedSpec}); b;`,
      bindings: {
        'lively.morphic/components/core.js': ['part'],
        'lively.ide/js/browser/ui.cp.js': ['SystemBrowser'],
        'lively-system-interface': ['localInterface'],
        'lively.graphics': ['pt']
      }
    };
  }

  async ensureColumnViewData () {
    const { columnView } = this.ui;
    if (!columnView.treeData) {
      await columnView.setTreeData(new PackageTreeData({ browser: this }));
    }
  }

  async viewDidLoad () {
    this.state = {
      packageUpdateInProgress: null,
      moduleUpdateInProgress: null,
      selectedPackage: null,
      sourceHash: string.hashCode(''),
      moduleChangeWarning: null,
      isSaving: false,
      history: { left: [], right: [], navigationInProgress: null }
    };
    this.refreshHistoryButtons();
    this.relayout();
    this.ui.metaInfoText.reset();
    const ed = this.ui.sourceEditor;
    if (!ed.plugins.length) { ed.addPlugin(new JavaScriptEditorPlugin(config.codeEditor.defaultTheme)); }

    if (this._serializedState) {
      const s = this._serializedState;
      delete this._serializedState;
      await this.browse(s);
    }
    new EvalBackendChooser().buildEvalBackendDropdownFor(this, this.ui.evalBackendList);
    this.ui.tabs.addTab('Browser Tab', null);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // layouting
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  relayout () {
    const {
      columnView,
      sourceEditor,
      headerButtons,
      verticalResizer,
      smiley,
      tabs
    } = this.ui;
    const { view } = this;
    const headerButtonsVisibleThreshhold = 400;
    const headerButtonsHeight = Math.ceil(headerButtons.height);
    const tabsOffset = tabs.visible ? tabs.height : 0;
    headerButtons.visible = view.width > headerButtonsVisibleThreshhold;
    if (!headerButtons.visible) {
      columnView.top = tabs.visible ? tabs.height : 0;
      if (tabs.visible) tabs.top = 0;
      columnView.height = verticalResizer.top - tabsOffset;
    } else {
      columnView.top = tabs.visible ? headerButtonsHeight + tabs.height : headerButtonsHeight;
      if (tabs.visible) tabs.top = headerButtonsHeight;
      columnView.height = verticalResizer.top - headerButtonsHeight - tabsOffset;
    }
    smiley.center = sourceEditor.center;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isBrowser () { return true; }

  get selectedModule () {
    return this.ui.columnView.getExpandedPath().find(node => this.isModule(node));
  }

  set selectedModule (m) {
    const mlist = this.ui.columnView;
    if (!m) mlist.setExpandedPath(); // only select current Package
    else this.selectModuleNamed(typeof m === 'string' ? m : m.url || m.id);
  }

  get selectedPackage () { return this.state && this.state.selectedPackage; }
  set selectedPackage (p) {
    this.selectPackageNamed(!p ? null : typeof p === 'string' ? p : p.url || p.address);
  }

  get selectedCodeEntity () {
    const entities = this.ui.columnView.getExpandedPath().filter(n => n.isDeclaration);
    if (entities.length > 1) return entities;
    return arr.last(entities);
  }

  get selectedDirectory () {
    return this.ui.columnView.getExpandedPath().reverse().find(m => ['package', 'directory'].includes(m.type));
  }

  isModule (node) {
    return node && editableFiles.includes(node.type);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // source changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  updateSource (source, cursorPos) {
    const ed = this.ui.sourceEditor;
    if (ed.textString !== source) {
      ed.textString = source;
    }
    source = source.split(objectReplacementChar).join('');
    this.state.sourceHash = string.hashCode(source);
    this.indicateNoUnsavedChanges();
    this.state.moduleChangeWarning = null;
    if (cursorPos) ed.cursorPosition = cursorPos;
  }

  indicateUnsavedChanges () {
    Object.assign(this.ui.sourceEditor,
      { border: { width: 2, color: Color.red } });
  }

  indicateNoUnsavedChanges () {
    Object.assign(this.ui.sourceEditor,
      { border: { width: 2, color: Color.transparent } });
  }

  /*
   * Returns wether or not there are unsaved changes
   * inside the source code editor that are not yet written to the file.
   */
  hasUnsavedChanges (compareToSource) {
    let content = this.ui.sourceEditor.textString;
    content = content.split(objectReplacementChar).join('');
    if (compareToSource && content !== compareToSource) {
      return true;
    }
    return this.state.sourceHash !== string.hashCode(content);
  }

  updateUnsavedChangeIndicatorDebounced () {
    fun.debounceNamed(this.id + '-updateUnsavedChangeIndicatorDebounced', 20,
      () => this.updateUnsavedChangeIndicator())();
  }

  updateUnsavedChangeIndicator () {
    this[this.hasUnsavedChanges() ? 'indicateUnsavedChanges' : 'indicateNoUnsavedChanges']();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async setEvalBackend (newRemote) {
    newRemote = newRemote || 'local';
    const { selectedPackage, selectedModule, systemInterface: oldSystemInterface } = this;
    const p = selectedPackage && selectedPackage.name;
    const mod = selectedModule && selectedModule.nameInPackage;
    if (newRemote !== oldSystemInterface.name) {
      this.editorPlugin.setSystemInterfaceNamed(newRemote);
      await this.toggleWindowStyle();
      this.reset();
      const { systemInterface: newSystemInterface } = this;
      const packages = await newSystemInterface.getPackages();
      const pSpec = p && packages.find(ea => ea.name === p);
      if (pSpec) {
        await this.selectPackageNamed(p);
        const modFound = pSpec.modules.find(
          ea => newSystemInterface.shortModuleName(ea.name, pSpec) === mod);
        await this.selectModuleNamed(modFound ? mod : pSpec.main);
      } else {
        await this.selectPackageNamed(packages[0].name);
        await this.selectModuleNamed(packages[0].main);
      }
      this.relayout();
    }
  }

  async toggleWindowStyle (animated = true) {
    const duration = 1000; const easing = easings.outExpo;
    let theme;
    const { columnView, sourceEditor } = this.ui;
    columnView.reset();

    if ((await this.editorPlugin.runEval("System.get('@system-env').node")).value) {
      theme = DarkTheme.instance;
      columnView.listMaster = ColumnListDark;
    } else {
      theme = DefaultTheme.instance;
      columnView.listMaster = ColumnListDefault;
    }

    this.editorPlugin.theme = theme;
    if (animated) {
      sourceEditor.animate({
        fill: theme.background, duration, easing
      });
      columnView.animate({
        fill: theme.background, duration, easing
      });
    } else {
    }
    this.editorPlugin.highlight();
    this.relayout();
  }

  async packageResources (p) {
    const excluded = (Path('lively.ide.exclude').get(p) || []).map(ea =>
      ea.includes('*') ? new RegExp(ea.replace(/\*/g, '.*')) : ea);
    excluded.push('.git', 'node_modules', '.module_cache', 'assets');
    try {
      return (await this.systemInterface.resourcesOfPackage(p.address, excluded))
        .filter(({ url }) => (url.endsWith('.js') || url.endsWith('.json') || url.endsWith('.jsx')) &&
                        !excluded.some(ex => ex instanceof RegExp ? ex.test(url) : url.includes(ex)))
        .map((ea) => { ea.name = ea.url; return ea; });
    } catch (e) { this.view.showError(e); return []; }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // browser actions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  browseSpec () {
    let codeEntity;
    if (this.selectedCodeEntity) {
      if (Array.isArray(this.selectedCodeEntity)) codeEntity = arr.last(this.selectedCodeEntity).name;
      else codeEntity = this.selectedCodeEntity.name;
    } else codeEntity = null;
    return {
      packageName: this.selectedPackage ? this.selectedPackage.name : 'lively.morphic',
      textPosition: this.ui.sourceEditor.selection.start,
      scroll: this.ui.sourceEditor.scroll,
      moduleName: this.selectedModule ? this.selectedModule.nameInPackage : null,
      codeEntity,
      systemInterface: this.systemInterface
    };
  }

  browserSpec () {
    this.ui.tabs.selectedTab.content = {
      spec: this.browseSpec(),
      history: this.state.history
    };
    
    let tabs = this.ui.tabs.tabs;
    let tabsSpec = tabs.map(tab => tab.viewModel.spec);
    return tabsSpec;
  }

  browserFromSpec (tabSpecs) {
    noUpdate(() => {
      this.ui.tabs.loadFromSpec(tabSpecs);
    });
    const curr = this.ui.tabs.selectedTab;
    this.state.history = curr.content.history;
    this.refreshHistoryButtons();
    this.browse(curr.content.spec);
    return this.view;
  }
  
  async browse (browseSpec = {}, optSystemInterface) {
    // browse spec:
    // packageName, moduleName, codeEntity, scroll, textPosition like {row: 0, column: 0}

    let {
      packageName,
      moduleName,
      textPosition,
      codeEntity,
      scroll,
      systemInterface
    } = browseSpec;

    const { sourceEditor } = this.ui;

    await this.ensureColumnViewData();

    if (optSystemInterface || systemInterface) {
      this.systemInterface = optSystemInterface || systemInterface;
      if (this.ui.evalBackendList) { await this.ui.evalBackendList.updateFromTarget(); }
    }

    await this.toggleWindowStyle(false);

    if (packageName) {
      await this.selectPackageNamed(packageName);
      if (moduleName) await this.selectModuleNamed(moduleName, false);
    } else if (moduleName) {
      const system = this.systemInterface;
      let m = await system.getModule(moduleName); let p;

      if (m) {
        moduleName = m.id;
        p = await system.getPackageForModule(m.id);
      } else {
        const mNameParts = moduleName.split('/');
        const pName = mNameParts.shift();
        const mNameRest = mNameParts.join('/');
        p = await system.getPackage(pName);
        m = await system.getModule(`${p.url}/${mNameRest}`);
      }

      if (m && p) {
        moduleName = m.id;
        await this.selectPackageNamed(p.url);
        await this.selectModuleNamed(moduleName, false);
      }
    }

    if (codeEntity) {
      await this.selectCodeEntityInColumnView(codeEntity, false);
    }

    if (textPosition) {
      if (this.world()) await promise.delay(10);
      sourceEditor.cursorPosition = textPosition;
      sourceEditor.centerRow(textPosition.row);
    }

    if (scroll) {
      if (this.world()) await promise.delay(10);
      sourceEditor.scroll = scroll;
    }

    if (this.selectedModule) { await this.prepareCodeEditorForModule(this.selectedModule); }

    return this.view;
  }

  whenPackageUpdated () { return this.state.packageUpdateInProgress || Promise.resolve(); }
  whenModuleUpdated () { return this.state.moduleUpdateInProgress || Promise.resolve(); }

  async selectPackageNamed (pName) {
    const p = pName ? await this.systemInterface.getPackage(pName) : null;
    const columnView = this.ui.columnView;
    const td = columnView.treeData;
    await columnView.setExpandedPath(n => {
      return n === td.root || n.ur === p.address + '/';
    }, td.root, false);
    this.onPackageSelected(p);
    await this.whenPackageUpdated();
    return p;
  }

  async onPackageSelected (p) {
    this.switchMode('js');
    this.state.selectedPackage = p;
    let deferred;
    if (!this.state.packageUpdateInProgress) {
      deferred = promise.deferred();
      this.state.packageUpdateInProgress = deferred.promise;
    }

    try {
      const win = this.view.getWindow();
      if (!p) {
        this.updateSource('');
        win.title = 'browser';
      } else {
        win.title = 'browser - ' + p.name;
        this.ui.tabs.selectedTab.caption = p.name;
      }
      // this is super slow. find a faster way to check for tests
      // const tests = await findTestModulesInPackage(this.systemInterface, p);
      // $world.logError(tests.length);
    } finally {
      if (deferred) {
        this.state.packageUpdateInProgress = null;
        deferred.resolve(p);
      }
    }
  }

  // this.indicateFrozenModuleIfNeeded()

  async indicateFrozenModuleIfNeeded () {
    const { metaInfoText } = this.ui;
    const m = await this.systemInterface.getModule(this.selectedModule.url);
    const pkgName = m.package().name;
    const moduleName = m.pathInPackage();

    if (m._frozenModule) {
      metaInfoText.showFrozen(`The module "${pkgName}/${moduleName}" you are viewing is frozen. You are not able to make changes to this module unless you reload the world with dynamic load enabled for the package "${pkgName}".`);
    }
  }

  getDisplayedModuleNodes () {
    const columnView = this.ui.columnView;
    const moduleLists = columnView.submorphs.filter(m => ['directory', 'package'].includes(m._managedNode.type));
    return arr.flatten(moduleLists.map(list => list.items.map(m => m.value)));
  }

  // this.selectModuleNamed('text/renderer.js')
  // mName = 'text/renderer.js'
  async selectModuleNamed (mName, animated = true) {
    const columnView = this.ui.columnView;
    let m = this.getDisplayedModuleNodes().find(({ nameInPackage, url }) =>
      mName === url || mName === nameInPackage);

    if (m) {
      await columnView.selectNode(m, animated);
      columnView.submorphs.forEach(list => {
        list.scrollSelectionIntoView();
      });
    }

    if (!m) {
      const system = this.systemInterface;
      const p = this.state.selectedPackage;
      let url;

      if (await system.doesModuleExist(mName)) {
        if (p && !mName.startsWith(p.url)) {
          url = p.url + '/' + mName;
        } else url = mName;
      } else if (p && await system.doesModuleExist(p.url + '/' + mName, true)) {
        url = p.url + '/' + mName;
      }

      if (url) {
        const td = columnView.treeData;
        await columnView.setExpandedPath(node => {
          return node === td.root || url.startsWith(node.url);
        }, td.root, false);
        this.updateSource(await this.systemInterface.moduleRead(url), { row: 0, column: 0 });
      }
    }

    await this.whenModuleUpdated();
    return m;
  }

  async searchForModuleAndSelect (moduleURI) {
    // moduleURI = System.decanonicalize("lively.vm")
    // var x= await (that.getWindow().searchForModuleAndSelect(System.decanonicalize("lively.vm")));
    const { selectedModule } = this;
    if (selectedModule && selectedModule.url === moduleURI) { return selectedModule; }

    const system = this.systemInterface;
    const mods = await system.getModules();
    const m = mods.find(({ name }) => name === moduleURI);
    const p = m && await system.getPackageForModule(m.name);

    if (!p) return null;
    await this.selectPackageNamed(p.address);
    await this.selectModuleNamed(m.name);
    await this.prepareCodeEditorForModule(this.selectedModule);
    return this.selectedModule;
  }

  async warnForUnsavedChanges () {
    return await this.world().confirm([
      'Discard Changes\n', {}, 'The unsaved changes to this module are going to be discarded.\nAre you sure you want to proceed?', { fontSize: 16, fontWeight: 'normal' }], { requester: this.view, width: 350 });
  }

  async loadES6Mocha () {
    const { value: isInstalled } = await this.systemInterface.runEval(`
      const g = typeof global !== 'undefined' ? global : window;
     !!g.Mocha && !!g.chai
    `, { targetModule: this.selectedModule.url });
    if (isInstalled) return;
    await this.systemInterface.importPackage('mocha-es6');
    await this.systemInterface.runEval(`
      const g = typeof global !== 'undefined' ? global : window;
      const promise = await System.import('lively.lang/promise.js')
      promise.waitFor(30 * 1000, () =>  !!g.Mocha && !!g.chai);
    `, { targetModule: this.selectedModule.url });
  }

  onListSelectionChange (selectedPath) {
    // called every time the user selects something inside the column view
    const selectedFile = arr.last(selectedPath);
    if (this.isModule(selectedFile)) {
      this.ui.sourceEditor.opacity = 1;
      this.ui.sourceEditor.readOnly = false;
      this.onModuleSelected(selectedFile);
    }

    if (selectedFile.type === 'package') {
      this.onPackageSelected(selectedFile.pkg);
    }

    if (selectedFile.isDeclaration) {
      this.onCodeEntitySelected(selectedFile);
    }

    if (['directory', 'package'].includes(selectedFile.type)) {
      this.ui.sourceEditor.opacity = 0.7;
      this.ui.sourceEditor.readOnly = true;
      this.updateSource('');
      this.ui.metaInfoText.showInactive();
    }
  }

  async onModuleSelected (m) {
    const pack = this.selectedPackage;
    const win = this.view.getWindow();

    if (this._return) return;
    if (this.selectedModule && this.hasUnsavedChanges()) {
      const proceed = await this.warnForUnsavedChanges();
      if (!proceed) {
        this._return = true;
        await this.state.history.navigationInProgress;
        await this.selectModuleNamed(arr.last(this.state.history.left).module.url);
        this._return = false;
        return;
      }
    }

    this.state.moduleChangeWarning = null;

    if (!m) {
      this.updateSource('');
      if (win) win.title = 'browser - ' + (pack && pack.name || '');
      this.ui.tabs.selectedTab.caption = pack.name;
      this.updateCodeEntities(null);
      this.ui.metaInfoText.textString = '';
      return;
    }

    if (!pack) {
      this.showError(new Error('Browser>>onModuleSelected called but no package selected!' + m));
      return;
    }

    let deferred;
    if (!this.state.moduleUpdateInProgress) {
      deferred = promise.deferred();
      this.state.moduleUpdateInProgress = deferred.promise;
    }

    try {
      const system = this.systemInterface;
      const win = this.view.getWindow();

      // fixme: actuall perform that in the conext of the module
      if (this.isTestModule(await system.moduleRead(m.url))) {
        await this.loadES6Mocha();
      }

      if (!m.isLoaded && m.name.endsWith('.js')) {
        let err;

        try { await system.importModule(m.url); } catch (e) { err = e; }

        if (err) this.view.showError(err);

        const p = await system.getPackage(pack.address);
        const isLoadedNow = p.modules.map(ea => ea.name).includes(m.url);

        if (isLoadedNow) {
          Object.assign(pack, p);
          m.isLoaded = true;
          await this.updateModuleList();
          this.state.moduleUpdateInProgress = null;
          await this.selectModuleNamed(m.url);
          m = this.selectedModule;
          if (deferred) { this.state.moduleUpdateInProgress = deferred.promise; }
          return;
        }
      }

      if (win) win.title = `browser - [${pack.name}] ${m.nameInPackage}`;
      this.ui.tabs.selectedTab.caption = `[${pack.name}] ${m.nameInPackage}`;
      const source = await system.moduleRead(m.url);
      this.updateSource(source, { row: 0, column: 0 });
      this.ui.sourceEditor.scroll = pt(0, 0);

      await this.prepareCodeEditorForModule(m);

      this.historyRecord();

      this.ui.metaInfoText.showDefault();
      m.isLoaded = true;
      this.updateModuleList();
    } finally {
      this.indicateFrozenModuleIfNeeded();
      await this.injectComponentTrackers();
      if (deferred) {
        this.state.moduleUpdateInProgress = null;
        deferred.resolve(m);
      }
    }
  }

  closeStatusMessage () {
    this.ui.metaInfoText.showDefault();
  }

  openStatusMessage () {
    this.ui.metaInfoText.showInfoInWorkspace();
  }

  switchMode (mode) {
    let Mode = JavaScriptEditorPlugin;
    switch (mode) {
      case 'js': /* default */break;
      case 'json': Mode = JSONEditorPlugin; break;
      case 'jsx': Mode = JSXEditorPlugin; break;
      case 'md': Mode = MarkdownEditorPlugin; break;
      case 'less': Mode = LESSEditorPlugin; break;
    }

    // switch text mode
    if (this.editorPlugin.constructor !== Mode) {
      const env = this.editorPlugin.evalEnvironment;
      this.ui.sourceEditor.removePlugin(this.editorPlugin);
      this.ui.sourceEditor.addPlugin(new Mode(config.codeEditor.defaultTheme));
      if (!this.editorPlugin.evalEnvironment) {
        // markdown does not really have a systemInterface, so we glue one on here
        this.editorPlugin.evalEnvironment = {
          systemInterface: localInterface
        };
      }
      Object.assign(this.editorPlugin.evalEnvironment, env);
      this.editorPlugin.highlight();
    }
  }

  async prepareCodeEditorForModule (mod) {
    const system = this.systemInterface;
    const format = (await system.moduleFormat(mod.url)) || 'esm';
    const pack = this.selectedPackage;
    const [_, ext] = mod.name.match(/\.([^\.]+)$/) || [];
    // FIXME we already have such "mode" switching code in the text editor...
    // combine these?!
    this.switchMode(ext);
    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: mod.url,
      context: this.ui.sourceEditor,
      format
    });
    this.editorPlugin._tokenizerValidBefore = { row: 0, column: 0 };
    this.editorPlugin.requestHighlight(true);

    await this.updateTestUI(mod);
    this.ui.metaInfoText.setPath([
        `[${pack.name}]`,
        {
          nativeCursor: 'pointer',
          textDecoration: 'underline',
          doit: { code: `$world.execCommand("open file browser", {location: "${pack.url}"})` }
        },
        ' ', {},
        mod.nameInPackage || '', {}
      // ` (${await system.moduleFormat(mod.url)} format)`, {}
      // ' - ', {}
    ]);
  }

  updateFocusedCodeEntityDebounced () {
    fun.debounceNamed(this.id + 'updateFocusedCodeEntityDebounced', 20,
      () => this.updateFocusedCodeEntity())();
  }

  updateFocusedCodeEntity () {
    const minWidthToDisplay = 600;
    const { sourceEditor, metaInfoText } = this.ui;
    const cursorIdx = sourceEditor.positionToIndex(sourceEditor.cursorPosition);
    let { parent, name } = arr.last(this.renderedCodeEntities().filter(
      (entity) => {
        if (!entity.node) return;
        const { start, end } = entity.node;
        return start < cursorIdx && cursorIdx < end;
      })) || {};
    const parents = parent ? [parent.name, ''] : [];
    while (parent && (parent = parent.parent)) {
      parents.unshift(parent.name);
    }
    if (name && this.view.width > minWidthToDisplay) {
      metaInfoText.setPath([
        ...metaInfoText.getPath().slice(0, 6),
        ` - ${parents.join('>>')}${name}:${sourceEditor.cursorPosition.row}`, {
          fontSize: 12, paddingTop: '2px'
        }]);
    }
  }

  async onCodeEntitySelected (entity) {
    if (!entity) return;
    const { sourceEditor } = this.ui;
    if (this.selectedModule.type === 'js' || this.selectedModule.type === 'json') {
      const moduleType = this.selectedModule.type;
      const start = sourceEditor.indexToPosition(moduleType === 'js' ? entity.node.start : entity.start);
      const end = sourceEditor.indexToPosition(moduleType === 'js' ? entity.node.end : entity.end);
      sourceEditor.cursorPosition = start;
      sourceEditor.flash({ start, end }, { id: 'codeentity', time: 1000, fill: Color.rgb(200, 235, 255) });
      sourceEditor.centerRange({ start, end });
      sourceEditor.scrollDown(-60);
    }
    if (this.selectedModule.type === 'md') {
      sourceEditor.execCommand('[markdown] goto heading', { choice: entity });
    }
  }

  findCodeEntity ({
    name, type,
    parent
  }) {
    const parentDef = parent ? this.findCodeEntity(parent) : null;
    const defs = this.renderedCodeEntities();
    if (!defs) return null;
    return defs.find((def) => {
      if (parentDef && def.parent !== parentDef) return false;
      if (def.name !== name) return false;
      if (!type || def.type === type) return true;
      if (type === 'method' && def.type.includes('method')) return true;
      return false;
    });
  }

  renderedCodeEntities () {
    const { columnView } = this.ui;
    const selectedModuleNode = this.selectedModule;
    const td = columnView && columnView.treeData;
    if (!td || !selectedModuleNode) return [];
    return tree.filter(selectedModuleNode, node => {
      return node.isDeclaration;
    }, node => {
      if (!node.subNodes && node.children) {
        node.subNodes = node.children;
        node.subNodes.forEach(n => n.isDeclaration = true);
      }
      return td.getChildren(node);
    });
  }

  async selectCodeEntityInColumnView (spec, animated) {
    if (typeof spec === 'string') spec = { name: spec };
    let def;
    const parents = [this.selectedModule];
    if (obj.isArray(spec)) {
      spec = spec.map(sp => {
        return typeof sp === 'string' ? { name: sp } : sp;
      });
      let current;
      while (current = spec.shift()) {
        current.parent = arr.last(parents);
        parents.push(def = this.findCodeEntity(current));
      }
    } else {
      def = this.findCodeEntity(spec);
      let parent = def;
      if (!parent) return; // entity does not appear in code
      while (parent = parent.parent) {
        parents.push(parent);
      }
    }
    await this.ui.columnView.setExpandedPath((n) => {
      return n.name === def.name || !!parents.find(p => p.type === n.type && p.name === n.name);
    }, this.selectedModule, animated);
    return def;
  }
  
  async selectCodeEntity (spec, animated = true) {
    const def = await this.selectCodeEntityInColumnView(spec, animated);
    
    this.onListSelectionChange(this.ui.columnView.getExpandedPath());
    return def;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async updateModuleList (m) {
    const { columnView } = this.ui;
    if (m) {
      // clear siblings
      const parent = columnView.treeData.parentNode(m);
      await columnView.treeData.collapse(parent, false);
    }
    await columnView.refresh(false);
  }

  async updateCodeEntities (mod) {
    const { columnView } = this.ui;
    const modNode = columnView.getExpandedPath().find(node => this.isModule(node));
    modNode.subNodes = null;
    await columnView.treeData.collapse(modNode, false);
    await columnView.refresh(false);
  }

  isTestModule (astOrSource) {
    const tests = testsFromSource(astOrSource);
    return tests && tests.length > 0;
  }

  isMarkdown (mod) {
    return mod.type === 'md';
  }

  updateTestUI (mod) {
    const { metaInfoText, sourceEditor } = this.ui;
    let hasTests = false;
    if (this.editorPlugin.isJSEditorPlugin) {
      try {
        const ast = this.editorPlugin.getNavigator().ensureAST(sourceEditor);
        hasTests = this.isTestModule(ast || sourceEditor.textString);
      } catch (err) {
        console.warn(`sytem browser updateTestUI: ${err}`);
        hasTests = false;
      }
    }
    metaInfoText.toggleTestButton(hasTests);
  }

  async runOnServer (source) {
    const result = await serverInterfaceFor(config.remotes.server).runEval(`
        ${source}
    `, { targetModule: 'lively://PackageBrowser/eval' });
    if (result.isError) { throw result.value; }
    return result.value;
  }

  async getInstalledPackagesList () {
    const pmap = await this.runOnServer(`
      let r = System.get("@lively-env").packageRegistry;
      r.toJSON();`);

    const items = [];

    for (const pname in pmap.packageMap) {
      const { versions } = pmap.packageMap[pname];
      for (const v in versions) {
        const p = versions[v];
        items.push(p);
      }
    }
    return items;
  }

  async updatePackageDependencies () {
    // const parsedJSON = this.editorPlugin.parse();
    // const installedPackages = await this.getInstalledPackagesList();
    // const depDefFields = parsedJSON.body[0].expression.properties.filter(p => {
    //   return ['devDependencies', 'dependencies'].includes(p.key.value);
    // });
    // // find added modules
    // 
    // for (const field of depDefFields) {
    //   for (const { key: { value: packageName }, value: { value: range }, end } of field.value.properties) {
    //     if (modules.semver.validRange(range) || modules.semver.valid(range)) {
    //       if (installedPackages.find(p => p._name === packageName && modules.semver.satisfies(p.version, range))) { continue; }
    //       const { versions } = await resource(`https://registry.npmjs.com/${packageName}`).makeProxied().readJson();
    //       // find the best match for the version that satisfies the range
    //       const version = modules.semver.minSatisfying(obj.keys(versions), range);
    //       await this.installPackage(packageName, version, end);
    //     }
    //   }
    // }
  }

  async installPackage (name, version, sourceIdx) {
    const installIndicator = await loadPart('package install indicator');

    if (installIndicator) {
      const { sourceEditor } = this.ui;
      sourceEditor.insertText([installIndicator, {}], sourceEditor.indexToPosition(sourceIdx - 1));
      installIndicator.showInstallationProgress();
    }

    try {
      const { pkgRegistry } = await this.runOnServer(`        
        async function installPackage(name, version) {
          let Module = System._nodeRequire("module"),
              flatn = Module._load("flatn")
        
          let env = process.env,
              devPackageDirs = env.FLATN_DEV_PACKAGE_DIRS.split(":").filter(Boolean),
              packageCollectionDirs = env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").filter(Boolean),
              packageDirs = env.FLATN_PACKAGE_DIRS.split(":").filter(Boolean),
              packageMap = flatn.PackageMap.ensure(packageCollectionDirs, packageDirs, devPackageDirs);
              buildFailed;

          await flatn.installPackage(
            name + "@" + version,
            System.baseURL.replace("file://", "") + "custom-npm-modules",
            packageMap,
            undefined,
            /*isDev = */false,
            /*verbose = */true
          );
          try {          
            await flatn.installDependenciesOfPackage(
               packageMap.lookup(name, version),
               System.baseURL.replace("file://", "") + 'dev-deps',
               packageMap,
               ['devDependencies'],
               true
            );
          } catch(e) {
            // install scripts dont really work sometimes so
            // dont let that disrup the normal install process
            buildFailed = e.message;
          }
        
          let r = System.get("@lively-env").packageRegistry
          await r.update();
          return { pkgRegistry: r, buildFailed };
        }
        await installPackage("${name}", "${version}");   
    `);
      System.get('@lively-env').packageRegistry.updateFromJSON(pkgRegistry);
      installIndicator && installIndicator.showInstallationComplete();
    } catch (err) {
      installIndicator && installIndicator.showError();
    } finally {
      if (installIndicator) {
        await promise.delay(2000);
        await installIndicator.reset();
        installIndicator.remove();
      }
    }
  }

  async save (attempt = 0) {
    const { ui: { sourceEditor, metaInfoText }, state, systemInterface: system } = this;
    const module = this.selectedModule;

    if (!module) {
      return;
    }
    if (modules.module(module.url)._frozenModule) {
      metaInfoText.showError('Cannot alter frozen Modules!');
      await promise.delay(5000);
      metaInfoText.showFrozen();
      return;
    }

    let content = sourceEditor.textString.split(objectReplacementChar).join('');
    let warnings = [];
    // moduleChangeWarning is set when this browser gets notified that the
    // current module was changed elsewhere (onModuleChanged) and it also has
    // unsaved changes
    if (state.sourceHash !== string.hashCode(content) &&
     state.moduleChangeWarning && state.moduleChangeWarning === module.url) {
      const really = await this.world().confirm(
        ['Change Conflict\n', null, `The module ${module.url} you are trying to save changed elsewhere!\nOverwrite those changes?`, { fontSize: 16, fontWeight: 'normal' }], { requester: this.view, width: 350 });
      if (!really) {
        return;
      }
      state.moduleChangeWarning = null;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // FIXME!!!!!! redundant with module load / prepare "mode" code!
    // this seems to always scan the transformed code. this is not what we want...
    (await system.moduleFormat(module.url)) || 'esm';
    const [_, ext] = module.name.match(/\.([^\.]+)$/) || [];
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    state.isSaving = true;
    try {
      // deal with non-js code, this needs to be cleaned up as well!
      if (ext !== 'js' && ext !== 'jsx') {
        if (module.nameInPackage === 'package.json') {
          await system.packageConfChange(content, module.url);
          this.updatePackageDependencies();
        } else {
          if (ext === 'less') {
            // notify dependent html morphs that are mounted in the world
            $world.getSubmorphsByStyleClassName('HTMLMorph').forEach(html => {
              html.updateLessIfNeeded();
            });
          }
          if (ext === 'md') {
            // the preview does not get unset when it is closed
            // we thus need to check whether the window that contains the preview is currently member of the world 
            if (this.editorPlugin.isMarkdownEditorPlugin && this.editorPlugin.textMorph._mdPreviewMorph && this.editorPlugin.textMorph._mdPreviewMorph.owner.owner) { 
              await this.renderMarkdown();
            } 
          }
          await system.coreInterface.resourceWrite(module.url, content);
        }
        metaInfoText.showSaved();
      // js save
      } else {
        if (config.systemBrowser.fixUndeclaredVarsOnSave) {
          const fixed = await sourceEditor.execCommand('[javascript] fix undeclared variables');
          if (!fixed) {
            return;
          }

          content = sourceEditor.textString;
        }

        const linterOutput = await lint(content);
        content = linterOutput[0];
        warnings = linterOutput[1];

        if (module.isLoaded) { // is loaded in runtime
          await system.interactivelyChangeModule(
            module.url, content, { targetModule: module.url, doEval: true });
        } else await system.coreInterface.resourceWrite(module.url, content);
      }
      this.updateSource(content);
      await this.updateCodeEntities(module);
      await this.updateTestUI(module);
      await this.injectComponentTrackers();
      sourceEditor.focus();
    } catch (err) {
      if (attempt > 0 || err instanceof SyntaxError) {
        metaInfoText.showError(err);
        return;
      }

      // try to reload the module, sometimes format changes (global => esm etc need a reload)
      const result = await this.reloadModule(false);
      sourceEditor.textString = content;
      return !result || result instanceof Error
        ? metaInfoText.showError(err)
        : this.save(attempt + 1);
    } finally { this.state.isSaving = false; }

    if (warnings.length > 0) {
      const warningStrings = warnings.map(warning => `"${warning.message}" on line ${warning.line}`);
      const warningMessage = ['Saved with warnings:'].concat(warningStrings).join('\n'); 
      metaInfoText.showWarning(warningMessage);
      await promise.delay(5000);
    } metaInfoText.showSaved();
  }

  async reloadModule (hard = false) {
    // hard reload: reset module environment and (hard) reload all module
    // dependencies.  Most of the time this is undesired as it completely
    // recreates the modules and variables (classes etc) therein, meaining that
    // existing instances might orphan
    const { selectedModule: m, systemInterface, ui: { sourceEditor } } = this;
    const { scroll, cursorPosition } = sourceEditor;
    if (!m) return null;
    const reloadDeps = !!hard;
    const resetEnv = !!hard;
    try {
      await systemInterface.interactivelyReloadModule(
        null, m.url, reloadDeps, resetEnv);
      await this.selectModuleNamed(m.nameInPackage);
      sourceEditor.scroll = scroll;
      sourceEditor.cursorPosition = cursorPosition;
    } catch (err) {
      return new Error(`Error while reloading ${m.name}:\n${err.stack || err}`);
    }
    return m;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // history
  // -=-=-=-=-

  async historyBackward () {
    if (this.state.history.left.length < 2) return;
    const current = this.state.history.left.pop();
    const before = arr.last(this.state.history.left);

    this.state.history.right.unshift(current);
    this.refreshHistoryButtons();
    const { scroll, cursor } = this.historyGetLocation();
    current.scroll = scroll; current.cursor = cursor;

    try {
      await this.historySetLocation(before);
    } catch (e) {
      this.state.history.left.push(before);
      this.state.history.right.unshift();
      throw e;
    }
  }

  async historyForward () {
    const current = arr.last(this.state.history.left);
    const next = this.state.history.right.shift();
    if (!next) return;
    this.state.history.left.push(next);
    this.refreshHistoryButtons();

    if (current) {
      const { scroll, cursor } = this.historyGetLocation();
      current.scroll = scroll; current.cursor = cursor;
    }

    try {
      await this.historySetLocation(next);
    } catch (e) {
      this.state.history.left.pop();
      this.state.history.right.unshift(next);
      throw e;
    }
  }

  historyGetLocation () {
    const ed = this.ui.sourceEditor;
    return {
      package: this.selectedPackage,
      module: this.selectedModule,
      // codeEntity: this.get("codeStructureList").selection,
      cursor: ed.cursorPosition,
      scroll: ed.scroll
    };
  }

  historyRecord (addToRight = false) {
    if (this.state.history.navigationInProgress) return;

    this.state.history.right.length = 0;

    const loc = this.historyGetLocation(); let last;
    if (addToRight) {
      while ((last = this.state.history.right[0]) &&
          last.module && loc.module &&
          (last.module.url === loc.module.url)) {
        this.state.history.right.shift();
      }
      this.state.history.right.unshift(loc);
    } else {
      while ((last = arr.last(this.state.history.left)) &&
          last.module && loc.module &&
          (last.module.url === loc.module.url)) {
        this.state.history.left.pop();
      }
      this.state.history.left.push(loc);
    }
    this.refreshHistoryButtons();
  }

  refreshHistoryButtons () {
    const { goBack, goForward } = this.ui;
    // if there is no previous history, disable the back button
    if (this.state.history.left.length < 2) goBack.disable();
    else goBack.enable();

    // if there is no future, disable the forward button
    if (this.state.history.right.length === 0) goForward.disable();
    else goForward.enable();
  }

  historyReset () {
    this.state.history.left = [];
    this.state.history.right = [];
    this.state.history.navigationInProgress = null;
  }

  async historySetLocation (loc) {
    // var codeEntities = this.get("codeEntityTree").nodes

    if (!loc) return;

    const hstate = this.state.history;

    if (hstate.navigationInProgress) {
      await hstate.navigationInProgress;
      this.historySetLocation(loc);
      return;
    }

    const { promise: navPromise, resolve } = promise.deferred();

    hstate.navigationInProgress = navPromise;

    try {
      const ed = this.ui.sourceEditor;
      // var loc = hstate.left[0]

      await this.whenPackageUpdated();
      await this.whenModuleUpdated();
      if (!this.selectedPackage || loc.package.address !== this.selectedPackage.address) { await this.selectPackageNamed(loc.package.address); }
      if (!this.selectedModule || loc.module.url !== this.selectedModule.url) { await this.selectModuleNamed(loc.module.url); }

      ed.cursorPosition = loc.cursor;
      ed.scroll = loc.scroll;
      ed.scrollCursorIntoView();
    } finally {
      hstate.navigationInProgress = null;
      resolve();
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // tab integration
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  makeTabsNotCloseable () {
    this.ui.tabs.tabs.forEach(tab => tab.closeable = false);
  }

  adaptViewForTabs () {
    this.ui.columnView.top = this.ui.columnView.top + 32;
  }

  async browsedTabChanged (tabs) {
    const { curr, prev } = tabs;
    // make it so that we cannot close the very first tab until we have another tab
    if (!prev) {
      curr.closeable = false;
      return; 
    }
    this.ui.tabs.tabs.forEach(tab => tab.closeable = true);
    
    // make sure that we want to change the tab when the currently edited file is not saved
    if (this.selectedModule && this.hasUnsavedChanges()) {
      const proceed = await this.warnForUnsavedChanges();
      // at this point the tabs has technically already been created
      // we need to circumvent some of the connections inside of the tab system
      if (!proceed) {
        prev.setProperty('selected', true);
        curr.closeSilently();
        return; 
      }
    }

    // save the current editor state associated with the tab we just left
    prev.content = {
      spec: this.browseSpec(),
      history: this.state.history
    };
    if (prev.caption.includes('Browser Tab')) prev.caption = `[${prev.content.packageName}]${prev.content.mdouleName ? '- ' + prev.content.moduleName : ''}`;

    // restore the editor tab from the tab we switched to
    // if the tab was newly created populate the editor state with fresh data    
    if (!curr.content) {
      curr.content = {
        spec: { packageName: 'lively.morphic', moduleName: 'morph.js', scroll: pt(0, 0) },
        history: {
          left: [],
          right: [],
          navigationInProgress: null
        }
      };
      curr.caption = '[lively.morphic] - morph.js';
    } 
    const loading = LoadingIndicator.open('Preparing Editor');
    this.state.history = curr.content.history;
    this.refreshHistoryButtons();
    await this.browse(curr.content.spec);
    loading.remove();   
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async onModuleChanged (evt) {
    if (this.state.isSaving) return;

    const m = modules.module(evt.module);
    const { selectedModule, selectedPackage } = this;

    if (!selectedPackage) return;
    if (!m.package() || m.package().address !== selectedPackage.address) return;

    if (selectedModule && selectedModule.url === m.id) {
      if (this.hasUnsavedChanges()) {
        this.addModuleChangeWarning(m.id);
        this.state.sourceHash = string.hashCode(await m.source());
      } else await this.ui.sourceEditor.saveExcursion(() => this.onModuleSelected(selectedModule));
    }
  }

  async onModuleLoaded (evt) {
    if (this.state.isSaving) return;

    const m = modules.module(evt.module);
    const { selectedPackage } = this;

    if (!selectedPackage || !m.package() || m.package().address !== selectedPackage.address) { }

    // fixme: add new module to list
    // let mInList = this.ui.moduleList.values.find(ea => ea.url === m.id);
    // if (!mInList) {
    //   await this.updateModuleList();
    //   mInList = this.ui.moduleList.values.find(ea => ea.url === m.id);
    // }
    //
    // if (selectedModule && selectedModule.url === m.id && mInList) {
    //   if (this.hasUnsavedChanges()) {
    //     this.addModuleChangeWarning(m.id);
    //     this.state.sourceHash = string.hashCode(await m.source());
    //   } else await this.ui.sourceEditor.saveExcursion(() => this.onModuleSelected(mInList));
    // }
  }

  addModuleChangeWarning (mid) {
    this.state.moduleChangeWarning = mid;
  }

  async injectComponentTrackers () {
    const { url: moduleId } = this.selectedModule;
    await ComponentChangeTracker.injectComponentTrackers(moduleId);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  setStatusMessage () {
    const ed = this.ui.sourceEditor;
    return ed.setStatusMessage.apply(ed, arguments);
  }

  async onWindowClose () {
    let proceed = true;
    if (this.hasUnsavedChanges()) proceed = await this.warnForUnsavedChanges();
    return proceed;
  }

  focus (evt) {
    const { sourceEditor } = this.ui;
    sourceEditor.focus();
  }

  focusSourceEditor () {
    this.ui.sourceEditor.focus();
    this.ui.sourceEditor.show();
  }

  focusColumnView () {
    this.models.columnView.focusActiveList();
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-S', win: 'Ctrl-S' }, command: 'browser save' },
      { keys: 'Alt-Up', command: 'focus list with selection' },
      { keys: 'F1', command: 'focus module list' },
      { keys: 'F2', command: 'focus code entities' },
      { keys: 'F3|Alt-Down', command: 'focus source editor' },
      { keys: 'F4', command: 'resize editor panel' },
      { keys: 'Alt-R', command: 'reload module' },
      { keys: 'Alt-Ctrl-R', command: { command: 'reload module', args: { hard: true } } },
      { keys: 'Alt-L', command: 'load or add module' },
      { keys: 'Ctrl-C Ctrl-T', command: 'run all tests in module' },
      { keys: 'Ctrl-C T', command: 'run tests at point' },
      { keys: 'Ctrl-C B E F', command: 'run setup code of tests (before and beforeEach)' },
      { keys: 'Ctrl-C A F T', command: 'run teardown code of tests (after and afterEach)' },
      { keys: 'Alt-P', command: 'browser history backward' },
      { keys: 'Alt-N', command: 'browser history forward' },
      { keys: 'Alt-H', command: 'browser history browse' },
      { keys: 'Meta-Shift-L b a c k e n d', command: 'activate eval backend dropdown list' },
      { keys: 'Alt-J', command: 'jump to codeentity' },
      { keys: 'Meta-N', command: 'open new tab' }
    ].concat(this.ui.tabs.keybindings);
  }

  get commands () {
    return browserCommands(this)
      .concat(EvalBackendChooser.default.activateEvalBackendCommand(this))
      .concat(this.ui.tabs.commands);
  }

  renderMarkdown () {
    this.ui.sourceEditor.execCommand('[markdown] convert to html');
  }

  async interactivelyJumpToCodeentity () {
    const { sourceEditor: ed, columnView } = this.ui;
    if (this.isTestModule(ed.textString)) { return this.execCommand('jump to test'); }
    if (this.isMarkdown(this.selectedModule)) {
      return ed.execCommand('[markdown] goto heading');
    }

    const codeEntities = this.renderedCodeEntities();
    const currentIdx = codeEntities.indexOf(columnView._selectedNode);
    const items = codeEntities.map((def) => {
      const { name, type, parent } = def;
      return {
        isListItem: true,
        label: [
                  `${parent ? parent.name + '>>' : ''}${name}`, null,
                  `${type}`, { fontSize: '70%', textStyleClasses: ['annotation'] }
        ],
        value: def
      };
    });
    const { selected: [choice] } = await this.world().filterableListPrompt(
      'Select item', items,
      {
        preselect: currentIdx,
        requester: this.view,
        historyId: 'js-browser-codeentity-jump-hist'
      });
    if (choice) {
      ed.saveMark();
      this.selectCodeEntity(choice);
    }
  }

  async interactivelyJumpToTest () {
    const { selectedModule: m, ui: { sourceEditor } } = this;
    if (!m) return true;

    const source = sourceEditor.textString;
    const items = []; const testsByFile = [];
    const lines = source.split('\n');
    const { cursorPosition: { row: currentRow } } = sourceEditor;
    let preselect = 0;

    const { loadTestModuleAndExtractTestState } = await System.import('mocha-es6');

    await loadTestModuleAndExtractTestState(m.url, testsByFile);
    const tests = testsByFile[0].tests.filter(ea => ea.fullTitle);
    for (let i = 0; i < tests.length; i++) {
      const value = tests[i];
      const { depth, fullTitle, title, type } = value;
      const fnName = type === 'suite' ? 'describe' : 'it';
      const row = value.row = lines.findIndex(
        line => line.match(new RegExp(`${fnName}.*".*${title}.*"`)));
      if (row <= currentRow) preselect = i;
      items.push({
        isListItem: true,
        value,
        label: [
              `${'\u2002'.repeat(depth - 1)}${fullTitle}`, null,
              `line ${row} ${type}`, { fontSize: '70%', textStyleClasses: ['annotation'] }
        ]
      });
    }
    const { selected: [choice] } = await this.world().filterableListPrompt(
          `tests of ${m.nameInPackage}`, items, {
            requester: this.view,
            preselect
          });
    if (choice) {
      sourceEditor.saveMark();
      sourceEditor.cursorPosition = { row: choice.row, column: 0 };
      sourceEditor.execCommand('goto line start');
      sourceEditor.centerRow(choice.row);
    }
    return true;
  }

  async interactivelyAddOrLoadModule (dir) {
    const p = this.selectedPackage;
    const m = this.selectedModule;
    const system = this.systemInterface;
    const requester = this.view;
    let mods;
    try {
      mods = await system.interactivelyAddModule(requester, m ? m.name : p ? p.address : null);
    } catch (e) {
      e === 'Canceled'
        ? requester.setStatusMessage(e)
        : this.world().inform(`Error while trying to load modules:\n${e.stack || e}`, { requester });
      return;
    }

    mods.forEach(({ name, error }) =>
      error
        ? requester.showError(`Error while loading module ${name}: ${error.stack || error}`)
        : requester.setStatusMessage(`Module ${name} loaded`));
    await this.updateModuleList(p);
    mods.length && this.selectModuleNamed(mods[0].name);
    return true;
  }

  async interactivelyCreateNewFolder (dir) {
    const { columnView } = this.ui;
    const td = columnView.treeData;
    if (!dir) return;
    const coreInterface = this.systemInterface.coreInterface;
    const name = await this.world().prompt('Enter folder name', { requester: this.view });
    if (!name) return;
    let dirPath = joinPath(dir, name);
    if (!dirPath.endsWith('/')) dirPath += '/';
    await coreInterface.resourceMkdir(dirPath);
    // uncollapse the parent node of the dir
    const parentNode = columnView.getExpandedPath().find(n => n.url === dir);
    if (parentNode) await td.collapse(parentNode, false);
    columnView.selectNode(parentNode.subNodes.find(n => n.url === dirPath));
  }

  async interactivelyAddNewModule (dir, type) {
    const { columnView } = this.ui;
    const td = columnView.treeData;
    if (!dir) return;
    const coreInterface = this.systemInterface.coreInterface;
    let name = '';
    if (type) {
      name = await this.world().prompt([
        'Enter module name', null], { requester: this.view });
      if (name) {
        name = name.replace(/(\.js|\.md|\.json)$/, '') + '.' + type;
      }
    } else {
      while (name !== undefined && !name.match(/(\.js|\.md|\.json)$/)) {
        name = await this.world().prompt([
          'Enter module name\n', null,
          'Supported file types are:\n', { fontSize: 16, fontWeight: 'normal' },
          'markdown (.md)\nJavascript (.js)\nJSON (.json)', { fontWeight: 'normal', fontSize: 16, fontStyle: 'italic' }], { requester: this.view });
      }
    }
    if (!name) return;
    let dirPath = joinPath(dir, name);
    await coreInterface.resourceEnsureExistance(dirPath);
    // uncollapse the parent node of the dir
    const parentNode = columnView.getExpandedPath().find(n => n.url === dir);
    if (parentNode) await td.collapse(parentNode, false);
    columnView.selectNode(parentNode.subNodes.find(n => n.url === dirPath));
  }

  async interactivelyBrowseHistory () {
    const { left, right } = this.state.history;
    const current = arr.last(left);
    const currentIdx = left.indexOf(current);

    const items = left.concat(right).map(loc => ({
      isListItem: true,
      string: loc.module
        ? loc.module.nameInPackage
        : loc.package
          ? loc.package.name || loc.package.address
          : 'strange location',
      value: loc
    }));

    const { selected: [choice] } = await this.world().filterableListPrompt(
      'Jumpt to location', items, { preselect: currentIdx, requester: this.view });
    if (choice) {
      if (left.includes(choice)) {
        this.state.history.left = left.slice(0, left.indexOf(choice) + 1);
        this.state.history.right = left.slice(left.indexOf(choice) + 1).concat(right);
      } else if (right.includes(choice)) {
        this.state.history.left = left.concat(right.slice(0, right.indexOf(choice) + 1));
        this.state.history.right = right.slice(right.indexOf(choice) + 1);
      }
      if (current) {
        const { scroll, cursor } = this.historyGetLocation();
        current.scroll = scroll; current.cursor = cursor;
      }
      await this.historySetLocation(choice);
    }

    return true;
  }

  async interactivelyRemoveSelectedItem (dir) {
    const { selectedPackage, ui: { columnView }, systemInterface } = this;
    const coreInterface = systemInterface.coreInterface;
    const td = columnView.treeData;
    if (!dir || !selectedPackage) return;
    const parentNode = columnView.getExpandedPath().find(n => n.url === dir);
    const selectedNodeInDir = parentNode.subNodes.find(n => !n.isCollapsed);
    const textStyle = { fontSize: 16, fontWeight: 'normal ' };
    if (!selectedNodeInDir) return;
    if (this.isModule(selectedNodeInDir)) {
      // if is .md or .less, just remove the file
      // else remove module!
      if (selectedNodeInDir.url.match(/(\.md|\.less)$/)) {
        if (await this.world().confirm([
          'Really remove file?\n', {}, 'You are about to remove the file:\n', textStyle, selectedNodeInDir.url, { ...textStyle, fontStyle: 'italic' }
        ], { lineWrapping: false, requester: this.view })) {
          await coreInterface.resourceRemove(selectedNodeInDir.url);
        } else return;
      } else {
        return this.execCommand('remove module', { mod: selectedNodeInDir });
      }
    }
    if (selectedNodeInDir.type === 'directory') {
      const proceed = await this.world().confirm([
        'Folder removal\n', {},
        'You are about to remove a folder containing several modules. ', textStyle,
        'All of these modules will be immediately unloaded from the system.\n', textStyle,
        'This may potentially crash the system, especially if the modules in question are currently in use by one or more objects. Proceed with caution.', textStyle
      ], { width: 400, requester: this.view });
      if (!proceed) return;
      const pkg = await coreInterface.getPackage(selectedPackage.address);
      const modulesToRemove = pkg.modules.filter(m => m.name.startsWith(selectedNodeInDir.url));
      for (let mod of modulesToRemove) {
        await this.execCommand('remove module', { mod });
      }
      await coreInterface.resourceRemove(selectedNodeInDir.url);
    }
    if (parentNode) await td.collapse(parentNode, false);
    this.updateModuleList();
  }

  async onContextMenu (evt) {
    evt.stop();

    const target = evt.targetMorph;
    const {
      sourceEditor,
      moduleList,
      codeEntityTree
    } = this.ui;

    const items = [];
    if ([sourceEditor, moduleList, codeEntityTree].includes(target)) { items.push(...await target.menuItems()); }

    this.openMenu([...items, ...await this.menuItems()], evt);
  }

  browseSnippetForSelection () {
    // produces a string that, when evaluated, will open the browser at the
    // same location it is at now
    const p = this.selectedPackage;
    const m = this.selectedModule;
    const c = this.selectedCodeEntity;
    const sysI = this.systemInterface;

    let codeSnip = '$world.execCommand("open browser", {';
    if (m) {
      codeSnip += `moduleName: "${m.nameInPackage}", `;
      if (p) codeSnip += `packageName: "${p.name}", `;
    } else {
      if (p) codeSnip += ` packageName: "${p.name}", `;
    }
    if (c) {
      codeSnip += `codeEntity: ${obj.isArray(c) ? JSON.stringify(c.map(c => obj.select(c, ['name', 'type']))) : `"${c.name}"`}`;
    }

    if (sysI.name !== 'local') codeSnip += `, systemInterface: "${sysI.name}"`;
    codeSnip += '});';

    return codeSnip;
  }

  menuItems () {
    const p = this.selectedPackage;
    const m = this.selectedModule;

    return [
      ...super.menuItems(),
      p && { command: 'open browse snippet', target: this },
      m && { command: 'open selected module in text editor', target: this }
    ].filter(Boolean);
  }
}
