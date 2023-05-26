import { pt, Color, rect } from 'lively.graphics';
import { TilingLayout, easings, MorphicDB, Icon, Morph, Label, ShadowObject, ViewModel, add, part, component } from 'lively.morphic';
import { Project } from 'lively.project';
import { PackageRegistry, module, importPackage } from 'lively.modules';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { MullerColumnView, ColumnListDark, ColumnListDefault } from 'lively.components/muller-columns.cp.js';
import { TreeData } from 'lively.components';
import { arr, promise, num, date, string, fun } from 'lively.lang';
import { resource } from 'lively.resources';
import { renderMorphToDataURI } from 'lively.morphic/rendering/morph-to-image.js';
import { localInterface } from 'lively-system-interface';
import { once } from 'lively.bindings/index.js';
import { adoptObject } from 'lively.lang/object.js';
import { DropDownList, DarkDropDownList } from 'lively.components/list.cp.js';
import { withAllViewModelsDo } from 'lively.morphic/components/policy.js';
import { ButtonDarkDefault, SystemButton } from 'lively.components/buttons.cp.js';
import { Text } from 'lively.morphic/text/morph.js';

import { COLORS } from '../js/browser/index.js';
import { Spinner, CheckboxInactive, CheckboxActive, LabeledCheckbox, DarkPopupWindow } from './shared.cp.js';
import { InteractiveComponentDescriptor } from '../components/editor.js';
import { PopupWindow, SystemList } from '../styling/shared.cp.js';
import { GreenButton } from 'lively.components/prompts.cp.js';

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
        if (!PackageRegistry.ofSystem(System).lookup(node.name)) {
          // if this is a project, load the project
          await importPackage(node.url);
        }
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
    return [...Icon.textAttribute('cube'), ' ' + string.truncate(componentObj.componentName || '[PARSE_ERROR]', 18, '…'), null];
  }

  /**
   * Returns the text attributes needed to display a package that contains a collection
   * of component files.
   */
  displayPackage (pkg, isSelected) {
    if (isSelected && !this.root.browser._pauseUpdates) {
      this.root.browser.reset();
    }
    const isOpenedProject = pkg.url === $world.openedProject?.package.url;
    return [
      ...Icon.textAttribute('cubes'),
      ' ' + string.truncate(pkg.name, 26, '…'), {
        fontWeight: isOpenedProject ? 'bold' : 'normal',
        fontStyle: pkg.kind === 'git' && !isOpenedProject ? 'italic' : 'normal'
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
    return await Project.listAvailableProjects();
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
      if (pkg.url?.startsWith('local')) kind = 'local';
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
      .filter(res => (res.isDirectory() || res.url.endsWith('.cp.js')) && !res.name().startsWith('.'));
    // ensure that the package is loaded at this point
    // ensure that we only list folders who will in turn have anything to show
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
      isInLocalProject: {
        derived: true,
        readOnly: true,
        get () {
          return $world.openedProject?.pkg.url === this.package.url;
        }
      },
      package: {
        get () {
          return module(this.component[Symbol.for('lively-module-meta')].moduleId).package();
        }
      },
      preview: {
        derived: true,
        set (url) {
          this.getSubmorphNamed('preview holder').imageUrl = url;
          this.fitPreview();
        }
      },
      defaultMaster: {
        isComponent: true,
        initialize () {
          this.defaultMaster = ComponentPreview; // eslint-disable-line no-use-before-define
        }
      },
      selectedMaster: {
        isComponent: true,
        initialize () {
          this.selectedMaster = ComponentPreviewSelected; // eslint-disable-line no-use-before-define
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
    try {
      const preview = part(this.component, { name: this.component.componentName });
      // disable view model
      // scale to fit
      // disable all mouse interaction
      const container = this.get('preview container');
      const maxExtent = pt(100, 70);
      preview.scale = 1;
      preview.scale = Math.min(maxExtent.x / preview.bounds().width, maxExtent.y / preview.bounds().height);
      preview.withAllSubmorphsDo(m => m.reactsToPointer = false);
      container.submorphs = [preview];
    } catch (err) {
      this.displayError(err);
    }
    this.get('component name').textString = string.decamelize(this.component.componentName);
  }

  displayError (err) {
    this.get('preview container').submorphs = [
      part(ComponentError, { submorphs: [{ name: 'error message', textString: err.message }] }) // eslint-disable-line no-use-before-define
    ];
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
    if (!this.component) return;
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
        auto: this.selectedMaster
      };
    } else {
      this.master = {
        auto: this.defaultMaster
      };
    }
  }
}

export class ProjectEntry extends Morph {
  static get properties () {
    return {
      exportedComponents: {
        derived: true,
        get () {
          return this.getSubmorphNamed('component previews').submorphs.map(m => m.component);
        }
      },
      selectedComponent: {
        derived: true,
        get () {
          const selectedPreview = this.getSubmorphNamed('component previews').submorphs.find(m => m.isSelected);
          return selectedPreview && selectedPreview.component;
        }
      },
      previewMaster: {
        isComponent: true,
        initialize () {
          this.previewMaster = ComponentPreview; // eslint-disable-line no-use-before-define
        }
      },
      selectedPreviewMaster: {
        isComponent: true,
        initialize () {
          this.selectedPreviewMaster = ComponentPreviewSelected; // eslint-disable-line no-use-before-define
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
    if (projectTitle.textBounds().containsPoint(evt.positionIn(projectTitle))) { this.openComponentWorld(); }
  }

  async openComponentWorld () {
    const selectedComponent = this.selectedComponent || this.exportedComponents[0];
    const { moduleId: moduleName, exportedName: name } = selectedComponent[Symbol.for('lively-module-meta')];
    await $world.execCommand('open browser', { moduleName, codeEntity: [{ name }] });
  }

  renderComponents (components) {
    const previewContainer = this.getSubmorphNamed('component previews');
    previewContainer.submorphs = components.map(cp => {
      let preview = previewContainer.submorphs.find(p => p.component === cp);
      if (!preview) {
        preview = part(this.previewMaster, {
          defaultMaster: this.previewMaster,
          selectedMaster: this.selectedPreviewMaster
        });
        preview.project = this;
        preview.component = cp;
      }
      return preview;
    });
    return this;
  }

  selectComponent (component) {
    this.owner.getSubmorphsByStyleClassName('ExportedComponent').forEach(m => m.select(false));
    component.select(true);
  }
}

export class NameSection extends ProjectEntry {
  static get properties () {
    return {
      char: {
        derived: true,
        set (name) {
          this.getSubmorphNamed('project title').value = [name, null];
        },
        get () {
          return this.getSubmorphNamed('project title').value[0];
        }
      }
    };
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
      sectionMaster: {
        initialize () {
          this.sectionMaster = ProjectSection; // eslint-disable-line no-use-before-define
        }
      },
      isPrompt: { get () { return true; } },
      isEpiMorph: {
        get () { return true; }
      },
      importAlive: {
        defaultValue: false
      },
      selectionMode: {
        defaultValue: false
      },
      groupBy: {
        type: 'Enum',
        values: ['name', 'module'],
        defaultValue: 'module'
      },
      db: {
        serialize: false,
        readOnly: true,
        get () { return MorphicDB.default; }
      },
      expose: {
        get () {
          return ['activate', 'isComponentBrowser', 'reset', 'isEpiMorph', 'close', 'isPrompt'];
        }
      }
    };
  }

  get bindings () {
    return [
      {
        target: 'close button',
        signal: 'onMouseUp',
        handler: 'close'
      },
      {
        target: 'import button',
        signal: 'fire',
        handler: 'importSelectedComponent'
      },
      {
        target: 'selection button',
        signal: 'fire',
        handler: 'chooseComponent'
      },
      { target: 'edit button', signal: 'fire', handler: 'editSelectedComponent' },
      {
        target: 'search input',
        signal: 'inputChanged',
        handler: 'filterAllComponents'
      },
      {
        signal: 'onKeyDown',
        handler: 'close',
        updater: ($reject, evt) => {
          if (evt.key === 'Escape') $reject();
        }
      },
      { signal: 'onMouseDown', handler: 'focus' },
      {
        signal: 'onMouseUp',
        handler: 'ensureButtonControls'
      },
      {
        signal: 'onMouseUp',
        handler: 'ensureComponentEntitySelected'
      },
      {
        target: 'behavior toggle',
        signal: 'clicked',
        handler: 'toggleBehaviorImport'
      }, {
        model: 'sorting selector',
        signal: 'selection',
        handler: 'changeComponentGrouping'
      },
      {
        target: 'search clear button',
        signal: 'onMouseDown',
        handler: 'resetSearchInput'
      }
    ];
  }

  focus () { this.view.bringToFront(); }

  ensureButtonControls () {
    const selectedComponent = this.getSelectedComponent();
    this.models.importButton.deactivated = !selectedComponent;
    this.models.editButton.deactivated = !selectedComponent || !selectedComponent.isInLocalProject;
    this.models.selectionButton.deactivated = !selectedComponent;
  }

  viewDidLoad () {
    if (!this.view.isComponent) {
      this.view.withMetaDo({ metaInteraction: true }, () => {
        this.ui.componentFilesView.setTreeData(new MasterComponentTreeData({ browser: this }));
      });
    }
  }

  onRefresh (change) {
    super.onRefresh(change);
    this.ui.behaviorToggle.setChecked(this.importAlive);
    this.handleColumnViewVisibility();
    this.ui.editButton.visible = !this.selectionMode;
    this.ui.behaviorToggle.visible = !this.selectionMode;
    this.ui.importButton.visible = !this.selectionMode;
    this.ui.selectionButton.visible = this.selectionMode;
  }

  handleColumnViewVisibility () {
    const { componentFilesView, searchInput } = this.ui;
    componentFilesView.visible = false;
    if (this.groupBy === 'name') {
      // do nothing really
    } else if (!searchInput.input) componentFilesView.visible = true;
  }

  get systemInterface () { return localInterface; }

  reset () {
    this.ui.masterComponentList.submorphs = [];
  }

  async activate (pos = false) {
    const { view } = this;
    view.doNotAcceptDropsForThisAndSubmorphs();
    this._promise = promise.deferred();
    view.openInWorld();
    view.clipMode = 'hidden';
    if (!pos) view.center = $world.visibleBounds().center();
    else view.position = pos;
    this.ui.searchInput.focus();
    this.ensureButtonControls();
    return this._promise.promise;
  }

  close () {
    if (this._promise) this._promise.resolve(null);
    this.view.remove();
  }

  async importSelectedComponent () {
    const selectedComponent = this.getSelectedComponent();
    const importedComponent = part(selectedComponent.component);
    if (!this.importAlive) {
      // activate the behavior
      withAllViewModelsDo(importedComponent, m => m.viewModel.detach());
    }
    importedComponent.openInWorld();
    this._promise.resolve(importedComponent);
    this.close();
  }

  chooseComponent () {
    this._promise.resolve(this.getSelectedComponent().component);
    this.close();
  }

  async editSelectedComponent () {
    const selectedComponent = this.getSelectedComponent();
    const editableComponent = await selectedComponent.component.edit();
    if (editableComponent) editableComponent.openInWorld();
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
    if (!mod.isLoaded()) {
      await mod.load();
    }
    const exports = await mod.exports();
    const componentDescriptors = exports
      .map(m => mod.recorder[m.exported])
      .filter(c => c && c.isComponentDescriptor);
    componentDescriptors.forEach(descr => adoptObject(descr, InteractiveComponentDescriptor));
    return componentDescriptors;
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
      const url = System.decanonicalize(selectedComponent.component[Symbol.for('lively-module-meta')].moduleId);
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

  toggleBehaviorImport () {
    this.importAlive = !this.importAlive;
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

  resetSearchInput () {
    this.ui.searchInput.clear();
    this.reset();
    if (this.groupBy === 'module') {
      const fileView = this.models.componentFilesView;
      const lastSelectedModule = fileView.getExpandedPath().find(m => m.type === 'cp.js');
      if (lastSelectedModule) { fileView.treeData.display(lastSelectedModule); }
    }
  }

  async filterAllComponents () {
    fun.debounceNamed('filterAllComponents', 200, async () => {
      this.toggleBusyState(true);
      const { importButton, componentFilesView, searchInput, searchClearButton } = this.ui;
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

      this.handleColumnViewVisibility();

      if (term === '') {
        searchClearButton.visible = false;
        this.toggleBusyState(false);
        return;
      }

      searchClearButton.visible = true;

      // filter the candidates and render the projects together with the matches
      let filteredIndex = {};
      await Promise.all(componentModules.map(async modUrl => {
        let components;
        try {
          components = await this.getComponentsInModule(modUrl);// retrieve the components exported in that module
        } catch (err) {
          return;
        }
        // get the matching components in the module
        components = components.filter(c => {
          return this.fuzzyMatch(parsedInput, c.componentName);
        });
        // store them in the filtered index if there is a match or more
        if (components.length > 0) filteredIndex[modUrl.replace(System.baseURL, '')] = components;
      }));

      if (this.groupBy === 'name') {
        const flattenedComponents = arr.flat(Object.values(filteredIndex));
        filteredIndex = arr.groupBy(flattenedComponents, c => c.componentName[0]);
      }
      // update the components list with the filtered projects
      this.updateList(filteredIndex, this.groupBy === 'name');
      importButton.viewModel.deactivated = !this.getSelectedComponent();
      this.toggleBusyState(false);
    })();
  }

  // componentsByWorlds = filteredIndex
  async updateList (componentsByWorlds, organizeByName) {
    const { masterComponentList } = this.ui;
    // do some smart updating of the list
    const newList = [];
    // remove all empty lists
    const orderedWorlds = arr.sortBy((componentsByWorlds['This Project'] ? ['This Project'] : []).concat(arr.without(Object.keys(componentsByWorlds), 'This Project')), m => m);

    for (const worldName of orderedWorlds) {
      newList.push(organizeByName
        ? this.renderComponentsByChar(worldName, componentsByWorlds[worldName])
        : this.renderComponentsInFile(worldName, componentsByWorlds[worldName]));
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

  renderComponentsByChar (char, componentsByChar) {
    const { masterComponentList } = this.ui;
    const currentList = masterComponentList.submorphs;

    const charGroup = currentList.find(item => item.char === char) || part(this.sectionMaster, { type: NameSection });
    charGroup.char = char;
    charGroup.renderComponents(componentsByChar);

    return charGroup;
  }

  renderComponentsInFile (fileName, componentsInFile) {
    const { masterComponentList } = this.ui;
    const currentList = masterComponentList.submorphs;
    const projectEntry = currentList.find(item => item.worldName === fileName) || part(this.sectionMaster);

    projectEntry.worldName = fileName;
    projectEntry.renderComponents(componentsInFile);

    return projectEntry;
  }

  showComponentsInFile (fileName, componentsInFile) {
    const { masterComponentList } = this.ui;
    const projectEntry = this.renderComponentsInFile(fileName, componentsInFile);
    masterComponentList.submorphs = [projectEntry];
    masterComponentList.layout.setResizePolicyFor(projectEntry, {
      width: 'fill', height: 'fixed'
    });
  }

  changeComponentGrouping (groupBy) {
    this.groupBy = groupBy;
    this.resetSearchInput();
  }
}

const ComponentPreview = component({
  type: ExportedComponent,
  name: 'component preview',
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(5, 5, 0, 0),
    spacing: 5,
    wrapSubmorphs: false
  }),
  borderColor: Color.rgb(33, 150, 243),
  borderRadius: 5,
  borderWidth: 0,
  extent: pt(129.5, 128.4),
  fill: Color.transparent,
  draggable: true,
  nativeCursor: 'grab',
  submorphs: [{
    name: 'preview container',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      orderByIndex: true
    }),
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(120, 100),
    fill: Color.rgba(0, 0, 0, 0),
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

const ComponentPreviewDark = component(ComponentPreview, {
  submorphs: [{
    name: 'component name',
    fontColor: Color.rgb(204, 204, 204)
  }]
});

const ComponentPreviewSelected = component(ComponentPreview, {
  name: 'component preview selected',
  borderColor: Color.rgb(33, 150, 243),
  borderWidth: 2,
  fill: Color.rgba(3, 169, 244, 0.75),
  submorphs: [{
    name: 'component name',
    fontColor: Color.white
  }]
});

const ComponentPreviewSelectedDark = component(ComponentPreview, {
  borderColor: Color.rgb(52, 138, 117),
  borderWidth: 2,
  fill: Color.rgba(100, 255, 218, 0.6),
  submorphs: [{
    name: 'component name',
    fontColor: Color.rgb(255, 255, 255)
  }]
});

const ProjectSection = component({
  type: ProjectEntry,
  name: 'project section',
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['project title', {
      height: 'fixed',
      width: 'fill'
    }], ['component previews', {
      height: 'fixed',
      width: 'fill'
    }]],
    wrapSubmorphs: false
  }),
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(488.6, 154.2),
  fill: Color.rgba(0, 0, 0, 0),
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
      hugContentsVertically: true,
      orderByIndex: true,
      padding: rect(10, 10, 0, 0),
      spacing: 10,
      wrapSubmorphs: true
    })
  }]
});

const ProjectSectionDark = component(ProjectSection, {
  previewMaster: ComponentPreviewDark,
  selectedPreviewMaster: ComponentPreviewSelectedDark,
  submorphs: [{
    name: 'project title',
    fontColor: Color.rgb(204, 204, 204),
    borderColor: Color.rgb(130, 130, 130)
  }]
});

const CheckboxActiveLight = component(CheckboxActive, {
  fill: Color.rgb(66, 165, 245),
  fontColor: Color.rgb(255, 255, 255)
});

const CheckboxInactiveLight = component(CheckboxInactive, {
  borderColor: Color.rgb(66, 66, 66)
});

const ComponentBrowser = component(PopupWindow, {
  defaultViewModel: ComponentBrowserModel,
  styleClasses: [],
  hasFixedPosition: false,
  extent: pt(515, 658),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    add({
      name: 'controls',
      fill: Color.rgba(255, 255, 255, 0),
      extent: pt(515.1, 599.9),
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        orderByIndex: true,
        padding: rect(16, 16, 0, 0),
        resizePolicies: [['search input wrapper', {
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
        spacing: 16
      }),
      submorphs: [{
        name: 'search input wrapper',
        layout: new TilingLayout({
          axisAlign: 'center',
          orderByIndex: true,
          padding: rect(8, 0, -8, 0),
          resizePolicies: [['search input', {
            height: 'fixed',
            width: 'fill'
          }]]
        }),
        fill: Color.rgb(238, 238, 238),
        borderRadius: 3,
        borderColor: Color.rgb(23, 160, 251),
        extent: pt(388.4, 42.6),
        position: pt(120, 541),
        submorphs: [{
          type: Text,
          name: 'search icon',
          lineHeight: 2,
          extent: pt(17.5, 18),
          fontSize: 14,
          fontColor: Color.rgba(0, 0, 0, 0.5),
          cursorWidth: 1.5,
          fixedWidth: true,
          padding: rect(1, 1, 0, 0),
          scale: 1.32,
          textAndAttributes: ['', {
            fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
            fontWeight: '900',
            lineHeight: 1,
            textStyleClasses: ['fas']
          }]
        }, part(InputLineDefault, {
          name: 'search input',
          dropShadow: null,
          highlightWhenFocused: false,
          borderColor: Color.rgb(224, 224, 224),
          borderRadius: 2,
          extent: pt(445.3, 34.3),
          fill: Color.rgba(238, 238, 238, 0),
          padding: rect(6, 4, -4, 2),
          position: pt(11.9, 3.8),
          placeholder: 'Search for components...'
        }), part(Spinner, {
          name: 'spinner',
          opacity: .7,
          viewModel: { color: 'black' },
          visible: false
        }), {
          type: Text,
          name: 'search clear button',
          nativeCursor: 'pointer',
          visible: false,
          fontColor: Color.rgba(0, 0, 0, 0.5),
          fontSize: 25,
          lineHeight: 2,
          padding: rect(1, 1, 9, 0),
          textAndAttributes: ['', {
            fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
            fontWeight: '900',
            lineHeight: 1,
            textStyleClasses: ['fas']
          }]
        }]
      }, part(MullerColumnView, {
        name: 'component files view',
        viewModel: { listMaster: ColumnListDefault },
        borderColor: Color.rgb(149, 165, 166),
        borderWidth: 1,
        fill: Color.rgba(229, 231, 233, 0.05),
        extent: pt(483, 150),
        borderRadius: 2
      }), {
        name: 'master component list',
        borderColor: Color.rgb(149, 165, 166),
        borderWidth: 1,
        borderRadius: 2,
        fill: Color.rgba(229, 231, 233, 0.05),
        clipMode: 'auto',
        extent: pt(640, 304),
        layout: new TilingLayout({
          wrapSubmorphs: false,
          axis: 'column'
        })
      }, {
        name: 'button wrapper',
        height: 33.92421875,
        clipMode: 'visible',
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'right',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          spacing: 15
        }),
        submorphs: [part(DropDownList, {
          name: 'sorting selector',
          extent: pt(149.6, 25),
          viewModel: {
            openListInWorld: true,
            listMaster: SystemList,
            items: [
              {
                isListItem: true,
                label: [...Icon.textAttribute('boxes'), '  By module', null],
                tooltip: 'Group the components by the modules they are defined in.',
                value: 'module'
              },
              {
                isListItem: true,
                label: [...Icon.textAttribute('tag', { paddingLeft: '2px', paddingTop: '2px' }), '  By name', null],
                tooltip: 'Group the components by their names',
                value: 'name'
              }
            ]
          },
          submorphs: [{
            name: 'label',
            textAndAttributes: ['Arrange by name', null]
          }]
        }), part(LabeledCheckbox, {
          name: 'behavior toggle',
          layout: new TilingLayout({
            axisAlign: 'center',
            orderByIndex: true,
            padding: rect(10, 8, -10, 0),
            resizePolicies: [['checkbox', {
              height: 'fill',
              width: 'fixed'
            }]]
          }),
          activeCheckboxComponent: CheckboxActiveLight,
          inactiveCheckboxComponent: CheckboxInactiveLight,
          extent: pt(126.2, 32.5),
          submorphs: [{
            name: 'checkbox',
            width: 15,
            master: CheckboxActiveLight
          }, {
            name: 'prop label',
            fontColor: Color.rgb(0, 0, 0),
            textAndAttributes: ['Enable behavior', null]
          }]
        }), part(SystemButton, {
          name: 'edit button',
          extent: pt(80, 23.8),
          submorphs: [{
            name: 'label',
            textAndAttributes: [...Icon.textAttribute('edit', { fontColor: Color.rgbHex('D32F2F') }), ' Edit', {
              fontFamily: 'IBM Plex Sans'
            }]
          }]
        }), part(SystemButton, {
          name: 'import button',
          extent: pt(80, 23.8),
          submorphs: [{
            name: 'label',
            textAndAttributes: ['', {
              fontColor: Color.rgb(74, 174, 79),
              fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
              fontWeight: '900',
              lineHeight: 1,
              textStyleClasses: ['fas']
            }, ' Import', {
              fontFamily: 'IBM Plex Sans'
            }]

          }]
        }), add(part(SystemButton, {
          name: 'selection button',
          visible: false,
          extent: pt(80, 23.8),
          layout: new TilingLayout({
            align: 'center',
            axisAlign: 'center'
          }),
          submorphs: [{
            name: 'label',
            textAndAttributes: ['Select', null]
          }]
        }))]
      }]
    }), {
      name: 'header menu',
      submorphs: [{
        name: 'title',
        fontSize: 18,
        reactsToPointer: false,
        textAndAttributes: ['Browse Components', null]
      }]
    }
  ]
});

const ComponentBrowserDark = component(ComponentBrowser, {
  master: DarkPopupWindow,
  viewModel: {
    sectionMaster: ProjectSectionDark
  },
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [{
    name: 'controls',
    submorphs: [{
      name: 'search input wrapper',
      fill: Color.rgb(122, 122, 122),
      submorphs: [{
        name: 'search icon',
        fontColor: Color.rgba(255, 255, 255, 0.5)
      }, {
        name: 'search input',
        fontColor: Color.rgbHex('B2EBF2')
      }, {
        name: 'spinner',
        viewModel: { color: 'white' },
        visible: false,
        position: pt(456.6, 4.4),
        scale: 0.35
      }, {
        name: 'search clear button',
        fontColor: Color.rgba(255, 255, 255, 0.69)
      }]
    }, {
      name: 'component files view',
      borderColor: Color.rgb(112, 123, 124),
      borderWidth: 1,
      viewModel: { listMaster: ColumnListDark }
    },
    {
      name: 'master component list',
      borderColor: Color.rgb(112, 123, 124),
      borderWidth: 1
    },
    {
      name: 'button wrapper',
      submorphs: [
        {
          name: 'sorting selector',
          master: DarkDropDownList
        },
        {
          name: 'behavior toggle',
          master: LabeledCheckbox,
          activeCheckboxComponent: CheckboxActive,
          inactiveCheckboxComponent: CheckboxInactive
        }, {
          name: 'edit button',
          master: ButtonDarkDefault,
          submorphs: [{
            name: 'label',
            fontColor: Color.rgb(255, 255, 255),
            textAndAttributes: ['', {
              fontColor: Color.rgbHex('B2EBF2'),
              fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
              fontWeight: '900',
              lineHeight: 1,
              textStyleClasses: ['fas']
            }, ' Edit', {
              fontFamily: 'IBM Plex Sans'
            }]
          }]
        }, {
          name: 'import button',
          master: ButtonDarkDefault,
          submorphs: [{
            name: 'label',
            textAndAttributes: ['', {
              fontColor: Color.rgbHex('B2EBF2'),
              fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
              fontWeight: '900',
              lineHeight: 1,
              textStyleClasses: ['fas']
            }, ' Import', {
              fontFamily: 'IBM Plex Sans'
            }]
          }]
        }, {
          name: 'selection button', master: ButtonDarkDefault
        }]
    }]
  }]
});

const ComponentError = component({
  name: 'component error',
  nativeCursor: 'not-allowed',
  borderStyle: 'none',
  borderColor: Color.rgb(189, 189, 189),
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.52), blur: 15 }),
  borderWidth: 2,
  borderRadius: 10,
  extent: pt(159.8, 159),
  fill: Color.rgba(0, 0, 0, 0.6719),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(10, 10, 0, 0),
    resizePolicies: [['error message', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10
  }),
  position: pt(693.4, 588.2),
  submorphs: [{
    name: 'backdrop',
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(10.6, 31.4),
    position: pt(7, 43),
    reactsToPointer: false,
    submorphs: [{
      type: Text,
      name: 'warning sign',
      cursorWidth: 1.5,
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(255, 171, 64),
      fontSize: 48,
      reactsToPointer: false,
      lineWrapping: true,
      padding: rect(1, 1, 0, 0),
      position: pt(-19.7, -13.6),
      textAndAttributes: ['', {
        fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
        fontWeight: '900',
        lineHeight: 1,
        textStyleClasses: ['fas']
      }]
    }]
  }, {
    type: Text,
    name: 'error message',
    height: 70.91015625,
    fontWeight: 700,
    cursorWidth: 1.5,
    fill: Color.rgba(255, 255, 255, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(255, 255, 255),
    lineWrapping: true,
    reactsToPointer: false,
    padding: rect(1, 1, 0, 0),
    position: pt(10, 81),
    textAlign: 'center',
    textString: 'This is not an error I would display explaining what went wrong.'
  }]
});

export {
  ComponentBrowser,
  ComponentBrowserDark,
  ComponentPreview,
  ComponentPreviewSelected,
  ProjectSection,
  ComponentError
};
