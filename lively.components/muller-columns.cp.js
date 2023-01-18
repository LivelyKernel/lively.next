import { Color, rect, pt } from 'lively.graphics';
import { TilingLayout, ViewModel, part, component } from 'lively.morphic';
import { signal, noUpdate, connect } from 'lively.bindings';
import { arr } from 'lively.lang';
import { DefaultList } from './list.cp.js';

const ColumnListDefault = component(DefaultList, {
  name: 'column list default',
  styleClasses: ['clipped'],
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
  selectionColor: Color.rgbHex('64FFDA').withA(.6),
  selectionFontColor: Color.rgb(53, 53, 53)
});

export class MullerColumnViewModel extends ViewModel {
  static get properties () {
    return {
      defaultTooltips: {
        // whether to create tooltips that are equal to name for all entries
      },
      treeData: {
        // this.treeData
      },
      listMaster: {
        isComponent: true,
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
          this.view.submorphs = lists.map(l => {
            l.epiMorph = true;
            return l;
          });
          this.relayout();
          this.view.env.forceUpdate();
        }
      },
      expose: {
        get () {
          return [
            'listMaster', 'treeData', 'setTreeData', 'isSelected',
            'selectNode', 'getExpandedPath', 'refresh',
            'keybindings', 'commands', 'reset', 'setExpandedPath',
            'listNavigationProhibited', 'lists'
          ];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'extent', handler: 'relayout' },
            { signal: 'onMouseMove', handler: 'onMouseMove' },
            { signal: 'onHoverOut', handler: 'onHoverOut' },
            { signal: 'onKeyDown', handler: 'onKeyDown' },
            { signal: 'onMouseDown', handler: 'onMouseDown' }
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

  get listNavigationProhibited () {
    return this.treeData.listNavigationProhibited;
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
    matchingNodes = (function (n) { return n === this.treeData.root; }).bind(this),
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
    if (lenDiff >= 0) {
      newLists = [...newLists, ...arr.genN(lenDiff, () => this.newList())];
      this.lists = newLists;
      scroll = pt(view.scrollExtent.x - view.width);
      if (animated) {
        view.animate({
          scroll,
          duration: 200
        });
      } else {
        view.scroll = scroll;
        view.env.forceUpdate();
      }
    } else if (lenDiff < 0) {
      newLists = newLists.slice(0, lenDiff);
      scroll = pt(arr.last(newLists).right - view.width);
      if (animated) {
        await view.animate({
          scroll,
          duration: 200
        });
      } else {
        view.scroll = scroll;
        view.env.forceUpdate();
      }
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

  async onKeyDown (evt) {
    let window = this.view.getWindow();
    if (!window || !window.isActive() || window.isFaderActive()) return;
    await this.refresh(false);
    const hoveredList = this.lists.find(list => list.fullContainsWorldPoint($world.firstHand.position));
    if (!hoveredList) return;
    // reset the labels so that search does not need to worry about previous runs altering labels
    hoveredList.items.forEach((item) => {
      if (item.originalLabel) item.label = item.originalLabel.filter(elem => true); // get a new array object
    });

    let input;
    if (evt.hasCharacterPressed) {
      input = evt.key;
    } else if (evt.key === 'Space') {
      input = ' ';
    } else if (evt.key === 'Backspace') {
      input = '';
      this.searchString = this.searchString.slice(0, -1);
    } else if (evt.key === 'Enter') {
      input = '';
    } else { // special keys cancel search
      this.lists.forEach(list => list.scrollSelectionIntoView());
      this.searchString = '';
      return;
    }

    if (!this.searchString) this.searchString = '';
    this.searchString = this.searchString + input.toLowerCase();

    // list items can have an icon before the string we want to seach (e.g. the js icon)
    // this item does not need to be present for all items in a given list
    // therefore, we need to  check its existence for each item we handle,
    // in order to perform the search on the correct string
    //
    // a part of the label always consists of two array items, since the text comes first, followed by its attributes object
    let lookUpIndex;

    hoveredList.items.forEach((item, index) => {
      item.normalizedIndex = index; // store original index in full list in order to select items in shorter list later
    });
    // only keep items in the list that match the search
    const newItems = hoveredList.items.filter(item => {
      // the annotation (project,core,dependency) comes after a tab and is irrelevant to us
      const itemStringToSearch = item.string.toLowerCase().split('\t')[0];
      return itemStringToSearch.includes(this.searchString);
    });

    // this highlights the matching part of an items string
    // a match is guaranteed to exist, since we filteres all elements above
    for (let item of newItems) {
      lookUpIndex = item.label.length > 2 ? 2 : 0;

      const stringIndex = item.label[lookUpIndex].toLowerCase().indexOf(this.searchString); // find index at which match begins in the string
      const array = item.label;
      item.originalLabel = item.label.filter(elem => true); // get a new array object

      // create new text and attributes for the list item
      // creates three parts for the string that previously were one part
      // the first one contains any characters before the match with the default textAttributes
      // the second one contains the match and is highlightes
      // the third one contains any characters after the match with the default textAttributes
      // parts of the array before and after the string to search remain untouched
      array.splice(lookUpIndex, 1, item.label[lookUpIndex].slice(0, stringIndex),
        item.label[lookUpIndex + 1],
        item.label[lookUpIndex].slice(stringIndex, stringIndex + this.searchString.length),
        {
          fontStyle: item.label[lookUpIndex + 1] ? item.label[lookUpIndex + 1].fontStyle : 'normal',
          backgroundColor: Color.orange
        },
        item.label[lookUpIndex].slice(stringIndex + this.searchString.length)
      );
      item.label = array;
    }
    hoveredList.items = newItems; // triggers the visual update mechanism via list setter

    if (evt.key === 'Enter') {
      if (hoveredList.items.length > 1) return;
      const fakeEvent = {
        targetMorph: hoveredList.withAllSubmorphsSelect(m => m.isListItemMorph)[0]
      };
      this.clickOnItem(fakeEvent);
    }
  }

  onMouseMove (evt) {
    const hoveredList = this.lists.find(list => list.fullContainsWorldPoint(evt.position));
    if (hoveredList) {
      const win = this.view.getWindow();
      if (!$world.focusedMorph.isText || win?.isActive()) hoveredList.focus();
      this.lists.forEach(list => {
        const control = list._managedNode && list._managedNode.listControl;
        if (control) {
          control.visible = list === hoveredList;
        }
      });
    }
  }

  onMouseDown (evt) {
    if (evt.targetMorph.isListItemMorph) this.clickOnItem(evt);
  }

  clickOnItem (evt) {
    if (this.searchString) {
      const clickedList = evt.targetMorph.owner.owner; // is guaranteed to be list morph
      const clickedItem = clickedList.items.find(item => item.string === evt.targetMorph.textString);
      this.refresh().then(() => { // select based on stores index, scroll into view and prepare for next search
        clickedList.selectedIndex = clickedItem.normalizedIndex;
        clickedList.items.forEach(item => item.normalizedIndex = null);
        this.searchString = null;
        clickedList.scrollSelectionIntoView();
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
          if (this.listNavigationProhibited) return;
          const nextNode = this.treeData.parentNode(this._selectedNode);
          this.selectNode(nextNode);
        }
      },
      {
        name: 'select first entry of next list',
        exec: () => {
          if (this.listNavigationProhibited) return;
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
    if (td.isLeaf(last) && last !== td.root) {
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
      if (currentList._managedNode === node) {
        currentList.itemScroll = originalScroll;
        const currentItems = currentList.items;
        const newItems = td.getChildren(node);
        if (newItems.length === currentItems.length) {
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
      if (currentList._managedNode !== node) {
        currentList.items = td.getChildren(node).map(each => {
          return { isListItem: true, label: td.display(each), value: each, tooltip: (this.defaultTooltips ? each.name : (each.tooltip || false)) };
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

const MullerColumnView = component({
  defaultViewModel: MullerColumnViewModel,
  name: 'muller column view',
  borderColor: Color.rgb(23, 160, 251),
  clipMode: 'auto',
  extent: pt(565.1, 285.2),
  layout: new TilingLayout({
    align: 'top',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 0,
      y: 0
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true
  }),
  position: pt(875, 1268),
  renderOnGPU: true
});

export { MullerColumnView, ColumnListDefault, ColumnListDark };
