import { ViewModel, part, component } from 'lively.morphic/components/core.js';
import { Color, rect, pt } from 'lively.graphics';
import { HorizontalLayout } from 'lively.morphic';
import { DefaultList, DarkList } from './list.cp.js';
import { signal, noUpdate, connect } from 'lively.bindings';
import { arr } from 'lively.lang';

// maybe these are not needed at all
// ColumnListDefault.openInWorld()
const ColumnListDefault = component(DefaultList, {
  name: 'column list default',
  borderWidthRight: 1,
  borderColor: Color.rgb(213, 216, 220),
  extent: pt(230, 93.5),
  fill: Color.rgba(255, 255, 255, 0),
  itemBorderRadius: 3,
  itemPadding: rect(5, 3, 0, -2),
  padding: rect(5, 5, 5, 0)
});

const ColumnListDark = component(ColumnListDefault, {
  name: 'column list dark',
  borderColor: Color.rgb(133, 146, 158),
  fill: Color.rgba(44, 62, 80, 0),
  nonSelectionFontColor: Color.rgb(252, 252, 252),
  selectionColor: Color.rgb(133, 193, 233),
  selectionFontColor: Color.rgb(53, 53, 53)
});

export class MullerColumnViewModel extends ViewModel {
  static get properties () {
    return {
      treeData: {
        // this.treeData
      },
      listMaster: {
        defaultValue: DefaultList,
        set (url) {
          this.setProperty('listMaster', url);
          this.refresh(false);
        }
      },
      lists: {
        derived: true,
        get () {
          return this.view.submorphs;
        },
        set (lists) {
          this.view.submorphs = lists;
        }
      },
      expose: {
        get () {
          return [
            'listMaster', 'treeData', 'setTreeData', 'isSelected',
            'selectNode', 'getExpandedPath', 'refresh',
            'keybindings', 'commands', 'reset', 'setExpandedPath'
          ];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'extent', handler: 'relayout' },
            { signal: 'onMouseMove', handler: 'onMouseMove' },
            { signal: 'onHoverOut', handler: 'onHoverOut' }
          ];
        }
      }
      // muller columns are essentially a different style of tree view
      // the main different is that only one chain of collapsed nodes
      // is displayed at once. This in turn requires that of all the nodes
      // children, at most one can be collapsed at a time.
    };
  }

  focusActiveList () {
    arr.last(this.lists.filter(m => !!m.selection)).focus();
  }

  truncateNameIfNeeded (displayedName) {
    // based on the muller column it is going to be rendered in, adjust the truncation
    return displayedName;
  }

  isSelected (node) {
    return !node.isCollapsed;
  }

  async setTreeData (treeData) {
    this.treeData = treeData;
    await treeData.collapse(treeData.root, false);
    await this.refresh(false);
  }

  reset () {
    this.lists = [];
  }

  async selectNode (aNode, animated = true) {
    this._selectedNode = aNode;
    const parent = this.treeData.parentNode(aNode);
    await Promise.all(this.treeData.getChildren(parent).map(child => {
      if (child !== aNode && !this.treeData.isCollapsed(child)) {
        return this.treeData.collapse(child, true);
      }
      if (child === aNode) return this.treeData.collapse(child, false);
    }));
    await this.refresh(animated);
    signal(this, 'selectionChange', this.getExpandedPath());
  }

  getExpandedPath () {
    const td = this.treeData;
    if (!td) return [];
    let currentChildren = td.getChildren(td.root);
    let nextNode;
    const expandedPath = [td.root];
    while (nextNode = currentChildren && currentChildren.find(aChild => !td.isCollapsed(aChild))) {
      expandedPath.push(nextNode);
      currentChildren = td.getChildren(nextNode);
    }
    return expandedPath;
  }

  /*
    Often we want to expand a path that has never been expanded before.
    Depending on the implementation of the treeData the nodes that need to
    be visited may not even be present yet (lazy initialization).
    This is why we expand each node with a custom iterator.
  */
  async setExpandedPath (
    matchingNodes = (n) => n == this.treeData.root,
    until = this.treeData.root,
    animated = true
  ) {
    const td = this.treeData;
    const p = this.getExpandedPath();
    const currentPath = p.slice(p.indexOf(until));
    await Promise.all(currentPath.map(node => td.collapse(node, true))); // dont collapse root
    await td.uncollapseAll(matchingNodes, 0, until);
    await this.refresh(animated);
    this.lists.forEach(list => list.scrollSelectionIntoView());
  }

  newList () {
    const list = part(this.listMaster, {
      width: 200
    });
    connect(list, 'selection', this, 'selectNode');
    return list;
  }

  async ensureLists (numberOfLists, animated = true) {
    let newLists = this.lists; let scroll;
    const { view } = this;
    const lenDiff = numberOfLists - newLists.length;
    if (lenDiff > 0) {
      newLists = [...newLists, ...arr.genN(lenDiff, () => this.newList())];
      this.lists = newLists;
      await view.whenRendered(); // ensure layout has placed all morphs accordingly
      if (view.layout.renderViaCSS) // thank you virtual-dom....
      { newLists.map(m => view.layout.expressMeasure(m)); }
      scroll = pt(view.scrollExtent.x - view.width);
      if (animated) {
        view.animate({
          scroll,
          duration: 200
        });
      } else view.scroll = scroll;
    } else if (lenDiff < 0) {
      newLists = newLists.slice(0, lenDiff);
      scroll = pt(arr.last(newLists).right - view.width);
      if (animated) {
        await view.animate({
          scroll,
          duration: 200
        });
      } else view.scroll = scroll;
      this.lists = newLists;
    }
    return newLists;
  }

  relayout () {
    let scrollBarHeight = 0;
    const { view } = this;
    if (view.scrollExtent.x > view.width + view.scrollbarOffset.x) {
      scrollBarHeight = 5;
    }
    this.lists.forEach(list => {
      list.height = view.height - scrollBarHeight - 1;
      const control = list._managedNode && list._managedNode.listControl;
      if (control) {
        control.bottomRight = list.innerBounds().bottomRight().subXY(5, 0);
      }
    });
  }

  onHoverOut (evt) {
    this.lists.forEach(list => {
      const control = list._managedNode && list._managedNode.listControl;
      if (control) control.visible = false;
    });
  }

  onMouseMove (evt) {
    const hoveredList = this.lists.find(list => list.fullContainsWorldPoint(evt.position));
    if (hoveredList) {
      this.lists.forEach(list => {
        const control = list._managedNode && list._managedNode.listControl;
        if (control) {
          control.visible = list == hoveredList;
        }
      });
    }
  }

  get keybindings () {
    return [
      { keys: 'Left', command: 'select previous entry of last list' },
      { keys: 'Right', command: 'select first entry of next list' }
    ];
  }

  get commands () {
    return [
      {
        name: 'select previous entry of last list',
        exec: () => {
          const nextNode = this.treeData.parentNode(this._selectedNode);
          this.selectNode(nextNode);
        }
      },
      {
        name: 'select first entry of next list',
        exec: () => {
          const current = this._selectedNode;
          const nextNode = current.subNodes && current.subNodes[0];
          if (nextNode) {
            this.selectNode(nextNode);
          }
        }
      }
    ];
  }

  async refresh (animated = true) {
    const td = this.treeData;
    if (!td) return;
    let expandedPath = this.getExpandedPath(); let selectedFile;
    const last = arr.last(expandedPath);
    if (td.isLeaf(last) && last != td.root) {
      selectedFile = arr.last(expandedPath);
      expandedPath = expandedPath.slice(0, -1);
    }
    const lists = await this.ensureLists(expandedPath.length, animated); // always ensure the root list exists
    let currentList;
    expandedPath.forEach(node => {
      if ((!td.isCollapsed(node)) && currentList) {
        noUpdate(() => {
          currentList.selection = node;
          currentList.focus();
        });
      }
      currentList = lists.shift();
      noUpdate(() => currentList.selection = false);
      const originalScroll = currentList.itemScroll;
      if (currentList._managedNode == node) {
        currentList.itemScroll = originalScroll;
        const currentItems = currentList.items;
        const newItems = td.getChildren(node);
        if (newItems.length == currentItems.length) {
          arr.zip(currentItems, newItems).forEach(([item, value]) => {
            if (!value) return;
            item.value = value;
            if (item.value.isDirty) {
              item.value.isDirty = false;
              item.label = td.display(item.value);
            }
          });
        } else currentList._managedNode = null;
      }
      if (currentList._managedNode != node) {
        currentList.items = td.getChildren(node).map(each => {
          return { isListItem: true, label: td.display(each), value: each, tooltip: each.tooltip || false };
        });
        currentList._managedNode = node;
      }
      if (node.listControl) { currentList.submorphs = currentList.submorphs.slice(0, 2).concat([node.listControl]); }
    });
    if (selectedFile) {
      noUpdate(() => {
        currentList.selection = selectedFile;
        currentList.focus();
      });
    }
    this.relayout();
  }
}

// MullerColumnView.openInWorld()
const MullerColumnView = component({
  defaultViewModel: MullerColumnViewModel,
  name: 'muller column view',
  borderColor: Color.rgb(23, 160, 251),
  clipMode: 'auto',
  extent: pt(565.1, 285.2),
  layout: new HorizontalLayout({
    align: 'top',
    autoResize: false,
    direction: 'leftToRight',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 0,
      y: 0
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false
  }),
  position: pt(875, 1268),
  renderOnGPU: true
});

export { MullerColumnView, ColumnListDefault, ColumnListDark };
