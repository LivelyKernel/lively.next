import { pt, LinearGradient, rect, Color } from 'lively.graphics';
import { connect, disconnect, signal } from 'lively.bindings';
import { arr } from 'lively.lang';
import { Label, TilingLayout, Icon, component, part, ViewModel } from 'lively.morphic';

class TabCloseButton extends Label {
  get tab () {
    return this.owner.owner;
  }

  onMouseUp () {
    this.owner.owner.close();
  }
}

const DefaultTab = component({
  name: 'tab',
  borderColor: Color.rgb(0, 0, 0),
  borderRadius: { bottomLeft: 0, bottomRight: 0, topLeft: 5, topRight: 5 },
  clipMode: 'hidden',
  extent: pt(300, 32),
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.white },
      { offset: 1, color: Color.rgb(236, 240, 241) }
    ],
    vector: 0
  }),
  layout: new TilingLayout({
    axisAlign: 'center',
    resizePolicies: [
      ['horizontal container', { height: 'fixed', width: 'fill' }]
    ]
  }),
  submorphs: [{
    name: 'horizontal container',
    halosEnabled: false,
    borderStyle: 'none',
    fill: Color.rgba(0, 0, 0, 0),
    reactsToPointer: false,
    layout: new TilingLayout({
      padding: rect(6, 6, 0, 0),
      resizePolicies: [
        ['tab caption', { height: 'fixed', width: 'fill' }]
      ]
    }),
    submorphs: [{
      type: Label,
      halosEnabled: false,
      name: 'tab caption',
      fill: Color.transparent,
      fixedWidth: true,
      fontColor: Color.rgba(0, 0, 0, 0.5),
      reactsToPointer: false,
      textAndAttributes: ['tab caption', null]
    }, {
      type: TabCloseButton,
      name: 'tab close',
      halosEnabled: false,
      fontColor: Color.rgba(0, 0, 0, 0.5),
      nativeCursor: 'pointer',
      textAndAttributes: Icon.textAttribute('times')
    }]
  }]
});

const HoverTab = component(DefaultTab, {
  fill: Color.rgb(245, 245, 245)
});

const ActiveTab = component(DefaultTab, {
  fill: Color.rgb(183, 183, 183)
});

const SelectedTab = component(DefaultTab, {
  borderWidth: { bottom: 3, top: 0, right: 0, left: 0 },
  borderColor: Color.rgb(33, 47, 60),
  submorphs: [{
    name: 'horizontal container',
    submorphs:
    [{
      name: 'tab caption',
      fontColor: Color.rgba(0, 0, 0, 1)
    }, {
      name: 'tab close',
      fontColor: Color.rgba(0, 0, 0, 1)
    }]
  }]
});

class TabModel extends ViewModel {
  static get properties () {
    return {
      defaultTabMaster: {
        initialize () {
          this.defaultTabMaster = DefaultTab;
        }
      },
      expose: {
        get () {
          return ['isTab', 'content', 'hasMorphicContent', 'caption', 'close', 'selected', 'closeable', 'closeSilently', 'config'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseUp', handler: 'onMouseUp' },
            { signal: 'menuItems', handler: 'menuItems', override: true }
          ];
        }
      },
      caption: {
        defaultValue: 'Unnamed Tab',
        set (caption) {
          if (!caption) return;
          this.setProperty('caption', caption);
          const captionLabel = this.ui.tabCaption;
          if (captionLabel) captionLabel.textString = caption.length > 47 ? caption.substring(0, 47) + '...' : caption;
          if (this.view) this.view.tooltip = caption;
          this.name = caption + ' tab';
        }
      },
      content: {
        defaultValue: undefined
      },
      hasMorphicContent: {
        defaultValue: true
      },
      selected: {
        defaultValue: false,
        set (selected) {
          this.setProperty('selected', selected);
          signal(this.view, 'onSelectionChange', selected);
        }
      },
      closeable: {
        defaultValue: true,
        set (closeable) {
          this.setProperty('closeable', closeable);
          if (this.view) {
            {
              this.ui.tabClose.visible = closeable;
              this.ui.tabClose.isLayoutable = closeable;
              this.ui.tabCaption.padding = closeable ? rect(6, 3, -6, -2) : rect(6, 3, 0, -2); }
          }
        }
      },
      renameable: {
        defaultValue: true
      }
    };
  }

  get config () {
    return {
      caption: this.caption,
      content: this.content,
      hasMorphicContent: this.hasMorphicContent,
      selected: this.selected,
      closeable: this.closeable,
      renamable: this.renameable
    };
  }

  menuItems () {
    if (!this.renameable) return;
    return [
      [
        'Rename Tab', async () => {
          const newName = await $world.prompt('Tab name:', { input: this.caption });
          if (newName) {
            this.caption = newName;
          }
        }
      ]
    ];
  }

  setAppearance (isSelected) {
    this.view.master.setState(isSelected ? 'selected' : null);
  }

  get isTab () {
    return true;
  }

  close () {
    if (!this.closeable) {
      $world.setStatusMessage('This tab cannot be closed.');
      return;
    }
    // hook for connection to do cleanup
    signal(this.view, 'onClose');
    if (this.hasMorphicContent && this.content) { this.content.remove(); }
    this.view.remove();
  }

  /**
   * Can be used to "just close" a tab. No further logic is regarded and no connections are triggered upon removal
   */
  closeSilently () {
    this.view.remove();
  }

  onMouseUp (evt) {
    if (arr.first(evt.targetMorphs) === this.ui.tabClose) return;
    if (!this.selected) {
      this.selected = true;
    }
  }

  viewDidLoad () {
    this.caption = this.caption;
    // this.setAppearance(this.selected);
  }

  onRefresh (prop) {
    if (prop === 'selected') { this.setAppearance(this.selected); }
  }
}

/**
 * An actual tab.
 */
const Tab = component(DefaultTab, {
  name: 'tab',
  defaultViewModel: TabModel,
  master: {
    auto: DefaultTab,
    click: ActiveTab,
    hover: HoverTab,
    states: { selected: SelectedTab }
  }
});

class TabContentContainerModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['resize'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onDrop', handler: 'onDrop' },
            { signal: 'extent', handler: 'resize' }
          ];
        }
      }
    };
  }

  onDrop (evt) { // eslint-disable-line no-unused-vars
    const content = this.view.submorphs[0];
    if (content) { this.view.owner.addContentToSelectedTab(content); }
  }

  resize (size) {
    const content = this.view.submorphs[0];
    if (!content) return;
    content.position = pt(0, 0);
    content.extent = size;
  }
}

/**
 * A container for the content associated with a tab providing layout functionality.
 */
const TabContentContainer = component({
  name: 'tab content container',
  defaultViewModel: TabContentContainerModel,
  fill: Color.white,
  halosEnabled: false,
  extent: pt(600, 375)
});

class TabContainerModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () { return ['add', 'tabs', 'scrollToRightmostTab']; }
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseWheel', handler: 'onMouseWheel' }
          ];
        }
      }
    };
  }

  get tabs () {
    return this.ui.tabFlapContainer.submorphs.filter(submorph => submorph.isTab);
  }

  scrollToRightmostTab () {
    const node = this.ui.tabFlapScrollContainer.env.renderer.getNodeForMorph(this.ui.tabFlapScrollContainer);
    if (!node) return;
    this.view.whenRendered().then(() => { // before, the maxscroll is too small to make the new tab visible
      node.scrollLeft = 1000000; // just force to the right most position
      this.ui.tabFlapScrollContainer.setProperty('scroll', 1000000);
    });
  }

  add (aTab) {
    this.ui.tabFlapContainer.addMorph(aTab);
  }

  onMouseWheel (event) {
    const node = this.ui.tabFlapScrollContainer.env.renderer.getNodeForMorph(this.ui.tabFlapScrollContainer);
    let offset;
    if (Math.abs(event.domEvt.deltaY) > Math.abs(event.domEvt.deltaX)) {
      offset = event.domEvt.deltaY;
    } else {
      offset = event.domEvt.deltaX;
    }
    node.scrollLeft = node.scrollLeft + offset;
    this.ui.tabFlapScrollContainer.setProperty('scroll', pt(node.scrollLeft, node.scrollTop));
    event.stop();
  }
}

const NewTabButtonDefault = component({
  name: 'new tab button',
  extent: pt(32, 32),
  borderRadius: { topLeft: 5, bottomLeft: 0, bottomRight: 0, topRight: 0 },
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.white },
      { offset: 1, color: Color.rgb(236, 240, 241) }
    ],
    vector: 0
  }),
  halosEnabled: false,
  layout: new TilingLayout({
    justifySubmorphs: 'center',
    align: 'center',
    axisAlign: 'center'
  }),
  submorphs: [{
    type: Label,
    name: 'new tab',
    halosEnabled: false,
    reactsToPointer: false,
    fontColor: Color.rgba(0, 0, 0, 0.5),
    nativeCursor: 'pointer',
    padding: rect(2, 1, 0, 1),
    textAndAttributes: Icon.textAttribute('plus')
  }]
});

const NewTabButtonHover = component(NewTabButtonDefault, {
  fill: Color.rgb(245, 245, 245),
  submorphs: [{
    name: 'new tab',
    fontColor: Color.rgba(0, 0, 0, 0.5)
  }]
});

const NewTabButtonActive = component(NewTabButtonDefault, {
  fill: Color.rgb(183, 183, 183),
  submorphs: [{
    name: 'new tab',
    fontColor: Color.rgba(0, 0, 0, 0.5)
  }]
});

const NewTabButton = component(NewTabButtonDefault, { // eslint-disable-line no-unused-vars
  name: 'new tab button',
  master: {
    hover: NewTabButtonHover,
    click: NewTabButtonActive,
    auto: NewTabButtonDefault
  }
});

/**
 * A container containing the actual tabs, providing layout functionality.
 */
const TabContainer = component({
  name: 'tab container',
  defaultViewModel: TabContainerModel,
  extent: pt(600, 32),
  halosEnabled: false,
  fill: Color.transparent,
  layout: new TilingLayout({
    axisAlign: 'center',
    resizePolicies: [
      ['tab flap scroll container', { height: 'fixed', width: 'fill' }]
    ]
  }),
  submorphs: [
    {
      name: 'tab flap scroll container',
      extent: pt(525, 32),
      fill: Color.transparent,
      borderWidth: 0,
      clipMode: 'hidden',
      submorphs: [
        {
          name: 'tab flap container',
          fill: Color.transparent,
          borderWidth: 0,
          layout: new TilingLayout({
            axis: 'row'
          })
        }
      ]
    }
  ]
});

class TabsModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['addContentToSelectedTab', 'addTab', 'selectedTab', 'keybindings', 'commands', 'tabs', 'loadFromConfig', 'becameVisible', 'becameInvisible'];
        }
      },
      bindings: {
        get () {
          return [
            {
              // target: 'new tab button', signal: 'onMouseDown', handler: 'addTab', updater: '($update) => { $update(); }'
            }
          ];
        }
      },
      providesContentContainer: {
        defaultValue: false
      },
      // this only has the expected value when calling onSelectedTabChange
      _previouslySelectedTab: {},
      showsSingleTab: {
        defaultValue: true
      },
      defaultTabMaster: {
        isComponent: true,
        initialize () {
          this.defaultTabMaster = Tab;
        }
      }
    };
  }

  /**
   * Takes an array of tabconfigs and recreates the therein specified tabs.
   * I.e. this method will open new tabs, set their contents, captions,...
   * Previous state of the tab system will be silently discarded, i.e. without triggering connections.
   * @param {Object[]} config - An array of taconfigecs.
   */
  loadFromConfig (configs) {
    for (let tab of this.tabs) {
      tab.closeSilently();
    }

    for (let tabConfig of configs) {
      this.addTab(tabConfig.caption,
        tabConfig.content,
        tabConfig.selected,
        tabConfig.hasMorphicContent,
        tabConfig.selected,
        tabConfig.closeable,
        tabConfig.renameable);
    }
  }

  addTab (caption,
    content = undefined,
    selectAfterCreation = true,
    hasMorphicContent = this.providesContentContainer,
    closeable,
    renameable
  ) {
    const newTab = part(this.defaultTabMaster, {
      viewModel: {
        caption,
        content,
        hasMorphicContent,
        renameable,
        closeable
      }
    });
    this.initializeConnectionsFor(newTab);

    this.ui.tabContainer.add(newTab);

    newTab.selected = selectAfterCreation;

    this.updateVisibility(false);
    this.scrollToRightmostTab();
    return newTab;
  }

  updateVisibility (closing) {
    if (!this.showsSingleTab && this.tabs.length > 1) {
      this.view.visible = true;
      signal(this, 'becameVisible');
    }
    if (!this.showsSingleTab && this.tabs.length === 2 && closing) {
      this.view.visible = false;
      signal(this, 'becameInvisible');
    }
  }

  initializeConnectionsFor (tab) {
    connect(tab, 'onSelectionChange', this, 'showContent', {
      updater: `($update, selected) => {
        if (selected) $update(source.content);
      }`
    });
    connect(tab, 'onSelectionChange', this, 'deselectAllTabsExcept', {
      updater: `($update, selected) => {
        if (selected) $update(source);
      }`
    });
    connect(tab, 'onSelectionChange', this, 'onSelectedTabChange', {
      updater: '($update, selected) => { if (selected) $update({curr: source, prev: target._previouslySelectedTab}) }'
    });
    connect(tab, 'onClose', this, 'onTabClose', {
      converter: '() => source'
    });
  }

  disbandConnectionsFor (closedTab) {
    disconnect(closedTab, 'onSelectionChange', this, 'showContent');
    disconnect(closedTab, 'onSelectionChange', this, 'deselectAllTabsExcept');
    disconnect(closedTab, 'onSelectionChange', this, 'onSelectedTabChange');
    disconnect(closedTab, 'onClose', this, 'onTabClose');
  }

  onSelectedTabChange (currAndPrevTabsObject) {
    // hook for external components to bind to for when another tab is selected
    signal(this.view, 'onSelectedTabChange', currAndPrevTabsObject);
    this._previouslySelectedTab = currAndPrevTabsObject.curr;
    return currAndPrevTabsObject;
  }

  onTabClose (closedTab) {
    if (closedTab.selected) this.selectNearestTab(closedTab);
    if (this.tabs.length === 2) {
      signal(this.view, 'oneTabRemaining');
    }
    if (this.tabs.length === 1) {
      this._previouslySelectedTab = undefined;
    }
    this.disbandConnectionsFor(closedTab);
    this.updateVisibility(true);
    return closedTab;
  }

  get tabs () {
    return this.ui.tabContainer.tabs;
  }

  deselectAllTabsExcept (excludedTab) {
    this.tabs.forEach(tab => {
      if (tab === excludedTab) return;
      tab.selected = false;
    });
  }

  selectNearestTab (otherTab) {
    if (this.tabs.length === 0) return;
    if (this.tabs.length === 1) {
      this.tabs[0].selected = true;
      return;
    }
    let tabIndex = this.tabs.indexOf(otherTab);
    const tab = tabIndex < this.tabs.length - 1 ? this.tabs[++tabIndex] : this.tabs[--tabIndex];
    tab.selected = true;
    return tab;
  }

  get selectedTab () {
    return this.tabs.find(tab => tab.selected);
  }

  addContentToSelectedTab (content) {
    if (!this.providesContentContainer) return;
    const tab = this.selectedTab;
    if (tab) {
      tab.content = content;
      this.showContent(content);
    }
  }

  /**
   * When using a tab system with `providesContentContainer = false` connect to this method to get the associated content of a tab upon its selection.
   * @param {any} content - The content of a tab that has been selected.
   */
  showContent (content) {
    if (!this.providesContentContainer) return content;
    const container = this.ui.tabContentContainer;
    container.submorphs.forEach(submorph => submorph.remove());

    if (content) {
      container.addMorph(content);
      content.position = pt(0, 0);
      content.extent = container.extent;
    }
  }

  viewDidLoad () {
    if (!this.providesContentContainer && this.ui.tabContentContainer) { this.ui.tabContentContainer.remove(); }
    if (!this.showsSingleTab) this.view.visible = false;
  }

  get keybindings () {
    return [
      { keys: 'Alt-W', command: 'close current tab' },
      { keys: 'Alt-Q', command: 'select previous tab' },
      { keys: 'Alt-Y', command: 'select next tab' }
    ];
  }

  get commands () {
    return [
      {
        name: 'close current tab',
        exec: () => {
          this.selectedTab.close();
        }
      },
      {
        name: 'select previous tab',
        exec: () => {
          const i = this.tabs.indexOf(this.selectedTab);
          this.tabs[i === 0 ? this.tabs.length - 1 : i - 1].selected = true;
        }
      },
      {
        name: 'select next tab',
        exec: () => {
          const i = this.tabs.indexOf(this.selectedTab);
          this.tabs[i + 1 === this.tabs.length ? 0 : i + 1].selected = true;
        }
      }];
  }

  scrollToRightmostTab () {
    this.ui.tabContainer.scrollToRightmostTab();
  }
}

/**
 * A tab-system which allows to switch between different contents based on the selected tab.
 */
const Tabs = component({
  name: 'tabs',
  fill: Color.transparent,
  defaultViewModel: TabsModel,
  layout: new TilingLayout({
    axis: 'column',
    resizePolicies: [
      ['tab container', { height: 'fixed', width: 'fill' }]
    ]
  }),
  submorphs: [
    part(TabContainer),
    part(TabContentContainer)
  ]
});

export { TabModel, Tabs, DefaultTab, HoverTab, ActiveTab, SelectedTab, Tab };
