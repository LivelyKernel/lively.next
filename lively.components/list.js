import { Morph, Text, StyleSheet, Label, Icon, morph, touchInputDevice } from "lively.morphic";
import { pt, LinearGradient, Color, Rectangle, rect } from "lively.graphics";
import { arr, Path, string } from "lively.lang";
import { signal, once } from "lively.bindings";
import { Button } from "./buttons.js";
import bowser from 'bowser';

export function asItem(obj) {
  // make sure that object is of the form
  // {isListItem: true, string: STRING, value: OBJECT}
  if (obj && obj.isListItem && typeof obj.string === "string") return obj;
  if (!obj || !obj.isListItem) return {isListItem: true, string: String(obj), value: obj};
  var label = obj.string || obj.label || "no item.string";
  obj.string = !label || typeof label === "string" ? String(label) :
    Array.isArray(label) ?
      label.map((text, i) => i%2==0? String(text) : "").join("") :
      String(label);
  return obj;
}

export class ListItemMorph extends Label {

  static get properties() {
    return {
      clipMode:              {defaultValue: "hidden"},
      autofit:               {defaultValue: false},
      isSelected:            {defaultValue: false},
      draggable:             {defaultValue: !touchInputDevice },
      fill: {
        derived: true,
        get() {
          if (touchInputDevice && this.pressed) return Color.gray.withA(.5);
          return this.isSelected ? this.selectionColor : Color.transparent;
        }
      },
      itemIndex:             {defaultValue: undefined},
      selectionFontColor:    {isStyleProp: true, defaultValue: Color.white},
      selectionColor: {
        type: 'ColorGradient',
        isStyleProp: true,
        defaultValue: Color.blue
      },
      nonSelectionFontColor: {isStyleProp: true, defaultValue: Color.rgbHex("333")},
      fontColor: {
        derived: true,
        get() {
          return this.isSelected ? this.selectionFontColor : this.nonSelectionFontColor;
        }
      }
    };
  }

  displayItem(item, itemIndex, goalWidth, itemHeight, pos, isSelected = false, style) {
    let itemMorph = item.morph,
        label = itemMorph ? "" : (item.label || item.string || "no item.string");

    if (item.annotation) this.valueAndAnnotation = {value: label, annotation: item.annotation};
    else if (typeof label === "string") this.textString = label;
    else this.value = label;

    this.tooltip = this.tooltip || this.textString;
    this.itemIndex = itemIndex;
    this.position = pos;

    if (style) {
      let {
        fontFamily,
        selectionColor,
        selectionFontColor,
        nonSelectionFontColor,
        borderRadius,
        fontSize,
        padding
      } = style;
      if (selectionFontColor && this.selectionFontColor !== selectionFontColor)
        this.selectionFontColor = selectionFontColor;
      if (nonSelectionFontColor && this.nonSelectionFontColor !== nonSelectionFontColor)
        this.nonSelectionFontColor = nonSelectionFontColor;
      if (selectionColor && this.selectionColor !== selectionColor)
        this.selectionColor = selectionColor;
      if (borderRadius && borderRadius != this.borderRadius)
        this.borderRadius = borderRadius;
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
      let width = itemMorph ? Math.max(itemMorph.width, goalWidth) : goalWidth,
          height = itemHeight; // itemMorph ? Math.max(itemMorph.height, itemHeight) : itemHeight;
      this.extent = pt(width, height);
    }

    if (itemMorph) {
      let tfm = itemMorph.getTransform().copy();
      this.submorphs = [itemMorph];
      itemMorph.setTransform(tfm);
      itemMorph.position = pt(0,0);
    }
    else if (this.submorphs.length) this.submorphs = [];

    this.isSelected = isSelected;
  }

  onDragStart(evt) {
    let list = this.owner.owner;
    this._dragState = {sourceIsSelected: this.isSelected, source: this, itemsTouched: []};
    if (!list.multiSelect || !list.multiSelectViaDrag)
      list.onItemMorphDragged(evt, this);
  }

  onMouseDown(evt) {
    super.onMouseDown(evt);
    this.owner.owner.clickOnItem(evt);
  }

  onDrag(evt) {
    let list = this.owner.owner;
    if (list.multiSelect && list.multiSelectViaDrag) {
      let below = evt.hand.morphBeneath(evt.position),
          {selectedIndexes, itemMorphs} = list;
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
}

class ListScroller extends Morph {
  
  static get properties() {
    return {
      name: {defaultValue: "scroller"},
      fill: {defaultValue: Color.transparent},
      clipMode: {defaultValue: "auto"},
      scrollbar: {
        derived: true, readOnly: true, after: ['submorphs'],
        get() { return this.submorphs[0]; }
      },
      submorphs: {
        initialize() { this.submorphs = [{name: 'scrollbar'}]; }
      }
    }
  }

  onScroll(evt) { 
    return this.owner.update();
  }
  
  onMouseDown(evt) {
    let scrollY = this.scroll.y;
    if (touchInputDevice) {
      let item = this.owner.itemForClick(evt);
      if (!item) return;
      item.pressed = true;
      item.makeDirty();
      setTimeout(() => {
         item.pressed = false;
         if (scrollY - this.scroll.y != 0) return;
         return this.owner.clickOnItem(evt);
      }, 300); 
      return;
    } 
    return this.owner.clickOnItem(evt);
  }
}

var listCommands = [
  {
    name: "page up",
    exec: (list) => {
      var index = list.selectedIndex,
          newIndex = Math.max(0, index - Math.round(list.height / list.itemHeight));
      list.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "page down",
    exec: (list) => {
      var index = list.selectedIndex,
          newIndex = Math.min(list.items.length-1, index + Math.round(list.height / list.itemHeight));
      list.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "goto first item",
    exec: (list) => { list.gotoIndex(0); return true; }
  },

  {
    name: "goto last item",
    exec: (list) => { list.gotoIndex(list.items.length-1); return true; }
  },

  {
    name: "arrow up",
    exec: (list) => { list.gotoIndex(list.indexUp()); return true; }
  },

  {
    name: "arrow down",
    exec: (list) => {
      list.gotoIndex(list.indexDown());
      return true;
    }
  },

  {
    name: "select up",
    exec: (list) => {
      var selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length)
        return list.execCommand("arrow up");

      var current = selected[0];
      if (typeof current !== "number") list.selectedIndexes = [current];
      else {
        var up = list.indexUp(current);
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
    name: "select down",
    exec: (list) => {
      var selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length)
        return list.execCommand("arrow down");

      var current = selected[0],
          down = list.indexDown(current);
      if (selected.includes(current) && selected.includes(down)) {
        list.selectedIndexes = selected.filter(ea => ea !== current);
      } else {
        list.selectedIndexes = [down].concat(selected.filter(ea => ea !== down));
      }
      return true;
    }
  },

  {
    name: "select all",
    exec: (list) => {
      list.selectedIndexes = arr.range(list.items.length-1, 0);
      list.scrollIndexIntoView(list.selectedIndexes[0]);
      return true;
    }
  },

  {
    name: "select via filter",
    exec: async (list) => {
      var preselect = list.selectedIndex || 0;
      var {selected} = await list.world().filterableListPrompt(
        "Select item", list.items,
        {preselect, requester: list.getWindow() || list, itemPadding: Rectangle.inset(0,2), multiSelect: true});
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
    name: "realign top-bottom-center",
    exec: list => {
      if (!list.selection) return;
      var {padding, selectedIndex: idx, itemHeight, scroll: {x: scrollX, y: scrollY}} = list,
          pos = pt(0, idx*itemHeight),
          offsetX = 0, offsetY = 0,
          h = list.height - itemHeight - padding.top() - padding.bottom();
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
    name: "print contents in text window",
    exec: list => {
      var title = "items of " + list.name,
          content = list.items.map(item => {
            if (typeof item === "string") return item;
            var {string, label, annotation} = item,
                result = "";

            if (label) {
              if (typeof label === "string") result += label;
              else result += label.map((text, i) => i%2==0? text: "").join("");
            } else if (string) result += string;

            if (annotation) {
              result += " ";
              if (typeof annotation === "string") result += annotation;
              else result += annotation[0];
            }
            return result;
          }).join("\n");

      return list.world().execCommand("open text window",
        {title, content, name: title, fontFamily: "Monaco, monospace"});
    }
  }
];

export class List extends Morph {

  static get properties() {

    return {
      fill:            {defaultValue: Color.white},
      clipMode:        {defaultValue: 'hidden'},

      selectionFontColor:    {isStyleProp: true, defaultValue: Color.white},
      selectionColor: {
        type: 'ColorGradient',
        isStyleProp: true,
        defaultValue: Color.rgb(21,101,192)
      },
      nonSelectionFontColor: {isStyleProp: true, defaultValue: Color.rgbHex("333")},
      fontColor:             {isStyleProp: true, defaultValue: Color.rgbHex("333")},

      styleClasses: {defaultValue: ['default']},

      itemScroll: {
        /*
          We need to use a different property name for the list scroll,
          since the default scroll property is already rendered as a div
          with overflow hidden|scroll which we do not want since we implement
          the scroll for ourselves.
        */
        derived: true,
        after: ['submorphs'],
        get() { return this.scroller ? this.scroller.scroll : pt(0,0) },
        set(s) { if (this.scroller) this.scroller.scroll = s; }
      },

      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemWidgets/list/light'
          }
        }
      },
      
      extent: {
        set(value) {
          if (value.eqPt(this.extent)) return;
          this.setProperty("extent", value);
          this.update();
        }
      },

      fontFamily: {
        isStyleProp: true,
        defaultValue: "Helvetica Neue, Arial, sans-serif",
        set(value) {
          this.setProperty("fontFamily", value);
          this.invalidateCache();
        }
      },

      fontSize: {
        isStyleProp: true,
        defaultValue: 12,
        set(value) {
          this.setProperty("fontSize", value);
          this.invalidateCache();
        }
      },

      padding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(3),
      },

      itemBorderRadius: {
        isStyleProp: true, defaultValue: 0,
        set(value) {
          this.setProperty("itemBorderRadius", value);
          this.invalidateCache();
        }
      },

      itemPadding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(1),
        set(value) {
          this.setProperty("itemPadding", value);
          this.invalidateCache();
        }
      },

      items: {
        group: "list", defaultValue: [], after: ["submorphs"],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.update();
          if (this.attributeConnections)
            signal(this, "values", this.values);
        }
      },

      multiSelect: {
        defaultValue: false
      },

      multiSelectWithSimpleClick: {
        description: "Does a simple click toggle selections without deselecting?",
        defaultValue: false,
      },

      multiSelectViaDrag: {
        description: "Does dragging extend selection?",
        defaultValue: true,
      },

      values: {
        group: "list", after: ["items"], readOnly: true,
        get() { return this.items.map(ea => ea.value); }
      },

      selectedIndex: {
        group: "list",
        defaultValue: [], after: ["selectedIndexes"],
        get() { return this.selectedIndexes[0]; },
        set(i) { return this.selectedIndexes = typeof i === "number" ? [i] : []; }
      },

      selectedIndexes: {
        get() { return this.getProperty("selectedIndexes") || []; },
        set(indexes) {
          var maxLength = this.items.length;
          this.setProperty(
            "selectedIndexes",
            (indexes || []).filter(i => 0 <= i && i < maxLength));
          this.update();
          signal(this, "selection", this.selection);
        }
      },

      selection: {
        group: "list",
        after: ["selections"],
        get() { return this.selections[0]; },
        set(itemOrValue) { this.selections = [itemOrValue]; }
      },

      selections: {
        group: "list",
        after: ["selectedIndexes"],
        get() { return this.selectedIndexes.map(i => this.items[i] && this.items[i].value); },
        set(sels) { this.selectedIndexes = sels.map(ea => this.findIndex(ea)); }
      },

      selectedItems: {
        after: ["selectedIndexes"], readOnly: true,
        get() { return this.selectedIndexes.map(i => this.items[i]); }
      },

      submorphs: {
        initialize(submorphs) { this.initializeSubmorphs(submorphs); }
      },

      listItemContainer: {
        after: ["submorphs"], readOnly: true,
        get() { return this.getSubmorphNamed("listItemContainer"); }
      },

      itemMorphs: {
        after: ["submorphs"], readOnly: true,
        get() { return this.listItemContainer.submorphs; }
      },

      scrollBar: {
        after: ['submorphs'], readOnly: true,
        get() { return this.getSubmorphNamed('scrollbar') }
      },

      scroller: {
        after: ['submorphs'], readOnly: true,
        get() {  return this.getSubmorphNamed('scroller'); }
      },

      scrollable: {
        derived: true,
        get() {
          return this.padding.top() + this.items.length * this.itemHeight > this.height;
        }
      },

      manualItemHeight: {type: "Boolean"},

      itemHeight: {
        after: ["fontFamily", "fontSize", "itemPadding"],
        defaultValue: 10,
        set(val) {
          this.setProperty("itemHeight", val);
          this.manualItemHeight = typeof val === "number";
        },
        get() {
          let height = this.getProperty("itemHeight");
          if (height) return height;
          var h = this.env.fontMetric.defaultLineHeight(
                {fontFamily: this.fontFamily, fontSize: this.fontSize}),
              padding = this.itemPadding;
          if (padding) h += padding.top() + padding.bottom();
          this.setProperty("itemHeight", h);
          return h;
        }
      },

      theme: {
        after: ['styleClasses'],
        defaultValue: 'default',
        set(val) {
          this.removeStyleClass(this.theme);
          this.addStyleClass(val);
          this.setProperty('theme', val);
        }
      },

    };
  }

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    this.update();
  }

  __additionally_serialize__(snapshot, ref, pool, addFn){
    super.__additionally_serialize__(snapshot, ref, pool, addFn);
    this.whenRendered().then(() => this.update())
  }

  onLoad() {
     this.scroller.visible = touchInputDevice;
  }

  initializeSubmorphs(submorphs) {
    let container, scroller;
    submorphs = submorphs || this.submorphs || [];
    this.submorphs = submorphs;
    for (let i = 0; i < submorphs.length; i++) {
      switch (submorphs[i].name) {
        case "listItemContainer": container = submorphs[i]; continue;
        case "scroller": scroller = submorphs[i]; continue;
      }
    }
    if (!scroller) 
      scroller = this.addMorph(new ListScroller({
        draggable: false, grabbable: false,
        acceptsDrops: false, halosEnabled: false, name: "scroller"
      }));
    if (!container) this.addMorph({
      name: "listItemContainer", fill: Color.transparent,
      halosEnabled: false, // renderOnGPU: true,
      reactsToPointer: false,
      acceptsDrops: false, draggable: false
    });
    if (container || scroller) this.update();
  }

  get isList() { return true; }
  
  onChange(change) {
    var {prop} = change;
    var styleProps = [
      "fontFamily", "fontColor", "fontSize", "padding",
      "selectionFontColor", "selectionColor",
      "nonSelectionFontColor", "itemPadding", "items"];
    if (styleProps.includes(prop)) this.update();
    return super.onChange(change);
  }

  itemForClick(evt) {
    let clickedPos = evt.positionIn(this.world()).subPt(this.scroll);
    let items = this.listItemContainer.morphsContainingPoint(clickedPos);
    return items.find(m => m.isListItem) || items[0];
  }

  clickOnItem(evt) {
    let item = this.itemForClick(evt)
    var {state: {clickCount}} = evt,
        method = clickCount === 2 ? "onItemMorphDoubleClicked" : "onItemMorphClicked";
    this[method](evt, item);
  }

  get connections() {
    return {selection: {signalOnAssignment: false}};
  }

  invalidateCache() {
    if (!this.manualItemHeight)
      this.setProperty("itemHeight", null);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // items

  find(itemOrValue) {
    return this.items.find(item => item === itemOrValue || item.value === itemOrValue);
  }

  findIndex(itemOrValue) {
    return this.items.findIndex(item => item === itemOrValue || item.value === itemOrValue);
  }

  addItem(item) { return this.addItemAt(item); }

  addItemAt(item, index = this.items.length) {
    var items = this.items;
    index = Math.min(items.length, Math.max(0, index));
    items.splice(index, 0, asItem(item));

    this.addMethodCallChangeDoing({
      target: this,
      selector: "addItemAt",
      args: [item, index],
      undo: {
        target: this,
        selector: "removeItem",
        args: [item],
      }
    }, () => this.update());

  }

  removeItem(itemOrValue) {
    var item = this.find(itemOrValue),
        items = this.items,
        index = items.indexOf(item);
    if (index === -1) return;

    items.splice(index, 1);

    this.addMethodCallChangeDoing({
      target: this,
      selector: "removeItem",
      args: [item],
      undo: {
        target: this,
        selector: "addItemAt",
        args: [item, index],
      }
    }, () => this.update());

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  selectItemMorph(itemMorph) {
    this.selectedIndexes = [itemMorph.itemIndex];
  }

  gotoIndex(i) { this.scrollIndexIntoView(this.selectedIndex = i); }

  indexUp(from) {
    from = typeof from === "number" ? from : this.selectedIndex;
    // wrap around:
    return (from || this.items.length) - 1;
  }

  indexDown(index = this.selectedIndex) {
    index = typeof index === "number" ? index : -1;
    return (index + 1) % this.items.length;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  update() {
    var items = this.items;
    if (!items || !this.scroller) return; // pre-initialize

    this.dontRecordChangesWhile(() => {
      var {
            itemHeight,
            itemMorphs, listItemContainer,
            selectedIndexes,
            extent: {x: width, y: height},
            fontSize, fontFamily, fontColor,
            padding, itemPadding, selectionColor,
            selectionFontColor, nonSelectionFontColor,
            itemBorderRadius, scrollBar, scroller, scrollable
          } = this,
          {scroll: {x: left, y: top}} = scroller,
          padding = padding || Rectangle.inset(0),
          padTop = padding.top() , padLeft = padding.left(),
          padBottom = padding.bottom(), padRight = padding.right(),
          firstItemIndex = Math.max(0, Math.floor((top) / itemHeight)),
          lastItemIndex = Math.min(items.length, firstItemIndex + (height / itemHeight) + 2),
          maxWidth = 0,
          goalWidth = this.width - (padLeft + padRight);

      // try to keep itemIndexes in the items that were initially assigned to them
      let rest, upper, lower;
      
      itemMorphs = arr.sortBy(itemMorphs, m => m.itemIndex);
      [upper, rest] = arr.partition(itemMorphs, m => m.itemIndex < firstItemIndex);
      [lower, rest] = arr.partition(rest, m => m.itemIndex > lastItemIndex - 1);
      itemMorphs = [...lower, ...rest, ...upper];

      for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
        var itemIndex = firstItemIndex+i,
            item = items[itemIndex];

        if (!item) {
          // if no items to display, remove remaining itemMorphs
          itemMorphs.slice(i).forEach(itemMorph => {
            itemMorph.remove()
          });
          break;
        }

        let style = {
              fontSize, fontFamily,
              fontColor: nonSelectionFontColor || fontColor,
              padding: itemPadding, borderRadius: itemBorderRadius || 0,
              selectionFontColor,
              nonSelectionFontColor,
              selectionColor
            }, itemMorph = itemMorphs[i];

        if (!itemMorph) {
          itemMorph = itemMorphs[i] = listItemContainer.addMorph(new ListItemMorph(style));
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

      itemMorphs.slice(lastItemIndex-firstItemIndex).forEach(ea => ea.remove());

      let totalItemHeight = Math.max(padTop + padBottom + itemHeight * items.length, this.height);
      listItemContainer.setBounds(pt(padLeft, padTop).subXY(0, top).extent(pt(this.width, totalItemHeight)));
      scroller.extent = this.extent;
      scrollBar.left = maxWidth - 1;
      scroller.position = pt(0,0);
      scrollBar.extent = pt(1, totalItemHeight);
    });
  }

  scrollSelectionIntoView() {
    if (this.selection) this.scrollIndexIntoView(this.selectedIndex);
  }

  scrollIndexIntoView(idx) {
    var {itemHeight, width, itemScroll, scrollbarOffset} = this,
        itemBounds = new Rectangle(0, idx*itemHeight, width, itemHeight),
        visibleBounds = this.innerBounds().insetByRect(this.padding).translatedBy(itemScroll),
        offsetX = 0, offsetY = 0;
    if (itemBounds.bottom() > visibleBounds.bottom())
      offsetY = itemBounds.bottom() - (visibleBounds.bottom());
    if (itemBounds.top() < visibleBounds.top())
      offsetY = itemBounds.top() - visibleBounds.top();
    this.itemScroll = itemScroll.addXY(offsetX, offsetY);
    this.update();
  }

  onItemMorphDoubleClicked(evt, itemMorph) {}

  onItemMorphClicked(evt, itemMorph) {
    var itemI = itemMorph.itemIndex,
        {selectedIndexes} = this,
        isClickOnSelected = selectedIndexes.includes(itemI),
        indexes = [];

    if (this.multiSelect) {
      if (evt.isShiftDown()) {

        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea != itemI);
        } else {
          // select from last selected to clicked item
          var from = selectedIndexes[0],
              added = typeof from === "number" ? arr.range(itemI, from) : [itemI];
          indexes = added.concat(selectedIndexes.filter(ea => !added.includes(ea)));
        }

      } else if (this.multiSelectWithSimpleClick || evt.isCommandKey()) {

        // deselect item
        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea != itemI);
        } else {
          // just add clicked item to selection list
          indexes = [itemI].concat(selectedIndexes.filter(ea => ea != itemI));
        }

      } else indexes = [itemI];

    } else indexes = [itemI];

    this.selectedIndexes = indexes;
  }

  onItemMorphDragged(evt, itemMorph) {}

  onHoverIn(evt) {
    if (this.scrollable)
      this.scroller.visible = true;
  }

  onHoverOut(evt) {
    if (touchInputDevice) return;
    this.scroller.visible = false;
  }
  
  onDragStart(evt) {
    if (!this.multiSelect || !this.multiSelectViaDrag) return;
  }

  onDrag(evt) {}

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get keybindings() {
    return [
      {keys: "Up|Ctrl-P",                    command: "arrow up"},
      {keys: "Down|Ctrl-N",                  command: "arrow down"},
      {keys: "Shift-Up",                     command: "select up"},
      {keys: "Shift-Down",                   command: "select down"},
      {keys: {win: "Ctrl-A", mac: "Meta-A"}, command: "select all"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Alt-Space",                    command: "select via filter"},
      {keys: "Ctrl-L",                       command: "realign top-bottom-center"}
    ].concat(super.keybindings);
  }

  get commands() { return listCommands; }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { connect } from "lively.bindings";

export class FilterableList extends Morph {

  static get properties() {

    return {

      fill: {defaultValue: Color.transparent},
      borderWidth: {defaultValue: 1},
      updateSelectionsAfterFilter: {defaultValue: false},

      theme: {
        after: ['styleClasses', 'listMorph'],
        defaultValue: 'default',
        set(val) {
          this.removeStyleClass(this.theme);
          this.listMorph.removeStyleClass(this.theme);
          this.addStyleClass(val);
          this.listMorph.addStyleClass(val);
          this.setProperty('theme', val);
        }
      },

      submorphs: {
        initialize() {
          let input = Text.makeInputLine({
            name: "input",
            highlightWhenFocused: false,
            fixedHeight: false,
            autofit: false
          });
          this.submorphs = [
            input,
            new morph({name: 'padding', fill: Color.transparent}),
            new List({name: "list", items: [], clipMode: "auto"})
          ];
          // rms 24.5.17 in order to ensure that the list correctly conforms to
          //   global style sheets that become active once list is opened in world
          //   NOTE: this is a temporary fix, results in not so nice looking moving of
          //         elements
          this.get('list').whenRendered().then(() => this.get('list').update());
        }
      },

      paddingMorph: {
        derived: true, readOnly: true, after: ['submorphs'],
        get() { return this.getSubmorphNamed('padding'); }
      },

      listMorph: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("list"); },
      },

      inputMorph: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("input"); },
      },

      fontFamily: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.fontFamily; },
        set(val) {
          this.listMorph.fontFamily = val;
          this.inputMorph.fontFamily = val;
        }
      },

      padding: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.padding; },
        set(val) {
          this.listMorph.padding = val;
          this.inputMorph.padding = val;
        }
      },

      fontSize: {
        isStyleProp: true,
        group: "styling",
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.fontSize; },
        set(val) {
          this.listMorph.fontSize = val;
        }
      },

      itemPadding: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.itemPadding; },
        set(val) { this.listMorph.itemPadding = val; }
      },

      inputPadding: {
        isStyleProp: true,
        derived: true, after: ["submorphs", "padding"],
        get() { return this.inputMorph.padding; },
        set(val) { this.inputMorph.padding = val; }
      },

      input: {
        derived: true, after: ["submorphs"], defaultValue: "",
        get() { return this.inputMorph.input; },
        set(val) { this.inputMorph.input = val; }
      },

      historyId: {
        derived: true, after: ["submorphs"], defaultValue: null,
        get() { return this.inputMorph.historyId; },
        set(val) { this.inputMorph.historyId = val; }
      },

      multiSelect: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.multiSelect; },
        set(multiSelect) { this.listMorph.multiSelect = multiSelect; }
      },

      items: {
        after: ["submorphs", "fuzzy", "fuzzySortFunction", "fuzzyFilterFunction"],
        defaultValue: [],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.updateFilter();
        }
      },

      visibleItems: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.items; }
      },

      selection: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selection; },
        set(x) { this.listMorph.selection = x; }
      },

      selectedIndex: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedIndex; },
        set(x) { this.listMorph.selectedIndex = x; }
      },

      selectedIndexes: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedIndexes; },
        set(x) { this.listMorph.selectedIndexes = x; }
      },

      selectedItems: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedItems; },
        set(x) { this.listMorph.selectedItems = x; }
      },

      selections: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selections; },
        set(x) { this.listMorph.selections = x; }
      },

      fuzzy: {
        derived: true, after: ["filterFunction", "sortFunction"],
        set(fuzzy) {
          // fuzzy => bool or prop;
          this.setProperty("fuzzy", fuzzy);
          if (!fuzzy) {
            if (this.sortFunction === this.fuzzySortFunction)
              this.sortFunction = null;
            if (this.filterFunction === this.fuzzyFilterFunction)
              this.filterFunction = this.defaultFilterFunction;
          } else  {
            if (!this.sortFunction) this.sortFunction = this.fuzzySortFunction;
            if (this.filterFunction == this.defaultFilterFunction)
              this.filterFunction = this.fuzzyFilterFunction;
          }
        }
      },

      filterFunction: {
        get() {
          let filterFunction = this.getProperty("filterFunction");
          if (!filterFunction) return this.defaultFilterFunction;
          if (typeof filterFunction === "string")
            filterFunction = eval(`(${filterFunction})`);
          return filterFunction;
        }
      },

      sortFunction: {},

      defaultFilterFunction: {
        readOnly: true,
        get() {
          return this._defaultFilterFunction
              || (this._defaultFilterFunction = (parsedInput, item) =>
                parsedInput.lowercasedTokens.every(token =>
                  item.string.toLowerCase().includes(token)));
        }
      },

      fuzzySortFunction: {
        get() {
          return this._fuzzySortFunction
              || (this._fuzzySortFunction = (parsedInput, item) => {
                var prop = typeof this.fuzzy === "string" ? this.fuzzy : "string";
                // preioritize those completions that are close to the input
                var fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                var base = 0;
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
        get() {
          return this._fuzzyFilterFunction
              || (this._fuzzyFilterFunction = (parsedInput, item) => {
                var prop = typeof this.fuzzy === "string" ? this.fuzzy : "string";
                var tokens = parsedInput.lowercasedTokens;
                if (tokens.every(token => item.string.toLowerCase().includes(token))) return true;
                // "fuzzy" match against item.string or another prop of item
                var fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue, token))) <= 3;
              });
        }
      },

      selectedAction: {
        get() { return this.getProperty("selectedAction") || "default"; }
      },

      actions: {}
    };

  }

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    connect(this.inputMorph, "inputChanged", this, "updateFilter");
    connect(this.listMorph, "selection", this, "selectionChanged");
    connect(this.listMorph, "onItemMorphDoubleClicked", this, "acceptInput");
    this.updateFilter();
    connect(this, 'extent', this, 'relayout');
  }

  resetConnections() {
    let cs = this.attributeConnections;
    if (!cs) return;
    let props = ["accepted", "canceled", "remove"];
    cs.filter(c => props.includes(c.sourceAttrName) && c.targetObj !== this)
      .forEach(c => c.disconnect());
  }

  get isList() { return true; }

  relayout() {
    let {listMorph, inputMorph, paddingMorph, borderWidth: offset} = this;
    inputMorph.topLeft = pt(offset, offset);
    inputMorph.width = listMorph.width = this.width - 2*offset;
    if (paddingMorph) {
      paddingMorph.topLeft = inputMorph.bottomLeft;
    }
    listMorph.position = paddingMorph ? paddingMorph.bottomLeft : inputMorph.bottomLeft;
    listMorph.height = this.height - listMorph.top - offset;
  }

  focus() { this.get("input").focus(); }

  selectionChanged(sel) { signal(this, "selection", sel); }

  scrollSelectionIntoView() { return this.listMorph.scrollSelectionIntoView(); }

  parseInput() {
    var filterText = this.get("input").textString,

        // parser that allows escapes
        parsed = Array.from(filterText).reduce(((state, char) => {
          // filterText = "foo bar\\ x"
          if (char === "\\" && !state.escaped) {
            state.escaped = true;
            return state;
          }

          if (char === " " && !state.escaped) {
            if (!state.spaceSeen && state.current) {
              state.tokens.push(state.current);
              state.current = "";
            }
            state.spaceSeen = true;
          } else {
            state.spaceSeen = false;
            state.current += char;
          }
          state.escaped = false;
          return state;
        }), {tokens: [], current: "", escaped: false, spaceSeen: false});
    parsed.current && parsed.tokens.push(parsed.current);
    var lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return {tokens: parsed.tokens, lowercasedTokens, input: filterText};
  }

  updateFilter() {
    var parsedInput = this.parseInput(),
        filterFunction = this.filterFunction,
        sortFunction = this.sortFunction,
        filteredItems = this.items.filter(item => filterFunction.call(this, parsedInput, item));

    if (sortFunction)
      filteredItems = arr.sortBy(filteredItems, ea => sortFunction.call(this, parsedInput, ea));

    var list = this.listMorph,
        newSelectedIndexes = this.updateSelectionsAfterFilter ?
          list.selectedIndexes.map(i => filteredItems.indexOf(list.items[i])).filter(i => i !== -1) :
          list.selectedIndexes;

    list.items = filteredItems;
    list.selectedIndexes = newSelectedIndexes.length ? newSelectedIndexes : filteredItems.length ? [0] : [];
    this.scrollSelectionIntoView();

    signal(this, "filterChanged", {parsedInput, items: list.items});
  }

  acceptInput() {
    var list = this.listMorph;
    this.get("input").acceptInput();
    var result = {
      filtered: this.items,
      selected: list.selections,
      action: this.selectedAction,
      status: "accepted",
    };
    signal(this, "accepted", result);
    return result;
  }

  get keybindings() {
    return [
      {keys: "Up|Ctrl-P",                    command: "arrow up"},
      {keys: "Down|Ctrl-N",                  command: "arrow down"},
      {keys: "Shift-Up",                     command: "select up"},
      {keys: "Shift-Down",                   command: "select down"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Enter",                        command: "accept input"},
      {keys: "Escape|Ctrl-G",                command: "cancel"},
      {keys: "Tab",                          command: "choose action"},
      ...arr.range(0, 8).map(n => {
        return {
          keys: "Alt-" + (n+1),
          command: {command: "choose action and accept input", args: {actionNo: n}}};
      })
    ].concat(super.keybindings);
  }

  get commands()  {
    return super.commands.concat([
      {
        name: "accept input",
        exec: (morph) => { this.acceptInput(); return true; }
      },

      {
        name: "cancel",
        exec: (morph) => {
          signal(morph, "canceled");
          return true;
        }
      },

      {
        name: "choose action and accept input",
        exec: (flist, args = {}) => {
          let {actionNo = 0} = args;
          flist.selectedAction = (flist.actions || [])[actionNo];
          return flist.execCommand("accept input");
        }
      },

      {
        name: "choose action",
        exec: async (morph) => {
          if (!morph.actions) return true;

          let similarStyle = {...morph.style, extent: morph.extent};
          let chooser = new FilterableList(similarStyle);
          chooser.openInWorld(morph.globalPosition);
          chooser.items = morph.actions;
          let preselect = morph.actions.indexOf(morph.selectedAction);
          if (preselect === -1) preselect = 0;
          chooser.selectedIndex = preselect;
          connect(chooser, 'accepted', morph, 'selectedAction', {
            converter: function(result) {
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return result.selected[0];
            }
          });
          connect(chooser, 'canceled', morph, 'selectedAction', {
            converter: function(result) {
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
        ({...cmd, exec: (morph, opts, count) => cmd.exec(this.listMorph, opts, count)}))
    ]);
  }

}


export class DropDownList extends Button {

  // new DropDownList({selection: 1, items: [1,2,3,4]}).openInWorld()

  static get properties() {
    return {

      padding:      {defaultValue: Rectangle.inset(3,2)},
      listHeight:   {defaultValue: 100},

      listAlign: {
        type: 'Enum',
        values: ['bottom', 'top'],
        defaultValue: "bottom"
      },

      openListInWorld: { defaultValue: false },

      listMorph: {
        after: ["labelMorph"],
        get() {
          let list = this.getProperty("listMorph");
          if (list) return list;
          list = new List({name: "dropDownList"});
          this.setProperty("listMorph", list);
          return list;
        }
      },
      
      items: {
        derived: true, after: ["listMorph"],
        get() { return this.listMorph.items; },
        set(value) { this.listMorph.items = value; }
      },

      selection: {
        after: ["listMorph", 'items'], derived: true,
        get() {
          return this.listMorph.selection;
        },
        set(value) {
          let {listAlign, listMorph} = this;

          if (!value) {
            listMorph.selection = null;
            this.label = "";

          } else {
            let {items} = listMorph,
                item = listMorph.find(value);
            if (!item && typeof value === "string") {
              item = items.find(ea => ea.string === value);
            }
            if (!item) return;

            let label = item.label || [item.string, null];
            label = [
              ...label, " ", null,
              ...Icon.textAttribute(
                "caret-" + (listAlign === "bottom" ?
                  "down" : "up"))
            ];
            if (label[5]) label[5].textStyleClasses = ['fa', 'annotation'];
            this.label = label;
            this.relayout();

            listMorph.selectedIndex = items.indexOf(item);
          }
          signal(this, "selection", listMorph.selection);
        }
      }

    };

  }

  fitLabelMorph() {
    // do not fit!
  }
  
  constructor(props) {
    super(props);
    connect(this, "fire", this, "toggleList");
  }

  onLoad() {
    if (!this.listMorph.selection) this.listMorph.selection = this.labelMorph.value[0];
  }

  isListVisible() { return !!this.listMorph.world(); }

  removeWhenFocusLost(evt) {
    setTimeout(() => {
      let list = this.listMorph,
          focused = this.world() && this.world().focusedMorph;
      if (list !== focused && focused !== this
          && list.world()
          && !list.withAllSubmorphsDetect(m => m == focused)) {
        list.fadeOut(200);
      } else once(touchInputDevice ? list.scroller : list, 'onBlur', this, 'removeWhenFocusLost');
    }, 100);
  }

  async toggleList() {
    var list = this.listMorph, bounds;
    if (this.isListVisible()) {
      signal(this, "deactivated");
      this.selection = list.selection;
      list.epiMorph = false;
      list.remove();
    } else {
      signal(this, "activated");
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
      let totalItemHeight = (list.items.length * list.itemHeight) + list.padding.top() + list.padding.bottom();
      list.extent = pt(this.width, Math.min(this.listHeight, totalItemHeight));
      if (this.listAlign === "top") {
        list.bottomLeft = bounds.topLeft();
      } else {
        list.topLeft = bounds.bottomLeft();
      }
      once(list, 'onItemMorphClicked', this, 'toggleList');
      once(touchInputDevice ? list.scroller : list, 'onBlur', this, 'removeWhenFocusLost');
      await list.whenRendered();
      await list.whenRendered();
      touchInputDevice ? list.scroller.focus() : list.focus();
      list.scrollSelectionIntoView();
    }
  }

  get commands() {
    return [
      {
        name: "accept",
        exec: () => {
          if (this.isListVisible()) this.toggleList();
          return true;
        }
      },

      {
        name: "cancel",
        exec: () => {
          if (this.isListVisible()) this.listMorph.remove();
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Enter", command: "accept"},
      {keys: "Escape|Ctrl-G", command: "cancel"}
    ]);
  }

}

export class InteractiveItem extends ListItemMorph {
  static get properties() {
    return {
      draggable: {
        defaultValue: touchInputDevice ? false : true 
      },
      item: {
        derived: true,
        get() {
          return this.list.items[this.itemIndex];
        }
      },
      list: {
        drived: true,
        get() {
          return this.owner.owner;
        }
      },
      isListItem: {
        get() {
          return true
        }
      }
    }
  }

  fit() {
    // resize the target according to the style
  }

  onHaloGrabover(active) {
    this.list.showDropPreviewFor(this, active);
  }

  async onDrop(evt) {
     // insert a morph item in my place, or if I receive a label morph,
     // just a vanilla label
     if (this.item.isPreview) {
       let wrappedMorph = evt.hand.grabbedMorphs[0];
       super.onDrop(evt);
       await this.list.whenRendered();
       this.list.addItemAt({
         morph: wrappedMorph,
         isListItem: true
       }, this.itemIndex);
       this.list.clearPreviews();
     }
  }

  select() {
    this.list.selectedIndex = this.itemIndex;
    this.item.morph.focus();
  }

  onMouseDown(evt) {
    if (!touchInputDevice)
      this.select();
    else
      this._touchDown = Date.now();
  }

  onMouseUp(evt) {
    if (touchInputDevice && Date.now() - this._touchDown < 500) {
       this.select();
    }
  }
  
  displayItem(item, itemIndex, goalWidth, itemHeight, pos, isSelected = false, style) {
    super.displayItem(item, itemIndex, goalWidth, itemHeight, pos, isSelected, style);
    if (item.morph) item.morph.selected = isSelected;
  }

  onGrab(evt) {
    // fixme: on mobile this gesture needs to be triggered in a different way
    // maybe hold and wait?
    let list = this.list;
    let hasHaloAttached = evt.halo && evt.halo.target === this;
    if (hasHaloAttached) evt.halo.detachFromTarget();
    let copy = this.submorphs.length ? 
         this.submorphs[0] : 
         morph({ type: 'label', value: this.value});
    evt.hand.grab(copy);
    copy.position = evt.hand.localize(this.globalPosition);
    if (hasHaloAttached) evt.halo.refocus(copy);
    list.removeItem(this.list.items[this.itemIndex])
    list.itemMorphs.forEach(m => m.remove());
    list.update();
  }
  
}

export class MorphList extends List {

  static get properties() {
    return {
      touchInput: {
        get() {
          return touchInputDevice;
        }
      },
      items: {
        group: "list", defaultValue: [], after: ["submorphs"],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.itemMorphs.forEach(m => m.remove());
          this.update();
          if (this.attributeConnections)
            signal(this, "values", this.values);
        }
      }
    }
  }

  onLoad() {
    super.onLoad();
    this.clipMode = this.touchInput ? 'auto' : 'hidden';
  }

  showDropPreviewFor(itemMorph, active) {
    let idx = itemMorph.itemIndex;
    let hoveredItem = this.items[idx];
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
        fill: Color.orange.withA(.5)
      })
    }, idx);
  
  }

  clearPreviews() {
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
  
  update() {
    var items = this.items;
    if (!items) return; // pre-initialize
    if (!this.listItemContainer) return;
    if (this.scroller) this.scroller.visible = false;
    this.dontRecordChangesWhile(() => {
      var {
            itemHeight,
            itemMorphs, listItemContainer,
            selectedIndexes,
            extent: {x: width, y: height},
            fontSize, fontFamily, fontColor,
            padding, itemPadding, selectionColor,
            selectionFontColor, nonSelectionFontColor,
            itemBorderRadius, scrollBar
          } = this,
          {scroll: {x: left, y: top}} = this,
          padding = padding || Rectangle.inset(0),
          padTop = padding.top() , padLeft = padding.left(),
          padBottom = padding.bottom(), padRight = padding.right(),
          scrollOffset = top,
          firstItemIndex = Math.max(0, Math.floor(top / itemHeight)),
          lastItemIndex = Math.min(items.length, Math.ceil((top + height) / itemHeight)),
          maxWidth = 0,
          goalWidth = this.width - (padLeft + padRight);

      // try to keep itemIndexes in the items that were initially assigned to them
      let rest, upper, lower;
      
      itemMorphs = arr.sortBy(itemMorphs, m => m.itemIndex);
      [upper, rest] = arr.partition(itemMorphs, m => m.itemIndex < firstItemIndex);
      [lower, rest] = arr.partition(rest, m => m.itemIndex > lastItemIndex);
      itemMorphs = [...lower, ...rest, ...upper];

      let style = {
        fontSize, fontFamily,
        fontColor: nonSelectionFontColor || fontColor,
        padding: itemPadding, borderRadius: itemBorderRadius || 0,
        selectionFontColor,
        nonSelectionFontColor,
        selectionColor
      };

      if (itemMorphs.length && lastItemIndex-firstItemIndex > itemMorphs.length) {
         if (firstItemIndex != itemMorphs[0].itemIndex)
           arr.pushAt(itemMorphs, listItemContainer.addMorph(new InteractiveItem(style)), 0);
         else if (lastItemIndex != arr.last(itemMorphs).itemIndex)
           itemMorphs.push(listItemContainer.addMorph(new InteractiveItem(style)));
      }

      for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
        var itemIndex = firstItemIndex+i,
            item = items[itemIndex];

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
      
      let containerExtent, scrollHeight = Math.max(padTop + padBottom + itemHeight * items.length, this.height);
      containerExtent = pt(this.width, scrollHeight).subPt(pt(padLeft + padRight,0));
      listItemContainer.setBounds(pt(padLeft, padTop).extent(containerExtent));

      scrollBar.left = maxWidth - 10;
      scrollBar.fill = null;
      scrollBar.top = 0;
      scrollBar.extent = pt(1, scrollHeight);
    });
  }

  onHoverIn(evt) {
    this.clipMode = 'auto';
  }

  onHoverOut(evt) {
    if (this.touchInput) return;
    this.clipMode = 'hidden';
  }

  onScroll(evt) {
    this.update();
  }
}
