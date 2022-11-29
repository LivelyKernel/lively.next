import { pt, Color, rect } from 'lively.graphics';
import { TilingLayout, ProportionalLayout, easings, MorphicDB, Icon, Morph, VerticalLayout, Label, ShadowObject, ViewModel, add, part, component } from 'lively.morphic';
import { GreenButton, RedButton, LightPrompt } from 'lively.components/prompts.cp.js';
import { Spinner } from './shared.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { MullerColumnView, ColumnListDefault } from 'lively.components/muller-columns.cp.js';
import { TreeData } from 'lively.components';
import { arr, promise, num, date, string, fun } from 'lively.lang';
import { resource } from 'lively.resources';
import { renderMorphToDataURI } from 'lively.morphic/rendering/morph-to-image.js';
import { COLORS } from '../js/browser/index.js';
import { localInterface } from 'lively-system-interface';
import { once } from 'lively.bindings/index.js';

// ColumnListDefault.listItemContainer.reactsToPointer;

class MasterComponentTreeData extends TreeData {
  /**
   * Create a tree data object listing master component files.
   * @param { object } props
   * @property { ComponentBrowserModel } props.browser - Reference to the component browser view model.
   */
  constructor (props) {
    super(props);
    this.ensurePopularComponentsCollection();
  }

  isCollapsed ({ isCollapsed }) { return isCollapsed; }

  async collapse (node, bool) {
    if (node === this.root) {
      bool = false; // never collapse root
      node.subNodes = await this.listAllComponentCollections();
    }
    node.isCollapsed = bool;
    node.isDirty = true;
    if (!bool) {
      if (node.type === 'package') {
        node.subNodes = await this.listComponentFilesInPackage(node.url);
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
        node.subNodes = await this.listComponentFilesInDir(node.url);
      }

      if (node.type === 'cp.js') {
        node.subNodes = await this.listModuleScope(node.url);
      }
    }
  }

  getChildren (parent) {
    let { subNodes } = parent;
    let result = subNodes || [];
    result && result.forEach(n => this.parentMap.set(n, parent));
    return result;
  }

  isLeaf ({ type, isDeclaration, children }) {
    if (isDeclaration) return !children;
    return !['package', 'directory', 'cp.js'].includes(type);
  }

  display (node) {
    const { type, pkg, isCollapsed, componentObject, lastModified, size, name, url } = node;
    const isSelected = this.columnView.isSelected(node);
    if (type === 'package') {
      return this.displayPackage(pkg, isSelected);
    } else if (componentObject) {
      return this.displayComponent(componentObject, isSelected);
    } else {
      let col1Size = 19;
      let datePrinted = lastModified
        ? date.format(lastModified, 'yyyy-mm-dd HH:MM:ss')
        : ' '.repeat(col1Size);
      let sizePrinted = size ? num.humanReadableByteSize(size) : '';
      let displayedName;

      switch (type) {
        case 'cp.js':
          if (!node.isLoaded && isSelected) node.isLoaded = true;
          displayedName = this.displayComponentFile(name, isSelected, node.isLoaded, url);
          break;
        case 'directory':
          displayedName = this.displayDirectory(name, !isCollapsed);
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

  /**
   * @returns { Morph } - The visual representation of the muller columns view presenting this data.
   */
  get columnView () { return this.root.browser.models.componentFilesView; }

  /**
   * @returns { LivelySystemInterface } - Returns the local interface to be used to resolve the modules (client only)
   */
  get systemInterface () { return localInterface; }

  /**
   * Returns the text attributes needed to display an entry of the list covering the
   * components contained in the currently openend component file.
   * @param { Object } componentDecl - The code entity representing the declaration of the component.
   */
  displayComponent (componentObj, isSelected) {
    if (isSelected && !this.root.browser._pauseUpdates) {
      this.root.browser.selectComponent(componentObj, true);
    }
    return [...Icon.textAttribute('cube'), ' ' + string.truncate(componentObj.name || '[PARSE_ERROR]', 18, '…'), null];
  }

  /**
   * Returns the text attributes needed to display a package that contains a collection
   * of component files.
   */
  displayPackage (pkg, isSelected) {
    if (isSelected && !this.root.browser._pauseUpdates) {
      this.root.browser.reset();
    }
    return [
      ...Icon.textAttribute('cubes'),
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

  /**
   * Returns the text attributes needed to display a directory that contains a collection
   * of component files.
   * @param { String } dir - The name of the directory.
   * @param { Boolean } isOpen - Wether or not the directory is currently opened.
   */
  displayDirectory (dir, isOpen) {
    if (isOpen && !this.root.browser._pauseUpdates) {
      this.root.browser.reset();
    }
    return [
      ...Icon.textAttribute(isOpen ? 'folder-open' : 'folder', {
        textStyleClasses: ['far']
      }),
      ' ' + dir, null
    ];
  }

  /**
   * Returns the text attributes needed to display an entry that represents a component file.
   */
  displayComponentFile (mod, isSelected, isLoaded, url) {
    if (isSelected && !this.root.browser._pauseUpdates) {
      this.getComponentsInModule(url).then(components => {
        this.root.browser.showComponentsInFile(mod.replace('.cp.js', ''), components);
      });
    }

    return [
      ...Icon.textAttribute('shapes', {
        fontColor: isSelected ? Color.white : COLORS.cp,
        opacity: isLoaded ? 1 : 0.5
      }),
      ' ' + string.truncate(mod.replace('.cp.js', ''), 24, '…'), null
    ];
  }

  async getComponentsInModule (moduleName) {
    return await this.root.browser.getComponentsInModule(moduleName);
  }

  async listModuleScope (moduleName) {
    const exportedComponents = await this.getComponentsInModule(moduleName);
    return exportedComponents.map(componentObject => {
      return {
        isCollapsed: true,
        isDeclaration: true,
        componentObject
      };
    });
  }

  /**
   * Returns all the custom project inside the lively.next projects folder
   * that may contain custom component definitions.
   * @todo Implement this feature.
   */
  async getCustomLocalProjects () {
    return [];
  }

  /**
   * Initializes a local folder comprising a set of "popular" component files such as
   * buttons, input fields or lists.
   */
  async ensurePopularComponentsCollection () {
    const res = resource('local://VeryPopularComponents');
    ['buttons', 'list', 'inputs'].map(async name => {
      res.join(name + '.cp.js').write('redirect -> ' + await System.decanonicalize(`lively.components/${name}.cp.js`));
    });
    ['value-widgets', 'styling/color-picker'].map(async name => {
      res.join(name + '.cp.js').write('redirect -> ' + await System.decanonicalize(`lively.ide/${name}.cp.js`));
    });
  }

  async getComponentCollections () {
    return [
      ...await Promise.all(['lively.ide', 'lively.components'].map(pkgName => this.systemInterface.getPackage(pkgName))),
      ...await this.getCustomLocalProjects(),
      { name: 'Popular', url: 'local://VeryPopularComponents' }
    ];
  }

  async listAllComponentCollections () {
    const coll = await this.getComponentCollections();
    return arr.sortBy(coll.map(pkg => {
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
    }), ({ pkg }) => ({ core: 2, local: 1, git: 3 }[pkg.kind]));
  }

  async listComponentFilesInPackage (pkg) {
    return await this.listComponentFilesInDir(pkg);
  }

  async getLoadedComponentFileUrls () {
    const selectedPkg = this.root.subNodes.find(pkg => !pkg.isCollapsed);
    const files = await resource(selectedPkg.url).dirList(1, {
      exclude: (res) => {
        return !(res.url.endsWith('.cp.js') || res.isDirectory());
      }
    });
    if (selectedPkg.name !== 'Popular') {
      // ensure the package is present in the system
      // so that we do not get any orphaned modules...     
      await this.systemInterface.getPackage(selectedPkg.url);
    }
    const loadedModules = {};
    files.forEach(file => {
      loadedModules[file.url] = file;
    });
    return loadedModules;
  }

  async listComponentFilesInDir (folderLocation) {
    const resources = (await resource(folderLocation).dirList())
      .filter(res => res.isDirectory() || res.url.endsWith('.cp.js'));
    const files = resources.map(res => {
      let type;
      if (res.isDirectory()) type = 'directory';
      else type = 'cp.js';
      return {
        isCollapsed: true,
        name: res.name(),
        size: res.size,
        lastModified: res.lastModified,
        url: res.url,
        type
      };
    });

    const loadedFiles = await this.getLoadedComponentFileUrls();
    return files.map(file => {
      file.isLoaded = !!loadedFiles[file.url];
      // Object.assign(file, loadedFiles[file.url] || {});
      return file;
    });
  }
}

export class ExportedComponent extends Morph {
  static get properties () {
    return {
      project: {},
      componentBrowser: {
        derived: true,
        get () {
          return this.ownerChain().find(m => m.isComponentBrowser);
        }
      },
      dragTriggerDistance: {
        get () { return 30; }
      },
      fetchUrl: {
        after: ['submorphs'],
        set (url) {
          this.setProperty('fetchUrl', url);
          this.updateLabel();
        }
      },
      isSelected: {},
      preview: {
        derived: true,
        set (url) {
          this.getSubmorphNamed('preview holder').imageUrl = url;
          this.fitPreview();
        }
      },
      master: {
        initialize () {
          this.master = ComponentPreview; // eslint-disable-line no-use-before-define
        }
      },
      component: {
        set (cp) {
          this.setProperty('component', cp);
          this.generatePreview();
        }
      }
    };
  }

  generatePreview () {
    const preview = part(this.component);
    // disable view model
    // scale to fit
    // disable all mouse interaction
    const container = this.get('preview container');
    const maxExtent = pt(100, 70);
    preview.scale = 1;
    preview.scale = Math.min(maxExtent.x / preview.bounds().width, maxExtent.y / preview.bounds().height);
    preview.withAllSubmorphsDo(m => m.reactsToPointer = false);
    this.get('component name').textString = this.component.name;
    container.submorphs = [preview];
  }

  async initExportIndicatorIfNeeded () {
    if (this.fetchUrl.startsWith('part://$world/')) {
      const exportIndicator = this.addMorph(
        this.getSubmorphNamed('export indicator') ||
        await resource('part://SystemDialogs/export indicator').read()
      );
      exportIndicator.name = 'export indicator';
      exportIndicator.fetchUrl = this.fetchUrl;
      exportIndicator.isLayoutable = false;
      return exportIndicator;
    }
  }

  async fitPreview () {
    const img = this.getSubmorphNamed('preview holder');
    if (!this.world()) img.opacity = 0;
    await this.master.whenApplied();
    const naturalExtent = await img.determineNaturalExtent();
    // scale the preview down to fit into width and height;
    const maxWidth = img.owner.width;
    const maxHeight = img.owner.height;
    const scaleFactor = Math.min(maxWidth / naturalExtent.x, maxHeight / naturalExtent.y);
    img.extent = naturalExtent.scaleBy(scaleFactor);
    img.opacity = 1;
    const exportIndicator = this.getSubmorphNamed('export indicator') || await this.initExportIndicatorIfNeeded();
    if (!exportIndicator) {
      return;
    }
    // ensure the layout has applied itself already...
    exportIndicator.topRight = this.innerBounds().insetBy(2).topRight();
  }

  updateLabel () {
    const nameLabel = this.getSubmorphNamed('component name');
    nameLabel.value = resource(this.fetchUrl).url.replace(/part:\/\/[^\/]*\//, '');
    this.tooltip = this.fetchUrl;
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    // this is pretty bad style
    if (this.project) {
      this.project.selectComponent(this);
      // notify the column view to update accordingly if active...
    }
  }

  onDrag (evt) {
    const [{ scale }] = this.getSubmorphNamed('preview container').submorphs;
    const instance = part(this.component, { scale });
    // on drop scale to 1
    instance.openInHand();
    const grabShadow = new ShadowObject({ fast: false, color: Color.rgba(0, 0, 0, 0.6), blur: 40 });
    instance.animate({
      scale: 1,
      center: instance.center,
      dropShadow: grabShadow,
      duration: 300
    });
    once(instance, 'onBeingDroppedOn', async (hand) => {
      if (this.componentBrowser.fullContainsPoint(hand.position)) {
        await instance.whenRendered();
        instance.openInWorld(instance.position);
        await instance.animate({ center: this.globalBounds().center(), opacity: 0, duration: 300 });
        instance.remove();
      }
    });
  }

  select (active) {
    this.isSelected = active;
    if (active) {
      this.master = {
        auto: ComponentPreviewSelected // eslint-disable-line no-use-before-define
      };
    } else {
      this.master = {
        auto: ComponentPreview // eslint-disable-line no-use-before-define
      };
    }
  }
}

export class ProjectEntry extends Morph {
  static get properties () {
    return {
      exportedComponents: {
        get () {
          return this.getSubmorphNamed('component previews').submorphs.map(m => m.component);
        }
      },
      selectedComponent: {
        get () {
          const selectedPreview = this.getSubmorphNamed('component previews').submorphs.find(m => m.isSelected);
          return selectedPreview && selectedPreview.component;
        }
      },
      worldName: {
        derived: true,
        set (name) {
          this.getSubmorphNamed('project title').value = [name, {}, '  ', {}].concat(name === 'This Project' ? [] : Icon.textAttribute('external-link-square-alt', { paddingTop: '3px' }));
        },
        // this.worldName
        get () {
          return this.getSubmorphNamed('project title').value[0];
        }
      }
    };
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    const projectTitle = this.getSubmorphNamed('project title');
    projectTitle.fontColor = Color.rgb(66, 73, 73);
    if (projectTitle.textBounds().containsPoint(evt.positionIn(projectTitle))) { this.openComponentWorld(); }
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    const projectTitle = this.getSubmorphNamed('project title');
    if (projectTitle.textBounds().containsPoint(evt.positionIn(projectTitle))) {
      projectTitle.fontColor = Color.black;
    }
  }

  async openComponentWorld () {
    const selectedComponent = this.selectedComponent || this.exportedComponents[0];
    const { module: moduleName, export: name } = selectedComponent[Symbol.for('lively-module-meta')];
    const browser = await $world.execCommand('open browser', { moduleName, codeEntity: [{ name }] });
    browser.getWindow().animate({
      right: browser.getWindow().right - browser.getWindow().width,
      duration: 300,
      easing: easings.outExpo
    });
  }

  renderComponents (components) {
    const previewContainer = this.getSubmorphNamed('component previews');
    const previewProto = part(ComponentPreview); /* eslint-disable-line no-use-before-define */
    previewContainer.submorphs = components.map(cp => {
      let preview = previewContainer.submorphs.find(p => p.component === cp);
      if (!preview) {
        preview = previewProto.copy();
        preview.project = this;
        preview.component = cp;
      }
      return preview;
    });
    return this;
  }

  async withExportedComponents (components) {
    const previewContainer = this.getSubmorphNamed('component previews');
    const previewProto = await resource('part://SystemDialogs/exported component preview/deselected').read();
    previewContainer.submorphs = arr.sortBy(components, info => info.identifier.length).map(info => {
      let preview = previewContainer.submorphs.find(p => p.fetchUrl === info.identifier);
      if (!preview) {
        preview = previewProto.copy();
        preview.project = this;
        preview.fetchUrl = info.identifier;
      }
      preview.preview = info.preview;
      return preview;
    });
    return this;
  }

  selectComponent (component) {
    const importButton = this.get('import button');
    if (importButton) importButton.deactivated = false;
    this.owner.getSubmorphsByStyleClassName('ExportedComponent').forEach(m => m.select(false));
    component.select(true);
  }
}

export class ExportIndicator extends Morph {
  static get properties () {
    return {
      fetchUrl: {
        set (url) {
          this.setProperty('fetchUrl', url.replace('part://$world/', ''));
          this.exported = this.isExported(this.fetchUrl);
        }
      },
      exported: {
        after: ['submorphs'],
        set (isExported) {
          this.setProperty('exported', isExported);
          this.updateStyle();
        }
      },
      ui: {
        get () {
          return {
            publicIndicator: this.getSubmorphNamed('public indicator'),
            privateIndicator: this.getSubmorphNamed('private indicator')
          };
        }
      }
    };
  }

  updateStyle () {
    const { publicIndicator, privateIndicator } = this.ui;
    publicIndicator.isLayoutable = publicIndicator.visible = this.exported;
    privateIndicator.isLayoutable = privateIndicator.visible = !this.exported;
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.toggleExport();
  }

  isExported (url) {
    return !$world.hiddenComponents.includes(url);
  }

  toggleExport () {
    this.exported = !this.exported;
    if (this.exported) {
      this.exportComponent();
    } else {
      this.hideComponent();
    }
  }

  exportComponent () {
    $world.hiddenComponents = arr.without($world.hiddenComponents, this.fetchUrl);
  }

  hideComponent () {
    $world.hiddenComponents = [this.fetchUrl, ...$world.hiddenComponents];
  }
}

export class ComponentBrowserModel extends ViewModel {
  static get properties () {
    return {
      isComponentBrowser: {
        get () { return true; }
      },
      isEpiMorph: {
        get () { return true; }
      },
      db: {
        serialize: false,
        readOnly: true,
        get () { return MorphicDB.default; }
      },
      expose: {
        get () {
          return ['activate', 'isComponentBrowser', 'reset', 'isEpiMorph'];
        }
      }
    };
  }

  // this.reifyBindings()
  get bindings () {
    return [
      {
        model: 'cancel button',
        signal: 'fire',
        handler: 'reject'
      },
      {
        model: 'import button',
        signal: 'fire',
        handler: 'importSelectedComponent'
      },
      {
        target: 'search input',
        signal: 'inputChanged',
        handler: 'filterAllComponents'
      },
      {
        signal: 'onKeyDown',
        handler: 'reject',
        updater: ($reject, evt) => {
          if (evt.key === 'Escape') $reject();
        }
      },
      {
        signal: 'onMouseUp',
        handler: 'ensureImportButton'
      },
      {
        signal: 'onMouseUp',
        handler: 'ensureComponentEntitySelected'
      }
    ];
  }

  ensureImportButton () {
    const selectedComponent = this.getSelectedComponent();
    this.models.importButton.deactivated = !selectedComponent;
  }

  viewDidLoad () {
    if (!this.view.isComponent) {
      this.view.withMetaDo({ metaInteraction: true }, () => {
        this.ui.componentFilesView.setTreeData(new MasterComponentTreeData({ browser: this }));
      });
    }
  }

  get systemInterface () { return localInterface; }

  reset () {
    this.ui.masterComponentList.submorphs = [];
  }

  async activate () {
    const { view } = this;
    // this.toggleBusyState(true);
    // await this.fetchInfo();
    view.doNotAcceptDropsForThisAndSubmorphs();
    this._promise = promise.deferred();
    view.openInWorld();
    view.clipMode = 'hidden';
    view.center = $world.visibleBounds().center();
    this.ui.searchInput.focus();
    // this.filterList();
    this.ensureImportButton();
    return this._promise.promise;
  }

  async reject () {
    this._promise.resolve(false);
    await this.view.fadeOut(300);
    this.view.hasFixedPosition = false;
  }

  async importSelectedComponent () {
    const selectedComponent = this.getSelectedComponent();
    const importedComponent = part(selectedComponent.component);
    importedComponent.openInWorld();
    this._promise.resolve(importedComponent);
    if (!this.isComponent) this.view.fadeOut(300);
  }

  toggleBusyState (active) {
    this.ui.spinner.visible = active;
  }

  toggleComponentList (active) {
    const { masterComponentList } = this.ui;
    if (masterComponentList.isLayoutable === active) return;
    const center = this.world().visibleBounds().center();
    this.withAnimationDo(() => {
      masterComponentList.height = active ? 300 : 0;
      masterComponentList.isLayoutable = active;
    }, {
      duration: 300,
      easing: easings.inOutExpo
    });
    this.layout.forceLayout();
    this.animate({ center, duration: 300, easing: easings.inOutExpo });
  }

  async getComponentsInModule (moduleName) {
    let source = await this.systemInterface.moduleRead(moduleName);
    if (source.startsWith('redirect -> ')) {
      moduleName = source.replace('redirect -> ', '');
    }
    const mod = localInterface.getModule(moduleName);
    const exports = await mod.exports();
    return exports.map(m => mod.recorder[m.exported]).filter(c => c && c.isComponent);
  }

  filterList () {
    const { searchInput, importButton } = this.ui;
    // this.toggleComponentList(!!searchInput.input);
    this.toggleComponentList(true);
    fun.debounceNamed('updateList', 100, async () => {
      this.updateList(await this.filteredIndex(searchInput.input));
      importButton.deactivated = !this.getSelectedComponent();
      this.toggleBusyState(false);
    })();
  }

  async withoutUpdates (cb) {
    this._pauseUpdates = true;
    await cb();
    this._pauseUpdates = false;
  }

  async ensureComponentEntitySelected (evt) {
    const selectedComponent = this.getSelectedComponent();
    if (!evt.isClickTarget(this.ui.masterComponentList)) return;
    if (selectedComponent) {
      const { _selectedNode: n, treeData: td } = this.models.componentFilesView;

      if (n && n.componentObject === selectedComponent.component) return;
      // expand path until node selected
      const url = System.decanonicalize(selectedComponent.component[Symbol.for('lively-module-meta')].module);
      await this.withoutUpdates(() => this.models.componentFilesView.setExpandedPath(node => {
        if (node === td.root) return true;
        if (node.url) return url.startsWith(node.url);
        if (node.componentObject === selectedComponent.component) {
          this.models.componentFilesView._selectedNode = node;
          return true;
        }
      }, td.root, false));
    }
  }

  getSelectedComponent () {
    return this.view.getSubmorphsByStyleClassName('ExportedComponent').find(component => component.isSelected);
  }

  parseInput () {
    const filterText = this.ui.searchInput.textString;
    // parser that allows escapes
    const parsed = Array.from(filterText).reduce(
      (state, char) => {
        // filterText = "foo bar\\ x"
        if (char === '\\' && !state.escaped) {
          state.escaped = true;
          return state;
        }

        if (char === ' ' && !state.escaped) {
          if (!state.spaceSeen && state.current) {
            state.tokens.push(state.current);
            state.current = '';
          }
          state.spaceSeen = true;
        } else {
          state.spaceSeen = false;
          state.current += char;
        }
        state.escaped = false;
        return state;
      },
      { tokens: [], current: '', escaped: false, spaceSeen: false }
    );
    parsed.current && parsed.tokens.push(parsed.current);
    const lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return { tokens: parsed.tokens, lowercasedTokens };
  }

  fuzzyMatch (parsedInput, term) {
    const tokens = parsedInput.lowercasedTokens;
    if (tokens.every(token => term.toLowerCase().includes(token))) return true;
    // "fuzzy" match against item.string or another prop of item
    const fuzzyValue = String(term).toLowerCase();
    return arr.sum(parsedInput.lowercasedTokens.map(token =>
      string.levenshtein(fuzzyValue, token))) <= 3;
  }

  async filteredIndex (term) {
    const previewWidth = 120 * window.devicePixelRatio;
    const filteredIndex = {};
    const parsedInput = this.parseInput();
    let localComponents = await Promise.all($world.localComponents.map(async c => {
      // minimum width is the width of the rendered preview
      let renderedWidth = c.width;
      let renderedHeight = c.height;
      renderedHeight *= previewWidth / renderedWidth;
      renderedWidth = previewWidth;
      const preview = c._preview || (c._preview = await renderMorphToDataURI(c, {
        width: renderedWidth, height: renderedHeight, type: 'png'
      }));
      return {
        identifier: 'part://$world/' + c.name,
        preview,
        worldName: $world.name
      };
    }));
    localComponents = localComponents.filter(component =>
      this.fuzzyMatch(parsedInput, component.identifier));
    if (localComponents.length > 0) {
      filteredIndex['This Project'] = localComponents;
    }
    for (const worldName of Object.keys(this._componentIndex)) {
      if (worldName === this.world().name) continue; // skip local components
      const matches = this._componentIndex[worldName].filter(component =>
        this.fuzzyMatch(parsedInput, component.identifier));
      if (matches.length > 0) filteredIndex[worldName] = matches;
    }
    return filteredIndex;
  }

  // this.toggleComponentList(true)
  // this.ui.masterComponentList.submorphs = []
  // await this.fetchInfo()

  async fetchInfo () {
    if (this._componentIndex) return;
    this.reset();
    const maxSubCategories = 10;
    const componentsCache = resource(System.baseURL).join('components_cache/');
    const index = (await componentsCache.dirList(maxSubCategories))
      .filter(res => res.isFile() && res.ext() === 'png')
      .map(res => {
        const url = decodeURIComponent(res.url.replace(componentsCache.url, '').replace('.png', ''));
        return {
          worldName: url.split('/')[0],
          preview: res.url,
          identifier: `part://${url}`
        };
      });
    this._componentIndex = arr.groupBy(index, m => m.worldName);
  }

  async filterAllComponents () {
    fun.debounceNamed('filterAllComponents', 200, async () => {
      this.toggleBusyState(true);
      const { importButton, componentFilesView, searchInput } = this.ui;
      const term = searchInput.input;
      const parsedInput = this.parseInput();
      const rootUrls = componentFilesView.treeData.root.subNodes.map(m => m.url).slice(1); // ignore the popular stuff
      const componentModules = Array.from(await Promise.all(rootUrls.map(url => {
        return resource(url).dirList(10, {
          exclude: (file) => {
            return file.isFile() && !file.url.endsWith('cp.js');
          }
        });
      }))).flat().filter(file => file.url.endsWith('cp.js'))
        .map(file => file.url);

      // via system interface

      // hide the column view if search term 
      this.ui.componentFilesView.visible = term === '';

      if (term === '') {
        this.toggleBusyState(false);
        return;
      }

      // filter the candidates and render the projects together with the matches
      const filteredIndex = {};
      await Promise.all(componentModules.map(async modUrl => {
        let components = await this.getComponentsInModule(modUrl);// retrieve the components exported in that module
        // get the matching components in the module
        components = components.filter(c => {
          return this.fuzzyMatch(parsedInput, c.name);
        });
        // store them in the filtered index if there is a match or more
        if (components.length > 0) filteredIndex[modUrl.replace(System.baseURL, '')] = components;
      }));
      // update the components list with the filtered projects
      this.updateList(filteredIndex);
      importButton.viewModel.deactivated = !this.getSelectedComponent();
      this.toggleBusyState(false);
    })();
  }

  // componentsByWorlds = filteredIndex
  async updateList (componentsByWorlds) {
    const { masterComponentList } = this.ui;
    // do some smart updating of the list
    const newList = [];
    const currentList = masterComponentList.submorphs;
    const projectEntry = part(ProjectSection); // eslint-disable-line no-use-before-define
    // remove all empty lists
    const orderedWorlds = (componentsByWorlds['This Project'] ? ['This Project'] : []).concat(arr.without(Object.keys(componentsByWorlds), 'This Project'));
    for (const worldName of orderedWorlds) {
      const item = currentList.find(item => item.worldName === worldName) || projectEntry.copy();
      item.worldName = worldName;
      item.renderComponents(componentsByWorlds[worldName]);
      newList.push(item);
    }

    masterComponentList.submorphs = newList;
    this.view.doNotAcceptDropsForThisAndSubmorphs();
  }

  selectComponent (component, scrollIntoView = false) {
    const previewToSelect = this.view.getSubmorphsByStyleClassName('ExportedComponent').find(preview => preview.component === component);
    if (previewToSelect && !previewToSelect.isSelected) {
      previewToSelect.project.selectComponent(previewToSelect); // lol?
    }
    const { masterComponentList } = this.ui;
    if (previewToSelect && scrollIntoView) {
      const scrollY = masterComponentList.localizePointFrom(pt(0, 0), previewToSelect).y;
      masterComponentList.animate({
        scroll: pt(0, scrollY - 50),
        duration: 200
      });
    }
  }

  showComponentsInFile (fileName, componentsInFile) {
    const { masterComponentList } = this.ui;
    const projectEntry = part(ProjectSection); // eslint-disable-line no-use-before-define

    projectEntry.worldName = fileName;
    projectEntry.renderComponents(componentsInFile);
    masterComponentList.submorphs = [projectEntry];
    masterComponentList.layout.setResizePolicyFor(projectEntry, {
      width: 'fill', height: 'fixed'
    });
  }
}

// ComponentPreview.openInWorld()
const ComponentPreview = component({
  type: ExportedComponent,
  name: 'component preview',
  borderColor: Color.rgb(33, 150, 243),
  borderRadius: 5,
  borderWidth: 0,
  extent: pt(129, 135),
  fill: Color.transparent,
  draggable: true,
  layout: new VerticalLayout({
    align: 'center',
    direction: 'topToBottom',
    orderByIndex: true,
    resizeSubmorphs: false,
    spacing: 6
  }),
  master: false,
  nativeCursor: 'grab',
  position: pt(1186.4, 654.7),
  submorphs: [{
    name: 'preview container',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(120, 100),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new VerticalLayout({
      align: 'center',
      direction: 'centered',
      orderByIndex: true,
      resizeSubmorphs: false
    }),
    reactsToPointer: false,
    submorphs: [{
      name: 'preview holder',
      borderColor: Color.rgb(23, 160, 251),
      dropShadow: new ShadowObject({ distance: 5, rotation: 75, color: Color.rgba(0, 0, 0, 0.2), blur: 20, fast: false }),
      extent: pt(105, 45),
      naturalExtent: pt(105, 45),
      reactsToPointer: false
    }]
  }, {
    type: Label,
    name: 'component name',
    fontColor: Color.darkGray,
    fontSize: 14,
    fontWeight: 'bold',
    reactsToPointer: false,
    textAndAttributes: ['Button', null]
  }]
});

// ComponentPreviewSelected.openInWorld()
const ComponentPreviewSelected = component(ComponentPreview, {
  name: 'component preview selected',
  borderColor: Color.rgb(33, 150, 243),
  borderWidth: 2,
  fill: Color.rgba(3, 169, 244, 0.75),
  submorphs: [{
    name: 'component name',
    fontColor: Color.rgb(255, 255, 255)
  }]
});

// ProjectSection.openInWorld()
const ProjectSection = component({
  type: ProjectEntry,
  name: 'project section',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(488.6, 154.2),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new VerticalLayout({
    direction: 'topToBottom',
    orderByIndex: true,
    resizeSubmorphs: true
  }),
  master: false,
  position: pt(647.1, 628.5),
  renderOnGPU: true,
  submorphs: [{
    type: Label,
    name: 'project title',
    borderColor: Color.rgb(215, 219, 221),
    fontColor: Color.rgb(66, 73, 73),
    borderWidthBottom: 2,
    fontSize: 20,
    fontWeight: 'bold',
    nativeCursor: 'pointer',
    padding: rect(10, 8, -2, 0),
    textAndAttributes: ['Project Name', {
    }, '  ', {
    }, '', {
      fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
      fontWeight: '900',
      nativeCursor: 'pointer',
      paddingTop: '3px',
      textStyleClasses: ['fas']
    }]
  }, {
    name: 'component previews',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(489, 101.2),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      orderByIndex: true,
      padding: rect(10, 10, 0, 0),
      spacing: 10
    })
  }]
});

// ComponentBrowser.openInWorld()
const ComponentBrowser = component(LightPrompt, {
  defaultViewModel: ComponentBrowserModel,
  name: 'component browser',
  epiMorph: false,
  extent: pt(515.1, 599.9),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(16, 16, 0, 0),
    resizePolicies: [['search input', {
      height: 'fixed',
      width: 'fill'
    }], ['component files view', {
      height: 'fixed',
      width: 'fill'
    }], ['master component list', {
      height: 'fill',
      width: 'fill'
    }], ['button wrapper', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 16,
    wrapSubmorphs: false
  }),
  submorphs: [{
    name: 'prompt title',
    textString: 'Browse Components'
  }, add(part(InputLineDefault, {
    name: 'search input',
    layout: new ProportionalLayout({
      lastExtent: {
        x: 483,
        y: 34.3
      },
      reactToSubmorphAnimations: false,
      submorphSettings: [['placeholder', {
        x: 'fixed',
        y: 'fixed'
      }], ['spinner', {
        x: 'fixed',
        y: 'fixed'
      }]]
    }),
    extent: pt(640, 34.3),
    fontSize: 20,
    padding: rect(6, 4, -4, 0),
    placeholder: 'Search for Components...',
    submorphs: [add(part(Spinner, {
      name: 'spinner',
      position: pt(448.2, 5.4),
      visible: false
    })), {
      name: 'placeholder',
      extent: pt(232, 34.3),
      padding: rect(6, 4, -4, 0),
      textAndAttributes: ['Search for Components...', null]
    }]
  })), add(part(MullerColumnView, {
    viewModel: { listMaster: ColumnListDefault },
    name: 'component files view',
    extent: pt(483, 150),
    borderRadius: 5,
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) })
  })), add({
    name: 'master component list',
    borderRadius: 5,
    borderColor: Color.rgb(149, 165, 166),
    clipMode: 'auto',
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
    extent: pt(640, 304),
    layout: new TilingLayout({
      wrapSubmorphs: false,
      axis: 'column'
    })
  }), add({
    name: 'button wrapper',
    clipMode: 'visible',
    extent: pt(486, 52.6),
    fill: Color.rgba(255, 255, 255, 0.01),
    layout: new TilingLayout({
      align: 'right',
      axisAlign: 'center',
      orderByIndex: true,
      spacing: 15
    }),
    submorphs: [part(GreenButton, {
      name: 'import button',
      extent: pt(100, 38),
      submorphs: [{
        name: 'label',
        textAndAttributes: ['IMPORT', null]
      }]
    }), part(RedButton, {
      name: 'cancel button'
    })]
  })]
});

export { ComponentBrowser, ComponentPreview, ComponentPreviewSelected, ProjectSection };
