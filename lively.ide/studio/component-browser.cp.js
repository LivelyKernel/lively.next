import { pt, Color, rect } from 'lively.graphics';
import { TilingLayout, morph, config, easings, MorphicDB, Icon, Morph, Label, ShadowObject, ViewModel, add, part, component } from 'lively.morphic';
import { Project } from 'lively.project';
import { isModuleLoaded, module } from 'lively.modules';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { MullerColumnView, ColumnListDark, ColumnListDefault } from 'lively.components/muller-columns.cp.js';
import { TreeData, LabeledCheckbox, LabeledCheckboxLight } from 'lively.components';
import { arr, promise, num, date, string, fun } from 'lively.lang';
import { resource } from 'lively.resources';
import { renderMorphToDataURI } from 'lively.morphic/rendering/morph-to-image.js';
import { localInterface } from 'lively-system-interface';
import { once, noUpdate } from 'lively.bindings/index.js';
import { adoptObject } from 'lively.lang/object.js';
import { DropDownList, DarkDropDownList } from 'lively.components/list.cp.js';
import { withAllViewModelsDo } from 'lively.morphic/components/policy.js';
import { ButtonDarkDefault, SystemButton } from 'lively.components/buttons.cp.js';
import { Text } from 'lively.morphic/text/morph.js';
import { COLORS } from '../js/browser/index.js';
import { Spinner, DarkPopupWindow } from './shared.cp.js';
import { InteractiveComponentDescriptor } from '../components/editor.js';
import { PopupWindow, SystemList } from '../styling/shared.cp.js';
import { joinPath } from 'lively.lang/string.js';
import { runCommand } from 'lively.shell/client-command.js';
import ShellClientResource from 'lively.shell/client-resource.js';
import { StatusMessageError, StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';

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
    if (!bool && node.type === 'package loader') {
      // clear the selection
      this.columnView.reset();
      this.interactivelyImportProject();
      return;
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
    } else if (type === 'package loader') {
      return this.renderPackageLoader();
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

  renderPackageLoader () {
    return [...Icon.textAttribute('ti-square-rounded-arrow-right', { fontColor: Color.darkGray }), ' Import project...', {
      fontColor: Color.darkGray,
      fontWeight: 'bold',
      fontStyle: 'italic',
      nativeCursor: 'pointer'
    }];
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
  displayComponentFile (modUrl, isSelected, isLoaded, url) {
    if (isSelected && !this.root.browser._pauseUpdates) {
      const mod = module(url);
      const pkg = mod.package();
      const isOpenedProject = pkg && pkg.url === $world.openedProject?.package.url;
      modUrl = arr.last(modUrl.split('--'));
      this.getComponentsInModule(url).then(components => {
        this.root.browser.showComponentsInFile(modUrl, components, isOpenedProject);
      });
    }

    return [
      ...Icon.textAttribute('shapes', {
        fontColor: isSelected ? Color.white : COLORS.cp,
        opacity: isLoaded ? 1 : 0.5
      }),
      ' ' + string.truncate(modUrl.replace('.cp.js', ''), 24, '…'), null
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

  async interactivelyImportProject () {
    const availableProjects = await Project.listAvailableProjects();
    const notLoaded = availableProjects
      .filter(proj => !isModuleLoaded(joinPath(proj.url, proj.main || 'index.js')))
      .map(proj => ({
        isListItem: true,
        value: proj,
        tooltip: `${proj.name} by ${proj.projectRepoOwner} at version ${proj.version}`,
        label: [
          proj.name, {},
          proj.version, {
            paddingLeft: '5px',
            fontSize: '70%',
            textStyleClasses: ['truncated-text', 'annotation']
          }
        ]
      }));
    const win = this.root.browser.view.getWindow();
    const { selected: [projectToLoad] } = await $world.filterableListPrompt('Select project to import', notLoaded, {
      requester: win,
      multiSelect: false
    });
    if (projectToLoad) {
      await $world.withLoadingIndicatorDo(async () => {
        await Project.loadProject(projectToLoad.name, true);
        this.root.subNodes = await this.listAllComponentCollections();
        this.columnView.refresh();
      }, win, 'Importing project...');
    }
  }

  /**
   * Returns all the custom project inside the lively.next projects folder
   * that may contain custom component definitions.
   * @todo Implement this feature.
   */
  async getCustomLocalProjects () {
    return (await Project.listAvailableProjects()).filter(({ main = 'index.js', url }) => {
      return isModuleLoaded(joinPath(url, main));
    });
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
    let coll = await this.getComponentCollections();
    coll = arr.sortBy(coll.map(pkg => {
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
    if (!this.root.browser.selectionMode) {
      coll.push({
        type: 'package loader',
        isCollapsed: true,
        tooltip: 'Import additional project'
      });
    }
    return coll;
  }

  async listComponentFilesInPackage (pkg) {
    return await this.listComponentFilesInDir(pkg);
  }

  async getLoadedComponentFileUrls () {
    const selectedPkg = this.root.subNodes.find(pkg => !pkg.isCollapsed);
    if (!selectedPkg) return {};
    const files = await resource(selectedPkg.url).dirList(1, {
      exclude: (res) => {
        if (res.url.includes('assets')) return true;
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
    const resources = (await resource(folderLocation).dirList(10, {
      exclude: (res) => {
        if (res.name() === 'assets' || res.name() === 'test') return true;
        return !((res.url.endsWith('.cp.js') || res.isDirectory()) && !res.name().startsWith('.'));
      }
    }));
    // ensure that the package is loaded at this point
    // ensure that we only list folders who will in turn have anything to show
    const files = arr.compact(await Promise.all(resources.map(async res => {
      let type;
      if (res.isDirectory()) {
        type = 'directory';
        if ((await this.listComponentFilesInDir(res.url)).length === 0) return;
      } else {
        type = 'cp.js';
        if ((await res.read()).match(/['"]skip listing['"];/)) return;
        if (res.url.endsWith('.cp.js') && (await this.getComponentsInModule(res.url)).length === 0) return;
      }
      return {
        isCollapsed: true,
        name: res.name(),
        size: res.size,
        lastModified: res.lastModified,
        url: res.url,
        type
      };
    })));

    const loadedFiles = await this.getLoadedComponentFileUrls();
    return files.map(file => {
      file.isLoaded = !!loadedFiles[file.url];
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
      isInOpenedProject: {
        derived: true,
        readOnly: true,
        get () {
          return $world.openedProject?.package.url === this.package.url;
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
      const preview = part(this.component, { defaultViewModel: null, name: this.component.componentName });
      const container = this.get('preview container');
      const maxExtent = pt(100, 70);
      container.clipMode = 'hidden';
      preview.scale = 1;
      // This is needed since the centering via css layouts gets currently quite
      // confused when transforms are applied (scale, rotation)
      const previewBoundsWrapper = morph({ fill: Color.transparent, reactsToPointer: false, extent: preview.bounds().extent(), submorphs: [preview] });
      preview.topLeft = pt(0, 0);
      previewBoundsWrapper.scale = Math.min(maxExtent.x / previewBoundsWrapper.bounds().width, maxExtent.y / previewBoundsWrapper.bounds().height);
      container.submorphs = [previewBoundsWrapper];
      preview.withAllSubmorphsDo(m => m.reactsToPointer = false);
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
    const maxWidth = 130;
    const maxHeight = 130;
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

    if (!this.componentBrowser.importAlive) {
      // disable the behavior
      withAllViewModelsDo(instance, m => m.viewModel.detach());
    }
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
      if (this.componentBrowser.globalBounds().containsPoint(hand.position)) {
        instance.openInWorld(hand.position);
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
    if (this._navigationDisabled) return;
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

  disableNavigation () {
    this._navigationDisabled = true;
    this.getSubmorphNamed('project title').nativeCursor = 'auto';
    this.getSubmorphNamed('project title').value = [this.worldName, {}];
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
      SearchComponentsNotice: {
        initialize () { this.SearchComponentsNotice = SearchComponentsNotice; }
      },
      isPrompt: { get () { return true; } },
      isEpiMorph: {
        get () { return true; }
      },
      isHaloItem: { get () { return true; } },
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
          return ['activate', 'isComponentBrowser', 'reset', 'isEpiMorph', 'close',
            'isPrompt', 'isHaloItem', 'onWindowClose', 'menuItems', 'importAlive'];
        }
      }
    };
  }

  menuItems () {
    const checked = Icon.textAttribute('check-square', { paddingRight: '3px' });
    const unchecked = Icon.textAttribute('square', { paddingRight: '3px' });
    return [
      ['Import project...', () => {
        this.ui.componentFilesView.treeData.interactivelyImportProject();
      }],
      [[...this.importAlive ? checked : unchecked, ' Enable behavior'], () => this.importAlive = !this.importAlive],
      ['Group Components by ', [
        [[...this.groupBy === 'module' ? checked : unchecked, ' Modules'], () => { this.groupBy = 'module'; }],
        [[...this.groupBy === 'name' ? checked : unchecked, ' Names'], () => { this.groupBy = 'name'; }]
      ]]
    ];
  }

  get bindings () {
    return [
      {
        signal: 'onWindowClose',
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
        target: /component files view|master component list/,
        signal: 'onMouseUp',
        handler: 'ensureButtonControls'
      },
      { signal: 'onHoverIn', handler: 'refresh' },
      {
        signal: 'onMouseUp',
        handler: 'ensureComponentEntitySelected'
      },
      {
        target: 'behavior toggle',
        signal: 'checked',
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
    this.models.editButton.deactivated = !selectedComponent || !selectedComponent.isInOpenedProject;
    if (this.models.editButton.deactivated) this.ui.editButton.tooltip = 'You can not edit this component, since it is outside of your current project.';
    else {
      this.ui.editButton.tooltip = 'Click to start editing this component.\nNote that changes to this component will\npropagate throughout your project.';
      this.models.selectionButton.deactivated = !selectedComponent;
    }
  }

  viewDidLoad () {
    if (!this.view.isComponent) {
      this.view.withMetaDo({ metaInteraction: true }, () => {
        this.ui.componentFilesView.setTreeData(new MasterComponentTreeData({ browser: this }));
      });
    }
    const openedProject = $world.openedProject;
    if (!(openedProject.owner === 'LivelyKernel' && openedProject.name === 'partsbin') && !$world._partsbinUpdated) {
      const li = $world.showLoadingIndicatorFor(null, 'Updating `partsbin`');
      // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
      // `install.sh` ensures that the partsbin repository exists.
      // As users should fork the partsbin to contribute, no special precaution is taken here when stashing.
      const cmd = runCommand('cd ../local_projects/LivelyKernel--partsbin && git stash && git checkout main && git pull', { l2lClient: ShellClientResource.defaultL2lClient });
      cmd.whenDone().then(() => {
        if (cmd.exitCode !== 0) {
          $world.setStatusMessage('`partsbin` could not be updated.', StatusMessageError);
          return;
        }
        $world.setStatusMessage('`partsbin` updated!', StatusMessageConfirm);
        $world._partsbinUpdated = true;
        li.remove();
      });
    }
  }

  async refresh () {
    const selectedModule = this.getSelectedModule();
    const { componentFilesView, searchInput } = this.ui;
    if (!selectedModule && searchInput.input) {
      await componentFilesView.setTreeData(new MasterComponentTreeData({ browser: this }));
      this.filterAllComponents();
      return;
    }
    if (selectedModule) {
      delete selectedModule.subNodes;
      componentFilesView.treeData.collapse(selectedModule, false);
      componentFilesView.treeData.display(selectedModule);
    }
    await this.view.whenRendered();
  }

  onRefresh (change) {
    super.onRefresh(change);
    this.ui.behaviorToggle.checked = this.importAlive;
    this.handleColumnViewVisibility();
    this.ui.editButton.visible = !this.selectionMode && config.ide.studio.componentEditViaComponentBrowser;
    this.ui.behaviorToggle.visible = !this.selectionMode;
    this.ui.importButton.visible = !this.selectionMode;
    this.ui.selectionButton.visible = this.selectionMode;
    noUpdate(() => this.ui.sortingSelector.selection = this.groupBy);
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
    this.ui.componentFilesView.scroll = pt(0, 0);
  }

  async activate (pos = false) {
    this.ui.editButton.visible = config.ide.studio.componentEditViaComponentBrowser;
    this._promise = promise.deferred();
    this.ui.searchInput.focus();
    this.ensureButtonControls();
    return this._promise.promise;
  }

  onWindowClose () { this.close(); }

  close () {
    if (this._promise) this._promise.resolve(null);
  }

  async importSelectedComponent () {
    const selectedComponent = this.getSelectedComponent();
    const importedComponent = part(selectedComponent.component);
    if (!this.importAlive) {
      // disable the behavior
      withAllViewModelsDo(importedComponent, m => m.viewModel.detach());
    }
    importedComponent.openInWorld();
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
    if (source.includes('component-browser skip')) return [];
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
    if (!evt.isClickTarget(this.ui.masterComponentList) ||
        !this.ui.componentFilesView.visible) return;

    const selectedComponent = this.getSelectedComponent();
    if (selectedComponent) {
      // expand path until node selected
      this.showComponentInFilesView(selectedComponent.component);
    }
  }

  async showComponentInFilesView (aComponentDescriptor) {
    const { treeData: td, _selectedNode: n } = this.models.componentFilesView;
    if (n && n.componentObject === aComponentDescriptor) return;
    const url = System.decanonicalize(aComponentDescriptor[Symbol.for('lively-module-meta')].moduleId);
    await this.withoutUpdates(() => this.models.componentFilesView.setExpandedPath(node => {
      if (node === td.root) return true;
      if (node.url) {
        return url.startsWith(node.url);
      }
      if (node.componentObject === aComponentDescriptor) {
        // ensure the component list to be ready
        this.models.componentFilesView._selectedNode = node;
        return true;
      }
    }, td.root, false));
  }

  getSelectedComponent () {
    return this.view.getSubmorphsByStyleClassName('ExportedComponent').find(component => component.isSelected);
  }

  getSelectedModule () {
    if (!this.ui.componentFilesView.visible) return false;
    const fileView = this.models.componentFilesView;
    return fileView.getExpandedPath().find(m => m.type === 'cp.js');
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

  resetSearchInput () {
    this.ui.searchInput.clear();
    this.reset();
    if (this.groupBy === 'module') {
      const fileView = this.models.componentFilesView;
      const lastSelectedModule = fileView.getExpandedPath().find(m => m.type === 'cp.js');
      if (lastSelectedModule) { fileView.treeData.display(lastSelectedModule); } else this.ui.masterComponentList.submorphs = [];
    }
    if (this.groupBy === 'name') {
      this.showSearchComponensNotice();
    }
  }

  async filterAllComponents () {
    fun.debounceNamed('filterAllComponents', 200, async () => {
      this.toggleBusyState(true);
      const { importButton, componentFilesView, searchInput, searchClearButton } = this.ui;
      const term = searchInput.input;
      const parsedInput = this.parseInput();

      const rootUrls = arr.compact(componentFilesView.treeData.root.subNodes?.map(m => m.url).slice(1)); // ignore the popular stuff

      if (!rootUrls) return setTimeout(() => this.filterAllComponents(), 200);
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
      const mod = module(worldName);
      const pkg = mod.package();
      const isOpenedProject = pkg && pkg.url === $world.openedProject?.package.url;
      newList.push(organizeByName
        ? this.renderComponentsByChar(worldName, componentsByWorlds[worldName])
        : this.renderComponentsInFile(
          joinPath(mod.package().name, mod.pathInPackage()),
          componentsByWorlds[worldName],
          isOpenedProject)
      );
    }

    masterComponentList.clipMode = 'auto';
    masterComponentList.submorphs = newList;
    // ensure that all of the sections are fitted
    for (let section of newList) { masterComponentList.layout.setResizePolicyFor(section, { width: 'fill', height: 'fixed' }); }
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

  renderComponentsInFile (fileName, componentsInFile, enableNavigation) {
    const { masterComponentList } = this.ui;
    const currentList = masterComponentList.submorphs;
    const projectEntry = currentList.find(item => item.worldName === fileName) || part(this.sectionMaster);

    projectEntry.worldName = arr.last(fileName.split('--'));
    projectEntry.renderComponents(componentsInFile);

    if (!enableNavigation) projectEntry.disableNavigation();

    return projectEntry;
  }

  showSearchComponensNotice () {
    const { masterComponentList } = this.ui;
    const { SearchComponentsNotice } = this;
    const notice = part(SearchComponentsNotice);
    masterComponentList.clipMode = 'hidden';
    masterComponentList.submorphs = [notice];
    masterComponentList.layout.setResizePolicyFor(notice, {
      width: 'fill', height: 'fill'
    });
  }

  showComponentsInFile (fileName, componentsInFile, activeNavigation) {
    const { masterComponentList } = this.ui;

    if (componentsInFile.length === 0) {
      masterComponentList.submorphs = [];
      return;
    }

    const projectEntry = this.renderComponentsInFile(fileName, componentsInFile, activeNavigation);
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

class ComponentBrowserPopupModel extends ComponentBrowserModel {
  get bindings () {
    return [
      ...super.bindings,
      {
        target: 'close button',
        signal: 'onMouseUp',
        handler: 'close'
      }
    ];
  }

  get expose () {
    return [...super.expose, 'browse'];
  }

  async browse (aComponent) {
    await this.showComponentInFilesView(aComponent);
    await this.refresh();
    this.selectComponent(aComponent);
  }

  async activate (pos) {
    // popup specific
    const { view } = this;
    view.doNotAcceptDropsForThisAndSubmorphs();
    view.openInWorld();
    view.clipMode = 'hidden';
    if (!pos) view.center = $world.visibleBounds().center();
    else view.position = pos;

    return await super.activate();
  }

  close () {
    super.close();
    this.view.remove();
  }
}

const ComponentPreview = component({
  type: ExportedComponent,
  name: 'component preview',
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(5, 5, 0, 0),
    resizePolicies: [['component name', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 5
  }),
  borderColor: Color.transparent,
  borderRadius: 5,
  borderWidth: 2,
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
    type: 'text',
    name: 'component name',
    textAlign: 'center',
    fontColor: Color.darkGray,
    fixedWidth: true,
    fixedHeight: false,
    lineWrapping: true,
    fontSize: 14,
    fontWeight: 'bold',
    clipMode: 'hidden',
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
      paddingTop: '3px'
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
      spacing: 30,
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

const SearchComponentsNotice = component({
  extent: pt(663.7, 592.1),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true
  }),
  fill: Color.rgba(255, 255, 255, 0),
  submorphs: [
    {
      type: Text,
      name: 'component box',
      extent: pt(164, 231),
      dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.16), blur: 15, fast: false }),
      fontColor: Color.rgba(0, 0, 0, 0.25),
      fontSize: 164,
      fontWeight: 700,
      position: pt(-5, 26),
      textAndAttributes: ['', {
        fontFamily: 'Tabler Icons',
        fontWeight: '900'
      }]

    }, {
      type: 'text',
      name: 'notice',
      textAlign: 'center',
      fixedWidth: true,
      fontColor: Color.rgba(0, 0, 0, 0.25),
      dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.16), blur: 15, fast: false }),
      fontSize: 34,
      fontWeight: 700,
      lineWrapping: true,
      textAndAttributes: ['Begin searching to display components...', null],
      extent: pt(354.6, 191)
    }]
});

const SearchComponentsNoticeDark = component(SearchComponentsNotice, {
  submorphs: [{
    name: 'component box',
    fontColor: Color.rgba(255, 255, 255, 0.25)
  }, {
    name: 'notice',
    fontColor: Color.rgba(255, 255, 255, 0.25)
  }]
});

const ComponentBrowser = component({
  defaultViewModel: ComponentBrowserModel,
  reactsToPointer: false,
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
    borderRadius: 3,
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(388.4, 42.6),
    position: pt(120, 541),
    submorphs: [{
      type: Text,
      name: 'search icon',
      extent: pt(17.5, 18),
      fontSize: 18,
      fontColor: Color.rgba(0, 0, 0, 0.5),
      cursorWidth: 1.5,
      fixedWidth: true,
      padding: rect(1, 1, 0, 0),
      textAndAttributes: ['', {
        fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
        fontWeight: '900',
        lineHeight: 1.2
      }]
    }, part(InputLineDefault, {
      name: 'search input',
      dropShadow: null,
      highlightWhenFocused: false,
      borderColor: Color.rgb(224, 224, 224),
      borderRadius: 2,
      extent: pt(445.3, 34.3),
      fill: Color.rgba(255, 255, 255, 0),
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
        lineHeight: 1
      }]
    }]
  }, part(MullerColumnView, {
    name: 'component files view',
    viewModel: { listMaster: ColumnListDefault },
    borderColor: Color.rgb(149, 165, 166),
    borderWidth: 1,
    extent: pt(483, 150),
    borderRadius: 2
  }), {
    name: 'master component list',
    borderColor: Color.rgb(149, 165, 166),
    borderWidth: 1,
    borderRadius: 2,
    fill: Color.rgb(238, 238, 238),
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
      orderByIndex: true,
      resizePolicies: [['behavior toggle', {
        height: 'fixed',
        width: 'fill'
      }]],
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

    }), part(LabeledCheckboxLight, {
      name: 'behavior toggle',
      viewModel: { label: 'Enable behavior' }
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
          lineHeight: 1
        }, ' Open', {
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
});

const ComponentBrowserPopup = component(PopupWindow, {
  defaultViewModel: ComponentBrowserPopupModel,
  hasFixedPosition: false,
  extent: pt(515, 658),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    add(part(ComponentBrowser, {
      defaultViewModel: null,
      name: 'controls',
      submorphs: [{
        name: 'search input wrapper',
        fill: Color.rgb(238, 238, 238)
      }]
    })),
    {
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

const ComponentBrowserPopupDark = component(ComponentBrowserPopup, {
  master: DarkPopupWindow,
  viewModel: {
    sectionMaster: ProjectSectionDark,
    SearchComponentsNotice: SearchComponentsNoticeDark
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
      fill: Color.rgba(255, 255, 255, 0.1),
      borderColor: Color.rgb(112, 123, 124),
      borderWidth: 1,
      viewModel: { listMaster: ColumnListDark }
    },
    {
      name: 'master component list',
      fill: Color.rgba(238, 238, 238, 0.1),
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
          submorphs: [{
            name: 'label',
            textAndAttributes: ['Enable behavior', null],
            fontColor: Color.white
          }]
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
              lineHeight: 1
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
              lineHeight: 1
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
        lineHeight: 1
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
  ComponentBrowserPopup,
  ComponentBrowserPopupDark,
  ComponentPreview,
  ComponentPreviewSelected,
  ComponentPreviewDark,
  ComponentPreviewSelectedDark,
  ProjectSection,
  ComponentError
};
