import { component, part, ViewModel } from 'lively.morphic/components/core.js';
import { pt, rect, Color } from 'lively.graphics';
import { connect, disconnect, signal } from 'lively.bindings';
import { arr } from 'lively.lang';
import { Label, TilingLayout, Icon } from 'lively.morphic';

class TabCloseButton extends Label {
  get tab () {
    return this.owner.owner;
  }

  onMouseUp () {
    this.owner.owner.viewModel.close();
  }
}
// DefaultTab.openInWorld()
const DefaultTab = component({
  name: 'tab',
  borderColor: Color.rgb(0, 0, 0),
  borderWidth: { top: 1, bottom: 0, left: 0, right: 0 },
  clipMode: 'hidden',
  extent: pt(100, 32),
  fill: Color.rgb(222, 222, 222),
  layout: new TilingLayout({
    axis: 'row',
    axisAlign: 'center',
    justifySubmorphs: 'packed',
    wrapSubmorphs: false,
    resizePolicies: [
      ['horizontal container', { height: 'fixed', width: 'fill' }]
    ]
  }),
  submorphs: [{
    name: 'horizontal container',
    halosEnabled: false,
    borderColor: Color.rgb(23, 160, 251),
    borderStyle: 'none',
    fill: Color.rgba(0, 0, 0, 0),
    reactsToPointer: false,
    layout: new TilingLayout({
      padding: rect(6, 6, 0, 0),
      align: 'left',
      axis: 'row',
      wrapSubmorphs: false,
      resizePolicies: [
        ['tab caption', { height: 'fixed', width: 'fill' }]
      ]
    }),
    submorphs: [{
      type: Label,
      halosEnabled: false,
      name: 'tab caption',
      fill: Color.transparent,
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

// part(SelectedTab).openInWorld();
const SelectedTab = component(DefaultTab, {
  fill: Color.rgb(245, 245, 245),
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
      expose: {
        get () {
          return ['isTab'];
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
          if (captionLabel) captionLabel.textString = caption.length > 11 ? caption.substring(0, 8) + '...' : caption;
          if (this.view) this.view.tooltip = caption;
          this.name = caption + ' tab';
        }
      },
      content: {
        defaultValue: undefined
      }, 
      selected: {
        defaultValue: false,
        set (selected) {
          this.setProperty('selected', selected);
          signal(this, 'onSelectionChange', selected);
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
    this.view.master = {};
    if (isSelected) {
      this.view.master.auto = SelectedTab;
    } else {
      this.view.master.auto = DefaultTab; 
    }
    this.view.master.hover = HoverTab;
    this.view.master.clicked = ActiveTab;
    this.view.requestMasterStyling();
  }

  get isTab () {
    return true;
  }

  close () {
    // hook for connection to do cleanup
    signal(this, 'onClose');
    if (this.content) { this.content.remove(); }
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
    this.setAppearance(this.selected);
  }

  onRefresh () {
    this.setAppearance(this.selected);
  }
}

/**
 * An actual tab.
 */
// part(Tab).openInWorld()
const Tab = component(DefaultTab, {
  defaultViewModel: TabModel,
  master: {
    auto: DefaultTab,
    click: ActiveTab,
    hover: HoverTab
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

  onDrop (evt) {
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
// part(TabContentContainer).openInWorld()
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

  onMouseWheel (event) {
    const node = this.ui.tabFlapScrollContainer.env.renderer.getNodeForMorph(this.ui.tabFlapScrollContainer);
    node.scrollLeft = node.scrollLeft + event.domEvt.deltaY;
    this.ui.tabFlapScrollContainer.setProperty('scroll', pt(node.scrollLeft, node.scrollTop));
    event.stop();
  }
}

const NewTabButtonDefault = component({
  name: 'new tab button',
  extent: pt(32, 32),
  fill: Color.rgb(222, 222, 222),
  halosEnabled: false,
  layout: new TilingLayout({
    justifySubmorphs: 'center',
    align: 'center',
    axis: 'row',
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

// part(NewTabButton).openInWorld()
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
    axis: 'row',
    axisAlign: 'center',
    justifySubmorphs: 'packed',
    wrapSubmorphs: false,
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
            wrapSubmorphs: true,
            axis: 'column',
            axisAlign: 'left',
            align: 'left',
            justifySubmorphs: 'packed'
          })
        }
      ]
    },
    // Comment in to allow for easier manual testing of the tabs
    part(NewTabButton)
  ]
});

class TabsModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['addContentToSelectedTab'];
        }
      },
      bindings: {
        get () {
          return [
            {
              target: 'new tab button', signal: 'onMouseDown', handler: 'addTab', updater: '($update) => { $update(); }'
            }
          ];
        }
      },
      // this only has the expected value when calling onSelectedTabChange
      _previouslySelectedTab: {}
    };
  }

  addTab (caption, content = undefined, selectAfterCreation = true) {
    const newTab = part(Tab, {
      viewModel: { caption, content },
      // This is necessary due to a bug where, if we override viewModel properties,
      // custom masters are discarded from the component definition
      // setting it again here solves this problem
      master: {
        auto: DefaultTab,
        click: ActiveTab,
        hover: HoverTab
      }
    });
    this.initializeConnectionsFor(newTab);

    const tabFlapContainer = this.ui.tabContainer.get('tab flap container');
   
    tabFlapContainer.addMorph(newTab);
    newTab.viewModel.selected = selectAfterCreation;
    
    return newTab;
  }

  initializeConnectionsFor (tab) {
    connect(tab.viewModel, 'onSelectionChange', this, 'showContent', {
      updater: `($update, selected) => {
        if (selected) $update(source.content);
      }`
    });
    connect(tab.viewModel, 'onSelectionChange', this, 'deselectAllTabsExcept', {
      updater: `($update, selected) => {
        if (selected) $update(source);
      }`
    });
    connect(tab.viewModel, 'onSelectionChange', this, 'onSelectedTabChange', {
      updater: '($update, selected) => { if (selected) $update({curr: source, prev: target._previouslySelectedTab}) }'
    });
    connect(tab.viewModel, 'onClose', this, 'onTabClose', {
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
    this._previouslySelectedTab = currAndPrevTabsObject.curr;
    return currAndPrevTabsObject;
  }

  onTabClose (closedTab) {
    if (closedTab.selected) this.selectNearestTab(closedTab);
    if (this.tabs.length === 1) {
      this._previouslySelectedTab = undefined;
    }
    this.disbandConnectionsFor(closedTab);
    return closedTab;
  }

  get tabs () {
    return this.ui.tabContainer.viewModel.tabs;
  }

  deselectAllTabsExcept (excludedTab) {
    this.tabs.forEach(tab => {
      if (tab.viewModel === excludedTab) return;
      tab.viewModel.selected = false;
    });
  }

  selectNearestTab (otherTab) {
    if (this.tabs.length === 0) return;
    if (this.tabs.length === 1) {
      this.tabs[0].viewModel.selected = true;
      return;
    }
    let tabIndex = this.tabs.indexOf(otherTab);
    const tab = tabIndex < this.tabs.length - 1 ? this.tabs[++tabIndex] : this.tabs[--tabIndex];
    tab.viewModel.selected = true;
    return tab;
  }

  get selectedTab () {
    return this.tabs.find(tab => tab.viewModel.selected);
  }

  addContentToSelectedTab (content) {
    const tab = this.selectedTab;
    if (tab) {
      tab.viewModel.content = content;
      this.showContent(content);
    }
  }

  showContent (content) {
    const container = this.ui.tabContentContainer;
    container.submorphs.forEach(submorph => submorph.remove());

    if (content) {
      container.addMorph(content);
      content.position = pt(0, 0);
      content.extent = container.extent;
    }
  }
}

/**
 * A tab-system which allows to switch between different contents based on the selected tab.
 */
// part(Tabs).openInWorld()
const Tabs = component({
  name: 'tabs',
  fill: Color.transparent,
  defaultViewModel: TabsModel,
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    hugContentsHorizontally: true,
    wrapSubmorphs: false
  }),
  submorphs: [
    part(TabContainer),
    part(TabContentContainer)
  ]
});

export { Tabs };
