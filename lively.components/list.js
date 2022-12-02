import { Morph, Text, Label, Icon, morph, touchInputDevice, part } from 'lively.morphic';
import { pt, Color, Rectangle } from 'lively.graphics';
import { arr, Path, string } from 'lively.lang';
import { signal, noUpdate, once, connect } from 'lively.bindings';
import { Button, ButtonModel } from './buttons.js';

export function asItem (obj) {
  // make sure that object is of the form
  // {isListItem: true, string: STRING, value: OBJECT}
  if (obj && obj.isListItem && typeof obj.string === 'string') return obj;
  if (!obj || !obj.isListItem) return { isListItem: true, string: String(obj), value: obj };
  const label = obj.string || obj.label || 'no item.string';
  obj.string = !label || typeof label === 'string'
    ? String(label)
    : Array.isArray(label)
      ? label.map((text, i) => i % 2 === 0 ? String(text) : '').join('')
      : String(label);
  return obj;
}

export class ListItemMorph extends Label {
  static get properties () {
    return {
      clipMode: { defaultValue: 'hidden' },
      autofit: { defaultValue: false },
      isSelected: { defaultValue: false },
      draggable: { defaultValue: !touchInputDevice },
      fixedWidth: { defaultValue: true },
      fixedHeight: { defaultValue: true },
      nativeCursor: { defaultValue: 'auto' },
      fill: {
        derived: true,
        get () {
          if (touchInputDevice && this.pressed) return Color.gray.withA(0.5);
          return this.isSelected ? this.selectionColor : Color.transparent;
        }
      },
      itemIndex: { defaultValue: undefined },
      selectionFontColor: { isStyleProp: true, defaultValue: Color.white },
      selectionColor: {
        type: 'ColorGradient',
        isStyleProp: true,
        defaultValue: Color.blue
      },
      nonSelectionFontColor: { isStyleProp: true, defaultValue: Color.rgbHex('333') },
      fontColor: {
        derived: true,
        get () {
          return this.isSelected ? this.selectionFontColor : this.nonSelectionFontColor;
        }
      },
      list: {
        derived: true,
        get () {
          return this.owner.owner;
        }
      }
    };
  }

  displayItem (item, itemIndex, goalWidth, itemHeight, pos, isSelected = false, style) {
    if (this.itemIndex === itemIndex && isSelected === this.isSelected && item.fontFamily === this.fontFamily) return;
    const itemMorph = item.morph;
    const label = itemMorph ? '' : (item.label || item.string || 'no item.string');

    if (item.annotation) {
      this.valueAndAnnotation = { value: label, annotation: item.annotation };
    } else if (typeof label === 'string') this.textAndAttributes = label;
    else this.textAndAttributes = label;

    this.tooltip = item.tooltip || this.tooltip || this.textString;
    if (item.tooltip === false) this.tooltip = false;
    this.itemIndex = itemIndex;
    this.position = pos;

    if (style) {
      const {
        fontFamily,
        selectionColor,
        selectionFontColor,
        nonSelectionFontColor,
        borderRadius,
        fontSize,
        padding
      } = style;
      if (selectionFontColor && this.selectionFontColor !== selectionFontColor) { this.selectionFontColor = selectionFontColor; }
      if (nonSelectionFontColor && this.nonSelectionFontColor !== nonSelectionFontColor) { this.nonSelectionFontColor = nonSelectionFontColor; }
      if (selectionColor && this.selectionColor !== selectionColor) { this.selectionColor = selectionColor; }
      if (borderRadius && borderRadius !== this.borderRadius) { this.borderRadius = borderRadius; }
      if (fontSize && this.fontSize !== fontSize) this.fontSize = fontSize;
      if (fontFamily && this.fontFamily !== fontFamily) this.fontFamily = fontFamily;
      if (padding && !this.padding.equals(padding)) this.padding = padding;
    }

    {
      // if its wider, its wider...
      // this is more correct but slower:
      // this.extent = pt(Math.max(goalWidth, this.textBounds().width), itemHeight);
      // this is faster:
      if (item.autoFit) itemMorph.width = goalWidth;
      const width = itemMorph ? Math.max(itemMorph.width, goalWidth) : goalWidth;
      const height = itemHeight; // itemMorph ? Math.max(itemMorph.height, itemHeight) : itemHeight;
      this.extent = pt(width, height);
    }

    if (itemMorph) {
      const tfm = itemMorph.getTransform().copy();
      this.submorphs = [itemMorph];
      itemMorph.setTransform(tfm);
      itemMorph.position = pt(0, 0);
    } else if (this.submorphs.length) this.submorphs = [];

    this.isSelected = isSelected;
  }

  onDragStart (evt) {
    const { list } = this;
    this._dragState = { sourceIsSelected: this.isSelected, source: this, itemsTouched: [] };
    if (!list.multiSelect || !list.multiSelectViaDrag) { list.onItemMorphDragged(evt, this); }
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.list.clickOnItem(evt);
  }

  onDrag (evt) {
    const { list } = this;
    if (list.multiSelect && list.multiSelectViaDrag) {
      const below = evt.hand.morphBeneath(evt.position);
      const { selectedIndexes, itemMorphs } = list;
      if (below === this || !itemMorphs.includes(below)) return;
      if (this._dragState.sourceIsSelected && !below.isSelected) {
        arr.pushIfNotIncluded(selectedIndexes, below.itemIndex);
        list.selectedIndexes = selectedIndexes;
      } else if (!this._dragState.sourceIsSelected && below.isSelected) {
        arr.remove(selectedIndexes, below.itemIndex);
        list.selectedIndexes = selectedIndexes;
      }
    }
  }

  get isListItemMorph () {
    return true;
  }
}

export class ListScroller extends Morph {
  static get properties () {
    return {
      name: { defaultValue: 'scroller' },
      fill: { defaultValue: Color.transparent },
      clipMode: { defaultValue: 'auto' },
      scrollbar: {
        derived: true,
        readOnly: true,
        after: ['submorphs'],
        get () { return this.submorphs[0]; }
      },
      submorphs: {
        initialize () { this.submorphs = [{ name: 'scrollbar', fill: Color.transparent }]; }
      }
    };
  }

  onScroll (evt) {
    return this.owner.update();
  }

  onMouseDown (evt) {
    const scrollY = this.scroll.y;
    if (touchInputDevice) {
      const item = this.owner.itemForClick(evt);
      if (!item) return;
      item.pressed = true;
      item.makeDirty();
      setTimeout(() => {
        item.pressed = false;
        if (scrollY - this.scroll.y !== 0) return;
        return this.owner.clickOnItem(evt);
      }, 300);
      return;
    }
    return this.owner.clickOnItem(evt);
  }
}

const listCommands = [
  {
    name: 'page up',
    exec: (list) => {
      const index = list.selectedIndex;
      const newIndex = Math.max(0, index - Math.round(list.height / list.itemHeight));
      return list.gotoIndex(newIndex);
    }
  },

  {
    name: 'page down',
    exec: (list) => {
      const index = list.selectedIndex;
      const newIndex = Math.min(list.items.length - 1, index + Math.round(list.height / list.itemHeight));
      return list.gotoIndex(newIndex);
    }
  },

  {
    name: 'goto first item',
    exec: (list) => { return list.gotoIndex(0); }
  },

  {
    name: 'goto last item',
    exec: (list) => { return list.gotoIndex(list.items.length - 1); }
  },

  {
    name: 'arrow up',
    exec: (list) => { return list.gotoIndex(list.indexUp()); }
  },

  {
    name: 'arrow down',
    exec: (list) => { return list.gotoIndex(list.indexDown()); }
  },

  {
    name: 'select up',
    exec: (list) => {
      const selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length) { return list.execCommand('arrow up'); }

      const current = selected[0];
      if (typeof current !== 'number') list.selectedIndexes = [current];
      else {
        const up = list.indexUp(current);
        if (selected.includes(current) && selected.includes(up)) {
          list.selectedIndexes = selected.filter(ea => ea !== current);
        } else {
          list.selectedIndexes = [up].concat(selected.filter(ea => ea !== up));
        }
      }
      return true;
    }
  },

  {
    name: 'select down',
    exec: (list) => {
      const selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length) { return list.execCommand('arrow down'); }

      const current = selected[0];
      const down = list.indexDown(current);
      if (selected.includes(current) && selected.includes(down)) {
        list.selectedIndexes = selected.filter(ea => ea !== current);
      } else {
        list.selectedIndexes = [down].concat(selected.filter(ea => ea !== down));
      }
      return true;
    }
  },

  {
    name: 'select all',
    exec: (list) => {
      list.selectedIndexes = arr.range(list.items.length - 1, 0);
      list.scrollIndexIntoView(list.selectedIndexes[0]);
      return true;
    }
  },

  {
    name: 'select via filter',
    exec: async (list) => {
      const preselect = list.selectedIndex || 0;
      const { selected } = await list.world().filterableListPrompt(
        'Select item', list.items,
        { preselect, requester: list.getWindow() || list, itemPadding: Rectangle.inset(0, 2), multiSelect: true });
      if (selected.length) {
        if (list.multiSelect) list.selections = selected;
        else list.selection = selected[0];
        list.scrollSelectionIntoView();
        list.update();
      }
      return true;
    }
  },

  {
    name: 'realign top-bottom-center',
    exec: list => {
      if (!list.selection) return;
      let { padding, selectedIndex: idx, itemHeight, scroll: { x: scrollX, y: scrollY } } = list;
      const pos = pt(0, idx * itemHeight);
      const h = list.height - itemHeight - padding.top() - padding.bottom();
      if (Math.abs(pos.y - scrollY) < 2) {
        scrollY = pos.y - h;
      } else if (Math.abs(pos.y - scrollY - h * 0.5) < 2) {
        scrollY = pos.y;
      } else {
        scrollY = pos.y - h * 0.5;
      }
      list.scroll = pt(scrollX, scrollY);
      return true;
    }
  },

  {
    name: 'print contents in text window',
    exec: list => {
      const title = 'items of ' + list.name;
      const content = list.items.map(item => {
        if (typeof item === 'string') return item;
        const { string, label, annotation } = item;
        let result = '';

        if (label) {
          if (typeof label === 'string') result += label;
          else result += label.map((text, i) => i % 2 === 0 ? text : '').join('');
        } else if (string) result += string;

        if (annotation) {
          result += ' ';
          if (typeof annotation === 'string') result += annotation;
          else result += annotation[0];
        }
        return result;
      }).join('\n');

      return list.world().execCommand('open text window',
        { title, content, name: title, fontFamily: 'Monaco, monospace' });
    }
  }
];

export class List extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.white },
      clipMode: { defaultValue: 'hidden' },

      selectionFontColor: { isStyleProp: true, defaultValue: Color.white },
      selectionColor: {
        type: 'ColorGradient',
        isStyleProp: true,
        defaultValue: Color.rgb(21, 101, 192)
      },
      nonSelectionFontColor: { isStyleProp: true, defaultValue: Color.rgbHex('333') },
      fontColor: { isStyleProp: true, defaultValue: Color.rgbHex('333') },

      styleClasses: { defaultValue: ['default'] },

      itemScroll: {
        /*
          We need to use a different property name for the list scroll,
          since the default scroll property is already rendered as a div
          with overflow hidden|scroll which we do not want since we implement
          the scroll for ourselves.
        */
        derived: true,
        after: ['submorphs'],
        get () { return this.scroller ? this.scroller.scroll : pt(0, 0); },
        set (s) { if (this.scroller) this.scroller.scroll = s; }
      },

      extent: {
        defaultValue: pt(400, 360),
        set (value) {
          if (value.eqPt(this.extent)) return;
          this.setProperty('extent', value);
          this.update();
        }
      },

      fontFamily: {
        isStyleProp: true,
        defaultValue: 'Helvetica Neue, Arial, sans-serif',
        set (value) {
          this.setProperty('fontFamily', value);
          this.invalidateCache();
        }
      },

      fontSize: {
        isStyleProp: true,
        defaultValue: 12,
        set (value) {
          this.setProperty('fontSize', value);
          this.invalidateCache();
        }
      },

      padding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(3)
      },

      itemBorderRadius: {
        isStyleProp: true,
        defaultValue: 0,
        set (value) {
          this.setProperty('itemBorderRadius', value);
          this.invalidateCache();
        }
      },

      itemPadding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(1),
        set (value) {
          this.setProperty('itemPadding', value);
          this.invalidateCache();
        }
      },

      items: {
        group: 'list',
        defaultValue: [],
        after: ['submorphs'],
        set (items) {
          this.setProperty('items', items.map(asItem));
          this.itemScroll = pt(0, 0);
          this.update();
          if (this.attributeConnections) { signal(this, 'values', this.values); }
        }
      },

      multiSelect: {
        defaultValue: false
      },

      multiSelectWithSimpleClick: {
        description: 'Does a simple click toggle selections without deselecting?',
        defaultValue: false
      },

      multiSelectViaDrag: {
        description: 'Does dragging extend selection?',
        defaultValue: true
      },

      values: {
        group: 'list',
        after: ['items'],
        readOnly: true,
        get () { return this.items.map(ea => ea.value); }
      },

      selectedIndex: {
        group: 'list',
        defaultValue: [],
        after: ['selectedIndexes'],
        get () { return this.selectedIndexes[0]; },
        set (i) { return this.selectedIndexes = typeof i === 'number' ? [i] : []; }
      },

      selectedIndexes: {
        get () { return this.getProperty('selectedIndexes') || []; },
        set (indexes) {
          const maxLength = this.items.length;
          this.setProperty(
            'selectedIndexes',
            (indexes || []).filter(i => i >= 0 && i < maxLength));
          this.update();
          signal(this, 'selection', this.selection);
        }
      },

      selection: {
        group: 'list',
        after: ['selections'],
        get () { return this.selections[0]; },
        set (itemOrValue) { this.selections = [itemOrValue]; }
      },

      selections: {
        group: 'list',
        after: ['selectedIndexes'],
        get () { return this.selectedIndexes.map(i => this.items[i] && this.items[i].value); },
        set (sels) { this.selectedIndexes = sels.map(ea => this.findIndex(ea)); }
      },

      selectedItems: {
        after: ['selectedIndexes'],
        readOnly: true,
        get () { return this.selectedIndexes.map(i => this.items[i]); }
      },

      submorphs: {
        initialize (submorphs) { this.initializeSubmorphs(submorphs); }
      },

      listItemContainer: {
        after: ['submorphs'],
        readOnly: true,
        get () { return this.getSubmorphNamed('listItemContainer'); }
      },

      itemMorphs: {
        after: ['submorphs'],
        readOnly: true,
        get () { return this.listItemContainer.submorphs; }
      },

      scrollBar: {
        after: ['submorphs'],
        readOnly: true,
        get () { return this.getSubmorphNamed('scrollbar'); }
      },

      scroller: {
        after: ['submorphs'],
        readOnly: true,
        get () { return this.getSubmorphNamed('scroller'); }
      },

      scrollable: {
        derived: true,
        get () {
          return this.padding.top() + this.items.length * this.itemHeight > this.height;
        }
      },

      manualItemHeight: { type: 'Boolean' },

      itemHeight: {
        isStyleProp: true,
        after: ['fontFamily', 'fontSize', 'itemPadding'],
        defaultValue: 10,
        set (val) {
          this.setProperty('itemHeight', val);
          this.manualItemHeight = typeof val === 'number';
          this.update();
        },
        get () {
          const height = this.getProperty('itemHeight');
          if (height) return height;
          let h = this.env.fontMetric.defaultLineHeight(
            { fontFamily: this.fontFamily, fontSize: this.fontSize });
          const padding = this.itemPadding;
          if (padding) h += padding.top() + padding.bottom();
          this.setProperty('itemHeight', h);
          return h;
        }
      },

      theme: {
        after: ['styleClasses'],
        defaultValue: 'default',
        set (val) {
          this.removeStyleClass(this.theme);
          this.addStyleClass(val);
          this.setProperty('theme', val);
        }
      }

    };
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    super.__additionally_serialize__(snapshot, ref, pool, addFn);
    this.whenEnvReady().then(() => this.update());
  }

  onLoad () {
    this.scroller.visible = touchInputDevice;
  }

  initializeSubmorphs (submorphs) {
    let container, scroller;
    submorphs = submorphs || this.submorphs || [];
    this.submorphs = submorphs;
    for (let i = 0; i < submorphs.length; i++) {
      switch (submorphs[i].name) {
        case 'listItemContainer': container = submorphs[i]; continue;
        case 'scroller': scroller = submorphs[i]; continue;
      }
    }
    if (!scroller) {
      scroller = this.addMorph(new ListScroller({
        draggable: false,
        grabbable: false,
        acceptsDrops: false,
        halosEnabled: false,
        name: 'scroller'
      }));
    }
    if (!container) {
      this.addMorph({
        name: 'listItemContainer',
        fill: Color.transparent,
        halosEnabled: false, // renderOnGPU: true,
        reactsToPointer: false,
        acceptsDrops: false,
        draggable: false
      });
    }
    if (container || scroller) this.update();
  }

  get isList () { return true; }

  onChange (change) {
    const { prop } = change;
    const styleProps = [
      'fontFamily', 'fontColor', 'fontSize', 'padding',
      'selectionFontColor', 'selectionColor',
      'nonSelectionFontColor', 'itemPadding', 'items'];
    if (styleProps.includes(prop)) this.update();
    return super.onChange(change);
  }

  itemForClick (evt) {
    const clickedPos = evt.positionIn(this.world()).subPt(this.scroll);
    const items = this.listItemContainer.morphsContainingPoint(clickedPos);
    return items.find(m => m.isListItem) || items[0];
  }

  clickOnItem (evt) {
    const item = this.itemForClick(evt);
    if (!item) return;
    const { state: { clickCount } } = evt;
    if (evt.positionIn(this).x > this.width - this.scrollbarOffset.x) return;
    const method = clickCount === 2 ? 'onItemMorphDoubleClicked' : 'onItemMorphClicked';
    this[method](evt, item);
  }

  get connections () {
    return { selection: { signalOnAssignment: false } };
  }

  invalidateCache () {
    if (!this.manualItemHeight) { this.setProperty('itemHeight', null); }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // items

  find (itemOrValue) {
    return this.items.find(item => item === itemOrValue || item.value === itemOrValue);
  }

  findIndex (itemOrValue) {
    return this.items.findIndex(item => item === itemOrValue || item.value === itemOrValue);
  }

  addItem (item) { return this.addItemAt(item); }

  addItemAt (item, index = this.items.length) {
    const items = this.items;
    index = Math.min(items.length, Math.max(0, index));
    items.splice(index, 0, asItem(item));

    this.addMethodCallChangeDoing({
      target: this,
      selector: 'addItemAt',
      args: [item, index],
      undo: {
        target: this,
        selector: 'removeItem',
        args: [item]
      }
    }, () => this.update());
  }

  removeItem (itemOrValue) {
    const item = this.find(itemOrValue);
    const items = this.items;
    const index = items.indexOf(item);
    if (index === -1) return;

    items.splice(index, 1);

    this.addMethodCallChangeDoing({
      target: this,
      selector: 'removeItem',
      args: [item],
      undo: {
        target: this,
        selector: 'addItemAt',
        args: [item, index]
      }
    }, () => this.update());
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  selectItemMorph (itemMorph) {
    this.selectedIndexes = [itemMorph.itemIndex];
  }

  gotoIndex (i) {
    if (this.arrowNavigationProhibited) return false;
    this.scrollIndexIntoView(this.selectedIndex = i);
    return true;
  }

  indexUp (from) {
    from = typeof from === 'number' ? from : this.selectedIndex;
    // wrap around:
    return (from || this.items.length) - 1;
  }

  indexDown (index = this.selectedIndex) {
    index = typeof index === 'number' ? index : -1;
    return (index + 1) % this.items.length;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  update () {
    const items = this.items;
    if (!items || !this.scroller) return; // pre-initialize
    this.dontRecordChangesWhile(() => {
      let {
        itemHeight,
        itemMorphs, listItemContainer,
        selectedIndexes,
        extent: { x: width, y: height },
        fontSize, fontFamily, fontColor,
        padding = Rectangle.inset(0), itemPadding, selectionColor,
        selectionFontColor, nonSelectionFontColor,
        itemBorderRadius, scrollBar, scroller, scrollable
      } = this;
      const { scroll: { y: top } } = scroller;
      const padTop = padding.top();
      const padLeft = padding.left();
      const padBottom = padding.bottom();
      const padRight = padding.right();
      const firstItemIndex = Math.max(0, Math.floor((top) / itemHeight));
      const lastItemIndex = Math.min(items.length, firstItemIndex + (height / itemHeight) + 2);
      let maxWidth = 0;
      const goalWidth = width - (padLeft + padRight);

      // try to keep itemIndexes in the items that were initially assigned to them
      let rest, upper, lower;

      itemMorphs = arr.sortBy(itemMorphs, m => m.itemIndex);
      [upper, rest] = arr.partition(itemMorphs, m => m.itemIndex < firstItemIndex);
      [lower, rest] = arr.partition(rest, m => m.itemIndex > lastItemIndex - 1);
      itemMorphs = [...lower, ...rest, ...upper];

      for (let i = 0; i < lastItemIndex - firstItemIndex; i++) {
        const itemIndex = firstItemIndex + i;
        const item = items[itemIndex];

        if (!item) {
          // if no items to display, remove remaining itemMorphs
          itemMorphs.slice(i).forEach(itemMorph => {
            itemMorph.remove();
          });
          break;
        }

        const style = {
          fontSize,
          fontFamily,
          fontColor: nonSelectionFontColor || fontColor,
          padding: itemPadding || Rectangle.inset(0),
          borderRadius: itemBorderRadius || 0,
          selectionFontColor,
          nonSelectionFontColor,
          selectionColor
        }; let itemMorph = itemMorphs[i];

        if (!itemMorph) {
          this.withMetaDo({ skipReconciliation: true }, () => {
            itemMorph = itemMorphs[i] = listItemContainer.addMorph(new ListItemMorph(style));
          });
        }
        itemMorph.reactsToPointer = !scrollable;
        itemMorph.displayItem(
          item, itemIndex,
          goalWidth, itemHeight,
          pt(0, itemHeight * itemIndex),
          selectedIndexes.includes(itemIndex),
          style);

        maxWidth = Math.max(maxWidth, itemMorph.width);
      }

      itemMorphs.slice(lastItemIndex - firstItemIndex).forEach(ea => ea.remove());

      const totalItemHeight = Math.max(padTop + padBottom + itemHeight * items.length, this.height);
      listItemContainer.setBounds(pt(padLeft, padTop).subXY(0, top).extent(pt(this.width, totalItemHeight)));
      scroller.extent = this.extent.subXY(this.borderWidthRight, this.borderWidthBottom);
      scrollBar.left = maxWidth / 2;
      scroller.position = pt(0, 0);
      scrollBar.extent = pt(1, totalItemHeight);
    });
  }

  scrollSelectionIntoView () {
    if (this.selection) this.scrollIndexIntoView(this.selectedIndex);
  }

  scrollIndexIntoView (idx) {
    const { itemHeight, width, itemScroll } = this;
    const itemBounds = new Rectangle(0, idx * itemHeight, width, itemHeight);
    const visibleBounds = this.innerBounds().insetByRect(this.padding).translatedBy(itemScroll);
    const offsetX = 0; let offsetY = 0;
    if (itemBounds.bottom() > visibleBounds.bottom()) { offsetY = itemBounds.bottom() - (visibleBounds.bottom()); }
    if (itemBounds.top() < visibleBounds.top()) { offsetY = itemBounds.top() - visibleBounds.top(); }
    this.itemScroll = itemScroll.addXY(offsetX, offsetY);
    this.update();
  }

  onItemMorphDoubleClicked (evt, itemMorph) {}

  onItemMorphClicked (evt, itemMorph) {
    if (itemMorph.itemIndex === undefined) return;
    const itemI = itemMorph.itemIndex;
    const { selectedIndexes } = this;
    const isClickOnSelected = selectedIndexes.includes(itemI);
    let indexes = [];

    if (this.multiSelect) {
      if (evt.isShiftDown()) {
        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea !== itemI);
        } else {
          // select from last selected to clicked item
          const from = selectedIndexes[0];
          const added = typeof from === 'number' ? arr.range(itemI, from) : [itemI];
          indexes = added.concat(selectedIndexes.filter(ea => !added.includes(ea)));
        }
      } else if (this.multiSelectWithSimpleClick || evt.isCommandKey()) {
        // deselect item
        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea !== itemI);
        } else {
          // just add clicked item to selection list
          indexes = [itemI].concat(selectedIndexes.filter(ea => ea !== itemI));
        }
      } else indexes = [itemI];
    } else indexes = [itemI];

    this.selectedIndexes = indexes;
  }

  onItemMorphDragged (evt, itemMorph) {}

  onHoverIn (evt) {
    if (this.scrollable) { this.scroller.visible = true; }
  }

  onHoverOut (evt) {
    if (!touchInputDevice) { this.scroller.visible = false; }
  }

  onDragStart (evt) {}

  onDrag (evt) {}

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get keybindings () {
    return [
      { keys: 'Up|Ctrl-P', command: 'arrow up' },
      { keys: 'Down|Ctrl-N', command: 'arrow down' },
      { keys: 'Shift-Up', command: 'select up' },
      { keys: 'Shift-Down', command: 'select down' },
      { keys: { win: 'Ctrl-A', mac: 'Meta-A' }, command: 'select all' },
      { keys: 'Alt-V|PageUp', command: 'page up' },
      { keys: 'Ctrl-V|PageDown', command: 'page down' },
      { keys: 'Alt-Shift-,', command: 'goto first item' },
      { keys: 'Alt-Shift-.', command: 'goto last item' },
      { keys: 'Alt-Space', command: 'select via filter' },
      { keys: 'Ctrl-L', command: 'realign top-bottom-center' }
    ].concat(super.keybindings);
  }

  get commands () { return listCommands; }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class FilterableList extends Morph {
  static get properties () {
    return {

      fill: { defaultValue: Color.transparent },
      borderWidth: { defaultValue: 1 },
      updateSelectionsAfterFilter: { defaultValue: false },

      theme: {
        after: ['styleClasses', 'listMorph'],
        defaultValue: 'default',
        set (val) {
          this.removeStyleClass(this.theme);
          this.listMorph.removeStyleClass(this.theme);
          this.addStyleClass(val);
          this.listMorph.addStyleClass(val);
          this.setProperty('theme', val);
        }
      },

      submorphs: {
        initialize () {
          const input = Text.makeInputLine({
            name: 'input',
            highlightWhenFocused: false,
            fixedHeight: false,
            autofit: false
          });
          this.submorphs = [
            input,
            new morph({ name: 'padding', fill: Color.transparent }),
            new List({ name: 'list', items: [] })
          ];
        }
      },

      paddingMorph: {
        derived: true,
        readOnly: true,
        after: ['submorphs'],
        get () { return this.getSubmorphNamed('padding'); }
      },

      listMorph: {
        derived: true,
        readOnly: true,
        after: ['submorphs'],
        get () { return this.getSubmorphNamed('list'); }
      },

      inputMorph: {
        derived: true,
        readOnly: true,
        after: ['submorphs'],
        get () { return this.getSubmorphNamed('input'); }
      },

      fontFamily: {
        isStyleProp: true,
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.fontFamily; },
        set (val) {
          this.listMorph.fontFamily = val;
          this.inputMorph.fontFamily = val;
        }
      },

      padding: {
        isStyleProp: true,
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.padding; },
        set (val) {
          this.listMorph.padding = val;
          this.inputMorph.padding = val;
        }
      },

      fontSize: {
        isStyleProp: true,
        group: 'styling',
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.fontSize; },
        set (val) {
          this.listMorph.fontSize = val;
        }
      },

      itemPadding: {
        isStyleProp: true,
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.itemPadding; },
        set (val) { this.listMorph.itemPadding = val; }
      },

      inputPadding: {
        isStyleProp: true,
        derived: true,
        after: ['submorphs', 'padding'],
        get () { return this.inputMorph.padding; },
        set (val) { this.inputMorph.padding = val; }
      },

      input: {
        derived: true,
        after: ['submorphs'],
        defaultValue: '',
        get () { return this.inputMorph.input; },
        set (val) { this.inputMorph.input = val; }
      },

      historyId: {
        derived: true,
        after: ['submorphs'],
        defaultValue: null,
        get () { return this.inputMorph.historyId; },
        set (val) { this.inputMorph.historyId = val; }
      },

      multiSelect: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.multiSelect; },
        set (multiSelect) { this.listMorph.multiSelect = multiSelect; }
      },

      items: {
        after: ['submorphs', 'fuzzy', 'fuzzySortFunction', 'fuzzyFilterFunction'],
        defaultValue: [],
        set (items) {
          this.setProperty('items', items.map(asItem));
          this.updateFilter();
        }
      },

      visibleItems: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.items; }
      },

      selection: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.selection; },
        set (x) { this.listMorph.selection = x; }
      },

      selectedIndex: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.selectedIndex; },
        set (x) { this.listMorph.selectedIndex = x; }
      },

      selectedIndexes: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.selectedIndexes; },
        set (x) { this.listMorph.selectedIndexes = x; }
      },

      selectedItems: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.selectedItems; },
        set (x) { this.listMorph.selectedItems = x; }
      },

      selections: {
        derived: true,
        after: ['submorphs'],
        get () { return this.listMorph.selections; },
        set (x) { this.listMorph.selections = x; }
      },

      fuzzy: {
        derived: true,
        after: ['filterFunction', 'sortFunction'],
        set (fuzzy) {
          // fuzzy => bool or prop;
          this.setProperty('fuzzy', fuzzy);
          if (!fuzzy) {
            if (this.sortFunction === this.fuzzySortFunction) { this.sortFunction = null; }
            if (this.filterFunction === this.fuzzyFilterFunction) { this.filterFunction = this.defaultFilterFunction; }
          } else {
            if (!this.sortFunction) this.sortFunction = this.fuzzySortFunction;
            if (this.filterFunction === this.defaultFilterFunction) { this.filterFunction = this.fuzzyFilterFunction; }
          }
        }
      },

      filterFunction: {
        get () {
          let filterFunction = this.getProperty('filterFunction');
          if (!filterFunction) return this.defaultFilterFunction;
          if (typeof filterFunction === 'string') { filterFunction = eval(`(${filterFunction})`); }
          return filterFunction;
        }
      },

      sortFunction: {},

      defaultFilterFunction: {
        readOnly: true,
        get () {
          return this._defaultFilterFunction ||
              (this._defaultFilterFunction = (parsedInput, item) =>
                parsedInput.lowercasedTokens.every(token =>
                  item.string.toLowerCase().includes(token)));
        }
      },

      fuzzySortFunction: {
        get () {
          return this._fuzzySortFunction ||
              (this._fuzzySortFunction = (parsedInput, item) => {
                const prop = typeof this.fuzzy === 'string' ? this.fuzzy : 'string';
                // preioritize those completions that are close to the input
                const fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                let base = 0;
                parsedInput.lowercasedTokens.forEach(t => {
                  if (fuzzyValue.startsWith(t)) base -= 10;
                  else if (fuzzyValue.includes(t)) base -= 5;
                });
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue.toLowerCase(), token))) + base;
              });
        }
      },

      fuzzyFilterFunction: {
        get () {
          return this._fuzzyFilterFunction ||
              (this._fuzzyFilterFunction = (parsedInput, item) => {
                const prop = typeof this.fuzzy === 'string' ? this.fuzzy : 'string';
                const tokens = parsedInput.lowercasedTokens;
                if (tokens.every(token => item.string.toLowerCase().includes(token))) return true;
                // "fuzzy" match against item.string or another prop of item
                const fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue, token))) <= 3;
              });
        }
      },

      selectedAction: {
        get () { return this.getProperty('selectedAction') || 'default'; }
      },

      actions: {}
    };
  }

  constructor (props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    connect(this.inputMorph, 'inputChanged', this, 'updateFilter');
    connect(this.listMorph, 'selection', this, 'selectionChanged');
    connect(this.listMorph, 'onItemMorphDoubleClicked', this, 'acceptInput');
    this.updateFilter();
    connect(this, 'extent', this, 'relayout');
  }

  resetConnections () {
    const cs = this.attributeConnections;
    if (!cs) return;
    const props = ['accepted', 'canceled', 'remove'];
    cs.filter(c => props.includes(c.sourceAttrName) && c.targetObj !== this)
      .forEach(c => c.disconnect());
  }

  get isList () { return true; }

  relayout () {
    const { listMorph, inputMorph, paddingMorph, borderWidth: offset } = this;
    this.withMetaDo({ metaInteraction: true }, () => {
      inputMorph.topLeft = pt(offset, offset);
      inputMorph.width = listMorph.width = this.width - 2 * offset;
      if (paddingMorph) {
        paddingMorph.topLeft = inputMorph.bottomLeft;
      }
      listMorph.position = paddingMorph ? paddingMorph.bottomLeft : inputMorph.bottomLeft;
      listMorph.height = Math.floor(this.height - listMorph.top - offset);
    });
  }

  focus () { this.get('input').focus(); }

  selectionChanged (sel) { signal(this, 'selection', sel); }

  scrollSelectionIntoView () { return this.listMorph.scrollSelectionIntoView(); }

  parseInput () {
    const filterText = this.get('input').textString;

    // parser that allows escapes
    const parsed = Array.from(filterText).reduce((state, char) => {
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
    }, { tokens: [], current: '', escaped: false, spaceSeen: false });
    parsed.current && parsed.tokens.push(parsed.current);
    const lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return { tokens: parsed.tokens, lowercasedTokens, input: filterText };
  }

  updateFilter () {
    const parsedInput = this.parseInput();
    const filterFunction = this.filterFunction;
    const sortFunction = this.sortFunction;
    let filteredItems = this.items.filter(item => filterFunction.call(this, parsedInput, item));

    if (sortFunction) { filteredItems = arr.sortBy(filteredItems, ea => sortFunction.call(this, parsedInput, ea)); }

    const list = this.listMorph;
    const newSelectedIndexes = this.updateSelectionsAfterFilter
      ? list.selectedIndexes.map(i => filteredItems.indexOf(list.items[i])).filter(i => i !== -1)
      : list.selectedIndexes;

    list.items = filteredItems;
    list.selectedIndexes = newSelectedIndexes.length ? newSelectedIndexes : filteredItems.length ? [0] : [];
    this.scrollSelectionIntoView();

    signal(this, 'filterChanged', { parsedInput, items: list.items });
  }

  acceptInput () {
    const list = this.listMorph;
    this.get('input').acceptInput();
    const result = {
      filtered: this.items,
      selected: list.selections,
      action: this.selectedAction,
      status: 'accepted'
    };
    signal(this, 'accepted', result);
    return result;
  }

  get keybindings () {
    return [
      { keys: 'Up|Ctrl-P', command: 'arrow up' },
      { keys: 'Down|Ctrl-N', command: 'arrow down' },
      { keys: 'Shift-Up', command: 'select up' },
      { keys: 'Shift-Down', command: 'select down' },
      { keys: 'Alt-V|PageUp', command: 'page up' },
      { keys: 'PageDown', command: 'page down' },
      { keys: 'Alt-Shift-,', command: 'goto first item' },
      { keys: 'Alt-Shift-.', command: 'goto last item' },
      { keys: 'Enter', command: 'accept input' },
      { keys: 'Escape|Ctrl-G', command: 'cancel' },
      { keys: 'Tab', command: 'choose action' },
      ...arr.range(0, 8).map(n => {
        return {
          keys: 'Alt-' + (n + 1),
          command: { command: 'choose action and accept input', args: { actionNo: n } }
        };
      })
    ].concat(super.keybindings);
  }

  get commands () {
    return super.commands.concat([
      {
        name: 'accept input',
        exec: (morph) => { this.acceptInput(); return true; }
      },

      {
        name: 'cancel',
        exec: (morph) => {
          signal(morph, 'canceled');
          return true;
        }
      },

      {
        name: 'choose action and accept input',
        exec: (flist, args = {}) => {
          const { actionNo = 0 } = args;
          flist.selectedAction = (flist.actions || [])[actionNo];
          return flist.execCommand('accept input');
        }
      },

      {
        name: 'choose action',
        exec: async (morph) => {
          if (!morph.actions) return true;

          const similarStyle = { ...morph.style, extent: morph.extent };
          const chooser = new FilterableList(similarStyle);
          chooser.openInWorld(morph.globalPosition);
          chooser.items = morph.actions;
          let preselect = morph.actions.indexOf(morph.selectedAction);
          if (preselect === -1) preselect = 0;
          chooser.selectedIndex = preselect;
          connect(chooser, 'accepted', morph, 'selectedAction', {
            converter: function (result) {
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return result.selected[0];
            }
          });
          connect(chooser, 'canceled', morph, 'selectedAction', {
            converter: function (result) {
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return this.targetObj.selectedAction;
            }
          });
          chooser.focus();

          return true;
        }
      },

      ...listCommands.map(cmd =>
        ({ ...cmd, exec: (morph, opts, count) => cmd.exec(this.listMorph, opts, count) }))
    ]);
  }
}

export class DropDownList extends Button {
  // new DropDownList({selection: 1, items: [1,2,3,4]}).openInWorld()

  static get properties () {
    return {

      padding: { defaultValue: Rectangle.inset(3, 2) },
      listHeight: { defaultValue: 100 },

      listAlign: {
        type: 'Enum',
        values: ['bottom', 'top'],
        defaultValue: 'bottom'
      },

      listOffset: { isStyleProp: true, defaultValue: pt(0, 0) },

      openListInWorld: { defaultValue: false },

      listMorph: {
        after: ['labelMorph'],
        get () {
          let list = this.getProperty('listMorph');
          if (list) return list;
          list = new List({ name: 'dropDownList' });
          this.setProperty('listMorph', list);
          return list;
        }
      },

      items: {
        derived: true,
        after: ['listMorph'],
        get () { return this.listMorph.items; },
        set (value) {
          const updateSelection = this.items.find(item => item.value === this.selection);
          this.listMorph.items = value;
          if (updateSelection) {
            noUpdate(() => {
              this.selection = this.items[0].value;
            });
          }
        }
      },
      selection: {
        after: ['listMorph', 'items'],
        derived: true,
        get () {
          return this.listMorph.selection;
        },
        set (value) {
          const { listMorph } = this;

          if (!value) {
            listMorph.selection = null;
            this.label = '';
          } else {
            const { items } = listMorph;
            let item = listMorph.find(value);
            if (!item && typeof value === 'string') {
              item = items.find(ea => ea.string === value);
            }
            if (!item) return;

            this.adjustLableFor(item);

            listMorph.selectedIndex = items.indexOf(item);
          }
          signal(this, 'selection', listMorph.selection);
        }
      }

    };
  }

  fitLabelMorph () {
    // do not fit!
  }

  constructor (props) {
    super(props);
    connect(this, 'fire', this, 'toggleList');
  }

  onLoad () {
    if (!this.listMorph.selection) this.listMorph.selection = this.labelMorph.value[0];
  }

  isListVisible () { return !!this.listMorph.world(); }

  removeWhenFocusLost (evt) {
    setTimeout(() => {
      const list = this.listMorph;
      const focused = this.world() && this.world().focusedMorph;
      if (focused !== list &&
          focused !== this &&
          list.world() &&
          !list.withAllSubmorphsDetect(m => m === focused)) {
        list.fadeOut(200);
      } else if (list.world()) {
        const target = touchInputDevice ? list.scroller : list;
        once(target, 'onBlur', this, 'removeWhenFocusLost');
        target.focus();
      }
    }, 100);
  }

  adjustLableFor (item) {
    let label = item.label || [item.string, null];
    label = [
      ...label, ' ', null,
      ...Icon.textAttribute(
        'caret-' + (this.listAlign === 'bottom'
          ? 'down'
          : 'up'))
    ];
    if (label[5]) {
      label[5].paddingRight = '0px';
      label[5].textStyleClasses = ['fa', 'annotation'];
    }
    this.label = label;
    this.relayout();
  }

  async toggleList () {
    const list = this.listMorph; let bounds;
    if (this.isListVisible()) {
      signal(this, 'deactivated');
      this.selection = list.selection;
      list.epiMorph = false;
      list.remove();
    } else {
      signal(this, 'activated');
      if (this.openListInWorld) {
        list.openInWorld();
        list.epiMorph = true;
        list.hasFixedPosition = true;
        list.setTransform(this.getGlobalTransform());
        bounds = this.globalBounds();
      } else {
        bounds = this.innerBounds();
        this.addMorph(list);
      }
      const totalItemHeight = (list.items.length * list.itemHeight) + list.padding.top() + list.padding.bottom();
      list.extent = pt(this.width, Math.min(this.listHeight, totalItemHeight));
      if (this.listAlign === 'top') {
        list.bottomLeft = bounds.topLeft();
      } else {
        list.topLeft = bounds.bottomLeft();
      }
      list.moveBy(this.listOffset || pt(0, 0));
      once(list, 'onItemMorphClicked', this, 'toggleList');
      once(touchInputDevice ? list.scroller : list, 'onBlur', this, 'removeWhenFocusLost');
      touchInputDevice ? list.scroller.focus() : list.focus();
      list.scrollSelectionIntoView();
    }
  }

  get commands () {
    return [
      {
        name: 'accept',
        exec: () => {
          if (this.isListVisible()) this.toggleList();
          return true;
        }
      },

      {
        name: 'cancel',
        exec: () => {
          if (this.isListVisible()) this.listMorph.remove();
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: 'Enter', command: 'accept' },
      { keys: 'Escape|Ctrl-G', command: 'cancel' }
    ]);
  }
}

export class InteractiveItem extends ListItemMorph {
  static get properties () {
    return {
      draggable: {
        defaultValue: !touchInputDevice
      },
      item: {
        derived: true,
        get () {
          return this.list.items[this.itemIndex];
        }
      },
      list: {
        derived: true,
        get () {
          return this.owner.owner;
        }
      },
      isListItem: {
        get () {
          return true;
        }
      }
    };
  }

  fit () {
    // resize the target according to the style
  }

  onHaloGrabover (active) {
    this.list.showDropPreviewFor(this, active);
  }

  async onDrop (evt) {
    // insert a morph item in my place, or if I receive a label morph,
    // just a vanilla label
    if (this.item.isPreview) {
      const wrappedMorph = evt.hand.grabbedMorphs[0];
      super.onDrop(evt);
      this.list.addItemAt({
        morph: wrappedMorph,
        isListItem: true
      }, this.itemIndex);
      this.list.clearPreviews();
    }
  }

  select () {
    this.list.selectedIndex = this.itemIndex;
    this.item.morph.focus();
  }

  onMouseDown (evt) {
    if (!touchInputDevice) { this.select(); } else { this._touchDown = Date.now(); }
  }

  onMouseUp (evt) {
    if (touchInputDevice && Date.now() - this._touchDown < 500) {
      this.select();
    }
  }

  displayItem (item, itemIndex, goalWidth, itemHeight, pos, isSelected = false, style) {
    super.displayItem(item, itemIndex, goalWidth, itemHeight, pos, isSelected, style);
    if (item.morph) item.morph.selected = isSelected;
  }

  onGrab (evt) {
    // fixme: on mobile this gesture needs to be triggered in a different way
    // maybe hold and wait?
    const list = this.list;
    const hasHaloAttached = evt.halo && evt.halo.target === this;
    if (hasHaloAttached) evt.halo.detachFromTarget();
    const copy = this.submorphs.length
      ? this.submorphs[0]
      : morph({ type: 'label', value: this.value });
    evt.hand.grab(copy);
    copy.position = evt.hand.localize(this.globalPosition);
    if (hasHaloAttached) evt.halo.refocus(copy);
    list.removeItem(this.list.items[this.itemIndex]);
    list.itemMorphs.forEach(m => m.remove());
    list.update();
  }
}

export class MorphList extends List {
  static get properties () {
    return {
      touchInput: {
        get () {
          return touchInputDevice;
        }
      },
      items: {
        group: 'list',
        defaultValue: [],
        after: ['submorphs'],
        set (items) {
          this.setProperty('items', items.map(asItem));
          this.itemMorphs.forEach(m => m.remove());
          this.update();
          if (this.attributeConnections) { signal(this, 'values', this.values); }
        }
      }
    };
  }

  onLoad () {
    super.onLoad();
    this.clipMode = this.touchInput ? 'auto' : 'hidden';
  }

  showDropPreviewFor (itemMorph, active) {
    const idx = itemMorph.itemIndex;
    const hoveredItem = this.items[idx];
    if (hoveredItem.isPreview && active) return;
    this.clearPreviews();
    if (!active) return;
    this.addItemAt({
      isListItem: true,
      isPreview: true,
      morph: morph({
        reactsToPointer: false,
        acceptsDrops: false,
        width: this.width - 5,
        height: this.itemHeight,
        fill: Color.orange.withA(0.5)
      })
    }, idx);
  }

  clearPreviews () {
    // remove embedded morphs that got detached
    this.items.filter(m => m.morph && m.morph.owner && !Path('morph.owner.isListItem').get(m))
      .map(async m => this.removeItem(m));
    this.items.filter(m => m.isPreview).map(p => this.removeItem(p));
    // this.items.filter(m => m.morph && Path('morph.owner.isListItem').get(m)).forEach(m => {
    //   m.morph.position = pt(0,0);
    //   m.morph.extent = m.morph.owner.extent;
    // });
    // fixme: add a proper relayout routine that fits morphs that are added to the list
  }

  update () {
    const items = this.items;
    if (!items) return; // pre-initialize
    if (!this.listItemContainer) return;
    if (this.scroller) this.scroller.visible = false;
    this.dontRecordChangesWhile(() => {
      let {
        itemHeight,
        itemMorphs, listItemContainer,
        selectedIndexes,
        extent: { x: width, y: height },
        fontSize, fontFamily, fontColor,
        padding = Rectangle.inset(0), itemPadding, selectionColor,
        selectionFontColor, nonSelectionFontColor,
        itemBorderRadius, scrollBar
      } = this;
      const { scroll: { y: top } } = this;
      const padTop = padding.top(); const padLeft = padding.left();
      const padBottom = padding.bottom(); const padRight = padding.right();
      const firstItemIndex = Math.max(0, Math.floor(top / itemHeight));
      const lastItemIndex = Math.min(items.length, Math.ceil((top + height) / itemHeight));
      let maxWidth = 0;
      const goalWidth = width - (padLeft + padRight);

      // try to keep itemIndexes in the items that were initially assigned to them
      let rest, upper, lower;

      itemMorphs = arr.sortBy(itemMorphs, m => m.itemIndex);
      [upper, rest] = arr.partition(itemMorphs, m => m.itemIndex < firstItemIndex);
      [lower, rest] = arr.partition(rest, m => m.itemIndex > lastItemIndex);
      itemMorphs = [...lower, ...rest, ...upper];

      const style = {
        fontSize,
        fontFamily,
        fontColor: nonSelectionFontColor || fontColor,
        padding: itemPadding || Rectangle.inset(0),
        borderRadius: itemBorderRadius || 0,
        selectionFontColor,
        nonSelectionFontColor,
        selectionColor
      };

      if (itemMorphs.length && lastItemIndex - firstItemIndex > itemMorphs.length) {
        if (firstItemIndex !== itemMorphs[0].itemIndex) { arr.pushAt(itemMorphs, listItemContainer.addMorph(new InteractiveItem(style)), 0); } else if (lastItemIndex === arr.last(itemMorphs).itemIndex) { itemMorphs.push(listItemContainer.addMorph(new InteractiveItem(style))); }
      }

      for (let i = 0; i < lastItemIndex - firstItemIndex; i++) {
        const itemIndex = firstItemIndex + i;
        const item = items[itemIndex];

        if (!item) {
          // if no items to display, remove remaining itemMorphs
          itemMorphs.slice(i).forEach(itemMorph => itemMorph.remove());
          break;
        }

        let itemMorph = itemMorphs[i];

        if (!itemMorph) {
          itemMorph = itemMorphs[i] = listItemContainer.addMorph(new InteractiveItem(style));
          itemMorph.clipMode = 'visible';
        }
        itemMorph.displayItem(
          item, itemIndex,
          goalWidth, itemHeight,
          pt(0, itemHeight * itemIndex),
          selectedIndexes.includes(itemIndex),
          style);

        maxWidth = Math.max(maxWidth, itemMorph.width);
      }

      let containerExtent; const scrollHeight = Math.max(padTop + padBottom + itemHeight * items.length, this.height);
      containerExtent = pt(this.width, scrollHeight).subPt(pt(padLeft + padRight, 0));
      listItemContainer.setBounds(pt(padLeft, padTop).extent(containerExtent));

      scrollBar.left = maxWidth - 10;
      scrollBar.fill = null;
      scrollBar.top = 0;
      scrollBar.extent = pt(1, scrollHeight);
    });
  }

  onHoverIn (evt) {
    this.clipMode = 'auto';
  }

  onHoverOut (evt) {
    if (this.touchInput) return;
    this.clipMode = 'hidden';
  }

  onScroll (evt) {
    this.update();
  }
}

// VIEW MODELS

export class DropDownListModel extends ButtonModel {
  static get properties () {
    return {

      listHeight: { defaultValue: 100 },

      listMaster: {
        isComponent: true,
        set (c) {
          this.setProperty('listMaster', c);
          if (this.listMorph) this.listMorph.remove();
          this.initListMorph();
        }
      },

      listAlign: {
        type: 'Enum',
        values: ['bottom', 'top', 'selection'],
        defaultValue: 'bottom'
      },

      action: {
        get () {
          return () => {
            this.toggleList();
          };
        }
      },

      listOffset: { isStyleProp: true, defaultValue: pt(0, 0) },

      openListInWorld: { defaultValue: false },

      listMorph: {
        after: ['listMaster'],
        serialize: false,
        initialize () {
          this.initListMorph();
        }
      },

      items: {
        // list of items
        initialize () {
          this.items = [];
        },
        set (items) {
          items = items.map(asItem);
          this.setProperty('items', items);
          if (!this.selection && items.length > 0) this.selection = items[0].value;
        }
      },
      selection: {
        // value or string referencing the selected item
      },

      expose: {
        get () {
          return ['keybindings', 'commands', 'items', 'selection', 'setMixed', 'isMixed', 'enable', 'disable'];
        }
      },

      commands: {
        get () {
          return [
            {
              name: 'accept',
              exec: () => {
                if (this.isListVisible()) this.toggleList();
                return true;
              }
            },

            {
              name: 'cancel',
              exec: () => {
                if (this.isListVisible()) this.listMorph.remove();
                return true;
              }
            }
          ];
        }
      },

      keybindings: {
        get () {
          return [
            { keys: 'Enter', command: 'accept' },
            { keys: 'Escape|Ctrl-G', command: 'cancel' }
          ];
        }
      }

    };
  }

  initListMorph () {
    this.listMorph = this.listMaster ? part(this.listMaster, { isLayoutable: false, name: 'dropDownList', viewModel: { items: [] } }) : new List({ items: [] });
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    const meta = this.listMaster && this.listMaster[Symbol.for('lively-module-meta')];
    if (meta) {
      addFn('listMaster', pool.expressionSerializer.exprStringEncode({
        __expr__: meta.export,
        bindings: {
          [meta.module]: meta.export
        }
      }));
    }
  }

  viewDidLoad () {
    this.onRefresh('selection');
  }

  onRefresh (prop) {
    const { listMorph } = this;
    const sel = this.selection;

    if (!listMorph) return super.onRefresh(prop);

    listMorph.items = this.items;

    if (!sel) {
      listMorph.selection = null;
      this.label = { value: '' };
    } else {
      const { items } = listMorph;
      let item = listMorph.find(sel);
      if (!item && typeof sel === 'string') {
        item = items.find(ea => ea.string === sel);
      }
      if (!item) return super.onRefresh(prop);

      if (prop === 'selection') this.adjustLableFor(item);

      listMorph.selectedIndex = items.indexOf(item);
    }
    super.onRefresh(prop); // handles the label update
  }

  attach (view) {
    super.attach(view);
    // default select the first item
    if (!this.selection && this.items.length > 0) { this.selection = this.items[0].value; }
  }

  isListVisible () { return !!this.listMorph.world(); }

  removeWhenFocusLost (evt) {
    setTimeout(() => {
      const list = this.listMorph;
      const focused = this.world() && this.world().focusedMorph;
      if (focused !== list &&
          focused !== this.view &&
          list.world() &&
          !list.withAllSubmorphsDetect(m => m === focused)) {
        list.fadeOut(200);
      } else if (list.world()) {
        const target = touchInputDevice ? list.scroller : list;
        once(target, 'onBlur', this, 'removeWhenFocusLost');
        target.focus();
      }
    }, 100);
  }

  adjustLableFor (item) {
    let label = item.label || [item.string, null];
    let caret = Icon.textAttribute('angle-down', { paddingTop: '2px' });
    if (this.listAlign !== 'selection') {
      caret = Icon.textAttribute(
        'caret-' + (this.listAlign === 'bottom'
          ? 'down'
          : 'up'), {
          paddingTop: this.listAlign === 'bottom' ? '0px' : '2px'
        });
    }
    label = [
      ...label, ' ', null,
      ...caret
    ];
    if (label[5]) {
      label[5].paddingRight = '0px';
      label[5].textStyleClasses = ['fa', 'annotation'];
    }
    this.label = { value: label };
  }

  get isMixed () {
    return this.label?.value[0] === 'Mix';
  }

  setMixed () {
    this.label = { value: ['Mix', null] };
  }

  async toggleList () {
    const list = this.listMorph; let bounds;
    const { view } = this;
    list.isHaloItem = true;
    if (this.isListVisible()) {
      signal(this, 'deactivated');
      this.selection = list.selection;
      list.epiMorph = false;
      list.remove();
    } else {
      signal(this, 'activated');
      if (this.openListInWorld) {
        list.openInWorld();
        list.epiMorph = true;
        list.hasFixedPosition = true;
        list.setTransform(view.getGlobalTransform());
        list.styleClasses = ['Popups'];
        bounds = view.globalBounds();
      } else {
        bounds = view.innerBounds();
        view.addMorph(list);
      }
      const totalItemHeight = (list.items.length * list.itemHeight) + list.padding.top() + list.padding.bottom();
      list.extent = pt(view.width, Math.min(this.listHeight, totalItemHeight));
      if (this.listAlign === 'top') {
        list.bottomLeft = bounds.topLeft().addPt(this.listOffset || pt(0, 0));
      } else if (this.listAlign === 'bottom') {
        list.topLeft = bounds.bottomLeft().addPt(this.listOffset || pt(0, 0));
      } else {
        // move the list to the selection
        list.topLeft = bounds.topLeft().subXY(0, list.itemHeight * (list.selectedIndex || 0));
      }
      once(list, 'onItemMorphClicked', this, 'toggleList');
      once(touchInputDevice ? list.scroller : list, 'onBlur', this, 'removeWhenFocusLost');
      touchInputDevice ? list.scroller.focus() : list.focus();
      list.scrollSelectionIntoView();
    }
  }
}
